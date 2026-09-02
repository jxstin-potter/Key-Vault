# 🔑 KeyVault

A digital game-key marketplace. Browse a catalogue, buy a key, receive it instantly.

React 19 · Express · PostgreSQL · Prisma · Stripe · Deployed on Vercel + Render + Neon

> **Live demo:** _add your Vercel URL here_ · **API reference:** `/api/docs` on your Render URL
>
> The API sleeps on Render's free tier. The first request after a quiet spell takes
> 30–60 seconds to wake it; the site tells you this is happening rather than looking broken.
> Pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.

---

## The part worth reading

Most portfolio storefronts model inventory as `products.stock INTEGER` and decrement it at
checkout. That is fine until two people buy the last item at the same moment, at which point
both `UPDATE products SET stock = stock - 1` statements succeed and you have sold something
you do not have.

**KeyVault has no stock column.** Every sellable unit is a row in `game_keys`, and a
product's availability is the count of those rows in `AVAILABLE` status. Selling is not
arithmetic on a counter — it is moving specific rows through a state machine:

```
AVAILABLE ──reserve──▶ RESERVED ──payment confirmed──▶ SOLD ──refund──▶ REVOKED
                │  ▲                                                        
                │  └──────── hold expires / session cancelled ──────────┐  
                └────────────────────────────────────────────────────────┘
```

Three things fall out of that, and they are what the code is really about:

**Two buyers cannot get the same key.** Checkout claims candidate rows with
`SELECT … FOR UPDATE SKIP LOCKED`, so concurrent transactions receive *disjoint* candidate
sets rather than fighting over the same rows. Twenty-five simultaneous buyers against five
keys sell exactly five. ([`src/lib/keys.js`](backend/src/lib/keys.js))

**A duplicated payment webhook cannot deliver twice.** Stripe guarantees *at least once*
delivery. Fulfilment is guarded by a conditional `UPDATE … WHERE status = 'PENDING'` whose
row count is the idempotency check — a replayed event matches nothing and returns early. No
processed-events table needed. ([`src/lib/fulfillment.js`](backend/src/lib/fulfillment.js))

**Nobody can pay for a key that has already been given away.** The reservation deliberately
outlives the Stripe session — 35 minutes against 30 — so the payment window always closes
first. ([`src/routes/checkout.js`](backend/src/routes/checkout.js))

And one domain decision that is easy to get wrong: **a refunded key is `REVOKED`, never
returned to sale.** The customer has already seen the code. Reselling it would turn one
refund into a second angry customer. ([`src/lib/refunds.js`](backend/src/lib/refunds.js))

### These are claims, so they are tested

154 tests run against a **real PostgreSQL instance**, not a mocked Prisma client — the
guarantee under test is a property of what Postgres does with row locks under `READ
COMMITTED`, and a mock would only assert that it returns what it was told to.

```bash
cd backend && npm test
```

The headline case, from [`tests/keys.concurrency.test.js`](backend/tests/keys.concurrency.test.js):

```
✓ lets exactly one of twenty simultaneous buyers take the last key
✓ sells exactly the stock on hand when demand exceeds it
✓ never lets total keys drift, whatever the interleaving
✓ recovers contention losers through withKeyRetry when stock is sufficient
```

That second test is why the code uses `SKIP LOCKED`. The first implementation was *safe* —
it never oversold — but under contention every buyer selected the same candidate rows, so
25 shoppers racing for 5 keys sold **3**, and told the other 22 it was out of stock while
two keys sat unsold. Safety was never the problem; liveness was. The test found it.

---

## Architecture

```
┌──────────────┐         ┌──────────────────────────────┐        ┌────────────┐
│   Browser    │────────▶│   Express API (Render)       │───────▶│  Postgres  │
│ React + Vite │  JSON   │                              │ Prisma │   (Neon)   │
│  (Vercel)    │◀────────│  routes/ ── lib/ ── prisma   │◀───────│            │
└──────┬───────┘         └───────────┬──────────────────┘        └────────────┘
       │                             │      ▲
       │ redirect to pay             │      │ webhook: payment confirmed,
       │                             ▼      │ session expired, charge refunded
       │                       ┌─────────────────┐
       └──────────────────────▶│     Stripe      │
                               └─────────────────┘
```

Fulfilment happens in the **webhook**, not on the success redirect, so a customer who closes
the tab after paying still receives their keys. The success page is a read-only poll.

```
backend/
  src/
    app.js                  Express app construction (no listening — importable by tests)
    server.js               Process lifecycle: port, startup checks, graceful shutdown
    routes/                 HTTP layer, one module per resource
    lib/
      keys.js               Reservation, fulfilment, release. The concurrency core.
      fulfillment.js        Idempotent order completion
      refunds.js            Stripe refund + key revocation, with ordering rationale
      reservationSweeper.js Background release of lapsed holds
      logger.js             Structured logging with secret redaction
    middleware/             Auth, request logging, error handling
    docs/openapi.js         OpenAPI 3.1 spec (drift-tested against the router)
  tests/                    154 tests against real Postgres
  prisma/                   Schema + migrations

frontend/
  src/
    pages/                  Route components
    components/             Reusable UI, layout, admin modals
    stores/                 Zustand (auth, cart)
    lib/api.js              Axios client, auth interception, cold-start detection
```

---

## Running it locally

**Prerequisites:** Node 18+, a PostgreSQL database (local, or [Neon](https://neon.tech)).

```bash
# Backend
cd backend
cp .env.example .env          # then fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate deploy     # build the schema
npm run db:seed               # catalogue + demo accounts
npm run dev                   # http://localhost:5000

# Frontend (new terminal)
cd frontend
echo "VITE_API_URL=http://localhost:5000/api" > .env.local
npm install
npm run dev                   # http://localhost:5173
```

| | |
|---|---|
| Storefront | http://localhost:5173 |
| API | http://localhost:5000 |
| **API reference** | http://localhost:5000/api/docs |
| Liveness / readiness | `/health` · `/health/ready` |
| Database GUI | `npm run db:studio` |

### Demo accounts

- **Shopper:** `user@keyvault.com` / `user123`

The seeded admin is `admin@keyvault.com`. Its password is deliberately not written here —
this README is public, and the admin role can mint and read game keys and read every
customer record. `npm run db:seed` picks it in this order:

1. `SEED_ADMIN_PASSWORD`, if set.
2. In production with nothing set: a random 24-character password, printed once to the seed
   output. Copy it out of the deploy log.
3. Locally: a fixed dev password, so the usual workflow stays friction-free.

Re-seeding never changes the password of an admin that already exists, so a routine reseed
cannot silently undo a rotation.

### Enabling payments locally

Checkout returns `503` until Stripe is configured — deliberately, so the rest of the store
works without it. To exercise the full flow:

```bash
# .env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."   # from `stripe listen` below

# Forward webhooks to your local server (Stripe CLI)
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

Fulfilment only happens on the webhook, so **without `stripe listen` a local payment
succeeds and no key is ever delivered.** That is the correct behaviour, not a bug — it is
the same path that protects a customer who closes the tab.

---

## Testing

```bash
cd backend
npm test                # 154 tests
npm run test:coverage   # with coverage
npm run test:watch
```

Tests need a PostgreSQL instance. Point `TEST_DATABASE_URL` at one, or:

```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name kv-test postgres:16
```

The schema is pushed automatically before the suite runs, and every test starts from a
truncated database.

| Suite | What it pins down |
|---|---|
| `keys.concurrency` | Oversell, undersell, key conservation, reservation expiry |
| `fulfillment` | Idempotent delivery under duplicate and concurrent webhooks |
| `refunds` | Stripe-first ordering, key revocation, replay safety |
| `checkout` | Server-side pricing, stock limits, reservation/session TTL invariant |
| `webhooks` | Signature verification, raw-body mounting, retry contract |
| `authz` | 52 boundary checks: admin routes, token forgery, per-customer isolation |
| `journey` | Signup → browse → buy → receive key → refund, end to end |
| `catalogue` · `reviews` | Derived stock, filtering, denormalised rating consistency |
| `docs` | OpenAPI document matches the mounted routes, both directions |

---

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request:

- **Backend** — full suite against a PostgreSQL service container, with coverage uploaded.
- **Migration check** — replays the migration history into a clean shadow database and fails
  if the result differs from `schema.prisma`. This exists because it had already gone wrong:
  the repository spent a year with a migration history describing the *original
  physical-goods store*, so `prisma migrate deploy` on a fresh database built a schema this
  application would not have recognised. Nothing was checking.
- **Frontend** — lint and production build.
- **Audit** — `npm audit` on both packages, advisory only.

---

## Deployment

| Piece | Where | Notes |
|---|---|---|
| Frontend | Vercel | Root `frontend`, set `VITE_API_URL` |
| API | Render | Root `backend`, config in [`render.yaml`](backend/render.yaml) |
| Database | Neon | Use the **direct** connection string, not the pooled one |

`render.yaml` runs `prisma migrate deploy` in the **build** step, so a bad migration fails
the build and Render keeps serving the previous instance instead of restart-looping.

**A database first created with `prisma db push`** (which includes the original production
one) needs its baseline recorded once, or migrations will try to create objects that already
exist:

```bash
npx prisma migrate resolve --applied 20260902000000_digital_key_marketplace
```

> **Neon connection strings.** Neon gives you a **pooled** string (hostname ends `-pooler`)
> and a **direct** one. Use the **direct** string. Prisma's migrate and seed paths open
> multiple sequential connections, and Neon's pooled endpoint (PgBouncer in transaction
> mode) makes `db:seed` hang indefinitely with no error.

### Environment variables

**Backend**

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres, direct connection string |
| `JWT_SECRET` | ✅ | 32+ characters; the server refuses to start in production without it |
| `FRONTEND_URL` | ✅ | CORS origin and Stripe redirect target |
| `PORT` | ✅ | Injected by Render |
| `STRIPE_SECRET_KEY` | — | Without it, checkout returns 503 and the rest of the store works |
| `STRIPE_WEBHOOK_SECRET` | — | From your webhook endpoint; **fulfilment depends on it** |
| `SEED_ADMIN_PASSWORD` | — | See demo accounts above |
| `LOG_LEVEL` | — | Defaults: `info` in production, `debug` locally, silent in tests |

**Frontend**

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | ✅ | Inlined at build time — a build without it throws loudly on load, by design |

The webhook endpoint should point at `https://<your-api>/api/webhooks/stripe` and subscribe
to `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.

---

## Operational notes

**Health checks.** `/health` is liveness and deliberately does *not* touch the database — a
transient database blip should not make the platform restart an otherwise healthy process.
`/health/ready` is the dependency check and round-trips a `SELECT 1`.

**Logging.** Structured JSON via pino, one object per line, with a correlation id on every
request (echoed as `X-Request-Id`). A user reporting "my checkout failed at 14:32" gives you
an id from their network tab that pulls back every log line for that request. Secrets are
redacted at the logger, as a backstop for the times someone forgets.

**Reservation sweeper.** Lapsed holds are released on a one-minute interval as well as at the
top of every checkout. The checkout-time sweep alone is enough for *correctness*, but on a
quiet store an abandoned checkout left keys stuck in `RESERVED` — and the catalogue said
"sold out" until some other shopper happened to trigger a sweep.

**Rate limiting.** Two budgets. General traffic gets 1000 per 15 minutes; authentication
gets 20 *failed* attempts, with successes not counted, so a legitimate user is never locked
out by their own activity while password guessing stays expensive.

---

## Tech stack

**Backend** — Node 18+, Express 4, PostgreSQL, Prisma 6, JWT + bcrypt, express-validator,
Helmet, pino, Stripe, Vitest + Supertest

**Frontend** — React 19, Vite 7, Tailwind 3, Zustand, React Router 6, Axios, Recharts,
lucide-react

---

## Known limitations

Worth stating plainly rather than leaving to be discovered:

- **The reservation sweeper is an in-process timer.** Correct for a single instance; across
  several, every instance runs the same `UPDATE` and the losers match zero rows. Harmless
  but wasteful. Horizontal scaling wants a Postgres advisory lock around the sweep.
- **`SKIP LOCKED` can report out-of-stock** while another transaction holds rows it will
  ultimately roll back. The window is one checkout transaction wide and self-corrects on
  retry. The alternative — plain `FOR UPDATE` — serialises every purchase of the same
  product behind one lock queue, which is the worse trade for a store.
- **Review rating aggregates are denormalised** onto `products` and refreshed on write. Tests
  assert they stay consistent, but a crash between the review write and the refresh would
  leave them stale until the next write to that product.
- **`AdminSettings.jsx` is 780 lines** and mostly writes to local state.
- **No end-to-end browser tests.** The `journey` suite covers the full flow through HTTP,
  but nothing drives a real browser.

## License

ISC.

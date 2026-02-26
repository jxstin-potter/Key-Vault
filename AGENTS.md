# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

CommerceFlow v2 is a full-stack e-commerce platform with two services:
- **Backend** (`/backend`): Express.js API on port 5000 with Prisma ORM + PostgreSQL
- **Frontend** (`/frontend`): React 19 + Vite SPA on port 5173

See `README.md` for full docs, commands, and test accounts.

### Running services

PostgreSQL must be running before the backend starts:
```
sudo pg_ctlcluster 16 main start
```

Start each service in separate terminals from the repo root:
```
cd backend && npm run dev     # port 5000
cd frontend && npm run dev    # port 5173
```

### Environment files (not committed)

- `backend/.env` — requires `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `PORT=5000`. The backend **exits** if `PORT` is not set.
- `frontend/.env.local` — requires `VITE_API_URL=http://localhost:5000/api`

### Lint / Build / Test

- Lint: `cd frontend && npm run lint` — 17 pre-existing ESLint errors (in `env-setup.js`, several pages/stores). No backend linter configured.
- Build: `cd frontend && npm run build`
- No automated test framework exists. Testing is manual via curl or the frontend UI. See `README.md` "Testing" section.

### Database

- Prisma schema: `backend/prisma/schema.prisma`
- Generate client: `cd backend && npm run db:generate` (also runs on `npm install` via `postinstall`)
- Push schema: `cd backend && npm run db:push`
- Seed demo data: `cd backend && npm run db:seed`
- Test accounts after seeding: `admin@commerceflow.com` / `admin123`, `user@commerceflow.com` / `user123`

### Gotchas

- The backend rate limiter is set to 100 requests per 15 minutes per IP (all routes). Keep this in mind when running many API calls in rapid succession.
- The `npm run db:seed` script uses `create` (not `upsert`) for products, so re-running seed on an already-seeded database will fail with unique constraint violations. Use `npm run db:push -- --force-reset` followed by `npm run db:seed` to reset.

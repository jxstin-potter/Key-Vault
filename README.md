# 🔑 KeyVault

A digital game key marketplace with Stripe payments, instant delivery, and a professional admin dashboard. Built with React 19, Express.js, and PostgreSQL. Deployed on Vercel + Render with auto CI/CD.

**Live**: https://keyv.vercel.app | Demo: `user@keyvault.com` / `user123`

## What Makes It Stand Out

- **Real Payment Flow**: Stripe Checkout with webhook-based key fulfillment, not a mock checkout
- **Professional Branding**: Custom logo, Steam-inspired design system (color tokens, component layer, AA contrast)
- **Production Ready**: Auto-deployed, health checks, rate limiting, JWT auth, CORS protection
- **Smart Backend**: Key reservation system with TTL, idempotent webhook handlers, cart management

## Quick Start

### Try It Now (2 seconds)
Open https://keyv.vercel.app, login as `user@keyvault.com` / `user123`, click Games, add to cart, checkout.

### Run Locally (5 minutes)
```bash
git clone https://github.com/jxstin-potter/commerceFlow
cd backend && npm install && npm run db:seed && npm run dev   # Terminal 1
cd frontend && npm install && npm run dev                      # Terminal 2
# Frontend: http://localhost:5173, Backend: http://localhost:5000
```

Requires Node.js 18+, PostgreSQL (or use Neon free tier), and `JWT_SECRET` in `.env`.

## Tech Stack

**Frontend**: React 19, Vite, Tailwind CSS, Zustand  
**Backend**: Express.js, Prisma ORM, PostgreSQL, Stripe SDK  
**Deployment**: Vercel (frontend), Render (backend), Neon (database)

## Key Features

| User-Facing | Admin Panel |
|-------------|-------------|
| 🛒 Stripe checkout with instant key delivery | 📦 Product management with bulk import |
| 🔐 My Keys dashboard (purchases grouped by order) | 📊 Analytics dashboard (sales, revenue) |
| ⭐ Game ratings, stock status, platform filtering | 👥 User administration, order history |
| 🎯 Responsive design (desktop/mobile/tablet) | 🔑 Key inventory tracking |

## What's Included

- **9k lines** of well-structured code
- **15+ REST endpoints** (auth, products, cart, checkout, keys, admin)
- **Webhook system** for Stripe payment confirmation and key delivery
- **Admin dashboard** with analytics and product management
- **Real game data** (100+ titles with Steam cover art)
- **Production deployment** (auto-scaling, health checks, CI/CD)

## Highlights

✅ **Branding Done Right**: Custom key+D-pad logo, blue-grey + signal blue palette, measured AA contrast  
✅ **Payment Flow**: Reserves keys during checkout, delivers on payment, handles webhook duplicates  
✅ **Database Smart**: Prisma migrations, seeding, Prisma Studio included  
✅ **Clean Deployment**: Render health checks, Vercel auto-deploy on push, proper env config  

## Development

```bash
# Backend commands
npm run dev              # Start dev server
npm run db:studio       # Open database GUI
npm run db:seed         # Seed data

# Frontend commands  
npm run dev             # Start dev server
npm run build           # Production build
npm run lint            # Check code quality
```

Test accounts:
- **Shopper**: `user@keyvault.com` / `user123`
- **Admin**: Ask for credentials (set at deployment via `SEED_ADMIN_PASSWORD`)

## Security

- JWT authentication with secure tokens
- Password hashing (bcryptjs)
- CORS with origin validation
- Rate limiting (1000 req/15min general traffic, 20 failed attempts/15min on auth)
- Input validation (express-validator)
- Helmet for HTTP headers
- Stripe webhook signature verification

## Architecture at a Glance

```
Frontend (React 19 + Vite)          Backend (Express.js)           Database (PostgreSQL)
  ├─ Pages (Home, Products,    →    ├─ Routes (auth, products,  →   ├─ Users
  │  Cart, Checkout, Keys)         │  cart, checkout, keys)         ├─ Products
  ├─ Components (GameCard,         ├─ Middleware (auth, rate      ├─ CartItems
  │  Cart, Header, Footer)         │  limiting, validation)        ├─ Orders
  ├─ Stores (Cart, Auth, UI)       ├─ Webhooks (Stripe)           ├─ OrderItems
  └─ Styles (Tailwind)             └─ Services (Prisma ORM)       └─ GameKeys
```

## License

ISC

---

**Built for learning, designed for production.** 🚀

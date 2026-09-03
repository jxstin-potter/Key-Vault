# 🔑 KeyVault

A digital game key marketplace with real Stripe payments, professional branding, and a production-ready admin dashboard. Built with React 19, Express.js, and PostgreSQL.

**Live**: https://keyv.vercel.app | Demo: `user@keyvault.com` / `user123`

## What Makes It Stand Out

- **Real Payments & Fulfillment**: Stripe Checkout → webhook key delivery with TTL reservation system
- **Professional Branding**: Custom logo, Steam-inspired design (color tokens, AA contrast)
- **Production Ready**: Auto-deployed, health checks, rate limiting, JWT auth, CORS, idempotent handlers
- **100+ Real Games**: Steam cover art, live pricing, platform/region filtering

## Quick Start

**Live Demo** (2 sec): https://keyv.vercel.app with `user@keyvault.com` / `user123`

**Local Setup** (5 min):
```bash
git clone https://github.com/jxstin-potter/commerceFlow
cd backend && npm install && npm run db:seed && npm run dev   # Terminal 1
cd frontend && npm install && npm run dev                      # Terminal 2
```
Frontend: http://localhost:5173 | Backend: http://localhost:5000

Requires Node.js 18+, PostgreSQL, `JWT_SECRET`

## Tech Stack

**Frontend**: React 19, Vite, Tailwind CSS, Zustand  
**Backend**: Express.js, Prisma ORM, PostgreSQL, Stripe SDK  
**Deployment**: Vercel (frontend), Render (backend), Neon (database)

## Features

| User | Admin |
|------|-------|
| 🛒 Checkout & instant delivery | 📦 Product & key management |
| 🔐 Order history | 📊 Analytics & revenue tracking |
| ⭐ Ratings & filtering | 👥 User administration |
| 🎯 Responsive design | 🔑 Inventory tracking |  

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
- Rate limiting (100 req/15min per IP)
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

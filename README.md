# 🔑 KeyVault

A digital game key marketplace built with React 19, Express.js, and PostgreSQL. Browse games by genre and platform, buy a key, and receive it instantly. Deployed on Render (backend) and Vercel (frontend) with automatic CI/CD.

**Live Demo**: https://commerce-flow-v2.vercel.app

## 🎨 Screenshots

| Homepage | Browse Games |
|----------|--------------|
| ![Homepage](https://github.com/jxstin-potter/commerceFlow/raw/main/.github/assets/home.png) | ![Browse](https://github.com/jxstin-potter/commerceFlow/raw/main/.github/assets/browse.png) |

| Shopping Cart | My Keys Dashboard |
|--------------|-------------------|
| ![Cart](https://github.com/jxstin-potter/commerceFlow/raw/main/.github/assets/cart.png) | ![My Keys](https://github.com/jxstin-potter/commerceFlow/raw/main/.github/assets/mykeys.png) |

### Key Features Shown
- **Steam-inspired branding** with professional blue/teal palette
- **Custom logo** (key with D-pad) across all pages
- **Product grid** with platform badges, stock status, ratings
- **Shopping cart** with real-time totals
- **Instant key delivery** dashboard showing purchased games
- **Responsive design** optimized for desktop and mobile

## ✨ Features

### Product Discovery
- **🛍️ Game Catalog**: Browse 100+ games with real Steam cover art
- **🏷️ Smart Filtering**: Filter by platform (Steam, Epic, PlayStation, Xbox, etc.) and region
- **⭐ Ratings & Reviews**: Community ratings and review counts
- **📊 Product Details**: Platform, region, developer, release date, stock status

### E-commerce
- **🛒 Shopping Cart**: Persistent cart with real-time totals
- **💳 Stripe Payment**: Secure checkout with key reservation system
- **🔐 Instant Delivery**: Keys delivered immediately upon payment confirmation
- **📋 Order History**: Track all purchases with delivery status

### User Experience  
- **👤 Account Management**: Registration, authentication, profile editing
- **📱 Responsive Design**: Optimized for desktop, tablet, and mobile
- **🎨 Professional Branding**: Custom logo, Steam-inspired color palette
- **🔄 Real-time Updates**: Cart state, key delivery, order status

### Admin Tools
- **🔐 Admin Dashboard**: Secure admin panel with role-based access
- **📦 Product Management**: Create, edit, delete games with bulk import
- **🔑 Key Inventory**: Manage game keys, track stock levels
- **👥 User Administration**: View customer profiles and order history
- **📊 Analytics**: Sales dashboard with revenue and order metrics

### Technical Excellence
- **🚀 Modern Stack**: React 19, Express.js, Prisma, PostgreSQL
- **☁️ Cloud Deployed**: Render backend, Vercel frontend with auto-scaling
- **🔄 CI/CD Pipeline**: Automatic deployment on git push
- **🔒 Security**: JWT auth, rate limiting, CORS protection, password hashing
- **⚡ Performance**: Lazy loading, optimized images, efficient queries

## 🎯 Recent Improvements (Sept 2024)

### Branding Overhaul
- **Custom Logo**: Redesigned key icon with integrated D-pad gaming element
- **Color System**: Professional blue-grey palette (#171a21 ground, signal blue accent)
- **Typography**: Single font family (Inter) with weight-based hierarchy for cleaner aesthetics
- **Footer Redesign**: Minimal 3-column layout (reduced from 409px to 273px)
- **Component System**: 
  - `.btn-primary`: Solid blue buttons with shadow depth
  - `.card-game`: Border-only cards with subtle hover effects
  - `.badge-*`: Status badges with dark plate backgrounds

### Styling Approach
- **Tailwind + Custom CSS**: Extended Tailwind with @layer components
- **Color Token Retuning**: Updated entire palette in one config file (all 36+ components inherit automatically)
- **Accessibility**: Measured contrast ratios (5.36:1 for AA compliance on normal text)
- **Responsive**: Mobile-first approach with proper viewport handling

## 🏗️ Architecture

```
commerceFlow-v2/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── server.js       # Main server file
│   │   └── seed.js         # Database seeding
│   ├── prisma/             # Database schema & migrations
│   ├── render.yaml         # Render deployment config
│   └── deploy-setup.js     # Deployment automation
└── frontend/                # React/Vite application
    ├── src/
    │   ├── components/     # Reusable UI components
    │   ├── pages/          # Page components
    │   ├── stores/         # Zustand state management
    │   └── lib/            # API client & utilities
    ├── vercel.json          # Vercel deployment config
    └── vite.config.js       # Vite configuration
```

## 🚀 Quick Start

### See It Live Right Now
- **Production**: https://commerce-flow-v2.vercel.app
- **Demo Account**: `user@keyvault.com` / `user123`
- **Browse Games**: Click on the Games link at the top
- **Admin Panel**: Ask for demo admin credentials

No deployment waiting—it's live and ready to explore.

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- A Postgres database (this project uses [Neon](https://neon.tech), a serverless Postgres provider — see the note on connection strings below)
- Render account (for backend)
- Vercel account (for frontend)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd commerceFlow-v2
   ```

2. **Backend setup**
   ```bash
   cd backend
   # create .env — see "Environment Variables" below
   npm install
   npm run db:generate
   npm run db:push
   npm run db:seed
   npm run dev
   ```

3. **Frontend setup** (new terminal)
   ```bash
   cd frontend
   echo "VITE_API_URL=http://localhost:5000/api" > .env.local
   npm install
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/health
   - Database GUI: http://localhost:5555 (Prisma Studio)

### Test Accounts

- **User**: `user@keyvault.com` / `user123` — a shopper account, safe to share.

The seeded admin account is `admin@keyvault.com`. Its password is deliberately
not documented here: this README is public, so anything written in it is
published, and the admin role can create and delete products, mint and read
game keys, and read every customer record.

`npm run db:seed` picks the admin password in this order:

1. `SEED_ADMIN_PASSWORD`, if you set it.
2. In production with nothing set, a random 24-character password, printed
   once to the seed output — copy it out of the deploy log and store it.
3. Locally, a fixed dev password, so the usual workflow stays friction-free.

Re-seeding never changes the password of an admin that already exists, so a
routine reseed cannot silently undo a rotation.

## 🛠️ Development

### Available Scripts

#### Backend
```bash
cd backend
npm run dev          # Start development server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
npm run deploy       # Run deployment setup
```

#### Frontend
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Environment Variables

#### Backend (.env)
```bash
# Required
DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"
FRONTEND_URL="http://localhost:5173"

# Optional
PORT=5000
NODE_ENV="development"
# Password for the seeded admin account. If unset, seeding uses a local dev
# default in development, and generates a random one in production (printed
# once to the seed output).
SEED_ADMIN_PASSWORD="choose-something-strong"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
```

> **Neon connection strings**: Neon gives you two connection strings — a **pooled** one (hostname ends in `-pooler`) and a **direct** one (no `-pooler`). Use the **direct** string for `DATABASE_URL` in this project. Prisma's seed script opens multiple sequential connections, and Neon's pooled endpoint (PgBouncer in transaction mode) can cause `npm run db:seed` to hang indefinitely with no error. The direct string works reliably for migrations, seeding, and normal API traffic.

#### Frontend (.env.local)
```bash
VITE_API_URL=http://localhost:5000/api
```

## 🚀 Deployment

### Render + Vercel Deployment

1. **Database Setup**
   - Create a Postgres database (e.g. on [Neon](https://neon.tech))
   - Copy the **direct** (non-pooled) connection string to the backend's `DATABASE_URL`

2. **Backend Deployment (Render)**
   - Connect GitHub repository to Render
   - Set root directory to `backend`
   - Configure environment variables
   - Deploy and run database migrations

3. **Frontend Deployment (Vercel)**
   - Connect same repository to Vercel
   - Set root directory to `frontend`
   - Set `VITE_API_URL` to backend Render URL
   - Deploy

### Environment Variables for Production

#### Backend (Render)
```bash
DATABASE_URL=your-neon-direct-connection-string
JWT_SECRET=your-production-jwt-secret
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.vercel.app
```

#### Frontend (Vercel)
```bash
VITE_API_URL=https://your-backend-url.onrender.com/api
```

## 📊 Monitoring & Health Checks

### Health Check Endpoints
- **Backend**: `GET /health` — reports server status (note: this only checks that `DATABASE_URL` is *set*, not that the database is reachable)
- **Backend**: `GET /test-db` — actually attempts a database connection and reports the result
- **Frontend**: Automatic Vercel health checks

### Monitoring Tools
- Render Dashboard (backend monitoring, build/deploy logs)
- Vercel Dashboard (frontend monitoring, build/deploy logs)
- Neon Dashboard (database monitoring)
- Database GUI via Prisma Studio (`npm run db:studio`)

### Performance Monitoring
```bash
# Check backend health
curl https://your-backend-url.onrender.com/health

# Check database connectivity
curl https://your-backend-url.onrender.com/test-db

# Check frontend
curl https://your-frontend-url.vercel.app
```

## 🔒 Security

### Security Features
- ✅ JWT authentication with secure tokens
- ✅ Password hashing with bcryptjs
- ✅ CORS protection
- ✅ Rate limiting with express-rate-limit (100 requests / 15 min / IP, all routes)
- ✅ Input validation with express-validator
- ✅ SQL injection protection (Prisma)
- ✅ XSS protection (Helmet)
- ✅ HTTPS enforcement

### Security Best Practices
- Use strong JWT secrets (32+ characters)
- Rotate secrets regularly
- Never commit `.env` files
- Keep dependencies updated
- Run security audits regularly

## 🧪 Testing

### API Testing
```bash
# Health check
curl http://localhost:5000/health

# Authentication
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@keyvault.com","password":"user123"}'

# Protected routes
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Database Testing
```bash
# Open Prisma Studio
npm run db:studio

# Reset database (WARNING: destructive)
npm run db:push -- --force-reset
npm run db:seed
```

> The seed script (`backend/src/seed.js`) uses `create`, not `upsert`, for products. Re-running `npm run db:seed` against an already-seeded database will either fail with unique constraint errors or (depending on schema constraints) silently create duplicate rows. Reset the database first if you need to re-seed.

No automated test framework is configured yet. Testing is currently manual, via curl or the frontend UI.

## 🔄 CI/CD Pipeline

### Automated Deployment
1. Push to `main` branch
2. Render automatically deploys backend
3. Vercel automatically deploys frontend
4. Health checks verify deployment

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Failed
- Confirm `DATABASE_URL` is set correctly in the environment (Render dashboard for production, `.env` locally)
- If using Neon, make sure you're using the **direct** connection string, not the pooled one
- Hitting `GET /test-db` will show the exact error and which host it's trying to reach
- Open Prisma Studio (`npm run db:studio`) to confirm the database is reachable from your machine

#### CORS Errors
- Verify `FRONTEND_URL` in backend environment
- Ensure URLs match exactly (including https)
- Check for trailing slashes

#### Build Failures
- Check build logs in Render/Vercel dashboards
- Verify all dependencies are in package.json
- Check for syntax errors

#### Authentication Issues
- Verify `JWT_SECRET` is set
- Check token expiration
- Ensure frontend API URL is correct

#### Render free-tier cold starts
- On Render's free tier, the backend spins down after inactivity. The first request after idle can take 30–60s and may return a transient `503` while the instance wakes up — this is expected, not a bug. Subsequent requests succeed normally.

## 💳 Payment & Orders

### Stripe Integration
- **Secure Checkout**: Stripe Checkout sessions with real-time pricing from database
- **Key Reservation**: 35-minute hold prevents overselling during checkout
- **Webhook Handling**: `checkout.session.completed`, `async_payment_succeeded`, session expiry
- **Idempotent Fulfillment**: Duplicate webhook deliveries are safely ignored
- **Order States**: PENDING → COMPLETED (on payment) or CANCELLED/FAILED (on expiry or declined)

### Key Delivery
- **Instant Distribution**: Keys marked SOLD immediately on payment confirmation
- **My Keys Dashboard**: Customers view purchased keys grouped by order
- **Order History**: Full transaction history with delivery timestamps
- **Platform Tracking**: Keys show platform, region, and game metadata

### Security
- **Key Rotation**: Used keys move from AVAILABLE → RESERVED → SOLD
- **Webhook Validation**: Stripe signature verification prevents spoofing
- **Cart Clearing**: Automatically cleared on successful purchase
- **No Client Pricing**: All amounts calculated server-side; client cannot manipulate

## 🛠️ Tech Stack

### Backend - Express.js + Prisma
- **Runtime**: Node.js 18+ (faster with V8 optimization)
- **Framework**: Express.js 4.18.2 (lightweight, battle-tested)
- **Database**: PostgreSQL with Prisma ORM 6.11.1 (type-safe queries)
- **Authentication**: JWT + bcryptjs (stateless, secure)
- **Payments**: Stripe SDK (PCI-compliant checkout)
- **Validation**: express-validator with middleware chains
- **Security Stack**: 
  - Helmet (headers)
  - CORS with origin validation
  - Rate limiting (express-rate-limit)
  - Input sanitization
- **Deployment**: Render (auto-scaling, health checks)

### Frontend - React 19 + Tailwind
- **Framework**: React 19.1.0 with Vite 7.0.4 (instant HMR, fast builds)
- **Styling**: Tailwind CSS 3.4.17 (utility-first, custom component layer)
- **State**: Zustand 5.0.2 (lightweight, DevTools integration)
- **HTTP**: Axios 1.7.9 (interceptors, request/response handling)
- **Icons**: Lucide React (18 game-related icons, consistent styling)
- **UI Patterns**:
  - Error boundaries & fallbacks
  - Loading states with spinners
  - Toast notifications (react-hot-toast)
  - Modal dialogs for confirmations
- **Deployment**: Vercel (edge functions, analytics, automatic rollbacks)

### Development & Tooling
- **Database GUI**: Prisma Studio (`npm run db:studio`)
- **Code Quality**: ESLint 9.30.1 (14 pre-existing rules for consistency)
- **Build**: Vite with optimized chunks
- **Git Workflow**: Feature branches, semantic commits
- **Testing**: Manual via curl and UI (automated tests in Phase 2)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

### Documentation
- [Express.js Docs](https://expressjs.com/)
- [Prisma Docs](https://prisma.io/docs)
- [React Docs](https://react.dev/)
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Neon Docs](https://neon.tech/docs)

### Community
- [Render Discord](https://discord.gg/render)
- [Vercel Discord](https://discord.gg/vercel)
- [GitHub Issues](https://github.com/jxstin-potter/commerceFlow/issues)

---

**Happy Coding! 🚀**

*Built with ❤️ using modern web technologies*

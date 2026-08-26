# 🚀 CommerceFlow version 2

A modern, full-stack e-commerce platform built with React 19, Express.js, and PostgreSQL. Deployed on Render (backend) and Vercel (frontend) with automatic CI/CD.

## ✨ Features

- **🛍️ Complete E-commerce**: Product catalog, shopping cart, orders, reviews
- **👤 User Management**: Registration, authentication, user profiles
- **🔐 Admin Dashboard**: Product management, order processing, user administration
- **💳 Payment Integration**: Stripe payment processing (optional)
- **📱 Responsive Design**: Mobile-first design with Tailwind CSS
- **🚀 Modern Stack**: React 19, Express 4.18.2, Prisma ORM, PostgreSQL
- **☁️ Cloud Deployed**: Render backend, Vercel frontend, Neon Postgres
- **🔄 Auto Deploy**: Git-based deployment with health checks

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
- **Admin**: `admin@commerceflow.com` / `admin123`
- **User**: `user@commerceflow.com` / `user123`

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
  -d '{"email":"admin@commerceflow.com","password":"admin123"}'

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

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18.2
- **Database**: PostgreSQL (Neon) with Prisma ORM 6.11.1
- **Authentication**: JWT with bcryptjs
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate limiting
- **Deployment**: Render

### Frontend
- **Framework**: React 19.1.0 with Vite 7.0.4
- **Styling**: Tailwind CSS 3.4.17
- **State Management**: Zustand 5.0.2
- **HTTP Client**: Axios 1.7.9
- **UI Components**: Lucide React icons
- **Deployment**: Vercel

### Development Tools
- **Package Manager**: npm
- **Version Control**: Git
- **Database GUI**: Prisma Studio
- **Code Quality**: ESLint 9.30.1
- **Build Tool**: Vite

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

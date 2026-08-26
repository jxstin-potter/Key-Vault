# 🚀 CommerceFlow Backend (Render Ready)

## **Environment Variables (set in Render dashboard):**
- `DATABASE_URL` (Postgres connection string — see Neon note below)
- `JWT_SECRET` (any strong string)
- `FRONTEND_URL` (your Vercel frontend URL, e.g. https://commerce-flow-v2.vercel.app)
- `NODE_ENV=production`
- **Do NOT set `PORT`** (Render injects it automatically)

## **Database (Neon Postgres)**
This backend uses [Neon](https://neon.tech) for Postgres. Neon gives you two connection strings:
- **Pooled** (hostname ends in `-pooler`) — fine for normal API request traffic
- **Direct** (no `-pooler`) — required for `npm run db:seed` and recommended for `DATABASE_URL` generally

Prisma's seed script opens multiple sequential connections. Neon's pooled endpoint runs PgBouncer in transaction mode, which is incompatible with this and causes `npm run db:seed` to hang indefinitely with no error. Use the **direct** connection string to avoid this.

## **Prisma Setup**
- Schema: `prisma/schema.prisma`
- Migrate/seed: `npm run deploy` (runs `prisma generate`, `prisma db push`, and seeds the database)
- The seed script (`src/seed.js`) uses `create`, not `upsert` — re-running it against an already-seeded database creates duplicate rows rather than updating existing ones. Reset first with `npm run db:push -- --force-reset` if you need to re-seed.

## **Health Check**
- `/health` returns JSON status — note this only checks that `DATABASE_URL` is *set*, not that the database is actually reachable
- `/test-db` attempts a real database connection and reports success/failure with the target host

## **CORS**
- Uses `process.env.FRONTEND_URL` for allowed origins

## **Deployment on Render**
1. **Connect your GitHub repo**
2. **Set environment variables** in the Render dashboard
3. **Build Command:** (optional, for first deploy)
   ```
   npm install && npm run deploy
   ```
   (or just `npm install` if you want to run migrations manually)
4. **Start Command:**
   ```
   npm start
   ```
5. **Set `DATABASE_URL`** to your Neon **direct** connection string
   - Changing `DATABASE_URL` in the Render dashboard requires a redeploy to take effect — saving alone does not restart the running instance
6. **Test:**
   - Visit `/health` to check server status
   - Visit `/test-db` to test the actual database connection
   - Visit `/api/products` to test API endpoints

## **Security**
- `.env` is ignored by git
- All secrets/config are set via environment variables in Render

## **Frontend**
- Deploy separately on Vercel
- Set `VITE_API_URL` in Vercel to your Render backend URL + `/api`

---

**You are now Render ready!**

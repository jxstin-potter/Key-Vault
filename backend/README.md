# 🚀 CommerceFlow Backend (Render Ready)

## **Environment Variables (set in Render dashboard):**
- `DATABASE_URL` (from Render Postgres add-on)
- `JWT_SECRET` (any strong string)
- `FRONTEND_URL` (your Vercel frontend URL, e.g. https://commerce-flow-v2.vercel.app)
- `NODE_ENV=production`
- **Do NOT set `PORT`** (Render injects it automatically)

## **Prisma Setup**
- Schema: `prisma/schema.prisma`
- Migrate/seed: `npm run deploy` (runs `prisma generate`, `prisma db push`, and seeds the database)

## **Health Check**
- `/health` endpoint returns JSON status

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
5. **Add a Render Postgres add-on** and use its internal `DATABASE_URL`
   - Render will auto-set `DATABASE_URL` when you link the database
   - Use the **Internal Database URL** (ends with `.render.com`, not `:5432`)
   - If database is paused, resume it in Render dashboard
6. **Test:** 
   - Visit `/health` to check server status
   - Visit `/test-db` to test database connection
   - Visit `/api/products` to test API endpoints
   
**Troubleshooting:** See `DATABASE_TROUBLESHOOTING.md` for common connection issues

## **Security**
- `.env` is ignored by git
- All secrets/config are set via environment variables in Render

## **Frontend**
- Deploy separately on Vercel
- Set `VITE_API_URL` in Vercel to your Render backend URL + `/api`

---

**You are now Render ready!** 
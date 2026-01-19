# Database Connection Troubleshooting (Render PostgreSQL)

## Error: P1001: Can't reach database server

This error means Prisma cannot connect to your Render PostgreSQL database.

## Common Causes & Solutions

### 1. Database is Paused (Most Common)

**Render free tier databases pause after 90 days of inactivity.**

**Solution:**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Find your PostgreSQL database service
3. Click on it
4. Click "Resume" or "Start" button
5. Wait 1-2 minutes for database to start
6. Your web service will automatically reconnect

### 2. Wrong DATABASE_URL Format

**Render provides two URLs:**
- **Internal URL** (for services in same account): `postgresql://user:pass@dpg-xxx-a.oregon-postgres.render.com/dbname`
- **External URL** (for external connections): `postgresql://user:pass@dpg-xxx-a.oregon-postgres.render.com:5432/dbname`

**Solution:**
1. Go to your PostgreSQL service in Render dashboard
2. Go to "Info" or "Connect" tab
3. Copy the **Internal Database URL** (not external)
4. Paste it into your web service's `DATABASE_URL` environment variable
5. The URL should end with `.render.com` (not `:5432`)

### 3. Database Not Linked to Web Service

**Solution:**
1. Go to your web service in Render dashboard
2. Go to "Environment" tab
3. Check if `DATABASE_URL` is set
4. If not, click "Link Database" or manually add:
   - Key: `DATABASE_URL`
   - Value: Copy from PostgreSQL service's Internal URL

### 4. Database Service Not Running

**Solution:**
1. Check Render dashboard
2. Verify PostgreSQL service status is "Running" (green)
3. If it shows "Paused" or "Stopped", click "Resume" or "Start"

### 5. SSL Connection Issues

**If you see SSL-related errors, add SSL parameters to DATABASE_URL:**

```
postgresql://user:pass@host/dbname?sslmode=require
```

Or in Prisma schema, you can add connection parameters.

## Quick Diagnostic Steps

1. **Check Database Status:**
   - Visit: `https://dashboard.render.com`
   - Find your PostgreSQL service
   - Verify status is "Running"

2. **Test Connection:**
   - Visit: `https://your-backend-url.onrender.com/test-db`
   - This will show detailed connection information

3. **Verify Environment Variable:**
   - In Render dashboard → Your web service → Environment
   - Check `DATABASE_URL` exists and is correct
   - Should look like: `postgresql://user:pass@dpg-xxx-a.oregon-postgres.render.com/dbname`

4. **Check Logs:**
   - In Render dashboard → Your web service → Logs
   - Look for database connection errors
   - Check for P1001 errors

## Render-Specific Notes

- **Free Tier:** Databases pause after 90 days of inactivity
- **Internal URLs:** Use internal URL when web service and database are in same Render account
- **Auto-linking:** When you add a database to a service, Render auto-sets `DATABASE_URL`
- **Connection Pooling:** Render handles this automatically for internal connections

## Still Having Issues?

1. Check Render status page: https://status.render.com
2. Verify database service is in same account as web service
3. Try recreating the database link in Render dashboard
4. Check if you've exceeded free tier limits

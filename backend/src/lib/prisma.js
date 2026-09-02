import { PrismaClient } from '@prisma/client';

/**
 * The shared PrismaClient singleton used throughout the backend.
 *
 * Constructed once at module load and reused everywhere (imported as `db`
 * default in most lib/ functions), rather than instantiated per-request or
 * per-module. PrismaClient opens and manages its own connection pool, so
 * creating additional instances would exhaust Postgres's connection limit
 * under load rather than sharing one pool efficiently.
 *
 * @type {import('@prisma/client').PrismaClient}
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Test connection on initialization (non-blocking). Only in production: a
// dev or test environment without a reachable database should fail loudly on
// the first real query, not print a Render-specific diagnostic on every boot.
if (process.env.NODE_ENV === 'production') {
  prisma.$connect()
    .then(() => {
      // Connection successful
    })
    .catch((error) => {
      // Log error but don't crash - connection will be retried on first query
      if (error.code === 'P1001') {
        // Database unreachable - likely paused or wrong URL
        const dbUrl = process.env.DATABASE_URL || 'not set';
        const hostMatch = dbUrl.match(/@([^:]+)/);
        const host = hostMatch ? hostMatch[1] : 'unknown';
        console.error('Database connection failed. Possible issues:');
        console.error('1. Database may be paused (Render free tier pauses after inactivity)');
        console.error('2. DATABASE_URL may be incorrect or using external URL instead of internal');
        console.error('3. Database service may not be linked to web service');
        console.error(`Database host: ${host}`);
        console.error('Check Render dashboard: https://dashboard.render.com');
      }
    });
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;

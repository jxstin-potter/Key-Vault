import { PrismaClient } from '@prisma/client';

// Singleton pattern for PrismaClient
// Prevents multiple instances and connection pool exhaustion
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Test connection on initialization (non-blocking)
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

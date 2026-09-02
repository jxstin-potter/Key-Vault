import dotenv from 'dotenv';

dotenv.config();

const { createApp } = await import('./app.js');
const { logger } = await import('./lib/logger.js');
const { default: prisma } = await import('./lib/prisma.js');
const { startReservationSweeper } = await import('./lib/reservationSweeper.js');

/**
 * Process entry point.
 *
 * Everything about *what* the API does lives in app.js. This file owns only
 * what a process owns: reading configuration, binding a port, starting
 * background work, and shutting all of it down cleanly. Keeping the two apart
 * is what lets the test suite mount the real app without binding a port.
 *
 * The dynamic imports above are deliberate: dotenv must populate process.env
 * before any module that reads it at import time (the Prisma client reads
 * DATABASE_URL, the Stripe client reads STRIPE_SECRET_KEY). Static imports are
 * hoisted above the dotenv.config() call and would see an empty environment.
 */

const PORT = process.env.PORT;

if (!PORT) {
  logger.fatal('PORT environment variable is required');
  process.exit(1);
}

// Fail fast on a missing signing secret rather than at the first login: without
// it every token request throws, and the resulting 500s look like a code bug
// instead of a misconfigured deploy.
if (!process.env.JWT_SECRET) {
  logger.fatal('JWT_SECRET environment variable is required');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
  logger.fatal('JWT_SECRET must be at least 32 characters in production');
  process.exit(1);
}

const app = createApp();

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'KeyVault API listening');
});

const stopSweeper = startReservationSweeper();

/**
 * Graceful shutdown.
 *
 * Render sends SIGTERM and then kills the process a short time later. Closing
 * the listener first lets in-flight requests finish; a checkout killed
 * mid-transaction would leave keys stranded in RESERVED until their hold
 * lapsed. The timeout is a backstop so a hung connection cannot block the
 * deploy indefinitely.
 */
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const force = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
  force.unref();

  stopSweeper();
  server.close(async () => {
    await prisma.$disconnect();
    clearTimeout(force);
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// An unhandled rejection leaves the process in an unknown state. Log it with
// full context and let the platform restart a clean instance.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});

export default app;

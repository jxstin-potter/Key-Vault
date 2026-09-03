import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import prisma from './lib/prisma.js';

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import orderRoutes from './routes/orders.js';
import cartRoutes from './routes/cart.js';
import reviewRoutes from './routes/reviews.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';
import keyRoutes from './routes/keys.js';
import checkoutRoutes from './routes/checkout.js';
import webhookRoutes from './routes/webhooks.js';

// Import middleware
import { authenticateToken } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { mountApiDocs } from './docs/index.js';
import logger from './lib/logger.js';

/**
 * Build the Express application.
 *
 * This is deliberately separate from server.js, which owns the process:
 * port validation, listening, and shutdown signals. Keeping construction pure
 * means the test suite can mount the real app in-process with supertest -
 * same middleware, same ordering, same routes - without binding a port or
 * risking a process.exit() that would take the test runner down with it.
 *
 * @param {object}  [options]
 * @param {boolean} [options.rateLimit] Enable rate limiting. Off under test by
 *   default: the auth limiter allows 20 failures per 15 minutes, which a suite
 *   exercising invalid-credential paths blows through in seconds, and the
 *   resulting 429s would look like auth bugs.
 * @returns {import('express').Express} A fully configured Express app,
 *   middleware and routes mounted, ready to either `.listen()` (see
 *   server.js) or be passed directly to supertest.
 */
export function createApp(options = {}) {
  const { rateLimit: rateLimitEnabled = process.env.NODE_ENV !== 'test' } = options;

  const app = express();

  // Render terminates TLS at a proxy, so without this every request arrives
  // looking like it came from that proxy and express-rate-limit buckets the
  // entire internet together - one visitor could 429 everybody. Trust exactly one
  // hop; trusting all of them would let a client forge X-Forwarded-For and dodge
  // the limit entirely.
  app.set('trust proxy', 1);

  // General API traffic. The old limit was 100 per 15 minutes across every route,
  // which the admin area alone could exhaust - Analytics issues six requests on
  // load, and once the budget was gone every route 429'd, login included.
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please slow down and try again shortly.' }
  });

  // Auth is the one place a tight limit genuinely matters, because that is what
  // makes password guessing expensive. Sharing a single budget with ordinary
  // reads meant normal browsing could lock out real sign-ins while doing nothing
  // to slow a focused attacker down.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // only failed attempts count toward the limit
    message: { message: 'Too many login attempts. Please wait a few minutes and try again.' }
  });

  // A no-op stand-in so route mounting below reads identically either way.
  const passThrough = (req, res, next) => next();
  const generalLimiter = rateLimitEnabled ? limiter : passThrough;
  const loginLimiter = rateLimitEnabled ? authLimiter : passThrough;

  app.use(helmet());

  // CORS origin validation. Accepts a function so we can normalize both the
  // configured origin and the incoming request origin - removing trailing
  // slashes, etc. - to prevent silent failures when env vars have minor
  // formatting differences. A CORS block is logged so misconfigurations are
  // visible in the logs rather than silently killing the storefront.
  const configuredOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  app.use(cors({
    origin: (origin, callback) => {
      // Normalize: remove trailing slash, lowercase for comparison
      const normalizedOrigin = (origin || '').replace(/\/$/, '').toLowerCase();
      const normalizedConfigured = configuredOrigin.toLowerCase();

      if (normalizedOrigin === normalizedConfigured || !origin) {
        // origin is undefined on same-origin requests (e.g. server->server)
        callback(null, true);
      } else {
        logger.warn({ origin, configured: configuredOrigin }, 'CORS origin rejected');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

  // Correlation IDs first, so every log line for a request - including ones
  // emitted by the error handler - can be tied back to a single call.
  app.use(requestLogger);

  // Stripe webhooks need the unparsed body for signature verification, so this
  // route is mounted before express.json(). It is also above the rate limiter so
  // Stripe retries are never throttled. Do not reorder these three lines.
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRoutes);

  app.use(generalLimiter);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  /**
   * @route GET /
   * @access Public
   * @description Root landing endpoint - a friendly pointer to the real
   *   endpoints for anyone who hits the bare API origin directly.
   * @returns {200} `{ message, version, endpoints, timestamp }`.
   */
  app.get('/', (req, res) => {
    res.json({
      message: '🚀 KeyVault API is running!',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        api: '/api',
        docs: '/api/docs'
      },
      timestamp: new Date().toISOString()
    });
  });

  /**
   * @route GET /health
   * @access Public
   * @description Liveness probe. Deliberately does NOT touch the database:
   *   Render restarts the instance when this fails, and a brief database
   *   blip is not a reason to cycle a process that is otherwise serving
   *   cached and static routes fine. Use /health/ready for the dependency check.
   * @returns {200} `{ status: 'OK', timestamp, environment, database, jwt, uptime }` -
   *   `database`/`jwt` are booleans indicating whether those env vars are
   *   *set*, not whether they're reachable/valid.
   */
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: !!process.env.DATABASE_URL,
      jwt: !!process.env.JWT_SECRET,
      uptime: process.uptime()
    });
  });

  /**
   * @route GET /health/ready
   * @access Public
   * @description Readiness probe: actually round-trips the database
   *   (`SELECT 1`). This is the one to watch in a dashboard, and the one
   *   that tells you a deploy is genuinely able to serve traffic rather
   *   than merely running.
   * @returns {200} `{ status: 'ready', database: 'connected' }`.
   * @returns {503} `{ status: 'not_ready', database: 'unreachable', code }` -
   *   the database is unreachable; `code` is Prisma's error code (e.g.
   *   'P1001').
   */
  app.get('/health/ready', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready', database: 'connected' });
    } catch (error) {
      req.log?.error({ err: error }, 'Readiness check failed');
      res.status(503).json({
        status: 'not_ready',
        database: 'unreachable',
        code: error.code
      });
    }
  });

  /**
   * @route GET /api
   * @access Public
   * @description API base endpoint - a pointer to docs and health, for
   *   anyone probing `/api` directly.
   * @returns {200} `{ message, version, docs, health }`.
   */
  app.get('/api', (req, res) => {
    res.json({
      message: 'KeyVault API',
      version: '1.0.0',
      docs: '/api/docs',
      health: '/health'
    });
  });

  // OpenAPI document + interactive reference.
  mountApiDocs(app);

  // Routes
  app.use('/api/auth', loginLimiter, authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/orders', authenticateToken, orderRoutes);
  app.use('/api/cart', authenticateToken, cartRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/users', authenticateToken, userRoutes);
  app.use('/api/analytics', authenticateToken, analyticsRoutes);
  app.use('/api/keys', authenticateToken, keyRoutes);
  app.use('/api/checkout', authenticateToken, checkoutRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;

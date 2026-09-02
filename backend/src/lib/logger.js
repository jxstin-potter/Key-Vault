import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Application logger.
 *
 * Why structured logging rather than console.log: on Render the logs are a
 * single undifferentiated stream. `console.error('Failed:', err.message)`
 * throws away the stack, the request that caused it, and the user it happened
 * to, which is exactly the context you need at 2am. Pino emits one JSON object
 * per line, so a log search can filter by requestId, userId, or orderId.
 *
 * In development that JSON is unreadable, so pino-pretty reformats it. In
 * production the raw JSON goes straight to stdout - no transport, no extra
 * worker thread, no measurable overhead.
 */
const transport =
  !isProduction && !isTest
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
      }
    : undefined;

export const logger = pino({
  // Tests would otherwise bury real failures under request noise.
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
  transport,
  // Anything listed here is replaced with [Redacted] before it is written.
  // Secrets reach the logger through ordinary request objects far more often
  // than people expect: an Authorization header on a logged request, a
  // password in a validation error echo, a Stripe key in a config dump. This
  // list is the backstop for the times someone forgets.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      '*.password',
      'DATABASE_URL',
      'JWT_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET'
    ],
    censor: '[Redacted]'
  },
  base: { service: 'keyvault-api' }
});

export default logger;

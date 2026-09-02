import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

/**
 * Per-request logging with a correlation ID.
 *
 * Every request gets an id (reusing an inbound X-Request-Id when a proxy or
 * client supplied one, so a trace survives across hops) and that id is echoed
 * back in the response header. When a user reports "my checkout failed at
 * 14:32", the id from their network tab pulls back every log line for that
 * request - route handler, Prisma error, and the error handler's output - in
 * one query, instead of guessing from timestamps.
 *
 * Handlers get `req.log`, a child logger already carrying the id, so they
 * never have to thread it through manually.
 */
export const requestLogger = pinoHttp({
  logger,

  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },

  // Health checks fire constantly on a platform with an uptime probe and would
  // otherwise dominate the log volume while carrying no information.
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/'
  },

  // A 404 or a rejected login is expected traffic, not an incident. Reserving
  // `error` for genuine 5xx keeps error-rate alerting meaningful.
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} failed: ${err.message}`,

  // The defaults dump every header and inflate each line. These keep the
  // fields that are actually searched.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode })
  }
});

export default requestLogger;

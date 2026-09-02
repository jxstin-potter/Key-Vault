/**
 * Express error-handling middleware (4-arg signature - must be registered
 * last, after all routes). Catches anything thrown or passed to `next(err)`
 * and translates it into a JSON response, recognizing several common error
 * shapes (Prisma error codes, JWT errors, multer upload errors, rate-limit
 * errors) before falling back to a generic response.
 *
 * In production the message body is deliberately generic ("Something went
 * wrong") regardless of the actual error text, so an unexpected exception
 * can't leak internal details (file paths, query fragments, stack traces) to
 * the client; the real message and stack are still logged server-side above.
 *
 * @param {Error & {code?: string, statusCode?: number, status?: number, meta?: object}} error
 *   The thrown error. Prisma errors carry a `code` (e.g. 'P2002' for a unique
 *   constraint violation); AppError and similar carry `statusCode`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next - Unused, but required for
 *   Express to recognize this as an error handler rather than a route.
 * @returns {void} Always sends a JSON response; never calls `next()`.
 */
export const errorHandler = (error, req, res, next) => {
  // Log error details
  console.error('Error occurred:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    error: {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      name: error.name
    }
  });

  // Handle Prisma errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        return res.status(409).json({
          success: false,
          message: 'A record with this information already exists',
          field: error.meta?.target?.[0] || 'unknown'
        });
      case 'P2025':
        return res.status(404).json({
          success: false,
          message: 'Record not found'
        });
      case 'P2003':
        return res.status(400).json({
          success: false,
          message: 'Invalid foreign key reference'
        });
      default:
        return res.status(500).json({
          success: false,
          message: 'Database operation failed'
        });
    }
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.errors
    });
  }

  // Handle multer errors (file upload)
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large'
    });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field'
    });
  }

  // Handle rate limiting errors
  if (error.status === 429) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later'
    });
  }

  // Handle network/connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable'
    });
  }

  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  });
};

/**
 * Wrap an async Express route handler so a rejected promise is forwarded to
 * `next(err)` (and thus to errorHandler above) instead of becoming an
 * unhandled rejection. Express does not await route handlers itself, so an
 * `async (req, res) => { throw ... }` handler without this wrapper would
 * crash silently rather than produce an error response.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<any>} fn
 *   An async route handler.
 * @returns {import('express').RequestHandler} A handler safe to pass directly
 *   to `router.get/post/...`.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * An error carrying an explicit HTTP status code, for routes that want to
 * `throw new AppError('message', 404)` and have errorHandler translate it
 * directly rather than falling through the generic-500 path.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Sent to the client as-is (in non-production;
   *   see errorHandler's message-scrubbing note above).
   * @param {number} [statusCode=500] - HTTP status to respond with.
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Express middleware for unmatched routes. Mounted after every real route,
 * so reaching here means no handler claimed this method+path.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {void} Always responds 404 with a JSON body naming the unmatched URL.
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
}; 
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

/**
 * Express middleware: verify a Bearer JWT and attach the current user to
 * `req.user`, or reject the request.
 *
 * Deliberately re-reads the user from the database on every request rather
 * than trusting the token payload alone. This costs one query per
 * authenticated request but buys two things: a deleted or banned account
 * stops working immediately (not at token expiry), and the role attached to
 * `req.user` cannot be forged by crafting a token - a valid signature with a
 * tampered `role` claim would still be overwritten by the database's own
 * value here, since only `id`, `email`, and `role` are selected fresh.
 *
 * @param {import('express').Request} req - Expects `Authorization: Bearer <token>`.
 *   On success, sets `req.user = { id, email, role }`.
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void} Calls `next()` on success; otherwise sends a JSON error
 *   response directly - 401 for a missing/invalid/expired token or an
 *   account that no longer exists, 500 for a missing JWT_SECRET or other
 *   unexpected failure.
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(500).json({ message: 'Authentication error' });
  }
};

/**
 * Express middleware: gate a route to ADMIN-role users only.
 *
 * Must run after authenticateToken(), which populates `req.user`. Because
 * that middleware always re-reads role from the database, this check cannot
 * be bypassed by a token carrying a forged `role: 'ADMIN'` claim.
 *
 * @param {import('express').Request} req - Requires `req.user` to already be set.
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void} Calls `next()` if `req.user.role === 'ADMIN'`; otherwise
 *   responds 403.
 */
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

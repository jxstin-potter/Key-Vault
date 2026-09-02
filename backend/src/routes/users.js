import express from 'express';
import prisma from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/users
 * @access Admin only
 * @description List every user with computed order stats (total spent,
 *   average order value, counted from COMPLETED orders only).
 * @returns {200} `{ users }` - newest account first. Each user includes
 *   `orderCount`, `reviewCount`, `totalSpent`, `totalOrders`,
 *   `averageOrderValue`, and a coarse `status` ('admin' | 'active').
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        orders: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            orders: true,
            reviews: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const usersWithStats = users.map(user => {
      // Calculate total spent from completed orders
      const totalSpent = user.orders
        .filter(order => order.status === 'COMPLETED')
        .reduce((sum, order) => sum + order.total, 0);

      // Calculate average order value
      const completedOrders = user.orders.filter(order => order.status === 'COMPLETED');
      const averageOrderValue = completedOrders.length > 0 
        ? totalSpent / completedOrders.length 
        : 0;

      return {
      ...user,
      orderCount: user._count.orders,
      reviewCount: user._count.reviews,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalOrders: user._count.orders,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        status: user.role === 'ADMIN' ? 'admin' : 'active', // Simple status logic
        orders: undefined, // Remove orders array to keep response clean
      _count: undefined
      };
    });

    res.json({ users: usersWithStats });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

/**
 * @route GET /api/users/:id
 * @access Admin only
 * @description Fetch one user's profile, full order history, and reviews.
 *
 *   ROUTE ORDER CAVEAT: because this is registered before the literal
 *   '/info' route below, a request to GET /api/users/info matches here
 *   first with `id: 'info'`, not the intended usage-hint handler - it hits
 *   this handler's admin check and 404s rather than returning the info
 *   message. '/me/stats' is unaffected (two path segments, this route only
 *   matches one). Documented as-is; not fixed here.
 * @param {string} req.params.id - User id.
 * @returns {200} `{ user }` including `orderCount` and `reviewCount`.
 * @returns {404} User not found.
 */
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        orders: {
          select: {
            id: true,
            status: true,
            total: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            product: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            orders: true,
            reviews: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userWithStats = {
      ...user,
      orderCount: user._count.orders,
      reviewCount: user._count.reviews,
      _count: undefined
    };

    res.json({ user: userWithStats });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

/**
 * @route PUT /api/users/:id/role
 * @access Admin only
 * @description Promote or demote a user between USER and ADMIN.
 * @param {string} req.params.id - User id.
 * @param {'USER'|'ADMIN'} req.body.role
 * @returns {200} `{ message, user }`.
 * @returns {400} `role` is missing or not one of the two allowed values.
 * @returns {404} User not found.
 */
router.put('/:id/role', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    res.json({
      message: 'User role updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

/**
 * @route GET /api/users/info
 * @access Intended: public usage hint. Actual: unreachable - see the route
 *   order caveat on GET /:id above; `/:id` is registered first and swallows
 *   this path with `id: 'info'`.
 * @description Static usage hint for this router (never actually reached).
 * @returns {200} `{ message }`.
 */
router.get('/info', (req, res) => {
  res.json({
    message: 'GET /api/users returns user info (admin only). Use POST, PUT, DELETE for user actions.'
  });
});

/**
 * @route GET /api/users/me/stats
 * @access Authenticated
 * @description The caller's own summary stats - order/review/cart-item
 *   counts and spend, computed from COMPLETED orders only.
 * @returns {200} `{ stats: { orderCount, reviewCount, cartItemCount,
 *   totalSpent, averageOrderValue, completedOrders } }`.
 * @returns {404} User not found (should not occur for a valid token, since
 *   authenticateToken already re-verifies the account exists).
 */
router.get('/me/stats', async (req, res) => {
  try {
    const stats = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        _count: {
          select: {
            orders: true,
            reviews: true,
            cartItems: true
          }
        },
        orders: {
          select: {
            total: true,
            status: true
          }
        }
      }
    });

    if (!stats) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate total spent
    const totalSpent = stats.orders
      .filter(order => order.status === 'COMPLETED')
      .reduce((sum, order) => sum + order.total, 0);

    // Calculate average order value
    const completedOrders = stats.orders.filter(order => order.status === 'COMPLETED');
    const averageOrderValue = completedOrders.length > 0 
      ? totalSpent / completedOrders.length 
      : 0;

    const userStats = {
      orderCount: stats._count.orders,
      reviewCount: stats._count.reviews,
      cartItemCount: stats._count.cartItems,
      totalSpent,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      completedOrders: completedOrders.length
    };

    res.json({ stats: userStats });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user statistics' });
  }
});

export default router; 
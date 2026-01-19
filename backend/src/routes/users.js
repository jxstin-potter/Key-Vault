import express from 'express';
import prisma from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all users (admin only)
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
        .filter(order => order.status === 'DELIVERED')
        .reduce((sum, order) => sum + order.total, 0);

      // Calculate average order value
      const completedOrders = user.orders.filter(order => order.status === 'DELIVERED');
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
        phone: 'N/A', // Placeholder since we don't have phone in schema
        orders: undefined, // Remove orders array to keep response clean
      _count: undefined
      };
    });

    res.json({ users: usersWithStats });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Get user by ID (admin only)
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

// Update user role (admin only)
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

// Add GET /info for demo
router.get('/info', (req, res) => {
  res.json({
    message: 'GET /api/users returns user info (admin only). Use POST, PUT, DELETE for user actions.'
  });
});

// Get user statistics (for current user)
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
      .filter(order => order.status === 'DELIVERED')
      .reduce((sum, order) => sum + order.total, 0);

    // Calculate average order value
    const completedOrders = stats.orders.filter(order => order.status === 'DELIVERED');
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
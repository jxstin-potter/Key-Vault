import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import { refundOrder, RefundNotAllowedError, RefundGatewayError } from '../lib/refunds.js';

const router = express.Router();

// Get user's orders (or all orders for admin)
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    const whereClause = isAdmin ? {} : { userId: req.user.id };

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                price: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Get order statistics (admin only)
router.get('/stats', async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const totalOrders = await prisma.order.count();
    const totalRevenue = await prisma.order.aggregate({
      _sum: { total: true }
    });
    const pendingOrders = await prisma.order.count({
      where: { status: 'PENDING' }
    });
    const completedOrders = await prisma.order.count({
      where: { status: 'COMPLETED' }
    });

    // Recent orders for dashboard
    const recentOrders = await prisma.order.findMany({
      take: 5,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      stats: {
        totalOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        pendingOrders,
        completedOrders
      },
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch order statistics' });
  }
});

// Add GET /info for demo
router.get('/info', (req, res) => {
  res.json({
    message: 'GET /api/orders returns user orders (requires auth). Use POST, PUT, DELETE for order actions.'
  });
});

// Get single order
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const order = await prisma.order.findFirst({
      where: {
        id,
        // Admins can view any order; users only their own
        ...(isAdmin ? {} : { userId: req.user.id })
      },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                description: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});

// NOTE: POST /create used to build an order straight from the cart with no
// payment at all - anyone with a valid token received free keys. Checkout
// now runs through Stripe: routes/checkout.js opens the session and
// routes/webhooks.js fulfils the order once payment clears.

// Update order status (admin only)
router.put('/:id/status', [
  body('status').isIn(['PENDING', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'])
], async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // REFUNDED is not a label, it is an action. Writing the column directly
    // would tell the customer they had been refunded while their money stayed
    // taken and their keys kept working - which is what this endpoint used to
    // do. Route it through the refund service, which moves the money at Stripe
    // and revokes the delivered keys.
    if (status === 'REFUNDED') {
      const result = await refundOrder(id);

      const refreshed = await prisma.order.findUnique({
        where: { id },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          orderItems: {
            include: { product: { select: { id: true, name: true, images: true } } }
          }
        }
      });

      return res.json({
        message: result.alreadyRefunded
          ? 'Order was already refunded'
          : `Order refunded and ${result.revokedKeys} key(s) revoked`,
        order: refreshed,
        revokedKeys: result.revokedKeys,
        alreadyRefunded: !!result.alreadyRefunded
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        }
      }
    });

    res.json({
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    if (error instanceof RefundNotAllowedError) {
      return res.status(409).json({ message: error.message });
    }
    // The refund failed upstream, at Stripe. 502 rather than 500 so the
    // operator can tell "our bug" from "the payment provider said no" without
    // reading logs.
    if (error instanceof RefundGatewayError) {
      return res.status(502).json({ message: 'The payment provider rejected the refund' });
    }
    req.log?.error({ err: error, orderId: req.params.id }, 'Failed to update order status');
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

export default router; 
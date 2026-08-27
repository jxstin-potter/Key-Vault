import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';

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
      where: { status: 'DELIVERED' }
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

// Create order from cart
router.post('/create', [
  body('shippingAddress').isObject(),
  body('shippingAddress.street').isString(),
  body('shippingAddress.city').isString(),
  body('shippingAddress.state').isString(),
  body('shippingAddress.zipCode').isString(),
  body('shippingAddress.country').isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { shippingAddress, paymentIntent } = req.body;

    // Get user's cart
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            isActive: true
          }
        }
      }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate cart items
    const validItems = cartItems.filter(item => item.product.isActive);
    if (validItems.length === 0) {
      return res.status(400).json({ message: 'No valid items in cart' });
    }

    // Check stock and calculate total
    let total = 0;
    const orderItems = [];

    for (const item of validItems) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${item.product.name}` 
        });
      }
      total += item.product.price * item.quantity;
      orderItems.push({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price
      });
    }

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          userId: req.user.id,
          total,
          shippingAddress,
          paymentIntent
        }
      });

      // Create order items
      await tx.orderItem.createMany({
        data: orderItems.map(item => ({
          orderId: newOrder.id,
          ...item
        }))
      });

      // Update product stock
      for (const item of validItems) {
        await tx.product.update({
          where: { id: item.product.id },
          data: { stock: item.product.stock - item.quantity }
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({
        where: { userId: req.user.id }
      });

      return await tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
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
    });

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Update order status (admin only)
router.put('/:id/status', [
  body('status').isIn(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
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
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

export default router; 
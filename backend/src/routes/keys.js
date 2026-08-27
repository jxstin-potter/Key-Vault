import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// NOTE ON ROUTE ORDER: Express matches in registration order, so every literal
// path below must stay above the parameterised '/:id' route at the bottom.

// ---------------------------------------------------------------------------
// GET /api/keys/mine - the caller's purchased keys, grouped by order
// ---------------------------------------------------------------------------
router.get('/mine', async (req, res) => {
  try {
    const keys = await prisma.gameKey.findMany({
      where: {
        status: 'SOLD',
        // Scope hard to the caller. Never trust a client-supplied user id.
        orderItem: { order: { userId: req.user.id } }
      },
      select: {
        id: true,
        code: true,
        soldAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: true,
            platform: true,
            region: true
          }
        },
        orderItem: {
          select: {
            order: { select: { id: true, createdAt: true, status: true } }
          }
        }
      },
      orderBy: { soldAt: 'desc' }
    });

    // Group by order so the UI can render one card per purchase
    const orders = new Map();
    for (const key of keys) {
      const order = key.orderItem.order;
      if (!orders.has(order.id)) {
        orders.set(order.id, {
          orderId: order.id,
          orderedAt: order.createdAt,
          status: order.status,
          keys: []
        });
      }
      orders.get(order.id).keys.push({
        id: key.id,
        code: key.code,
        soldAt: key.soldAt,
        product: key.product
      });
    }

    res.json({ orders: [...orders.values()], keyCount: keys.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch your keys' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/keys/inventory - per-product key counts by status (admin)
// ---------------------------------------------------------------------------
router.get('/inventory', requireAdmin, async (req, res) => {
  try {
    const grouped = await prisma.gameKey.groupBy({
      by: ['productId', 'status'],
      _count: { _all: true }
    });

    const inventory = {};
    for (const row of grouped) {
      inventory[row.productId] ??= { available: 0, reserved: 0, sold: 0, revoked: 0, total: 0 };
      inventory[row.productId][row.status.toLowerCase()] = row._count._all;
      inventory[row.productId].total += row._count._all;
    }

    res.json({ inventory });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch key inventory' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/keys/product/:productId - every key for one product (admin)
// ---------------------------------------------------------------------------
router.get('/product/:productId', requireAdmin, async (req, res) => {
  try {
    const keys = await prisma.gameKey.findMany({
      where: { productId: req.params.productId },
      select: { id: true, code: true, status: true, soldAt: true, createdAt: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    });
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch keys for product' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/keys/bulk - add a batch of codes to a product (admin)
// ---------------------------------------------------------------------------
router.post(
  '/bulk',
  requireAdmin,
  [body('productId').isString(), body('codes').isArray({ min: 1 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, codes } = req.body;

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true }
      });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Normalise: trim, drop blanks, de-duplicate within the submitted batch
      const submitted = codes.filter((c) => typeof c === 'string').map((c) => c.trim()).filter(Boolean);
      const unique = [...new Set(submitted)];

      if (unique.length === 0) {
        return res.status(400).json({ message: 'No usable codes in the batch' });
      }

      // skipDuplicates handles collisions with keys already in the database
      const created = await prisma.gameKey.createMany({
        data: unique.map((code) => ({ code, productId })),
        skipDuplicates: true
      });

      res.status(201).json({
        message: `Added ${created.count} keys`,
        added: created.count,
        skipped: submitted.length - created.count
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to add keys' });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/keys/:id - remove an unsold key (admin)
// ---------------------------------------------------------------------------
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const key = await prisma.gameKey.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true }
    });

    if (!key) {
      return res.status(404).json({ message: 'Key not found' });
    }

    // Deleting a SOLD key would destroy a customer's purchase record, and
    // deleting a RESERVED one would pull it out from under an open checkout.
    if (key.status !== 'AVAILABLE') {
      return res.status(409).json({
        message: `Only AVAILABLE keys can be deleted (this one is ${key.status})`
      });
    }

    await prisma.gameKey.delete({ where: { id: key.id } });
    res.json({ message: 'Key deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete key' });
  }
});

export default router;

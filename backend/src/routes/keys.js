import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// NOTE ON ROUTE ORDER: Express matches in registration order, so every literal
// path below must stay above the parameterised '/:id' route at the bottom.

/**
 * @route GET /api/keys/mine
 * @access Authenticated
 * @description The caller's own purchased (SOLD) keys, grouped by the order
 *   that delivered them. Scoped hard to `req.user.id` via the relation
 *   filter - never trusts a client-supplied user id.
 * @returns {200} `{ orders, keyCount }` - `orders` is one entry per purchase,
 *   each with its `keys` (code, product, sold date); newest purchase first.
 */
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

/**
 * @route GET /api/keys/inventory
 * @access Admin only
 * @description Per-product key counts broken down by status - the admin
 *   view into what a plain "stock" number can't show: how many keys are
 *   AVAILABLE vs. currently RESERVED (held in open checkouts) vs. SOLD vs.
 *   REVOKED (refunded).
 * @returns {200} `{ inventory }` - keyed by productId, each value
 *   `{ available, reserved, sold, revoked, total }`.
 * @returns {403} Caller is not an admin.
 */
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

/**
 * @route GET /api/keys/product/:productId
 * @access Admin only
 * @description Every key row for one product, in every status, including
 *   the redeemable code - the admin drill-down behind the /inventory summary.
 * @param {string} req.params.productId
 * @returns {200} `{ keys }` sorted by status then newest-created first.
 * @returns {403} Caller is not an admin.
 */
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

/**
 * @route POST /api/keys/bulk
 * @access Admin only
 * @description Add a batch of redeemable codes to a product's AVAILABLE
 *   pool. This is how inventory actually gets created - a product listing
 *   (routes/products.js POST /) and its sellable keys are separate
 *   operations, since a product can legitimately exist with zero keys
 *   (simply out of stock) until this endpoint is called.
 * @param {string} req.body.productId
 * @param {string[]} req.body.codes - Raw codes; trimmed, blanks dropped, and
 *   de-duplicated within the submission before insertion. Codes already
 *   present in the database (`skipDuplicates`) are silently skipped rather
 *   than erroring the whole batch.
 * @returns {201} `{ message, added, skipped }`.
 * @returns {400} Validation failed, or every submitted code was blank/duplicate.
 * @returns {403} Caller is not an admin.
 * @returns {404} `productId` doesn't match a real product.
 */
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

/**
 * @route DELETE /api/keys/:id
 * @access Admin only
 * @description Permanently remove a single key row. Restricted to AVAILABLE
 *   keys only: deleting a SOLD key would destroy a customer's purchase
 *   record, and deleting a RESERVED one would pull it out from under an open
 *   checkout mid-payment.
 * @param {string} req.params.id - Key id.
 * @returns {200} `{ message }`.
 * @returns {403} Caller is not an admin.
 * @returns {404} Key not found.
 * @returns {409} Key exists but is not AVAILABLE (currently RESERVED, SOLD, or REVOKED).
 */
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

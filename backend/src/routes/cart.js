import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Products no longer carry a stock column - sellable inventory is the number
// of AVAILABLE game keys. Select that count and surface it as `stock` so the
// client-facing shape is unchanged.
const AVAILABLE_KEYS = { select: { gameKeys: { where: { status: 'AVAILABLE' } } } };

const productSelect = {
  id: true,
  name: true,
  price: true,
  images: true,
  isActive: true,
  platform: true,
  region: true,
  // Without the genre relation the cart falls back to a literal "General"
  // badge on every line, which is never what the product actually is.
  category: { select: { id: true, name: true } },
  _count: AVAILABLE_KEYS
};

/**
 * Reshape a Prisma product (queried with `_count: AVAILABLE_KEYS`) into the
 * client-facing shape, replacing the Prisma count wrapper with a plain
 * `stock` number. Same helper pattern as routes/products.js.
 * @param {object|null} product
 * @returns {object|null}
 */
const withStock = (product) => {
  if (!product) return product;
  const { _count, ...rest } = product;
  return { ...rest, stock: _count?.gameKeys ?? 0 };
};

/**
 * Apply withStock() to the nested product on one cart item.
 * @param {object} item - A cart item with an included `product`.
 * @returns {object} The same item with `product` reshaped via withStock().
 */
const itemWithStock = (item) => ({ ...item, product: withStock(item.product) });

/**
 * @route GET /api/cart
 * @access Authenticated
 * @description The caller's cart contents. Items whose product has since
 *   been deactivated are silently filtered out rather than shown as broken
 *   rows - the underlying cartItem is left in the database in case the
 *   product is reactivated later.
 * @returns {200} `{ items, total, itemCount }`.
 */
router.get('/', async (req, res) => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          select: productSelect
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter out inactive products and calculate totals
    const validCartItems = cartItems
      .filter(item => item.product.isActive)
      .map(itemWithStock);
    const total = validCartItems.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    res.json({
      items: validCartItems,
      total: total,
      itemCount: validCartItems.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

/**
 * @route GET /api/cart/info
 * @access Authenticated
 * @description Static usage hint for this router.
 * @returns {200} `{ message }`.
 */
router.get('/info', (req, res) => {
  res.json({
    message: 'GET /api/cart returns the user cart (requires auth). Use POST, PUT, DELETE for cart actions.'
  });
});

/**
 * @route POST /api/cart/add
 * @access Authenticated
 * @description Add a product to the cart, or increase quantity if it's
 *   already present (unique on `(userId, productId)`, so "add" and
 *   "increase" are the same operation here). Stock is checked against the
 *   live AVAILABLE key count both for a fresh add and for the resulting
 *   combined quantity when merging into an existing line.
 * @param {string} req.body.productId
 * @param {number} req.body.quantity - 1 to 99.
 * @returns {201} `{ message, item }` - new cart line created.
 * @returns {200} `{ message, item }` - existing line's quantity updated.
 * @returns {400} Validation failed, or requested quantity exceeds available stock.
 * @returns {404} Product doesn't exist or is inactive.
 */
router.post('/add', [
  body('productId').isString(),
  body('quantity').isInt({ min: 1, max: 99 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, quantity } = req.body;

    // Check if product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, _count: AVAILABLE_KEYS }
    });

    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found or unavailable' });
    }

    // Sellable inventory is the number of unclaimed keys
    const availableKeys = product._count.gameKeys;
    if (availableKeys < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    // Check if item already exists in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId
        }
      }
    });

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      
      if (availableKeys < newQuantity) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }

      const updatedItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: {
          product: {
            select: productSelect
          }
        }
      });

      return res.json({
        message: 'Cart item updated',
        item: itemWithStock(updatedItem)
      });
    }

    // Add new item to cart
    const newItem = await prisma.cartItem.create({
      data: {
        userId: req.user.id,
        productId,
        quantity
      },
      include: {
        product: {
          select: productSelect
        }
      }
    });

    res.status(201).json({
      message: 'Item added to cart',
      item: itemWithStock(newItem)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add item to cart' });
  }
});

/**
 * @route PUT /api/cart/update/:itemId
 * @access Authenticated (own cart items only)
 * @description Set a cart line to an exact quantity (not additive, unlike
 *   POST /add).
 * @param {string} req.params.itemId - Cart item id.
 * @param {number} req.body.quantity - 1 to 99.
 * @returns {200} `{ message, item }`.
 * @returns {400} Validation failed, or quantity exceeds available stock.
 * @returns {404} No such cart item, or it belongs to a different user.
 */
router.put('/update/:itemId', [
  body('quantity').isInt({ min: 1, max: 99 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { itemId } = req.params;
    const { quantity } = req.body;

    // Check if cart item exists and belongs to user
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        userId: req.user.id
      },
      include: {
        product: { select: { id: true, _count: AVAILABLE_KEYS } }
      }
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    if (cartItem.product._count.gameKeys < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: {
        product: {
          select: productSelect
        }
      }
    });

    res.json({
      message: 'Cart item updated',
      item: itemWithStock(updatedItem)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update cart item' });
  }
});

/**
 * @route DELETE /api/cart/remove/:itemId
 * @access Authenticated (own cart items only)
 * @description Remove a single line from the cart.
 * @param {string} req.params.itemId - Cart item id.
 * @returns {200} `{ message }`.
 * @returns {404} No such cart item, or it belongs to a different user.
 */
router.delete('/remove/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    // Check if cart item exists and belongs to user
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        userId: req.user.id
      }
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    await prisma.cartItem.delete({
      where: { id: itemId }
    });

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove item from cart' });
  }
});

/**
 * @route DELETE /api/cart/clear
 * @access Authenticated
 * @description Remove every item from the caller's cart.
 * @returns {200} `{ message }`.
 */
router.delete('/clear', async (req, res) => {
  try {
    await prisma.cartItem.deleteMany({
      where: { userId: req.user.id }
    });

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to clear cart' });
  }
});

export default router; 
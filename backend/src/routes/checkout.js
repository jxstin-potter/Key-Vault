import express from 'express';
import prisma from '../lib/prisma.js';
import stripe, { isStripeConfigured } from '../lib/stripe.js';
import {
  reserveKeys,
  releaseExpiredReservations,
  withKeyRetry,
  OutOfKeysError
} from '../lib/keys.js';

const router = express.Router();

const AVAILABLE_KEYS = { select: { gameKeys: { where: { status: 'AVAILABLE' } } } };

// The Stripe session must die before the key reservation does, otherwise
// someone could pay for a key that had already been released back to the pool.
const SESSION_TTL_MINUTES = 30;
const RESERVATION_TTL_MINUTES = 35;

/**
 * Route guard: reject checkout requests with 503 if Stripe isn't configured,
 * rather than letting them fail deep inside the Stripe SDK call. Lets the
 * rest of the store (catalogue, accounts, cart) run without payment keys set.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requireStripe = (req, res, next) => {
  if (!isStripeConfigured) {
    return res.status(503).json({ message: 'Payments are not configured on this server' });
  }
  next();
};

/**
 * @route POST /api/checkout/session
 * @access Authenticated
 * @description Reserve keys for every item in the caller's cart, freeze an
 *   order server-side, then open a Stripe Checkout session for it.
 *
 *   Prices are read from the database, never from the request body - a
 *   client cannot influence what it is charged. Stock is checked against the
 *   live AVAILABLE key count for each product; reservation itself goes
 *   through reserveKeys() (see lib/keys.js) inside a single transaction per
 *   order, retried via withKeyRetry() if lost to contention.
 *
 *   The reservation TTL (35 min) deliberately outlives the Stripe session TTL
 *   (30 min), so the payment window always closes before the hold could
 *   expire out from under a customer mid-payment.
 * @returns {200} `{ url, orderId }` - redirect the browser to `url` to pay.
 * @returns {400} Empty cart, or every cart item is for an inactive product.
 * @returns {409} Insufficient stock for one of the cart items (either the
 *   pre-check or an OutOfKeysError from the reservation transaction).
 * @returns {503} Stripe is not configured (see requireStripe above).
 */
router.post('/session', requireStripe, async (req, res) => {
  try {
    // Reclaim anything whose hold lapsed before we measure availability.
    await releaseExpiredReservations();

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            isActive: true,
            _count: AVAILABLE_KEYS
          }
        }
      }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    const validItems = cartItems.filter((item) => item.product.isActive);
    if (validItems.length === 0) {
      return res.status(400).json({ message: 'No valid items in cart' });
    }

    // Prices come from the database. Anything the client sent is ignored.
    let total = 0;
    for (const item of validItems) {
      if (item.product._count.gameKeys < item.quantity) {
        return res.status(409).json({
          message: `Not enough keys available for ${item.product.name}`
        });
      }
      total += Number(item.product.price) * item.quantity;
    }

    const reservedUntil = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    // Create the order up front so the basket is frozen server-side and the
    // reservation has an order item to hang off. Abandoned checkouts simply
    // stay PENDING.
    const order = await withKeyRetry(() =>
      prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: { userId: req.user.id, total, status: 'PENDING' }
        });

        for (const item of validItems) {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: item.product.id,
              quantity: item.quantity,
              price: item.product.price
            }
          });

          await reserveKeys(tx, {
            productId: item.product.id,
            orderItemId: orderItem.id,
            quantity: item.quantity,
            until: reservedUntil
          });
        }

        return newOrder;
      })
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: order.id,
      metadata: { orderId: order.id },
      customer_email: req.user.email,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_MINUTES * 60,
      line_items: validItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: 'usd',
          // Decimal -> Number -> integer cents. Skipping the round produces
          // off-by-one-cent charges that will not match order.total.
          unit_amount: Math.round(Number(item.product.price) * 100),
          product_data: {
            name: item.product.name,
            // Stripe rejects non-https image URLs and fails the whole session
            images: (item.product.images || []).filter((u) => u.startsWith('https://')).slice(0, 1)
          }
        }
      })),
      success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/cart`
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id }
    });

    res.json({ url: session.url, orderId: order.id });
  } catch (error) {
    if (error instanceof OutOfKeysError) {
      return res.status(409).json({ message: 'Not enough keys available for one of your items' });
    }
    console.error('Failed to create checkout session:', error.message);
    res.status(500).json({ message: 'Failed to start checkout' });
  }
});

/**
 * @route GET /api/checkout/by-session/:sessionId
 * @access Authenticated (scoped to the caller's own orders)
 * @description Poll target for the post-payment success page. Read-only on
 *   purpose: fulfilment happens in the Stripe webhook (routes/webhooks.js),
 *   not here, so a customer who closes the tab before this page loads still
 *   receives their keys. This endpoint only reports whatever state the
 *   webhook has already reached.
 * @param {string} req.params.sessionId - Stripe Checkout session id.
 * @returns {200} `{ order }` including delivered key codes once fulfilled
 *   (`orderItems[].gameKeys`, filtered to status SOLD - empty until the
 *   webhook has run).
 * @returns {404} No order matches that session id for the current user.
 */
router.get('/by-session/:sessionId', async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { stripeSessionId: req.params.sessionId, userId: req.user.id },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        orderItems: {
          select: {
            id: true,
            quantity: true,
            price: true,
            product: {
              select: { id: true, name: true, images: true, platform: true, region: true }
            },
            gameKeys: {
              where: { status: 'SOLD' },
              select: { id: true, code: true }
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
    res.status(500).json({ message: 'Failed to look up order' });
  }
});

export default router;

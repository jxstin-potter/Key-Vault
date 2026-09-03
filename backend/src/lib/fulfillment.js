import prisma from './prisma.js';
import { fulfillKeys, releaseOrderKeys } from './keys.js';

/**
 * Hand over the keys for a paid order. Safe to call more than once.
 *
 * Idempotency is the conditional UPDATE below: only a PENDING order
 * transitions to COMPLETED, and updateMany reports how many rows it touched.
 * A duplicate webhook delivery finds the order already COMPLETED, matches
 * nothing, and returns early without assigning a second set of keys. That one
 * statement removes any need for a processed-events table.
 *
 * Called from the Stripe webhook handler on checkout.session.completed (and
 * its async-payment-succeeded counterpart) - never from the customer-facing
 * success redirect, which only polls the result. See routes/webhooks.js.
 *
 * @param {string} orderId - The order to fulfil.
 * @param {object} [options]
 * @param {string} [options.paymentIntentId] - Stripe PaymentIntent id to
 *   record on the order, used later to issue refunds against the same charge.
 * @returns {Promise<{fulfilled: boolean, alreadyFulfilled?: boolean, keyCount?: number}>}
 *   `{ fulfilled: false, alreadyFulfilled: true }` if this order was already
 *   completed (duplicate delivery, handled as a no-op); otherwise
 *   `{ fulfilled: true, keyCount }` with the number of keys just handed over.
 * @throws {KeyFulfillmentError} From fulfillKeys() if the reserved-key count
 *   doesn't match what the order's items expect - see lib/keys.js.
 */
export async function fulfillOrder(orderId, { paymentIntentId } = {}) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
        ...(paymentIntentId ? { paymentIntent: paymentIntentId } : {})
      }
    });

    if (count === 0) {
      return { fulfilled: false, alreadyFulfilled: true };
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { userId: true }
    });

    const keyCount = await fulfillKeys(tx, orderId);

    // The cart is cleared here rather than at session creation, so abandoning
    // a checkout leaves the basket intact.
    await tx.cartItem.deleteMany({ where: { userId: order.userId } });

    return { fulfilled: true, keyCount };
  });
}

/**
 * Abandon an order: release its reserved keys back to the pool and mark it
 * FAILED or CANCELLED. Only touches orders still awaiting payment - an
 * order that has already been fulfilled or already abandoned is left alone,
 * so this is safe to call from multiple triggers (session-expired webhook,
 * async-payment-failed webhook, manual admin action) without double-releasing
 * keys that have moved on.
 *
 * @param {string} orderId - The order to abandon.
 * @param {'CANCELLED'|'FAILED'} [status='CANCELLED'] - Terminal status to
 *   record. Use FAILED for a payment that was attempted and rejected;
 *   CANCELLED for a session that expired or was never completed.
 * @returns {Promise<{abandoned: boolean, released?: number}>}
 *   `{ abandoned: false }` if the order was not PENDING (already resolved by
 *   another path); otherwise `{ abandoned: true, released }` with the count
 *   of keys returned to AVAILABLE.
 */
export async function abandonOrder(orderId, status = 'CANCELLED') {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status }
  });

  if (count === 0) {
    return { abandoned: false };
  }

  const released = await releaseOrderKeys(orderId);
  return { abandoned: true, released };
}

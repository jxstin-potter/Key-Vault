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
 * FAILED or CANCELLED. Only touches orders still awaiting payment.
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

import prisma from './prisma.js';
import stripe, { isStripeConfigured } from './stripe.js';
import { logger } from './logger.js';

/** The order is not in a state where a refund makes sense. */
export class RefundNotAllowedError extends Error {
  constructor(orderId, status, detail) {
    super(detail);
    this.name = 'RefundNotAllowedError';
    this.orderId = orderId;
    this.status = status;
  }
}

/** Stripe rejected the refund. Surfaces as a 502 - the failure is upstream. */
export class RefundGatewayError extends Error {
  constructor(orderId, cause) {
    super(`Stripe refused to refund order ${orderId}: ${cause.message}`);
    this.name = 'RefundGatewayError';
    this.orderId = orderId;
    this.cause = cause;
  }
}

// Money has moved for these; nothing has moved for the others.
const REFUNDABLE_STATUSES = ['PAID', 'COMPLETED'];

/**
 * Record a refund in our own database: mark the order REFUNDED and revoke the
 * keys it delivered. Safe to call more than once.
 *
 * Idempotency uses the same conditional-UPDATE latch as fulfilment: only an
 * order in a refundable status transitions, and updateMany reports the row
 * count. A replayed charge.refunded webhook matches nothing and returns early.
 *
 * Keys become REVOKED, never AVAILABLE. This is the important domain decision
 * in this file. A refunded key has already been displayed to the customer -
 * they may have written it down, redeemed it, or sold it on. Returning it to
 * the sellable pool would sell a stranger a key that is very possibly already
 * burned, turning one refund into a second angry customer. Revoked keys stay
 * in the table as a record of what was issued, and are excluded from stock
 * because stock only ever counts AVAILABLE rows.
 */
export async function markOrderRefunded(orderId, { refundId } = {}) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: { in: REFUNDABLE_STATUSES } },
      data: { status: 'REFUNDED' }
    });

    if (count === 0) {
      return { refunded: false, alreadyRefunded: true, revokedKeys: 0 };
    }

    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { id: true }
    });

    const { count: revokedKeys } = await tx.gameKey.updateMany({
      where: { orderItemId: { in: items.map((i) => i.id) }, status: 'SOLD' },
      data: { status: 'REVOKED' }
    });

    logger.info({ orderId, refundId, revokedKeys }, 'Order refunded and keys revoked');
    return { refunded: true, revokedKeys };
  });
}

/**
 * Refund an order end to end: move the money at Stripe, then record it here.
 *
 * ORDERING. These are two systems and there is no transaction spanning both,
 * so one of them has to go first and the failure modes are not symmetric:
 *
 *   Database first, Stripe second - a Stripe failure leaves an order marked
 *   REFUNDED with the customer's money still taken and their keys revoked.
 *   That is the worst outcome available: we have taken something away and
 *   given nothing back, and nothing in the system knows it needs fixing.
 *
 *   Stripe first, database second - a database failure leaves the customer
 *   refunded but the order still COMPLETED. They have their money and their
 *   keys still work. We are out one key's revenue until reconciliation, and
 *   reconciliation is automatic: Stripe emits charge.refunded, the webhook
 *   calls markOrderRefunded, and the record catches up.
 *
 * So Stripe goes first. We prefer the failure that resolves itself and costs
 * us money over the one that silently robs a customer.
 *
 * The idempotency key makes the Stripe half safe to retry: two clicks on
 * "refund" send the same key, and Stripe returns the original refund instead
 * of issuing a second one.
 */
export async function refundOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentIntent: true, total: true }
  });

  if (!order) {
    throw new RefundNotAllowedError(orderId, null, 'Order not found');
  }

  if (order.status === 'REFUNDED') {
    return { refunded: false, alreadyRefunded: true, revokedKeys: 0 };
  }

  if (!REFUNDABLE_STATUSES.includes(order.status)) {
    throw new RefundNotAllowedError(
      orderId,
      order.status,
      `Only paid orders can be refunded (this one is ${order.status})`
    );
  }

  // An order can reach PAID/COMPLETED without a PaymentIntent if it was
  // fulfilled manually or seeded. There is no charge to reverse, so skip
  // Stripe and just correct our own records.
  if (!order.paymentIntent || !isStripeConfigured) {
    logger.warn(
      { orderId, hasPaymentIntent: !!order.paymentIntent, stripeConfigured: isStripeConfigured },
      'Refunding without a Stripe call - no payment intent on record'
    );
    return markOrderRefunded(orderId);
  }

  let refund;
  try {
    refund = await stripe.refunds.create(
      { payment_intent: order.paymentIntent, reason: 'requested_by_customer' },
      { idempotencyKey: `refund_order_${orderId}` }
    );
  } catch (error) {
    logger.error({ err: error, orderId }, 'Stripe refund failed');
    throw new RefundGatewayError(orderId, error);
  }

  return markOrderRefunded(orderId, { refundId: refund.id });
}

export default refundOrder;

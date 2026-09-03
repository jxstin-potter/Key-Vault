import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../src/lib/prisma.js';

/**
 * Refunds.
 *
 * Stripe is mocked here, and only Stripe. Everything below the network call -
 * the status latch, the key revocation, the ordering guarantee - runs for
 * real against Postgres. Mocking the payment provider is legitimate because
 * we are not testing Stripe; we are testing what we do around it, including
 * what we do when it fails.
 */

const refundsCreate = vi.fn();

vi.mock('../src/lib/stripe.js', () => ({
  default: { refunds: { create: (...args) => refundsCreate(...args) } },
  isStripeConfigured: true
}));

const { refundOrder, markOrderRefunded, RefundNotAllowedError, RefundGatewayError } =
  await import('../src/lib/refunds.js');
const { createUser, createProduct, createFulfilledOrder, createReservedOrder, countKeys } =
  await import('./helpers/factories.js');

beforeEach(() => {
  refundsCreate.mockReset();
  refundsCreate.mockResolvedValue({ id: 're_test_123', status: 'succeeded' });
});

describe('refundOrder', () => {
  it('refunds at Stripe, marks the order REFUNDED, and revokes the keys', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 3 });
    const { order } = await createFulfilledOrder({
      user,
      product,
      quantity: 2,
      paymentIntent: 'pi_abc'
    });

    const result = await refundOrder(order.id);

    expect(result).toMatchObject({ refunded: true, revokedKeys: 2 });

    expect(refundsCreate).toHaveBeenCalledOnce();
    const [params, options] = refundsCreate.mock.calls[0];
    expect(params.payment_intent).toBe('pi_abc');
    // The idempotency key is what makes a double-clicked refund button safe.
    expect(options.idempotencyKey).toBe(`refund_order_${order.id}`);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('REFUNDED');

    expect(await countKeys(product.id, 'REVOKED')).toBe(2);
    expect(await countKeys(product.id, 'SOLD')).toBe(0);
  });

  it('does NOT return revoked keys to the sellable pool', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 2 });
    const { order } = await createFulfilledOrder({ user, product, paymentIntent: 'pi_abc' });

    // One key sold, one still on the shelf.
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);

    await refundOrder(order.id);

    // The refunded key must not become available again. The customer has
    // already seen the code - it may be redeemed, written down, or resold.
    // Reselling it would turn one refund into a second furious customer.
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);
    expect(await countKeys(product.id, 'REVOKED')).toBe(1);
  });

  it('is idempotent - a second refund neither charges Stripe again nor re-revokes', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createFulfilledOrder({ user, product, paymentIntent: 'pi_abc' });

    const first = await refundOrder(order.id);
    const second = await refundOrder(order.id);

    expect(first.refunded).toBe(true);
    expect(second).toMatchObject({ refunded: false, alreadyRefunded: true });
    expect(refundsCreate).toHaveBeenCalledOnce();
    expect(await countKeys(product.id, 'REVOKED')).toBe(1);
  });

  it('refuses to refund an order that was never paid', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    await expect(refundOrder(order.id)).rejects.toThrow(RefundNotAllowedError);

    expect(refundsCreate).not.toHaveBeenCalled();
    // Still PENDING, keys still merely held.
    const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchanged.status).toBe('PENDING');
    expect(await countKeys(product.id, 'RESERVED')).toBe(1);
  });

  it('leaves the order untouched when Stripe rejects the refund', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createFulfilledOrder({ user, product, paymentIntent: 'pi_abc' });

    refundsCreate.mockRejectedValueOnce(new Error('charge_already_refunded'));

    await expect(refundOrder(order.id)).rejects.toThrow(RefundGatewayError);

    // This is the ordering guarantee. Because Stripe is called first, a
    // failure there leaves the customer with their money taken AND their keys
    // still working - recoverable. Had we written the database first, they
    // would have lost the keys and kept none of the money back.
    const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchanged.status).toBe('COMPLETED');
    expect(await countKeys(product.id, 'SOLD')).toBe(1);
    expect(await countKeys(product.id, 'REVOKED')).toBe(0);
  });

  it('still corrects the records for an order with no payment intent', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createFulfilledOrder({ user, product, paymentIntent: null });

    const result = await refundOrder(order.id);

    // Nothing to reverse upstream, but our own state must still be right.
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(result.refunded).toBe(true);
    expect(await countKeys(product.id, 'REVOKED')).toBe(1);
  });

  it('throws for an unknown order', async () => {
    await expect(refundOrder('does-not-exist')).rejects.toThrow(RefundNotAllowedError);
  });
});

describe('markOrderRefunded', () => {
  it('is safe to replay, as the charge.refunded webhook will', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 2 });
    const { order } = await createFulfilledOrder({ user, product, paymentIntent: 'pi_abc' });

    const first = await markOrderRefunded(order.id, { refundId: 're_1' });
    const second = await markOrderRefunded(order.id, { refundId: 're_1' });

    expect(first).toMatchObject({ refunded: true, revokedKeys: 1 });
    expect(second).toMatchObject({ refunded: false, alreadyRefunded: true });
    expect(await countKeys(product.id, 'REVOKED')).toBe(1);
  });

  it('reconciles a dashboard-initiated refund without any admin action here', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createFulfilledOrder({ user, product, paymentIntent: 'pi_xyz' });

    // Support refunds in the Stripe dashboard; we only ever see the webhook.
    await markOrderRefunded(order.id, { refundId: 're_dashboard' });

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('REFUNDED');
    expect(await countKeys(product.id, 'REVOKED')).toBe(1);
  });
});

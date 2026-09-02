import { describe, it, expect } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { fulfillOrder, abandonOrder } from '../src/lib/fulfillment.js';
import {
  createUser,
  createProduct,
  createReservedOrder,
  addToCart,
  countKeys
} from './helpers/factories.js';

/**
 * Fulfilment: the RESERVED -> SOLD transition, and its idempotency.
 *
 * Stripe guarantees *at least once* webhook delivery, not exactly once. It
 * retries on any non-2xx and will occasionally deliver a duplicate even after
 * a success. So "the same event arrives twice" is not an edge case to be
 * defended against defensively - it is normal operation, and the tests treat
 * it as such.
 */

describe('fulfillOrder', () => {
  it('marks the order complete, sells the keys, and clears the cart', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 3 });
    const { order } = await createReservedOrder({ user, product, quantity: 2 });

    // A cart survives checkout on purpose, so an abandoned payment leaves the
    // basket intact. It is cleared here, at fulfilment.
    await addToCart(user.id, product.id, 2);

    const result = await fulfillOrder(order.id, { paymentIntentId: 'pi_test_123' });

    expect(result).toMatchObject({ fulfilled: true, keyCount: 2 });

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('COMPLETED');
    expect(updated.paidAt).toBeInstanceOf(Date);
    expect(updated.paymentIntent).toBe('pi_test_123');

    expect(await countKeys(product.id, 'SOLD')).toBe(2);
    expect(await countKeys(product.id, 'RESERVED')).toBe(0);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);

    expect(await prisma.cartItem.count({ where: { userId: user.id } })).toBe(0);
  });

  it('stamps soldAt on the delivered keys', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    await fulfillOrder(order.id);

    const sold = await prisma.gameKey.findFirst({ where: { productId: product.id } });
    expect(sold.status).toBe('SOLD');
    expect(sold.soldAt).toBeInstanceOf(Date);
    // The hold is cleared - a sold key must never be picked up by the sweeper.
    expect(sold.reservedUntil).toBeNull();
  });

  it('ignores a duplicate webhook delivery instead of issuing a second set of keys', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 5 });
    const { order } = await createReservedOrder({ user, product, quantity: 2 });

    const first = await fulfillOrder(order.id, { paymentIntentId: 'pi_1' });
    const second = await fulfillOrder(order.id, { paymentIntentId: 'pi_1' });

    expect(first).toMatchObject({ fulfilled: true, keyCount: 2 });
    expect(second).toMatchObject({ fulfilled: false, alreadyFulfilled: true });

    // The important assertion: still two keys sold, not four.
    expect(await countKeys(product.id, 'SOLD')).toBe(2);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(3);
  });

  it('survives several concurrent deliveries of the same event', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 4 });
    const { order } = await createReservedOrder({ user, product, quantity: 1 });

    // Stripe retrying while the first delivery is still in flight is the
    // nastiest version of this: the latch has to hold under real parallelism,
    // not just sequential replay.
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => fulfillOrder(order.id, { paymentIntentId: 'pi_1' }))
    );

    const fulfilled = results.filter(
      (r) => r.status === 'fulfilled' && r.value.fulfilled === true
    );
    expect(fulfilled).toHaveLength(1);

    expect(await countKeys(product.id, 'SOLD')).toBe(1);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(3);
  });

  it('refuses to fulfil an order that was already cancelled', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    await abandonOrder(order.id, 'CANCELLED');
    const result = await fulfillOrder(order.id);

    expect(result.fulfilled).toBe(false);
    expect(await countKeys(product.id, 'SOLD')).toBe(0);
    // The key went back on the shelf when the order was cancelled and must
    // stay there - a late payment webhook cannot resurrect a dead order.
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);
  });

  it('leaves another customer\'s cart alone', async () => {
    const buyer = await createUser();
    const bystander = await createUser();
    const product = await createProduct({ availableKeys: 2 });

    await addToCart(buyer.id, product.id);
    await addToCart(bystander.id, product.id);

    const { order } = await createReservedOrder({ user: buyer, product });
    await fulfillOrder(order.id);

    expect(await prisma.cartItem.count({ where: { userId: buyer.id } })).toBe(0);
    expect(await prisma.cartItem.count({ where: { userId: bystander.id } })).toBe(1);
  });
});

describe('abandonOrder', () => {
  it('returns held keys to the pool when a session expires', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 3 });
    const { order } = await createReservedOrder({ user, product, quantity: 2 });

    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);

    const result = await abandonOrder(order.id, 'CANCELLED');

    expect(result).toMatchObject({ abandoned: true, released: 2 });
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(3);
    expect(await countKeys(product.id, 'RESERVED')).toBe(0);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('CANCELLED');
  });

  it('records a failed asynchronous payment as FAILED', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    await abandonOrder(order.id, 'FAILED');

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('FAILED');
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);
  });

  it('will not claw back the keys of an order that already completed', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    await fulfillOrder(order.id);

    // A late `checkout.session.expired` arriving after a successful payment
    // must not take a paying customer's key away.
    const result = await abandonOrder(order.id, 'CANCELLED');

    expect(result.abandoned).toBe(false);
    expect(await countKeys(product.id, 'SOLD')).toBe(1);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(0);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('COMPLETED');
  });
});

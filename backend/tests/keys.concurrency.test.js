import { describe, it, expect } from 'vitest';
import prisma from '../src/lib/prisma.js';
import {
  reserveKeys,
  releaseExpiredReservations,
  withKeyRetry,
  OutOfKeysError,
  KeyContentionError
} from '../src/lib/keys.js';
import { createUser, createProduct, countKeys } from './helpers/factories.js';

/**
 * The oversell tests.
 *
 * This file is the reason the suite runs against a real PostgreSQL instance.
 * The guarantee under test - that two buyers racing for the last key cannot
 * both get it - is not implemented in JavaScript. It is a property of what
 * Postgres does when two transactions issue a conditional UPDATE against the
 * same row under READ COMMITTED: the second one blocks until the first
 * commits, then re-evaluates its WHERE clause against the new row version,
 * finds `status = 'AVAILABLE'` no longer true, and matches zero rows.
 *
 * Mock the database and you assert that your mock returns what you told it to.
 * These tests would pass against a completely broken implementation.
 */

/**
 * One buyer's attempt, mirroring what routes/checkout.js does: create the
 * order and its item, then claim keys against it, all in one transaction.
 * Returns a discriminated result rather than throwing so Promise.all can
 * collect every outcome instead of short-circuiting on the first rejection.
 */
async function attemptPurchase(userId, productId, quantity = 1, { retry = false } = {}) {
  const run = () =>
    prisma.$transaction(
      async (tx) => {
        const order = await tx.order.create({
          data: { userId, total: 0, status: 'PENDING' }
        });
        const orderItem = await tx.orderItem.create({
          data: { orderId: order.id, productId, quantity, price: 0 }
        });
        const keyIds = await reserveKeys(tx, {
          productId,
          orderItemId: orderItem.id,
          quantity,
          until: new Date(Date.now() + 35 * 60 * 1000)
        });
        return { orderId: order.id, keyIds };
      },
      { timeout: 20000, maxWait: 20000 }
    );

  try {
    const value = retry ? await withKeyRetry(run) : await run();
    return { ok: true, ...value };
  } catch (error) {
    return { ok: false, error };
  }
}

describe('key reservation under concurrency', () => {
  it('lets exactly one of twenty simultaneous buyers take the last key', async () => {
    const product = await createProduct({ availableKeys: 1 });
    const buyers = await Promise.all(Array.from({ length: 20 }, () => createUser()));

    const results = await Promise.all(
      buyers.map((buyer) => attemptPurchase(buyer.id, product.id, 1))
    );

    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(19);

    // Every loser must fail for a *legitimate* reason. If one of them failed
    // with, say, a Prisma connection error, the test would otherwise pass
    // while proving nothing about the race.
    for (const loser of losers) {
      expect(
        loser.error instanceof OutOfKeysError || loser.error instanceof KeyContentionError,
        `unexpected failure: ${loser.error?.name}: ${loser.error?.message}`
      ).toBe(true);
    }

    // The inventory itself is the real assertion: one key held, none left.
    expect(await countKeys(product.id, 'RESERVED')).toBe(1);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(0);
    expect(await countKeys(product.id, 'SOLD')).toBe(0);
  });

  it('sells exactly the stock on hand when demand exceeds it', async () => {
    const STOCK = 5;
    const DEMAND = 25;

    const product = await createProduct({ availableKeys: STOCK });
    const buyers = await Promise.all(Array.from({ length: DEMAND }, () => createUser()));

    const results = await Promise.all(
      buyers.map((buyer) => attemptPurchase(buyer.id, product.id, 1))
    );

    expect(results.filter((r) => r.ok)).toHaveLength(STOCK);
    expect(results.filter((r) => !r.ok)).toHaveLength(DEMAND - STOCK);

    expect(await countKeys(product.id, 'RESERVED')).toBe(STOCK);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(0);

    // No key may be held by two different orders.
    const reserved = await prisma.gameKey.findMany({
      where: { productId: product.id, status: 'RESERVED' },
      select: { id: true, orderItemId: true }
    });
    const holders = new Set(reserved.map((k) => k.orderItemId));
    expect(holders.size).toBe(STOCK);
    expect([...holders].every(Boolean)).toBe(true);
  });

  it('never lets total keys drift, whatever the interleaving', async () => {
    const product = await createProduct({ availableKeys: 8 });
    const buyers = await Promise.all(Array.from({ length: 20 }, () => createUser()));

    // Mixed basket sizes make the interleaving messier than uniform demand.
    await Promise.all(
      buyers.map((buyer, i) => attemptPurchase(buyer.id, product.id, (i % 3) + 1))
    );

    const [available, reserved, sold, revoked, total] = await Promise.all([
      countKeys(product.id, 'AVAILABLE'),
      countKeys(product.id, 'RESERVED'),
      countKeys(product.id, 'SOLD'),
      countKeys(product.id, 'REVOKED'),
      prisma.gameKey.count({ where: { productId: product.id } })
    ]);

    // Keys are conserved: reservation moves rows between states, it never
    // creates or destroys them.
    expect(total).toBe(8);
    expect(available + reserved + sold + revoked).toBe(8);
    // And we can never have promised more than we had.
    expect(reserved).toBeLessThanOrEqual(8);
  });

  it('rejects a basket larger than the remaining stock without partially filling it', async () => {
    const product = await createProduct({ availableKeys: 2 });
    const user = await createUser();

    const result = await attemptPurchase(user.id, product.id, 3);

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(OutOfKeysError);
    expect(result.error.requested).toBe(3);
    expect(result.error.available).toBe(2);

    // The transaction rolled back, so the two keys it looked at are untouched
    // and no half-filled order was left behind.
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(2);
    expect(await countKeys(product.id, 'RESERVED')).toBe(0);
    expect(await prisma.order.count()).toBe(0);
  });

  it('recovers contention losers through withKeyRetry when stock is sufficient', async () => {
    // Ample stock for everyone, but enough simultaneous buyers that some will
    // pick overlapping candidate rows and lose the compare-and-set. With
    // retry, a loser should get a different key rather than a failed sale.
    const product = await createProduct({ availableKeys: 20 });
    const buyers = await Promise.all(Array.from({ length: 20 }, () => createUser()));

    const results = await Promise.all(
      buyers.map((buyer) => attemptPurchase(buyer.id, product.id, 1, { retry: true }))
    );

    expect(results.every((r) => r.ok)).toBe(true);
    expect(await countKeys(product.id, 'RESERVED')).toBe(20);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(0);

    // Each buyer walked away with a distinct key.
    const claimed = results.flatMap((r) => r.keyIds);
    expect(new Set(claimed).size).toBe(20);
  });
});

describe('reservation expiry', () => {
  it('returns a lapsed hold to the pool and lets someone else buy it', async () => {
    const product = await createProduct({ availableKeys: 1 });
    const first = await createUser();
    const second = await createUser();

    const held = await attemptPurchase(first.id, product.id, 1);
    expect(held.ok).toBe(true);

    // The second buyer cannot have it while the hold stands.
    expect((await attemptPurchase(second.id, product.id, 1)).ok).toBe(false);

    // Wind the hold into the past rather than waiting 35 minutes.
    await prisma.gameKey.updateMany({
      where: { productId: product.id, status: 'RESERVED' },
      data: { reservedUntil: new Date(Date.now() - 60 * 1000) }
    });

    const released = await releaseExpiredReservations();
    expect(released).toBe(1);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);

    // And now the key genuinely is buyable again.
    const secondAttempt = await attemptPurchase(second.id, product.id, 1);
    expect(secondAttempt.ok).toBe(true);
    expect(await countKeys(product.id, 'RESERVED')).toBe(1);
  });

  it('leaves a live reservation alone', async () => {
    const product = await createProduct({ availableKeys: 1 });
    const user = await createUser();
    await attemptPurchase(user.id, product.id, 1);

    expect(await releaseExpiredReservations()).toBe(0);
    expect(await countKeys(product.id, 'RESERVED')).toBe(1);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(0);
  });

  it('never releases a SOLD key, however old the order', async () => {
    const product = await createProduct({ availableKeys: 1 });
    const user = await createUser();
    await attemptPurchase(user.id, product.id, 1);

    // A sold key with a stale reservedUntil left behind - the shape a bug in
    // fulfilment could plausibly produce.
    await prisma.gameKey.updateMany({
      where: { productId: product.id },
      data: { status: 'SOLD', reservedUntil: new Date(Date.now() - 60 * 60 * 1000) }
    });

    expect(await releaseExpiredReservations()).toBe(0);
    expect(await countKeys(product.id, 'SOLD')).toBe(1);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(0);
  });
});

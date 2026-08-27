import prisma from './prisma.js';

/**
 * Not enough AVAILABLE keys exist for the requested quantity.
 * Surfaces to the caller as a 409 - the listing is genuinely out of stock.
 */
export class OutOfKeysError extends Error {
  constructor(productId, requested, available) {
    super(`Insufficient keys for product ${productId}: wanted ${requested}, have ${available}`);
    this.name = 'OutOfKeysError';
    this.productId = productId;
    this.requested = requested;
    this.available = available;
  }
}

/**
 * Another transaction claimed the rows we picked between our read and our
 * write. Retryable - enough keys may still exist overall.
 */
export class KeyContentionError extends Error {
  constructor(productId) {
    super(`Lost a race claiming keys for product ${productId}`);
    this.name = 'KeyContentionError';
    this.productId = productId;
  }
}

/** Reserved keys were not all present at fulfilment time. */
export class KeyFulfillmentError extends Error {
  constructor(orderId, expected, actual) {
    super(`Order ${orderId}: expected to fulfil ${expected} keys, matched ${actual}`);
    this.name = 'KeyFulfillmentError';
    this.orderId = orderId;
  }
}

/**
 * Return reservations whose hold has lapsed to the AVAILABLE pool.
 * Called at the top of checkout-session creation, so no cron job is needed.
 */
export async function releaseExpiredReservations(db = prisma) {
  const { count } = await db.gameKey.updateMany({
    where: { status: 'RESERVED', reservedUntil: { lt: new Date() } },
    data: { status: 'AVAILABLE', reservedUntil: null, orderItemId: null }
  });
  return count;
}

/** How many keys are currently sellable for a product. */
export async function availableKeyCount(productId, db = prisma) {
  return db.gameKey.count({ where: { productId, status: 'AVAILABLE' } });
}

/**
 * Claim `quantity` keys for an order item. MUST run inside a $transaction.
 *
 * Concurrency: the `status: 'AVAILABLE'` predicate in the updateMany WHERE
 * turns each row update into a compare-and-set. Under READ COMMITTED a
 * competing writer blocks, then re-evaluates the predicate against the new
 * row version; a row someone else already took no longer matches and is not
 * counted. So `count !== quantity` means we lost a race - throw and let the
 * surrounding transaction roll back rather than over-selling.
 */
export async function reserveKeys(tx, { productId, orderItemId, quantity, until }) {
  const candidates = await tx.gameKey.findMany({
    where: { productId, status: 'AVAILABLE' },
    take: quantity,
    select: { id: true }
  });

  if (candidates.length < quantity) {
    throw new OutOfKeysError(productId, quantity, candidates.length);
  }

  const { count } = await tx.gameKey.updateMany({
    where: { id: { in: candidates.map((k) => k.id) }, status: 'AVAILABLE' },
    data: { status: 'RESERVED', reservedUntil: until, orderItemId }
  });

  if (count !== quantity) throw new KeyContentionError(productId);

  return candidates.map((k) => k.id);
}

/**
 * Flip every key reserved against an order from RESERVED to SOLD.
 * MUST run inside a $transaction, guarded by the order-status latch in
 * fulfillOrder() so it can only execute once per order.
 */
export async function fulfillKeys(tx, orderId) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { id: true, quantity: true }
  });

  const expected = items.reduce((sum, i) => sum + i.quantity, 0);

  const { count } = await tx.gameKey.updateMany({
    where: { orderItemId: { in: items.map((i) => i.id) }, status: 'RESERVED' },
    data: { status: 'SOLD', soldAt: new Date(), reservedUntil: null }
  });

  if (count !== expected) throw new KeyFulfillmentError(orderId, expected, count);

  return count;
}

/** Release every key held against an order (cancelled / expired / failed). */
export async function releaseOrderKeys(orderId, db = prisma) {
  const items = await db.orderItem.findMany({
    where: { orderId },
    select: { id: true }
  });

  const { count } = await db.gameKey.updateMany({
    where: { orderItemId: { in: items.map((i) => i.id) }, status: 'RESERVED' },
    data: { status: 'AVAILABLE', reservedUntil: null, orderItemId: null }
  });

  return count;
}

/**
 * Retry a transaction that failed purely on key contention. Two buyers can
 * pick overlapping id sets and both lose, even when stock is sufficient.
 */
export async function withKeyRetry(fn, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof KeyContentionError)) throw error;
      lastError = error;
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 50));
    }
  }
  throw lastError;
}

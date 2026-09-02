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
 * CONCURRENCY, and why this uses raw SQL.
 *
 * The obvious implementation - findMany the available rows, then updateMany
 * them with a `status: 'AVAILABLE'` guard - is *safe* but badly behaved. The
 * guard makes each row update a compare-and-set, so nobody can oversell: a
 * competing writer blocks, re-reads the committed row, no longer matches, and
 * is not counted. That part was never the problem.
 *
 * The problem is that every concurrent buyer selects the *same* rows. An
 * unordered `LIMIT n` hands all 25 shoppers the identical five candidates, so
 * one wins and twenty-four collide - and they collide on rows that are already
 * gone rather than moving on to the four keys still sitting unsold. A test
 * with 5 keys and 25 simultaneous buyers sold 3. Not oversold: *undersold*,
 * with stock on the shelf and customers being told it was out of stock.
 * Retrying only rediscovers the same contended rows.
 *
 * FOR UPDATE SKIP LOCKED fixes it at the source. Each transaction takes row
 * locks on the keys it intends to claim, and SKIP LOCKED makes concurrent
 * transactions step over rows someone else has already locked rather than
 * queueing behind them. Twenty-five buyers therefore receive twenty-five
 * disjoint candidate sets: the first five get a key each, the rest correctly
 * find nothing left. This is the same primitive Postgres-backed job queues use
 * to hand distinct work to competing workers, and it is exactly the shape of
 * this problem.
 *
 * Prisma's query builder cannot express row-level locking, hence $queryRaw.
 * productId and quantity are bound parameters, not interpolated.
 *
 * Trade-off worth naming: SKIP LOCKED can report out-of-stock while another
 * transaction holds rows it will ultimately roll back. That window is one
 * checkout transaction wide and self-corrects on the next attempt. Blocking
 * instead - plain FOR UPDATE - would trade a rare false "sold out" for
 * serialising every purchase of the same product behind one lock queue, which
 * is the worse deal for a store.
 *
 * The compare-and-set on the UPDATE is kept as a belt-and-braces assertion.
 * Holding the locks means it should be unreachable; if it ever fires,
 * something about the isolation assumptions has changed and we want to know
 * loudly rather than oversell quietly.
 */
export async function reserveKeys(tx, { productId, orderItemId, quantity, until }) {
  const candidates = await tx.$queryRaw`
    SELECT id
    FROM game_keys
    WHERE "productId" = ${productId}
      AND status = 'AVAILABLE'
    ORDER BY "createdAt" ASC, id ASC
    LIMIT ${quantity}
    FOR UPDATE SKIP LOCKED
  `;

  if (candidates.length < quantity) {
    throw new OutOfKeysError(productId, quantity, candidates.length);
  }

  const ids = candidates.map((k) => k.id);

  const { count } = await tx.gameKey.updateMany({
    where: { id: { in: ids }, status: 'AVAILABLE' },
    data: { status: 'RESERVED', reservedUntil: until, orderItemId }
  });

  if (count !== quantity) throw new KeyContentionError(productId);

  return ids;
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

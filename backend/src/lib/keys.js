import prisma from './prisma.js';

/**
 * Not enough AVAILABLE keys exist for the requested quantity.
 * Surfaces to the caller as a 409 - the listing is genuinely out of stock.
 */
export class OutOfKeysError extends Error {
  /**
   * @param {string} productId - Product that ran out of stock.
   * @param {number} requested - Quantity the caller tried to reserve.
   * @param {number} available - Quantity actually found AVAILABLE.
   */
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
  /** @param {string} productId - Product whose candidate keys were lost to another writer. */
  constructor(productId) {
    super(`Lost a race claiming keys for product ${productId}`);
    this.name = 'KeyContentionError';
    this.productId = productId;
  }
}

/** Reserved keys were not all present at fulfilment time. */
export class KeyFulfillmentError extends Error {
  /**
   * @param {string} orderId - Order whose fulfilment counts didn't match.
   * @param {number} expected - Total quantity across the order's items.
   * @param {number} actual - Keys actually transitioned to SOLD.
   */
  constructor(orderId, expected, actual) {
    super(`Order ${orderId}: expected to fulfil ${expected} keys, matched ${actual}`);
    this.name = 'KeyFulfillmentError';
    this.orderId = orderId;
  }
}

/**
 * Return reservations whose hold has lapsed to the AVAILABLE pool.
 *
 * Called at the top of checkout-session creation (so a shopper never sees
 * stale "sold out" inventory that is really just abandoned holds) and also
 * on a background interval by reservationSweeper.js, so no cron job outside
 * the process is needed.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db=prisma]
 *   Prisma client or transaction to run the update against. Defaults to the
 *   shared client; callers inside a transaction should pass `tx`.
 * @returns {Promise<number>} Number of keys returned to AVAILABLE.
 */
export async function releaseExpiredReservations(db = prisma) {
  const { count } = await db.gameKey.updateMany({
    where: { status: 'RESERVED', reservedUntil: { lt: new Date() } },
    data: { status: 'AVAILABLE', reservedUntil: null, orderItemId: null }
  });
  return count;
}

/**
 * How many keys are currently sellable for a product.
 *
 * This is the derived "stock" figure the catalogue displays - there is no
 * stored stock column, deliberately (see the module-level design note in
 * README.md). A product's availability is always this count, computed live.
 *
 * @param {string} productId - The product to count available keys for.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db=prisma]
 *   Prisma client or transaction to query against.
 * @returns {Promise<number>} Count of keys in AVAILABLE status for this product.
 */
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
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx - An open
 *   Prisma transaction. Row locks taken here are only meaningful for the
 *   lifetime of this transaction, so this function must not be called
 *   outside one.
 * @param {object} params
 * @param {string} params.productId - Product whose AVAILABLE keys to claim from.
 * @param {string} params.orderItemId - Order item the claimed keys get attached to.
 * @param {number} params.quantity - How many keys to claim.
 * @param {Date} params.until - Reservation expiry (`reservedUntil`); after
 *   this time releaseExpiredReservations() will return the keys to AVAILABLE.
 * @returns {Promise<string[]>} The ids of the keys claimed, in claim order.
 * @throws {OutOfKeysError} Fewer than `quantity` AVAILABLE keys exist right now.
 * @throws {KeyContentionError} The locked candidates were claimed by another
 *   writer between SELECT and UPDATE (should be unreachable; see above).
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
 *
 * MUST run inside a $transaction, guarded by the order-status latch in
 * fulfillOrder() (see lib/fulfillment.js) so it can only execute once per
 * order - this function itself does not re-check idempotency.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx - An open
 *   Prisma transaction, shared with the caller's status-latch update.
 * @param {string} orderId - The order whose reserved keys should be marked sold.
 * @returns {Promise<number>} Number of keys transitioned to SOLD.
 * @throws {KeyFulfillmentError} The count of keys actually flipped did not
 *   match the order's expected item quantities - data has drifted from what
 *   reserveKeys() should have guaranteed, and this is treated as a bug
 *   rather than silently under- or over-fulfilling the order.
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

/**
 * Release every key held against an order (cancelled / expired / failed).
 *
 * Only touches keys currently RESERVED, so calling this on an order that has
 * already been fulfilled (keys now SOLD) or already released is a no-op
 * rather than an error - safe to call defensively from multiple paths
 * (checkout expiry, Stripe session-expired webhook, manual cancellation).
 *
 * @param {string} orderId - The order whose reserved keys should be freed.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db=prisma]
 *   Prisma client or transaction to run the update against.
 * @returns {Promise<number>} Number of keys returned to AVAILABLE.
 */
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
 *
 * With FOR UPDATE SKIP LOCKED in reserveKeys(), a genuine KeyContentionError
 * should be rare to unreachable - this exists as a safety net and an
 * assertion, not as the primary mechanism preventing oversell/undersell.
 *
 * @param {() => Promise<any>} fn - A function that runs and returns the
 *   result of a reserveKeys()-based transaction. Called up to `attempts` times.
 * @param {number} [attempts=3] - Maximum number of attempts before giving up.
 * @returns {Promise<any>} Whatever `fn()` resolves to on the attempt that succeeds.
 * @throws {KeyContentionError} If every attempt is lost to contention.
 * @throws {Error} Immediately, without retrying, for any error that is not a
 *   KeyContentionError (e.g. OutOfKeysError is not retried - more attempts
 *   won't conjure stock that doesn't exist).
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

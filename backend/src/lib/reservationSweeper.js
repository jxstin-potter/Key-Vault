import { releaseExpiredReservations } from './keys.js';
import { logger } from './logger.js';

const DEFAULT_INTERVAL_MS = 60 * 1000;

/**
 * Periodically return lapsed key reservations to the AVAILABLE pool.
 *
 * Why this exists: releaseExpiredReservations() was previously called in
 * exactly one place - the top of checkout-session creation. That is enough to
 * keep the system *correct* (nobody can buy a key whose hold has expired,
 * because the sweep runs before availability is measured), but not enough to
 * keep it *honest*. On a quiet store, an abandoned checkout leaves keys stuck
 * in RESERVED until the next person happens to start a checkout. Until then
 * the catalogue reports a product as sold out while holding keys nobody is
 * buying - and the shopper who would have triggered the sweep is exactly the
 * shopper who just bounced off an out-of-stock page.
 *
 * A one-minute interval is far more often than necessary for a 35-minute hold;
 * the query is a single indexed UPDATE against
 * `@@index([status, reservedUntil])`, so the cost is negligible and the
 * catalogue is never more than a minute stale.
 *
 * Note this is an in-process timer, which is correct for a single instance and
 * merely wasteful across several - every instance would run the same UPDATE,
 * and the losers would match zero rows. If this ever scales horizontally, the
 * upgrade is a Postgres advisory lock around the sweep, not a new service.
 *
 * @param {object} [options]
 * @param {number} [options.intervalMs=60000] - Milliseconds between sweep
 *   passes. Defaults to one minute.
 * @returns {() => void} Stop function - call it to clearInterval the sweep,
 *   used on graceful shutdown (server.js) and by tests to clean up after
 *   themselves.
 */
export function startReservationSweeper({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  let running = false;

  /**
   * One sweep pass: release any reservation whose hold has lapsed. Guards
   * against overlapping with itself and never throws, so a slow or failing
   * database can't pile up work on the connection pool or crash the timer.
   */
  const sweep = async () => {
    // Skip if the previous pass is still going. A slow database should not let
    // overlapping sweeps pile up on the connection pool.
    if (running) return;
    running = true;
    try {
      const released = await releaseExpiredReservations();
      if (released > 0) {
        logger.info({ released }, 'Released expired key reservations');
      }
    } catch (error) {
      // A failed sweep is self-healing: the next pass picks up the same rows.
      // Never let it reject into the timer and take the process down.
      logger.error({ err: error }, 'Reservation sweep failed');
    } finally {
      running = false;
    }
  };

  const timer = setInterval(sweep, intervalMs);

  // Do not hold the event loop open. Without this, a process that has finished
  // its work (and any test that starts a sweeper) would hang until killed.
  timer.unref();

  return () => clearInterval(timer);
}

export default startReservationSweeper;

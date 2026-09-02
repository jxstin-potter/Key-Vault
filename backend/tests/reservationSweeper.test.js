import { describe, it, expect, vi } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { startReservationSweeper } from '../src/lib/reservationSweeper.js';
import * as keys from '../src/lib/keys.js';
import { createUser, createProduct, createReservedOrder, countKeys } from './helpers/factories.js';

/**
 * The background sweeper.
 *
 * Its job is honesty rather than correctness: releaseExpiredReservations was
 * already called at the top of every checkout, which is enough to stop anyone
 * buying a key whose hold had lapsed. What it could not do is fix the
 * catalogue on a quiet store - an abandoned checkout left keys stuck in
 * RESERVED, and the page kept saying "sold out" until some other shopper
 * happened to start a checkout and trigger the sweep. That shopper is exactly
 * the one who just bounced off the out-of-stock page.
 */

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('startReservationSweeper', () => {
  it('releases a lapsed hold with no request traffic at all', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    await createReservedOrder({ user, product });

    // The customer walked away; the hold lapses.
    await prisma.gameKey.updateMany({
      where: { productId: product.id, status: 'RESERVED' },
      data: { reservedUntil: new Date(Date.now() - 60_000) }
    });

    expect(await countKeys(product.id, 'AVAILABLE')).toBe(0);

    const stop = startReservationSweeper({ intervalMs: 25 });
    await tick(120);
    stop();

    // Nobody visited the site in between - the key came back on its own.
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);
    expect(await countKeys(product.id, 'RESERVED')).toBe(0);
  });

  it('leaves live reservations alone', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    await createReservedOrder({ user, product });

    const stop = startReservationSweeper({ intervalMs: 25 });
    await tick(120);
    stop();

    // A customer still on the Stripe payment page must keep their key.
    expect(await countKeys(product.id, 'RESERVED')).toBe(1);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(0);
  });

  it('stops when told to', async () => {
    const spy = vi.spyOn(keys, 'releaseExpiredReservations');

    const stop = startReservationSweeper({ intervalMs: 20 });
    await tick(70);
    stop();

    const callsAtStop = spy.mock.calls.length;
    expect(callsAtStop).toBeGreaterThan(0);

    await tick(80);
    expect(spy.mock.calls.length).toBe(callsAtStop);

    spy.mockRestore();
  });

  it('keeps running after a failed pass', async () => {
    const spy = vi
      .spyOn(keys, 'releaseExpiredReservations')
      .mockRejectedValueOnce(new Error('database went away'))
      .mockResolvedValue(0);

    const stop = startReservationSweeper({ intervalMs: 20 });
    await tick(100);
    stop();

    // A transient database fault must not kill the timer - the next pass
    // picks up the same rows, so the failure is self-healing.
    expect(spy.mock.calls.length).toBeGreaterThan(1);

    spy.mockRestore();
  });

  it('does not overlap passes when one runs long', async () => {
    let inFlight = 0;
    let maxConcurrent = 0;

    const spy = vi.spyOn(keys, 'releaseExpiredReservations').mockImplementation(async () => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await tick(60); // slower than the interval
      inFlight -= 1;
      return 0;
    });

    const stop = startReservationSweeper({ intervalMs: 10 });
    await tick(200);
    stop();
    await tick(80); // let the last pass drain

    // Overlapping sweeps would pile up on the connection pool.
    expect(maxConcurrent).toBe(1);

    spy.mockRestore();
  });
});

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import prisma from '../src/lib/prisma.js';

/**
 * The Stripe webhook receiver - where fulfilment actually happens.
 *
 * Two things here are easy to break and expensive to break:
 *
 *   1. The raw-body mounting. Signature verification hashes the exact bytes
 *      Stripe sent. If express.json() parses the body first, every real
 *      delivery fails verification with a correct secret, and the symptom
 *      ("No signatures found matching...") points at the secret rather than
 *      at middleware order. One test below asserts the handler receives a
 *      Buffer, so a reordering is caught here rather than in production.
 *
 *   2. The status-code contract. Stripe retries on any non-2xx. Returning 4xx
 *      for a transient database fault would discard the event permanently and
 *      leave a paying customer with no keys; returning 2xx for a bad signature
 *      would let anyone forge fulfilment.
 */

const constructEvent = vi.fn();

vi.mock('../src/lib/stripe.js', () => ({
  default: { webhooks: { constructEvent: (...a) => constructEvent(...a) } },
  isStripeConfigured: true
}));

const { createApp } = await import('../src/app.js');
const { createUser, createProduct, createReservedOrder, createFulfilledOrder, countKeys } =
  await import('./helpers/factories.js');

const app = createApp();

const ORIGINAL_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

afterAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_SECRET;
});

beforeEach(() => {
  constructEvent.mockReset();
});

/** Post a body Stripe would have sent, with the mock returning `event`. */
const deliver = (event, body = { any: 'bytes' }) => {
  constructEvent.mockReturnValue(event);
  return request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', 't=1,v1=fake')
    .set('Content-Type', 'application/json')
    .send(body);
};

const completedEvent = (orderId, overrides = {}) => ({
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_1',
      payment_status: 'paid',
      payment_intent: 'pi_test_1',
      metadata: { orderId },
      client_reference_id: orderId,
      ...overrides
    }
  }
});

describe('signature verification', () => {
  it('rejects a bad signature with 400 and does not fulfil anything', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'forged')
      .send({ type: 'checkout.session.completed', data: { object: { metadata: { orderId: order.id } } } });

    expect(res.status).toBe(400);
    expect(await countKeys(product.id, 'SOLD')).toBe(0);

    const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchanged.status).toBe('PENDING');
  });

  it('receives the raw request body, not a parsed object', async () => {
    await deliver({ type: 'unhandled.event', data: { object: {} } });

    const [body, signature, secret] = constructEvent.mock.calls[0];
    // If this is ever not a Buffer, express.json() has been mounted above the
    // webhook route and every real Stripe delivery will fail verification.
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(signature).toBe('t=1,v1=fake');
    expect(secret).toBe('whsec_test');
  });
});

describe('checkout.session.completed', () => {
  it('delivers the keys and completes the order', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 3 });
    const { order } = await createReservedOrder({ user, product, quantity: 2 });

    const res = await deliver(completedEvent(order.id));

    expect(res.status).toBe(200);
    expect(await countKeys(product.id, 'SOLD')).toBe(2);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('COMPLETED');
    expect(updated.paymentIntent).toBe('pi_test_1');
  });

  it('acknowledges a duplicate delivery without issuing more keys', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 4 });
    const { order } = await createReservedOrder({ user, product, quantity: 1 });

    const first = await deliver(completedEvent(order.id));
    const second = await deliver(completedEvent(order.id));

    // Both must be 2xx. A non-2xx on the duplicate would make Stripe retry it
    // forever.
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await countKeys(product.id, 'SOLD')).toBe(1);
  });

  it('waits when the session completed but payment has not settled', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    const res = await deliver(completedEvent(order.id, { payment_status: 'unpaid' }));

    expect(res.status).toBe(200); // acknowledged, just not acted on
    expect(await countKeys(product.id, 'SOLD')).toBe(0);
    expect(await countKeys(product.id, 'RESERVED')).toBe(1);
  });

  it('falls back to client_reference_id when metadata is missing', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    const event = completedEvent(order.id);
    delete event.data.object.metadata;

    const res = await deliver(event);

    expect(res.status).toBe(200);
    expect(await countKeys(product.id, 'SOLD')).toBe(1);
  });

  it('acknowledges an event with no order reference rather than retrying forever', async () => {
    const event = completedEvent(undefined);
    delete event.data.object.metadata;
    delete event.data.object.client_reference_id;

    const res = await deliver(event);
    expect(res.status).toBe(200);
  });
});

describe('session expiry and payment failure', () => {
  it('returns held keys to the pool when the session expires', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 2 });
    const { order } = await createReservedOrder({ user, product, quantity: 1 });

    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);

    const res = await deliver({
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_1', metadata: { orderId: order.id } } }
    });

    expect(res.status).toBe(200);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(2);
    expect(await countKeys(product.id, 'RESERVED')).toBe(0);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('CANCELLED');
  });

  it('marks a failed asynchronous payment FAILED and releases the keys', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    await deliver({
      type: 'checkout.session.async_payment_failed',
      data: { object: { id: 'cs_1', metadata: { orderId: order.id } } }
    });

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('FAILED');
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);
  });

  it('fulfils a delayed payment that eventually succeeds', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    await deliver({
      type: 'checkout.session.async_payment_succeeded',
      data: { object: { id: 'cs_1', metadata: { orderId: order.id } } }
    });

    expect(await countKeys(product.id, 'SOLD')).toBe(1);
  });
});

describe('charge.refunded', () => {
  it('revokes the keys of an order refunded from the Stripe dashboard', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 2 });
    const { order } = await createFulfilledOrder({ user, product, paymentIntent: 'pi_refund_me' });

    const res = await deliver({
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_refund_me' } }
    });

    expect(res.status).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('REFUNDED');
    expect(await countKeys(product.id, 'REVOKED')).toBe(1);
    // The revoked key does not go back on sale.
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);
  });

  it('shrugs off a charge belonging to no known order', async () => {
    const res = await deliver({
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_someone_elses_system' } }
    });

    // 200: the Stripe account may be shared with another service, and asking
    // Stripe to retry an event we will never recognise achieves nothing.
    expect(res.status).toBe(200);
  });
});

describe('failure handling', () => {
  it('returns 5xx when handling throws, so Stripe retries', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createReservedOrder({ user, product });

    // Fail the fulfilment transaction itself. Spying on prisma.order would
    // miss it: fulfillOrder does its writes through the transaction client
    // handed to the $transaction callback, not through the base client.
    const spy = vi
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('connection terminated unexpectedly'));

    const res = await deliver(completedEvent(order.id));

    expect(res.status).toBeGreaterThanOrEqual(500);
    // Nothing was half-delivered, and the retry will find the order still
    // PENDING and fulfil it properly.
    expect(await countKeys(product.id, 'SOLD')).toBe(0);

    spy.mockRestore();
  });

  it('ignores event types it does not handle', async () => {
    const res = await deliver({ type: 'customer.subscription.updated', data: { object: {} } });
    expect(res.status).toBe(200);
  });
});

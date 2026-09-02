import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import prisma from '../src/lib/prisma.js';

/**
 * POST /api/checkout/session, end to end through the real Express stack:
 * authentication, validation, the reservation transaction, and the Stripe
 * hand-off. Only the Stripe network call is replaced.
 */

const sessionsCreate = vi.fn();
let stripeConfigured = true;

vi.mock('../src/lib/stripe.js', () => ({
  default: { checkout: { sessions: { create: (...a) => sessionsCreate(...a) } } },
  // A getter, not a value: one test needs the server to behave as though
  // Stripe were never configured, and ESM live bindings re-read this on
  // every access.
  get isStripeConfigured() {
    return stripeConfigured;
  }
}));

const { createApp } = await import('../src/app.js');
const {
  createUser,
  createProduct,
  addToCart,
  authHeader,
  countKeys
} = await import('./helpers/factories.js');

const app = createApp();

beforeEach(() => {
  stripeConfigured = true;
  sessionsCreate.mockReset();
  sessionsCreate.mockResolvedValue({
    id: 'cs_test_abc123',
    url: 'https://checkout.stripe.com/c/pay/cs_test_abc123'
  });
});

describe('POST /api/checkout/session', () => {
  it('rejects an anonymous caller', async () => {
    const res = await request(app).post('/api/checkout/session');
    expect(res.status).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('reserves keys, creates a pending order, and returns the Stripe URL', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 4, price: 24.5 });
    await addToCart(user.id, product.id, 2);

    const res = await request(app).post('/api/checkout/session').set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('checkout.stripe.com');
    expect(res.body.orderId).toBeTruthy();

    const order = await prisma.order.findUnique({
      where: { id: res.body.orderId },
      include: { orderItems: true }
    });
    expect(order.status).toBe('PENDING');
    expect(Number(order.total)).toBe(49);
    expect(order.stripeSessionId).toBe('cs_test_abc123');
    expect(order.orderItems).toHaveLength(1);

    // Two keys held, two still sellable.
    expect(await countKeys(product.id, 'RESERVED')).toBe(2);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(2);
  });

  it('prices the order from the database, ignoring anything the client sends', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1, price: 59.99 });
    await addToCart(user.id, product.id, 1);

    const res = await request(app)
      .post('/api/checkout/session')
      .set(authHeader(user))
      // A hostile client trying to buy a £59.99 game for a penny.
      .send({ total: 0.01, price: 0.01, items: [{ productId: product.id, price: 0.01 }] });

    expect(res.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { id: res.body.orderId } });
    expect(Number(order.total)).toBe(59.99);

    // And the amount handed to Stripe is the real one, in integer cents.
    const [params] = sessionsCreate.mock.calls[0];
    expect(params.line_items[0].price_data.unit_amount).toBe(5999);
  });

  it('holds the reservation longer than the Stripe session lives', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    await addToCart(user.id, product.id, 1);

    await request(app).post('/api/checkout/session').set(authHeader(user));

    const [params] = sessionsCreate.mock.calls[0];
    const sessionExpiresAt = params.expires_at * 1000;

    const key = await prisma.gameKey.findFirst({
      where: { productId: product.id, status: 'RESERVED' }
    });

    // The invariant that stops someone paying for a key already handed back
    // to the pool. If this ever inverts, the store can take money for stock
    // it no longer holds.
    expect(key.reservedUntil.getTime()).toBeGreaterThan(sessionExpiresAt);
  });

  it('refuses an empty cart', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/checkout/session').set(authHeader(user));

    expect(res.status).toBe(400);
    expect(await prisma.order.count()).toBe(0);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when the cart asks for more keys than exist', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    await addToCart(user.id, product.id, 3);

    const res = await request(app).post('/api/checkout/session').set(authHeader(user));

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/not enough keys/i);
    // No half-built order, and the single key is still on the shelf.
    expect(await prisma.order.count()).toBe(0);
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);
  });

  it('will not sell a deactivated product', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 2, isActive: false });
    await addToCart(user.id, product.id, 1);

    const res = await request(app).post('/api/checkout/session').set(authHeader(user));

    expect(res.status).toBe(400);
    expect(await countKeys(product.id, 'RESERVED')).toBe(0);
  });

  it('leaves the cart intact so an abandoned checkout can be resumed', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 2 });
    await addToCart(user.id, product.id, 1);

    await request(app).post('/api/checkout/session').set(authHeader(user));

    // Cleared at fulfilment, not at session creation.
    expect(await prisma.cartItem.count({ where: { userId: user.id } })).toBe(1);
  });

  it('degrades to 503 rather than erroring when payments are not configured', async () => {
    stripeConfigured = false;

    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    await addToCart(user.id, product.id, 1);

    const res = await request(app).post('/api/checkout/session').set(authHeader(user));

    expect(res.status).toBe(503);
    // Nothing was reserved, so the rest of the store keeps working normally.
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(1);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe('GET /api/checkout/by-session/:sessionId', () => {
  it('returns the caller\'s own order', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    await addToCart(user.id, product.id, 1);

    await request(app).post('/api/checkout/session').set(authHeader(user));

    const res = await request(app)
      .get('/api/checkout/by-session/cs_test_abc123')
      .set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('PENDING');
    // Keys are only attached once SOLD, so nothing leaks before payment.
    expect(res.body.order.orderItems[0].gameKeys).toEqual([]);
  });

  it('does not let one customer read another customer\'s order', async () => {
    const buyer = await createUser();
    const snooper = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    await addToCart(buyer.id, product.id, 1);

    await request(app).post('/api/checkout/session').set(authHeader(buyer));

    const res = await request(app)
      .get('/api/checkout/by-session/cs_test_abc123')
      .set(authHeader(snooper));

    // 404, not 403: confirming the session exists would itself leak something.
    expect(res.status).toBe(404);
  });

  it('never mutates state - fulfilment belongs to the webhook', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    await addToCart(user.id, product.id, 1);
    await request(app).post('/api/checkout/session').set(authHeader(user));

    await request(app).get('/api/checkout/by-session/cs_test_abc123').set(authHeader(user));

    // Polling the success page must not deliver keys. If it did, a customer
    // who never loaded it would never be fulfilled.
    expect(await countKeys(product.id, 'SOLD')).toBe(0);
    expect(await countKeys(product.id, 'RESERVED')).toBe(1);
  });
});

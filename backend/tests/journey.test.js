import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import prisma from '../src/lib/prisma.js';

/**
 * The whole journey, through HTTP, in one test.
 *
 * Every other file here checks one seam. This one checks that the seams line
 * up: a real person registers, finds a game, buys it, receives a redeemable
 * code, and is later refunded - each step through the actual Express stack,
 * with only Stripe's network calls replaced.
 *
 * It is the test that would catch the class of bug where every unit passes
 * and the product still does not work.
 */

const sessionsCreate = vi.fn();
const constructEvent = vi.fn();
const refundsCreate = vi.fn();

vi.mock('../src/lib/stripe.js', () => ({
  default: {
    checkout: { sessions: { create: (...a) => sessionsCreate(...a) } },
    webhooks: { constructEvent: (...a) => constructEvent(...a) },
    refunds: { create: (...a) => refundsCreate(...a) }
  },
  isStripeConfigured: true
}));

const { createApp } = await import('../src/app.js');
const { createAdmin, createCategory, authHeader, countKeys } = await import(
  './helpers/factories.js'
);

const app = createApp();

const ORIGINAL_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
afterAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_SECRET;
});

beforeEach(() => {
  sessionsCreate.mockReset().mockResolvedValue({
    id: 'cs_journey_1',
    url: 'https://checkout.stripe.com/c/pay/cs_journey_1'
  });
  constructEvent.mockReset();
  refundsCreate.mockReset().mockResolvedValue({ id: 're_journey_1', status: 'succeeded' });
});

describe('a customer buys a game key', () => {
  it('goes from signup to a redeemable code, then to a refund', async () => {
    // ---------------------------------------------------------------------
    // An admin stocks the store
    // ---------------------------------------------------------------------
    const admin = await createAdmin();
    const category = await createCategory({ name: 'Action' });

    const created = await request(app)
      .post('/api/products')
      .set(authHeader(admin))
      .send({
        name: 'Hollow Knight: Silksong',
        slug: 'hollow-knight-silksong',
        description: 'Finally.',
        price: 29.99,
        categoryId: category.id,
        platform: 'STEAM',
        region: 'GLOBAL',
        images: ['https://example.com/silksong.jpg']
      });

    expect(created.status).toBe(201);
    const productId = (created.body.product ?? created.body).id;
    expect(productId).toBeTruthy();

    // A brand new product has no keys, so it is not yet buyable.
    const beforeStock = await request(app).get(`/api/products/${productId}`);
    const beforeProduct = beforeStock.body.product ?? beforeStock.body;
    expect(beforeProduct.stock ?? 0).toBe(0);

    const uploaded = await request(app)
      .post('/api/keys/bulk')
      .set(authHeader(admin))
      .send({
        productId,
        codes: ['SILK-AAAAA-11111', 'SILK-BBBBB-22222', '  ', 'SILK-AAAAA-11111']
      });

    expect(uploaded.status).toBe(201);
    // Two usable codes: the blank is dropped and the repeat de-duplicated.
    expect(uploaded.body.added).toBe(2);

    // ---------------------------------------------------------------------
    // A customer signs up and shops
    // ---------------------------------------------------------------------
    const signup = await request(app)
      .post('/api/auth/register')
      .send({ email: 'shopper@example.com', password: 'a-good-password', firstName: 'Sam' });

    expect(signup.status).toBe(201);
    const shopper = { Authorization: `Bearer ${signup.body.token}` };

    const browse = await request(app).get('/api/products').query({ search: 'Silksong' });
    expect(browse.status).toBe(200);
    expect(browse.body.products.length).toBeGreaterThan(0);
    expect(browse.body.products[0].stock).toBe(2);

    const added = await request(app)
      .post('/api/cart/add')
      .set(shopper)
      .send({ productId, quantity: 1 });
    expect(added.status).toBe(201);

    // ---------------------------------------------------------------------
    // Checkout: a key is held, but nothing is delivered yet
    // ---------------------------------------------------------------------
    const checkout = await request(app).post('/api/checkout/session').set(shopper);

    expect(checkout.status).toBe(200);
    expect(checkout.body.url).toContain('checkout.stripe.com');
    const orderId = checkout.body.orderId;

    expect(await countKeys(productId, 'RESERVED')).toBe(1);
    expect(await countKeys(productId, 'AVAILABLE')).toBe(1);
    expect(await countKeys(productId, 'SOLD')).toBe(0);

    // The customer has no keys yet - they have not paid.
    const beforePayment = await request(app).get('/api/keys/mine').set(shopper);
    expect(beforePayment.body.keyCount).toBe(0);

    // ---------------------------------------------------------------------
    // Stripe confirms payment
    // ---------------------------------------------------------------------
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_journey_1',
          payment_status: 'paid',
          payment_intent: 'pi_journey_1',
          metadata: { orderId }
        }
      }
    });

    const webhook = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 't=1,v1=fake')
      .set('Content-Type', 'application/json')
      .send({ raw: 'bytes' });

    expect(webhook.status).toBe(200);

    // ---------------------------------------------------------------------
    // The customer has a redeemable code
    // ---------------------------------------------------------------------
    const myKeys = await request(app).get('/api/keys/mine').set(shopper);

    expect(myKeys.status).toBe(200);
    expect(myKeys.body.keyCount).toBe(1);
    expect(myKeys.body.orders[0].keys[0].code).toMatch(/^SILK-/);
    expect(myKeys.body.orders[0].keys[0].product.name).toBe('Hollow Knight: Silksong');

    // The basket was cleared by fulfilment, not by starting checkout.
    const cart = await request(app).get('/api/cart').set(shopper);
    expect(cart.body.items ?? []).toHaveLength(0);

    // Stock reflects the sale.
    const afterSale = await request(app).get(`/api/products/${productId}`);
    expect((afterSale.body.product ?? afterSale.body).stock).toBe(1);

    // ---------------------------------------------------------------------
    // Support refunds the order
    // ---------------------------------------------------------------------
    const refunded = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader(admin))
      .send({ status: 'REFUNDED' });

    expect(refunded.status).toBe(200);
    expect(refundsCreate).toHaveBeenCalledOnce();
    expect(refundsCreate.mock.calls[0][0].payment_intent).toBe('pi_journey_1');

    const finalOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(finalOrder.status).toBe('REFUNDED');

    // The key is revoked, not returned to stock: the customer has already
    // seen the code, so it can never be sold to anyone else.
    expect(await countKeys(productId, 'REVOKED')).toBe(1);
    const afterRefund = await request(app).get(`/api/products/${productId}`);
    expect((afterRefund.body.product ?? afterRefund.body).stock).toBe(1);
  });

  it('an abandoned checkout puts the key back for the next customer', async () => {
    const admin = await createAdmin();
    const category = await createCategory();

    const created = await request(app).post('/api/products').set(authHeader(admin)).send({
      name: 'Last Copy',
      slug: 'last-copy',
      description: 'Only one left.',
      price: 9.99,
      categoryId: category.id,
      platform: 'STEAM',
      region: 'GLOBAL',
      images: []
    });
    const productId = (created.body.product ?? created.body).id;

    await request(app)
      .post('/api/keys/bulk')
      .set(authHeader(admin))
      .send({ productId, codes: ['ONLY-ONE-KEY'] });

    // First shopper reserves the only key.
    const first = await request(app)
      .post('/api/auth/register')
      .send({ email: 'first@example.com', password: 'password123' });
    const firstAuth = { Authorization: `Bearer ${first.body.token}` };

    await request(app).post('/api/cart/add').set(firstAuth).send({ productId, quantity: 1 });
    const firstCheckout = await request(app).post('/api/checkout/session').set(firstAuth);
    expect(firstCheckout.status).toBe(200);

    // Second shopper finds it sold out. Note where they are stopped: at
    // add-to-cart, because stock is the count of AVAILABLE keys and the only
    // one is held. Failing here rather than at checkout is the kinder
    // behaviour - nobody reaches a payment page for something they cannot buy.
    const second = await request(app)
      .post('/api/auth/register')
      .send({ email: 'second@example.com', password: 'password123' });
    const secondAuth = { Authorization: `Bearer ${second.body.token}` };

    const blocked = await request(app)
      .post('/api/cart/add')
      .set(secondAuth)
      .send({ productId, quantity: 1 });
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/insufficient stock/i);

    // The first shopper's session expires.
    constructEvent.mockReturnValue({
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_journey_1', metadata: { orderId: firstCheckout.body.orderId } } }
    });
    await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 't=1,v1=fake')
      .send({ raw: 'bytes' });

    // And now the second shopper can buy it.
    sessionsCreate.mockResolvedValue({
      id: 'cs_journey_2',
      url: 'https://checkout.stripe.com/c/pay/cs_journey_2'
    });

    const nowInStock = await request(app)
      .post('/api/cart/add')
      .set(secondAuth)
      .send({ productId, quantity: 1 });
    expect(nowInStock.status).toBe(201);

    const retry = await request(app).post('/api/checkout/session').set(secondAuth);
    expect(retry.status).toBe(200);
    expect(await countKeys(productId, 'RESERVED')).toBe(1);
  });
});

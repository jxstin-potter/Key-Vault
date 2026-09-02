import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import {
  createUser,
  createAdmin,
  createProduct,
  createReservedOrder,
  createFulfilledOrder,
  authHeader
} from './helpers/factories.js';

/**
 * Admin analytics.
 *
 * The thing worth testing here is not the arithmetic - it is which orders
 * count. An order row exists from the moment someone clicks Checkout, long
 * before any money moves, and it survives being abandoned, failing, and being
 * refunded. Summing `total` across every row answers a question nobody asked
 * and inflates the number the store owner most wants to trust.
 */

const app = createApp();

/** An abandoned checkout: order created, keys held, never paid. */
const abandoned = async (product) =>
  createReservedOrder({ user: await createUser(), product });

/** A completed sale. */
const sold = async (product, paymentIntent = null) =>
  createFulfilledOrder({ user: await createUser(), product, paymentIntent });

describe('GET /api/analytics/overview', () => {
  it('counts only money that actually arrived', async () => {
    const admin = await createAdmin();
    const product = await createProduct({ availableKeys: 10, price: 100 });

    await sold(product); // +100, real
    await sold(product); // +100, real
    await abandoned(product); // never paid
    await abandoned(product); // never paid

    const res = await request(app).get('/api/analytics/overview').set(authHeader(admin));

    expect(res.status).toBe(200);
    // Two real sales at 100. The two abandoned checkouts are not revenue -
    // nobody paid, and counting them would report 400.
    expect(Number(res.body.overview.totalRevenue)).toBe(200);
  });

  it('excludes cancelled and failed orders from revenue', async () => {
    const admin = await createAdmin();
    const product = await createProduct({ availableKeys: 10, price: 50 });

    await sold(product);
    const { order: cancelled } = await abandoned(product);
    const { order: failed } = await abandoned(product);

    await prisma.order.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } });
    await prisma.order.update({ where: { id: failed.id }, data: { status: 'FAILED' } });

    const res = await request(app).get('/api/analytics/overview').set(authHeader(admin));

    expect(Number(res.body.overview.totalRevenue)).toBe(50);
  });

  it('removes a refunded order from revenue', async () => {
    const admin = await createAdmin();
    const product = await createProduct({ availableKeys: 10, price: 75 });

    await sold(product);
    const { order } = await sold(product);

    const before = await request(app).get('/api/analytics/overview').set(authHeader(admin));
    expect(Number(before.body.overview.totalRevenue)).toBe(150);

    // Money given back is not money earned. Before refunds did anything, this
    // could not be observed; now that they work, it can.
    await prisma.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });

    const after = await request(app).get('/api/analytics/overview').set(authHeader(admin));
    expect(Number(after.body.overview.totalRevenue)).toBe(75);
  });

  it('still reports every order status in the breakdown', async () => {
    const admin = await createAdmin();
    const product = await createProduct({ availableKeys: 10, price: 10 });

    await sold(product);
    await abandoned(product);

    const res = await request(app).get('/api/analytics/overview').set(authHeader(admin));

    // Filtering revenue must not blind the operator to pending or failed
    // orders - that breakdown is exactly where you notice a broken webhook.
    expect(res.body.overview.orderStatuses.COMPLETED).toBe(1);
    expect(res.body.overview.orderStatuses.PENDING).toBe(1);
  });

  it('does not count abandoned checkouts as best sellers', async () => {
    const admin = await createAdmin();
    const bought = await createProduct({ availableKeys: 10, price: 20, name: 'Actually Sold' });
    const browsed = await createProduct({ availableKeys: 10, price: 20, name: 'Only Abandoned' });

    await sold(bought);
    // Three people put it in a basket and never paid.
    await abandoned(browsed);
    await abandoned(browsed);
    await abandoned(browsed);

    const res = await request(app).get('/api/analytics/overview').set(authHeader(admin));
    const top = res.body.overview.topProducts.map((p) => p.name);

    expect(top).toContain('Actually Sold');
    expect(top).not.toContain('Only Abandoned');
  });

  it('reports zeroes on an empty store rather than failing', async () => {
    const admin = await createAdmin();

    const res = await request(app).get('/api/analytics/overview').set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(Number(res.body.overview.totalRevenue)).toBe(0);
    expect(res.body.overview.totalOrders).toBe(0);
    expect(res.body.overview.revenueGrowth).toBe(0);
  });

  it('is admin-only', async () => {
    const user = await createUser();
    expect((await request(app).get('/api/analytics/overview').set(authHeader(user))).status).toBe(403);
    expect((await request(app).get('/api/analytics/overview')).status).toBe(401);
  });
});

describe('the other analytics endpoints apply the same revenue rule', () => {
  it('/sales counts only paid orders', async () => {
    const admin = await createAdmin();
    const product = await createProduct({ availableKeys: 10, price: 30 });

    await sold(product);
    await abandoned(product);
    await abandoned(product);

    const res = await request(app).get('/api/analytics/sales').set(authHeader(admin));

    expect(res.status).toBe(200);
    // This endpoint also backs the CSV export an operator would hand to an
    // accountant, so it must not report three sales where there was one.
    const row = res.body.sales.productSales.find((r) => r.productId === product.id);
    expect(row.quantity).toBe(1);
  });

  it('/products ranks on units actually sold', async () => {
    const admin = await createAdmin();
    const product = await createProduct({ availableKeys: 10, price: 30 });

    await sold(product);
    await abandoned(product);

    const res = await request(app).get('/api/analytics/products').set(authHeader(admin));
    expect(res.status).toBe(200);

    const row = res.body.products.productPerformance.find((p) => p.id === product.id);
    expect(row.totalSold).toBe(1);
    expect(row.orderCount).toBe(1);
  });

  it('/users attributes spend only to customers who paid', async () => {
    const admin = await createAdmin();
    const product = await createProduct({ availableKeys: 10, price: 40 });

    await sold(product);
    await abandoned(product);

    const res = await request(app).get('/api/analytics/users').set(authHeader(admin));
    expect(res.status).toBe(200);

    const spends = JSON.stringify(res.body);
    // The abandoned basket must not have created a second spending customer.
    expect(spends).not.toContain('"totalSpent":80');
  });
});

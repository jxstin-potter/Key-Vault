import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import {
  createUser,
  createAdmin,
  createCategory,
  createProduct,
  createKeys,
  authHeader
} from './helpers/factories.js';

/**
 * The catalogue: browsing, filtering, and - the part that matters here - how
 * stock is reported.
 *
 * Stock is never stored. Every product's availability is the count of its
 * AVAILABLE game keys, computed per request. These tests pin that down,
 * because the moment someone "optimises" it into a cached integer column, the
 * overselling problem the reservation system exists to prevent comes straight
 * back in a new form.
 */

const app = createApp();

describe('GET /api/products', () => {
  it('derives stock from available keys, not from a stored column', async () => {
    const product = await createProduct({ availableKeys: 7 });

    const res = await request(app).get('/api/products');
    const listed = res.body.products.find((p) => p.id === product.id);

    expect(res.status).toBe(200);
    expect(listed.stock).toBe(7);
    // There is deliberately no stock column to fall out of sync.
    expect(Object.keys(product)).not.toContain('stock');
  });

  it('excludes reserved and sold keys from stock', async () => {
    const product = await createProduct({ availableKeys: 5 });
    const keys = await prisma.gameKey.findMany({ where: { productId: product.id }, take: 3 });

    await prisma.gameKey.update({ where: { id: keys[0].id }, data: { status: 'RESERVED' } });
    await prisma.gameKey.update({ where: { id: keys[1].id }, data: { status: 'SOLD' } });
    await prisma.gameKey.update({ where: { id: keys[2].id }, data: { status: 'REVOKED' } });

    const res = await request(app).get('/api/products');
    const listed = res.body.products.find((p) => p.id === product.id);

    expect(listed.stock).toBe(2);
  });

  it('reports zero stock rather than hiding a sold-out product', async () => {
    const product = await createProduct({ availableKeys: 0 });

    const res = await request(app).get('/api/products');
    const listed = res.body.products.find((p) => p.id === product.id);

    // Sold-out games stay browsable - that is how a shopper knows to come
    // back, and how the page can offer a restock notice later.
    expect(listed).toBeDefined();
    expect(listed.stock).toBe(0);
  });

  it('filters by platform', async () => {
    const steam = await createProduct({ availableKeys: 1, platform: 'STEAM' });
    await createProduct({ availableKeys: 1, platform: 'EPIC' });

    const res = await request(app).get('/api/products').query({ platform: 'STEAM' });

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe(steam.id);
  });

  it('filters by category', async () => {
    const rpg = await createCategory({ name: 'RPG' });
    const strategy = await createCategory({ name: 'Strategy' });
    const target = await createProduct({ availableKeys: 1, categoryId: rpg.id });
    await createProduct({ availableKeys: 1, categoryId: strategy.id });

    const res = await request(app).get('/api/products').query({ category: rpg.id });

    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe(target.id);
  });

  it('searches by name', async () => {
    await createProduct({ availableKeys: 1, name: 'Stardew Valley' });
    await createProduct({ availableKeys: 1, name: 'Factorio' });

    const res = await request(app).get('/api/products').query({ search: 'stardew' });

    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Stardew Valley');
  });

  it('paginates', async () => {
    const category = await createCategory();
    for (let i = 0; i < 5; i++) {
      await createProduct({ availableKeys: 1, categoryId: category.id, name: `Game ${i}` });
    }

    const res = await request(app).get('/api/products').query({ page: 1, limit: 2 });

    expect(res.body.products).toHaveLength(2);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.pages).toBe(3);
  });

  it('hides deactivated products from shoppers', async () => {
    await createProduct({ availableKeys: 1, isActive: false, name: 'Delisted' });

    const res = await request(app).get('/api/products');

    expect(res.body.products.find((p) => p.name === 'Delisted')).toBeUndefined();
  });
});

describe('GET /api/products/:id', () => {
  it('finds a product by id', async () => {
    const product = await createProduct({ availableKeys: 2 });

    const res = await request(app).get(`/api/products/${product.id}`);
    const body = res.body.product ?? res.body;

    expect(res.status).toBe(200);
    expect(body.id).toBe(product.id);
    expect(body.stock).toBe(2);
  });

  it('finds a product by slug, so URLs can be readable', async () => {
    const product = await createProduct({ availableKeys: 1, name: 'Slug Game' });

    const res = await request(app).get(`/api/products/${product.slug}`);
    const body = res.body.product ?? res.body;

    expect(res.status).toBe(200);
    expect(body.id).toBe(product.id);
  });

  it('404s for an unknown product', async () => {
    const res = await request(app).get('/api/products/no-such-product');
    expect(res.status).toBe(404);
  });
});

describe('admin catalogue management', () => {
  it('creates a product with no stock until keys are uploaded', async () => {
    const admin = await createAdmin();
    const category = await createCategory();

    const created = await request(app).post('/api/products').set(authHeader(admin)).send({
      name: 'Fresh Listing',
      slug: 'fresh-listing',
      description: 'Newly listed.',
      price: 12.5,
      categoryId: category.id,
      platform: 'GOG',
      region: 'EU',
      images: []
    });

    expect(created.status).toBe(201);
    const productId = (created.body.product ?? created.body).id;

    const fetched = await request(app).get(`/api/products/${productId}`);
    expect((fetched.body.product ?? fetched.body).stock).toBe(0);

    await createKeys(productId, 3);

    const restocked = await request(app).get(`/api/products/${productId}`);
    expect((restocked.body.product ?? restocked.body).stock).toBe(3);
  });

  it('rejects a product in a category that does not exist', async () => {
    const admin = await createAdmin();

    const res = await request(app).post('/api/products').set(authHeader(admin)).send({
      name: 'Orphan',
      slug: 'orphan',
      description: 'No category.',
      price: 5,
      categoryId: 'nonexistent-category',
      platform: 'STEAM',
      region: 'GLOBAL',
      images: []
    });

    expect(res.status).toBe(400);
  });

  it('validates the price', async () => {
    const admin = await createAdmin();
    const category = await createCategory();

    const res = await request(app).post('/api/products').set(authHeader(admin)).send({
      name: 'Negative',
      slug: 'negative',
      description: 'Costs less than nothing.',
      price: -10,
      categoryId: category.id,
      platform: 'STEAM',
      region: 'GLOBAL',
      images: []
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/categories', () => {
  it('lists categories', async () => {
    await createCategory({ name: 'Action' });
    await createCategory({ name: 'Puzzle' });

    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);

    const list = res.body.categories ?? res.body;
    expect(list).toHaveLength(2);
  });

  it('is readable without signing in', async () => {
    await createCategory({ name: 'Public' });
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
  });
});

describe('cart stock rules', () => {
  it('will not let a shopper add more than the available keys', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 2 });

    const res = await request(app)
      .post('/api/cart/add')
      .set(authHeader(user))
      .send({ productId: product.id, quantity: 3 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  it('counts what is already in the basket when adding more', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 2 });

    await request(app)
      .post('/api/cart/add')
      .set(authHeader(user))
      .send({ productId: product.id, quantity: 2 });

    // Two already held in the basket; a third would exceed stock.
    const res = await request(app)
      .post('/api/cart/add')
      .set(authHeader(user))
      .send({ productId: product.id, quantity: 1 });

    expect(res.status).toBe(400);
    expect(await prisma.cartItem.count({ where: { userId: user.id } })).toBe(1);
  });

  it('refuses an unavailable product', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 5, isActive: false });

    const res = await request(app)
      .post('/api/cart/add')
      .set(authHeader(user))
      .send({ productId: product.id, quantity: 1 });

    expect(res.status).toBe(404);
  });
});

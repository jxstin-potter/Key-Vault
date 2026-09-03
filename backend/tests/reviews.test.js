import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { createUser, createAdmin, createProduct, authHeader } from './helpers/factories.js';

/**
 * Reviews, and the denormalised rating aggregate.
 *
 * Product.averageRating and Product.reviewCount are cached copies of something
 * derivable from the reviews table. That is a deliberate trade - the catalogue
 * would otherwise aggregate reviews on every page render - but denormalised
 * data is only worth having while it is true. Every test that changes a review
 * therefore re-derives the average from the source rows and asserts the cached
 * copy still agrees.
 */

const app = createApp();

/** Recompute the aggregate from the reviews table and compare it to the cache. */
async function expectRatingConsistent(productId) {
  const [product, reviews] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { averageRating: true, reviewCount: true }
    }),
    prisma.review.findMany({ where: { productId }, select: { rating: true } })
  ]);

  const expectedCount = reviews.length;
  const expectedAverage =
    expectedCount === 0 ? 0 : reviews.reduce((sum, r) => sum + r.rating, 0) / expectedCount;

  expect(product.reviewCount).toBe(expectedCount);
  expect(product.averageRating).toBeCloseTo(expectedAverage, 1);
  return product;
}

describe('POST /api/reviews', () => {
  it('creates a review and refreshes the cached rating', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });

    const res = await request(app)
      .post('/api/reviews')
      .set(authHeader(user))
      .send({ productId: product.id, rating: 4, comment: 'Solid.' });

    expect(res.status).toBe(201);

    const updated = await expectRatingConsistent(product.id);
    expect(updated.averageRating).toBeCloseTo(4, 1);
    expect(updated.reviewCount).toBe(1);
  });

  it('averages several reviews', async () => {
    const product = await createProduct({ availableKeys: 1 });

    for (const rating of [5, 4, 3]) {
      const user = await createUser();
      await request(app)
        .post('/api/reviews')
        .set(authHeader(user))
        .send({ productId: product.id, rating });
    }

    const updated = await expectRatingConsistent(product.id);
    expect(updated.averageRating).toBeCloseTo(4, 1);
    expect(updated.reviewCount).toBe(3);
  });

  it('allows only one review per customer per product', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });

    const first = await request(app)
      .post('/api/reviews')
      .set(authHeader(user))
      .send({ productId: product.id, rating: 5 });
    const second = await request(app)
      .post('/api/reviews')
      .set(authHeader(user))
      .send({ productId: product.id, rating: 1 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(400);

    // The second attempt must not have moved the average.
    const updated = await expectRatingConsistent(product.id);
    expect(updated.reviewCount).toBe(1);
    expect(updated.averageRating).toBeCloseTo(5, 1);
  });

  it('rejects ratings outside 1-5', async () => {
    const product = await createProduct({ availableKeys: 1 });

    for (const rating of [0, 6, -1, 2.5]) {
      const user = await createUser();
      const res = await request(app)
        .post('/api/reviews')
        .set(authHeader(user))
        .send({ productId: product.id, rating });
      expect(res.status).toBe(400);
    }

    const product2 = await prisma.product.findUnique({ where: { id: product.id } });
    expect(product2.reviewCount).toBe(0);
  });

  it('requires signing in', async () => {
    const product = await createProduct({ availableKeys: 1 });
    const res = await request(app).post('/api/reviews').send({ productId: product.id, rating: 5 });
    expect(res.status).toBe(401);
  });

  it('404s for a product that does not exist', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/reviews')
      .set(authHeader(user))
      .send({ productId: 'no-such-product', rating: 5 });
    expect(res.status).toBe(404);
  });
});

describe('editing and deleting reviews', () => {
  it('recalculates the average when a review is edited', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });

    const created = await request(app)
      .post('/api/reviews')
      .set(authHeader(user))
      .send({ productId: product.id, rating: 1, comment: 'Broken on launch.' });

    const reviewId = (created.body.review ?? created.body).id;

    const updated = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set(authHeader(user))
      .send({ rating: 5, comment: 'Patched. Excellent now.' });

    expect(updated.status).toBe(200);

    const product2 = await expectRatingConsistent(product.id);
    expect(product2.averageRating).toBeCloseTo(5, 1);
    expect(product2.reviewCount).toBe(1);
  });

  it('recalculates when a review is deleted', async () => {
    const product = await createProduct({ availableKeys: 1 });
    const alice = await createUser();
    const bob = await createUser();

    const aliceReview = await request(app)
      .post('/api/reviews')
      .set(authHeader(alice))
      .send({ productId: product.id, rating: 1 });
    await request(app)
      .post('/api/reviews')
      .set(authHeader(bob))
      .send({ productId: product.id, rating: 5 });

    await expectRatingConsistent(product.id);

    const reviewId = (aliceReview.body.review ?? aliceReview.body).id;
    const deleted = await request(app).delete(`/api/reviews/${reviewId}`).set(authHeader(alice));

    expect(deleted.status).toBe(200);

    const product2 = await expectRatingConsistent(product.id);
    expect(product2.reviewCount).toBe(1);
    expect(product2.averageRating).toBeCloseTo(5, 1);
  });

  it('resets the rating to zero when the last review goes', async () => {
    const user = await createUser();
    const product = await createProduct({ availableKeys: 1 });

    const created = await request(app)
      .post('/api/reviews')
      .set(authHeader(user))
      .send({ productId: product.id, rating: 4 });

    const reviewId = (created.body.review ?? created.body).id;
    await request(app).delete(`/api/reviews/${reviewId}`).set(authHeader(user));

    const product2 = await expectRatingConsistent(product.id);
    expect(product2.reviewCount).toBe(0);
    expect(product2.averageRating).toBe(0);
  });

  it('does not let one customer edit another\'s review', async () => {
    const author = await createUser();
    const stranger = await createUser();
    const product = await createProduct({ availableKeys: 1 });

    const created = await request(app)
      .post('/api/reviews')
      .set(authHeader(author))
      .send({ productId: product.id, rating: 5 });
    const reviewId = (created.body.review ?? created.body).id;

    const res = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set(authHeader(stranger))
      .send({ rating: 1 });

    expect([403, 404]).toContain(res.status);

    const unchanged = await prisma.review.findUnique({ where: { id: reviewId } });
    expect(unchanged.rating).toBe(5);
  });

  it('lets an admin remove a review', async () => {
    const author = await createUser();
    const admin = await createAdmin();
    const product = await createProduct({ availableKeys: 1 });

    const created = await request(app)
      .post('/api/reviews')
      .set(authHeader(author))
      .send({ productId: product.id, rating: 1, comment: 'abusive content' });
    const reviewId = (created.body.review ?? created.body).id;

    const res = await request(app).delete(`/api/reviews/${reviewId}`).set(authHeader(admin));

    expect(res.status).toBe(200);
    await expectRatingConsistent(product.id);
  });
});

describe('GET /api/reviews/product/:productId', () => {
  it('lists reviews without exposing reviewer emails', async () => {
    const user = await createUser({ email: 'reviewer@example.com' });
    const product = await createProduct({ availableKeys: 1 });

    await request(app)
      .post('/api/reviews')
      .set(authHeader(user))
      .send({ productId: product.id, rating: 5, comment: 'Great.' });

    const res = await request(app).get(`/api/reviews/product/${product.id}`);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('reviewer@example.com');
  });

  it('is readable without signing in', async () => {
    const product = await createProduct({ availableKeys: 1 });
    const res = await request(app).get(`/api/reviews/product/${product.id}`);
    expect(res.status).toBe(200);
  });
});

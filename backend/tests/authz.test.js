import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import {
  createUser,
  createAdmin,
  createProduct,
  createCategory,
  createFulfilledOrder,
  authHeader,
  tokenFor
} from './helpers/factories.js';

/**
 * Authentication and authorisation boundaries.
 *
 * These are the tests that matter most in a system holding both money and
 * redeemable codes. The interesting failure is never "an admin route rejected
 * an admin" - it is a customer reading someone else's key, or an ordinary
 * account reaching an admin route because a guard was attached to the router
 * but forgotten on one handler. So the table below is exhaustive by design:
 * every admin-only endpoint, checked as an anonymous caller and as a
 * logged-in non-admin.
 */

const app = createApp();

const ADMIN_ONLY = [
  ['get', '/api/keys/inventory'],
  ['get', '/api/keys/product/some-id'],
  ['post', '/api/keys/bulk'],
  ['delete', '/api/keys/some-id'],
  ['get', '/api/users'],
  ['get', '/api/users/some-id'],
  ['put', '/api/users/some-id/role'],
  ['get', '/api/analytics/overview'],
  ['get', '/api/analytics/sales'],
  ['get', '/api/analytics/users'],
  ['get', '/api/analytics/products'],
  ['post', '/api/products'],
  ['put', '/api/products/some-id'],
  ['delete', '/api/products/some-id'],
  ['delete', '/api/products/bulk'],
  ['post', '/api/categories'],
  ['put', '/api/categories/some-id'],
  ['delete', '/api/categories/some-id']
];

describe('admin-only endpoints', () => {
  it.each(ADMIN_ONLY)('rejects an anonymous caller: %s %s', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
  });

  it.each(ADMIN_ONLY)('rejects a signed-in customer: %s %s', async (method, path) => {
    const user = await createUser();
    const res = await request(app)[method](path).set(authHeader(user)).send({});
    expect(res.status).toBe(403);
  });

  it('admits a genuine admin', async () => {
    const admin = await createAdmin();
    const res = await request(app).get('/api/keys/inventory').set(authHeader(admin));
    expect(res.status).toBe(200);
  });
});

describe('token handling', () => {
  it('rejects a token signed with the wrong secret', async () => {
    const user = await createUser();
    const forged = jwt.sign({ userId: user.id }, 'not-the-real-secret');

    const res = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${forged}` });
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const user = await createUser();
    const expired = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '-1h' });

    const res = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${expired}` });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('rejects a valid token for a deleted account', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await prisma.user.delete({ where: { id: user.id } });

    // The signature is still good, so this only fails if the middleware
    // actually re-checks the database rather than trusting the payload.
    const res = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
  });

  it('does not take the role from the token payload', async () => {
    const user = await createUser({ role: 'USER' });
    // A forged claim, correctly signed. Role must come from the database row.
    const escalated = jwt.sign({ userId: user.id, role: 'ADMIN' }, process.env.JWT_SECRET);

    const res = await request(app)
      .get('/api/users')
      .set({ Authorization: `Bearer ${escalated}` });

    expect(res.status).toBe(403);
  });

  it('rejects a malformed authorization header', async () => {
    for (const header of ['Bearer', 'Bearer ', 'Basic abc', 'garbage']) {
      const res = await request(app).get('/api/auth/me').set({ Authorization: header });
      expect(res.status).toBe(401);
    }
  });
});

describe('per-customer data isolation', () => {
  it('only returns the caller\'s own purchased keys', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const product = await createProduct({ availableKeys: 2 });

    await createFulfilledOrder({ user: alice, product });
    await createFulfilledOrder({ user: bob, product });

    const res = await request(app).get('/api/keys/mine').set(authHeader(bob));

    expect(res.status).toBe(200);
    expect(res.body.keyCount).toBe(1);

    // Alice's code must not appear anywhere in Bob's response.
    const aliceKey = await prisma.gameKey.findFirst({
      where: { orderItem: { order: { userId: alice.id } } }
    });
    expect(JSON.stringify(res.body)).not.toContain(aliceKey.code);
  });

  it('does not let a customer read another customer\'s order', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createFulfilledOrder({ user: alice, product });

    const res = await request(app).get(`/api/orders/${order.id}`).set(authHeader(bob));
    expect(res.status).toBe(404);
  });

  it('lets an admin read any order', async () => {
    const alice = await createUser();
    const admin = await createAdmin();
    const product = await createProduct({ availableKeys: 1 });
    const { order } = await createFulfilledOrder({ user: alice, product });

    const res = await request(app).get(`/api/orders/${order.id}`).set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(order.id);
  });

  it('scopes the order list to the caller', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const product = await createProduct({ availableKeys: 2 });
    await createFulfilledOrder({ user: alice, product });
    await createFulfilledOrder({ user: bob, product });

    const res = await request(app).get('/api/orders').set(authHeader(bob));
    expect(res.status).toBe(200);

    const orders = res.body.orders ?? res.body;
    expect(Array.isArray(orders) ? orders : []).toHaveLength(1);
  });

  it('never returns a password hash', async () => {
    const admin = await createAdmin();
    await createUser({ email: 'victim@example.com' });

    for (const path of ['/api/users', '/api/auth/me']) {
      const res = await request(app).get(path).set(authHeader(admin));
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/); // bcrypt prefix
      expect(JSON.stringify(res.body)).not.toContain('"password"');
    }
  });
});

describe('registration and login', () => {
  it('registers a user and returns a usable token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'hunter2!', firstName: 'New' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();

    const me = await request(app)
      .get('/api/auth/me')
      .set({ Authorization: `Bearer ${res.body.token}` });
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('new@example.com');
  });

  it('always creates new accounts as USER, whatever the client asks for', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sneaky@example.com', password: 'hunter2!', role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('USER');

    const stored = await prisma.user.findUnique({ where: { email: 'sneaky@example.com' } });
    expect(stored.role).toBe('USER');
  });

  it('stores the password hashed, never in the clear', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'hash@example.com', password: 'plaintext-secret' });

    const stored = await prisma.user.findUnique({ where: { email: 'hash@example.com' } });
    expect(stored.password).not.toBe('plaintext-secret');
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    await createUser({ email: 'real@example.com', password: 'correct-horse' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'real@example.com', password: 'wrong' });

    const noSuchUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'wrong' });

    // Differing responses would let an attacker enumerate which emails have
    // accounts before ever trying to guess a password.
    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    expect(wrongPassword.body.message).toBe(noSuchUser.body.message);
  });

  it('rejects a weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@example.com', password: '123' });

    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { email: 'weak@example.com' } })).toBe(0);
  });
});

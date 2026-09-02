import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../src/lib/prisma.js';

/**
 * Test data builders.
 *
 * Every factory takes overrides and fills the rest with something valid, so a
 * test states only the fields it actually cares about. A test that says
 * `createProduct({ availableKeys: 1 })` reads as "a product with one key left",
 * which is the fact under test - the price and the slug are noise.
 */

let sequence = 0;
const uniq = (prefix) => `${prefix}-${Date.now().toString(36)}-${++sequence}`;

/**
 * Wipe every table between tests. CASCADE handles the foreign keys, and
 * listing the tables explicitly (rather than reflecting them) means a new
 * model added to the schema without being added here shows up as a test that
 * leaks state, which is a louder failure than a silently skipped table.
 */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      game_keys, order_items, orders, cart_items, reviews, products, categories, users
    RESTART IDENTITY CASCADE
  `);
}

export async function createUser(overrides = {}) {
  const { password = 'password123', ...rest } = overrides;
  return prisma.user.create({
    data: {
      email: rest.email || `${uniq('user')}@example.com`,
      password: await bcrypt.hash(password, 4), // low cost: these are throwaway
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
      ...rest
    }
  });
}

export const createAdmin = (overrides = {}) => createUser({ role: 'ADMIN', ...overrides });

export async function createCategory(overrides = {}) {
  const name = overrides.name || uniq('Category');
  return prisma.category.create({
    data: { name, slug: name.toLowerCase(), ...overrides }
  });
}

/**
 * A product plus, optionally, a batch of AVAILABLE keys.
 *
 * `availableKeys` is the knob most tests reach for: stock in this system is
 * the count of AVAILABLE key rows, so "a product with 1 key" is literally how
 * you set up an out-of-stock-after-one-sale scenario.
 */
export async function createProduct(overrides = {}) {
  const { availableKeys = 0, categoryId, ...rest } = overrides;

  const category = categoryId ? { id: categoryId } : await createCategory();
  const name = rest.name || uniq('Game');

  const product = await prisma.product.create({
    data: {
      name,
      slug: rest.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: 'A test game.',
      price: rest.price ?? 19.99,
      images: ['https://example.com/cover.jpg'],
      categoryId: category.id,
      ...rest
    }
  });

  if (availableKeys > 0) {
    await createKeys(product.id, availableKeys);
  }

  return product;
}

export async function createKeys(productId, count, status = 'AVAILABLE') {
  await prisma.gameKey.createMany({
    data: Array.from({ length: count }, () => ({
      code: uniq('KEY').toUpperCase(),
      productId,
      status
    }))
  });
  return prisma.gameKey.findMany({ where: { productId, status } });
}

/** A signed token for a user, matching what routes/auth.js issues. */
export function tokenFor(user) {
  return jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

/** Ready-to-spread supertest header. */
export const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

export async function addToCart(userId, productId, quantity = 1) {
  return prisma.cartItem.create({ data: { userId, productId, quantity } });
}

/** Count keys in a given status, the assertion most inventory tests make. */
export const countKeys = (productId, status) =>
  prisma.gameKey.count({ where: { productId, status } });

/**
 * An order that has been paid and fulfilled, as the webhook would leave it.
 * Used by the refund tests, which need a realistic starting point rather than
 * a hand-assembled one.
 */
export async function createFulfilledOrder({ user, product, quantity = 1, paymentIntent = null }) {
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      total: Number(product.price) * quantity,
      status: 'COMPLETED',
      paidAt: new Date(),
      paymentIntent
    }
  });

  const orderItem = await prisma.orderItem.create({
    data: { orderId: order.id, productId: product.id, quantity, price: product.price }
  });

  const available = await prisma.gameKey.findMany({
    where: { productId: product.id, status: 'AVAILABLE' },
    take: quantity
  });

  await prisma.gameKey.updateMany({
    where: { id: { in: available.map((k) => k.id) } },
    data: { status: 'SOLD', orderItemId: orderItem.id, soldAt: new Date() }
  });

  return { order, orderItem };
}

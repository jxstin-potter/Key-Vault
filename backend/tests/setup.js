import { afterAll, beforeEach } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { resetDatabase } from './helpers/factories.js';

/**
 * Per-test isolation.
 *
 * TRUNCATE rather than wrapping each test in a rolled-back transaction: the
 * concurrency tests spawn several genuinely parallel transactions, which
 * cannot happen inside one outer transaction. Truncate is the isolation
 * strategy that does not constrain what the tests are allowed to do, and on
 * tables this small it costs nothing.
 */
beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

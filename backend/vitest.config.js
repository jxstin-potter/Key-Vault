import { defineConfig } from 'vitest/config';

/**
 * Test configuration.
 *
 * These tests run against a REAL PostgreSQL database, not a mock. That is a
 * deliberate and load-bearing choice: the guarantees under test are properties
 * of the database, not of our JavaScript. The reservation logic is correct
 * because a conditional UPDATE under READ COMMITTED re-checks its predicate
 * against the committed row version after blocking on a competing writer. A
 * mocked Prisma client would happily return whatever we told it to and prove
 * nothing at all about overselling.
 */
export default defineConfig({
  test: {
    environment: 'node',

    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],

    // Every file shares one database, so running them in parallel would let
    // one file's truncation wipe another's fixtures mid-assertion. Within a
    // file, tests still run in order and clean up after themselves.
    fileParallelism: false,

    // Concurrency tests deliberately contend on the database and retry with
    // backoff; the default 5s is tight for the heavier ones.
    testTimeout: 30000,
    hookTimeout: 60000,

    env: {
      NODE_ENV: 'test',
      // connection_limit is raised because the concurrency tests deliberately
      // hold ~20 transactions open at once. Prisma's default pool
      // (cpus * 2 + 1) would exhaust and fail with P2024 "timed out fetching a
      // connection" - a harness limitation that looks exactly like the
      // application bug those tests exist to detect.
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        'postgresql://postgres:postgres@127.0.0.1:5432/keyvault_test?connection_limit=30&pool_timeout=20',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      FRONTEND_URL: 'http://localhost:5173',
      LOG_LEVEL: 'silent'
    },

    include: ['tests/**/*.test.js'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      // Seed data and one-off maintenance scripts are not application logic.
      exclude: ['src/seed.js', 'src/server.js', 'src/docs/**']
    }
  }
});

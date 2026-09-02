import { execSync } from 'node:child_process';

/**
 * Runs once before the whole suite: make the test database match the current
 * Prisma schema.
 *
 * `db push` rather than `migrate deploy` on purpose. Tests care that the
 * schema matches schema.prisma right now, not about the history that produced
 * it, and push is both faster and immune to a half-written migration blocking
 * the suite. Migration correctness is a separate concern, checked against a
 * real deploy.
 */
export default async function globalSetup() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5432/keyvault_test';

  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl }
    });
  } catch (error) {
    const detail = error.stderr?.toString() || error.stdout?.toString() || error.message;
    throw new Error(
      `Could not prepare the test database at ${databaseUrl.replace(/:[^:@]*@/, ':***@')}.\n` +
        `Start one with:\n` +
        `  docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name keyvault-test-db postgres:16\n` +
        `  createdb keyvault_test\n\n` +
        detail
    );
  }
}

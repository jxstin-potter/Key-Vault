-- Digital key marketplace.
--
-- This migration records a year of schema changes that were applied with
-- `prisma db push` and never written down: the game_keys table that holds
-- inventory, the Platform/Region/GameKeyStatus enums, Stripe's session and
-- payment-intent columns, category slugs, and the removal of products.stock
-- (stock is now derived from the count of AVAILABLE keys, so a stored counter
-- would only be another thing to fall out of sync).
--
-- Until this existed, `prisma migrate deploy` against a fresh database built
-- the ORIGINAL physical-goods store - a stock column, no game_keys, and an
-- OrderStatus enum with SHIPPED and DELIVERED. Nothing in the deploy would
-- have failed; the application would simply have met a database it did not
-- recognise.
--
-- FOR AN ENVIRONMENT THAT ALREADY HAS THIS SCHEMA (anything provisioned by
-- db push, which includes the existing production database), do not run this
-- migration - every statement would fail on objects that already exist. Mark
-- it as already applied instead:
--
--     npx prisma migrate resolve --applied 20260902000000_digital_key_marketplace
--
-- A brand new database needs nothing special: `prisma migrate deploy` applies
-- both migrations in order.

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('STEAM', 'EPIC', 'GOG', 'XBOX', 'PLAYSTATION', 'BATTLENET', 'UBISOFT', 'NINTENDO');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('GLOBAL', 'NA', 'EU', 'UK', 'ASIA', 'LATAM');

-- CreateEnum
CREATE TYPE "GameKeyStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'REVOKED');

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "tagline" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "stripeSessionId" TEXT,
ALTER COLUMN "shippingAddress" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "stock",
ADD COLUMN     "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "developer" TEXT,
ADD COLUMN     "platform" "Platform" NOT NULL DEFAULT 'STEAM',
ADD COLUMN     "publisher" TEXT,
ADD COLUMN     "region" "Region" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN     "releaseDate" TIMESTAMP(3),
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "game_keys" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "GameKeyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "orderItemId" TEXT,
    "reservedUntil" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_keys_code_key" ON "game_keys"("code");

-- CreateIndex
CREATE INDEX "game_keys_productId_status_idx" ON "game_keys"("productId", "status");

-- CreateIndex
CREATE INDEX "game_keys_status_reservedUntil_idx" ON "game_keys"("status", "reservedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripeSessionId_key" ON "orders"("stripeSessionId");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_platform_idx" ON "products"("platform");

-- CreateIndex
CREATE INDEX "products_region_idx" ON "products"("region");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- AddForeignKey
ALTER TABLE "game_keys" ADD CONSTRAINT "game_keys_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_keys" ADD CONSTRAINT "game_keys_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Drop the legacy shipping address.
--
-- Inherited from when this was a physical-goods store. A digital key is
-- delivered on screen and by nothing else, so the column has been nullable
-- and unreferenced by any code path for the life of the key marketplace.
-- Dropping it rather than leaving it is the point: a nullable column nobody
-- writes is an open invitation for someone to assume it means something.

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "shippingAddress";


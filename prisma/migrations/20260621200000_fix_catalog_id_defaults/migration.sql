-- Fix missing DEFAULT on id columns for catalog tables.
-- The original migration used IF NOT EXISTS (tables were pre-created by Atlas ORM),
-- so DEFAULT gen_random_uuid() was never applied to the existing columns.
-- SET DEFAULT is idempotent and safe regardless of whether a default already exists.

ALTER TABLE "catalog_category"             ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "catalog_product"              ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "catalog_product_option"       ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "catalog_product_option_value" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "catalog_product_variant"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "catalog_stock_movement"       ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

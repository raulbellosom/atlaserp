-- Fix missing DEFAULT NOW() on created_at / updated_at for all catalog tables.
-- The original migration used IF NOT EXISTS (tables were pre-created by Atlas ORM),
-- so DEFAULT NOW() was never applied to the existing columns.
-- SET DEFAULT is idempotent and safe regardless of whether a default already exists.

ALTER TABLE "catalog_category"             ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "catalog_category"             ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "catalog_product"              ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "catalog_product"              ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "catalog_product_option"       ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "catalog_product_option"       ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "catalog_product_option_value" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "catalog_product_option_value" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "catalog_product_variant"      ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "catalog_product_variant"      ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "catalog_stock_movement"       ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "catalog_stock_movement"       ALTER COLUMN "updated_at" SET DEFAULT now();

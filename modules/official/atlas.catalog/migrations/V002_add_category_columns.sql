ALTER TABLE "catalog_category" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
ALTER TABLE "catalog_category" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "catalog_category" ADD COLUMN IF NOT EXISTS "cover_asset_id" UUID;
ALTER TABLE "catalog_category" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "catalog_category" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;

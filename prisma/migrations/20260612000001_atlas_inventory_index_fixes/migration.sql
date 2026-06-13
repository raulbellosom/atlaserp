-- Migration: 20260612000001_atlas_inventory_index_fixes
-- Fixes 6 schema quality issues in atlas.inventory models

-- Fix 1: Replace bare status index with company-scoped composite index on inv_item
DROP INDEX IF EXISTS "inv_item_status_idx";
CREATE INDEX "inv_item_company_id_status_idx" ON "inv_item" ("company_id", "status");
DROP INDEX IF EXISTS "inv_item_company_id_idx";

-- Fix 3: Replace broken NULL-nullable unique index on inv_custom_field with partial unique index
-- Drop the broken unique index from the previous migration (NULL != NULL in unique constraints)
DROP INDEX IF EXISTS "inv_custom_field_company_id_field_key_category_id_key";
-- Partial unique index: enforce fieldKey uniqueness per company for global fields (categoryId IS NULL)
CREATE UNIQUE INDEX "inv_custom_field_company_fieldkey_null_cat"
  ON "inv_custom_field" ("company_id", "field_key")
  WHERE "category_id" IS NULL;
-- Performance index for companyId + fieldKey queries
CREATE INDEX "inv_custom_field_company_id_field_key_idx" ON "inv_custom_field" ("company_id", "field_key");

-- Fix 4: Add missing index on inv_item_file.file_asset_id
CREATE INDEX "inv_item_file_file_asset_id_idx" ON "inv_item_file" ("file_asset_id");

-- Fix 5: Add missing index on inv_custom_field_value.field_id
CREATE INDEX "inv_custom_field_value_field_id_idx" ON "inv_custom_field_value" ("field_id");

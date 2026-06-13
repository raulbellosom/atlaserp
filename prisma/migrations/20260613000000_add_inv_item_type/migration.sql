-- Add item_type column to inv_item
ALTER TABLE "public"."inv_item" ADD COLUMN IF NOT EXISTS "item_type" VARCHAR(50);

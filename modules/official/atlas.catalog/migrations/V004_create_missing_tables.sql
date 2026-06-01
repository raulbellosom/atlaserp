CREATE TABLE IF NOT EXISTS "catalog_product_option" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_product_option_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "catalog_product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "catalog_product_option_value" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "option_id" UUID NOT NULL,
  "value" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_product_option_value_option_id_fkey"
    FOREIGN KEY ("option_id") REFERENCES "catalog_product_option" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "catalog_product_variant" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "option_values" JSONB NOT NULL DEFAULT '{}',
  "sku" TEXT,
  "barcode" TEXT,
  "price" NUMERIC(18,4) NOT NULL DEFAULT 0,
  "compare_price" NUMERIC(18,4),
  "stock" INTEGER NOT NULL DEFAULT 0,
  "cover_asset_id" UUID,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_product_variant_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "catalog_product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "catalog_stock_movement" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "variant_id" UUID,
  "quantity_delta" INTEGER NOT NULL,
  "reason" TEXT,
  "note" TEXT,
  "user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_stock_movement_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "catalog_product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "catalog_stock_movement_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "catalog_product_variant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

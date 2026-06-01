-- Migration: add_catalog_core_tables
-- Tables already exist in the database (created by Atlas ORM). Using IF NOT EXISTS for safe application.

CREATE TABLE IF NOT EXISTS "catalog_category" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID        NOT NULL,
  "parent_id"      UUID,
  "name"           TEXT        NOT NULL,
  "slug"           TEXT        NOT NULL,
  "description"    TEXT,
  "cover_asset_id" UUID,
  "position"       INTEGER     NOT NULL DEFAULT 0,
  "enabled"        BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "catalog_category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_category_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "catalog_category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_category_company_id_slug_key"
  ON "catalog_category" ("company_id", "slug");

CREATE INDEX IF NOT EXISTS "catalog_category_company_id_enabled_idx"
  ON "catalog_category" ("company_id", "enabled");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "catalog_product" (
  "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
  "company_id"       UUID          NOT NULL,
  "category_id"      UUID,
  "product_type"     TEXT          NOT NULL DEFAULT 'SIMPLE',
  "name"             TEXT          NOT NULL,
  "slug"             TEXT          NOT NULL,
  "description"      TEXT,
  "sku"              TEXT,
  "barcode"          TEXT,
  "price"            NUMERIC(12,4) NOT NULL DEFAULT 0,
  "compare_price"    NUMERIC(12,4),
  "currency"         TEXT          NOT NULL DEFAULT 'USD',
  "weight"           NUMERIC(10,3),
  "stock"            INTEGER       NOT NULL DEFAULT 0,
  "track_stock"      BOOLEAN       NOT NULL DEFAULT FALSE,
  "attributes"       JSONB         NOT NULL DEFAULT '[]',
  "cover_asset_id"   UUID,
  "images"           JSONB         NOT NULL DEFAULT '[]',
  "meta_title"       TEXT,
  "meta_description" TEXT,
  "enabled"          BOOLEAN       NOT NULL DEFAULT TRUE,
  "published"        BOOLEAN       NOT NULL DEFAULT FALSE,
  "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "catalog_product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_product_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "catalog_category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_product_company_id_slug_key"
  ON "catalog_product" ("company_id", "slug");

CREATE INDEX IF NOT EXISTS "catalog_product_company_id_enabled_idx"
  ON "catalog_product" ("company_id", "enabled");

CREATE INDEX IF NOT EXISTS "catalog_product_company_id_category_id_idx"
  ON "catalog_product" ("company_id", "category_id");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "catalog_product_option" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID        NOT NULL,
  "product_id" UUID        NOT NULL,
  "name"       TEXT        NOT NULL,
  "position"   INTEGER     NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "catalog_product_option_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_product_option_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "catalog_product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "catalog_product_option_product_id_idx"
  ON "catalog_product_option" ("product_id");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "catalog_product_option_value" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID        NOT NULL,
  "option_id"  UUID        NOT NULL,
  "value"      TEXT        NOT NULL,
  "position"   INTEGER     NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "catalog_product_option_value_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_product_option_value_option_id_fkey"
    FOREIGN KEY ("option_id") REFERENCES "catalog_product_option" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "catalog_product_option_value_option_id_idx"
  ON "catalog_product_option_value" ("option_id");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "catalog_product_variant" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID          NOT NULL,
  "product_id"     UUID          NOT NULL,
  "option_values"  JSONB         NOT NULL DEFAULT '{}',
  "sku"            TEXT,
  "barcode"        TEXT,
  "price"          NUMERIC(12,4) NOT NULL DEFAULT 0,
  "compare_price"  NUMERIC(12,4),
  "stock"          INTEGER       NOT NULL DEFAULT 0,
  "cover_asset_id" UUID,
  "enabled"        BOOLEAN       NOT NULL DEFAULT TRUE,
  "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "catalog_product_variant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_product_variant_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "catalog_product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "catalog_product_variant_product_id_enabled_idx"
  ON "catalog_product_variant" ("product_id", "enabled");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "catalog_stock_movement" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID        NOT NULL,
  "product_id"     UUID        NOT NULL,
  "variant_id"     UUID,
  "quantity_delta" INTEGER     NOT NULL,
  "reason"         TEXT,
  "note"           TEXT,
  "user_id"        UUID,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "catalog_stock_movement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_stock_movement_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "catalog_product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "catalog_stock_movement_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "catalog_product_variant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "catalog_stock_movement_company_product_created_idx"
  ON "catalog_stock_movement" ("company_id", "product_id", "created_at" DESC);

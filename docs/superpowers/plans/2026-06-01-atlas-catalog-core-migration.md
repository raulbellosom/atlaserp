# atlas.catalog — Core Module Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `atlas.catalog` from an AME3 FEATURE module (`modules/official/atlas.catalog/`) to a Prisma-backed CORE module, with routes in `apps/api/src/routes/catalog/`, 6 Prisma models in `schema.prisma`, a safe baseline migration, and the manifest updated to `core: true` / `kind: CORE`.

**Architecture:** The 6 catalog tables already exist in the database (created by Atlas ORM). The Prisma migration uses `CREATE TABLE IF NOT EXISTS` — it is purely declarative and will not touch existing data. Services and route files move from `modules/official/atlas.catalog/api/` → `apps/api/src/routes/catalog/`. The private catalog router is mounted via `mountWithAuth`. The public catalog routes are kept in `routes/public-website.js` and updated to use the moved `createCatalogPublicService`. After migration the AME3 directory is deleted; the route-loader will silently skip atlas.catalog (it returns `{ loaded: false, reason: 'missing_api' }` when no file exists — no crash).

**Tech Stack:** Prisma 7, Hono, `prisma.$queryRaw` / `$queryRawUnsafe` / `$transaction`, Zod, PostgreSQL UUIDv7 via DB default.

---

## File map

```
prisma/
  schema.prisma                                           MODIFY  (add 6 models)
  migrations/
    20260601000000_add_catalog_core_tables/
      migration.sql                                       CREATE

apps/api/src/
  routes/
    catalog/
      index.js                                            CREATE
      catalog-product-service.js                          CREATE  (moved + fixed)
      catalog-variant-service.js                          CREATE  (moved)
      catalog-stock-service.js                            CREATE  (moved)
      catalog-public-service.js                           CREATE  (moved)
      validators.js                                       CREATE  (moved)
      categories-routes.js                                CREATE  (moved + fixed imports)
      products-routes.js                                  CREATE  (moved + fixed imports)
      variants-routes.js                                  CREATE  (moved)
      stock-routes.js                                     CREATE  (moved)
    public-website.js                                     MODIFY  (update public catalog to use moved service)
  manifests/official/
    feature-modules.js                                    MODIFY  (remove atlasCatalogManifest)
    core-modules.js                                       MODIFY  (add atlasCatalogManifest, add to coreModules)
  index.js                                                MODIFY  (import + mountWithAuth + CORE_MODULE_KEYS)

modules/official/atlas.catalog/                          DELETE  (entire directory)
```

---

## Task 1: Add 6 Prisma models to schema.prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Append the 6 catalog models at the end of schema.prisma**

Add after the last model in the file:

```prisma
model CatalogCategory {
  id            String   @id @default(uuid(7)) @db.Uuid
  companyId     String   @db.Uuid @map("company_id")
  parentId      String?  @db.Uuid @map("parent_id")
  name          String
  slug          String
  description   String?
  coverAssetId  String?  @db.Uuid @map("cover_asset_id")
  position      Int      @default(0)
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  parent        CatalogCategory?  @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children      CatalogCategory[] @relation("CategoryHierarchy")
  products      CatalogProduct[]

  @@unique([companyId, slug])
  @@index([companyId, enabled])
  @@map("catalog_category")
}

model CatalogProduct {
  id              String   @id @default(uuid(7)) @db.Uuid
  companyId       String   @db.Uuid @map("company_id")
  categoryId      String?  @db.Uuid @map("category_id")
  productType     String   @default("SIMPLE") @map("product_type")
  name            String
  slug            String
  description     String?
  sku             String?
  barcode         String?
  price           Decimal  @db.Decimal(12, 4)
  comparePrice    Decimal? @db.Decimal(12, 4) @map("compare_price")
  currency        String   @default("USD")
  weight          Decimal? @db.Decimal(10, 3)
  stock           Int      @default(0)
  trackStock      Boolean  @default(false) @map("track_stock")
  attributes      Json     @default("[]")
  coverAssetId    String?  @db.Uuid @map("cover_asset_id")
  images          Json     @default("[]")
  metaTitle       String?  @map("meta_title")
  metaDescription String?  @map("meta_description")
  enabled         Boolean  @default(true)
  published       Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  category        CatalogCategory?         @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  options         CatalogProductOption[]
  variants        CatalogProductVariant[]
  stockMovements  CatalogStockMovement[]

  @@unique([companyId, slug])
  @@index([companyId, enabled])
  @@index([companyId, categoryId])
  @@map("catalog_product")
}

model CatalogProductOption {
  id        String   @id @default(uuid(7)) @db.Uuid
  companyId String   @db.Uuid @map("company_id")
  productId String   @db.Uuid @map("product_id")
  name      String
  position  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  product   CatalogProduct             @relation(fields: [productId], references: [id], onDelete: Cascade)
  values    CatalogProductOptionValue[]

  @@index([productId])
  @@map("catalog_product_option")
}

model CatalogProductOptionValue {
  id        String   @id @default(uuid(7)) @db.Uuid
  companyId String   @db.Uuid @map("company_id")
  optionId  String   @db.Uuid @map("option_id")
  value     String
  position  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  option    CatalogProductOption @relation(fields: [optionId], references: [id], onDelete: Cascade)

  @@index([optionId])
  @@map("catalog_product_option_value")
}

model CatalogProductVariant {
  id            String   @id @default(uuid(7)) @db.Uuid
  companyId     String   @db.Uuid @map("company_id")
  productId     String   @db.Uuid @map("product_id")
  optionValues  Json     @default("{}") @map("option_values")
  sku           String?
  barcode       String?
  price         Decimal  @db.Decimal(12, 4)
  comparePrice  Decimal? @db.Decimal(12, 4) @map("compare_price")
  stock         Int      @default(0)
  coverAssetId  String?  @db.Uuid @map("cover_asset_id")
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  product        CatalogProduct         @relation(fields: [productId], references: [id], onDelete: Cascade)
  stockMovements CatalogStockMovement[]

  @@index([productId, enabled])
  @@map("catalog_product_variant")
}

model CatalogStockMovement {
  id            String   @id @default(uuid(7)) @db.Uuid
  companyId     String   @db.Uuid @map("company_id")
  productId     String   @db.Uuid @map("product_id")
  variantId     String?  @db.Uuid @map("variant_id")
  quantityDelta Int      @map("quantity_delta")
  reason        String?
  note          String?
  userId        String?  @db.Uuid @map("user_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  product CatalogProduct         @relation(fields: [productId], references: [id], onDelete: Cascade)
  variant CatalogProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  @@index([companyId, productId, createdAt(sort: Desc)])
  @@map("catalog_stock_movement")
}
```

- [ ] **Step 2: Run Prisma generate to verify schema is valid**

```bash
pnpm db:generate
```

Expected: `Generated Prisma Client` — no errors. If it fails, check for typos in the schema.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(catalog): add 6 Prisma models for catalog core migration"
```

---

## Task 2: Create Prisma migration (safe baseline)

**Files:**
- Create: `prisma/migrations/20260601000000_add_catalog_core_tables/migration.sql`

The tables already exist in Supabase (created by Atlas ORM). Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` throughout — this migration is safe to apply to a DB that already has these tables.

- [ ] **Step 1: Create the migration directory and file**

Create `prisma/migrations/20260601000000_add_catalog_core_tables/migration.sql` with this content:

```sql
-- Migration: add_catalog_core_tables
-- Tables already exist (created by Atlas ORM). Using IF NOT EXISTS for safe application.

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
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id"       UUID         NOT NULL,
  "category_id"      UUID,
  "product_type"     TEXT         NOT NULL DEFAULT 'SIMPLE',
  "name"             TEXT         NOT NULL,
  "slug"             TEXT         NOT NULL,
  "description"      TEXT,
  "sku"              TEXT,
  "barcode"          TEXT,
  "price"            NUMERIC(12,4) NOT NULL DEFAULT 0,
  "compare_price"    NUMERIC(12,4),
  "currency"         TEXT         NOT NULL DEFAULT 'USD',
  "weight"           NUMERIC(10,3),
  "stock"            INTEGER      NOT NULL DEFAULT 0,
  "track_stock"      BOOLEAN      NOT NULL DEFAULT FALSE,
  "attributes"       JSONB        NOT NULL DEFAULT '[]',
  "cover_asset_id"   UUID,
  "images"           JSONB        NOT NULL DEFAULT '[]',
  "meta_title"       TEXT,
  "meta_description" TEXT,
  "enabled"          BOOLEAN      NOT NULL DEFAULT TRUE,
  "published"        BOOLEAN      NOT NULL DEFAULT FALSE,
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
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
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID         NOT NULL,
  "product_id"     UUID         NOT NULL,
  "option_values"  JSONB        NOT NULL DEFAULT '{}',
  "sku"            TEXT,
  "barcode"        TEXT,
  "price"          NUMERIC(12,4) NOT NULL DEFAULT 0,
  "compare_price"  NUMERIC(12,4),
  "stock"          INTEGER      NOT NULL DEFAULT 0,
  "cover_asset_id" UUID,
  "enabled"        BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
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
```

- [ ] **Step 2: Apply the migration**

```bash
pnpm db:migrate
```

Expected output: `The following migration(s) have been applied: 20260601000000_add_catalog_core_tables`

If Prisma complains about migration drift (tables exist but migration wasn't applied), run:

```bash
pnpm exec prisma migrate resolve --applied 20260601000000_add_catalog_core_tables
```

Then re-run `pnpm db:generate`.

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/20260601000000_add_catalog_core_tables/migration.sql
git commit -m "feat(catalog): add Prisma baseline migration for catalog core tables (IF NOT EXISTS)"
```

---

## Task 3: Create catalog services in apps/api/src/routes/catalog/

**Files:**
- Create: `apps/api/src/routes/catalog/catalog-product-service.js`
- Create: `apps/api/src/routes/catalog/catalog-variant-service.js`
- Create: `apps/api/src/routes/catalog/catalog-stock-service.js`
- Create: `apps/api/src/routes/catalog/catalog-public-service.js`
- Create: `apps/api/src/routes/catalog/validators.js`

These are moved verbatim from `modules/official/atlas.catalog/api/` — no logic changes. The only difference is the file paths.

- [ ] **Step 1: Create catalog-product-service.js**

```js
// apps/api/src/routes/catalog/catalog-product-service.js

export function createCatalogProductService({ prisma }) {

  async function listCategoriesTree({ companyId }) {
    const rows = await prisma.$queryRaw`
      SELECT id, name, slug, description, parent_id, cover_asset_id,
             position, enabled, created_at, updated_at
      FROM catalog_category
      WHERE company_id = ${companyId}::uuid AND enabled = true
      ORDER BY position ASC, name ASC
    `
    const roots = rows.filter(r => r.parent_id === null)
    return roots.map(r => ({
      ...r,
      children: rows.filter(c => String(c.parent_id) === String(r.id)),
    }))
  }

  async function listCategories({ companyId }) {
    return prisma.$queryRaw`
      SELECT id, name, slug, description, parent_id, cover_asset_id,
             position, enabled, created_at, updated_at
      FROM catalog_category
      WHERE company_id = ${companyId}::uuid AND enabled = true
      ORDER BY position ASC, name ASC
    `
  }

  async function listCategoriesPaginated({ companyId, search, sort, order, limit = 20, offset = 0 }) {
    const likeSearch = search ? `%${String(search).trim()}%` : null
    const safeLimit  = Math.min(Math.max(Number.parseInt(String(limit),  10) || 20, 1), 200)
    const safeOffset = Math.max(Number.parseInt(String(offset), 10) || 0, 0)
    const ALLOWED_SORT = ['name', 'slug', 'position', 'created_at']
    const safeSort  = ALLOWED_SORT.includes(sort) ? sort : 'position'
    const safeOrder = order === 'desc' ? 'DESC' : 'ASC'

    const rows = await prisma.$queryRawUnsafe(
      `SELECT c.id, c.name, c.slug, c.description, c.parent_id,
              c.position, c.enabled, c.created_at,
              p.name AS parent_name
       FROM catalog_category c
       LEFT JOIN catalog_category p ON p.id = c.parent_id
       WHERE c.company_id = $1::uuid AND c.enabled = true
         AND ($2::text IS NULL OR c.name ILIKE $2 OR c.slug ILIKE $2)
       ORDER BY c.${safeSort} ${safeOrder}
       LIMIT $3 OFFSET $4`,
      companyId, likeSearch, safeLimit, safeOffset,
    )

    const [{ total }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total
       FROM catalog_category c
       WHERE c.company_id = $1::uuid AND c.enabled = true
         AND ($2::text IS NULL OR c.name ILIKE $2 OR c.slug ILIKE $2)`,
      companyId, likeSearch,
    )

    return { data: rows, total }
  }

  async function getCategoryById({ companyId, id }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM catalog_category
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
      LIMIT 1
    `
    return rows[0] ?? null
  }

  async function createCategory({ companyId, data }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO catalog_category
        (company_id, name, slug, description, parent_id, cover_asset_id, position)
      VALUES (
        ${companyId}::uuid,
        ${data.name},
        ${data.slug},
        ${data.description ?? null},
        ${data.parent_id ?? null}::uuid,
        ${data.cover_asset_id ?? null}::uuid,
        ${data.position ?? 0}
      )
      RETURNING *
    `
    return rows[0]
  }

  async function updateCategory({ companyId, id, data }) {
    const map = {
      name:           data.name,
      slug:           data.slug,
      description:    data.description,
      parent_id:      data.parent_id,
      cover_asset_id: data.cover_asset_id,
      position:       data.position,
    }
    const entries = Object.entries(map).filter(([, v]) => v !== undefined)
    if (!entries.length) return getCategoryById({ companyId, id })
    const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
    const values   = entries.map(([, v]) => v)
    const sql = `UPDATE catalog_category SET ${setParts}, updated_at = now()
                 WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid
                 RETURNING *`
    const rows = await prisma.$queryRawUnsafe(sql, id, ...values, companyId)
    return rows[0] ?? null
  }

  async function deleteCategory({ companyId, id }) {
    await prisma.$queryRaw`
      UPDATE catalog_category SET enabled = false, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
  }

  async function listProducts({ companyId, categoryId, type, published, search, limit = 50, offset = 0 }) {
    const safeLimit  = Math.min(Math.max(Number.parseInt(String(limit  ?? 50),  10) || 50,  1), 500)
    const safeOffset = Math.max(Number.parseInt(String(offset ?? 0),   10) || 0,  0)
    const likeSearch = search ? `%${String(search).trim()}%` : null
    const catId      = categoryId ?? null
    const prodType   = type ?? null
    const pubFilter  = published === undefined ? null : (published === 'true' || published === true)

    const rows = await prisma.$queryRawUnsafe(
      `SELECT p.id, p.name, p.slug, p.product_type, p.price, p.currency,
              p.stock, p.track_stock, p.cover_asset_id, p.published,
              p.created_at, c.name AS category_name
       FROM catalog_product p
       LEFT JOIN catalog_category c ON c.id = p.category_id
       WHERE p.company_id = $1::uuid
         AND p.enabled = true
         AND ($2::uuid IS NULL OR p.category_id = $2::uuid)
         AND ($3::text IS NULL OR p.product_type = $3)
         AND ($4::boolean IS NULL OR p.published = $4)
         AND ($5::text IS NULL OR p.name ILIKE $5)
       ORDER BY p.created_at DESC
       LIMIT $6 OFFSET $7`,
      companyId, catId, prodType, pubFilter, likeSearch, safeLimit, safeOffset,
    )

    const [{ total }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total
       FROM catalog_product p
       WHERE p.company_id = $1::uuid
         AND p.enabled = true
         AND ($2::uuid IS NULL OR p.category_id = $2::uuid)
         AND ($3::text IS NULL OR p.product_type = $3)
         AND ($4::boolean IS NULL OR p.published = $4)
         AND ($5::text IS NULL OR p.name ILIKE $5)`,
      companyId, catId, prodType, pubFilter, likeSearch,
    )

    return { data: rows, total }
  }

  async function getProductById({ companyId, id }) {
    const rows = await prisma.$queryRaw`
      SELECT p.*, c.name AS category_name
      FROM catalog_product p
      LEFT JOIN catalog_category c ON c.id = p.category_id
      WHERE p.id = ${id}::uuid AND p.company_id = ${companyId}::uuid
      LIMIT 1
    `
    return rows[0] ?? null
  }

  async function getFullProductById({ companyId, id }) {
    const rows = await prisma.$queryRaw`
      SELECT p.*, c.name AS category_name
      FROM catalog_product p
      LEFT JOIN catalog_category c ON c.id = p.category_id
      WHERE p.id = ${id}::uuid AND p.company_id = ${companyId}::uuid
      LIMIT 1
    `
    if (!rows[0]) return null
    const product = rows[0]

    if (product.product_type === 'VARIABLE') {
      const options = await prisma.$queryRaw`
        SELECT o.id, o.name, o.position
        FROM catalog_product_option o
        WHERE o.product_id = ${id}::uuid AND o.company_id = ${companyId}::uuid
        ORDER BY o.position ASC
      `
      const vals = await prisma.$queryRaw`
        SELECT v.id, v.option_id, v.value, v.position
        FROM catalog_product_option_value v
        JOIN catalog_product_option o ON o.id = v.option_id
        WHERE o.product_id = ${id}::uuid
        ORDER BY v.position ASC
      `
      product.options = options.map(o => ({
        ...o,
        values: vals.filter(v => String(v.option_id) === String(o.id)),
      }))
      product.variants = await prisma.$queryRaw`
        SELECT * FROM catalog_product_variant
        WHERE product_id = ${id}::uuid AND company_id = ${companyId}::uuid AND enabled = true
        ORDER BY created_at ASC
      `
    }

    return product
  }

  async function createProduct({ companyId, data }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO catalog_product
        (company_id, category_id, product_type, name, slug, description,
         sku, barcode, price, compare_price, currency, weight,
         stock, track_stock, attributes, cover_asset_id, images,
         meta_title, meta_description, published)
      VALUES (
        ${companyId}::uuid,
        ${data.category_id ?? null}::uuid,
        ${data.product_type ?? 'SIMPLE'},
        ${data.name},
        ${data.slug},
        ${data.description ?? null},
        ${data.sku ?? null},
        ${data.barcode ?? null},
        ${data.price ?? 0},
        ${data.compare_price ?? null},
        ${data.currency ?? 'USD'},
        ${data.weight ?? null},
        ${data.stock ?? 0},
        ${data.track_stock ?? false},
        ${JSON.stringify(data.attributes ?? [])}::jsonb,
        ${data.cover_asset_id ?? null}::uuid,
        ${JSON.stringify(data.images ?? [])}::jsonb,
        ${data.meta_title ?? null},
        ${data.meta_description ?? null},
        ${data.published ?? false}
      )
      RETURNING *
    `
    return rows[0]
  }

  async function updateProduct({ companyId, id, data }) {
    const map = {
      category_id:      data.category_id,
      product_type:     data.product_type,
      name:             data.name,
      slug:             data.slug,
      description:      data.description,
      sku:              data.sku,
      barcode:          data.barcode,
      price:            data.price,
      compare_price:    data.compare_price,
      currency:         data.currency,
      weight:           data.weight,
      stock:            data.stock,
      track_stock:      data.track_stock,
      attributes:       data.attributes !== undefined ? JSON.stringify(data.attributes) : undefined,
      cover_asset_id:   data.cover_asset_id,
      images:           data.images !== undefined ? JSON.stringify(data.images) : undefined,
      meta_title:       data.meta_title,
      meta_description: data.meta_description,
      published:        data.published,
    }
    const entries = Object.entries(map).filter(([, v]) => v !== undefined)
    if (!entries.length) return getProductById({ companyId, id })
    const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
    const values   = entries.map(([, v]) => v)
    const sql = `UPDATE catalog_product SET ${setParts}, updated_at = now()
                 WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid AND enabled = true
                 RETURNING *`
    const rows = await prisma.$queryRawUnsafe(sql, id, ...values, companyId)
    return rows[0] ?? null
  }

  async function publishProduct({ companyId, id, published }) {
    const rows = await prisma.$queryRaw`
      UPDATE catalog_product SET published = ${published}, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid AND enabled = true
      RETURNING *
    `
    return rows[0] ?? null
  }

  async function deleteProduct({ companyId, id }) {
    await prisma.$queryRaw`
      UPDATE catalog_product SET enabled = false, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
  }

  return {
    listCategoriesTree,
    listCategories,
    listCategoriesPaginated,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    listProducts,
    getProductById,
    getFullProductById,
    createProduct,
    updateProduct,
    publishProduct,
    deleteProduct,
  }
}
```

- [ ] **Step 2: Create catalog-variant-service.js**

```js
// apps/api/src/routes/catalog/catalog-variant-service.js

export function createCatalogVariantService({ prisma }) {

  async function listOptions({ companyId, productId }) {
    const options = await prisma.$queryRaw`
      SELECT o.id, o.name, o.position
      FROM catalog_product_option o
      WHERE o.product_id = ${productId}::uuid AND o.company_id = ${companyId}::uuid
      ORDER BY o.position ASC, o.name ASC
    `
    const values = await prisma.$queryRaw`
      SELECT v.id, v.option_id, v.value, v.position
      FROM catalog_product_option_value v
      JOIN catalog_product_option o ON o.id = v.option_id
      WHERE o.product_id = ${productId}::uuid AND o.company_id = ${companyId}::uuid
      ORDER BY v.position ASC
    `
    return options.map(o => ({
      ...o,
      values: values.filter(v => String(v.option_id) === String(o.id)),
    }))
  }

  async function createOption({ companyId, productId, data }) {
    return prisma.$transaction(async (tx) => {
      const [option] = await tx.$queryRaw`
        INSERT INTO catalog_product_option (company_id, product_id, name, position)
        VALUES (${companyId}::uuid, ${productId}::uuid, ${data.name}, ${data.position ?? 0})
        RETURNING *
      `
      const vals = []
      for (const [i, val] of (data.values ?? []).entries()) {
        const [row] = await tx.$queryRaw`
          INSERT INTO catalog_product_option_value (company_id, option_id, value, position)
          VALUES (${companyId}::uuid, ${option.id}::uuid, ${val}, ${i})
          RETURNING *
        `
        vals.push(row)
      }
      return { ...option, values: vals }
    })
  }

  async function updateOption({ companyId, optionId, data }) {
    return prisma.$transaction(async (tx) => {
      if (data.name !== undefined || data.position !== undefined) {
        const map = { name: data.name, position: data.position }
        const entries = Object.entries(map).filter(([, v]) => v !== undefined)
        if (entries.length) {
          const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
          const values   = entries.map(([, v]) => v)
          const sql = `UPDATE catalog_product_option SET ${setParts}, updated_at = now()
                       WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid RETURNING *`
          await tx.$queryRawUnsafe(sql, optionId, ...values, companyId)
        }
      }
      if (data.values !== undefined) {
        await tx.$queryRaw`
          DELETE FROM catalog_product_option_value WHERE option_id = ${optionId}::uuid
        `
        for (const [i, val] of data.values.entries()) {
          await tx.$queryRaw`
            INSERT INTO catalog_product_option_value (company_id, option_id, value, position)
            VALUES (${companyId}::uuid, ${optionId}::uuid, ${val}, ${i})
          `
        }
      }
      const [updated] = await tx.$queryRaw`
        SELECT * FROM catalog_product_option WHERE id = ${optionId}::uuid LIMIT 1
      `
      if (!updated) return null
      const values = await tx.$queryRaw`
        SELECT * FROM catalog_product_option_value WHERE option_id = ${optionId}::uuid ORDER BY position ASC
      `
      return { ...updated, values }
    })
  }

  async function deleteOption({ companyId, optionId }) {
    await prisma.$queryRaw`
      DELETE FROM catalog_product_option
      WHERE id = ${optionId}::uuid AND company_id = ${companyId}::uuid
    `
  }

  async function listVariants({ companyId, productId }) {
    return prisma.$queryRaw`
      SELECT * FROM catalog_product_variant
      WHERE product_id = ${productId}::uuid AND company_id = ${companyId}::uuid AND enabled = true
      ORDER BY created_at ASC
    `
  }

  async function getVariantById({ companyId, variantId }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM catalog_product_variant
      WHERE id = ${variantId}::uuid AND company_id = ${companyId}::uuid
      LIMIT 1
    `
    return rows[0] ?? null
  }

  async function createVariant({ companyId, productId, data }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO catalog_product_variant
        (company_id, product_id, option_values, sku, barcode, price, compare_price, stock, cover_asset_id)
      VALUES (
        ${companyId}::uuid,
        ${productId}::uuid,
        ${JSON.stringify(data.option_values ?? {})}::jsonb,
        ${data.sku ?? null},
        ${data.barcode ?? null},
        ${data.price ?? 0},
        ${data.compare_price ?? null},
        ${data.stock ?? 0},
        ${data.cover_asset_id ?? null}::uuid
      )
      RETURNING *
    `
    return rows[0]
  }

  async function updateVariant({ companyId, variantId, data }) {
    const map = {
      option_values:  data.option_values !== undefined ? JSON.stringify(data.option_values) : undefined,
      sku:            data.sku,
      barcode:        data.barcode,
      price:          data.price,
      compare_price:  data.compare_price,
      stock:          data.stock,
      cover_asset_id: data.cover_asset_id,
    }
    const entries = Object.entries(map).filter(([, v]) => v !== undefined)
    if (!entries.length) return getVariantById({ companyId, variantId })
    const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
    const values   = entries.map(([, v]) => v)
    const sql = `UPDATE catalog_product_variant SET ${setParts}, updated_at = now()
                 WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid AND enabled = true
                 RETURNING *`
    const rows = await prisma.$queryRawUnsafe(sql, variantId, ...values, companyId)
    return rows[0] ?? null
  }

  async function deleteVariant({ companyId, variantId }) {
    await prisma.$queryRaw`
      UPDATE catalog_product_variant SET enabled = false, updated_at = now()
      WHERE id = ${variantId}::uuid AND company_id = ${companyId}::uuid
    `
  }

  return {
    listOptions,
    createOption,
    updateOption,
    deleteOption,
    listVariants,
    getVariantById,
    createVariant,
    updateVariant,
    deleteVariant,
  }
}
```

- [ ] **Step 3: Create catalog-stock-service.js**

```js
// apps/api/src/routes/catalog/catalog-stock-service.js

export function createCatalogStockService({ prisma }) {

  async function recordStockMovement({ companyId, productId, variantId, quantityDelta, reason, note, userId }) {
    return prisma.$transaction(async (tx) => {
      const [movement] = await tx.$queryRaw`
        INSERT INTO catalog_stock_movement
          (company_id, product_id, variant_id, quantity_delta, reason, note, user_id)
        VALUES (
          ${companyId}::uuid,
          ${productId}::uuid,
          ${variantId ?? null}::uuid,
          ${quantityDelta},
          ${reason ?? null},
          ${note ?? null},
          ${userId ?? null}::uuid
        )
        RETURNING *
      `

      if (variantId) {
        await tx.$queryRaw`
          UPDATE catalog_product_variant
          SET stock = stock + ${quantityDelta}, updated_at = now()
          WHERE id = ${variantId}::uuid AND company_id = ${companyId}::uuid
        `
      } else {
        await tx.$queryRaw`
          UPDATE catalog_product
          SET stock = stock + ${quantityDelta}, updated_at = now()
          WHERE id = ${productId}::uuid AND company_id = ${companyId}::uuid
        `
      }

      return movement
    })
  }

  async function listStockMovements({ companyId, productId, variantId, limit = 50, offset = 0 }) {
    const safeLimit  = Math.min(Math.max(Number.parseInt(String(limit  ?? 50),  10) || 50,  1), 200)
    const safeOffset = Math.max(Number.parseInt(String(offset ?? 0), 10) || 0, 0)
    const vid = variantId ?? null

    const rows = await prisma.$queryRawUnsafe(
      `SELECT m.*,
              p.name AS product_name,
              v.option_values AS variant_option_values
       FROM catalog_stock_movement m
       JOIN catalog_product p ON p.id = m.product_id
       LEFT JOIN catalog_product_variant v ON v.id = m.variant_id
       WHERE m.company_id = $1::uuid
         AND m.product_id = $2::uuid
         AND ($3::uuid IS NULL OR m.variant_id = $3::uuid)
       ORDER BY m.created_at DESC
       LIMIT $4 OFFSET $5`,
      companyId, productId, vid, safeLimit, safeOffset,
    )

    const [{ total }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total
       FROM catalog_stock_movement
       WHERE company_id = $1::uuid
         AND product_id = $2::uuid
         AND ($3::uuid IS NULL OR variant_id = $3::uuid)`,
      companyId, productId, vid,
    )

    return { data: rows, total }
  }

  return {
    recordStockMovement,
    listStockMovements,
  }
}
```

- [ ] **Step 4: Create catalog-public-service.js**

```js
// apps/api/src/routes/catalog/catalog-public-service.js

export function createCatalogPublicService({ prisma }) {

  async function listPublicProducts({ companyId, categorySlug, search, limit = 20, offset = 0 }) {
    const safeLimit  = Math.min(Math.max(Number.parseInt(String(limit  ?? 20),  10) || 20,  1), 200)
    const safeOffset = Math.max(Number.parseInt(String(offset ?? 0), 10) || 0, 0)
    const likeSearch = search ? `%${String(search).trim()}%` : null
    const catSlug    = categorySlug ?? null

    const rows = await prisma.$queryRawUnsafe(
      `SELECT p.id, p.name, p.slug, p.description, p.product_type,
              p.price, p.compare_price, p.currency,
              p.stock, p.track_stock, p.cover_asset_id, p.images,
              p.category_id, c.name AS category_name, c.slug AS category_slug
       FROM catalog_product p
       LEFT JOIN catalog_category c ON c.id = p.category_id
       WHERE p.company_id = $1::uuid
         AND p.enabled = true
         AND p.published = true
         AND ($2::text IS NULL OR c.slug = $2)
         AND ($3::text IS NULL OR p.name ILIKE $3)
       ORDER BY p.created_at DESC
       LIMIT $4 OFFSET $5`,
      companyId, catSlug, likeSearch, safeLimit, safeOffset,
    )

    const [{ total }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total
       FROM catalog_product p
       LEFT JOIN catalog_category c ON c.id = p.category_id
       WHERE p.company_id = $1::uuid
         AND p.enabled = true
         AND p.published = true
         AND ($2::text IS NULL OR c.slug = $2)
         AND ($3::text IS NULL OR p.name ILIKE $3)`,
      companyId, catSlug, likeSearch,
    )

    return { data: rows, total }
  }

  async function getPublicProductBySlug({ companyId, slug }) {
    const rows = await prisma.$queryRaw`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM catalog_product p
      LEFT JOIN catalog_category c ON c.id = p.category_id
      WHERE p.company_id = ${companyId}::uuid
        AND p.slug = ${slug}
        AND p.enabled = true
        AND p.published = true
      LIMIT 1
    `
    if (!rows[0]) return null

    const product = rows[0]
    if (product.product_type === 'VARIABLE') {
      product.variants = await prisma.$queryRaw`
        SELECT id, option_values, price, compare_price, stock, cover_asset_id, sku
        FROM catalog_product_variant
        WHERE product_id = ${product.id}::uuid AND enabled = true
        ORDER BY created_at ASC
      `
    }
    return product
  }

  async function listPublicCategories({ companyId }) {
    const rows = await prisma.$queryRaw`
      SELECT c.id, c.name, c.slug, c.description, c.parent_id,
             c.cover_asset_id, c.position,
             COUNT(p.id)::int AS product_count
      FROM catalog_category c
      LEFT JOIN catalog_product p
        ON p.category_id = c.id AND p.enabled = true AND p.published = true
      WHERE c.company_id = ${companyId}::uuid AND c.enabled = true
      GROUP BY c.id, c.name, c.slug, c.description, c.parent_id, c.cover_asset_id, c.position
      ORDER BY c.position ASC, c.name ASC
    `
    const roots = rows.filter(r => r.parent_id === null)
    return roots.map(r => ({
      ...r,
      children: rows.filter(c => String(c.parent_id) === String(r.id)),
    }))
  }

  return {
    listPublicProducts,
    getPublicProductBySlug,
    listPublicCategories,
  }
}
```

- [ ] **Step 5: Create validators.js**

```js
// apps/api/src/routes/catalog/validators.js
import { z } from 'zod'

export const createCategorySchema = z.object({
  name:           z.string().min(1).max(120),
  slug:           z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description:    z.string().max(500).optional(),
  parent_id:      z.string().uuid().optional().nullable(),
  cover_asset_id: z.string().uuid().optional().nullable(),
  position:       z.number().int().min(0).default(0),
})

export const updateCategorySchema = createCategorySchema.partial()

export const createProductSchema = z.object({
  name:             z.string().min(1).max(200),
  slug:             z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description:      z.string().max(5000).optional(),
  product_type:     z.enum(['SIMPLE', 'VARIABLE']).default('SIMPLE'),
  sku:              z.string().max(100).optional().nullable(),
  barcode:          z.string().max(100).optional().nullable(),
  price:            z.number().min(0).default(0),
  compare_price:    z.number().min(0).optional().nullable(),
  currency:         z.string().length(3).default('USD'),
  weight:           z.number().min(0).optional().nullable(),
  stock:            z.number().int().min(0).default(0),
  track_stock:      z.boolean().default(false),
  attributes:       z.array(z.object({ key: z.string().min(1), value: z.string() })).default([]),
  cover_asset_id:   z.string().uuid().optional().nullable(),
  images:           z.array(z.string().uuid()).default([]),
  category_id:      z.string().uuid().optional().nullable(),
  meta_title:       z.string().max(160).optional().nullable(),
  meta_description: z.string().max(320).optional().nullable(),
  published:        z.boolean().default(false),
})

export const updateProductSchema = z.object({
  name:             z.string().min(1).max(200),
  slug:             z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description:      z.string().max(5000).optional().nullable(),
  product_type:     z.enum(['SIMPLE', 'VARIABLE']),
  sku:              z.string().max(100).optional().nullable(),
  barcode:          z.string().max(100).optional().nullable(),
  price:            z.number().min(0),
  compare_price:    z.number().min(0).optional().nullable(),
  currency:         z.string().length(3),
  weight:           z.number().min(0).optional().nullable(),
  track_stock:      z.boolean(),
  attributes:       z.array(z.object({ key: z.string().min(1), value: z.string() })),
  cover_asset_id:   z.string().uuid().optional().nullable(),
  images:           z.array(z.string().uuid()),
  category_id:      z.string().uuid().optional().nullable(),
  meta_title:       z.string().max(160).optional().nullable(),
  meta_description: z.string().max(320).optional().nullable(),
  published:        z.boolean(),
}).partial()

export const createOptionSchema = z.object({
  name:     z.string().min(1).max(60),
  position: z.number().int().min(0).default(0),
  values:   z.array(z.string().min(1).max(60)).min(1),
})

export const updateOptionSchema = z.object({
  name:     z.string().min(1).max(60).optional(),
  position: z.number().int().min(0).optional(),
  values:   z.array(z.string().min(1).max(60)).min(1).optional(),
})

export const createVariantSchema = z.object({
  option_values:  z.record(z.string()).default({}),
  sku:            z.string().max(100).optional().nullable(),
  barcode:        z.string().max(100).optional().nullable(),
  price:          z.number().min(0).default(0),
  compare_price:  z.number().min(0).optional().nullable(),
  stock:          z.number().int().min(0).default(0),
  cover_asset_id: z.string().uuid().optional().nullable(),
})

export const updateVariantSchema = createVariantSchema.partial()

export const createStockMovementSchema = z.object({
  variant_id:     z.string().uuid().optional().nullable(),
  quantity_delta: z.number().int().refine(n => n !== 0, { message: 'quantity_delta cannot be zero' }),
  reason:         z.string().max(200).optional(),
  note:           z.string().max(500).optional(),
})
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/catalog/
git commit -m "feat(catalog): add catalog services and validators to apps/api/src/routes/catalog/"
```

---

## Task 4: Create route files in apps/api/src/routes/catalog/

**Files:**
- Create: `apps/api/src/routes/catalog/categories-routes.js`
- Create: `apps/api/src/routes/catalog/products-routes.js`
- Create: `apps/api/src/routes/catalog/variants-routes.js`
- Create: `apps/api/src/routes/catalog/stock-routes.js`
- Create: `apps/api/src/routes/catalog/index.js`

Key difference from the AME3 versions: imports now use `./validators.js` (local) and `../../services/activity-publisher.js` (from the new location).

- [ ] **Step 1: Create categories-routes.js**

```js
// apps/api/src/routes/catalog/categories-routes.js
import { Hono } from 'hono'
import { createCategorySchema, updateCategorySchema } from './validators.js'
import {
  publishActivityFromContext,
  getActivityContext,
} from '../../services/activity-publisher.js'

export function createCategoriesRouter({ productSvc, prisma, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/categories', requirePermission('catalog.categories.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const { flat, page, pageSize, search, sort, order } = c.req.query()

      if (flat === 'true') {
        const data = await productSvc.listCategories({ companyId })
        return c.json({ data })
      }

      if (page || pageSize) {
        const limit  = Math.min(Number.parseInt(pageSize, 10) || 20, 200)
        const offset = (Math.max(Number.parseInt(page, 10) || 1, 1) - 1) * limit
        const result = await productSvc.listCategoriesPaginated({
          companyId,
          search: search || undefined,
          sort,
          order,
          limit,
          offset,
        })
        return c.json(result)
      }

      const data = await productSvc.listCategoriesTree({ companyId })
      return c.json({ data })
    } catch (err) {
      console.error('[GET /catalog/categories]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/catalog/categories/:id', requirePermission('catalog.categories.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const row = await productSvc.getCategoryById({ companyId, id: c.req.param('id') })
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json({ data: row })
    } catch (err) {
      console.error('[GET /catalog/categories/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/catalog/categories', requirePermission('catalog.categories.create'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = createCategorySchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const row = await productSvc.createCategory({ companyId, data: parsed.data })
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.category.create',
        severity: 'success',
        entityType: 'CatalogCategory',
        entityId: row.id,
        summary: `${actorName} creó la categoría "${row.name}"`,
        link: `/m/atlas.catalog/categories`,
      })
      return c.json({ data: row }, 201)
    } catch (err) {
      if (err?.code === '23505') return c.json({ error: 'El slug ya existe' }, 409)
      console.error('[POST /catalog/categories]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.patch('/catalog/categories/:id', requirePermission('catalog.categories.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = updateCategorySchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const row = await productSvc.updateCategory({ companyId, id: c.req.param('id'), data: parsed.data })
      if (!row) return c.json({ error: 'Not found' }, 404)
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.category.update',
        severity: 'info',
        entityType: 'CatalogCategory',
        entityId: row.id,
        summary: `${actorName} actualizó la categoría "${row.name}"`,
        link: `/m/atlas.catalog/categories`,
      })
      return c.json({ data: row })
    } catch (err) {
      if (err?.code === '23505') return c.json({ error: 'El slug ya existe' }, 409)
      console.error('[PATCH /catalog/categories/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.delete('/catalog/categories/:id', requirePermission('catalog.categories.delete'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const existing = await productSvc.getCategoryById({ companyId, id: c.req.param('id') })
      await productSvc.deleteCategory({ companyId, id: c.req.param('id') })
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.category.delete',
        severity: 'warning',
        entityType: 'CatalogCategory',
        entityId: c.req.param('id'),
        summary: `${actorName} eliminó la categoría "${existing?.name ?? c.req.param('id')}"`,
        link: `/m/atlas.catalog/categories`,
      })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/categories/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
```

- [ ] **Step 2: Create products-routes.js**

```js
// apps/api/src/routes/catalog/products-routes.js
import { Hono } from 'hono'
import { createProductSchema, updateProductSchema } from './validators.js'
import {
  publishActivityFromContext,
  getActivityContext,
} from '../../services/activity-publisher.js'

export function createProductsRouter({ productSvc, prisma, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/products', requirePermission('catalog.products.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const { categoryId, type, published, search, limit, offset } = c.req.query()
      const result = await productSvc.listProducts({
        companyId,
        categoryId: categoryId || undefined,
        type:       type       || undefined,
        published:  published  !== undefined ? published === 'true' : undefined,
        search:     search     || undefined,
        limit:      limit  ? Number(limit)  : 50,
        offset:     offset ? Number(offset) : 0,
      })
      return c.json(result)
    } catch (err) {
      console.error('[GET /catalog/products]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/catalog/products/:id', requirePermission('catalog.products.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const row = await productSvc.getFullProductById({ companyId, id: c.req.param('id') })
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json({ data: row })
    } catch (err) {
      console.error('[GET /catalog/products/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/catalog/products', requirePermission('catalog.products.create'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = createProductSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const row = await productSvc.createProduct({ companyId, data: parsed.data })
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.product.create',
        severity: 'success',
        entityType: 'CatalogProduct',
        entityId: row.id,
        summary: `${actorName} creó el producto "${row.name}"`,
        link: `/m/atlas.catalog/${row.id}`,
      })
      return c.json({ data: row }, 201)
    } catch (err) {
      if (err?.code === '23505') return c.json({ error: 'El slug ya existe' }, 409)
      console.error('[POST /catalog/products]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.patch('/catalog/products/:id', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = updateProductSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const row = await productSvc.updateProduct({ companyId, id: c.req.param('id'), data: parsed.data })
      if (!row) return c.json({ error: 'Not found' }, 404)
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.product.update',
        severity: 'info',
        entityType: 'CatalogProduct',
        entityId: row.id,
        summary: `${actorName} actualizó el producto "${row.name}"`,
        link: `/m/atlas.catalog/${row.id}`,
      })
      return c.json({ data: row })
    } catch (err) {
      if (err?.code === '23505') return c.json({ error: 'El slug ya existe' }, 409)
      console.error('[PATCH /catalog/products/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/catalog/products/:id/publish', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const row = await productSvc.publishProduct({ companyId, id: c.req.param('id'), published: true })
      if (!row) return c.json({ error: 'Not found' }, 404)
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.product.publish',
        severity: 'success',
        entityType: 'CatalogProduct',
        entityId: row.id,
        summary: `${actorName} publicó el producto "${row.name}"`,
        link: `/m/atlas.catalog/${row.id}`,
      })
      return c.json({ data: row })
    } catch (err) {
      console.error('[POST /catalog/products/:id/publish]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/catalog/products/:id/unpublish', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const row = await productSvc.publishProduct({ companyId, id: c.req.param('id'), published: false })
      if (!row) return c.json({ error: 'Not found' }, 404)
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.product.unpublish',
        severity: 'warning',
        entityType: 'CatalogProduct',
        entityId: row.id,
        summary: `${actorName} despublicó el producto "${row.name}"`,
        link: `/m/atlas.catalog/${row.id}`,
      })
      return c.json({ data: row })
    } catch (err) {
      console.error('[POST /catalog/products/:id/unpublish]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.delete('/catalog/products/:id', requirePermission('catalog.products.delete'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const existing = await productSvc.getProductById({ companyId, id: c.req.param('id') })
      await productSvc.deleteProduct({ companyId, id: c.req.param('id') })
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.product.delete',
        severity: 'warning',
        entityType: 'CatalogProduct',
        entityId: c.req.param('id'),
        summary: `${actorName} eliminó el producto "${existing?.name ?? c.req.param('id')}"`,
      })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/products/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
```

- [ ] **Step 3: Create variants-routes.js**

```js
// apps/api/src/routes/catalog/variants-routes.js
import { Hono } from 'hono'
import { createOptionSchema, updateOptionSchema, createVariantSchema, updateVariantSchema } from './validators.js'

export function createVariantsRouter({ variantSvc, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/products/:id/options', requirePermission('catalog.products.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const data = await variantSvc.listOptions({ companyId, productId: c.req.param('id') })
      return c.json({ data })
    } catch (err) {
      console.error('[GET /catalog/products/:id/options]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/catalog/products/:id/options', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = createOptionSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await variantSvc.createOption({ companyId, productId: c.req.param('id'), data: parsed.data })
      return c.json({ data }, 201)
    } catch (err) {
      console.error('[POST /catalog/products/:id/options]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.patch('/catalog/products/:id/options/:optionId', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = updateOptionSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await variantSvc.updateOption({ companyId, optionId: c.req.param('optionId'), data: parsed.data })
      if (!data) return c.json({ error: 'Not found' }, 404)
      return c.json({ data })
    } catch (err) {
      console.error('[PATCH /catalog/products/:id/options/:optionId]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.delete('/catalog/products/:id/options/:optionId', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      await variantSvc.deleteOption({ companyId, optionId: c.req.param('optionId') })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/products/:id/options/:optionId]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/catalog/products/:id/variants', requirePermission('catalog.products.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const data = await variantSvc.listVariants({ companyId, productId: c.req.param('id') })
      return c.json({ data })
    } catch (err) {
      console.error('[GET /catalog/products/:id/variants]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/catalog/products/:id/variants', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = createVariantSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await variantSvc.createVariant({ companyId, productId: c.req.param('id'), data: parsed.data })
      return c.json({ data }, 201)
    } catch (err) {
      console.error('[POST /catalog/products/:id/variants]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.patch('/catalog/products/:id/variants/:variantId', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = updateVariantSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await variantSvc.updateVariant({ companyId, variantId: c.req.param('variantId'), data: parsed.data })
      if (!data) return c.json({ error: 'Not found' }, 404)
      return c.json({ data })
    } catch (err) {
      console.error('[PATCH /catalog/products/:id/variants/:variantId]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.delete('/catalog/products/:id/variants/:variantId', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      await variantSvc.deleteVariant({ companyId, variantId: c.req.param('variantId') })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/products/:id/variants/:variantId]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
```

- [ ] **Step 4: Create stock-routes.js**

```js
// apps/api/src/routes/catalog/stock-routes.js
import { Hono } from 'hono'
import { createStockMovementSchema } from './validators.js'
import {
  publishActivityFromContext,
  getActivityContext,
} from '../../services/activity-publisher.js'

export function createStockRouter({ stockSvc, prisma, requirePermission }) {
  const app = new Hono()

  app.post('/catalog/products/:id/stock-movements', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const userId    = c.get('userId') ?? null
      const parsed = createStockMovementSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await stockSvc.recordStockMovement({
        companyId,
        productId:     c.req.param('id'),
        variantId:     parsed.data.variant_id ?? null,
        quantityDelta: parsed.data.quantity_delta,
        reason:        parsed.data.reason,
        note:          parsed.data.note,
        userId,
      })
      const { actorName } = getActivityContext(c)
      const delta = parsed.data.quantity_delta
      const sign  = delta > 0 ? `+${delta}` : String(delta)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.stock.adjust',
        severity: delta > 0 ? 'success' : 'warning',
        entityType: 'CatalogProduct',
        entityId: c.req.param('id'),
        summary: `${actorName} ajustó stock ${sign} unidades${parsed.data.reason ? ` (${parsed.data.reason})` : ''}`,
        link: `/m/atlas.catalog/${c.req.param('id')}`,
      })
      return c.json({ data }, 201)
    } catch (err) {
      console.error('[POST /catalog/products/:id/stock-movements]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/catalog/products/:id/stock-movements', requirePermission('catalog.products.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const { variantId, limit, offset } = c.req.query()
      const result = await stockSvc.listStockMovements({
        companyId,
        productId:  c.req.param('id'),
        variantId:  variantId || undefined,
        limit:      limit  ? Number(limit)  : 50,
        offset:     offset ? Number(offset) : 0,
      })
      return c.json(result)
    } catch (err) {
      console.error('[GET /catalog/products/:id/stock-movements]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
```

- [ ] **Step 5: Create index.js (the catalog router factory)**

```js
// apps/api/src/routes/catalog/index.js
import { Hono } from 'hono'
import { createCatalogProductService } from './catalog-product-service.js'
import { createCatalogVariantService } from './catalog-variant-service.js'
import { createCatalogStockService }   from './catalog-stock-service.js'
import { createCategoriesRouter }      from './categories-routes.js'
import { createProductsRouter }        from './products-routes.js'
import { createVariantsRouter }        from './variants-routes.js'
import { createStockRouter }           from './stock-routes.js'

export function createCatalogRouter({ prisma, requirePermission }) {
  const app = new Hono()

  const productSvc = createCatalogProductService({ prisma })
  const variantSvc = createCatalogVariantService({ prisma })
  const stockSvc   = createCatalogStockService({ prisma })

  app.route('/', createCategoriesRouter({ productSvc, prisma, requirePermission }))
  app.route('/', createProductsRouter({ productSvc, prisma, requirePermission }))
  app.route('/', createVariantsRouter({ variantSvc, requirePermission }))
  app.route('/', createStockRouter({ stockSvc, prisma, requirePermission }))

  return app
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/catalog/
git commit -m "feat(catalog): add core catalog route files in apps/api/src/routes/catalog/"
```

---

## Task 5: Update apps/api/src/index.js

**Files:**
- Modify: `apps/api/src/index.js`

Three changes: (1) import `createCatalogRouter`, (2) add `"atlas.catalog"` to `CORE_MODULE_KEYS`, (3) call `mountWithAuth`.

- [ ] **Step 1: Add import for createCatalogRouter**

Find the block that imports the other routers (around line 52-56):

```js
import { createLedgerRouter } from "./routes/ledger/index.js";
import { createFleetRouter } from "./routes/fleet/index.js";
import { createCalendarRouter } from "./routes/calendar/index.js";
```

Add one line after `createCalendarRouter`:

```js
import { createCatalogRouter } from "./routes/catalog/index.js";
```

- [ ] **Step 2: Add "atlas.catalog" to CORE_MODULE_KEYS**

Find the `CORE_MODULE_KEYS` set (around line 93):

```js
const CORE_MODULE_KEYS = new Set([
  "atlas.core",
  "atlas.identity",
  "atlas.files",
  "atlas.company",
  "atlas.contacts",
  "atlas.hr",
  "atlas.fleet",
  "atlas.ledger",
  "atlas.calendar",
]);
```

Add `"atlas.catalog"` to the set:

```js
const CORE_MODULE_KEYS = new Set([
  "atlas.core",
  "atlas.identity",
  "atlas.files",
  "atlas.company",
  "atlas.contacts",
  "atlas.hr",
  "atlas.fleet",
  "atlas.ledger",
  "atlas.calendar",
  "atlas.catalog",
]);
```

- [ ] **Step 3: Mount catalog router via mountWithAuth**

Find the block at the end of the file that calls `mountWithAuth` for other routers (around line 3848-3854):

```js
mountWithAuth(app, createLedgerRouter({ prisma, requirePermission }));
mountWithAuth(app, createFleetRouter({ prisma, requirePermission }));
mountWithAuth(app, createCalendarRouter({ prisma, requirePermission }));
mountWithAuth(app, createActivityRouter({ prisma, requirePermission }));
mountWithAuth(app, createNotificationsRouter({ prisma, requirePermission }));
```

Add catalog after fleet:

```js
mountWithAuth(app, createLedgerRouter({ prisma, requirePermission }));
mountWithAuth(app, createFleetRouter({ prisma, requirePermission }));
mountWithAuth(app, createCatalogRouter({ prisma, requirePermission }));
mountWithAuth(app, createCalendarRouter({ prisma, requirePermission }));
mountWithAuth(app, createActivityRouter({ prisma, requirePermission }));
mountWithAuth(app, createNotificationsRouter({ prisma, requirePermission }));
```

- [ ] **Step 4: Update createPublicCatalogRouter to use the moved service**

In `apps/api/src/routes/public-website.js`, find the `createPublicCatalogRouter` function. It currently imports or instantiates a catalog public service directly. Update its import to use the moved service:

Search for where `createPublicCatalogRouter` is defined in `apps/api/src/routes/public-website.js`. Add this import at the top of that file if not already present:

```js
import { createCatalogPublicService } from './catalog/catalog-public-service.js'
```

Then inside `createPublicCatalogRouter({ prisma })`, instantiate it:

```js
const publicSvc = createCatalogPublicService({ prisma })
```

And replace any raw SQL queries with calls to `publicSvc.listPublicProducts(...)`, `publicSvc.getPublicProductBySlug(...)`, and `publicSvc.listPublicCategories(...)`.

> **Note:** If `createPublicCatalogRouter` in `public-website.js` already delegates to the AME3 module (unlikely) or is a stub, replace it entirely with:

```js
export function createPublicCatalogRouter({ prisma }) {
  const app = new Hono()
  const publicSvc = createCatalogPublicService({ prisma })

  app.get('/products', async (c) => {
    try {
      const { companyId, categorySlug, search, limit, offset } = c.req.query()
      if (!companyId) return c.json({ error: 'companyId required' }, 400)
      const result = await publicSvc.listPublicProducts({
        companyId,
        categorySlug: categorySlug || undefined,
        search:       search       || undefined,
        limit:        limit  ? Number(limit)  : 20,
        offset:       offset ? Number(offset) : 0,
      })
      return c.json(result)
    } catch (err) {
      console.error('[GET /public/catalog/products]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/products/:slug', async (c) => {
    try {
      const { companyId } = c.req.query()
      if (!companyId) return c.json({ error: 'companyId required' }, 400)
      const data = await publicSvc.getPublicProductBySlug({ companyId, slug: c.req.param('slug') })
      if (!data) return c.json({ error: 'Not found' }, 404)
      return c.json({ data })
    } catch (err) {
      console.error('[GET /public/catalog/products/:slug]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/categories', async (c) => {
    try {
      const { companyId } = c.req.query()
      if (!companyId) return c.json({ error: 'companyId required' }, 400)
      const data = await publicSvc.listPublicCategories({ companyId })
      return c.json({ data })
    } catch (err) {
      console.error('[GET /public/catalog/categories]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
```

Note: this router is mounted at `/public/catalog` in `index.js` so routes above are relative (no `/public/catalog` prefix needed).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.js apps/api/src/routes/public-website.js
git commit -m "feat(catalog): mount catalog core router in index.js, update CORE_MODULE_KEYS"
```

---

## Task 6: Update manifests — promote atlas.catalog to CORE

**Files:**
- Modify: `apps/api/src/manifests/official/feature-modules.js`
- Modify: `apps/api/src/manifests/official/core-modules.js`

- [ ] **Step 1: Fix and remove atlasCatalogManifest from feature-modules.js**

In `apps/api/src/manifests/official/feature-modules.js`:

1. Delete the entire `export const atlasCatalogManifest = createModuleManifest({ ... })` block (lines ~369–413). It is broken (navigation embedded in permissions) and being replaced.

2. Change the last line:
   ```js
   export const featureModules = [atlasCatalogManifest];
   ```
   to:
   ```js
   export const featureModules = [];
   ```

- [ ] **Step 2: Add atlasCatalogManifest to core-modules.js**

In `apps/api/src/manifests/official/core-modules.js`:

1. Add the corrected manifest before the `export const coreModules = [...]` line:

```js
export const atlasCatalogManifest = createModuleManifest({
  key: "atlas.catalog",
  name: "Catalogo",
  description: "Gestiona productos, categorias, variantes e inventario",
  version: "2.1.0",
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  icon: "ShoppingBag",
  color: "#F97316",
  accentColor: "#EA580C",
  initials: "CT",
  category: "comercial",
  logoUrl: "/module-logos/atlas-catalog-128.svg",
  summary: "Productos, categorias, variantes e inventario unificados.",
  dependencies: [{ key: "atlas.core" }],
  lifecycle: {
    installable: true,
    uninstallable: false,
    resettable: false,
    supportsDataPurge: true,
    defaultUninstallPolicy: "purge-owned-tables",
    ownedEntities: [
      "CatalogCategory",
      "CatalogProduct",
      "CatalogProductOption",
      "CatalogProductOptionValue",
      "CatalogProductVariant",
      "CatalogStockMovement",
    ],
    ownedTables: [
      "catalog_category",
      "catalog_product",
      "catalog_product_option",
      "catalog_product_option_value",
      "catalog_product_variant",
      "catalog_stock_movement",
    ],
    sharedEntities: ["Company"],
  },
  permissions: [
    { key: "catalog.access",            name: "Acceder al catalogo" },
    { key: "catalog.products.read",     name: "Ver productos" },
    { key: "catalog.products.create",   name: "Crear productos" },
    { key: "catalog.products.update",   name: "Editar productos" },
    { key: "catalog.products.delete",   name: "Eliminar productos" },
    { key: "catalog.categories.read",   name: "Ver categorias" },
    { key: "catalog.categories.create", name: "Crear categorias" },
    { key: "catalog.categories.update", name: "Editar categorias" },
    { key: "catalog.categories.delete", name: "Eliminar categorias" },
    { key: "catalog.inventory.adjust",  name: "Ajustar stock" },
  ],
  acl: {
    module: "catalog.access",
    actions: {
      "catalog.products.read":     "catalog.products.read",
      "catalog.products.create":   "catalog.products.create",
      "catalog.products.update":   "catalog.products.update",
      "catalog.products.delete":   "catalog.products.delete",
      "catalog.categories.read":   "catalog.categories.read",
      "catalog.categories.create": "catalog.categories.create",
      "catalog.categories.update": "catalog.categories.update",
      "catalog.categories.delete": "catalog.categories.delete",
      "catalog.inventory.adjust":  "catalog.inventory.adjust",
    },
    models: {
      CatalogProduct: {
        read:   "catalog.products.read",
        create: "catalog.products.create",
        update: "catalog.products.update",
        delete: "catalog.products.delete",
      },
      CatalogCategory: {
        read:   "catalog.categories.read",
        create: "catalog.categories.create",
        update: "catalog.categories.update",
        delete: "catalog.categories.delete",
      },
    },
  },
  navigation: [
    {
      label: "Productos",
      path: "/app/m/atlas.catalog",
      icon: "ShoppingCart",
      layout: "main",
      permissionKey: "catalog.products.read",
    },
    {
      label: "Categorias",
      path: "/app/m/atlas.catalog/categories",
      icon: "Tag",
      layout: "main",
      permissionKey: "catalog.categories.read",
    },
    {
      label: "Inventario",
      path: "/app/m/atlas.catalog/inventory",
      icon: "BarChart3",
      layout: "main",
      permissionKey: "catalog.products.read",
    },
  ],
  blueprints: [],
});
```

2. Add `atlasCatalogManifest` to the `coreModules` array:

```js
export const coreModules = [
  atlasCoreMap,
  identityMap,
  filesMap,
  companyMap,
  contactsMap,
  hrMap,
  atlasFleetManifest,
  atlasLedgerManifest,
  atlasWebsiteManifest,
  atlasCalendarManifest,
  activityMap,
  atlasCatalogManifest,
];
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/manifests/official/feature-modules.js \
        apps/api/src/manifests/official/core-modules.js
git commit -m "feat(catalog): promote atlas.catalog to core module in manifests"
```

---

## Task 7: Seed the updated manifest + verify DB

- [ ] **Step 1: Run seed to update atlas.catalog in the DB**

```bash
pnpm db:seed
```

Expected: the seed upserts `atlas.catalog` with `core: true`, `kind: CORE`, `uninstallable: false`.

- [ ] **Step 2: Verify via API that catalog routes work**

Start the API if not running:

```bash
pnpm dev:api
```

Then:

```bash
# Must return { data: [...] } — proves private route is working through core mount
curl -s http://localhost:4010/catalog/categories \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq 'keys'
# Expected: ["data"]

# Must return { data: [...], total: N }
curl -s "http://localhost:4010/catalog/products?limit=5" \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq 'keys'
# Expected: ["data","total"]

# Public route (no auth) — must still work
curl -s "http://localhost:4010/public/catalog/products?companyId=$COMPANY_ID" | jq 'keys'
# Expected: ["data","total"]
```

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore(catalog): verify core mount and seed after promotion to core"
```

---

## Task 8: Delete modules/official/atlas.catalog/

- [ ] **Step 1: Delete the AME3 module directory**

```bash
rm -rf modules/official/atlas.catalog
```

- [ ] **Step 2: Verify no remaining references to the deleted path**

```bash
grep -r "modules/official/atlas.catalog" apps/ packages/ prisma/ --include="*.js" --include="*.ts" --include="*.json" -l
```

Expected: no output. If any files appear, remove the references.

- [ ] **Step 3: Restart API and run smoke tests again**

```bash
pnpm dev:api
```

Watch startup logs. You should see the route-loader log `MISSING_API` for `atlas.catalog` (it gracefully skips it since the file no longer exists) but no crash. The routes are served by the core mount.

```bash
# Verify routes still work after deleting AME3 directory
curl -s http://localhost:4010/catalog/categories \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq 'keys'
# Expected: ["data"]

curl -s "http://localhost:4010/catalog/products?limit=5" \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq 'keys'
# Expected: ["data","total"]
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(catalog): delete AME3 module directory — atlas.catalog is now a core module"
```

---

## Verification checklist

After all tasks are complete, verify:

- [ ] `pnpm db:generate` produces no errors (schema is valid)
- [ ] `pnpm db:migrate` applied `20260601000000_add_catalog_core_tables` (or resolved as applied)
- [ ] `GET /catalog/categories` returns `{ data: [...] }` with auth token
- [ ] `GET /catalog/products?limit=5` returns `{ data: [...], total: N }` with auth token
- [ ] `GET /public/catalog/products?companyId=X` returns `{ data: [...], total: N }` without auth
- [ ] `POST /catalog/categories` creates a category (auth required, 409 on duplicate slug)
- [ ] `POST /catalog/products/:id/stock-movements` updates stock atomically (auth required)
- [ ] `modules/official/atlas.catalog/` directory no longer exists
- [ ] `atlasCatalogManifest` is in `core-modules.js` with `core: true`, `kind: CORE`
- [ ] `featureModules` array in `feature-modules.js` is empty (`[]`)
- [ ] `CORE_MODULE_KEYS` in `index.js` includes `"atlas.catalog"`
- [ ] API startup logs no crash from the route-loader (MISSING_API for atlas.catalog is acceptable)
- [ ] `pnpm db:seed` upserts atlas.catalog as a core module without errors

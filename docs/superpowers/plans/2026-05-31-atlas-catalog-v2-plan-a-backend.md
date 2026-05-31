# atlas.catalog v2 — Plan A: Backend (API + Models)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the atlas.catalog API with product variants, category hierarchy, stock movement history, and public website endpoints — all backed by four new Atlas ORM models.

**Architecture:** Two existing models gain new fields; four new Atlas ORM models are added (option, option_value, variant, stock_movement). `catalog-service.js` is renamed and split into four focused services (product, variant, stock, public). Five route files cover private management and unauthenticated public API. All model table provisioning goes through `POST /modules/sync`.

**Tech Stack:** Hono, Atlas ORM (`defineModel`), `prisma.$queryRaw` / `$queryRawUnsafe` / `$transaction`, Zod validators, PostgreSQL (UUID v7 via DB default).

---

## File map

```
modules/official/atlas.catalog/
  module.manifest.js                              MODIFY
  models/
    catalog-category.model.js                    MODIFY
    catalog-product.model.js                     MODIFY
    catalog-product-option.model.js              CREATE
    catalog-product-option-value.model.js        CREATE
    catalog-product-variant.model.js             CREATE
    catalog-stock-movement.model.js              CREATE
  api/
    index.js                                     MODIFY
    catalog-service.js                           RENAME → catalog-product-service.js + extend
    catalog-variant-service.js                   CREATE
    catalog-stock-service.js                     CREATE
    catalog-public-service.js                    CREATE
    categories-routes.js                         MODIFY
    products-routes.js                           MODIFY
    variants-routes.js                           CREATE
    stock-routes.js                              CREATE
    public-routes.js                             CREATE
  validators/
    index.js                                     MODIFY
```

---

## Task 1: Update manifest + update existing models

**Files:**
- Modify: `modules/official/atlas.catalog/module.manifest.js`
- Modify: `modules/official/atlas.catalog/models/catalog-category.model.js`
- Modify: `modules/official/atlas.catalog/models/catalog-product.model.js`

- [ ] **Step 1: Update module manifest**

Replace the full content of `module.manifest.js`:

```js
import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: 'atlas.catalog',
  name: 'Catalogo',
  description: 'Gestiona productos, categorias, variantes e inventario',
  icon: 'ShoppingBag',
  version: '2.0.0',
  kind: 'FEATURE',
  core: false,
  uninstallable: true,
  dependencies: [],
  permissions: [
    { key: 'catalog.access',            name: 'Acceder al catalogo' },
    { key: 'catalog.products.read',     name: 'Ver productos' },
    { key: 'catalog.products.create',   name: 'Crear productos' },
    { key: 'catalog.products.update',   name: 'Editar productos' },
    { key: 'catalog.products.delete',   name: 'Eliminar productos' },
    { key: 'catalog.categories.read',   name: 'Ver categorias' },
    { key: 'catalog.categories.create', name: 'Crear categorias' },
    { key: 'catalog.categories.update', name: 'Editar categorias' },
    { key: 'catalog.categories.delete', name: 'Eliminar categorias' },
    { key: 'catalog.inventory.adjust',  name: 'Ajustar stock' },
  ],
  navigation: [
    { label: 'Productos',  path: '/app/m/atlas.catalog',            icon: 'ShoppingBag', layout: 'main', permissionKey: 'catalog.products.read' },
    { label: 'Categorias', path: '/app/m/atlas.catalog/categories', icon: 'Tag',         layout: 'main', permissionKey: 'catalog.categories.read' },
    { label: 'Inventario', path: '/app/m/atlas.catalog/inventory',  icon: 'BarChart3',   layout: 'main', permissionKey: 'catalog.products.read' },
  ],
  blueprints: [],
  models: [
    './models/catalog-category.model.js',
    './models/catalog-product.model.js',
    './models/catalog-product-option.model.js',
    './models/catalog-product-option-value.model.js',
    './models/catalog-product-variant.model.js',
    './models/catalog-stock-movement.model.js',
  ],
})
```

- [ ] **Step 2: Update catalog-category model**

Replace the full content of `models/catalog-category.model.js`:

```js
import { defineModel } from '@atlas/module-engine'

export const catalogCategoryModel = defineModel({
  key:           'catalog_category',
  tableName:     'catalog_category',
  companyScoped: true,
  fields: [
    { name: 'parent_id',       type: 'relation',  required: false },
    { name: 'name',            type: 'text',      required: true },
    { name: 'slug',            type: 'text',      required: true },
    { name: 'description',     type: 'textarea',  required: false },
    { name: 'cover_asset_id',  type: 'relation',  required: false },
    { name: 'position',        type: 'number',    required: true, default: 0 },
    { name: 'enabled',         type: 'boolean',   required: true, default: true },
  ],
  indexes: [
    { fields: ['slug'], unique: true },
  ],
  foreignKeys: [
    {
      field:      'parent_id',
      references: { table: 'catalog_category', field: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
  ],
})
```

- [ ] **Step 3: Update catalog-product model**

Replace the full content of `models/catalog-product.model.js`:

```js
import { defineModel } from '@atlas/module-engine'

export const catalogProductModel = defineModel({
  key:           'catalog_product',
  tableName:     'catalog_product',
  companyScoped: true,
  fields: [
    { name: 'category_id',       type: 'relation',  required: false },
    { name: 'product_type',      type: 'text',      required: true,  default: 'SIMPLE' },
    { name: 'name',              type: 'text',      required: true },
    { name: 'slug',              type: 'text',      required: true },
    { name: 'description',       type: 'textarea',  required: false },
    { name: 'sku',               type: 'text',      required: false },
    { name: 'barcode',           type: 'text',      required: false },
    { name: 'price',             type: 'decimal',   required: true,  default: 0 },
    { name: 'compare_price',     type: 'decimal',   required: false },
    { name: 'currency',          type: 'text',      required: true,  default: 'USD' },
    { name: 'weight',            type: 'decimal',   required: false },
    { name: 'stock',             type: 'number',    required: true,  default: 0 },
    { name: 'track_stock',       type: 'boolean',   required: true,  default: false },
    { name: 'attributes',        type: 'json',      required: false, default: '[]' },
    { name: 'cover_asset_id',    type: 'relation',  required: false },
    { name: 'images',            type: 'json',      required: false, default: '[]' },
    { name: 'meta_title',        type: 'text',      required: false },
    { name: 'meta_description',  type: 'text',      required: false },
    { name: 'enabled',           type: 'boolean',   required: true,  default: true },
    { name: 'published',         type: 'boolean',   required: true,  default: false },
  ],
  indexes: [
    { fields: ['slug'], unique: true },
  ],
  foreignKeys: [
    {
      field:      'category_id',
      references: { table: 'catalog_category', field: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
  ],
})
```

- [ ] **Step 4: Commit**

```bash
git add modules/official/atlas.catalog/module.manifest.js \
        modules/official/atlas.catalog/models/catalog-category.model.js \
        modules/official/atlas.catalog/models/catalog-product.model.js
git commit -m "feat(catalog): update manifest and extend existing models for v2"
```

---

## Task 2: Create four new models

**Files:**
- Create: `modules/official/atlas.catalog/models/catalog-product-option.model.js`
- Create: `modules/official/atlas.catalog/models/catalog-product-option-value.model.js`
- Create: `modules/official/atlas.catalog/models/catalog-product-variant.model.js`
- Create: `modules/official/atlas.catalog/models/catalog-stock-movement.model.js`

- [ ] **Step 1: Create catalog-product-option model**

```js
// models/catalog-product-option.model.js
import { defineModel } from '@atlas/module-engine'

export const catalogProductOptionModel = defineModel({
  key:           'catalog_product_option',
  tableName:     'catalog_product_option',
  companyScoped: true,
  fields: [
    { name: 'product_id', type: 'relation', required: true },
    { name: 'name',       type: 'text',     required: true },
    { name: 'position',   type: 'number',   required: true, default: 0 },
  ],
  foreignKeys: [
    {
      field:      'product_id',
      references: { table: 'catalog_product', field: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
  ],
})
```

- [ ] **Step 2: Create catalog-product-option-value model**

```js
// models/catalog-product-option-value.model.js
import { defineModel } from '@atlas/module-engine'

export const catalogProductOptionValueModel = defineModel({
  key:           'catalog_product_option_value',
  tableName:     'catalog_product_option_value',
  companyScoped: true,
  fields: [
    { name: 'option_id', type: 'relation', required: true },
    { name: 'value',     type: 'text',     required: true },
    { name: 'position',  type: 'number',   required: true, default: 0 },
  ],
  foreignKeys: [
    {
      field:      'option_id',
      references: { table: 'catalog_product_option', field: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
  ],
})
```

- [ ] **Step 3: Create catalog-product-variant model**

```js
// models/catalog-product-variant.model.js
import { defineModel } from '@atlas/module-engine'

export const catalogProductVariantModel = defineModel({
  key:           'catalog_product_variant',
  tableName:     'catalog_product_variant',
  companyScoped: true,
  fields: [
    { name: 'product_id',     type: 'relation', required: true },
    { name: 'option_values',  type: 'json',     required: true, default: '{}' },
    { name: 'sku',            type: 'text',     required: false },
    { name: 'barcode',        type: 'text',     required: false },
    { name: 'price',          type: 'decimal',  required: true,  default: 0 },
    { name: 'compare_price',  type: 'decimal',  required: false },
    { name: 'stock',          type: 'number',   required: true,  default: 0 },
    { name: 'cover_asset_id', type: 'relation', required: false },
    { name: 'enabled',        type: 'boolean',  required: true,  default: true },
  ],
  foreignKeys: [
    {
      field:      'product_id',
      references: { table: 'catalog_product', field: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
  ],
})
```

- [ ] **Step 4: Create catalog-stock-movement model**

```js
// models/catalog-stock-movement.model.js
import { defineModel } from '@atlas/module-engine'

export const catalogStockMovementModel = defineModel({
  key:           'catalog_stock_movement',
  tableName:     'catalog_stock_movement',
  companyScoped: true,
  fields: [
    { name: 'product_id',      type: 'relation', required: true },
    { name: 'variant_id',      type: 'relation', required: false },
    { name: 'quantity_delta',  type: 'number',   required: true },
    { name: 'reason',          type: 'text',     required: false },
    { name: 'note',            type: 'text',     required: false },
    { name: 'user_id',         type: 'relation', required: false },
  ],
  foreignKeys: [
    {
      field:      'product_id',
      references: { table: 'catalog_product', field: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
    {
      field:      'variant_id',
      references: { table: 'catalog_product_variant', field: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
  ],
})
```

- [ ] **Step 5: Commit**

```bash
git add modules/official/atlas.catalog/models/
git commit -m "feat(catalog): add option, option-value, variant, stock-movement models"
```

---

## Task 3: Sync models and verify DB tables

**Prereq:** API must be running (`pnpm dev:api`). You must have a valid JWT for an admin user.

- [ ] **Step 1: Start the API if not already running**

```bash
pnpm dev:api
```

Wait until you see `Atlas API listening on port 4010`.

- [ ] **Step 2: Sync the catalog module models**

```bash
curl -s -X POST http://localhost:4010/modules/atlas.catalog/sync \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq .
```

Expected: `{ "ok": true }` or a success message. If you see errors about unknown field types or SQL generation failures, check the model files from Tasks 1–2.

- [ ] **Step 3: Verify new columns exist on catalog_category**

```bash
curl -s "http://localhost:4010/catalog/categories" \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq .
```

Expected: no error. Then check via Prisma Studio or a DB query that `catalog_category` has columns: `parent_id`, `cover_asset_id`, `position`.

- [ ] **Step 4: Verify new tables exist**

Run a quick check for each new table. If you have DB access:

```bash
# Via psql or Prisma Studio — check these tables exist:
# catalog_product_option
# catalog_product_option_value
# catalog_product_variant
# catalog_stock_movement
```

Or use the API health endpoint: `curl -s http://localhost:4010/health | jq .`

- [ ] **Step 5: Commit if sync succeeded with no errors**

```bash
git commit --allow-empty -m "chore(catalog): verify model sync for v2 tables"
```

---

## Task 4: Rename and extend catalog-product-service.js

**Files:**
- Rename: `modules/official/atlas.catalog/api/catalog-service.js` → `catalog-product-service.js`
- Modify: `modules/official/atlas.catalog/api/catalog-product-service.js`

The new service keeps all existing functions and adds: tree-format category listing, full product detail (with variants joined), and support for all new fields in create/update.

- [ ] **Step 1: Rename the file**

```bash
mv modules/official/atlas.catalog/api/catalog-service.js \
   modules/official/atlas.catalog/api/catalog-product-service.js
```

- [ ] **Step 2: Replace the full content of catalog-product-service.js**

```js
// modules/official/atlas.catalog/api/catalog-product-service.js

export function createCatalogProductService({ prisma }) {

  // ── Categories ──────────────────────────────────────────────────

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

  // ── Products ──────────────────────────────────────────────────

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

  async function deleteProduct({ companyId, id }) {
    await prisma.$queryRaw`
      UPDATE catalog_product SET enabled = false, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
  }

  return {
    listCategoriesTree,
    listCategories,
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

- [ ] **Step 3: Commit**

```bash
git add modules/official/atlas.catalog/api/catalog-product-service.js
git rm modules/official/atlas.catalog/api/catalog-service.js 2>/dev/null || true
git commit -m "feat(catalog): rename catalog-service → catalog-product-service, add tree + new fields"
```

---

## Task 5: Create catalog-variant-service.js

**Files:**
- Create: `modules/official/atlas.catalog/api/catalog-variant-service.js`

- [ ] **Step 1: Write the full variant service**

```js
// modules/official/atlas.catalog/api/catalog-variant-service.js

export function createCatalogVariantService({ prisma }) {

  // ── Options ──────────────────────────────────────────────────

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
    const [option] = await prisma.$queryRaw`
      INSERT INTO catalog_product_option (company_id, product_id, name, position)
      VALUES (${companyId}::uuid, ${productId}::uuid, ${data.name}, ${data.position ?? 0})
      RETURNING *
    `
    const values = []
    for (const [i, val] of (data.values ?? []).entries()) {
      const [row] = await prisma.$queryRaw`
        INSERT INTO catalog_product_option_value (company_id, option_id, value, position)
        VALUES (${companyId}::uuid, ${option.id}::uuid, ${val}, ${i})
        RETURNING *
      `
      values.push(row)
    }
    return { ...option, values }
  }

  async function updateOption({ companyId, optionId, data }) {
    if (data.name !== undefined || data.position !== undefined) {
      const map = { name: data.name, position: data.position }
      const entries = Object.entries(map).filter(([, v]) => v !== undefined)
      const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
      const values   = entries.map(([, v]) => v)
      const sql = `UPDATE catalog_product_option SET ${setParts}, updated_at = now()
                   WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid RETURNING *`
      await prisma.$queryRawUnsafe(sql, optionId, ...values, companyId)
    }
    if (data.values !== undefined) {
      await prisma.$queryRaw`
        DELETE FROM catalog_product_option_value WHERE option_id = ${optionId}::uuid
      `
      for (const [i, val] of data.values.entries()) {
        await prisma.$queryRaw`
          INSERT INTO catalog_product_option_value (company_id, option_id, value, position)
          VALUES (${companyId}::uuid, ${optionId}::uuid, ${val}, ${i})
        `
      }
    }
    const [updated] = await prisma.$queryRaw`
      SELECT * FROM catalog_product_option WHERE id = ${optionId}::uuid LIMIT 1
    `
    const values = await prisma.$queryRaw`
      SELECT * FROM catalog_product_option_value WHERE option_id = ${optionId}::uuid ORDER BY position ASC
    `
    return { ...updated, values }
  }

  async function deleteOption({ companyId, optionId }) {
    // cascade deletes option_values via FK
    await prisma.$queryRaw`
      DELETE FROM catalog_product_option
      WHERE id = ${optionId}::uuid AND company_id = ${companyId}::uuid
    `
  }

  // ── Variants ──────────────────────────────────────────────────

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

- [ ] **Step 2: Commit**

```bash
git add modules/official/atlas.catalog/api/catalog-variant-service.js
git commit -m "feat(catalog): add catalog-variant-service (options + variants CRUD)"
```

---

## Task 6: Create catalog-stock-service.js

**Files:**
- Create: `modules/official/atlas.catalog/api/catalog-stock-service.js`

- [ ] **Step 1: Write the full stock service**

```js
// modules/official/atlas.catalog/api/catalog-stock-service.js

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

- [ ] **Step 2: Commit**

```bash
git add modules/official/atlas.catalog/api/catalog-stock-service.js
git commit -m "feat(catalog): add catalog-stock-service with atomic stock movement recording"
```

---

## Task 7: Create catalog-public-service.js

**Files:**
- Create: `modules/official/atlas.catalog/api/catalog-public-service.js`

- [ ] **Step 1: Write the full public service**

```js
// modules/official/atlas.catalog/api/catalog-public-service.js

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

- [ ] **Step 2: Commit**

```bash
git add modules/official/atlas.catalog/api/catalog-public-service.js
git commit -m "feat(catalog): add catalog-public-service for unauthenticated website API"
```

---

## Task 8: Update route files + validators

**Files:**
- Modify: `modules/official/atlas.catalog/api/categories-routes.js`
- Modify: `modules/official/atlas.catalog/api/products-routes.js`
- Modify: `modules/official/atlas.catalog/validators/index.js`

- [ ] **Step 1: Replace categories-routes.js**

```js
// modules/official/atlas.catalog/api/categories-routes.js
import { Hono } from 'hono'
import { createCategorySchema, updateCategorySchema } from '../validators/index.js'

export function createCategoriesRouter({ productSvc, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/categories', requirePermission('catalog.categories.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const { flat } = c.req.query()
      const data = flat === 'true'
        ? await productSvc.listCategories({ companyId })
        : await productSvc.listCategoriesTree({ companyId })
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
      await productSvc.deleteCategory({ companyId, id: c.req.param('id') })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/categories/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
```

- [ ] **Step 2: Replace products-routes.js**

```js
// modules/official/atlas.catalog/api/products-routes.js
import { Hono } from 'hono'
import { createProductSchema, updateProductSchema } from '../validators/index.js'

export function createProductsRouter({ productSvc, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/products', requirePermission('catalog.products.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const { categoryId, type, published, search, limit, offset } = c.req.query()
      const result = await productSvc.listProducts({
        companyId,
        categoryId: categoryId || undefined,
        type:       type       || undefined,
        published:  published  !== undefined ? published : undefined,
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
      return c.json({ data: row })
    } catch (err) {
      console.error('[POST /catalog/products/:id/unpublish]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.delete('/catalog/products/:id', requirePermission('catalog.products.delete'), async (c) => {
    try {
      const companyId = c.get('companyId')
      await productSvc.deleteProduct({ companyId, id: c.req.param('id') })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/products/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
```

- [ ] **Step 3: Replace validators/index.js**

```js
// modules/official/atlas.catalog/validators/index.js
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

export const updateProductSchema = createProductSchema.partial()

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

- [ ] **Step 4: Commit**

```bash
git add modules/official/atlas.catalog/api/categories-routes.js \
        modules/official/atlas.catalog/api/products-routes.js \
        modules/official/atlas.catalog/validators/index.js
git commit -m "feat(catalog): update categories/products routes and validators for v2 fields"
```

---

## Task 9: Create variants-routes.js, stock-routes.js, public-routes.js

**Files:**
- Create: `modules/official/atlas.catalog/api/variants-routes.js`
- Create: `modules/official/atlas.catalog/api/stock-routes.js`
- Create: `modules/official/atlas.catalog/api/public-routes.js`

- [ ] **Step 1: Create variants-routes.js**

```js
// modules/official/atlas.catalog/api/variants-routes.js
import { Hono } from 'hono'
import { createOptionSchema, updateOptionSchema, createVariantSchema, updateVariantSchema } from '../validators/index.js'

export function createVariantsRouter({ variantSvc, requirePermission }) {
  const app = new Hono()

  // Options
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

  // Variants
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

- [ ] **Step 2: Create stock-routes.js**

```js
// modules/official/atlas.catalog/api/stock-routes.js
import { Hono } from 'hono'
import { createStockMovementSchema } from '../validators/index.js'

export function createStockRouter({ stockSvc, requirePermission }) {
  const app = new Hono()

  app.post('/catalog/products/:id/stock-movements', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const userId    = c.get('userId')
      const parsed = createStockMovementSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await stockSvc.recordStockMovement({
        companyId,
        productId:     c.req.param('id'),
        variantId:     parsed.data.variant_id ?? null,
        quantityDelta: parsed.data.quantity_delta,
        reason:        parsed.data.reason,
        note:          parsed.data.note,
        userId:        userId ?? null,
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

- [ ] **Step 3: Create public-routes.js**

```js
// modules/official/atlas.catalog/api/public-routes.js
import { Hono } from 'hono'

export function createPublicRouter({ publicSvc }) {
  const app = new Hono()

  app.get('/public/catalog/products', async (c) => {
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

  app.get('/public/catalog/products/:slug', async (c) => {
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

  app.get('/public/catalog/categories', async (c) => {
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

- [ ] **Step 4: Commit**

```bash
git add modules/official/atlas.catalog/api/variants-routes.js \
        modules/official/atlas.catalog/api/stock-routes.js \
        modules/official/atlas.catalog/api/public-routes.js
git commit -m "feat(catalog): add variants, stock, and public route files"
```

---

## Task 10: Update api/index.js + smoke tests + final commit

**Files:**
- Modify: `modules/official/atlas.catalog/api/index.js`

- [ ] **Step 1: Replace api/index.js**

```js
// modules/official/atlas.catalog/api/index.js
import { Hono } from 'hono'
import { createCatalogProductService } from './catalog-product-service.js'
import { createCatalogVariantService } from './catalog-variant-service.js'
import { createCatalogStockService }   from './catalog-stock-service.js'
import { createCatalogPublicService }  from './catalog-public-service.js'
import { createCategoriesRouter }      from './categories-routes.js'
import { createProductsRouter }        from './products-routes.js'
import { createVariantsRouter }        from './variants-routes.js'
import { createStockRouter }           from './stock-routes.js'
import { createPublicRouter }          from './public-routes.js'

export default function createCatalogRouter({ prisma, requirePermission }) {
  const app = new Hono()

  const productSvc = createCatalogProductService({ prisma })
  const variantSvc = createCatalogVariantService({ prisma })
  const stockSvc   = createCatalogStockService({ prisma })
  const publicSvc  = createCatalogPublicService({ prisma })

  app.route('/', createCategoriesRouter({ productSvc, requirePermission }))
  app.route('/', createProductsRouter({ productSvc, requirePermission }))
  app.route('/', createVariantsRouter({ variantSvc, requirePermission }))
  app.route('/', createStockRouter({ stockSvc, requirePermission }))
  app.route('/', createPublicRouter({ publicSvc }))

  return app
}
```

- [ ] **Step 2: Restart API and run smoke tests**

Restart the API: `pnpm dev:api`

Then run these checks (replace `$ATLAS_TOKEN` and `$COMPANY_ID` with your values):

```bash
# 1. Categories tree
curl -s http://localhost:4010/catalog/categories \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq 'keys'
# Expected: ["data"]

# 2. Products list with total
curl -s "http://localhost:4010/catalog/products?limit=5" \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq 'keys'
# Expected: ["data","total"]

# 3. Create a VARIABLE product
curl -s -X POST http://localhost:4010/catalog/products \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Camiseta Test","slug":"camiseta-test","price":25,"product_type":"VARIABLE"}' | jq .data.id
# Expected: a UUID string

# 4. Add an option to the product (replace PRODUCT_ID)
curl -s -X POST http://localhost:4010/catalog/products/$PRODUCT_ID/options \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Talla","values":["S","M","L"]}' | jq .data.name
# Expected: "Talla"

# 5. Record a stock movement (SIMPLE product)
curl -s -X POST http://localhost:4010/catalog/products/$SIMPLE_PRODUCT_ID/stock-movements \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity_delta":10,"reason":"Compra inicial"}' | jq .data.quantity_delta
# Expected: 10

# 6. Public endpoint
curl -s "http://localhost:4010/public/catalog/products?companyId=$COMPANY_ID" | jq 'keys'
# Expected: ["data","total"]
```

- [ ] **Step 3: Final commit**

```bash
git add modules/official/atlas.catalog/api/index.js
git commit -m "feat(catalog): wire all v2 services and routers in api/index.js"
```

---

## Verification checklist

After all tasks complete, verify:

- [ ] `catalog_category` has columns: `parent_id`, `cover_asset_id`, `position`
- [ ] `catalog_product` has columns: `product_type`, `sku`, `barcode`, `weight`, `attributes`, `meta_title`, `meta_description`
- [ ] Tables exist: `catalog_product_option`, `catalog_product_option_value`, `catalog_product_variant`, `catalog_stock_movement`
- [ ] `GET /catalog/categories` returns nested tree format
- [ ] `GET /catalog/products` returns `{ data, total }` shape
- [ ] `POST /catalog/products/:id/publish` toggles published flag
- [ ] `POST /catalog/products/:id/options` creates option with values
- [ ] `POST /catalog/products/:id/stock-movements` updates stock atomically
- [ ] `GET /public/catalog/products?companyId=X` works without auth
- [ ] No reference to the old `catalogSvc` / `catalog-service.js` remains anywhere

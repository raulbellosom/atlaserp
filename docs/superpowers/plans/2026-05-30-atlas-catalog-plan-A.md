# atlas.catalog — Plan A: AME3 Module + API

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `atlas.catalog` AME3 feature module with two models (`catalog_category`, `catalog_product`), full private CRUD API, and public read API consumed by the website renderer.

**Architecture:** `atlas.catalog` is an AME3 custom module living at `modules/official/atlas.catalog/`. Tables are managed by Atlas ORM via `defineModel` — never via Prisma schema. The route loader auto-discovers the module's `api/index.js` at boot when installed. Private routes require auth; public routes are mounted in `apps/api/src/routes/public-website.js`.

**Tech Stack:** AME3 (`defineAtlasModule`, `defineModel`), Hono, Prisma `$queryRaw`, Zod, Node.js

---

## File Map

### Create
- `modules/official/atlas.catalog/module.manifest.js` — AME3 manifest declaration
- `modules/official/atlas.catalog/models/catalog-category.model.js` — defineModel for categories
- `modules/official/atlas.catalog/models/catalog-product.model.js` — defineModel for products
- `modules/official/atlas.catalog/validators/index.js` — Zod schemas for catalog
- `modules/official/atlas.catalog/api/catalog-service.js` — service layer (createCatalogService)
- `modules/official/atlas.catalog/api/categories-routes.js` — CRUD categories
- `modules/official/atlas.catalog/api/products-routes.js` — CRUD products
- `modules/official/atlas.catalog/api/index.js` — Hono router factory (AME3 entry point)

### Modify
- `apps/api/src/manifests/official/feature-modules.js` — add `atlas.catalog` manifest entry
- `apps/api/src/routes/public-website.js` — add `GET /public/catalog/products` and `GET /public/catalog/categories`

---

## Task 1 — Module manifest

**Files:**
- Create: `modules/official/atlas.catalog/module.manifest.js`

- [ ] **Step 1: Create the module directory structure**

  ```bash
  mkdir -p modules/official/atlas.catalog/models
  mkdir -p modules/official/atlas.catalog/api
  mkdir -p modules/official/atlas.catalog/validators
  ```

- [ ] **Step 2: Create module.manifest.js**

  ```js
  // modules/official/atlas.catalog/module.manifest.js
  import { defineAtlasModule } from '@atlas/module-engine'
  import { catalogCategoryModel } from './models/catalog-category.model.js'
  import { catalogProductModel } from './models/catalog-product.model.js'

  export default defineAtlasModule({
    key: 'atlas.catalog',
    name: 'Catalogo',
    version: '1.0.0',
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
    ],
    navigation: [
      { label: 'Catalogo',    path: '/app/m/atlas.catalog',             icon: 'ShoppingBag', layout: 'main', permissionKey: 'catalog.access' },
      { label: 'Productos',   path: '/app/m/atlas.catalog',             icon: 'Package',     layout: 'main', permissionKey: 'catalog.products.read' },
      { label: 'Categorias',  path: '/app/m/atlas.catalog/categories',  icon: 'Tag',         layout: 'main', permissionKey: 'catalog.categories.read' },
    ],
    blueprints: [],
    models: [catalogCategoryModel, catalogProductModel],
  })
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check modules/official/atlas.catalog/module.manifest.js
  ```
  Expected: no output (clean).

---

## Task 2 — Model: catalog_category

**Files:**
- Create: `modules/official/atlas.catalog/models/catalog-category.model.js`

- [ ] **Step 1: Create the model**

  ```js
  // modules/official/atlas.catalog/models/catalog-category.model.js
  import { defineModel } from '@atlas/module-engine'

  export const catalogCategoryModel = defineModel({
    name: 'catalog_category',
    fields: [
      { name: 'company_id', type: 'uuid',    required: true },
      { name: 'name',       type: 'text',    required: true },
      { name: 'slug',       type: 'text',    required: true },
      { name: 'description',type: 'text',    required: false },
      { name: 'enabled',    type: 'boolean', required: true, default: true },
    ],
    timestamps: true,
  })
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check modules/official/atlas.catalog/models/catalog-category.model.js
  ```

---

## Task 3 — Model: catalog_product

**Files:**
- Create: `modules/official/atlas.catalog/models/catalog-product.model.js`

- [ ] **Step 1: Create the model**

  ```js
  // modules/official/atlas.catalog/models/catalog-product.model.js
  import { defineModel } from '@atlas/module-engine'

  export const catalogProductModel = defineModel({
    name: 'catalog_product',
    fields: [
      { name: 'company_id',      type: 'uuid',    required: true },
      { name: 'category_id',     type: 'uuid',    required: false },
      { name: 'name',            type: 'text',    required: true },
      { name: 'slug',            type: 'text',    required: true },
      { name: 'description',     type: 'text',    required: false },
      { name: 'price',           type: 'numeric', required: true, default: 0 },
      { name: 'compare_price',   type: 'numeric', required: false },
      { name: 'currency',        type: 'text',    required: true, default: 'USD' },
      { name: 'stock',           type: 'integer', required: true, default: 0 },
      { name: 'track_stock',     type: 'boolean', required: true, default: false },
      { name: 'cover_asset_id',  type: 'uuid',    required: false },
      { name: 'images',          type: 'jsonb',   required: false, default: '[]' },
      { name: 'enabled',         type: 'boolean', required: true, default: true },
      { name: 'published',       type: 'boolean', required: true, default: false },
    ],
    timestamps: true,
  })
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check modules/official/atlas.catalog/models/catalog-product.model.js
  ```

---

## Task 4 — Validators

**Files:**
- Create: `modules/official/atlas.catalog/validators/index.js`

- [ ] **Step 1: Create Zod schemas**

  ```js
  // modules/official/atlas.catalog/validators/index.js
  import { z } from 'zod'

  export const createCategorySchema = z.object({
    name:        z.string().min(1).max(120),
    slug:        z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
    description: z.string().max(500).optional(),
  })

  export const updateCategorySchema = createCategorySchema.partial()

  export const createProductSchema = z.object({
    name:          z.string().min(1).max(200),
    slug:          z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
    description:   z.string().max(2000).optional(),
    price:         z.number().min(0),
    compare_price: z.number().min(0).optional().nullable(),
    currency:      z.string().length(3).default('USD'),
    stock:         z.number().int().min(0).default(0),
    track_stock:   z.boolean().default(false),
    cover_asset_id:z.string().uuid().optional().nullable(),
    images:        z.array(z.string().uuid()).default([]),
    category_id:   z.string().uuid().optional().nullable(),
    published:     z.boolean().default(false),
  })

  export const updateProductSchema = createProductSchema.partial()
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check modules/official/atlas.catalog/validators/index.js
  ```

---

## Task 5 — Catalog service

**Files:**
- Create: `modules/official/atlas.catalog/api/catalog-service.js`

- [ ] **Step 1: Create the service**

  ```js
  // modules/official/atlas.catalog/api/catalog-service.js

  export function createCatalogService({ prisma }) {
    // ── Categories ──────────────────────────────────────────────────

    async function listCategories({ companyId }) {
      return prisma.$queryRaw`
        SELECT id, name, slug, description, enabled, created_at, updated_at
        FROM catalog_category
        WHERE company_id = ${companyId}::uuid AND enabled = true
        ORDER BY name ASC
      `
    }

    async function createCategory({ companyId, data }) {
      const rows = await prisma.$queryRaw`
        INSERT INTO catalog_category (company_id, name, slug, description)
        VALUES (${companyId}::uuid, ${data.name}, ${data.slug}, ${data.description ?? null})
        RETURNING *
      `
      return rows[0]
    }

    async function updateCategory({ companyId, id, data }) {
      const sets = []
      const values = []

      if (data.name        !== undefined) { sets.push(`name = $${sets.length + 2}`)        ; values.push(data.name) }
      if (data.slug        !== undefined) { sets.push(`slug = $${sets.length + 2}`)        ; values.push(data.slug) }
      if (data.description !== undefined) { sets.push(`description = $${sets.length + 2}`); values.push(data.description) }

      if (!sets.length) return getCategoryById({ companyId, id })

      sets.push(`updated_at = now()`)
      const sql = `UPDATE catalog_category SET ${sets.join(', ')} WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid RETURNING *`
      const rows = await prisma.$queryRawUnsafe(sql, id, ...values, companyId)
      return rows[0] ?? null
    }

    async function getCategoryById({ companyId, id }) {
      const rows = await prisma.$queryRaw`
        SELECT * FROM catalog_category
        WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
        LIMIT 1
      `
      return rows[0] ?? null
    }

    async function deleteCategory({ companyId, id }) {
      await prisma.$queryRaw`
        UPDATE catalog_category SET enabled = false, updated_at = now()
        WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
      `
    }

    // ── Products ──────────────────────────────────────────────────

    async function listProducts({ companyId, categoryId, search, limit = 50, offset = 0 }) {
      const rows = await prisma.$queryRaw`
        SELECT p.*, c.name AS category_name
        FROM catalog_product p
        LEFT JOIN catalog_category c ON c.id = p.category_id
        WHERE p.company_id = ${companyId}::uuid
          AND p.enabled = true
          ${categoryId ? prisma.$raw`AND p.category_id = ${categoryId}::uuid` : prisma.$raw``}
          ${search ? prisma.$raw`AND p.name ILIKE ${'%' + search + '%'}` : prisma.$raw``}
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      return rows
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
          (company_id, category_id, name, slug, description, price, compare_price,
           currency, stock, track_stock, cover_asset_id, images, published)
        VALUES (
          ${companyId}::uuid,
          ${data.category_id ?? null}::uuid,
          ${data.name},
          ${data.slug},
          ${data.description ?? null},
          ${data.price},
          ${data.compare_price ?? null},
          ${data.currency ?? 'USD'},
          ${data.stock ?? 0},
          ${data.track_stock ?? false},
          ${data.cover_asset_id ?? null}::uuid,
          ${JSON.stringify(data.images ?? [])}::jsonb,
          ${data.published ?? false}
        )
        RETURNING *
      `
      return rows[0]
    }

    async function updateProduct({ companyId, id, data }) {
      const fields = {
        name:           data.name,
        slug:           data.slug,
        description:    data.description,
        price:          data.price,
        compare_price:  data.compare_price,
        currency:       data.currency,
        stock:          data.stock,
        track_stock:    data.track_stock,
        cover_asset_id: data.cover_asset_id,
        images:         data.images !== undefined ? JSON.stringify(data.images) : undefined,
        category_id:    data.category_id,
        published:      data.published,
      }

      const entries = Object.entries(fields).filter(([, v]) => v !== undefined)
      if (!entries.length) return getProductById({ companyId, id })

      const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
      const values   = entries.map(([, v]) => v)
      const sql      = `UPDATE catalog_product SET ${setParts}, updated_at = now() WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid AND enabled = true RETURNING *`
      const rows     = await prisma.$queryRawUnsafe(sql, id, ...values, companyId)
      return rows[0] ?? null
    }

    async function deleteProduct({ companyId, id }) {
      await prisma.$queryRaw`
        UPDATE catalog_product SET enabled = false, updated_at = now()
        WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
      `
    }

    async function listPublicProducts({ companyId, categoryId, limit = 20 }) {
      return prisma.$queryRaw`
        SELECT id, name, slug, description, price, compare_price, currency,
               stock, track_stock, cover_asset_id, images, category_id
        FROM catalog_product
        WHERE company_id = ${companyId}::uuid
          AND enabled = true
          AND published = true
          ${categoryId ? prisma.$raw`AND category_id = ${categoryId}::uuid` : prisma.$raw``}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }

    return {
      listCategories, createCategory, updateCategory, getCategoryById, deleteCategory,
      listProducts, getProductById, createProduct, updateProduct, deleteProduct,
      listPublicProducts,
    }
  }
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check modules/official/atlas.catalog/api/catalog-service.js
  ```

---

## Task 6 — Categories routes

**Files:**
- Create: `modules/official/atlas.catalog/api/categories-routes.js`

- [ ] **Step 1: Create categories router**

  ```js
  // modules/official/atlas.catalog/api/categories-routes.js
  import { Hono } from 'hono'
  import { zValidator } from '@hono/zod-validator'
  import { createCategorySchema, updateCategorySchema } from '../validators/index.js'

  export function createCategoriesRouter({ catalogSvc, requirePermission }) {
    const app = new Hono()

    app.get('/catalog/categories', requirePermission('catalog.categories.read'), async (c) => {
      const companyId = c.get('companyId')
      const data = await catalogSvc.listCategories({ companyId })
      return c.json({ data })
    })

    app.post(
      '/catalog/categories',
      requirePermission('catalog.categories.create'),
      zValidator('json', createCategorySchema),
      async (c) => {
        const companyId = c.get('companyId')
        const data = c.req.valid('json')
        const row = await catalogSvc.createCategory({ companyId, data })
        return c.json({ data: row }, 201)
      },
    )

    app.patch(
      '/catalog/categories/:id',
      requirePermission('catalog.categories.update'),
      zValidator('json', updateCategorySchema),
      async (c) => {
        const companyId = c.get('companyId')
        const id = c.req.param('id')
        const data = c.req.valid('json')
        const row = await catalogSvc.updateCategory({ companyId, id, data })
        if (!row) return c.json({ error: 'Not found' }, 404)
        return c.json({ data: row })
      },
    )

    app.delete(
      '/catalog/categories/:id',
      requirePermission('catalog.categories.delete'),
      async (c) => {
        const companyId = c.get('companyId')
        const id = c.req.param('id')
        await catalogSvc.deleteCategory({ companyId, id })
        return c.json({ ok: true })
      },
    )

    return app
  }
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check modules/official/atlas.catalog/api/categories-routes.js
  ```

---

## Task 7 — Products routes

**Files:**
- Create: `modules/official/atlas.catalog/api/products-routes.js`

- [ ] **Step 1: Create products router**

  ```js
  // modules/official/atlas.catalog/api/products-routes.js
  import { Hono } from 'hono'
  import { zValidator } from '@hono/zod-validator'
  import { createProductSchema, updateProductSchema } from '../validators/index.js'

  export function createProductsRouter({ catalogSvc, requirePermission }) {
    const app = new Hono()

    app.get('/catalog/products', requirePermission('catalog.products.read'), async (c) => {
      const companyId = c.get('companyId')
      const { categoryId, search, limit, offset } = c.req.query()
      const data = await catalogSvc.listProducts({
        companyId,
        categoryId: categoryId || undefined,
        search:     search     || undefined,
        limit:      limit  ? Number(limit)  : 50,
        offset:     offset ? Number(offset) : 0,
      })
      return c.json({ data })
    })

    app.get('/catalog/products/:id', requirePermission('catalog.products.read'), async (c) => {
      const companyId = c.get('companyId')
      const id = c.req.param('id')
      const row = await catalogSvc.getProductById({ companyId, id })
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json({ data: row })
    })

    app.post(
      '/catalog/products',
      requirePermission('catalog.products.create'),
      zValidator('json', createProductSchema),
      async (c) => {
        const companyId = c.get('companyId')
        const data = c.req.valid('json')
        const row = await catalogSvc.createProduct({ companyId, data })
        return c.json({ data: row }, 201)
      },
    )

    app.patch(
      '/catalog/products/:id',
      requirePermission('catalog.products.update'),
      zValidator('json', updateProductSchema),
      async (c) => {
        const companyId = c.get('companyId')
        const id = c.req.param('id')
        const data = c.req.valid('json')
        const row = await catalogSvc.updateProduct({ companyId, id, data })
        if (!row) return c.json({ error: 'Not found' }, 404)
        return c.json({ data: row })
      },
    )

    app.delete(
      '/catalog/products/:id',
      requirePermission('catalog.products.delete'),
      async (c) => {
        const companyId = c.get('companyId')
        const id = c.req.param('id')
        await catalogSvc.deleteProduct({ companyId, id })
        return c.json({ ok: true })
      },
    )

    return app
  }
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check modules/official/atlas.catalog/api/products-routes.js
  ```

---

## Task 8 — Module api/index.js (AME3 entry point)

**Files:**
- Create: `modules/official/atlas.catalog/api/index.js`

The route loader imports this file and calls the default export as a factory `(deps) => HonoApp`.

- [ ] **Step 1: Create the factory**

  ```js
  // modules/official/atlas.catalog/api/index.js
  import { Hono } from 'hono'
  import { createCatalogService } from './catalog-service.js'
  import { createCategoriesRouter } from './categories-routes.js'
  import { createProductsRouter } from './products-routes.js'

  export default function createCatalogRouter({ prisma, requirePermission }) {
    const app = new Hono()
    const catalogSvc = createCatalogService({ prisma })

    app.route('/', createCategoriesRouter({ catalogSvc, requirePermission }))
    app.route('/', createProductsRouter({ catalogSvc, requirePermission }))

    return app
  }
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check modules/official/atlas.catalog/api/index.js
  ```

---

## Task 9 — Add public catalog endpoints

**Files:**
- Modify: `apps/api/src/routes/public-website.js`

The public catalog endpoints are unauthenticated and consumed by the website renderer. They are mounted alongside the existing `/public/website/*` routes.

- [ ] **Step 1: Read the current file to find the correct injection point**

  Read `apps/api/src/routes/public-website.js` and locate the `createPublicWebsiteRouter` function. The public catalog routes go in a new `createPublicCatalogRouter` function in the same file.

- [ ] **Step 2: Add public catalog router at the end of the file (before the last closing brace)**

  Append a new exported function `createPublicCatalogRouter` to `apps/api/src/routes/public-website.js`:

  ```js
  export function createPublicCatalogRouter({ prisma }) {
    const app = new Hono()

    app.get('/categories', async (c) => {
      try {
        const companyId = await getActiveCompanyId(prisma)
        if (!companyId) return c.json({ data: [] })

        const rows = await prisma.$queryRaw`
          SELECT id, name, slug, description
          FROM catalog_category
          WHERE company_id = ${companyId}::uuid AND enabled = true
          ORDER BY name ASC
        `
        return c.json({ data: rows })
      } catch (err) {
        if (err?.message?.includes('does not exist') || err?.code === '42P01') return c.json({ data: [] })
        return c.json({ data: [] }, 500)
      }
    })

    app.get('/products', async (c) => {
      try {
        const companyId = await getActiveCompanyId(prisma)
        if (!companyId) return c.json({ data: [] })

        const { categoryId, limit = '20' } = c.req.query()
        const rows = await prisma.$queryRaw`
          SELECT id, name, slug, description, price, compare_price, currency,
                 stock, track_stock, cover_asset_id, images, category_id
          FROM catalog_product
          WHERE company_id = ${companyId}::uuid
            AND enabled = true
            AND published = true
            ${categoryId ? prisma.$raw`AND category_id = ${categoryId}::uuid` : prisma.$raw``}
          ORDER BY created_at DESC
          LIMIT ${Number(limit)}
        `
        return c.json({ data: rows })
      } catch (err) {
        if (err?.message?.includes('does not exist') || err?.code === '42P01') return c.json({ data: [] })
        return c.json({ data: [] }, 500)
      }
    })

    return app
  }

  async function getActiveCompanyId(prisma) {
    const company = await prisma.company.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    return company?.id ?? null
  }
  ```

  Note: the `getActiveCompanyId` helper may already exist in the file — if so, reuse it instead of adding a duplicate.

- [ ] **Step 3: Mount the public catalog router in apps/api/src/index.js**

  In `apps/api/src/index.js`, locate where `createPublicWebsiteRouter` is imported and mounted. Add the catalog router next to it:

  ```js
  import { createPublicWebsiteRouter, createPublicCatalogRouter } from './routes/public-website.js'
  ```

  And mount it:
  ```js
  const publicCatalogRouter = createPublicCatalogRouter({ prisma })
  app.route('/public/catalog', publicCatalogRouter)
  ```

- [ ] **Step 4: Verify syntax**

  ```bash
  node --check apps/api/src/routes/public-website.js
  node --check apps/api/src/index.js
  ```

---

## Task 10 — Register atlas.catalog in official feature manifest

**Files:**
- Modify: `apps/api/src/manifests/official/feature-modules.js`

- [ ] **Step 1: Read the file to find the existing array of feature modules**

  Open `apps/api/src/manifests/official/feature-modules.js` and find where modules are declared.

- [ ] **Step 2: Add atlas.catalog entry**

  Add the following entry to the feature modules array (after `atlas.website` entry or at the end of the feature modules list):

  ```js
  {
    key: 'atlas.catalog',
    name: 'Catalogo',
    version: '1.0.0',
    kind: 'FEATURE',
    core: false,
    uninstallable: true,
    dependencies: [],
    permissions: [
      { key: 'catalog.access',            label: 'Acceder al catalogo' },
      { key: 'catalog.products.read',     label: 'Ver productos' },
      { key: 'catalog.products.create',   label: 'Crear productos' },
      { key: 'catalog.products.update',   label: 'Editar productos' },
      { key: 'catalog.products.delete',   label: 'Eliminar productos' },
      { key: 'catalog.categories.read',   label: 'Ver categorias' },
      { key: 'catalog.categories.create', label: 'Crear categorias' },
      { key: 'catalog.categories.update', label: 'Editar categorias' },
      { key: 'catalog.categories.delete', label: 'Eliminar categorias' },
    ],
    navigation: [
      { label: 'Productos',  path: '/app/m/atlas.catalog',            icon: 'Package',     layout: 'main', permissionKey: 'catalog.products.read' },
      { label: 'Categorias', path: '/app/m/atlas.catalog/categories', icon: 'Tag',         layout: 'main', permissionKey: 'catalog.categories.read' },
    ],
    blueprints: [],
  },
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/api/src/manifests/official/feature-modules.js
  ```

---

## Task 11 — Install, sync, and smoke-test

- [ ] **Step 1: Start the API**

  ```bash
  pnpm dev:api
  ```

- [ ] **Step 2: Install atlas.catalog via the module lifecycle API**

  With the API running, get a valid auth token first (login via the app or use an existing session). Then:

  ```bash
  curl -X POST http://localhost:4010/modules/atlas.catalog/install \
    -H "Authorization: Bearer $ATLAS_TOKEN" \
    -H "Content-Type: application/json"
  ```
  Expected: `{ "ok": true }` or `{ "status": "INSTALLED" }`

- [ ] **Step 3: Sync module (creates DB tables)**

  ```bash
  curl -X POST http://localhost:4010/modules/atlas.catalog/sync \
    -H "Authorization: Bearer $ATLAS_TOKEN"
  ```
  Expected: `{ "ok": true }` — this creates `catalog_category` and `catalog_product` tables.

- [ ] **Step 4: Verify tables exist via Prisma Studio or direct query**

  ```bash
  pnpm db:studio
  ```
  Confirm `catalog_category` and `catalog_product` appear in the DB schema.

- [ ] **Step 5: Test categories CRUD**

  ```bash
  # Create a category
  curl -X POST http://localhost:4010/catalog/categories \
    -H "Authorization: Bearer $ATLAS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Bebidas","slug":"bebidas","description":"Todo tipo de bebidas"}'
  ```
  Expected: `{ "data": { "id": "...", "name": "Bebidas", ... } }`

  ```bash
  # List categories
  curl http://localhost:4010/catalog/categories \
    -H "Authorization: Bearer $ATLAS_TOKEN"
  ```
  Expected: `{ "data": [{ "id": "...", "name": "Bebidas", ... }] }`

- [ ] **Step 6: Test products CRUD**

  ```bash
  # Create a product (use the category id from step 5)
  curl -X POST http://localhost:4010/catalog/products \
    -H "Authorization: Bearer $ATLAS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Agua Mineral","slug":"agua-mineral","price":1.50,"currency":"USD","published":true}'
  ```
  Expected: `{ "data": { "id": "...", "name": "Agua Mineral", ... } }`

- [ ] **Step 7: Test public endpoints**

  ```bash
  curl http://localhost:4010/public/catalog/products
  curl http://localhost:4010/public/catalog/categories
  ```
  Expected: `{ "data": [...] }` with the published products/categories.

- [ ] **Step 8: Commit**

  ```bash
  git add modules/official/atlas.catalog/ \
          apps/api/src/manifests/official/feature-modules.js \
          apps/api/src/routes/public-website.js \
          apps/api/src/index.js
  git commit -m "feat(catalog): add atlas.catalog AME3 module with products + categories API"
  ```

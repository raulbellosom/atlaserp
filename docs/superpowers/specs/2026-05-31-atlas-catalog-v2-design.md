# atlas.catalog v2 — Design Spec

**Date:** 2026-05-31  
**Status:** Approved  
**Module:** `modules/official/atlas.catalog`

---

## Overview

The catalog module is the master product registry for Atlas ERP. It serves two consumers simultaneously:

1. **Internal users** — manage products, categories, stock, and pricing from the ERP desktop app.
2. **Public website** — unauthenticated API endpoints expose published products to the `atlas.website` public frontend.

The v2 redesign adds product variants, a hierarchical category tree, free-form product attributes, inline image uploads, stock history tracking, and a full product detail screen with tabs.

---

## Goals

- Replace the two minimal list screens with a complete catalog management experience.
- Support SIMPLE and VARIABLE products (Shopify-style type split).
- Track stock with an audited movement history.
- Expose public endpoints for website integration without requiring auth.
- All file uploads happen inline — the user never navigates to `atlas.files` directly.

---

## Non-Goals

- POS integration (separate future module).
- Multi-warehouse inventory (deferred to a dedicated inventory module).
- Discount / coupon system (separate concern).
- Product bundles / kits.

---

## Data Model

### Modified tables

#### `catalog_category` (additions)

| Field | Type | Notes |
|---|---|---|
| `parent_id` | relation (uuid, nullable) | FK → `catalog_category.id`, ON DELETE SET NULL. Max 1 level deep enforced in service. |
| `cover_asset_id` | relation (uuid, nullable) | FK → `file_asset.id` (soft ref). |
| `position` | number (int, default 0) | Display sort order within its parent. |

#### `catalog_product` (additions)

| Field | Type | Notes |
|---|---|---|
| `product_type` | text (default `'SIMPLE'`) | `SIMPLE` or `VARIABLE`. |
| `sku` | text (nullable) | Internal reference code. Only meaningful for SIMPLE products. Unique per company. |
| `barcode` | text (nullable) | EAN / UPC. Only meaningful for SIMPLE products. |
| `weight` | decimal (nullable) | Weight in kg. Used for shipping calculations. |
| `attributes` | json (default `[]`) | Array of `{ key: string, value: string }`. Free-form product specs. |
| `meta_title` | text (nullable) | SEO title override. |
| `meta_description` | text (nullable) | SEO meta description. |

The existing `description` field is already `textarea` — the UI renders it as Markdown. No schema change needed.

---

### New tables

#### `catalog_product_option`

Defines a variant axis for a VARIABLE product (e.g. "Talla", "Color").

```
id             uuid (uuidv7, PK)
company_id     uuid (FK company, NOT NULL)
product_id     uuid (FK catalog_product, ON DELETE CASCADE)
name           text NOT NULL          -- e.g. "Talla"
position       integer DEFAULT 0
created_at     timestamptz
updated_at     timestamptz
```

#### `catalog_product_option_value`

The allowed values for an option (e.g. "S", "M", "L").

```
id         uuid (uuidv7, PK)
option_id  uuid (FK catalog_product_option, ON DELETE CASCADE)
value      text NOT NULL              -- e.g. "S"
position   integer DEFAULT 0
```

No `company_id` needed — scoped via option → product → company.

#### `catalog_product_variant`

Each combination of option values for a VARIABLE product.

```
id              uuid (uuidv7, PK)
company_id      uuid (FK company, NOT NULL)
product_id      uuid (FK catalog_product, ON DELETE CASCADE)
option_values   jsonb NOT NULL         -- e.g. {"Talla":"S","Color":"Rojo"}
sku             text (nullable)        -- unique per company
barcode         text (nullable)
price           numeric(18,4) NOT NULL
compare_price   numeric(18,4) (nullable)
stock           integer DEFAULT 0
cover_asset_id  uuid (nullable)        -- variant-level image override
enabled         boolean DEFAULT true
created_at      timestamptz
updated_at      timestamptz
```

Index: `(company_id, sku)` unique where `sku IS NOT NULL`.

#### `catalog_stock_movement`

Audited log of every stock change.

```
id            uuid (uuidv7, PK)
company_id    uuid (FK company, NOT NULL)
product_id    uuid (FK catalog_product, ON DELETE CASCADE)
variant_id    uuid (nullable, FK catalog_product_variant ON DELETE SET NULL)
quantity_delta integer NOT NULL        -- positive = stock in, negative = stock out
reason        text (nullable)          -- e.g. "Ajuste manual", "Compra", "Venta"
note          text (nullable)          -- free text note
user_id       uuid (nullable)          -- who made the change
created_at    timestamptz
```

**Consistency rule:** whenever a stock movement is inserted, the corresponding `catalog_product.stock` (SIMPLE) or `catalog_product_variant.stock` (VARIABLE) is updated in the same DB transaction. The `stock` column is the authoritative current value; movements are the audit trail.

---

## Permissions

No new permissions added. Existing permissions cover the new entities because variants and options are sub-resources of products, and stock movements are controlled by `catalog.products.update`.

One new optional permission for future use (added now but not enforced):
- `catalog.inventory.adjust` — allows registering stock movements (currently open to anyone with `catalog.products.update`)

---

## API — Private (authenticated)

### Categories

| Method | Path | Notes |
|---|---|---|
| `GET` | `/catalog/categories` | Returns tree: categories with nested subcategories. |
| `GET` | `/catalog/categories/:id` | Detail with subcategories. |
| `POST` | `/catalog/categories` | Accepts `parent_id`, `cover_asset_id`, `position`. |
| `PATCH` | `/catalog/categories/:id` | Partial update. |
| `DELETE` | `/catalog/categories/:id` | Soft-delete (enabled = false). |

### Products

| Method | Path | Notes |
|---|---|---|
| `GET` | `/catalog/products` | Filters: `type`, `published`, `categoryId`, `search`. Pagination: `limit`, `offset`. Returns `total`. |
| `GET` | `/catalog/products/:id` | Full product: options, variants, attributes, resolved cover image. |
| `POST` | `/catalog/products` | Creates product. `product_type` defaults to `SIMPLE`. |
| `PATCH` | `/catalog/products/:id` | Partial update. |
| `DELETE` | `/catalog/products/:id` | Soft-delete. |
| `POST` | `/catalog/products/:id/publish` | Sets `published = true`. |
| `POST` | `/catalog/products/:id/unpublish` | Sets `published = false`. |

### Product options (VARIABLE products only)

| Method | Path |
|---|---|
| `GET` | `/catalog/products/:id/options` |
| `POST` | `/catalog/products/:id/options` |
| `PATCH` | `/catalog/products/:id/options/:optionId` |
| `DELETE` | `/catalog/products/:id/options/:optionId` |

Option values are managed as a sub-array within the option payload: `{ name, position, values: ["S","M","L"] }`.

### Variants

| Method | Path | Notes |
|---|---|---|
| `GET` | `/catalog/products/:id/variants` | All variants for a product. |
| `POST` | `/catalog/products/:id/variants` | Create a variant manually or generate all combinations. |
| `PATCH` | `/catalog/products/:id/variants/:variantId` | Update price, SKU, barcode, stock, image. |
| `DELETE` | `/catalog/products/:id/variants/:variantId` | Soft-delete (enabled = false). |

### Stock movements

| Method | Path | Notes |
|---|---|---|
| `POST` | `/catalog/products/:id/stock-movements` | Body: `{ variant_id?, quantity_delta, reason?, note? }`. Updates stock atomically. |
| `GET` | `/catalog/products/:id/stock-movements` | Paginated history. Filter by `variant_id`. |

---

## API — Public (no authentication)

Company context resolved by the same mechanism as `atlas.website` public pages: a `companyId` query param passed by the website block (not exposed to the end visitor). This matches the existing `listPublicProducts` service signature.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/public/catalog/products` | Filters: `categorySlug`, `search`, `limit`, `offset`. Only `published: true` products. |
| `GET` | `/public/catalog/products/:slug` | Product detail with variants and stock if `track_stock`. |
| `GET` | `/public/catalog/categories` | Category tree with published product counts. |

---

## Backend file structure

```
modules/official/atlas.catalog/
  module.manifest.js           -- updated: icon, description, new permissions
  models/
    catalog-category.model.js  -- updated: parent_id, cover_asset_id, position
    catalog-product.model.js   -- updated: product_type, sku, barcode, weight, attributes, meta_*
    catalog-product-option.model.js       (new)
    catalog-product-option-value.model.js (new)
    catalog-product-variant.model.js      (new)
    catalog-stock-movement.model.js       (new)
  api/
    index.js                   -- updated: mount new routers
    catalog-product-service.js -- renamed from catalog-service.js, product + category ops
    catalog-variant-service.js -- (new) option + variant ops
    catalog-stock-service.js   -- (new) stock movement ops
    catalog-public-service.js  -- (new) public read ops
    categories-routes.js       -- updated
    products-routes.js         -- updated
    variants-routes.js         -- (new)
    stock-routes.js            -- (new)
    public-routes.js           -- (new)
  validators/
    index.js                   -- updated: new schemas for variants, options, movements
```

Service split threshold: any service file approaching 800 lines is split proactively.

---

## Frontend — Navigation

Module manifest navigation (4 items):

```js
{ label: 'Productos',  path: '/app/m/atlas.catalog',            icon: 'ShoppingBag', layout: 'main', permissionKey: 'catalog.products.read' },
{ label: 'Categorias', path: '/app/m/atlas.catalog/categories', icon: 'Tag',         layout: 'main', permissionKey: 'catalog.categories.read' },
{ label: 'Inventario', path: '/app/m/atlas.catalog/inventory',  icon: 'BarChart3',   layout: 'main', permissionKey: 'catalog.products.read' },
```

Module-level icon: `ShoppingBag`. Module description: `"Gestiona productos, categorias, variantes e inventario"`.

---

## Frontend — Screens

### `/app/m/atlas.catalog` — Lista de productos (rediseño)

Table layout with columns: thumbnail, name, type badge (SIMPLE/VARIABLE), category, base price, total stock, status badge (Publicado/Borrador). Filters: category dropdown, type toggle, status filter. Search input. Pagination. "Nuevo producto" button opens a create sheet (basic fields only — name, type, category, price). Clicking a row navigates to the detail screen.

### `/app/m/atlas.catalog/:id` — Detalle de producto (new)

Top bar: product name (editable inline), Publish/Unpublish button, Save button, back link.

Six tabs:

1. **General** — nombre, slug (auto-generado, editable), descripción (MarkdownEditor), categoría, subcategoría, atributos clave-valor (add/remove rows).
2. **Imágenes** — `ProductImageUploader`: portada principal (drag & drop + click) + galería de imágenes adicionales. Subida directa a atlas.files. Reorder by drag.
3. **Precios** — precio, precio anterior, moneda. Para SIMPLE: también SKU, barcode, peso, stock (editable con botón "Registrar ajuste" al lado).
4. **Variantes** (only shown for VARIABLE) — `VariantOptionsEditor`: gestión de ejes (Talla, Color) y sus valores. Debajo: tabla de variantes generadas con precio, SKU, barcode, stock editables inline. Botón "Generar todas las combinaciones".
5. **Inventario** — historial de movimientos de stock (tabla paginada: fecha, usuario, delta, razón, nota). Botón "Registrar ajuste" abre `StockMovementModal`.
6. **SEO** — meta_title, meta_description, preview de snippet de búsqueda (Google-style).

### `/app/m/atlas.catalog/categories` — Categorías (rediseño)

Lista jerárquica: categorías raíz con sus subcategorías anidadas debajo con indentación. Cada fila: thumbnail, nombre, slug, conteo de productos. Sheet lateral para crear/editar: nombre, slug (auto), descripción, categoría padre (dropdown de categorías raíz), imagen (subida inline), posición.

### `/app/m/atlas.catalog/inventory` — Inventario (new)

Tabla de todos los productos/variantes con stock actual. Columna de estado de stock: alerta roja si stock = 0, amarilla si stock ≤ 5. Filtros: categoría, estado de stock (sin stock / bajo / ok). Click en fila lleva al tab Inventario del producto. Botón "Registrar ajuste" por fila.

---

## Frontend — Components

```
apps/desktop/src/modules/atlas.catalog/
  index.js
  screens/
    CatalogProductsScreen.jsx       -- redesigned
    CatalogProductDetailScreen.jsx  -- new (tabs)
    CatalogCategoriesScreen.jsx     -- redesigned
    CatalogInventoryScreen.jsx      -- new
  components/
    ProductImageUploader.jsx        -- cover + gallery + inline upload
    StockMovementModal.jsx          -- delta + reason + note form
    VariantMatrix.jsx               -- inline-editable variant table
    VariantOptionsEditor.jsx        -- option axes + values manager
```

`MarkdownField.jsx` and `MarkdownViewer.jsx` already exist in `packages/ui/src/components/` (per git status) — imported from `@atlas/ui`.

---

## Implementation order

This spec is intentionally large. It must be split into two plans:

**Plan A — Backend (API + models):**
1. Update `catalog_category` model (parent_id, cover_asset_id, position)
2. Update `catalog_product` model (product_type, sku, barcode, weight, attributes, meta_*)
3. Add `catalog_product_option` + `catalog_product_option_value` models
4. Add `catalog_product_variant` model
5. Add `catalog_stock_movement` model
6. Split catalog-service into product-service + variant-service + stock-service + public-service
7. Update categories-routes + products-routes
8. Add variants-routes + stock-routes + public-routes
9. Update validators
10. Sync models (`POST /modules/sync`)

**Plan B — Frontend (UI):**
1. Update manifest (icon, description, navigation)
2. Redesign `CatalogProductsScreen`
3. Build `CatalogProductDetailScreen` (tabs: General, Imágenes, Precios)
4. Build Variantes tab + `VariantOptionsEditor` + `VariantMatrix`
5. Build Inventario tab + `StockMovementModal`
6. Build SEO tab
7. Redesign `CatalogCategoriesScreen` (hierarchical, with image)
8. Build `CatalogInventoryScreen`
9. Build `ProductImageUploader`
10. Wire routes in `index.js`

---

## Open questions

None. All design decisions resolved in brainstorming session on 2026-05-31.

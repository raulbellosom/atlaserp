# atlas.catalog — Current State Spec

**Date:** 2026-08-30
**Module:** `atlas.catalog` (CORE, `core: true`, `uninstallable: false`, version `2.1.0`)
**Status:** Post-audit reference (2026-08-30 pass).

> Distinct from `atlas.inventory` (asset/CMDB tracking). `atlas.catalog` is the
> product catalog + stock that feeds the public storefront (`atlas.storefront`).

---

## 1. Layout

```
apps/api/src/routes/catalog/
  index.js                    createCatalogRouter — mounts the 4 sub-routers
  catalog-product-service.js  (~400) categories + products, raw SQL, company-scoped
  catalog-variant-service.js  options + variants
  catalog-stock-service.js    recordStockMovement (transactional) + listStockMovements
  catalog-public-service.js    read-only storefront projection
  {categories,products,variants,stock}-routes.js   validators.js
  __tests__/  stock-permissions.test.js  catalog-tenant.test.js
apps/api/src/routes/public-website.js  createPublicCatalogRouter → /public/catalog/*
apps/desktop/src/modules/atlas.catalog/  Products/Categories/Inventory screens + detail
```

## 2. Data model

Raw-SQL tables (migration, not Prisma models): `catalog_category` (tree via
`parent_id`), `catalog_product` (SIMPLE | VARIABLE, JSONB `attributes`/`images`),
`catalog_product_option`, `catalog_product_option_value`, `catalog_product_variant`,
`catalog_stock_movement`. Every row carries `company_id`; soft-delete via `enabled`.

## 3. Multi-tenancy

**Best-in-class among the audited modules.** Every query in
`catalog-product-service.js` / `catalog-stock-service.js` / `catalog-public-service.js`
is `company_id = $n::uuid`-scoped — no exceptions. `$queryRawUnsafe` is used only
with `$n` placeholders (values passed separately). As of 2026-08-30:

- `assertRowInCompany(table, id, companyId, label)` rejects a `parent_id`
  (create/update category) or `category_id` (create/update product) that belongs
  to another company (400 `CatalogRefError`); `updateCategory` also blocks
  self-parent.
- `recordStockMovement` verifies the product (and variant) is in the company
  before writing anything — 404 `CatalogStockError` otherwise. Previously it
  inserted a movement row against a foreign product id and returned 201.
- All 4 route files now return `err.status` for `< 500` service errors instead
  of a blanket 500.

## 4. Stock

`recordStockMovement` runs the movement insert + `stock = stock + Δ` update in a
single `prisma.$transaction`, on `catalog_product_variant` (if `variantId`) or
`catalog_product`. Gated by `requireAnyPermission(['catalog.inventory.adjust',
'catalog.products.update'])` (2026-08-30 — `catalog.inventory.adjust` was a
declared-but-unenforced permission).

## 5. Public storefront service

`/public/catalog/{categories,products,products/:slug}` — **no auth**. Company is
resolved by `getActiveCompanyId()` = first enabled company (effectively
single-tenant; see backlog D1-b). Only `published = true AND enabled = true` rows.
`getPublicProductBySlug` now returns an explicit shopper-facing column list
(name, slug, description, type, price/compare_price/currency, weight, stock,
track_stock, attributes, cover_asset_id, images, category) — **no** `company_id`,
`sku`, `barcode`, `meta_*`. The variants sub-query is company-scoped.

## 6. Permissions

`catalog.access` (nav-only), `catalog.products.{read,create,update,delete}`,
`catalog.categories.{read,create,update,delete}`, `catalog.inventory.adjust`.
All in `permission-catalog.js` as of 2026-08-30 (were missing → RBAC contract).
Variants/options ride on `catalog.products.{read,update}`.

## 7. UI

Products list + detail (657 lines), Categories tree, Inventory (stock) screen,
`StockMovementModal`, `VariantMatrix`, `VariantOptionsEditor`, `ProductImageManager`.
Uses `@atlas/ui` (`ConfirmDialog`, `PageHeader`). `VariantMatrix` hand-rolls a
`<table>` (theme-token styled). Stock-movement badges lack `dark:` variants
(backlog D1-d).

## 8. Tests

`stock-permissions.test.js` (2), `catalog-tenant.test.js` (7): cross-company FK
rejection, `recordStockMovement` company guard, public projection.

## 9. Known gaps / follow-ups

D1-a delete-in-use checks · D1-b single-tenant public router · D1-c
`resolveImageUrls` file_asset scope · D1-d UI (`<table>`, dark badges, file size)
· responsive QA.

## 10. Verification (2026-08-30)

- `node --check` on all touched catalog files — pass.
- `node --test routes/catalog/__tests__/*.test.js` — 9/9.
- `node --test` calendar + rbac — green.
- `pnpm --filter @atlas/desktop build:web` — pass.

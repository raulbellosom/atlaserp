# atlas.inventory — Current State Spec

**Date:** 2026-08-30
**Module:** `atlas.inventory` (CORE, `core: true`, `uninstallable: false`, version `1.0.0`)
**Status:** Living reference — describes the module after the 2026-08-30 deep audit + fix pass.

> Not to be confused with `atlas.catalog`, which also has an "inventory" concept
> (product stock). `atlas.inventory` is asset / CMDB tracking: items, employee
> assignments, catalogs, custom fields, comments, files.

---

## 1. Layout

```
apps/api/src/
  routes/inventory/index.js         → createInventoryRouter(...)  (NEW 2026-08-30 —
                                       extracted verbatim from index.js so the entry
                                       point drops back under the size limit)
  routes/inventory/__tests__/router.test.js
  services/inventory-service.js      (~960 lines) — Prisma-model business logic
  services/inventory-notification-service.js
  services/__tests__/{inventory-service, inventory-notification-service,
                      inventory-tenant-isolation}.test.js
apps/desktop/src/modules/atlas.inventory/
  screens/  InventoryScreen  InventoryItemDetail  InventoryItemForm
            InventoryAssignmentsScreen  InventoryCatalogsScreen
  components/ InventoryAssignmentPanel  InventoryGroupedView  InventoryFileGallery
             InventoryCustomFieldsForm  InventoryCommentThread  InventoryStatusBadge …
  hooks/  useInventoryItems  useInventoryCatalogs  useInventoryComments
```

Router mounted in `apps/api/src/index.js`:
`mountWithAuth(app, createInventoryRouter({ prisma, requirePermission, inventoryService, InventoryServiceError, inventoryNotifSvc, commentsService, CommentsServiceError, enrichFilesWithSignedUrls }))`.

## 2. Entities (real Prisma models in `prisma/schema.prisma`)

`InvItem`, `InvAssignment`, `InvCategory`, `InvBrand`, `InvLocation`,
`InvCustomField`, `InvCustomFieldValue`, `InvComment`, `InvCommentReaction`,
`InvMention`, `InvItemFile`. All carry `companyId` and a soft-delete `enabled`
flag (comments hard-delete by author). Item comments/reactions at the route layer
use the shared `commentsService` (`InvItem` entity), not the service's own
`createComment`/`toggleReaction` (those remain only for the unit tests).

## 3. Permissions

`apps/api/src/manifests/official/core-modules.js` (`inventoryMap`) and — as of
2026-08-30 — `apps/api/src/permission-catalog.js` (`groupKey: "inventory"`; the
keys were previously missing from the catalog, failing the RBAC contract).

| Feature | Keys |
|---|---|
| Module | `inventory.access` |
| Items | `inventory.item.{read,create,update,delete}` |
| Assignments | `inventory.assignment.{read,manage}` |
| Catalogs | `inventory.catalog.{read,manage}` |
| Custom fields | `inventory.customfield.manage` (read folded into `catalog.read`) |

- Every route declares `requirePermission("inventory.<feature>.<action>")`;
  `authMiddleware` is applied by `mountWithAuth`.
- Nav "Catálogos" now uses `permissionKey: "inventory.catalog.read"` (was `manage`,
  so read-only catalog roles could not see the menu entry).
- Item comments and reactions are gated by `inventory.item.update` — a viewer with
  only `item.read` cannot comment. Left as-is; revisit if product wants lighter
  write access.

## 4. Multi-tenancy (hardened 2026-08-30)

`companyId` always comes from `c.get("companyId")` (set by `requirePermission` from
the membership context), never from the body — verified by
`routes/inventory/__tests__/router.test.js`.

Service-layer fixes:
- **`assertCompany(companyId)`** guard at the top of every public method. A
  missing/blank companyId now throws `InventoryServiceError(400)` before any query
  (previously Prisma would silently drop a `companyId: undefined` filter and
  return every tenant's rows).
- **`assertRefInCompany(model, id, companyId, label)`** — `createItem` /
  `updateItem` validate `categoryId` / `brandId` / `locationId`; `assignItem`
  validates `employeeId` (HrEmployee); `createCategory` / `updateCategory` and the
  custom-field writes validate `parentId` / `categoryId`. A reference to another
  company's row is rejected with a 400 instead of creating a cross-tenant link.
- **`reorderCategories/Brands/Locations/CustomFields`** now use
  `updateMany({ where: { id, companyId } })` inside a `$transaction`. Previously
  they did `update({ where: { id } })` per item with **no company filter** — a
  crafted reorder payload could re-sort another company's catalog rows.
- `updateCategory` also rejects `parentId === id` (self-parent).
- `deleteCategory` / `deleteBrand` / `deleteLocation` now refuse (409) when items
  still reference the row.

## 5. Transactions & activity feed

- Multi-step writes (`createItem` with custom values, `updateItem`, `assignItem`,
  `returnItem`, `reorder*`, `createComment`) already run inside `prisma.$transaction`.
- The **activity bridge is wired**: `bridge.logAndPublish(...)` fires on
  create/update/assign/return via `createActivityBridge`. (The earlier memory note
  "activity feed deferred / no activityBridge pattern" was stale and has been
  corrected.)

## 6. UI

- Screens use `@atlas/ui` (`AtlasTable`, `PageHeader`, `ConfirmDialog`, `Sheet`,
  `EmptyState`, `LoadingState`, form fields). `ConfirmDialog` guards every
  destructive action; no `window.confirm/alert/prompt`; no native form controls.
- Hardcoded `bg-blue-100 text-blue-700` status pills in `InventoryAssignmentPanel`
  and `InventoryAssignmentsScreen` replaced with theme-aware `@atlas/ui` `<Badge>`
  (`success` / `secondary`) — they now read correctly in dark mode.

## 7. Tests

| File | Covers |
|---|---|
| `services/__tests__/inventory-service.test.js` | business logic (create/assign/return/comments). **Was 47% red on `main`** due to stale prisma mocks (missing `userProfile` etc.) — mock fixed 2026-08-30, now 19/19. |
| `services/__tests__/inventory-notification-service.test.js` | mention/reaction notifications |
| `services/__tests__/inventory-tenant-isolation.test.js` | NEW — `assertCompany` on every method, cross-company FK rejection, company-scoped reorder |
| `routes/inventory/__tests__/router.test.js` | NEW — extracted router: path + permission wiring, companyId from context |

Total: 78/78 passing.

## 8. Known gaps / follow-ups

- **In-browser responsive QA** (390 / 1440) not run this pass — `InventoryItemForm`
  (541 lines) and `InventoryCatalogsScreen` (568) are the ones to check against
  `docs/ai-context/ui-screen-audit-checklist.md`.
- `InventoryAssignmentsScreen` and `InventoryGroupedView` still render a
  hand-rolled `<table>` (theme-token styled, so dark-mode-safe, but not `DataTable`
  from `@atlas/ui`). Migrating needs an `onRowClick` prop on `DataTable`.
- `InventoryStatusBadge` uses inline `style` hex colors from `ITEM_STATUSES`
  constants — deliberate status palette, not theme-token; low priority.
- The service still exports `listComments/createComment/updateComment/deleteComment/
  toggleReaction` that no route uses (routes use the shared `commentsService`).
  Kept only because the unit tests exercise them.
- `atlas.catalog` and `atlas.calendar` permissions are still missing from
  `permission-catalog.js` — the RBAC contract test stays red until those (and
  `notes.*`, handled in the notes audit) are added. **No `inventory.*` drift.**

## 9. Verification performed (2026-08-30)

- `node --check` on `inventory-service.js`, `routes/inventory/index.js`,
  `index.js`, `permission-catalog.js`, `core-modules.js` — pass.
- `node --test` inventory service + notification + tenant-isolation + router — 78/78.
- `node --test rbac-granular-contract` — `inventory.*` no longer reported missing
  (pre-existing red for `calendar` / `catalog` / `notes`).
- `node --test` ledger + fleet isolation suites — still green.
- `pnpm --filter @atlas/desktop build:web` — pass.

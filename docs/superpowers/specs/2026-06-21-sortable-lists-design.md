# Spec: Visual Ordering (SortableList DnD) — atlas.catalog + atlas.inventory

**Date:** 2026-06-21  
**Status:** Approved

## Problem

Several modules expose a raw number input ("Posición de orden") for controlling display order. Users cannot intuitively understand or use this control. The `atlas.website` module already solved this with `@dnd-kit` drag-and-drop; the rest of the platform needs the same treatment.

## Scope

**In scope:**
- `atlas.catalog` — category ordering (CatalogCategoriesScreen.jsx)
- `atlas.inventory` — category, brand, location, and custom-field ordering (InventoryCatalogsScreen.jsx)
- New shared `SortableList` component in `@atlas/ui`
- Backend reorder endpoints for each entity

**Deferred:**
- `atlas.pos` product/category ordering — deferred until a POS product management screen exists

## Design

### 1. `SortableList` component (`packages/ui/src/components/SortableList.jsx`)

A generic component that wraps `@dnd-kit` boilerplate. Exported from `@atlas/ui`.

**API:**
```jsx
<SortableList
  items={items}          // array — each item must have { id: string }
  onReorder={fn}         // (newOrderedItems) => void — called after drag ends
  renderItem={fn}        // (item, { dragHandleProps, isDragging }) => ReactNode
/>
```

**Internals:**
- `DndContext` with `PointerSensor` + `KeyboardSensor`
- `SortableContext` with `verticalListSortingStrategy`
- Each item wrapped in a `useSortable` hook, exposing `dragHandleProps` to the render prop
- `arrayMove` on drag end, then calls `onReorder(newArray)`
- No opinion on row layout — purely a container

### 2. atlas.catalog changes

**File:** `apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx`

- Replace the static `<table>` list with `SortableList`
- Each row renders a `GripVertical` handle using `dragHandleProps`
- Remove the `NumberField` for "Posición de orden" from the create/edit Sheet entirely
- `onReorder`: calls `PATCH /catalog/categories/reorder`, shows toast on success/error
- On create, new category gets `position = items.length` (appended to end)

**New backend endpoint:**
```
PATCH /catalog/categories/reorder
Permission: catalog.categories.update
Body: { items: [{ id: string, position: number }] }
Service: reorderCategories({ companyId, items })
  → Promise.all(items.map(({ id, position }) =>
      prisma.$queryRaw`UPDATE catalog_category SET position = ${position}, updated_at = now()
                       WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid`
    ))
```

### 3. atlas.inventory changes

**File:** `apps/desktop/src/modules/atlas.inventory/screens/InventoryCatalogsScreen.jsx`

- Replace the generic `CatalogTable` component with `SortableCatalogTable` (same generic structure, wraps `SortableList`)
- All 4 tabs (categories, brands, locations, custom-fields) become sortable
- `onReorder`: calls the appropriate reorder endpoint per tab

**New backend endpoints (4):**
```
PATCH /api/inventory/categories/reorder
PATCH /api/inventory/brands/reorder
PATCH /api/inventory/locations/reorder
PATCH /api/inventory/custom-fields/reorder
Permission: inventory.manage (existing permission)
Body: { items: [{ id: string, sort_order: number }] }
Service: reorderXxx({ companyId, items })
  → Promise.all UPDATE sort_order WHERE id AND company_id
```

Column names match existing schema: `sort_order` for inventory tables, `position` for catalog tables.

### 4. Ordering semantics

- Position values are `index * 10` (0, 10, 20, ...) to allow future insertions without full reindex
- New items created without explicit position default to the end (no user input needed)
- Lists are always fetched `ORDER BY position/sort_order ASC, name ASC` (already the case)

## What does NOT change

- No database schema changes — columns already exist
- No Prisma schema changes
- No changes to `atlas.website` (already correct)
- No changes to `atlas.pos` (deferred)

## Files to create/modify

| File | Action |
|---|---|
| `packages/ui/src/components/SortableList.jsx` | Create |
| `packages/ui/src/index.js` | Export SortableList |
| `apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx` | Modify |
| `apps/api/src/routes/catalog/categories-routes.js` | Add reorder endpoint |
| `apps/api/src/routes/catalog/catalog-product-service.js` | Add reorderCategories |
| `apps/api/src/routes/catalog/validators.js` | Add reorderCategoriesSchema |
| `apps/desktop/src/modules/atlas.inventory/screens/InventoryCatalogsScreen.jsx` | Modify |
| `apps/api/src/services/inventory-service.js` | Add 4 reorder methods |
| `apps/api/src/index.js` | Add 4 inventory reorder endpoints |

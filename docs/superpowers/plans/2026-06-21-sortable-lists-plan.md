# Sortable Lists (DnD Ordering) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw "Posición de orden" number inputs with drag-and-drop reordering in atlas.catalog (categories) and atlas.inventory (categories, brands, locations, custom fields).

**Architecture:** Create a generic `SortableList` component in `@atlas/ui` using `@dnd-kit`. Each module calls its own PATCH /reorder endpoint on drag-end. The frontend renders lists optimistically — items reorder immediately, the backend call persists the new order.

**Tech Stack:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (already installed), React, TanStack Query, Hono (API), Prisma (inventory), `$queryRaw` (catalog)

---

## File Map

| File | Action |
|---|---|
| `packages/ui/src/components/SortableList.jsx` | **Create** — generic DnD wrapper |
| `packages/ui/src/index.js` | **Modify** — export SortableList |
| `apps/api/src/routes/catalog/validators.js` | **Modify** — add reorderCategoriesSchema |
| `apps/api/src/routes/catalog/catalog-product-service.js` | **Modify** — add reorderCategories() |
| `apps/api/src/routes/catalog/categories-routes.js` | **Modify** — add PATCH /catalog/categories/reorder |
| `apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx` | **Rewrite** — use SortableList, remove position field |
| `apps/api/src/services/inventory-service.js` | **Modify** — add 4 reorder methods |
| `apps/api/src/index.js` | **Modify** — add 4 PATCH reorder endpoints |
| `apps/desktop/src/modules/atlas.inventory/hooks/useInventoryCatalogs.js` | **Modify** — add 4 reorder hooks |
| `apps/desktop/src/modules/atlas.inventory/screens/InventoryCatalogsScreen.jsx` | **Rewrite** — use SortableList |

---

## Task 1: SortableList component in @atlas/ui

**Files:**
- Create: `packages/ui/src/components/SortableList.jsx`
- Modify: `packages/ui/src/index.js`

- [ ] **Step 1.1: Create the SortableList component**

Create `packages/ui/src/components/SortableList.jsx` with this exact content:

```jsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableItemWrapper({ id, item, renderItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dragHandleProps = { ...attributes, ...listeners }

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, { dragHandleProps, isDragging })}
    </div>
  )
}

export function SortableList({ items, onReorder, renderItem }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map(item => (
          <SortableItemWrapper
            key={item.id}
            id={item.id}
            item={item}
            renderItem={renderItem}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}
```

- [ ] **Step 1.2: Export SortableList from @atlas/ui**

In `packages/ui/src/index.js`, add this line after the `MarkdownViewer` export (around line 46):

```js
export { SortableList } from "./components/SortableList.jsx";
```

- [ ] **Step 1.3: Commit**

```bash
git add packages/ui/src/components/SortableList.jsx packages/ui/src/index.js
git commit -m "feat(ui): add generic SortableList component using @dnd-kit"
```

---

## Task 2: Backend — catalog categories reorder endpoint

**Files:**
- Modify: `apps/api/src/routes/catalog/validators.js`
- Modify: `apps/api/src/routes/catalog/catalog-product-service.js`
- Modify: `apps/api/src/routes/catalog/categories-routes.js`

- [ ] **Step 2.1: Add reorderCategoriesSchema to validators.js**

At the end of `apps/api/src/routes/catalog/validators.js`, add:

```js
export const reorderCategoriesSchema = z.object({
  items: z.array(z.object({
    id:       z.string().uuid(),
    position: z.number().int().min(0),
  })).min(1),
})
```

- [ ] **Step 2.2: Add reorderCategories to catalog-product-service.js**

In `apps/api/src/routes/catalog/catalog-product-service.js`, after the `deleteCategory` function (around line 109), add:

```js
  async function reorderCategories({ companyId, items }) {
    await Promise.all(
      items.map(({ id, position }) =>
        prisma.$queryRaw`
          UPDATE catalog_category
          SET position = ${position}, updated_at = now()
          WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
        `
      )
    )
  }
```

Also add `reorderCategories` to the return object at the bottom of `createCatalogProductService`. Find the `return {` block and add:

```js
    reorderCategories,
```

- [ ] **Step 2.3: Add PATCH /catalog/categories/reorder endpoint to categories-routes.js**

In `apps/api/src/routes/catalog/categories-routes.js`:

1. Update the import at the top to include `reorderCategoriesSchema`:

```js
import { createCategorySchema, updateCategorySchema, reorderCategoriesSchema } from './validators.js'
```

2. Add the new route before `return app` (around line 123):

```js
  app.patch('/catalog/categories/reorder', requirePermission('catalog.categories.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = reorderCategoriesSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      await productSvc.reorderCategories({ companyId, items: parsed.data.items })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[PATCH /catalog/categories/reorder]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })
```

- [ ] **Step 2.4: Commit**

```bash
git add apps/api/src/routes/catalog/validators.js apps/api/src/routes/catalog/catalog-product-service.js apps/api/src/routes/catalog/categories-routes.js
git commit -m "feat(api): add PATCH /catalog/categories/reorder endpoint"
```

---

## Task 3: Frontend — CatalogCategoriesScreen with SortableList

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx`

The current screen uses `AtlasTable` (blueprint-driven, paginated). We replace it with a hand-rolled sortable list that loads all categories flat. The sheet form loses the "Posición de orden" field.

- [ ] **Step 3.1: Rewrite CatalogCategoriesScreen.jsx**

Replace the entire file content with:

```jsx
// apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  ComboboxField,
  ConfirmDialog,
  MarkdownField,
  PageHeader,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SortableList,
  TextField,
} from '@atlas/ui'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { atlas } from '../../../lib/atlas.js'
import { getApiUrl } from '../../../lib/runtimeConfig.js'

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/(^-|-$)/g, '')
}

function CategoryRow({ item, onEdit, onDelete, dragHandleProps, isDragging }) {
  return (
    <div
      className={[
        'flex items-center gap-2 px-3 py-2.5 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg group',
        isDragging ? 'opacity-50 shadow-lg' : '',
      ].join(' ')}
    >
      <button
        {...dragHandleProps}
        type="button"
        className="cursor-grab text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] touch-none flex-shrink-0"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical size={14} />
      </button>
      <span className="flex-1 text-sm font-medium text-[hsl(var(--foreground))] truncate">
        {item.name}
      </span>
      <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono hidden sm:block truncate max-w-[140px]">
        {item.slug}
      </span>
      {item.parent_name && (
        <span className="text-xs text-[hsl(var(--muted-foreground))] hidden md:block truncate max-w-[120px]">
          {item.parent_name}
        </span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--destructive))]"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

export default function CatalogCategoriesScreen() {
  const { session, userProfile } = useAuth()
  const token       = session?.access_token
  const queryClient = useQueryClient()
  const permissions = userProfile?.permissions ?? []
  const hasPermission = key => Boolean(userProfile?.isAdmin || permissions.includes(key))
  const canCreate = hasPermission('catalog.categories.create')
  const canUpdate = hasPermission('catalog.categories.update')
  const canDelete = hasPermission('catalog.categories.delete')

  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [editing,       setEditing]       = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ name: '', slug: '', description: '', parent_id: '' })
  const [localOrder, setLocalOrder] = useState(null)

  const flatQuery = useQuery({
    queryKey: ['catalog-categories-flat', token],
    queryFn:  () => atlas.catalog.listCategories(token, { flat: 'true' }),
    enabled:  Boolean(token),
    staleTime: 60_000,
  })
  const flatCats = flatQuery.data?.data ?? []
  const orderedCats = localOrder ?? flatCats

  const saveMutation = useMutation({
    mutationFn: data => editing
      ? atlas.catalog.updateCategory(editing.id, data, token)
      : atlas.catalog.createCategory(data, token),
    onSuccess: () => {
      toast.success(editing ? 'Categoría actualizada' : 'Categoría creada')
      setLocalOrder(null)
      queryClient.invalidateQueries({ queryKey: ['catalog-categories-flat'] })
      setSheetOpen(false)
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: id => atlas.catalog.deleteCategory(id, token),
    onSuccess: () => {
      toast.success('Categoría eliminada')
      setLocalOrder(null)
      queryClient.invalidateQueries({ queryKey: ['catalog-categories-flat'] })
      setConfirmDelete(null)
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const reorderMutation = useMutation({
    mutationFn: async (items) => {
      const res = await fetch(`${getApiUrl()}/catalog/categories/reorder`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((c, idx) => ({ id: c.id, position: idx * 10 })) }),
      })
      if (!res.ok) throw new Error('Error al guardar el orden')
    },
    onError: () => toast.error('Error al guardar el orden'),
  })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', slug: '', description: '', parent_id: '' })
    setSheetOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      name:        row.name        ?? '',
      slug:        row.slug        ?? '',
      description: row.description ?? '',
      parent_id:   row.parent_id   ?? '',
    })
    setSheetOpen(true)
  }

  function handleNameChange(e) {
    const name = e.target.value
    const isAuto = !editing || form.slug === slugify(editing.name) || form.slug === slugify(form.name)
    setForm(f => ({ ...f, name, slug: isAuto ? slugify(name) : f.slug }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const nextPosition = orderedCats.length * 10
    saveMutation.mutate({
      name:        form.name,
      slug:        form.slug,
      description: form.description || undefined,
      parent_id:   form.parent_id   || null,
      position:    editing ? undefined : nextPosition,
    })
  }

  function handleReorder(newOrder) {
    setLocalOrder(newOrder)
    reorderMutation.mutate(newOrder)
  }

  const parentOptions = [
    { value: '__none__', label: 'Sin padre (categoría raíz)' },
    ...flatCats
      .filter(c => c.id !== editing?.id)
      .map(c => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Catalog"
        title="Categorías"
        description="Organiza tus productos en categorías y subcategorías. Arrastra para reordenar."
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nueva categoría
            </Button>
          )
        }
      />

      {flatQuery.isLoading ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando categorías...</p>
      ) : orderedCats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-10 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay categorías registradas.</p>
          {canCreate && <Button className="mt-4" onClick={openCreate}>Nueva categoría</Button>}
        </div>
      ) : (
        <div className="space-y-1.5">
          <SortableList
            items={orderedCats}
            onReorder={canUpdate ? handleReorder : () => {}}
            renderItem={(item, { dragHandleProps, isDragging }) => (
              <CategoryRow
                item={item}
                dragHandleProps={canUpdate ? dragHandleProps : {}}
                isDragging={isDragging}
                onEdit={canUpdate ? openEdit : () => {}}
                onDelete={canDelete ? setConfirmDelete : () => {}}
              />
            )}
          />
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar categoría' : 'Nueva categoría'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <TextField
              label="Nombre"
              value={form.name}
              onChange={handleNameChange}
              required
            />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              description="Identificador único en la URL"
              required
            />
            <MarkdownField
              label="Descripción (opcional)"
              value={form.description}
              placeholder="Describe la categoría..."
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <ComboboxField
              label="Categoría padre"
              options={parentOptions}
              value={form.parent_id || '__none__'}
              onChange={v => setForm(f => ({ ...f, parent_id: v === '__none__' ? '' : v }))}
              placeholder="Seleccionar padre..."
              searchPlaceholder="Buscar categoría..."
              emptyText="Sin resultados"
            />
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={v => !v && setConfirmDelete(null)}
        title="Eliminar categoría"
        description="La categoría será desactivada. Los productos que la tengan asignada no se verán afectados."
        detail={confirmDelete?.name}
        confirmLabel="Eliminar"
        onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
```

- [ ] **Step 3.2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx
git commit -m "feat(catalog): replace position number input with DnD sortable list"
```

---

## Task 4: Backend — inventory reorder endpoints

**Files:**
- Modify: `apps/api/src/services/inventory-service.js`
- Modify: `apps/api/src/index.js`

- [ ] **Step 4.1: Add 4 reorder methods to inventory-service.js**

Find the `return {` block at the bottom of `createInventoryService` in `apps/api/src/services/inventory-service.js`. Before that return, add:

```js
  async function reorderCategories(companyId, items) {
    await Promise.all(
      items.map(({ id, sortOrder }) =>
        prisma.invCategory.update({ where: { id }, data: { sortOrder } })
      )
    )
  }

  async function reorderBrands(companyId, items) {
    await Promise.all(
      items.map(({ id, sortOrder }) =>
        prisma.invBrand.update({ where: { id }, data: { sortOrder } })
      )
    )
  }

  async function reorderLocations(companyId, items) {
    await Promise.all(
      items.map(({ id, sortOrder }) =>
        prisma.invLocation.update({ where: { id }, data: { sortOrder } })
      )
    )
  }

  async function reorderCustomFields(companyId, items) {
    await Promise.all(
      items.map(({ id, sortOrder }) =>
        prisma.invCustomField.update({ where: { id }, data: { sortOrder } })
      )
    )
  }
```

Also add the four function names to the return object:

```js
    reorderCategories,
    reorderBrands,
    reorderLocations,
    reorderCustomFields,
```

- [ ] **Step 4.2: Add 4 reorder endpoints to apps/api/src/index.js**

Find the block with `app.delete('/inventory/categories/:id'` (around line 4822) and add after it:

```js
app.patch('/inventory/categories/reorder', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { items } = await c.req.json();
    await inventoryService.reorderCategories(companyId, items);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo reordenar.' }, 500);
  }
});
```

Find `app.delete('/inventory/brands/:id'` (around line 4871) and add after it:

```js
app.patch('/inventory/brands/reorder', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { items } = await c.req.json();
    await inventoryService.reorderBrands(companyId, items);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo reordenar.' }, 500);
  }
});
```

Find `app.delete('/inventory/locations/:id'` (around line 4920) and add after it:

```js
app.patch('/inventory/locations/reorder', authMiddleware, requirePermission('inventory.catalog.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { items } = await c.req.json();
    await inventoryService.reorderLocations(companyId, items);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo reordenar.' }, 500);
  }
});
```

Find `app.delete('/inventory/custom-fields/:id'` (around line 4970) and add after it:

```js
app.patch('/inventory/custom-fields/reorder', authMiddleware, requirePermission('inventory.customfield.manage'), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { items } = await c.req.json();
    await inventoryService.reorderCustomFields(companyId, items);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo reordenar.' }, 500);
  }
});
```

- [ ] **Step 4.3: Commit**

```bash
git add apps/api/src/services/inventory-service.js apps/api/src/index.js
git commit -m "feat(api): add reorder endpoints for inventory categories, brands, locations, custom-fields"
```

---

## Task 5: Frontend — inventory reorder hooks

**Files:**
- Modify: `apps/desktop/src/modules/atlas.inventory/hooks/useInventoryCatalogs.js`

- [ ] **Step 5.1: Add 4 reorder hooks to useInventoryCatalogs.js**

Add these functions after their respective delete hooks. After `useDeleteInventoryCategory` (around line 68):

```js
export function useReorderInventoryCategories() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items) => atlas.inventory.reorderCategories(items, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'categories'] }),
    onError: () => toast.error('Error al guardar el orden'),
  })
}
```

After `useDeleteInventoryBrand` (around line 118):

```js
export function useReorderInventoryBrands() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items) => atlas.inventory.reorderBrands(items, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'brands'] }),
    onError: () => toast.error('Error al guardar el orden'),
  })
}
```

After `useDeleteInventoryLocation` (around line 169):

```js
export function useReorderInventoryLocations() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items) => atlas.inventory.reorderLocations(items, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'locations'] }),
    onError: () => toast.error('Error al guardar el orden'),
  })
}
```

After `useDeleteInventoryCustomField` (around line 220):

```js
export function useReorderInventoryCustomFields() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items) => atlas.inventory.reorderCustomFields(items, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'custom-fields'] }),
    onError: () => toast.error('Error al guardar el orden'),
  })
}
```

- [ ] **Step 5.2: Add atlas.inventory.reorder* methods to the SDK**

Check `packages/sdk/src/index.js` for how inventory methods are declared, then add:

```js
reorderCategories: (items, token) =>
  apiFetch('/inventory/categories/reorder', { method: 'PATCH', body: JSON.stringify({ items }), token }),
reorderBrands: (items, token) =>
  apiFetch('/inventory/brands/reorder', { method: 'PATCH', body: JSON.stringify({ items }), token }),
reorderLocations: (items, token) =>
  apiFetch('/inventory/locations/reorder', { method: 'PATCH', body: JSON.stringify({ items }), token }),
reorderCustomFields: (items, token) =>
  apiFetch('/inventory/custom-fields/reorder', { method: 'PATCH', body: JSON.stringify({ items }), token }),
```

- [ ] **Step 5.3: Commit**

```bash
git add apps/desktop/src/modules/atlas.inventory/hooks/useInventoryCatalogs.js packages/sdk/src/index.js
git commit -m "feat(inventory): add reorder hooks and SDK methods"
```

---

## Task 6: Frontend — InventoryCatalogsScreen with SortableList

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.inventory/screens/InventoryCatalogsScreen.jsx`

- [ ] **Step 6.1: Rewrite InventoryCatalogsScreen.jsx**

Replace the entire file content with:

```jsx
import { useState } from 'react'
import {
  PageHeader,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  TextField,
  TextareaField,
  SelectField,
  EmptyState,
  LoadingState,
  ConfirmDialog,
  Card,
  SortableList,
} from '@atlas/ui'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import {
  useInventoryCategories,
  useCreateInventoryCategory,
  useUpdateInventoryCategory,
  useDeleteInventoryCategory,
  useReorderInventoryCategories,
  useInventoryBrands,
  useCreateInventoryBrand,
  useUpdateInventoryBrand,
  useDeleteInventoryBrand,
  useReorderInventoryBrands,
  useInventoryLocations,
  useCreateInventoryLocation,
  useUpdateInventoryLocation,
  useDeleteInventoryLocation,
  useReorderInventoryLocations,
  useInventoryCustomFields,
  useCreateInventoryCustomField,
  useUpdateInventoryCustomField,
  useDeleteInventoryCustomField,
  useReorderInventoryCustomFields,
} from '../hooks/useInventoryCatalogs.js'

// ── Sortable row ──────────────────────────────────────────────────────────────

function SortableRow({ item, onEdit, onDelete, dragHandleProps, isDragging }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  return (
    <>
      <div
        className={[
          'flex items-center gap-2 px-3 py-2.5 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg group',
          isDragging ? 'opacity-50 shadow-lg' : '',
        ].join(' ')}
      >
        <button
          {...dragHandleProps}
          type="button"
          className="cursor-grab text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] touch-none flex-shrink-0"
          aria-label="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </button>
        <span className="flex-1 text-sm font-medium text-[hsl(var(--foreground))] truncate">
          {item.name ?? item.label}
        </span>
        <span className="text-xs text-[hsl(var(--muted-foreground))] hidden sm:block truncate max-w-[200px]">
          {item.description ?? item.fieldKey ?? ''}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--destructive))]"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Eliminar "${item.name ?? item.label}"`}
        description="Esta accion deshabilitara el registro. Los items asociados no se veran afectados."
        confirmLabel="Eliminar"
        onConfirm={() => { onDelete(item.id); setDeleteOpen(false) }}
      />
    </>
  )
}

// ── Generic sortable catalog section ─────────────────────────────────────────

function SortableCatalogSection({ rows, onEdit, onDelete, onReorder, isLoading, emptyMsg, onCreate }) {
  const [localOrder, setLocalOrder] = useState(null)
  const items = localOrder ?? rows

  function handleReorder(newOrder) {
    setLocalOrder(newOrder)
    onReorder(newOrder)
  }

  // Reset local order when rows change (after server refresh)
  if (localOrder && rows.length !== localOrder.length) setLocalOrder(null)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
      {isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState title="Sin registros" description={emptyMsg} action={{ label: 'Agregar', onClick: onCreate }} />
      ) : (
        <div className="space-y-1.5">
          <SortableList
            items={items}
            onReorder={handleReorder}
            renderItem={(item, { dragHandleProps, isDragging }) => (
              <SortableRow
                item={item}
                dragHandleProps={dragHandleProps}
                isDragging={isDragging}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          />
        </div>
      )}
    </div>
  )
}

// ── Simple edit sheet ─────────────────────────────────────────────────────────

function SimpleSheet({ open, onOpenChange, title, fields, values, onChange, onSave, busy }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="py-6 space-y-4">
          {fields.map(f => f.type === 'textarea' ? (
            <TextareaField
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={3}
            />
          ) : (
            <TextField
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              required={f.required}
            />
          ))}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={busy || !values.name?.trim?.()}>
            {busy ? 'Guardando...' : 'Guardar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Category tab ──────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', color: '#7c3aed' })

  const { data, isLoading } = useInventoryCategories()
  const rows = (data?.data ?? data ?? []).filter(c => c.enabled !== false)
  const createMutation = useCreateInventoryCategory()
  const updateMutation = useUpdateInventoryCategory()
  const deleteMutation = useDeleteInventoryCategory()
  const reorderMutation = useReorderInventoryCategories()

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', color: '#7c3aed' })
    setSheetOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({ name: item.name, description: item.description ?? '', color: item.color ?? '#7c3aed' })
    setSheetOpen(true)
  }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast.success('Categoria actualizada')
      } else {
        await createMutation.mutateAsync(form)
        toast.success('Categoria creada')
      }
      setSheetOpen(false)
    } catch (err) {
      toast.error(err?.message ?? 'Error al guardar')
    }
  }

  function handleReorder(newOrder) {
    reorderMutation.mutate(newOrder.map((item, idx) => ({ id: item.id, sortOrder: idx * 10 })))
  }

  const busy = createMutation.isPending || updateMutation.isPending

  return (
    <>
      <SortableCatalogSection
        rows={rows}
        onEdit={openEdit}
        onDelete={id => deleteMutation.mutateAsync(id).then(() => toast.success('Eliminado'))}
        onReorder={handleReorder}
        isLoading={isLoading}
        emptyMsg="Crea tu primera categoria de activos"
        onCreate={openCreate}
      />
      <SimpleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? 'Editar categoria' : 'Nueva categoria'}
        fields={[
          { key: 'name', label: 'Nombre', placeholder: 'Tecnologia', required: true },
          { key: 'description', label: 'Descripcion', placeholder: 'Equipos electronicos...', type: 'textarea' },
          { key: 'color', label: 'Color (hex)', placeholder: '#7c3aed' },
        ]}
        values={form}
        onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
        onSave={handleSave}
        busy={busy}
      />
    </>
  )
}

// ── Brand tab ─────────────────────────────────────────────────────────────────

function BrandsTab() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })

  const { data, isLoading } = useInventoryBrands()
  const rows = (data?.data ?? data ?? []).filter(b => b.enabled !== false)
  const createMutation = useCreateInventoryBrand()
  const updateMutation = useUpdateInventoryBrand()
  const deleteMutation = useDeleteInventoryBrand()
  const reorderMutation = useReorderInventoryBrands()

  function openCreate() { setEditing(null); setForm({ name: '', description: '' }); setSheetOpen(true) }
  function openEdit(item) { setEditing(item); setForm({ name: item.name, description: item.description ?? '' }); setSheetOpen(true) }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast.success('Marca actualizada')
      } else {
        await createMutation.mutateAsync(form)
        toast.success('Marca creada')
      }
      setSheetOpen(false)
    } catch (err) { toast.error(err?.message ?? 'Error al guardar') }
  }

  function handleReorder(newOrder) {
    reorderMutation.mutate(newOrder.map((item, idx) => ({ id: item.id, sortOrder: idx * 10 })))
  }

  return (
    <>
      <SortableCatalogSection
        rows={rows}
        onEdit={openEdit}
        onDelete={id => deleteMutation.mutateAsync(id).then(() => toast.success('Eliminado'))}
        onReorder={handleReorder}
        isLoading={isLoading}
        emptyMsg="Crea tu primera marca"
        onCreate={openCreate}
      />
      <SimpleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? 'Editar marca' : 'Nueva marca'}
        fields={[
          { key: 'name', label: 'Nombre', placeholder: 'Dell', required: true },
          { key: 'description', label: 'Descripcion', placeholder: 'Fabricante de equipos...', type: 'textarea' },
        ]}
        values={form}
        onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
        onSave={handleSave}
        busy={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}

// ── Location tab ──────────────────────────────────────────────────────────────

function LocationsTab() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', address: '' })

  const { data, isLoading } = useInventoryLocations()
  const rows = (data?.data ?? data ?? []).filter(l => l.enabled !== false)
  const createMutation = useCreateInventoryLocation()
  const updateMutation = useUpdateInventoryLocation()
  const deleteMutation = useDeleteInventoryLocation()
  const reorderMutation = useReorderInventoryLocations()

  function openCreate() { setEditing(null); setForm({ name: '', description: '', address: '' }); setSheetOpen(true) }
  function openEdit(item) { setEditing(item); setForm({ name: item.name, description: item.description ?? '', address: item.address ?? '' }); setSheetOpen(true) }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast.success('Ubicacion actualizada')
      } else {
        await createMutation.mutateAsync(form)
        toast.success('Ubicacion creada')
      }
      setSheetOpen(false)
    } catch (err) { toast.error(err?.message ?? 'Error al guardar') }
  }

  function handleReorder(newOrder) {
    reorderMutation.mutate(newOrder.map((item, idx) => ({ id: item.id, sortOrder: idx * 10 })))
  }

  return (
    <>
      <SortableCatalogSection
        rows={rows}
        onEdit={openEdit}
        onDelete={id => deleteMutation.mutateAsync(id).then(() => toast.success('Eliminado'))}
        onReorder={handleReorder}
        isLoading={isLoading}
        emptyMsg="Crea tu primera ubicacion"
        onCreate={openCreate}
      />
      <SimpleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? 'Editar ubicacion' : 'Nueva ubicacion'}
        fields={[
          { key: 'name', label: 'Nombre', placeholder: 'Oficina principal', required: true },
          { key: 'description', label: 'Descripcion', placeholder: 'Planta 3, area de TI...', type: 'textarea' },
          { key: 'address', label: 'Direccion', placeholder: 'Av. Lima 123...' },
        ]}
        values={form}
        onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
        onSave={handleSave}
        busy={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}

// ── Custom fields tab ─────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'number', label: 'Numero' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Si/No' },
  { value: 'select', label: 'Lista de opciones' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
]

function CustomFieldsTab() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ label: '', fieldKey: '', fieldType: 'text' })

  const { data, isLoading } = useInventoryCustomFields()
  const rows = (data?.data ?? data ?? []).filter(f => f.enabled !== false)
  const createMutation = useCreateInventoryCustomField()
  const updateMutation = useUpdateInventoryCustomField()
  const deleteMutation = useDeleteInventoryCustomField()
  const reorderMutation = useReorderInventoryCustomFields()

  function openCreate() { setEditing(null); setForm({ label: '', fieldKey: '', fieldType: 'text' }); setSheetOpen(true) }
  function openEdit(item) {
    setEditing(item)
    setForm({ label: item.label, fieldKey: item.fieldKey, fieldType: item.fieldType })
    setSheetOpen(true)
  }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast.success('Campo actualizado')
      } else {
        await createMutation.mutateAsync(form)
        toast.success('Campo creado')
      }
      setSheetOpen(false)
    } catch (err) { toast.error(err?.message ?? 'Error al guardar') }
  }

  function handleReorder(newOrder) {
    reorderMutation.mutate(newOrder.map((item, idx) => ({ id: item.id, sortOrder: idx * 10 })))
  }

  const [localOrder, setLocalOrder] = useState(null)
  const items = (localOrder ?? rows).map(r => ({ ...r, id: r.id, name: r.label, description: r.fieldKey }))

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nuevo campo
          </Button>
        </div>
        {isLoading ? <LoadingState /> : items.length === 0 ? (
          <EmptyState title="Sin campos" description="Crea campos personalizados para tus categorias" action={{ label: 'Nuevo campo', onClick: openCreate }} />
        ) : (
          <div className="space-y-1.5">
            <SortableList
              items={items}
              onReorder={(newOrder) => {
                setLocalOrder(newOrder.map(i => rows.find(r => r.id === i.id)))
                handleReorder(newOrder)
              }}
              renderItem={(item, { dragHandleProps, isDragging }) => (
                <SortableRow
                  item={item}
                  dragHandleProps={dragHandleProps}
                  isDragging={isDragging}
                  onEdit={() => openEdit(rows.find(r => r.id === item.id))}
                  onDelete={id => deleteMutation.mutateAsync(id).then(() => toast.success('Eliminado'))}
                />
              )}
            />
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar campo' : 'Nuevo campo personalizado'}</SheetTitle>
          </SheetHeader>
          <div className="py-6 space-y-4">
            <TextField
              label="Etiqueta"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Numero de serie externo"
              required
            />
            <TextField
              label="Clave (fieldKey)"
              value={form.fieldKey}
              onChange={e => setForm(f => ({ ...f, fieldKey: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
              placeholder="serial_ext"
              hint="Solo letras, numeros y guiones bajos"
              disabled={Boolean(editing)}
            />
            <SelectField
              label="Tipo de campo"
              value={form.fieldType}
              onChange={v => setForm(f => ({ ...f, fieldType: v }))}
              options={FIELD_TYPES}
            />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={createMutation.isPending || updateMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.label.trim() || !form.fieldKey.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InventoryCatalogsScreen() {
  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Inventario"
        title="Catalogos"
        description="Administra categorias, marcas, ubicaciones y campos personalizados. Arrastra para reordenar."
      />

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="brands">Marcas</TabsTrigger>
          <TabsTrigger value="locations">Ubicaciones</TabsTrigger>
          <TabsTrigger value="custom-fields">Campos personalizados</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="brands" className="mt-4">
          <BrandsTab />
        </TabsContent>
        <TabsContent value="locations" className="mt-4">
          <LocationsTab />
        </TabsContent>
        <TabsContent value="custom-fields" className="mt-4">
          <CustomFieldsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 6.2: Commit**

```bash
git add apps/desktop/src/modules/atlas.inventory/screens/InventoryCatalogsScreen.jsx
git commit -m "feat(inventory): replace catalog tables with DnD sortable lists"
```

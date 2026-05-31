# atlas.catalog v2 — Plan B: Frontend (UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete catalog management UI following the exact design patterns of sibling modules (HR, Contacts): `PageHeader` + `AtlasTable` + pill tabs + `motion/react` animations + `ConfirmDialog` + `atlas.*` SDK calls.

**Architecture:** Add `atlas.catalog` section to the SDK. Four screens (Products list, Product detail with 6 tabs, Categories, Inventory) + four supporting components. `AtlasTable` with blueprints handles product and inventory lists. Product detail uses pill tabs + `AnimatePresence` transitions + `SectionCard` pattern — identical to `HrEmployeeDetail`. File uploads use `atlas.files.*` SDK methods.

**Tech Stack:** React, TanStack Query, `@atlas/ui` (`AtlasTable`, `PageHeader`, `Badge`, `ConfirmDialog`, `EmptyState`, `Skeleton`, `MarkdownField`, `MarkdownViewer`, `cn`), `motion/react`, Lucide icons, Sonner toasts.

**Prerequisite:** Plan A backend must be complete and verified.

**Reference files to read before implementing:**
- `apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx` — AtlasTable + PageHeader pattern
- `apps/desktop/src/modules/atlas.hr/screens/HrCatalogsScreen.jsx` — pill tabs + AnimatePresence
- `apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx` — detail tabs + SectionCard
- `apps/desktop/src/modules/atlas.contacts/screens/ContactsScreen.jsx` — ConfirmDialog + bulk actions
- `packages/sdk/src/index.js` — SDK structure (add catalog section before the closing brace)

---

## File map

```
packages/sdk/src/index.js                                       MODIFY (add catalog section)
apps/desktop/src/modules/atlas.catalog/
  index.js                                                      MODIFY (add new screen exports/routes)
  screens/
    CatalogProductsScreen.jsx                                   REWRITE
    CatalogProductDetailScreen.jsx                              CREATE
    CatalogCategoriesScreen.jsx                                 REWRITE
    CatalogInventoryScreen.jsx                                  CREATE
  components/
    ProductImageManager.jsx                                     CREATE
    StockMovementModal.jsx                                      CREATE
    VariantOptionsEditor.jsx                                    CREATE
    VariantMatrix.jsx                                           CREATE
```

---

## Task 1: Add atlas.catalog SDK methods + update catalog index.js

**Files:**
- Modify: `packages/sdk/src/index.js`
- Modify: `apps/desktop/src/modules/atlas.catalog/index.js`

- [ ] **Step 1: Read packages/sdk/src/index.js**

Read the file to locate the closing `}` of the `createAtlasClient` return object (after the `ledger` section). Add the `catalog` section just before that closing brace.

- [ ] **Step 2: Add catalog section to SDK**

Insert this block inside the `createAtlasClient` return object, after the `ledger` property and before the closing `};`:

```js
    catalog: {
      // Products
      listProducts: (token, options = {}) =>
        request(`/catalog/products${toQueryString(options)}`, { headers: withAuthHeaders(token) }),
      getProduct: (id, token) =>
        request(`/catalog/products/${encodeURIComponent(id)}`, { headers: withAuthHeaders(token) }),
      createProduct: (data, token) =>
        request('/catalog/products', { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      updateProduct: (id, data, token) =>
        request(`/catalog/products/${encodeURIComponent(id)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      deleteProduct: (id, token) =>
        request(`/catalog/products/${encodeURIComponent(id)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      publishProduct: (id, token) =>
        request(`/catalog/products/${encodeURIComponent(id)}/publish`, { method: 'POST', headers: withAuthHeaders(token) }),
      unpublishProduct: (id, token) =>
        request(`/catalog/products/${encodeURIComponent(id)}/unpublish`, { method: 'POST', headers: withAuthHeaders(token) }),
      // Options
      listOptions: (productId, token) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/options`, { headers: withAuthHeaders(token) }),
      createOption: (productId, data, token) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/options`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      updateOption: (productId, optionId, data, token) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/options/${encodeURIComponent(optionId)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      deleteOption: (productId, optionId, token) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/options/${encodeURIComponent(optionId)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      // Variants
      listVariants: (productId, token) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/variants`, { headers: withAuthHeaders(token) }),
      createVariant: (productId, data, token) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/variants`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      updateVariant: (productId, variantId, data, token) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      deleteVariant: (productId, variantId, token) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      // Stock
      recordStockMovement: (productId, data, token) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/stock-movements`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      listStockMovements: (productId, token, options = {}) =>
        request(`/catalog/products/${encodeURIComponent(productId)}/stock-movements${toQueryString(options)}`, { headers: withAuthHeaders(token) }),
      // Categories
      listCategories: (token, options = {}) =>
        request(`/catalog/categories${toQueryString(options)}`, { headers: withAuthHeaders(token) }),
      createCategory: (data, token) =>
        request('/catalog/categories', { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      updateCategory: (id, data, token) =>
        request(`/catalog/categories/${encodeURIComponent(id)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      deleteCategory: (id, token) =>
        request(`/catalog/categories/${encodeURIComponent(id)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
    },
```

- [ ] **Step 3: Run syntax check on SDK**

```bash
node --check packages/sdk/src/index.js
```

Expected: no output (no errors).

- [ ] **Step 4: Update catalog module index.js**

Replace the full content of `apps/desktop/src/modules/atlas.catalog/index.js`:

```js
export { default as CatalogProductsScreen }    from './screens/CatalogProductsScreen.jsx'
export { default as CatalogProductDetailScreen } from './screens/CatalogProductDetailScreen.jsx'
export { default as CatalogCategoriesScreen }  from './screens/CatalogCategoriesScreen.jsx'
export { default as CatalogInventoryScreen }   from './screens/CatalogInventoryScreen.jsx'
```

> Note: Check how the app router registers catalog routes — look in `apps/desktop/src/App.jsx` or the main router file for how `atlas.hr` screens are registered, then follow the same pattern to register the new catalog screens. The router setup is NOT in index.js — it lives in the App router. Find where `CatalogProductsScreen` and `CatalogCategoriesScreen` are imported and add the two new screens + their routes.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/index.js apps/desktop/src/modules/atlas.catalog/index.js
git commit -m "feat(catalog): add atlas.catalog SDK methods and export new screens"
```

---

## Task 2: Create ProductImageManager component

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/components/ProductImageManager.jsx`

This component handles cover image + gallery. It uploads files directly to atlas.files via `atlas.files.upload()` and resolves signed URLs via `atlas.files.batchSignedUrls()`. It differs from the existing `ImageUploader` (which works with File objects) — this one works with FileAsset UUIDs persisted in the product.

- [ ] **Step 1: Create ProductImageManager.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/components/ProductImageManager.jsx
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { cn } from '@atlas/ui'
import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas.js'

/**
 * Props:
 *   token       string
 *   coverId     string | null    — current cover_asset_id UUID
 *   imageIds    string[]         — current gallery asset UUIDs
 *   onChange    ({ coverId, imageIds }) => void
 */
export default function ProductImageManager({ token, coverId, imageIds = [], onChange }) {
  const coverInputRef   = useRef(null)
  const galleryInputRef = useRef(null)
  const [signedUrls, setSignedUrls] = useState({})

  const allIds = [...new Set([coverId, ...imageIds].filter(Boolean))]

  useEffect(() => {
    if (!allIds.length || !token) return
    atlas.files.batchSignedUrls(allIds, token)
      .then(res => {
        const map = {}
        const items = res?.data ?? res?.urls ?? []
        if (Array.isArray(items)) {
          items.forEach(item => { if (item?.fileId && item?.url) map[item.fileId] = item.url })
        } else if (typeof items === 'object') {
          Object.assign(map, items)
        }
        setSignedUrls(map)
      })
      .catch(() => null)
  }, [allIds.join(','), token])

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const form = new FormData()
      form.append('file', file)
      const res = await atlas.files.upload(form, token)
      return res?.data ?? res
    },
  })

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const asset = await uploadMutation.mutateAsync(file)
      onChange({ coverId: asset.id, imageIds })
      toast.success('Imagen de portada actualizada')
    } catch (err) {
      toast.error(err?.message ?? 'Error al subir imagen')
    } finally { e.target.value = '' }
  }

  async function handleGalleryUpload(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const uploaded = []
    for (const file of files) {
      try {
        const asset = await uploadMutation.mutateAsync(file)
        uploaded.push(asset.id)
      } catch (err) {
        toast.error(`Error subiendo ${file.name}: ${err?.message}`)
      }
    }
    if (uploaded.length) {
      onChange({ coverId, imageIds: [...imageIds, ...uploaded] })
      toast.success(`${uploaded.length} imagen(es) agregada(s)`)
    }
    e.target.value = ''
  }

  function removeCover() { onChange({ coverId: null, imageIds }) }
  function removeFromGallery(id) { onChange({ coverId, imageIds: imageIds.filter(i => i !== id) }) }
  function promoteTocover(id) { onChange({ coverId: id, imageIds: imageIds.filter(i => i !== id) }) }

  return (
    <div className="space-y-6">
      {/* Cover */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Imagen de portada</p>
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className={cn(
              'relative h-32 w-32 rounded-2xl border-2 border-dashed border-[hsl(var(--border))] overflow-hidden',
              'bg-[hsl(var(--muted))]/40 transition-colors hover:bg-[hsl(var(--muted))]/60 hover:border-[hsl(var(--foreground))]/30',
              'flex flex-col items-center justify-center gap-1',
            )}
          >
            {coverId && signedUrls[coverId] ? (
              <>
                <img src={signedUrls[coverId]} alt="Portada" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-xs font-medium">Cambiar</p>
                </div>
              </>
            ) : (
              <>
                <ImagePlus className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Subir portada</p>
              </>
            )}
          </button>
          {coverId && (
            <button
              type="button"
              onClick={removeCover}
              className="mt-1 flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" /> Quitar portada
            </button>
          )}
        </div>
        <input ref={coverInputRef} type="file" accept="image/*" className="sr-only" onChange={handleCoverUpload} />
      </div>

      {/* Gallery */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Galeria adicional</p>
        <div className="flex flex-wrap gap-3">
          {imageIds.map(id => (
            <div key={id} className="group relative h-24 w-24 rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--muted))]">
              {signedUrls[id] && <img src={signedUrls[id]} alt="" className="h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => promoteTocover(id)}
                  className="flex items-center gap-1 text-xs text-white hover:text-yellow-300"
                >
                  <Star className="h-3 w-3" /> Portada
                </button>
                <button
                  type="button"
                  onClick={() => removeFromGallery(id)}
                  className="flex items-center gap-1 text-xs text-white hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" /> Quitar
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="h-24 w-24 rounded-xl border-2 border-dashed border-[hsl(var(--border))] flex flex-col items-center justify-center gap-1 text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))]/30 hover:bg-[hsl(var(--muted))]/40 transition-colors"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-xs">Agregar</span>
          </button>
        </div>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleGalleryUpload} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/components/ProductImageManager.jsx
git commit -m "feat(catalog): add ProductImageManager component with atlas.files SDK upload"
```

---

## Task 3: Create StockMovementModal and VariantOptionsEditor

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/components/StockMovementModal.jsx`
- Create: `apps/desktop/src/modules/atlas.catalog/components/VariantOptionsEditor.jsx`

- [ ] **Step 1: Create StockMovementModal.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/components/StockMovementModal.jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label } from '@atlas/ui'
import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas.js'

/**
 * Props:
 *   open        boolean
 *   onClose     fn()
 *   token       string
 *   productId   string
 *   variantId   string | null
 *   variantLabel string | null
 */
export default function StockMovementModal({ open, onClose, token, productId, variantId = null, variantLabel = null }) {
  const queryClient = useQueryClient()
  const [delta, setDelta]   = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote]     = useState('')

  const mutation = useMutation({
    mutationFn: () => atlas.catalog.recordStockMovement(productId, {
      variant_id:     variantId ?? undefined,
      quantity_delta: Number(delta),
      reason:         reason || undefined,
      note:           note   || undefined,
    }, token),
    onSuccess: () => {
      toast.success('Ajuste registrado')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
      queryClient.invalidateQueries({ queryKey: ['catalog-stock-movements', productId] })
      setDelta(''); setReason(''); setNote('')
      onClose()
    },
    onError: (err) => toast.error(err?.message ?? 'Error al registrar ajuste'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!delta || Number(delta) === 0) return toast.error('El delta no puede ser cero')
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar ajuste de stock</DialogTitle>
        </DialogHeader>
        {variantLabel && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Variante: <strong className="text-[hsl(var(--foreground))]">{variantLabel}</strong>
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sm-delta">Cantidad (+ entrada / - salida)</Label>
            <Input id="sm-delta" type="number" placeholder="ej. 10 o -3" value={delta} onChange={e => setDelta(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-reason">Razon</Label>
            <select
              id="sm-reason"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              <option value="">Sin razon especifica</option>
              <option value="Ajuste manual">Ajuste manual</option>
              <option value="Compra">Compra</option>
              <option value="Venta">Venta</option>
              <option value="Devolucion">Devolucion</option>
              <option value="Merma">Merma</option>
              <option value="Inventario fisico">Inventario fisico</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-note">Nota (opcional)</Label>
            <Input id="sm-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Detalle adicional..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando...' : 'Registrar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create VariantOptionsEditor.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/components/VariantOptionsEditor.jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Label, cn } from '@atlas/ui'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas.js'

/**
 * Props:
 *   token      string
 *   productId  string
 *   options    Array<{ id, name, position, values: [{id, value, position}] }>
 */
export default function VariantOptionsEditor({ token, productId, options = [] }) {
  const queryClient = useQueryClient()
  const [newOptionName, setNewOptionName] = useState('')

  const addMutation = useMutation({
    mutationFn: (data) => atlas.catalog.createOption(productId, data, token),
    onSuccess: () => {
      toast.success('Opcion creada')
      setNewOptionName('')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (optionId) => atlas.catalog.deleteOption(productId, optionId, token),
    onSuccess: () => {
      toast.success('Opcion eliminada')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ optionId, values }) => atlas.catalog.updateOption(productId, optionId, { values }, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] }),
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  function handleAddOption(e) {
    e.preventDefault()
    if (!newOptionName.trim()) return
    addMutation.mutate({ name: newOptionName.trim(), values: [] })
  }

  function handleAddValue(option, val) {
    if (!val.trim()) return
    const current = option.values.map(v => v.value)
    if (current.includes(val.trim())) return
    updateMutation.mutate({ optionId: option.id, values: [...current, val.trim()] })
  }

  function handleRemoveValue(option, val) {
    updateMutation.mutate({ optionId: option.id, values: option.values.map(v => v.value).filter(v => v !== val) })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Opciones de variantes</p>

      {options.map(opt => (
        <OptionRow
          key={opt.id}
          option={opt}
          onDelete={() => deleteMutation.mutate(opt.id)}
          onAddValue={val => handleAddValue(opt, val)}
          onRemoveValue={val => handleRemoveValue(opt, val)}
        />
      ))}

      <form onSubmit={handleAddOption} className="flex gap-2">
        <Input
          placeholder="Nueva opcion (ej. Talla, Color...)"
          value={newOptionName}
          onChange={e => setNewOptionName(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" size="sm" disabled={addMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Agregar opcion
        </Button>
      </form>
    </div>
  )
}

function OptionRow({ option, onDelete, onAddValue, onRemoveValue }) {
  const [newVal, setNewVal] = useState('')

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    onAddValue(newVal)
    setNewVal('')
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{option.name}</p>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {option.values.map(v => (
          <span key={v.id} className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--foreground))]">
            {v.value}
            <button type="button" onClick={() => onRemoveValue(v.value)} className="hover:text-red-500 ml-0.5">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          placeholder="Nuevo valor + Enter"
          value={newVal}
          onChange={e => setNewVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-36 text-xs"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/components/StockMovementModal.jsx \
        apps/desktop/src/modules/atlas.catalog/components/VariantOptionsEditor.jsx
git commit -m "feat(catalog): add StockMovementModal and VariantOptionsEditor components"
```

---

## Task 4: Create VariantMatrix component

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/components/VariantMatrix.jsx`

- [ ] **Step 1: Create VariantMatrix.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/components/VariantMatrix.jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, cn } from '@atlas/ui'
import { Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas.js'

/**
 * Props:
 *   token      string
 *   productId  string
 *   variants   Array<{ id, option_values, sku, barcode, price, stock, enabled }>
 */
export default function VariantMatrix({ token, productId, variants = [] }) {
  const queryClient  = useQueryClient()
  const [edits, setEdits] = useState({})

  const updateMutation = useMutation({
    mutationFn: ({ variantId, data }) => atlas.catalog.updateVariant(productId, variantId, data, token),
    onSuccess: (_, { variantId }) => {
      setEdits(prev => { const n = { ...prev }; delete n[variantId]; return n })
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
      toast.success('Variante guardada')
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const createMutation = useMutation({
    mutationFn: (data) => atlas.catalog.createVariant(productId, data, token),
    onSuccess: () => {
      toast.success('Variante creada')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (variantId) => atlas.catalog.deleteVariant(productId, variantId, token),
    onSuccess: () => {
      toast.success('Variante eliminada')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  function edit(variantId, field, value) {
    setEdits(prev => ({ ...prev, [variantId]: { ...(prev[variantId] ?? {}), [field]: value } }))
  }

  function getLabel(optionValues) {
    if (!optionValues || typeof optionValues !== 'object') return 'Default'
    return Object.values(optionValues).filter(Boolean).join(' / ') || 'Default'
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
        Variantes ({variants.length})
      </p>

      {variants.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Define las opciones arriba y agrega variantes aqui.
        </p>
      ) : (
        <div className="rounded-2xl border border-[hsl(var(--border))] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Variante</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">SKU</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Cod. barras</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Precio</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Stock</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {variants.map(v => {
                const e       = edits[v.id] ?? {}
                const isDirty = Boolean(edits[v.id])
                return (
                  <tr key={v.id} className={cn('transition-colors', isDirty && 'bg-blue-50/30 dark:bg-blue-900/10')}>
                    <td className="px-4 py-2 font-medium text-sm">{getLabel(v.option_values)}</td>
                    <td className="px-4 py-2">
                      <Input value={e.sku ?? v.sku ?? ''} onChange={ev => edit(v.id, 'sku', ev.target.value)} className="h-7 w-28 text-xs" placeholder="SKU" />
                    </td>
                    <td className="px-4 py-2">
                      <Input value={e.barcode ?? v.barcode ?? ''} onChange={ev => edit(v.id, 'barcode', ev.target.value)} className="h-7 w-32 text-xs" placeholder="EAN/UPC" />
                    </td>
                    <td className="px-4 py-2">
                      <Input type="number" min="0" step="0.01" value={e.price ?? v.price ?? 0} onChange={ev => edit(v.id, 'price', Number(ev.target.value))} className="h-7 w-24 text-xs" />
                    </td>
                    <td className="px-4 py-2">
                      <Input type="number" min="0" value={e.stock ?? v.stock ?? 0} onChange={ev => edit(v.id, 'stock', Number(ev.target.value))} className="h-7 w-20 text-xs" />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        {isDirty && (
                          <button
                            type="button"
                            onClick={() => updateMutation.mutate({ variantId: v.id, data: edits[v.id] })}
                            disabled={updateMutation.isPending}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { if (window.confirm('Eliminar esta variante?')) deleteMutation.mutate(v.id) }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => createMutation.mutate({ option_values: {}, price: 0, stock: 0 })} disabled={createMutation.isPending}>
        <Plus className="h-4 w-4 mr-1" /> Agregar variante
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/components/VariantMatrix.jsx
git commit -m "feat(catalog): add VariantMatrix inline-editable component"
```

---

## Task 5: Rewrite CatalogProductsScreen

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx`

Pattern: identical to `HrScreen.jsx` and `ContactsScreen.jsx` — `PageHeader` + `AtlasTable` + `ConfirmDialog`.

- [ ] **Step 1: Read the current CatalogProductsScreen.jsx to understand what to replace**

- [ ] **Step 2: Write new CatalogProductsScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AtlasTable, Button, ConfirmDialog, PageHeader } from '@atlas/ui'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { atlas } from '../../../lib/atlas.js'

const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const CATALOG_PRODUCTS_BLUEPRINT = {
  key: 'catalog.products.table',
  schema: {
    apiPath: '/catalog/products',
    primaryField: 'name',
    searchable: true,
    searchPlaceholder: 'Buscar producto...',
    columns: [
      { field: 'name', label: 'Nombre', sortable: true, link: true },
      {
        field: 'product_type',
        label: 'Tipo',
        sortable: false,
        type: 'select',
        options: [
          { value: 'SIMPLE',   label: 'Simple' },
          { value: 'VARIABLE', label: 'Variable' },
        ],
      },
      { field: 'category_name', label: 'Categoria', sortable: false },
      { field: 'price', label: 'Precio', sortable: true, type: 'decimal' },
      { field: 'stock', label: 'Stock', sortable: true },
      {
        field: 'published',
        label: 'Estado',
        sortable: false,
        type: 'select',
        options: [
          { value: true,  label: 'Publicado' },
          { value: false, label: 'Borrador' },
        ],
      },
    ],
    filters: [
      {
        key: 'type',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'SIMPLE',   label: 'Simple' },
          { value: 'VARIABLE', label: 'Variable' },
        ],
      },
      {
        key: 'published',
        label: 'Estado',
        type: 'select',
        options: [
          { value: 'true',  label: 'Publicado' },
          { value: 'false', label: 'Borrador' },
        ],
      },
    ],
    emptyState: { message: 'No hay productos registrados.' },
  },
}

export default function CatalogProductsScreen() {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissions = userProfile?.permissions ?? []
  const hasPermission = key => Boolean(userProfile?.isAdmin || permissions.includes(key))
  const canCreate = hasPermission('catalog.products.create')
  const canUpdate = hasPermission('catalog.products.update')
  const canDelete = hasPermission('catalog.products.delete')

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const deleteMutation = useMutation({
    mutationFn: id => atlas.catalog.deleteProduct(id, token),
    onSuccess: () => {
      setConfirmDelete(null)
      setRefreshSignal(s => s + 1)
      toast.success('Producto eliminado')
    },
    onError: err => toast.error(err?.message ?? 'No se pudo eliminar el producto'),
  })

  const createMutation = useMutation({
    mutationFn: data => atlas.catalog.createProduct(data, token),
    onSuccess: res => {
      toast.success('Producto creado')
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] })
      navigate(`/app/m/atlas.catalog/${res.data.id}`)
    },
    onError: err => toast.error(err?.message ?? 'No se pudo crear el producto'),
  })

  function handleCreate() {
    const name = prompt('Nombre del producto:')
    if (!name?.trim()) return
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    createMutation.mutate({ name: name.trim(), slug, price: 0 })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Catalog"
        title="Productos"
        description="Gestiona el catalogo de productos de tu empresa."
        actions={
          canCreate && (
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo producto
            </Button>
          )
        }
      />

      <AtlasTable
        blueprint={CATALOG_PRODUCTS_BLUEPRINT}
        token={token}
        apiBaseUrl={API_BASE_URL}
        onView={row => navigate(`/app/m/atlas.catalog/${row.id}`)}
        onEdit={canUpdate ? row => navigate(`/app/m/atlas.catalog/${row.id}`) : undefined}
        onDelete={canDelete ? row => setConfirmDelete(row) : undefined}
        refreshSignal={refreshSignal}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={v => !v && setConfirmDelete(null)}
        title="Eliminar producto"
        description="El producto sera desactivado. Esta accion no se puede deshacer facilmente."
        detail={confirmDelete?.name}
        confirmLabel="Eliminar"
        onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx
git commit -m "feat(catalog): rewrite products list screen with PageHeader + AtlasTable"
```

---

## Task 6: Create CatalogProductDetailScreen

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/screens/CatalogProductDetailScreen.jsx`

Pattern: identical to `HrEmployeeDetail.jsx` — back arrow, badge, pill tabs, `AnimatePresence` transitions, `SectionCard` grouping.

- [ ] **Step 1: Create CatalogProductDetailScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/screens/CatalogProductDetailScreen.jsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Badge, Button, Input, Label, MarkdownField, MarkdownViewer, Skeleton, Switch, cn } from '@atlas/ui'
import { ArrowLeft, Globe, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { atlas } from '../../../lib/atlas.js'
import ProductImageManager  from '../components/ProductImageManager.jsx'
import StockMovementModal   from '../components/StockMovementModal.jsx'
import VariantOptionsEditor from '../components/VariantOptionsEditor.jsx'
import VariantMatrix        from '../components/VariantMatrix.jsx'

const ALL_TABS = ['General', 'Imagenes', 'Precios', 'Variantes', 'Inventario', 'SEO']

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, className }) {
  return (
    <div className={cn('rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4', className)}>
      {title && (
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />}
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="min-w-0">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{value}</p>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CatalogProductDetailScreen() {
  const { id }  = useParams()
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissions = userProfile?.permissions ?? []
  const hasPermission = key => Boolean(userProfile?.isAdmin || permissions.includes(key))
  const canUpdate = hasPermission('catalog.products.update')

  const [tab, setTab] = useState('General')
  const [stockModalOpen, setStockModalOpen] = useState(false)

  const { data: productData, isPending } = useQuery({
    queryKey: ['catalog-product', id, token],
    queryFn: () => atlas.catalog.getProduct(id, token),
    enabled: Boolean(token && id),
    staleTime: 30_000,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['catalog-categories-flat', token],
    queryFn: () => atlas.catalog.listCategories(token, { flat: true }),
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  const { data: movementsData } = useQuery({
    queryKey: ['catalog-stock-movements', id, token],
    queryFn: () => atlas.catalog.listStockMovements(id, token, { limit: 50 }),
    enabled: Boolean(token && id && tab === 'Inventario'),
    staleTime: 30_000,
  })

  const updateMutation = useMutation({
    mutationFn: data => atlas.catalog.updateProduct(id, data, token),
    onSuccess: () => {
      toast.success('Producto guardado')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', id] })
    },
    onError: err => toast.error(err?.message ?? 'Error al guardar'),
  })

  const publishMutation = useMutation({
    mutationFn: pub => pub
      ? atlas.catalog.publishProduct(id, token)
      : atlas.catalog.unpublishProduct(id, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-product', id] })
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  if (isPending) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  const product    = productData?.data
  if (!product) return <div className="p-4 md:p-6 text-sm text-red-500">Producto no encontrado.</div>

  const categories = categoriesData?.data ?? []
  const movements  = movementsData?.data  ?? []
  const movTotal   = movementsData?.total ?? 0
  const isVariable = product.product_type === 'VARIABLE'
  const visibleTabs = ALL_TABS.filter(t => t !== 'Variantes' || isVariable)

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/app/m/atlas.catalog')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{product.name}</span>
          <Badge variant={isVariable ? 'secondary' : 'outline'} className="shrink-0">
            {isVariable ? 'Variable' : 'Simple'}
          </Badge>
          {product.published ? (
            <Badge variant="success" className="shrink-0">Publicado</Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">Borrador</Badge>
          )}
        </div>
        {canUpdate && (
          <div className="flex items-center gap-2 shrink-0">
            {product.published ? (
              <Button variant="outline" size="sm" onClick={() => publishMutation.mutate(false)} disabled={publishMutation.isPending}>
                <EyeOff className="h-4 w-4 mr-1.5" /> Despublicar
              </Button>
            ) : (
              <Button size="sm" onClick={() => publishMutation.mutate(true)} disabled={publishMutation.isPending}>
                <Globe className="h-4 w-4 mr-1.5" /> Publicar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pill tabs */}
      <div className="px-4 md:px-6 pt-4">
        <div className="flex items-center gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-1 w-fit">
          {visibleTabs.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150',
                tab === t
                  ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-4 md:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'General'    && <GeneralTab    product={product} categories={categories} onSave={updateMutation.mutate} saving={updateMutation.isPending} />}
            {tab === 'Imagenes'   && <ImagenesTab   product={product} token={token} onSave={updateMutation.mutate} />}
            {tab === 'Precios'    && <PreciosTab    product={product} onSave={updateMutation.mutate} saving={updateMutation.isPending} onStockAdjust={() => setStockModalOpen(true)} />}
            {tab === 'Variantes' && isVariable && <VariantesTab product={product} token={token} productId={id} />}
            {tab === 'Inventario' && <InventarioTab movements={movements} total={movTotal} onAdjust={() => setStockModalOpen(true)} />}
            {tab === 'SEO'        && <SeoTab        product={product} onSave={updateMutation.mutate} saving={updateMutation.isPending} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <StockMovementModal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        token={token}
        productId={id}
      />
    </div>
  )
}

// ── Tab components ────────────────────────────────────────────────────────────

function GeneralTab({ product, categories, onSave, saving }) {
  const [form, setForm] = useState({
    name:        product.name        ?? '',
    slug:        product.slug        ?? '',
    description: product.description ?? '',
    category_id: product.category_id ?? '',
    attributes:  Array.isArray(product.attributes) ? product.attributes : [],
  })

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      name:        form.name,
      slug:        form.slug,
      description: form.description || undefined,
      category_id: form.category_id || null,
      attributes:  form.attributes.filter(a => a.key?.trim()),
    })
  }

  function addAttr()         { setForm(f => ({ ...f, attributes: [...f.attributes, { key: '', value: '' }] })) }
  function removeAttr(i)     { setForm(f => ({ ...f, attributes: f.attributes.filter((_, idx) => idx !== i) })) }
  function setAttr(i, k, v)  { setForm(f => ({ ...f, attributes: f.attributes.map((a, idx) => idx === i ? { ...a, [k]: v } : a) })) }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <SectionCard title="Informacion basica">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Nombre</Label>
            <Input id="g-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-slug">Slug</Label>
            <Input id="g-slug" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Descripcion</Label>
            <MarkdownField value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Describe el producto..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-cat">Categoria</Label>
            <select
              id="g-cat"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">Sin categoria</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Atributos">
        <div className="space-y-2">
          {form.attributes.map((a, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input placeholder="Clave" value={a.key} onChange={e => setAttr(i, 'key', e.target.value)} className="w-36" />
              <Input placeholder="Valor" value={a.value} onChange={e => setAttr(i, 'value', e.target.value)} className="flex-1" />
              <button type="button" onClick={() => removeAttr(i)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 transition-colors text-xs">✕</button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addAttr}>+ Agregar atributo</Button>
        </div>
      </SectionCard>

      <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
    </form>
  )
}

function ImagenesTab({ product, token, onSave }) {
  return (
    <div className="max-w-2xl">
      <SectionCard title="Imagenes del producto">
        <ProductImageManager
          token={token}
          coverId={product.cover_asset_id}
          imageIds={Array.isArray(product.images) ? product.images : []}
          onChange={({ coverId, imageIds }) => onSave({ cover_asset_id: coverId, images: imageIds })}
        />
      </SectionCard>
    </div>
  )
}

function PreciosTab({ product, onSave, saving, onStockAdjust }) {
  const isVariable = product.product_type === 'VARIABLE'
  const [form, setForm] = useState({
    price:        String(product.price        ?? 0),
    compare_price: product.compare_price != null ? String(product.compare_price) : '',
    currency:     product.currency     ?? 'USD',
    sku:          product.sku          ?? '',
    barcode:      product.barcode      ?? '',
    weight:       product.weight  != null ? String(product.weight) : '',
    track_stock:  product.track_stock  ?? false,
  })

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      price:         Number(form.price),
      compare_price: form.compare_price ? Number(form.compare_price) : null,
      currency:      form.currency,
      sku:           form.sku     || null,
      barcode:       form.barcode || null,
      weight:        form.weight  ? Number(form.weight) : null,
      track_stock:   form.track_stock,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <SectionCard title="Precios">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pr-price">Precio</Label>
            <Input id="pr-price" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-currency">Moneda</Label>
            <Input id="pr-currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={3} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr-compare">Precio anterior (tachado)</Label>
          <Input id="pr-compare" type="number" min="0" step="0.01" value={form.compare_price} onChange={e => setForm(f => ({ ...f, compare_price: e.target.value }))} />
        </div>
      </SectionCard>

      {!isVariable && (
        <>
          <SectionCard title="Codigos">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pr-sku">SKU</Label>
                <Input id="pr-sku" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Codigo interno" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-barcode">Codigo de barras (EAN/UPC)</Label>
                <Input id="pr-barcode" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-weight">Peso (kg)</Label>
              <Input id="pr-weight" type="number" min="0" step="0.001" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
          </SectionCard>

          <SectionCard title="Inventario">
            <div className="flex items-center gap-3">
              <Switch id="pr-track" checked={form.track_stock} onCheckedChange={v => setForm(f => ({ ...f, track_stock: v }))} />
              <Label htmlFor="pr-track">Controlar stock</Label>
            </div>
            {form.track_stock && (
              <div className="flex items-center gap-6 mt-3 p-4 rounded-xl bg-[hsl(var(--muted))]/50">
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Stock actual</p>
                  <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{product.stock ?? 0}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onStockAdjust}>Registrar ajuste</Button>
              </div>
            )}
          </SectionCard>
        </>
      )}

      {isVariable && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Los precios, SKU y stock de este producto se gestionan por variante en la pestana Variantes.
        </p>
      )}

      <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
    </form>
  )
}

function VariantesTab({ product, token, productId }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <SectionCard title="Opciones">
        <VariantOptionsEditor token={token} productId={productId} options={product.options ?? []} />
      </SectionCard>
      <SectionCard title="Combinaciones de variantes">
        <VariantMatrix token={token} productId={productId} variants={product.variants ?? []} />
      </SectionCard>
    </div>
  )
}

function InventarioTab({ movements, total, onAdjust }) {
  function fmtDate(val) {
    if (!val) return '—'
    try { return new Date(val).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return val }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Movimientos de stock ({total})
        </p>
        <Button size="sm" onClick={onAdjust}>Registrar ajuste</Button>
      </div>

      {movements.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Sin movimientos registrados.
        </div>
      ) : (
        <div className="rounded-2xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] overflow-hidden">
          {movements.map(m => (
            <div key={m.id} className="flex items-start justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-semibold', m.quantity_delta > 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                  </span>
                  {m.reason && <span className="text-sm text-[hsl(var(--foreground))]">{m.reason}</span>}
                </div>
                {m.note && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{m.note}</p>}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{fmtDate(m.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SeoTab({ product, onSave, saving }) {
  const [form, setForm] = useState({
    meta_title:       product.meta_title       ?? '',
    meta_description: product.meta_description ?? '',
  })

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ meta_title: form.meta_title || null, meta_description: form.meta_description || null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <SectionCard title="Metadatos SEO">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="seo-title">Titulo SEO</Label>
            <Input id="seo-title" value={form.meta_title} onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))} placeholder={product.name} maxLength={160} />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{form.meta_title.length}/160</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seo-desc">Descripcion SEO</Label>
            <textarea
              id="seo-desc"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] resize-none"
              rows={3}
              value={form.meta_description}
              onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
              placeholder="Descripcion para motores de busqueda..."
              maxLength={320}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{form.meta_description.length}/320</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Vista previa en Google">
        <div className="max-w-md space-y-0.5 p-3 rounded-xl bg-[hsl(var(--muted))]/30">
          <p className="text-sm text-blue-600 truncate">{form.meta_title || product.name}</p>
          <p className="text-xs text-green-700">/{product.slug}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
            {form.meta_description || product.description || 'Sin descripcion'}
          </p>
        </div>
      </SectionCard>

      <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar SEO'}</Button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/screens/CatalogProductDetailScreen.jsx
git commit -m "feat(catalog): add product detail screen — pill tabs + AnimatePresence + SectionCard"
```

---

## Task 7: Rewrite CatalogCategoriesScreen

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx`

Pattern: `PageHeader` + hierarchical list (like `HrCatalogsScreen` — custom list since tree structure can't use `AtlasTable`) + `AnimatePresence` + `Sheet` for create/edit.

- [ ] **Step 1: Rewrite CatalogCategoriesScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Button, ConfirmDialog, Input, Label, PageHeader, Sheet, SheetContent, SheetHeader, SheetTitle, Skeleton, cn } from '@atlas/ui'
import { ChevronRight, Plus, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { atlas } from '../../../lib/atlas.js'

export default function CatalogCategoriesScreen() {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()
  const permissions = userProfile?.permissions ?? []
  const hasPermission = key => Boolean(userProfile?.isAdmin || permissions.includes(key))
  const canCreate = hasPermission('catalog.categories.create')
  const canUpdate = hasPermission('catalog.categories.update')
  const canDelete = hasPermission('catalog.categories.delete')

  const [sheetOpen, setSheetOpen]     = useState(false)
  const [editing, setEditing]         = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ name: '', slug: '', description: '', parent_id: '', position: '0' })

  const treeQuery = useQuery({
    queryKey: ['catalog-categories-tree', token],
    queryFn: () => atlas.catalog.listCategories(token),
    enabled: Boolean(token),
    staleTime: 30_000,
  })

  const flatQuery = useQuery({
    queryKey: ['catalog-categories-flat', token],
    queryFn: () => atlas.catalog.listCategories(token, { flat: true }),
    enabled: Boolean(token),
    staleTime: 30_000,
  })

  const saveMutation = useMutation({
    mutationFn: data => editing
      ? atlas.catalog.updateCategory(editing.id, data, token)
      : atlas.catalog.createCategory(data, token),
    onSuccess: () => {
      toast.success(editing ? 'Categoria actualizada' : 'Categoria creada')
      queryClient.invalidateQueries({ queryKey: ['catalog-categories'] })
      setSheetOpen(false)
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: id => atlas.catalog.deleteCategory(id, token),
    onSuccess: () => {
      toast.success('Categoria eliminada')
      setConfirmDelete(null)
      queryClient.invalidateQueries({ queryKey: ['catalog-categories'] })
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', slug: '', description: '', parent_id: '', position: '0' })
    setSheetOpen(true)
  }

  function openEdit(cat) {
    setEditing(cat)
    setForm({ name: cat.name, slug: cat.slug, description: cat.description ?? '', parent_id: cat.parent_id ?? '', position: String(cat.position ?? 0) })
    setSheetOpen(true)
  }

  function handleNameChange(name) {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    setForm(f => ({ ...f, name, slug: !editing ? slug : f.slug }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    saveMutation.mutate({
      name:        form.name,
      slug:        form.slug,
      description: form.description || undefined,
      parent_id:   form.parent_id   || null,
      position:    Number(form.position ?? 0),
    })
  }

  const tree     = treeQuery.data?.data ?? []
  const flatCats = flatQuery.data?.data ?? []
  const rootCats = flatCats.filter(c => c.parent_id === null)

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Catalog"
        title="Categorias"
        description="Organiza tus productos en categorias y subcategorias."
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nueva categoria
            </Button>
          )
        }
      />

      {treeQuery.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-2xl" />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Tag className="h-10 w-10 text-[hsl(var(--muted-foreground))]/40" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay categorias. Crea la primera.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
          <AnimatePresence initial={false}>
            {tree.map(cat => (
              <div key={cat.id}>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <CategoryRow
                    cat={cat}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    onEdit={openEdit}
                    onDelete={() => setConfirmDelete(cat)}
                  />
                  {(cat.children ?? []).map(child => (
                    <CategoryRow
                      key={child.id}
                      cat={child}
                      indent
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      onEdit={openEdit}
                      onDelete={() => setConfirmDelete(child)}
                    />
                  ))}
                </motion.div>
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar categoria' : 'Nueva categoria'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={e => handleNameChange(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Descripcion (opcional)</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria padre</Label>
              <select
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                value={form.parent_id}
                onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
              >
                <option value="">Sin padre (categoria raiz)</option>
                {rootCats.filter(c => c.id !== editing?.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Posicion de orden</Label>
              <Input type="number" min="0" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Guardando...' : (editing ? 'Guardar' : 'Crear')}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={v => !v && setConfirmDelete(null)}
        title="Eliminar categoria"
        description="La categoria sera desactivada. Los productos que la tengan asignada no se veran afectados."
        detail={confirmDelete?.name}
        confirmLabel="Eliminar"
        onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

function CategoryRow({ cat, indent = false, canUpdate, canDelete, onEdit, onDelete }) {
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] last:border-0 transition-colors hover:bg-[hsl(var(--muted))]/30',
      indent && 'pl-10 bg-[hsl(var(--muted))]/20',
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {indent && <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{cat.name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">/{cat.slug}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {canUpdate && (
          <button
            type="button"
            onClick={() => onEdit(cat)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            Editar
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(cat)}
            className="flex h-7 items-center justify-center rounded-lg px-2 text-xs text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 transition-colors"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx
git commit -m "feat(catalog): rewrite categories screen — PageHeader + tree list + Sheet"
```

---

## Task 8: Create CatalogInventoryScreen

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/screens/CatalogInventoryScreen.jsx`

Pattern: `PageHeader` + `AtlasTable` blueprint.

- [ ] **Step 1: Create CatalogInventoryScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/screens/CatalogInventoryScreen.jsx
import { useNavigate } from 'react-router-dom'
import { PageHeader, AtlasTable } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider.jsx'

const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const INVENTORY_BLUEPRINT = {
  key: 'catalog.inventory.table',
  schema: {
    apiPath: '/catalog/products',
    primaryField: 'name',
    searchable: true,
    searchPlaceholder: 'Buscar producto...',
    columns: [
      { field: 'name',          label: 'Producto',   sortable: true, link: true },
      { field: 'category_name', label: 'Categoria',  sortable: false },
      {
        field: 'product_type',
        label: 'Tipo',
        sortable: false,
        type: 'select',
        options: [
          { value: 'SIMPLE',   label: 'Simple' },
          { value: 'VARIABLE', label: 'Variable' },
        ],
      },
      { field: 'stock', label: 'Stock actual', sortable: true },
      {
        field: 'track_stock',
        label: 'Control stock',
        sortable: false,
        type: 'select',
        options: [
          { value: true,  label: 'Si' },
          { value: false, label: 'No' },
        ],
      },
    ],
    filters: [
      {
        key: 'type',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'SIMPLE',   label: 'Simple' },
          { value: 'VARIABLE', label: 'Variable' },
        ],
      },
    ],
    emptyState: { message: 'No hay productos en el inventario.' },
  },
}

export default function CatalogInventoryScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Catalog"
        title="Inventario"
        description="Vision general del stock de todos los productos."
      />

      <AtlasTable
        blueprint={INVENTORY_BLUEPRINT}
        token={token}
        apiBaseUrl={API_BASE_URL}
        onView={row => navigate(`/app/m/atlas.catalog/${row.id}`)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/screens/CatalogInventoryScreen.jsx
git commit -m "feat(catalog): add inventory screen — PageHeader + AtlasTable"
```

---

## Task 9: Wire routes + verify UI + final checks

**Files:**
- Modify: wherever catalog routes are registered (check `apps/desktop/src/App.jsx` or router file)

- [ ] **Step 1: Find route registration**

Search in `apps/desktop/src/` for where `CatalogProductsScreen` and `CatalogCategoriesScreen` are imported and registered as routes. Look for files that import from `atlas.catalog`.

```bash
grep -r "atlas.catalog\|CatalogProducts\|CatalogCategories" apps/desktop/src/ --include="*.jsx" --include="*.js" -l
```

Read those files, then add routes for `CatalogProductDetailScreen` and `CatalogInventoryScreen` following the exact same pattern used for the existing catalog screens.

- [ ] **Step 2: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 3: Smoke test products list**

Navigate to `http://localhost:5173` → log in → open Catalogo → Productos.

- [ ] Products list loads with `PageHeader` (eyebrow "Atlas Catalog"), `AtlasTable` with columns: Nombre, Tipo, Categoria, Precio, Stock, Estado.
- [ ] Filters for Tipo and Estado work.
- [ ] Clicking "Ver" or row navigates to `/app/m/atlas.catalog/:id`.

- [ ] **Step 4: Smoke test product detail**

- [ ] All tabs visible: General, Imagenes, Precios, Inventario, SEO (+ Variantes for VARIABLE products).
- [ ] Pill tab switcher renders; clicking tabs transitions with animation.
- [ ] General tab: name, slug, markdown description editor, category dropdown, attributes table.
- [ ] Imagenes tab: can select and upload cover image (upload goes to atlas.files).
- [ ] Precios tab: for SIMPLE product shows SKU, barcode, weight, stock section with "Registrar ajuste" button.
- [ ] Inventario tab: "Registrar ajuste" opens StockMovementModal; after save, movement appears.
- [ ] SEO tab: meta fields + Google snippet preview updates live.
- [ ] Publish button in top bar toggles badge and published state.

- [ ] **Step 5: Smoke test categories**

- [ ] Categories screen shows `PageHeader` + hierarchical tree.
- [ ] Create a new category → appears in list.
- [ ] Create a subcategory (with parent) → appears indented below parent.
- [ ] Edit and delete work with `ConfirmDialog`.

- [ ] **Step 6: Smoke test inventory screen**

- [ ] Inventario nav item navigates to the screen.
- [ ] `AtlasTable` loads all products with stock column.
- [ ] Clicking a row navigates to the product detail.

- [ ] **Step 7: Build check**

```bash
pnpm build
```

Expected: no errors. If there are errors, fix them before the final commit.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(catalog): complete v2 UI — PageHeader + AtlasTable + pill tabs + motion/react"
```

---

## Verification checklist

- [ ] `PageHeader` with `eyebrow="Atlas Catalog"` in all 3 list/overview screens
- [ ] `AtlasTable` with blueprint used for Products and Inventory screens (not hand-coded tables)
- [ ] Pill-style tabs (rounded-xl container) with `AnimatePresence` transitions in detail screen
- [ ] `SectionCard` grouping used for content within each tab
- [ ] `ConfirmDialog` used for all delete confirmations
- [ ] `atlas.catalog.*` SDK methods used for all catalog API calls
- [ ] `atlas.files.upload()` and `atlas.files.batchSignedUrls()` used in ProductImageManager
- [ ] `motion/react` `AnimatePresence` used in categories list and detail tabs
- [ ] `import.meta.env.VITE_ATLAS_API_URL` used (not `getApiUrl()`)
- [ ] `useAuth()` with `hasPermission()` guard pattern used in all screens
- [ ] `pnpm build` passes with no errors

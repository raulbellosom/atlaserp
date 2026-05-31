# atlas.catalog v2 — Plan B: Frontend (UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two minimal catalog list screens with a complete catalog management UI: redesigned product list, full product detail with 6 tabs, redesigned category manager with hierarchy, inventory overview screen, and all supporting components.

**Architecture:** Four screens under `apps/desktop/src/modules/atlas.catalog/screens/`, four supporting components under `components/`, and updated route registration in `index.js`. All data fetching uses TanStack Query. `MarkdownField` and `MarkdownViewer` are imported from `@atlas/ui` (already exist in packages/ui). File uploads go directly to atlas.files via the existing files API — the `ProductImageUploader` component handles this inline.

**Tech Stack:** React, TanStack Query (`useQuery`/`useMutation`), `@atlas/ui` components, Tailwind CSS, Lucide icons, `sonner` toasts.

**Prerequisite:** Plan A (backend) must be fully deployed and verified before starting Plan B.

---

## File map

```
apps/desktop/src/modules/atlas.catalog/
  index.js                                      MODIFY  (add new routes)
  screens/
    CatalogProductsScreen.jsx                   REWRITE (redesign)
    CatalogProductDetailScreen.jsx              CREATE  (new - 6 tabs)
    CatalogCategoriesScreen.jsx                 REWRITE (redesign)
    CatalogInventoryScreen.jsx                  CREATE  (new)
  components/
    ProductImageUploader.jsx                    CREATE
    StockMovementModal.jsx                      CREATE
    VariantOptionsEditor.jsx                    CREATE
    VariantMatrix.jsx                           CREATE
```

---

## Task 1: Update module routes + rewrite CatalogProductsScreen

**Files:**
- Modify: `apps/desktop/src/modules/atlas.catalog/index.js`
- Rewrite: `apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx`

- [ ] **Step 1: Read the current index.js to understand the route registration pattern**

Read: `apps/desktop/src/modules/atlas.catalog/index.js`

Then replace with:

```jsx
// apps/desktop/src/modules/atlas.catalog/index.js
import CatalogProductsScreen    from './screens/CatalogProductsScreen.jsx'
import CatalogProductDetailScreen from './screens/CatalogProductDetailScreen.jsx'
import CatalogCategoriesScreen  from './screens/CatalogCategoriesScreen.jsx'
import CatalogInventoryScreen   from './screens/CatalogInventoryScreen.jsx'

export const routes = [
  { path: '/app/m/atlas.catalog',              element: <CatalogProductsScreen /> },
  { path: '/app/m/atlas.catalog/:id',          element: <CatalogProductDetailScreen /> },
  { path: '/app/m/atlas.catalog/categories',   element: <CatalogCategoriesScreen /> },
  { path: '/app/m/atlas.catalog/inventory',    element: <CatalogInventoryScreen /> },
]
```

> Note: Check whether the existing index.js uses a different export shape (e.g. a default export function or a named `routes` array). Match the pattern used by other modules in the project (e.g. check `apps/desktop/src/modules/atlas.hr/index.js` for reference). The route paths above must match exactly.

- [ ] **Step 2: Rewrite CatalogProductsScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Button, Input, Badge } from '@atlas/ui'
import { Package, Plus } from 'lucide-react'
import { toast } from 'sonner'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function CatalogProductsScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [publishedFilter, setPublishedFilter] = useState('')

  const { data, isPending } = useQuery({
    queryKey: ['catalog-products', token, search, typeFilter, publishedFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' })
      if (search)          params.set('search', search)
      if (typeFilter)      params.set('type', typeFilter)
      if (publishedFilter) params.set('published', publishedFilter)
      return apiFetch(`/catalog/products?${params}`, token)
    },
    enabled: Boolean(token),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (body) => apiFetch('/catalog/products', token, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (res) => {
      toast.success('Producto creado')
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] })
      navigate(`/app/m/atlas.catalog/${res.data.id}`)
    },
    onError: (err) => toast.error(err.message),
  })

  function handleCreate() {
    const name = prompt('Nombre del producto:')
    if (!name?.trim()) return
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    createMutation.mutate({ name: name.trim(), slug, price: 0 })
  }

  const products = data?.data ?? []
  const total    = data?.total ?? 0

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Productos</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{total} productos</p>
        </div>
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo producto
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="SIMPLE">Simple</option>
          <option value="VARIABLE">Variable</option>
        </select>
        <select
          className="border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
          value={publishedFilter}
          onChange={(e) => setPublishedFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="true">Publicado</option>
          <option value="false">Borrador</option>
        </select>
      </div>

      {isPending ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Sin resultados.' : 'No hay productos. Crea el primero.'}</p>
        </div>
      ) : (
        <div className="border border-[hsl(var(--border))] rounded-lg divide-y divide-[hsl(var(--border))]">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-[hsl(var(--muted))/30] cursor-pointer"
              onClick={() => navigate(`/app/m/atlas.catalog/${p.id}`)}
            >
              <div className="h-10 w-10 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 overflow-hidden">
                {p.cover_asset_id ? (
                  <img src={`${getApiUrl()}/files/${p.cover_asset_id}/thumb`} alt="" className="h-full w-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                ) : (
                  <Package className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{p.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${
                    p.product_type === 'VARIABLE'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]'
                  }`}>
                    {p.product_type === 'VARIABLE' ? 'Variable' : 'Simple'}
                  </span>
                  {p.published ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Publicado</span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">Borrador</span>
                  )}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {p.category_name ?? 'Sin categoria'} · {p.currency} {Number(p.price).toFixed(2)}
                  {p.track_stock && ` · Stock: ${p.stock}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/index.js \
        apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx
git commit -m "feat(catalog): redesign product list screen with filters and thumbnail"
```

---

## Task 2: Create ProductImageUploader component

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/components/ProductImageUploader.jsx`

This component handles cover image + gallery, with inline upload to atlas.files. It calls `POST /files/upload` using multipart form data, then returns the FileAsset UUID.

- [ ] **Step 1: Create ProductImageUploader.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/components/ProductImageUploader.jsx
import { useRef } from 'react'
import { getApiUrl } from '../../../../lib/runtimeConfig.js'
import { Button } from '@atlas/ui'
import { ImagePlus, X, Star } from 'lucide-react'
import { toast } from 'sonner'

async function uploadFile(file, token) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${getApiUrl()}/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al subir archivo')
  }
  const { data } = await res.json()
  return data // FileAsset object with .id
}

function buildPreviewUrl(assetId) {
  return `${getApiUrl()}/files/${assetId}/signed-url`
}

/**
 * Props:
 *   token        string   — auth bearer token
 *   coverId      string|null  — current cover_asset_id
 *   imageIds     string[]     — current images array of UUIDs
 *   onChange     fn({ coverId, imageIds }) — called on any change
 */
export default function ProductImageUploader({ token, coverId, imageIds = [], onChange }) {
  const coverInputRef  = useRef(null)
  const galleryInputRef = useRef(null)

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const asset = await uploadFile(file, token)
      onChange({ coverId: asset.id, imageIds })
      toast.success('Imagen de portada actualizada')
    } catch (err) {
      toast.error(err.message)
    } finally {
      e.target.value = ''
    }
  }

  async function handleGalleryUpload(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const uploaded = []
    for (const file of files) {
      try {
        const asset = await uploadFile(file, token)
        uploaded.push(asset.id)
      } catch (err) {
        toast.error(`Error subiendo ${file.name}: ${err.message}`)
      }
    }
    if (uploaded.length) {
      onChange({ coverId, imageIds: [...imageIds, ...uploaded] })
      toast.success(`${uploaded.length} imagen(es) agregada(s)`)
    }
    e.target.value = ''
  }

  function removeCover() {
    onChange({ coverId: null, imageIds })
  }

  function removeFromGallery(id) {
    onChange({ coverId, imageIds: imageIds.filter(i => i !== id) })
  }

  function promoteTocover(id) {
    onChange({ coverId: id, imageIds: imageIds.filter(i => i !== id) })
  }

  return (
    <div className="space-y-6">
      {/* Cover image */}
      <div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-2">Imagen de portada</p>
        <div className="flex items-start gap-4">
          <div
            className="h-32 w-32 rounded-lg border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center bg-[hsl(var(--muted))] overflow-hidden cursor-pointer relative group"
            onClick={() => coverInputRef.current?.click()}
          >
            {coverId ? (
              <>
                <ImageAsset assetId={coverId} token={token} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-xs">Cambiar</p>
                </div>
              </>
            ) : (
              <div className="text-center text-[hsl(var(--muted-foreground))]">
                <ImagePlus className="h-6 w-6 mx-auto mb-1" />
                <p className="text-xs">Subir portada</p>
              </div>
            )}
          </div>
          {coverId && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 mt-1" onClick={removeCover}>
              <X className="h-4 w-4 mr-1" /> Quitar
            </Button>
          )}
        </div>
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
      </div>

      {/* Gallery */}
      <div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-2">Galeria adicional</p>
        <div className="flex flex-wrap gap-3">
          {imageIds.map((id) => (
            <div key={id} className="relative h-24 w-24 rounded-lg border border-[hsl(var(--border))] overflow-hidden group">
              <ImageAsset assetId={id} token={token} />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                <button
                  className="text-white text-xs flex items-center gap-1 hover:text-yellow-300"
                  onClick={() => promoteTocover(id)}
                  title="Usar como portada"
                >
                  <Star className="h-3 w-3" /> Portada
                </button>
                <button
                  className="text-white text-xs flex items-center gap-1 hover:text-red-300"
                  onClick={() => removeFromGallery(id)}
                >
                  <X className="h-3 w-3" /> Quitar
                </button>
              </div>
            </div>
          ))}
          <button
            className="h-24 w-24 rounded-lg border-2 border-dashed border-[hsl(var(--border))] flex flex-col items-center justify-center text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground)/50)] transition-colors"
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus className="h-5 w-5 mb-1" />
            <span className="text-xs">Agregar</span>
          </button>
        </div>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
      </div>
    </div>
  )
}

function ImageAsset({ assetId, token }) {
  const [src, setSrc] = useSignedUrl(assetId, token)
  return src
    ? <img src={src} alt="" className="h-full w-full object-cover" />
    : <div className="h-full w-full bg-[hsl(var(--muted))]" />
}

function useSignedUrl(assetId, token) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!assetId || !token) return
    fetch(`${getApiUrl()}/files/${assetId}/signed-url`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setUrl(data?.data?.url ?? data?.url ?? null))
      .catch(() => null)
  }, [assetId, token])
  return [url, setUrl]
}
```

Add the missing React imports at the top:

```jsx
import { useRef, useState, useEffect } from 'react'
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/components/ProductImageUploader.jsx
git commit -m "feat(catalog): add ProductImageUploader component with inline upload"
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
import { getApiUrl } from '../../../../lib/runtimeConfig.js'
import { Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@atlas/ui'
import { toast } from 'sonner'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Props:
 *   open       boolean
 *   onClose    fn()
 *   token      string
 *   productId  string
 *   variantId  string|null  — null for SIMPLE products
 *   variantLabel string|null — display label for the variant
 */
export default function StockMovementModal({ open, onClose, token, productId, variantId = null, variantLabel = null }) {
  const queryClient = useQueryClient()
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: () => apiFetch(`/catalog/products/${productId}/stock-movements`, token, {
      method: 'POST',
      body: JSON.stringify({
        variant_id:     variantId ?? undefined,
        quantity_delta: Number(delta),
        reason:         reason || undefined,
        note:           note   || undefined,
      }),
    }),
    onSuccess: () => {
      toast.success('Ajuste registrado')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
      queryClient.invalidateQueries({ queryKey: ['catalog-stock-movements', productId] })
      setDelta(''); setReason(''); setNote('')
      onClose()
    },
    onError: (err) => toast.error(err.message),
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
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Variante: <strong>{variantLabel}</strong></p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="sm-delta">Cantidad (positivo = entrada, negativo = salida)</Label>
            <Input
              id="sm-delta"
              type="number"
              placeholder="ej. 10 o -3"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sm-reason">Razon</Label>
            <select
              id="sm-reason"
              className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Seleccionar razon...</option>
              <option value="Ajuste manual">Ajuste manual</option>
              <option value="Compra">Compra</option>
              <option value="Venta">Venta</option>
              <option value="Devolucion">Devolucion</option>
              <option value="Merma">Merma</option>
              <option value="Inventario fisico">Inventario fisico</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sm-note">Nota (opcional)</Label>
            <Input
              id="sm-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detalle adicional..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando...' : 'Registrar'}
            </Button>
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
import { getApiUrl } from '../../../../lib/runtimeConfig.js'
import { Button, Input, Label } from '@atlas/ui'
import { Plus, X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Props:
 *   token      string
 *   productId  string
 *   options    Array<{ id, name, position, values: [{id, value, position}] }>
 */
export default function VariantOptionsEditor({ token, productId, options = [] }) {
  const queryClient = useQueryClient()
  const [newOptionName, setNewOptionName] = useState('')

  const addOptionMutation = useMutation({
    mutationFn: (data) => apiFetch(`/catalog/products/${productId}/options`, token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast.success('Opcion creada')
      setNewOptionName('')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteOptionMutation = useMutation({
    mutationFn: (optionId) => apiFetch(`/catalog/products/${productId}/options/${optionId}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Opcion eliminada')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: (err) => toast.error(err.message),
  })

  const updateOptionMutation = useMutation({
    mutationFn: ({ optionId, values }) => apiFetch(`/catalog/products/${productId}/options/${optionId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ values }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: (err) => toast.error(err.message),
  })

  function handleAddOption(e) {
    e.preventDefault()
    if (!newOptionName.trim()) return
    addOptionMutation.mutate({ name: newOptionName.trim(), values: [] })
  }

  function handleAddValue(option, newValue) {
    if (!newValue.trim()) return
    const currentValues = option.values.map(v => v.value)
    if (currentValues.includes(newValue.trim())) return
    updateOptionMutation.mutate({
      optionId: option.id,
      values:   [...currentValues, newValue.trim()],
    })
  }

  function handleRemoveValue(option, valueToRemove) {
    const remaining = option.values.map(v => v.value).filter(v => v !== valueToRemove)
    updateOptionMutation.mutate({ optionId: option.id, values: remaining })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-[hsl(var(--foreground))]">Opciones de variantes</p>

      {options.map((opt) => (
        <OptionRow
          key={opt.id}
          option={opt}
          onDelete={() => deleteOptionMutation.mutate(opt.id)}
          onAddValue={(val) => handleAddValue(opt, val)}
          onRemoveValue={(val) => handleRemoveValue(opt, val)}
        />
      ))}

      <form onSubmit={handleAddOption} className="flex gap-2">
        <Input
          placeholder="Nueva opcion (ej. Talla, Color...)"
          value={newOptionName}
          onChange={(e) => setNewOptionName(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" size="sm" disabled={addOptionMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Agregar opcion
        </Button>
      </form>
    </div>
  )
}

function OptionRow({ option, onDelete, onAddValue, onRemoveValue }) {
  const [newVal, setNewVal] = useState('')

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onAddValue(newVal)
      setNewVal('')
    }
  }

  return (
    <div className="border border-[hsl(var(--border))] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{option.name}</p>
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {option.values.map((v) => (
          <span key={v.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]">
            {v.value}
            <button className="hover:text-red-500" onClick={() => onRemoveValue(v.value)}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          placeholder="Nuevo valor + Enter"
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-xs w-36"
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
import { getApiUrl } from '../../../../lib/runtimeConfig.js'
import { Button, Input } from '@atlas/ui'
import { Plus, Save } from 'lucide-react'
import { toast } from 'sonner'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Props:
 *   token      string
 *   productId  string
 *   variants   Array<{ id, option_values, sku, barcode, price, stock }>
 *   options    Array<{ id, name, values }>
 */
export default function VariantMatrix({ token, productId, variants = [], options = [] }) {
  const queryClient = useQueryClient()
  const [edits, setEdits] = useState({})

  const updateMutation = useMutation({
    mutationFn: ({ variantId, data }) => apiFetch(`/catalog/products/${productId}/variants/${variantId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: (_, { variantId }) => {
      setEdits(prev => { const n = { ...prev }; delete n[variantId]; return n })
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: (err) => toast.error(err.message),
  })

  const createMutation = useMutation({
    mutationFn: (data) => apiFetch(`/catalog/products/${productId}/variants`, token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast.success('Variante creada')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (variantId) => apiFetch(`/catalog/products/${productId}/variants/${variantId}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Variante eliminada')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: (err) => toast.error(err.message),
  })

  function edit(variantId, field, value) {
    setEdits(prev => ({ ...prev, [variantId]: { ...(prev[variantId] ?? {}), [field]: value } }))
  }

  function saveVariant(variant) {
    const changes = edits[variant.id]
    if (!changes) return
    updateMutation.mutate({ variantId: variant.id, data: changes })
  }

  function getLabel(optionValues) {
    if (!optionValues || typeof optionValues !== 'object') return 'Default'
    return Object.values(optionValues).join(' / ') || 'Default'
  }

  function handleAddVariant() {
    createMutation.mutate({ option_values: {}, price: 0, stock: 0 })
  }

  const optionNames = options.map(o => o.name)

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[hsl(var(--foreground))]">Variantes ({variants.length})</p>

      {variants.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Define las opciones arriba y luego agrega variantes aqui.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-[hsl(var(--border))] rounded-lg overflow-hidden">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">Variante</th>
                <th className="text-left px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">SKU</th>
                <th className="text-left px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">Codigo de barras</th>
                <th className="text-left px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">Precio</th>
                <th className="text-left px-3 py-2 font-medium text-[hsl(var(--muted-foreground))]">Stock</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {variants.map((v) => {
                const e = edits[v.id] ?? {}
                const isDirty = Boolean(edits[v.id])
                return (
                  <tr key={v.id} className={isDirty ? 'bg-blue-50/30' : ''}>
                    <td className="px-3 py-2 font-medium">{getLabel(v.option_values)}</td>
                    <td className="px-3 py-2">
                      <Input
                        value={e.sku ?? v.sku ?? ''}
                        onChange={(ev) => edit(v.id, 'sku', ev.target.value)}
                        className="h-7 text-xs w-28"
                        placeholder="SKU"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={e.barcode ?? v.barcode ?? ''}
                        onChange={(ev) => edit(v.id, 'barcode', ev.target.value)}
                        className="h-7 text-xs w-32"
                        placeholder="EAN/UPC"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={e.price ?? v.price ?? 0}
                        onChange={(ev) => edit(v.id, 'price', Number(ev.target.value))}
                        className="h-7 text-xs w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        value={e.stock ?? v.stock ?? 0}
                        onChange={(ev) => edit(v.id, 'stock', Number(ev.target.value))}
                        className="h-7 text-xs w-20"
                      />
                    </td>
                    <td className="px-3 py-2 flex gap-1">
                      {isDirty && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveVariant(v)} disabled={updateMutation.isPending}>
                          <Save className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500 hover:text-red-600"
                        onClick={() => { if (window.confirm('Eliminar esta variante?')) deleteMutation.mutate(v.id) }}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={handleAddVariant} disabled={createMutation.isPending}>
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

## Task 5: Create CatalogProductDetailScreen (tabs: General, Imagenes, Precios)

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/screens/CatalogProductDetailScreen.jsx`

This is the main detail screen. It loads product data and renders 6 tabs. This task implements the first 3 tabs (General, Imagenes, Precios). Tasks 6 adds the remaining 3 tabs inline.

- [ ] **Step 1: Create CatalogProductDetailScreen.jsx with first 3 tabs**

```jsx
// apps/desktop/src/modules/atlas.catalog/screens/CatalogProductDetailScreen.jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Button, Input, Label, Switch } from '@atlas/ui'
import { MarkdownField } from '@atlas/ui'
import { ArrowLeft, Globe, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import ProductImageUploader from '../components/ProductImageUploader.jsx'
import StockMovementModal   from '../components/StockMovementModal.jsx'
import VariantOptionsEditor from '../components/VariantOptionsEditor.jsx'
import VariantMatrix        from '../components/VariantMatrix.jsx'

const TABS = ['General', 'Imagenes', 'Precios', 'Variantes', 'Inventario', 'SEO']

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function CatalogProductDetailScreen() {
  const { id } = useParams()
  const { session } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('General')
  const [stockModalOpen, setStockModalOpen] = useState(false)

  const { data: productData, isPending } = useQuery({
    queryKey: ['catalog-product', id, token],
    queryFn: () => apiFetch(`/catalog/products/${id}`, token),
    enabled: Boolean(token && id),
    staleTime: 30_000,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['catalog-categories-flat', token],
    queryFn: () => apiFetch('/catalog/categories?flat=true', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  const { data: movementsData } = useQuery({
    queryKey: ['catalog-stock-movements', id, token],
    queryFn: () => apiFetch(`/catalog/products/${id}/stock-movements?limit=50`, token),
    enabled: Boolean(token && id && tab === 'Inventario'),
    staleTime: 30_000,
  })

  const updateMutation = useMutation({
    mutationFn: (data) => apiFetch(`/catalog/products/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Producto guardado')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', id] })
    },
    onError: (err) => toast.error(err.message),
  })

  const publishMutation = useMutation({
    mutationFn: (pub) => apiFetch(`/catalog/products/${id}/${pub ? 'publish' : 'unpublish'}`, token, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-product', id] })
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] })
    },
    onError: (err) => toast.error(err.message),
  })

  if (isPending) return <div className="p-8 text-sm text-[hsl(var(--muted-foreground))]">Cargando...</div>

  const product    = productData?.data
  if (!product) return <div className="p-8 text-sm text-red-500">Producto no encontrado</div>

  const categories = categoriesData?.data ?? []
  const movements  = movementsData?.data  ?? []
  const movTotal   = movementsData?.total ?? 0
  const isVariable = product.product_type === 'VARIABLE'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app/m/atlas.catalog')} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">{product.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${
            isVariable ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]'
          }`}>
            {isVariable ? 'Variable' : 'Simple'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {product.published ? (
            <Button variant="outline" size="sm" onClick={() => publishMutation.mutate(false)} disabled={publishMutation.isPending}>
              <EyeOff className="h-4 w-4 mr-1" /> Despublicar
            </Button>
          ) : (
            <Button size="sm" onClick={() => publishMutation.mutate(true)} disabled={publishMutation.isPending}>
              <Globe className="h-4 w-4 mr-1" /> Publicar
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[hsl(var(--border))] px-6 bg-[hsl(var(--background))]">
        {TABS.filter(t => t !== 'Variantes' || isVariable).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* GENERAL */}
        {tab === 'General' && (
          <GeneralTab
            product={product}
            categories={categories}
            onSave={(data) => updateMutation.mutate(data)}
            saving={updateMutation.isPending}
          />
        )}

        {/* IMAGENES */}
        {tab === 'Imagenes' && (
          <ProductImageUploader
            token={token}
            coverId={product.cover_asset_id}
            imageIds={product.images ?? []}
            onChange={({ coverId, imageIds }) => updateMutation.mutate({ cover_asset_id: coverId, images: imageIds })}
          />
        )}

        {/* PRECIOS */}
        {tab === 'Precios' && (
          <PreciosTab
            product={product}
            onSave={(data) => updateMutation.mutate(data)}
            saving={updateMutation.isPending}
            onStockAdjust={() => setStockModalOpen(true)}
          />
        )}

        {/* VARIANTES */}
        {tab === 'Variantes' && isVariable && (
          <div className="space-y-8">
            <VariantOptionsEditor
              token={token}
              productId={id}
              options={product.options ?? []}
            />
            <VariantMatrix
              token={token}
              productId={id}
              variants={product.variants ?? []}
              options={product.options ?? []}
            />
          </div>
        )}

        {/* INVENTARIO */}
        {tab === 'Inventario' && (
          <InventarioTab
            product={product}
            movements={movements}
            total={movTotal}
            onAdjust={() => setStockModalOpen(true)}
          />
        )}

        {/* SEO */}
        {tab === 'SEO' && (
          <SeoTab
            product={product}
            onSave={(data) => updateMutation.mutate(data)}
            saving={updateMutation.isPending}
          />
        )}
      </div>

      <StockMovementModal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        token={token}
        productId={id}
        variantId={null}
      />
    </div>
  )
}

// ── Tab sub-components ────────────────────────────────────

function GeneralTab({ product, categories, onSave, saving }) {
  const [form, setForm] = useState({
    name:        product.name        ?? '',
    slug:        product.slug        ?? '',
    description: product.description ?? '',
    category_id: product.category_id ?? '',
    attributes:  product.attributes  ?? [],
  })

  function handleNameChange(name) {
    setForm(f => ({ ...f, name }))
  }

  function setAttr(i, key, value) {
    const next = form.attributes.map((a, idx) => idx === i ? { ...a, [key]: value } : a)
    setForm(f => ({ ...f, attributes: next }))
  }

  function addAttr() {
    setForm(f => ({ ...f, attributes: [...f.attributes, { key: '', value: '' }] }))
  }

  function removeAttr(i) {
    setForm(f => ({ ...f, attributes: f.attributes.filter((_, idx) => idx !== i) }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      name:        form.name,
      slug:        form.slug,
      description: form.description || undefined,
      category_id: form.category_id || null,
      attributes:  form.attributes.filter(a => a.key.trim()),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <Label htmlFor="g-name">Nombre</Label>
        <Input id="g-name" value={form.name} onChange={(e) => handleNameChange(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="g-slug">Slug</Label>
        <Input id="g-slug" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} required />
      </div>
      <div className="space-y-1">
        <Label>Descripcion</Label>
        <MarkdownField
          value={form.description}
          onChange={(v) => setForm(f => ({ ...f, description: v }))}
          placeholder="Describe el producto..."
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="g-cat">Categoria</Label>
        <select
          id="g-cat"
          className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
          value={form.category_id}
          onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
        >
          <option value="">Sin categoria</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Atributos</Label>
        {form.attributes.map((a, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input placeholder="Clave" value={a.key} onChange={(e) => setAttr(i, 'key', e.target.value)} className="w-36" />
            <Input placeholder="Valor" value={a.value} onChange={(e) => setAttr(i, 'value', e.target.value)} className="flex-1" />
            <button type="button" className="text-red-400 hover:text-red-600 px-1" onClick={() => removeAttr(i)}>✕</button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addAttr}>+ Agregar atributo</Button>
      </div>
      <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
    </form>
  )
}

function PreciosTab({ product, onSave, saving, onStockAdjust }) {
  const isVariable = product.product_type === 'VARIABLE'
  const [form, setForm] = useState({
    price:        String(product.price ?? 0),
    compare_price: product.compare_price != null ? String(product.compare_price) : '',
    currency:     product.currency ?? 'USD',
    sku:          product.sku      ?? '',
    barcode:      product.barcode  ?? '',
    weight:       product.weight   != null ? String(product.weight) : '',
    track_stock:  product.track_stock ?? false,
  })

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      price:         Number(form.price),
      compare_price: form.compare_price ? Number(form.compare_price) : null,
      currency:      form.currency,
      sku:           form.sku      || null,
      barcode:       form.barcode  || null,
      weight:        form.weight   ? Number(form.weight) : null,
      track_stock:   form.track_stock,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="p-price">Precio</Label>
          <Input id="p-price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-currency">Moneda</Label>
          <Input id="p-currency" value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={3} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="p-compare">Precio anterior (opcional)</Label>
        <Input id="p-compare" type="number" min="0" step="0.01" value={form.compare_price} onChange={(e) => setForm(f => ({ ...f, compare_price: e.target.value }))} />
      </div>
      {!isVariable && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" value={form.sku} onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Codigo interno" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-barcode">Codigo de barras (EAN/UPC)</Label>
              <Input id="p-barcode" value={form.barcode} onChange={(e) => setForm(f => ({ ...f, barcode: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-weight">Peso (kg)</Label>
            <Input id="p-weight" type="number" min="0" step="0.001" value={form.weight} onChange={(e) => setForm(f => ({ ...f, weight: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="p-track" checked={form.track_stock} onCheckedChange={(v) => setForm(f => ({ ...f, track_stock: v }))} />
            <Label htmlFor="p-track">Controlar stock</Label>
          </div>
          {form.track_stock && (
            <div className="flex items-center gap-4 p-3 bg-[hsl(var(--muted))] rounded-lg">
              <div>
                <p className="text-sm font-medium">Stock actual</p>
                <p className="text-2xl font-bold">{product.stock ?? 0}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onStockAdjust}>Registrar ajuste</Button>
            </div>
          )}
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

function InventarioTab({ product, movements, total, onAdjust }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Historial de movimientos ({total})</p>
        <Button size="sm" onClick={onAdjust}>Registrar ajuste</Button>
      </div>
      {movements.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin movimientos registrados.</p>
      ) : (
        <div className="border border-[hsl(var(--border))] rounded-lg divide-y divide-[hsl(var(--border))]">
          {movements.map((m) => (
            <div key={m.id} className="flex items-start justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${m.quantity_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                  </span>
                  {m.reason && <span className="text-sm text-[hsl(var(--foreground))]">{m.reason}</span>}
                </div>
                {m.note && <p className="text-xs text-[hsl(var(--muted-foreground))]">{m.note}</p>}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {new Date(m.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
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

  const previewTitle = form.meta_title || product.name
  const previewDesc  = form.meta_description || product.description || ''

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ meta_title: form.meta_title || null, meta_description: form.meta_description || null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <Label htmlFor="seo-title">Titulo SEO</Label>
        <Input
          id="seo-title"
          value={form.meta_title}
          onChange={(e) => setForm(f => ({ ...f, meta_title: e.target.value }))}
          placeholder={product.name}
          maxLength={160}
        />
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{form.meta_title.length}/160</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="seo-desc">Descripcion SEO</Label>
        <textarea
          id="seo-desc"
          className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))] resize-none"
          rows={3}
          value={form.meta_description}
          onChange={(e) => setForm(f => ({ ...f, meta_description: e.target.value }))}
          placeholder="Descripcion para motores de busqueda..."
          maxLength={320}
        />
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{form.meta_description.length}/320</p>
      </div>
      <div className="space-y-2">
        <Label>Vista previa en Google</Label>
        <div className="border border-[hsl(var(--border))] rounded-lg p-4 space-y-1 max-w-lg">
          <p className="text-sm text-blue-600 truncate">{previewTitle}</p>
          <p className="text-xs text-green-700">/{product.slug}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">{previewDesc || 'Sin descripcion'}</p>
        </div>
      </div>
      <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar SEO'}</Button>
    </form>
  )
}
```

> **Note:** `MarkdownField` is imported from `@atlas/ui`. Verify it is exported from `packages/ui/src/index.js`. If not, add the export. The component already exists at `packages/ui/src/components/MarkdownField.jsx` per git status.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/screens/CatalogProductDetailScreen.jsx
git commit -m "feat(catalog): add product detail screen with 6 tabs"
```

---

## Task 6: Rewrite CatalogCategoriesScreen

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx`

- [ ] **Step 1: Rewrite CatalogCategoriesScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Button, Input, Label,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@atlas/ui'
import { Tag, Plus, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

const EMPTY = { name: '', slug: '', description: '', parent_id: '', position: 0 }

export default function CatalogCategoriesScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const treeQuery = useQuery({
    queryKey: ['catalog-categories-tree', token],
    queryFn: () => apiFetch('/catalog/categories', token),
    enabled: Boolean(token),
    staleTime: 30_000,
  })

  const flatQuery = useQuery({
    queryKey: ['catalog-categories-flat', token],
    queryFn: () => apiFetch('/catalog/categories?flat=true', token),
    enabled: Boolean(token),
    staleTime: 30_000,
  })

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? apiFetch(`/catalog/categories/${editing.id}`, token, { method: 'PATCH', body: JSON.stringify(data) })
      : apiFetch('/catalog/categories', token, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success(editing ? 'Categoria actualizada' : 'Categoria creada')
      queryClient.invalidateQueries({ queryKey: ['catalog-categories'] })
      setSheetOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => apiFetch(`/catalog/categories/${id}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Categoria eliminada')
      queryClient.invalidateQueries({ queryKey: ['catalog-categories'] })
    },
    onError: (err) => toast.error(err.message),
  })

  function openCreate() {
    setEditing(null); setForm(EMPTY); setSheetOpen(true)
  }

  function openEdit(cat) {
    setEditing(cat)
    setForm({ name: cat.name, slug: cat.slug, description: cat.description ?? '', parent_id: cat.parent_id ?? '', position: cat.position ?? 0 })
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

  const tree       = treeQuery.data?.data ?? []
  const flatCats   = flatQuery.data?.data ?? []
  const rootCats   = flatCats.filter(c => c.parent_id === null)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Categorias</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{flatCats.length} categorias</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nueva categoria
        </Button>
      </div>

      {treeQuery.isPending ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
      ) : tree.length === 0 ? (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay categorias. Crea la primera.</p>
        </div>
      ) : (
        <div className="border border-[hsl(var(--border))] rounded-lg divide-y divide-[hsl(var(--border))]">
          {tree.map((cat) => (
            <div key={cat.id}>
              <CategoryRow cat={cat} onEdit={openEdit} onDelete={(id) => { if (window.confirm(`Eliminar "${cat.name}"?`)) deleteMutation.mutate(id) }} />
              {(cat.children ?? []).map((child) => (
                <CategoryRow
                  key={child.id}
                  cat={child}
                  indent
                  onEdit={openEdit}
                  onDelete={(id) => { if (window.confirm(`Eliminar "${child.name}"?`)) deleteMutation.mutate(id) }}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar categoria' : 'Nueva categoria'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Descripcion (opcional)</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Categoria padre (opcional)</Label>
              <select
                className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                value={form.parent_id}
                onChange={(e) => setForm(f => ({ ...f, parent_id: e.target.value }))}
              >
                <option value="">Sin padre (categoria raiz)</option>
                {rootCats.filter(c => c.id !== editing?.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Posicion</Label>
              <Input type="number" min="0" value={form.position} onChange={(e) => setForm(f => ({ ...f, position: e.target.value }))} />
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
    </div>
  )
}

function CategoryRow({ cat, indent = false, onEdit, onDelete }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${indent ? 'pl-10 bg-[hsl(var(--muted))/20]' : ''}`}>
      <div className="flex items-center gap-2">
        {indent && <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />}
        <div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">{cat.name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">/{cat.slug}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => onEdit(cat)}>Editar</Button>
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => onDelete(cat.id)}>Eliminar</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx
git commit -m "feat(catalog): redesign categories screen with hierarchy tree"
```

---

## Task 7: Create CatalogInventoryScreen

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/screens/CatalogInventoryScreen.jsx`

- [ ] **Step 1: Create CatalogInventoryScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.catalog/screens/CatalogInventoryScreen.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Input } from '@atlas/ui'
import { BarChart3, AlertTriangle, PackageX } from 'lucide-react'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function CatalogInventoryScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const [stockFilter, setStockFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data, isPending } = useQuery({
    queryKey: ['catalog-products-inventory', token],
    queryFn: () => apiFetch('/catalog/products?limit=200', token),
    enabled: Boolean(token),
    staleTime: 30_000,
  })

  const products = (data?.data ?? []).filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const stock = Number(p.stock ?? 0)
    const matchesFilter =
      !stockFilter ||
      (stockFilter === 'out'  && stock === 0) ||
      (stockFilter === 'low'  && stock > 0 && stock <= 5) ||
      (stockFilter === 'ok'   && stock > 5)
    return matchesSearch && matchesFilter
  })

  function stockBadge(stock) {
    const n = Number(stock ?? 0)
    if (n === 0) return { icon: <PackageX className="h-3 w-3" />, label: 'Sin stock', cls: 'text-red-600 bg-red-50 border-red-200' }
    if (n <= 5)  return { icon: <AlertTriangle className="h-3 w-3" />, label: 'Stock bajo', cls: 'text-yellow-600 bg-yellow-50 border-yellow-200' }
    return { icon: null, label: 'OK', cls: 'text-green-700 bg-green-50 border-green-200' }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Inventario</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Vision general del stock de todos los productos</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
        >
          <option value="">Todo el stock</option>
          <option value="out">Sin stock</option>
          <option value="low">Stock bajo (≤5)</option>
          <option value="ok">Stock normal (&gt;5)</option>
        </select>
      </div>

      {isPending ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin resultados.</p>
        </div>
      ) : (
        <div className="border border-[hsl(var(--border))] rounded-lg divide-y divide-[hsl(var(--border))]">
          {products.map((p) => {
            const badge = stockBadge(p.stock)
            return (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))/30] cursor-pointer"
                onClick={() => navigate(`/app/m/atlas.catalog/${p.id}`)}
              >
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">{p.name}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {p.category_name ?? 'Sin categoria'} · {p.product_type === 'VARIABLE' ? 'Variable' : 'Simple'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${badge.cls}`}>
                    {badge.icon} {badge.label}
                  </span>
                  <span className="text-lg font-bold text-[hsl(var(--foreground))] w-12 text-right">{p.stock ?? 0}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.catalog/screens/CatalogInventoryScreen.jsx
git commit -m "feat(catalog): add inventory overview screen with stock status filters"
```

---

## Task 8: Verify MarkdownField export + smoke test + final wiring

**Files:**
- Possibly modify: `packages/ui/src/index.js`

- [ ] **Step 1: Check MarkdownField is exported from @atlas/ui**

Read `packages/ui/src/index.js` and verify `MarkdownField` and `MarkdownViewer` are exported. If they are missing, add them:

```js
export { default as MarkdownField }  from './components/MarkdownField.jsx'
export { default as MarkdownViewer } from './components/MarkdownViewer.jsx'
```

- [ ] **Step 2: Start the dev server and open the catalog**

```bash
pnpm dev
```

Navigate to `http://localhost:5173`. Log in and go to Catalogo.

- [ ] **Step 3: Smoke test the product list**

- [ ] Products list loads with thumbnail column, type badge, and status badge
- [ ] Filters for type (SIMPLE/VARIABLE) and status (Publicado/Borrador) work
- [ ] Clicking a product row navigates to `/app/m/atlas.catalog/:id`

- [ ] **Step 4: Smoke test the product detail**

- [ ] All 6 tabs render without errors
- [ ] General tab: name, slug, markdown description, category, attributes all editable
- [ ] Imagenes tab: can upload a cover image (file is uploaded to atlas.files inline)
- [ ] Precios tab: for SIMPLE product shows SKU, barcode, weight, stock fields
- [ ] Inventario tab: "Registrar ajuste" opens StockMovementModal; after saving, movement appears in list
- [ ] SEO tab: meta title/description editable; Google snippet preview updates live
- [ ] Publicar/Despublicar button in top bar toggles published state

- [ ] **Step 5: Smoke test VARIABLE product**

- Create a product with `product_type: VARIABLE` (via API or by editing an existing product).
- Variantes tab appears; add an option "Talla" with values S, M, L.
- Add a variant via VariantMatrix; set price and SKU inline; save.

- [ ] **Step 6: Smoke test categories**

- [ ] Categories screen shows hierarchical tree (subcategories indented)
- [ ] Creating a subcategory with a parent_id works; it appears nested

- [ ] **Step 7: Smoke test inventory screen**

- [ ] Inventario nav item navigates to the new screen
- [ ] Stock filter (sin stock / bajo / ok) filters correctly
- [ ] Clicking a row navigates to the product detail

- [ ] **Step 8: Final commit**

```bash
git add packages/ui/src/index.js
git commit -m "feat(catalog): wire MarkdownField export, complete catalog v2 UI smoke-tested"
```

---

## Verification checklist

After all tasks complete:

- [ ] Three nav items appear in the sidebar for Catalogo: Productos, Categorias, Inventario
- [ ] Product list shows thumbnail, type badge, and status badge
- [ ] Product detail has 6 tabs; Variantes tab only visible for VARIABLE products
- [ ] Inline image upload works — no navigation to atlas.files required
- [ ] Markdown description editor renders in General tab
- [ ] Stock movement modal records adjustment and updates stock count immediately
- [ ] Variant options and matrix are editable from the Variantes tab
- [ ] Categories screen shows 2-level hierarchy
- [ ] Inventory screen shows all products with stock badges
- [ ] No TypeScript/build errors (`pnpm build` passes)

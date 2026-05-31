# atlas.catalog — Plan B: Admin Screens

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** Plan A (`2026-05-30-atlas-catalog-plan-A.md`) must be complete — `atlas.catalog` installed with DB tables and API working.

**Goal:** Build the admin screens for `atlas.catalog`: a products list with a create/edit drawer, and a categories list with inline CRUD.

**Architecture:** Screens live in `apps/desktop/src/modules/atlas.catalog/`. They are lazy-loaded by `ModuleOutlet` via the same pattern used by `atlas.website`, `atlas.hr`, etc. TanStack Query for server state, Tailwind + `@atlas/ui` components for UI.

**Tech Stack:** React 18, TanStack Query, Tailwind, `@atlas/ui`, React Router

---

## File Map

### Create
- `apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx` — products list + create/edit drawer
- `apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx` — categories list + inline CRUD
- `apps/desktop/src/modules/atlas.catalog/index.js` — screen exports

### Modify
- `apps/desktop/src/app/ModuleOutlet.jsx` — register catalog screen routes

---

## Task 1 — Categories screen

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx`

- [ ] **Step 1: Create the directory**

  ```bash
  mkdir -p apps/desktop/src/modules/atlas.catalog/screens
  ```

- [ ] **Step 2: Create CatalogCategoriesScreen.jsx**

  ```jsx
  // apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx
  import { useState } from 'react'
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
  import { useAuth } from '../../../auth/AuthProvider.jsx'
  import { getApiUrl } from '../../../lib/runtimeConfig.js'
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

  export default function CatalogCategoriesScreen() {
    const { session } = useAuth()
    const token = session?.access_token
    const queryClient = useQueryClient()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ name: '', slug: '', description: '' })

    const categoriesQuery = useQuery({
      queryKey: ['catalog-categories', token],
      queryFn: () => apiFetch('/catalog/categories', token),
      enabled: Boolean(token),
      staleTime: 30_000,
    })

    const saveMutation = useMutation({
      mutationFn: (data) =>
        editing
          ? apiFetch(`/catalog/categories/${editing.id}`, token, { method: 'PATCH', body: JSON.stringify(data) })
          : apiFetch('/catalog/categories', token, { method: 'POST', body: JSON.stringify(data) }),
      onSuccess: () => {
        toast.success(editing ? 'Categoria actualizada' : 'Categoria creada')
        queryClient.invalidateQueries({ queryKey: ['catalog-categories'] })
        setDialogOpen(false)
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
      setEditing(null)
      setForm({ name: '', slug: '', description: '' })
      setDialogOpen(true)
    }

    function openEdit(cat) {
      setEditing(cat)
      setForm({ name: cat.name, slug: cat.slug, description: cat.description ?? '' })
      setDialogOpen(true)
    }

    function handleSlugify(name) {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      setForm((f) => ({ ...f, name, slug: f.slug === '' || !editing ? slug : f.slug }))
    }

    function handleSubmit(e) {
      e.preventDefault()
      saveMutation.mutate({ name: form.name, slug: form.slug, description: form.description || undefined })
    }

    const categories = categoriesQuery.data?.data ?? []

    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Categorias</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Organiza tus productos por categoria</p>
          </div>
          <Button onClick={openCreate}>Nueva categoria</Button>
        </div>

        {categoriesQuery.isPending ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
        ) : categories.length === 0 ? (
          <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
            <p className="text-sm">No hay categorias. Crea la primera.</p>
          </div>
        ) : (
          <div className="border border-[hsl(var(--border))] rounded-lg divide-y divide-[hsl(var(--border))]">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">{cat.name}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">/{cat.slug}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>Editar</Button>
                  <Button
                    variant="ghost" size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => { if (window.confirm(`Eliminar "${cat.name}"?`)) deleteMutation.mutate(cat.id) }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar categoria' : 'Nueva categoria'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="cat-name">Nombre</Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => handleSlugify(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-slug">Slug</Label>
                <Input
                  id="cat-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-desc">Descripcion (opcional)</Label>
                <Input
                  id="cat-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Guardando...' : (editing ? 'Guardar' : 'Crear')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx
  ```

---

## Task 2 — Products screen

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx`

- [ ] **Step 1: Create CatalogProductsScreen.jsx**

  ```jsx
  // apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx
  import { useState } from 'react'
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
  import { useAuth } from '../../../auth/AuthProvider.jsx'
  import { getApiUrl } from '../../../lib/runtimeConfig.js'
  import {
    Button, Input, Label, Switch,
    Sheet, SheetContent, SheetHeader, SheetTitle,
  } from '@atlas/ui'
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

  const EMPTY_FORM = {
    name: '', slug: '', description: '', price: '', compare_price: '',
    currency: 'USD', stock: '0', track_stock: false,
    category_id: '', published: false,
  }

  export default function CatalogProductsScreen() {
    const { session } = useAuth()
    const token = session?.access_token
    const queryClient = useQueryClient()

    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [search, setSearch] = useState('')

    const productsQuery = useQuery({
      queryKey: ['catalog-products', token, search],
      queryFn: () => apiFetch(`/catalog/products?search=${encodeURIComponent(search)}`, token),
      enabled: Boolean(token),
      staleTime: 30_000,
    })

    const categoriesQuery = useQuery({
      queryKey: ['catalog-categories', token],
      queryFn: () => apiFetch('/catalog/categories', token),
      enabled: Boolean(token),
      staleTime: 60_000,
    })

    const saveMutation = useMutation({
      mutationFn: (data) =>
        editing
          ? apiFetch(`/catalog/products/${editing.id}`, token, { method: 'PATCH', body: JSON.stringify(data) })
          : apiFetch('/catalog/products', token, { method: 'POST', body: JSON.stringify(data) }),
      onSuccess: () => {
        toast.success(editing ? 'Producto actualizado' : 'Producto creado')
        queryClient.invalidateQueries({ queryKey: ['catalog-products'] })
        setDrawerOpen(false)
      },
      onError: (err) => toast.error(err.message),
    })

    const deleteMutation = useMutation({
      mutationFn: (id) => apiFetch(`/catalog/products/${id}`, token, { method: 'DELETE' }),
      onSuccess: () => {
        toast.success('Producto eliminado')
        queryClient.invalidateQueries({ queryKey: ['catalog-products'] })
      },
      onError: (err) => toast.error(err.message),
    })

    function openCreate() {
      setEditing(null)
      setForm(EMPTY_FORM)
      setDrawerOpen(true)
    }

    function openEdit(product) {
      setEditing(product)
      setForm({
        name:          product.name,
        slug:          product.slug,
        description:   product.description ?? '',
        price:         String(product.price),
        compare_price: product.compare_price != null ? String(product.compare_price) : '',
        currency:      product.currency ?? 'USD',
        stock:         String(product.stock ?? 0),
        track_stock:   product.track_stock ?? false,
        category_id:   product.category_id ?? '',
        published:     product.published ?? false,
      })
      setDrawerOpen(true)
    }

    function handleNameChange(name) {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      setForm((f) => ({ ...f, name, slug: !editing && !f.slug ? slug : f.slug }))
    }

    function handleSubmit(e) {
      e.preventDefault()
      saveMutation.mutate({
        name:          form.name,
        slug:          form.slug,
        description:   form.description || undefined,
        price:         Number(form.price),
        compare_price: form.compare_price ? Number(form.compare_price) : null,
        currency:      form.currency,
        stock:         Number(form.stock),
        track_stock:   form.track_stock,
        category_id:   form.category_id || null,
        published:     form.published,
      })
    }

    const products    = productsQuery.data?.data    ?? []
    const categories  = categoriesQuery.data?.data  ?? []

    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Productos</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{products.length} productos</p>
          </div>
          <Button onClick={openCreate}>Nuevo producto</Button>
        </div>

        <Input
          placeholder="Buscar productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        {productsQuery.isPending ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
            <p className="text-sm">{search ? 'Sin resultados.' : 'No hay productos. Crea el primero.'}</p>
          </div>
        ) : (
          <div className="border border-[hsl(var(--border))] rounded-lg divide-y divide-[hsl(var(--border))]">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{p.name}</p>
                    {p.published ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Publicado</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">Borrador</span>
                    )}
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.currency} {Number(p.price).toFixed(2)}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                  <Button
                    variant="ghost" size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => { if (window.confirm(`Eliminar "${p.name}"?`)) deleteMutation.mutate(p.id) }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? 'Editar producto' : 'Nuevo producto'}</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-1">
                <Label htmlFor="p-name">Nombre</Label>
                <Input id="p-name" value={form.name} onChange={(e) => handleNameChange(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-slug">Slug</Label>
                <Input id="p-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-desc">Descripcion</Label>
                <Input id="p-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="p-price">Precio</Label>
                  <Input id="p-price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="p-currency">Moneda</Label>
                  <Input id="p-currency" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={3} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-compare">Precio anterior (opcional)</Label>
                <Input id="p-compare" type="number" min="0" step="0.01" value={form.compare_price} onChange={(e) => setForm((f) => ({ ...f, compare_price: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-category">Categoria</Label>
                <select
                  id="p-category"
                  className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  <option value="">Sin categoria</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="p-stock">Stock</Label>
                  <Input id="p-stock" type="number" min="0" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="p-track"
                    checked={form.track_stock}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, track_stock: v }))}
                  />
                  <Label htmlFor="p-track">Controlar stock</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="p-published"
                  checked={form.published}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))}
                />
                <Label htmlFor="p-published">Publicado</Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDrawerOpen(false)}>Cancelar</Button>
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
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx
  ```

---

## Task 3 — Module screen exports

**Files:**
- Create: `apps/desktop/src/modules/atlas.catalog/index.js`

- [ ] **Step 1: Create the index**

  ```js
  // apps/desktop/src/modules/atlas.catalog/index.js
  export { default as CatalogProductsScreen }   from './screens/CatalogProductsScreen.jsx'
  export { default as CatalogCategoriesScreen } from './screens/CatalogCategoriesScreen.jsx'
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check apps/desktop/src/modules/atlas.catalog/index.js
  ```

---

## Task 4 — Register screens in ModuleOutlet

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1: Read ModuleOutlet.jsx to find the screen map**

  Open `apps/desktop/src/app/ModuleOutlet.jsx` and locate the object that maps module path keys to lazy-imported screen components (e.g. `'atlas.website/pages': () => import(...)`, `'atlas.hr/...': () => import(...)`).

- [ ] **Step 2: Add catalog screen entries to the screen map**

  In the screen map object, add:
  ```js
  'atlas.catalog':            () => import('../modules/atlas.catalog/screens/CatalogProductsScreen.jsx'),
  'atlas.catalog/categories': () => import('../modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx'),
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/desktop/src/app/ModuleOutlet.jsx
  ```

---

## Task 5 — Smoke-test in the browser

- [ ] **Step 1: Start dev servers**

  ```bash
  pnpm dev
  ```

- [ ] **Step 2: Verify navigation appears**

  Log in, confirm `atlas.catalog` is installed (if not, install it from the Modules screen). In the sidebar, verify "Catalogo", "Productos", and "Categorias" navigation entries appear.

- [ ] **Step 3: Test products screen**

  Navigate to `/app/m/atlas.catalog`. Confirm the products list loads. Click "Nuevo producto", fill in name and price, click "Crear". Confirm the product appears in the list.

- [ ] **Step 4: Test categories screen**

  Navigate to `/app/m/atlas.catalog/categories`. Create a category. Go back to products and assign it to the product created in Step 3.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/desktop/src/modules/atlas.catalog/ \
          apps/desktop/src/app/ModuleOutlet.jsx
  git commit -m "feat(catalog): add products and categories admin screens"
  ```

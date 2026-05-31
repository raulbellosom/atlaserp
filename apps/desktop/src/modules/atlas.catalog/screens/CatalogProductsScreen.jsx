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
    setForm((f) => ({ ...f, name, slug: !editing ? slug : f.slug }))
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

  const products   = productsQuery.data?.data   ?? []
  const categories = categoriesQuery.data?.data ?? []

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

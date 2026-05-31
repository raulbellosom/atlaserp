import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@atlas/ui'
import { Button, Input, Label } from '@atlas/ui'
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
    setForm((f) => ({ ...f, name, slug: !editing ? slug : f.slug }))
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

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

  const [sheetOpen, setSheetOpen]         = useState(false)
  const [editing, setEditing]             = useState(null)
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
    queryFn: () => atlas.catalog.listCategories(token, { flat: 'true' }),
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
              <motion.div
                key={cat.id}
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
      <div className="flex items-center gap-1 shrink-0 ml-3">
        {canUpdate && (
          <button
            type="button"
            onClick={() => onEdit(cat)}
            className="rounded-lg px-2 h-7 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            Editar
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(cat)}
            className="rounded-lg px-2 h-7 text-xs text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 transition-colors"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}

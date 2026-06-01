// apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AtlasTable,
  Button,
  ComboboxField,
  ConfirmDialog,
  NumberField,
  PageHeader,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  TextField,
  TextareaField,
} from '@atlas/ui'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { atlas } from '../../../lib/atlas.js'

const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const CATEGORIES_BLUEPRINT = {
  key: 'catalog.categories.table',
  schema: {
    apiPath: '/catalog/categories',
    primaryField: 'name',
    searchable: true,
    searchPlaceholder: 'Buscar categoría...',
    columns: [
      { field: 'name',        label: 'Nombre',    sortable: true },
      { field: 'slug',        label: 'Slug',      sortable: true },
      { field: 'parent_name', label: 'Categoría padre', sortable: false },
      { field: 'position',    label: 'Posición',  sortable: true },
    ],
    emptyState: { message: 'No hay categorías registradas.' },
  },
}

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/(^-|-$)/g, '')
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

  const [sheetOpen,      setSheetOpen]      = useState(false)
  const [editing,        setEditing]        = useState(null)
  const [confirmDelete,  setConfirmDelete]  = useState(null)
  const [refreshSignal,  setRefreshSignal]  = useState(0)
  const [form, setForm] = useState({ name: '', slug: '', description: '', parent_id: '', position: '0' })

  // Flat list for parent selector
  const flatQuery = useQuery({
    queryKey: ['catalog-categories-flat', token],
    queryFn:  () => atlas.catalog.listCategories(token, { flat: 'true' }),
    enabled:  Boolean(token),
    staleTime: 60_000,
  })
  const flatCats = flatQuery.data?.data ?? []

  const saveMutation = useMutation({
    mutationFn: data => editing
      ? atlas.catalog.updateCategory(editing.id, data, token)
      : atlas.catalog.createCategory(data, token),
    onSuccess: () => {
      toast.success(editing ? 'Categoría actualizada' : 'Categoría creada')
      queryClient.invalidateQueries({ queryKey: ['catalog-categories-flat'] })
      setRefreshSignal(s => s + 1)
      setSheetOpen(false)
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: id => atlas.catalog.deleteCategory(id, token),
    onSuccess: () => {
      toast.success('Categoría eliminada')
      queryClient.invalidateQueries({ queryKey: ['catalog-categories-flat'] })
      setRefreshSignal(s => s + 1)
      setConfirmDelete(null)
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', slug: '', description: '', parent_id: '', position: '0' })
    setSheetOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      name:        row.name        ?? '',
      slug:        row.slug        ?? '',
      description: row.description ?? '',
      parent_id:   row.parent_id   ?? '',
      position:    String(row.position ?? 0),
    })
    setSheetOpen(true)
  }

  function handleNameChange(e) {
    const name = e.target.value
    const autoSlug = slugify(editing?.name ?? '')
    const isAuto   = !editing || form.slug === autoSlug || form.slug === slugify(form.name)
    setForm(f => ({ ...f, name, slug: isAuto ? slugify(name) : f.slug }))
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
        description="Organiza tus productos en categorías y subcategorías."
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nueva categoría
            </Button>
          )
        }
      />

      <AtlasTable
        blueprint={CATEGORIES_BLUEPRINT}
        token={token}
        apiBaseUrl={API_BASE_URL}
        onEdit={canUpdate ? row => openEdit(row) : undefined}
        onDelete={canDelete ? row => setConfirmDelete(row) : undefined}
        refreshSignal={refreshSignal}
      />

      {/* Create / Edit sheet */}
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
            <TextareaField
              label="Descripción (opcional)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
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
            <NumberField
              label="Posición de orden"
              value={form.position}
              onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
              min={0}
              step={1}
              description="Número menor = aparece primero"
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

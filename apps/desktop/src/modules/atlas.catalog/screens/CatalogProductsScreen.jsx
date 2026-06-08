// apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AtlasTable, Button, ConfirmDialog, Dialog, DialogContent,
  DialogHeader, DialogTitle, PageHeader, TextField,
} from '@atlas/ui'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { atlas } from '../../../lib/atlas.js'
import { getApiUrl } from '../../../lib/runtimeConfig.js'

const API_BASE_URL = getApiUrl()

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
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')

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
    setNewName('')
    setCreateOpen(true)
  }

  function handleSubmitCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const slug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    createMutation.mutate({ name: newName.trim(), slug, price: 0 })
    setCreateOpen(false)
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

      <Dialog open={createOpen} onOpenChange={v => { if (!v) setCreateOpen(false) }}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate} className="space-y-4 pt-2">
            <TextField
              label="Nombre del producto"
              required
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ej. Camiseta basica"
              autoFocus
              maxLength={255}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={!newName.trim() || createMutation.isPending}>
                {createMutation.isPending ? 'Creando...' : 'Crear producto'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// apps/desktop/src/modules/atlas.catalog/screens/CatalogInventoryScreen.jsx
import { useNavigate } from 'react-router-dom'
import { AtlasTable, PageHeader } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'

const API_BASE_URL = getApiUrl()

const INVENTORY_BLUEPRINT = {
  key: 'catalog.inventory.table',
  schema: {
    apiPath: '/catalog/products',
    primaryField: 'name',
    searchable: true,
    searchPlaceholder: 'Buscar producto...',
    columns: [
      { field: 'name',          label: 'Producto',        sortable: true, link: true },
      { field: 'category_name', label: 'Categoria',       sortable: false },
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
      { field: 'stock',         label: 'Stock actual',    sortable: true },
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

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AtlasTable, Button, PageHeader } from '@atlas/ui'
import { LayoutGrid, LayoutList, Plus, RefreshCw, Table2 } from 'lucide-react'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { useInventoryItems } from '../hooks/useInventoryItems.js'
import {
  useInventoryCategories,
  useInventoryBrands,
  useInventoryLocations,
} from '../hooks/useInventoryCatalogs.js'
import { InventoryGroupedView } from '../components/InventoryGroupedView.jsx'
import { ITEM_STATUSES } from '../lib/inventory-constants.js'

const INVENTORY_TABLE_BLUEPRINT = {
  key: 'inventory.items.table',
  schema: {
    apiPath: '/inventory/items',
    primaryField: 'name',
    searchable: true,
    searchPlaceholder: 'Buscar item...',
    columns: [
      { field: 'assetTag',       label: 'Tag',         sortable: true,  link: false },
      { field: 'name',           label: 'Nombre',      sortable: true,  link: true },
      { field: 'categoryName',   label: 'Categoria',   sortable: false },
      { field: 'brandName',      label: 'Marca',       sortable: false },
      {
        field: 'status', label: 'Estado', sortable: true, type: 'select',
        options: ITEM_STATUSES.map(s => ({ value: s.value, label: s.label })),
      },
      { field: 'assignedToName', label: 'Responsable', sortable: false },
      { field: 'locationName',   label: 'Ubicacion',   sortable: false, defaultVisible: false },
      { field: 'serialNumber',   label: 'No. Serie',   sortable: false, defaultVisible: false },
      { field: 'model',          label: 'Modelo',      sortable: false, defaultVisible: false },
      { field: 'purchaseDate',   label: 'Compra',      sortable: true,  type: 'date', defaultVisible: false },
      { field: 'warrantyExpiry', label: 'Garantia',    sortable: true,  type: 'date', defaultVisible: false },
      { field: 'updatedAt',      label: 'Actualizado', sortable: true,  type: 'date', defaultVisible: false },
    ],
    filters: [
      {
        key: 'status', label: 'Estado', type: 'select',
        options: ITEM_STATUSES.map(s => ({ value: s.value, label: s.label })),
      },
    ],
    emptyState: { message: 'No hay items en el inventario.' },
  },
}

function ViewToggle({ viewMode, onChange }) {
  const modes = [
    { value: 'tree',  icon: LayoutList, label: 'Arbol' },
    { value: 'table', icon: Table2,     label: 'Tabla' },
    { value: 'cards', icon: LayoutGrid, label: 'Tarjetas' },
  ]
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-[hsl(var(--border))] p-1">
      {modes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          title={label}
          onClick={() => onChange(value)}
          className={[
            'flex items-center justify-center rounded p-1.5 transition-colors',
            viewMode === value
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
              : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
          ].join(' ')}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

export default function InventoryScreen() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token

  const [groupBy, setGroupBy] = useState('category')
  const [viewMode, setViewMode] = useState('tree')
  const [search, setSearch] = useState('')

  const { data: itemsData, isLoading, refetch, isFetching } = useInventoryItems({ search })
  const { data: categoriesData } = useInventoryCategories()
  const { data: brandsData } = useInventoryBrands()
  const { data: locationsData } = useInventoryLocations()

  const items = itemsData?.data ?? []
  const categories = categoriesData?.data ?? []
  const brands = brandsData?.data ?? []
  const locations = locationsData?.data ?? []

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Inventario"
        title="Inventario"
        description="Gestiona y rastrea todos los activos de la empresa"
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            {viewMode !== 'table' && (
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Actualizar">
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button onClick={() => navigate('/app/m/atlas.inventory/inventory/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo item
            </Button>
          </div>
        }
      />

      {viewMode === 'table' ? (
        <AtlasTable
          blueprint={INVENTORY_TABLE_BLUEPRINT}
          token={token}
          apiBaseUrl={getApiUrl()}
          onView={(row) => navigate(`/app/m/atlas.inventory/inventory/${row.id}`)}
        />
      ) : (
        <InventoryGroupedView
          items={items}
          categories={categories}
          brands={brands}
          locations={locations}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          viewMode={viewMode}
          search={search}
          onSearchChange={setSearch}
          onItemClick={(item) => navigate(`/app/m/atlas.inventory/inventory/${item.id}`)}
          onCreateItem={() => navigate('/app/m/atlas.inventory/inventory/new')}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}

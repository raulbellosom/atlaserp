import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, PageHeader } from '@atlas/ui'
import { Plus } from 'lucide-react'
import { useInventoryItems } from '../hooks/useInventoryItems.js'
import {
  useInventoryCategories,
  useInventoryBrands,
  useInventoryLocations,
} from '../hooks/useInventoryCatalogs.js'
import { InventoryGroupedView } from '../components/InventoryGroupedView.jsx'

export default function InventoryScreen() {
  const navigate = useNavigate()
  const [groupBy, setGroupBy] = useState('category')
  const [viewMode, setViewMode] = useState('tree')
  const [search, setSearch] = useState('')

  const { data: itemsData, isLoading } = useInventoryItems({ search })
  const { data: categoriesData } = useInventoryCategories()
  const { data: brandsData } = useInventoryBrands()
  const { data: locationsData } = useInventoryLocations()

  const items = itemsData?.data ?? []
  const categories = categoriesData?.data ?? []
  const brands = brandsData?.data ?? []
  const locations = locationsData?.data ?? []

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Inventario"
        actions={
          <Button onClick={() => navigate('/app/m/atlas.inventory/inventory/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo item
          </Button>
        }
      />
      <InventoryGroupedView
        items={items}
        categories={categories}
        brands={brands}
        locations={locations}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        onSearchChange={setSearch}
        onItemClick={(item) => navigate(`/app/m/atlas.inventory/inventory/${item.id}`)}
        onCreateItem={() => navigate('/app/m/atlas.inventory/inventory/new')}
        isLoading={isLoading}
      />
    </div>
  )
}

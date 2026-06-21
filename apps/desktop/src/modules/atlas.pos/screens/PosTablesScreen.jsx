import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelectField, EmptyState } from '@atlas/ui'
import { usePosActiveMap } from '../hooks/usePosFloor'
import { usePosOutlets } from '../hooks/usePosSettings'
import { useCreatePosOrder, usePosOrders } from '../hooks/usePosOrder'
import TableMap from '../components/TableMap'

export default function PosTablesScreen() {
  const navigate = useNavigate()
  const { data: outlets = [] } = usePosOutlets()
  const [outletId, setOutletId] = useState('')
  const { data: floorMap, isLoading } = usePosActiveMap(outletId || undefined)
  const { data: openOrders = [] } = usePosOrders({ status: 'OPEN' })
  const createOrder = useCreatePosOrder()

  const tables = floorMap?.tables ?? []
  const zones = floorMap?.zones ?? []
  const [zoneFilter, setZoneFilter] = useState('')

  const filteredTables = zoneFilter
    ? tables.filter((t) => t.zone_id === zoneFilter)
    : tables

  function handleTableClick(table) {
    const existingOrder = openOrders.find((o) => o.table_id === table.id)
    if (existingOrder) {
      navigate(`/app/m/atlas.pos/pos/terminal?order=${existingOrder.id}`)
      return
    }
    createOrder.mutate(
      { table_id: table.id, fulfillment_type: 'DINE_IN' },
      {
        onSuccess: (order) => {
          navigate(`/app/m/atlas.pos/pos/terminal?order=${order.id}`)
        },
      },
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0 flex-wrap">
        <h1 className="font-semibold text-lg">Mesas</h1>
        <div className="flex gap-2 ml-auto flex-wrap">
          {outlets.length > 1 && (
            <SelectField
              value={outletId}
              onChange={setOutletId}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Sucursal"
            />
          )}
          {zones.length > 0 && (
            <SelectField
              value={zoneFilter}
              onChange={setZoneFilter}
              options={[
                { value: '', label: 'Todas las zonas' },
                ...zones.map((z) => ({ value: z.id, label: z.name })),
              ]}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-8 text-center">Cargando plano...</p>
        ) : filteredTables.length === 0 ? (
          <EmptyState
            title="Sin mesas"
            description="No hay mesas en el plano activo. Configura el plano de planta primero."
          />
        ) : (
          <TableMap tables={filteredTables} onTableClick={handleTableClick} />
        )}
      </div>
    </div>
  )
}

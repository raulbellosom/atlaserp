import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, SelectField, EmptyState, Label } from '@atlas/ui'
import { usePosFloors, usePosFloorDetail } from '../hooks/usePosFloor'
import { usePosOutlets } from '../hooks/usePosSettings'
import { useCreatePosOrder, usePosOrders } from '../hooks/usePosOrder'
import TableMap from '../components/TableMap'

export default function PosTablesScreen() {
  const navigate = useNavigate()
  const { data: outlets = [] } = usePosOutlets()
  const [outletId, setOutletId] = useState('')
  const [selectedFloorId, setSelectedFloorId] = useState('')

  const effectiveOutletId = outletId || outlets[0]?.id || ''

  const { data: floors = [], isLoading: floorsLoading } = usePosFloors(
    effectiveOutletId ? { outletId: effectiveOutletId } : {},
  )

  // Default to the active floor, then first floor
  const defaultFloor = floors.find((f) => f.isActive) ?? floors[0]
  const effectiveFloorId = selectedFloorId || defaultFloor?.id || ''

  const { data: floorDetail, isLoading: tablesLoading } = usePosFloorDetail(effectiveFloorId)

  const tables = floorDetail?.tables ?? []

  const { data: openOrders = [] } = usePosOrders({ status: 'OPEN' })
  const createOrder = useCreatePosOrder()

  function handleOutletChange(id) {
    setOutletId(id)
    setSelectedFloorId('')
  }

  function handleTableClick(table) {
    const existingOrder = openOrders.find((o) => o.tableId === table.id)
    if (existingOrder) {
      navigate(`/app/m/atlas.pos/pos/terminal?order=${existingOrder.id}`)
      return
    }
    createOrder.mutate(
      { outletId: effectiveOutletId, tableId: table.id, fulfillmentType: 'DINE_IN' },
      {
        onSuccess: (res) => {
          const order = res?.data ?? res
          navigate(`/app/m/atlas.pos/pos/terminal?order=${order.id}`)
        },
      },
    )
  }

  const isLoading = floorsLoading || tablesLoading

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3 border-b border-border shrink-0 bg-card/60 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base leading-tight">Mesas</h1>
          <p className="text-xs text-muted-foreground">
            Selecciona una mesa para abrir o continuar una orden
          </p>
        </div>
        {outlets.length > 1 && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sucursal</Label>
            <SelectField
              value={outletId}
              onChange={handleOutletChange}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Todas las sucursales"
            />
          </div>
        )}
      </div>

      {/* Floor tabs — only shown when the outlet has more than one floor */}
      {floors.length > 1 && (
        <div className="flex gap-1 px-4 py-2 border-b border-border bg-card/40 shrink-0 overflow-x-auto">
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedFloorId(f.id)}
              className={[
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                effectiveFloorId === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              ].join(' ')}
            >
              {f.name}
              {f.isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Cargando plano de mesas...
          </p>
        ) : floors.length === 0 ? (
          <EmptyState
            title="Sin planos"
            description="Crea un plano en el diseñador de plantas y publícalo para ver las mesas."
          />
        ) : (
          <TableMap tables={tables} onTableClick={handleTableClick} />
        )}
      </div>
    </div>
  )
}

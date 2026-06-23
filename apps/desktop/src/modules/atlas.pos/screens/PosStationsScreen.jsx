import { useState } from 'react'
import { SelectField, EmptyState } from '@atlas/ui'
import { usePosOutlets, usePosStations } from '../hooks/usePosSettings'
import { usePosStationTickets } from '../hooks/usePosKitchen'
import KitchenStationBoard from '../components/KitchenStationBoard'

export default function PosStationsScreen() {
  const { data: outlets = [] } = usePosOutlets()
  const [outletId, setOutletId] = useState('')
  const { data: stations = [] } = usePosStations(outletId ? { outletId } : {})
  const [stationId, setStationId] = useState('')
  const { data: tickets = [], isLoading } = usePosStationTickets(stationId)

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-border shrink-0 sm:flex-row sm:items-center sm:gap-3">
        <h1 className="font-semibold text-lg shrink-0">Estaciones</h1>
        <div className="flex gap-2 sm:ml-auto flex-wrap">
          {outlets.length > 1 && (
            <div className="flex-1 min-w-32">
              <SelectField
                value={outletId}
                onChange={(v) => { setOutletId(v); setStationId('') }}
                options={outlets.map((o) => ({ value: o.id, label: o.name }))}
                placeholder="Sucursal"
              />
            </div>
          )}
          <div className="flex-1 min-w-32">
            <SelectField
              value={stationId}
              onChange={setStationId}
              options={stations.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Selecciona estación"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {!stationId ? (
          <EmptyState
            title="Selecciona una estación"
            description="Elige la estación para ver los tickets en preparación."
          />
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground p-8 text-center">Cargando tickets...</p>
        ) : (
          <KitchenStationBoard tickets={tickets} />
        )}
      </div>
    </div>
  )
}

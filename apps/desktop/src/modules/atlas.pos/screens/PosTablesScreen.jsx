import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelectField, EmptyState, Label, Button, Sheet, SheetContent, SheetTitle, Dialog, DialogContent, DialogHeader, DialogTitle } from '@atlas/ui'
import { LayoutGrid, List, Maximize2, Minimize2, CalendarCheck, CalendarX, Sparkles, UtensilsCrossed } from 'lucide-react'
import { usePosFloors, usePosFloorDetail, useUpdateTableStatus } from '../hooks/usePosFloor'
import { useCreatePosReservation, useUpdatePosReservation, useSeatPosReservation } from '../hooks/usePosReservation'
import { ReservationFormDialog } from '../components/ReservationFormDialog'
import { usePosOutlets } from '../hooks/usePosSettings'
import { useCreatePosOrder, usePosOrders } from '../hooks/usePosOrder'
import { useIsDesktop } from '../../../hooks/useIsDesktop'
import FloorOperationalCanvas from '../components/FloorOperationalCanvas'
import TableMap from '../components/TableMap'

// ─── Table action panel ───────────────────────────────────────────────────────
// Bottom sheet on mobile, centered Dialog on desktop

function TableActionContent({ actionTable, onClose, onNavigateToOrder, onMarkClean, onCancelReserve, busy }) {
  const name = actionTable?.name || 'Mesa'

  return (
    <>
      {actionTable?.action === 'dirty' && (
        <>
          <p className="text-sm text-muted-foreground mb-4">La mesa está marcada como sucia. ¿Qué deseas hacer?</p>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={onMarkClean} disabled={busy}>
              <Sparkles size={15} className="mr-2 shrink-0" />
              {busy ? 'Actualizando...' : 'Marcar como lista'}
            </Button>
            <Button variant="outline" className="w-full" onClick={onNavigateToOrder}>
              <UtensilsCrossed size={15} className="mr-2 shrink-0" />
              Abrir de todas formas
            </Button>
          </div>
        </>
      )}

      {actionTable?.action === 'reserved' && (
        <>
          {actionTable.activeReservation && (
            <div className="mb-4 rounded-xl bg-blue-500/8 border border-blue-500/20 p-3 space-y-1.5 text-sm">
              <p className="font-semibold text-foreground">
                {actionTable.activeReservation.guestName}
              </p>
              {actionTable.activeReservation.guestPhone && (
                <p className="text-muted-foreground">{actionTable.activeReservation.guestPhone}</p>
              )}
              <p className="text-muted-foreground">
                {actionTable.activeReservation.partySize}{' '}
                {actionTable.activeReservation.partySize === 1 ? 'comensal' : 'comensales'}
                {' · '}
                {new Date(actionTable.activeReservation.scheduledAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {new Date(
                  new Date(actionTable.activeReservation.scheduledAt).getTime() +
                    actionTable.activeReservation.durationMinutes * 60000
                ).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
              {actionTable.activeReservation.notes && (
                <p className="text-muted-foreground italic">{actionTable.activeReservation.notes}</p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={onNavigateToOrder} disabled={busy}>
              <UtensilsCrossed size={15} className="mr-2 shrink-0" />
              Iniciar orden
            </Button>
            <Button
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 dark:hover:bg-destructive/10"
              onClick={onCancelReserve}
              disabled={busy}
            >
              <CalendarX size={15} className="mr-2 shrink-0" />
              {busy ? 'Actualizando...' : 'Cancelar reserva'}
            </Button>
          </div>
        </>
      )}

      <Button variant="ghost" size="sm" className="w-full mt-3 text-muted-foreground" onClick={onClose}>
        Cancelar
      </Button>
    </>
  )
}

function TableActionPanel({ actionTable, onClose, onNavigateToOrder, onMarkClean, onCancelReserve, busy }) {
  const isDesktop = useIsDesktop()
  const name = actionTable?.name || 'Mesa'

  if (isDesktop) {
    return (
      <Dialog open={!!actionTable} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
          </DialogHeader>
          <TableActionContent
            actionTable={actionTable} onClose={onClose}
            onNavigateToOrder={onNavigateToOrder} onMarkClean={onMarkClean}
            onCancelReserve={onCancelReserve} busy={busy}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={!!actionTable} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" aria-describedby={undefined} className="pb-8 max-h-[80dvh]">
        <SheetTitle className="text-base mb-0.5">{name}</SheetTitle>
        <TableActionContent
          actionTable={actionTable} onClose={onClose}
          onNavigateToOrder={onNavigateToOrder} onMarkClean={onMarkClean}
          onCancelReserve={onCancelReserve} busy={busy}
        />
      </SheetContent>
    </Sheet>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PosTablesScreen() {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const { data: outlets = [] } = usePosOutlets()
  const [outletId, setOutletId] = useState('')
  const [selectedFloorId, setSelectedFloorId] = useState('')
  const [viewMode, setViewMode] = useState('canvas') // 'canvas' | 'grid'
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [reserveMode, setReserveMode] = useState(false)
  const [actionTable, setActionTable] = useState(null) // { id, name, status, action }

  const updateTableStatus = useUpdateTableStatus()
  const [reserveFormTable, setReserveFormTable] = useState(null)
  const createReservation = useCreatePosReservation()
  const updateReservation = useUpdatePosReservation()
  const seatReservation = useSeatPosReservation()

  useEffect(() => {
    function onFsChange() { setIsFullscreen(Boolean(document.fullscreenElement)) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }, [])

  const effectiveOutletId = outletId || outlets[0]?.id || ''

  const { data: floors = [], isLoading: floorsLoading } = usePosFloors(
    effectiveOutletId ? { outletId: effectiveOutletId } : {},
  )

  const defaultFloor = floors.find((f) => f.isActive) ?? floors[0]
  const effectiveFloorId = selectedFloorId || defaultFloor?.id || ''

  const { data: floorDetail, isLoading: tablesLoading } = usePosFloorDetail(effectiveFloorId, { refetch: true })

  const tables = floorDetail?.tables ?? []
  const elements = floorDetail?.elements ?? []
  const hasCanvasElements = elements.some((el) => el.kind === 'TABLE_SQUARE' || el.kind === 'TABLE_ROUND')

  const tableStates = useMemo(() => {
    const map = {}
    for (const t of tables) map[t.id] = t
    return map
  }, [tables])

  const { data: openOrders = [] } = usePosOrders({ status: 'OPEN' })
  const { data: sentOrders = [] } = usePosOrders({ status: 'SENT' })
  const { data: partialOrders = [] } = usePosOrders({ status: 'PARTIALLY_SERVED' })
  const { data: servedOrders = [] } = usePosOrders({ status: 'SERVED' })
  const activeOrders = useMemo(
    () => [...openOrders, ...sentOrders, ...partialOrders, ...servedOrders],
    [openOrders, sentOrders, partialOrders, servedOrders],
  )
  const createOrder = useCreatePosOrder()

  function handleOutletChange(id) {
    setOutletId(id)
    setSelectedFloorId('')
  }

  function navigateToOrder(table) {
    const existingOrder = activeOrders.find((o) => o.tableId === table.id)
    if (existingOrder) {
      navigate(`/app/m/atlas.pos/pos/terminal?order=${existingOrder.id}`)
      return
    }
    createOrder.mutate(
      { outletId: effectiveOutletId, tableId: table.id, fulfillmentType: 'DINE_IN' },
      { onSuccess: (res) => navigate(`/app/m/atlas.pos/pos/terminal?order=${(res?.data ?? res).id}`) },
    )
  }

  function handleTableClick(table) {
    if (!table?.id) return
    // Always use the live DB status from tableStates when available
    const liveTable = tableStates[table.id] ?? table
    const status = liveTable.status ?? 'AVAILABLE'
    const name = liveTable.name || table.name || 'Mesa'

    if (status === 'DIRTY') {
      setActionTable({ id: table.id, name, status, action: 'dirty' })
      return
    }
    if (status === 'RESERVED') {
      setActionTable({ id: table.id, name, status, action: 'reserved', activeReservation: liveTable.activeReservation ?? null })
      return
    }
    if (reserveMode && status === 'AVAILABLE') {
      setReserveFormTable({ id: table.id, name, outletId: effectiveOutletId })
      return
    }
    navigateToOrder(liveTable)
  }

  function handleMarkClean() {
    if (!actionTable) return
    updateTableStatus.mutate({ tableId: actionTable.id, status: 'AVAILABLE' }, {
      onSuccess: () => setActionTable(null),
    })
  }

  function handleReservationSubmit(data) {
    createReservation.mutate(data, {
      onSuccess: () => {
        setReserveFormTable(null)
        setReserveMode(false)
      },
    })
  }

  function handleCancelReserve() {
    if (!actionTable) return
    const reservationId = actionTable.activeReservation?.id
    if (reservationId) {
      updateReservation.mutate(
        { id: reservationId, status: 'CANCELLED' },
        { onSuccess: () => setActionTable(null) }
      )
    } else {
      updateTableStatus.mutate({ tableId: actionTable.id, status: 'AVAILABLE' }, {
        onSuccess: () => setActionTable(null),
      })
    }
  }

  function handleActionNavigate() {
    const table = actionTable
    setActionTable(null)
    if (!table) return

    const reservationId = table.activeReservation?.id
    if (reservationId) {
      seatReservation.mutate(
        { id: reservationId },
        {
          onSuccess: (res) => {
            const orderId = (res?.data ?? res).id
            navigate(`/app/m/atlas.pos/pos/terminal?order=${orderId}`)
          },
        }
      )
    } else {
      navigateToOrder(table)
    }
  }

  const isLoading = floorsLoading || tablesLoading
  const activeMode = hasCanvasElements ? viewMode : 'grid'

  return (
    <div ref={containerRef} className="flex h-full flex-col bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border shrink-0 bg-card/60 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base leading-tight">
            Mesas{reserveMode && <span className="ml-2 text-xs font-normal text-blue-500">Modo reserva</span>}
          </h1>
          <p className="text-xs text-muted-foreground">
            {reserveMode ? 'Toca una mesa disponible para reservarla' : 'Toca una mesa para abrir o continuar una orden'}
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

        {/* View toggle */}
        {hasCanvasElements && (
          <div className="flex rounded-md border border-border overflow-hidden shrink-0">
            <Button
              variant="ghost" size="sm"
              className={`rounded-none px-2.5 ${viewMode === 'canvas' ? 'bg-muted' : ''}`}
              onClick={() => setViewMode('canvas')} title="Vista de plano"
            >
              <LayoutGrid size={15} />
            </Button>
            <Button
              variant="ghost" size="sm"
              className={`rounded-none px-2.5 border-l border-border ${viewMode === 'grid' ? 'bg-muted' : ''}`}
              onClick={() => setViewMode('grid')} title="Vista de grilla"
            >
              <List size={15} />
            </Button>
          </div>
        )}

        {/* Reserve mode toggle */}
        <Button
          variant={reserveMode ? 'default' : 'ghost'}
          size="sm"
          className={`shrink-0 px-2.5 gap-1.5 ${reserveMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
          onClick={() => setReserveMode((v) => !v)}
          title="Modo reserva: toca una mesa disponible para reservarla"
        >
          <CalendarCheck size={15} />
          <span className="hidden sm:inline text-xs">Reservar</span>
        </Button>

        {/* Fullscreen toggle */}
        <Button
          variant="ghost" size="sm"
          className="shrink-0 px-2.5"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </Button>
      </div>

      {/* Floor tabs */}
      {floors.length > 0 && (
        <div className="flex gap-1 px-4 py-1.5 border-b border-border bg-card/40 shrink-0 overflow-x-auto">
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedFloorId(f.id)}
              className={[
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                effectiveFloorId === f.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              ].join(' ')}
            >
              {f.name}
              {f.isActive && <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}

      {/* Status legend */}
      <div className="shrink-0 px-4 py-1.5 border-b border-border/60 bg-card/30 flex flex-wrap gap-x-4 gap-y-1">
        {[
          { color: 'bg-green-500',  label: 'Disponible' },
          { color: 'bg-amber-500',  label: 'Ocupada' },
          { color: 'bg-orange-500', label: 'Cuenta pedida' },
          { color: 'bg-slate-400',  label: 'Sucia' },
          { color: 'bg-blue-500',   label: 'Reservada' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Cargando mesas...</p>
        ) : floors.length === 0 ? (
          <EmptyState
            title="Sin planos"
            description="Crea un plano en el diseñador de plantas y publícalo para ver las mesas."
          />
        ) : activeMode === 'canvas' && hasCanvasElements ? (
          <FloorOperationalCanvas
            floor={floorDetail}
            elements={elements}
            tableStates={tableStates}
            onTableClick={handleTableClick}
          />
        ) : (
          <TableMap tables={tables} onTableClick={handleTableClick} />
        )}
      </div>

      {/* Table action panel (Sheet on mobile, Dialog on desktop) */}
      <TableActionPanel
        actionTable={actionTable}
        onClose={() => setActionTable(null)}
        onNavigateToOrder={handleActionNavigate}
        onMarkClean={handleMarkClean}
        onCancelReserve={handleCancelReserve}
        busy={updateTableStatus.isPending || updateReservation.isPending || seatReservation.isPending}
      />

      <ReservationFormDialog
        open={Boolean(reserveFormTable)}
        onOpenChange={(v) => !v && setReserveFormTable(null)}
        tableName={reserveFormTable?.name ?? ''}
        tableId={reserveFormTable?.id}
        outletId={reserveFormTable?.outletId ?? ''}
        onSubmit={handleReservationSubmit}
        loading={createReservation.isPending}
      />
    </div>
  )
}

import { useState, useRef, useMemo, useEffect } from 'react'
import { Store, Landmark, Settings2, AlertTriangle } from 'lucide-react'
import {
  EmptyState, Button, Label, SelectField,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@atlas/ui'
import { usePosOutlets, usePosTerminals } from '../hooks/usePosSettings'
import { usePosCurrentSession } from '../hooks/usePosSession'
import { useCreatePosOrder, useAddPosOrderLine, usePosOrder } from '../hooks/usePosOrder'
import ProductGrid from '../components/ProductGrid'
import OrderPanel from '../components/OrderPanel'
import PaymentDialog from '../components/PaymentDialog'
import SessionOpenDialog from '../components/SessionOpenDialog'
import SessionCloseDialog from '../components/SessionCloseDialog'

const LS_OUTLET = 'atlas.pos.outletId'
const LS_TERMINAL = 'atlas.pos.terminalId'

function SetupCard({ outlets, terminals, onConfirm }) {
  const [outletId, setOutletId] = useState('')
  const [terminalId, setTerminalId] = useState('')
  const filteredTerminals = useMemo(
    () => terminals.filter((t) => !outletId || t.outletId === outletId),
    [terminals, outletId],
  )

  function handleOutletChange(id) {
    setOutletId(id)
    setTerminalId('')
  }

  return (
    <div className="w-full max-w-sm flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">Configurar terminal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecciona la sucursal y terminal desde donde vas a operar. Esta configuración se recordará.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Sucursal</Label>
          <SelectField
            value={outletId}
            onChange={handleOutletChange}
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Selecciona una sucursal"
          />
        </div>
        {outletId && (
          <div className="flex flex-col gap-1.5">
            <Label>Terminal</Label>
            <SelectField
              value={terminalId}
              onChange={setTerminalId}
              options={filteredTerminals.map((t) => ({ value: t.id, label: t.name }))}
              placeholder={
                filteredTerminals.length === 0
                  ? 'Sin terminales en esta sucursal'
                  : 'Selecciona una terminal'
              }
            />
          </div>
        )}
      </div>
      <Button
        disabled={!outletId || !terminalId}
        onClick={() => onConfirm(outletId, terminalId)}
        className="w-full"
      >
        Comenzar
      </Button>
    </div>
  )
}

export default function PosTerminalScreen() {
  const [outletId, setOutletId] = useState(() => localStorage.getItem(LS_OUTLET) ?? '')
  const [terminalId, setTerminalId] = useState(() => localStorage.getItem(LS_TERMINAL) ?? '')
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [payDialog, setPayDialog] = useState(false)
  const [openCajaDialog, setOpenCajaDialog] = useState(false)
  const [closeCajaDialog, setCloseCajaDialog] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [draftOutletId, setDraftOutletId] = useState('')
  const [draftTerminalId, setDraftTerminalId] = useState('')
  const creatingOrder = useRef(false)

  const { data: outlets = [] } = usePosOutlets()
  const { data: allTerminals = [] } = usePosTerminals()

  const terminals = useMemo(
    () => allTerminals.filter((t) => !outletId || t.outletId === outletId),
    [allTerminals, outletId],
  )
  const draftTerminals = useMemo(
    () => allTerminals.filter((t) => !draftOutletId || t.outletId === draftOutletId),
    [allTerminals, draftOutletId],
  )

  const currentOutlet = useMemo(() => outlets.find((o) => o.id === outletId), [outlets, outletId])
  const currentTerminal = useMemo(() => allTerminals.find((t) => t.id === terminalId), [allTerminals, terminalId])

  const { data: currentSession, isLoading: sessionLoading } = usePosCurrentSession(terminalId)
  const hasActiveSession = Boolean(currentSession)

  const createOrder = useCreatePosOrder()
  const addLine = useAddPosOrderLine()
  const { data: activeOrder } = usePosOrder(activeOrderId)

  // After data loads, clear localStorage if stored IDs no longer exist
  useEffect(() => {
    if (!outlets.length || !allTerminals.length) return
    if (outletId && !currentOutlet) {
      setOutletId('')
      setTerminalId('')
      localStorage.removeItem(LS_OUTLET)
      localStorage.removeItem(LS_TERMINAL)
    } else if (terminalId && !currentTerminal) {
      setTerminalId('')
      localStorage.removeItem(LS_TERMINAL)
    }
  }, [outlets, allTerminals]) // eslint-disable-line react-hooks/exhaustive-deps

  const isSetupComplete = Boolean(outletId && terminalId)

  function handleSetupConfirm(oId, tId) {
    setOutletId(oId)
    setTerminalId(tId)
    localStorage.setItem(LS_OUTLET, oId)
    localStorage.setItem(LS_TERMINAL, tId)
  }

  function handleConfigOpen() {
    setDraftOutletId(outletId)
    setDraftTerminalId(terminalId)
    setConfigOpen(true)
  }

  function handleDraftOutletChange(id) {
    setDraftOutletId(id)
    setDraftTerminalId('')
  }

  function handleConfigConfirm() {
    const outletChanged = draftOutletId !== outletId
    const terminalChanged = draftTerminalId !== terminalId
    setOutletId(draftOutletId)
    setTerminalId(draftTerminalId)
    localStorage.setItem(LS_OUTLET, draftOutletId)
    localStorage.setItem(LS_TERMINAL, draftTerminalId)
    if (outletChanged || terminalChanged) setActiveOrderId(null)
    setConfigOpen(false)
  }

  function handleNewOrder() {
    if (!isSetupComplete || !hasActiveSession || creatingOrder.current) return
    creatingOrder.current = true
    createOrder.mutate(
      { outletId, fulfillmentType: 'DINE_IN', sessionId: currentSession?.id ?? null },
      {
        onSuccess: (res) => setActiveOrderId((res?.data ?? res).id),
        onSettled: () => { creatingOrder.current = false },
      },
    )
  }

  function handleProductSelect(product) {
    if (!isSetupComplete || !hasActiveSession) return
    const lineData = {
      productId: product.id,
      quantity: 1,
      unitPrice: parseFloat(product.price ?? product.base_price ?? 0),
    }
    if (!activeOrderId) {
      if (creatingOrder.current) return
      creatingOrder.current = true
      createOrder.mutate(
        { outletId, fulfillmentType: 'DINE_IN', sessionId: currentSession?.id ?? null },
        {
          onSuccess: (res) => {
            const order = res?.data ?? res
            setActiveOrderId(order.id)
            addLine.mutate({ orderId: order.id, ...lineData })
          },
          onSettled: () => { creatingOrder.current = false },
        },
      )
      return
    }
    addLine.mutate({ orderId: activeOrderId, ...lineData })
  }

  function formatTime(isoStr) {
    if (!isoStr) return ''
    return new Date(isoStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top bar — only when setup is complete */}
      {isSetupComplete && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/80 shrink-0">
          <button
            type="button"
            onClick={handleConfigOpen}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <Store size={13} className="text-muted-foreground shrink-0" />
            <span className="max-w-32 truncate">{currentOutlet?.name ?? '...'}</span>
            <span className="text-muted-foreground/40">·</span>
            <Landmark size={13} className="text-muted-foreground shrink-0" />
            <span className="max-w-32 truncate">{currentTerminal?.name ?? '...'}</span>
            <Settings2 size={12} className="text-muted-foreground/50 ml-0.5 shrink-0" />
          </button>

          <div className="ml-auto flex items-center gap-2.5">
            {sessionLoading ? (
              <span className="text-xs text-muted-foreground">Verificando...</span>
            ) : hasActiveSession ? (
              <>
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs text-green-700 font-medium hidden sm:inline">
                  Caja abierta · {formatTime(currentSession.openedAt)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCloseCajaDialog(true)}
                  className="h-7 text-xs px-2.5"
                >
                  Cerrar caja
                </Button>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-xs text-amber-700 font-medium hidden sm:inline">Caja cerrada</span>
                <Button
                  size="sm"
                  onClick={() => setOpenCajaDialog(true)}
                  className="h-7 text-xs px-2.5"
                >
                  Abrir caja
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* No-session warning banner */}
      {isSetupComplete && !sessionLoading && !hasActiveSession && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 shrink-0">
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 flex-1 min-w-0">
            No hay caja abierta para esta terminal. Abre una caja para comenzar a tomar pedidos.
          </p>
          <Button size="sm" onClick={() => setOpenCajaDialog(true)} className="shrink-0">
            Abrir caja
          </Button>
        </div>
      )}

      {/* Main content */}
      {!isSetupComplete ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <SetupCard
            outlets={outlets}
            terminals={allTerminals}
            onConfirm={handleSetupConfirm}
          />
        </div>
      ) : !hasActiveSession && !sessionLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Caja cerrada"
            description="Abre la caja para esta terminal antes de tomar pedidos."
            action={{ label: 'Abrir caja', onClick: () => setOpenCajaDialog(true) }}
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            <ProductGrid onSelect={handleProductSelect} />
          </div>
          <div className="w-80 shrink-0 flex flex-col overflow-hidden">
            <OrderPanel
              order={activeOrder}
              onPay={() => setPayDialog(true)}
              onNewOrder={handleNewOrder}
            />
          </div>
        </div>
      )}

      {/* Dialogs */}
      {activeOrder && (
        <PaymentDialog
          open={payDialog}
          onOpenChange={setPayDialog}
          order={activeOrder}
          onSuccess={() => setActiveOrderId(null)}
        />
      )}

      <SessionOpenDialog
        open={openCajaDialog}
        onOpenChange={setOpenCajaDialog}
        defaultTerminalId={terminalId}
        onSuccess={() => setOpenCajaDialog(false)}
      />

      {hasActiveSession && (
        <SessionCloseDialog
          open={closeCajaDialog}
          onOpenChange={setCloseCajaDialog}
          session={currentSession}
          onSuccess={() => setCloseCajaDialog(false)}
        />
      )}

      {/* Change config modal */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-sm md:min-h-0">
          <DialogHeader>
            <DialogTitle>Cambiar sucursal o terminal</DialogTitle>
            <DialogDescription>
              Selecciona la sucursal y terminal desde donde operas.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Sucursal</Label>
              <SelectField
                value={draftOutletId}
                onChange={handleDraftOutletChange}
                options={outlets.map((o) => ({ value: o.id, label: o.name }))}
                placeholder="Selecciona una sucursal"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Terminal</Label>
              <SelectField
                value={draftTerminalId}
                onChange={setDraftTerminalId}
                options={draftTerminals.map((t) => ({ value: t.id, label: t.name }))}
                placeholder={
                  draftOutletId
                    ? draftTerminals.length === 0
                      ? 'Sin terminales en esta sucursal'
                      : 'Selecciona una terminal'
                    : 'Primero selecciona una sucursal'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfigConfirm}
              disabled={!draftOutletId || !draftTerminalId}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

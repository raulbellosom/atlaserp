import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Button, EmptyState,
} from '@atlas/ui'
import { useOrderSeatTotals, useAddPosPayment } from '../hooks/usePosOrder'
import { usePosPaymentMethods } from '../hooks/usePosSettings'

export default function SplitBillDialog({ open, onOpenChange, order, paymentMethodId, onFullyPaid }) {
  const { data: totals, isLoading } = useOrderSeatTotals(open ? order?.id : null)
  const addPayment = useAddPosPayment()
  const { data: methods = [] } = usePosPaymentMethods()
  const enabledMethods = Array.isArray(methods) ? methods.filter((m) => m.enabled) : []
  const effectiveMethodId = paymentMethodId ?? enabledMethods[0]?.id ?? null

  function handleClose() {
    onOpenChange(false)
  }

  function handleChargeSeat(seat) {
    if (!order?.id || !effectiveMethodId) return
    addPayment.mutate(
      { orderId: order.id, paymentMethodId: effectiveMethodId, amount: seat.total },
      {
        onSuccess: () => {
          const remaining = Number(totals?.remaining ?? 0) - Number(seat.total)
          if (remaining <= 0) {
            onFullyPaid?.()
            handleClose()
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Dividir cuenta — orden #{order?.orderNumber}</DialogTitle>
          <DialogDescription>
            {totals && (
              <>
                Restante:{' '}
                <span className="font-semibold text-foreground">${Number(totals.remaining).toFixed(2)}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-1 max-h-[50vh] overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando cuentas...</p>
          )}
          {!isLoading && (totals?.seats ?? []).length === 0 && (
            <EmptyState title="Sin líneas" description="Esta orden no tiene productos agregados." />
          )}
          {(totals?.seats ?? []).map((seat) => (
            <div
              key={seat.id ?? 'unassigned'}
              className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{seat.label}</span>
                <span className="text-xs text-muted-foreground">
                  {seat.linesCount} {seat.linesCount === 1 ? 'producto' : 'productos'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">${Number(seat.total).toFixed(2)}</span>
                <Button size="sm" onClick={() => handleChargeSeat(seat)} disabled={addPayment.isPending}>
                  Cobrar esta cuenta
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

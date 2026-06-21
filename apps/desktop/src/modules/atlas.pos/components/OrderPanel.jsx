import { useState } from 'react'
import { Button, ConfirmDialog } from '@atlas/ui'
import {
  useUpdatePosOrderLine, useDeletePosOrderLine,
  useSendToKitchen, useCancelPosOrder,
} from '../hooks/usePosOrder'

export default function OrderPanel({ order, onPay, onNewOrder }) {
  const updateLine = useUpdatePosOrderLine()
  const deleteLine = useDeletePosOrderLine()
  const sendKitchen = useSendToKitchen()
  const cancelOrder = useCancelPosOrder()
  const [cancelConfirm, setCancelConfirm] = useState(false)

  const lines = order?.lines ?? []
  const isPaid = order?.status === 'PAID'
  const isCancelled = order?.status === 'CANCELLED'
  const locked = isPaid || isCancelled

  function changeQty(line, delta) {
    const newQty = parseFloat(line.quantity) + delta
    if (newQty <= 0) {
      deleteLine.mutate({ orderId: order.id, lineId: line.id })
    } else {
      updateLine.mutate({ orderId: order.id, lineId: line.id, quantity: newQty })
    }
  }

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">
              {order ? `Orden #${order.order_number}` : 'Sin orden activa'}
            </p>
            {order?.table?.name && (
              <p className="text-xs text-muted-foreground">Mesa: {order.table.name}</p>
            )}
          </div>
          {order && !locked && (
            <Button size="sm" variant="ghost" onClick={() => setCancelConfirm(true)}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {lines.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-8">
            Selecciona productos para agregar a la orden
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 py-2 border-b border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{line.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    ${parseFloat(line.unit_price).toFixed(2)} c/u
                  </p>
                  {line.note && (
                    <p className="text-xs text-muted-foreground italic">{line.note}</p>
                  )}
                </div>
                {!locked ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => changeQty(line, -1)}
                      className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-sm hover:bg-muted"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-medium">
                      {parseFloat(line.quantity)}
                    </span>
                    <button
                      onClick={() => changeQty(line, 1)}
                      className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-sm hover:bg-muted"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="text-sm shrink-0">x{parseFloat(line.quantity)}</span>
                )}
                <span className="text-sm font-semibold shrink-0 w-16 text-right">
                  ${parseFloat(line.total_amount ?? 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {order && (
        <div className="p-4 border-t border-border space-y-1 shrink-0 bg-muted/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${parseFloat(order.subtotal_amount ?? 0).toFixed(2)}</span>
          </div>
          {parseFloat(order.tax_amount ?? 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA</span>
              <span>${parseFloat(order.tax_amount).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(order.discount_amount ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Descuento</span>
              <span>−${parseFloat(order.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1 border-t border-border mt-1">
            <span>Total</span>
            <span>${parseFloat(order.total_amount ?? 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="p-4 flex flex-col gap-2 shrink-0">
        {!order ? (
          <Button onClick={onNewOrder} className="w-full">Nueva orden</Button>
        ) : !locked ? (
          <>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => sendKitchen.mutate(order.id)}
                disabled={lines.length === 0 || sendKitchen.isPending}
              >
                Enviar a cocina
              </Button>
              <Button
                className="flex-1"
                onClick={onPay}
                disabled={lines.length === 0}
              >
                Cobrar
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-sm" onClick={onNewOrder}>
              + Nueva orden
            </Button>
          </>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            Orden {isPaid ? 'pagada' : 'cancelada'}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelConfirm}
        onOpenChange={setCancelConfirm}
        title="Cancelar orden"
        description="Esta acción no se puede deshacer. ¿Deseas cancelar la orden?"
        confirmLabel="Cancelar orden"
        variant="destructive"
        onConfirm={() => {
          cancelOrder.mutate({ orderId: order.id, reason: 'Cancelado desde terminal' }, {
            onSuccess: () => setCancelConfirm(false),
          })
        }}
      />
    </div>
  )
}

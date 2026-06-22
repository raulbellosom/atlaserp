import { useState } from 'react'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import { Button, Badge, Separator, ConfirmDialog } from '@atlas/ui'
import {
  useUpdatePosOrderLine, useDeletePosOrderLine,
  useSendToKitchen, useCancelPosOrder,
} from '../hooks/usePosOrder'

const STATUS_LABELS = { OPEN: 'Abierta', SENT: 'En cocina', PARTIALLY_SERVED: 'Parcialmente servida', SERVED: 'Servida', PAID: 'Pagada', CANCELLED: 'Cancelada' }
const STATUS_VARIANTS = { OPEN: 'default', SENT: 'default', PARTIALLY_SERVED: 'default', SERVED: 'default', PAID: 'secondary', CANCELLED: 'destructive' }

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
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {order ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">
                    Orden #{order.orderNumber}
                  </p>
                  <Badge variant={STATUS_VARIANTS[order.status] ?? 'secondary'} className="shrink-0 text-[10px] px-1.5 py-0">
                    {STATUS_LABELS[order.status] ?? order.status}
                  </Badge>
                </div>
                {order.table?.name && (
                  <p className="text-xs text-muted-foreground mt-0.5">Mesa: {order.table.name}</p>
                )}
              </>
            ) : (
              <p className="font-medium text-sm text-muted-foreground">Sin orden activa</p>
            )}
          </div>
          {order && !locked && (
            <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setCancelConfirm(true)}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Lines list */}
      <div className="flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <ShoppingCart size={20} className="text-muted-foreground/60" />
            </div>
            <p className="text-sm text-muted-foreground">
              {order ? 'Agrega productos para comenzar' : 'Selecciona productos para crear la orden'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 px-1">
            {lines.map((line) => (
              <li key={line.id} className="flex items-start gap-3 px-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug truncate">{line.productName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${parseFloat(line.unitPrice).toFixed(2)} c/u
                  </p>
                  {line.note && (
                    <p className="text-xs text-amber-600 mt-0.5 italic">{line.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!locked ? (
                    <>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 rounded-full"
                        onClick={() => changeQty(line, -1)}
                        aria-label="Reducir cantidad"
                      >
                        <Minus size={12} />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">
                        {parseFloat(line.quantity)}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 rounded-full"
                        onClick={() => changeQty(line, 1)}
                        aria-label="Aumentar cantidad"
                      >
                        <Plus size={12} />
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">×{parseFloat(line.quantity)}</span>
                  )}
                </div>
                <span className="text-sm font-semibold shrink-0 w-14 text-right tabular-nums">
                  ${parseFloat(line.totalAmount ?? 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals */}
      {order && (
        <div className="px-4 py-3 border-t border-border shrink-0 bg-muted/20">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">${parseFloat(order.subtotalAmount ?? 0).toFixed(2)}</span>
            </div>
            {parseFloat(order.taxAmount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">${parseFloat(order.taxAmount).toFixed(2)}</span>
              </div>
            )}
            {parseFloat(order.discountAmount ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Descuento</span>
                <span className="tabular-nums">−${parseFloat(order.discountAmount).toFixed(2)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="tabular-nums">${parseFloat(order.totalAmount ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-3 flex flex-col gap-2 shrink-0 border-t border-border">
        {!order ? (
          <Button onClick={onNewOrder} className="w-full">
            Nueva orden
          </Button>
        ) : !locked ? (
          <>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => sendKitchen.mutate(order.id)}
                disabled={lines.length === 0 || sendKitchen.isPending}
              >
                {sendKitchen.isPending ? 'Enviando...' : 'Enviar a cocina'}
              </Button>
              <Button
                className="flex-1"
                onClick={onPay}
                disabled={lines.length === 0}
              >
                Cobrar
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onNewOrder}>
              + Nueva orden
            </Button>
          </>
        ) : (
          <div className="text-center py-2">
            <Badge variant={isPaid ? 'secondary' : 'destructive'} className="text-xs">
              Orden {isPaid ? 'pagada' : 'cancelada'}
            </Badge>
            <div className="mt-2">
              <Button variant="outline" size="sm" className="w-full" onClick={onNewOrder}>
                Nueva orden
              </Button>
            </div>
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

import { useState } from 'react'
import { Minus, Plus, ShoppingCart, Receipt, NotebookPen } from 'lucide-react'
import { Button, Badge, Separator, ConfirmDialog } from '@atlas/ui'
import {
  useUpdatePosOrderLine, useDeletePosOrderLine,
  useCancelPosOrder,
} from '../hooks/usePosOrder'
import LineEditSheet from './LineEditSheet'

const STATUS_LABELS = { OPEN: 'Abierta', SENT: 'En cocina', PARTIALLY_SERVED: 'Parcialmente servida', SERVED: 'Servida', PAID: 'Pagada', CANCELLED: 'Cancelada' }
const STATUS_VARIANTS = { OPEN: 'default', SENT: 'default', PARTIALLY_SERVED: 'default', SERVED: 'default', PAID: 'secondary', CANCELLED: 'destructive' }

export default function OrderPanel({ order, onPay, onNewOrder, onSendToKitchen, onPendingQtyChange, sendingToKitchen, onRequestBill, requestingBill, isRetail = false, className }) {
  const updateLine = useUpdatePosOrderLine()
  const deleteLine = useDeletePosOrderLine()
  const cancelOrder = useCancelPosOrder()
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [editLine, setEditLine] = useState(null)

  const lines = order?.lines ?? []
  const isPaid = order?.status === 'PAID'
  const isCancelled = order?.status === 'CANCELLED'
  const locked = isPaid || isCancelled
  const hasServerOrder = order?.id && order.id !== 'pending'

  function changeQty(line, delta) {
    if (line.pending) {
      onPendingQtyChange?.(line.tempId, delta)
      return
    }
    const newQty = parseFloat(line.quantity) + delta
    if (newQty <= 0) {
      deleteLine.mutate({ orderId: order.id, lineId: line.id })
    } else {
      updateLine.mutate({ orderId: order.id, lineId: line.id, quantity: newQty })
    }
  }

  return (
    <div className={className ?? 'flex flex-col h-full bg-card border-l border-border'}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
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
          {hasServerOrder && !locked && (
            <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setCancelConfirm(true)}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Lines list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
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
              <li key={line.id} className={`flex items-center gap-2 px-2 py-2 transition-opacity ${line.pending ? 'opacity-60' : ''}`}>
                {/* Info area — tappable to edit note + quantity */}
                <button
                  type="button"
                  disabled={locked || line.pending}
                  onClick={() => !locked && !line.pending && setEditLine(line)}
                  className="flex-1 min-w-0 text-left rounded-xl px-2 py-2 -my-1 hover:bg-muted/50 active:bg-muted transition-colors disabled:pointer-events-none group touch-manipulation"
                  aria-label={`Editar ${line.productName}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-medium leading-snug truncate flex-1">{line.productName}</p>
                    {!locked && !line.pending && (
                      <NotebookPen
                        size={13}
                        className={`shrink-0 transition-colors ${line.note ? 'text-amber-500' : 'text-muted-foreground/30 group-hover:text-muted-foreground/60'}`}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${parseFloat(line.unitPrice).toFixed(2)} c/u{line.pending ? ' · pendiente' : ''}
                  </p>
                  {line.note && (
                    <p className="text-xs text-amber-600 mt-0.5 italic leading-snug line-clamp-2">{line.note}</p>
                  )}
                </button>

                {/* Quantity controls */}
                <div className="flex items-center gap-1 shrink-0">
                  {!locked ? (
                    <>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full touch-manipulation"
                        onClick={() => changeQty(line, -1)}
                        aria-label="Reducir cantidad"
                      >
                        <Minus size={14} />
                      </Button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums select-none">
                        {parseFloat(line.quantity)}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full touch-manipulation"
                        onClick={() => changeQty(line, 1)}
                        aria-label="Aumentar cantidad"
                      >
                        <Plus size={14} />
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground px-1">×{parseFloat(line.quantity)}</span>
                  )}
                </div>

                {/* Line total */}
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
            {isRetail ? (
              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={onPay}
                disabled={lines.length === 0}
              >
                Cobrar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onSendToKitchen}
                  disabled={lines.length === 0 || sendingToKitchen}
                >
                  {sendingToKitchen ? 'Enviando...' : 'Enviar a cocina'}
                </Button>
                <Button
                  className="flex-1"
                  onClick={onPay}
                  disabled={lines.length === 0}
                >
                  Cobrar
                </Button>
              </div>
            )}
            {/* "Pedir cuenta" — only for dine-in orders with a table not yet bill-requested */}
            {!isRetail && hasServerOrder && order?.table && onRequestBill && (
              order.table.status === 'BILL_REQUESTED' ? (
                <div className="flex items-center justify-center gap-1.5 py-1">
                  <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                  <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Cuenta pedida</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                  onClick={onRequestBill}
                  disabled={requestingBill}
                >
                  <Receipt size={13} />
                  {requestingBill ? 'Solicitando...' : 'Pedir cuenta'}
                </Button>
              )
            )}
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onNewOrder}>
              + Nueva {isRetail ? 'venta' : 'orden'}
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

      <LineEditSheet
        line={editLine}
        orderId={order?.id}
        open={Boolean(editLine)}
        onOpenChange={(open) => { if (!open) setEditLine(null) }}
      />
    </div>
  )
}

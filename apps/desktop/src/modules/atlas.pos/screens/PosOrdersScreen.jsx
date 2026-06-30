import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader, Card, CardContent, Button, Badge, Separator,
  SearchInput, EmptyState, ErrorState, SelectField, DateField, Label,
  MobileFiltersSheet, Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  ConfirmDialog,
} from '@atlas/ui'
import { ChevronRight, ExternalLink, Printer, X } from 'lucide-react'
import { usePosOrders, usePosOrder, useReprintPosReceipt, useCancelPosOrder } from '../hooks/usePosOrder'
import { useIsDesktop } from '../../../hooks/useIsDesktop'

const STATUS_LABELS = {
  DRAFT: 'Borrador', OPEN: 'Abierta', SENT: 'En cocina',
  PARTIALLY_SERVED: 'Parcial', SERVED: 'Servida',
  PAID: 'Pagada', CANCELLED: 'Cancelada', REFUNDED: 'Reembolsada',
}
const STATUS_CLASSES = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  OPEN: 'bg-blue-100 text-blue-700 border-blue-200',
  SENT: 'bg-amber-100 text-amber-700 border-amber-200',
  PARTIALLY_SERVED: 'bg-orange-100 text-orange-700 border-orange-200',
  SERVED: 'bg-green-100 text-green-700 border-green-200',
  PAID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-100 text-red-600 border-red-200',
  REFUNDED: 'bg-purple-100 text-purple-600 border-purple-200',
}
const CHANNEL_LABELS = {
  IN_STORE: 'Sucursal', PHONE: 'Teléfono', WEBSITE: 'Web',
  UBER_EATS: 'Uber Eats', RAPPI: 'Rappi', DIDI_FOOD: 'DiDi Food', OTHER: 'Otro',
}
const FULFILLMENT_LABELS = {
  DINE_IN: 'En mesa', TAKEAWAY: 'Para llevar', DELIVERY: 'Domicilio', PICKUP: 'Recogida',
}
const STATUS_OPTIONS = ['OPEN', 'SENT', 'PARTIALLY_SERVED', 'SERVED', 'PAID', 'CANCELLED']
const EDITABLE_STATUSES = new Set(['DRAFT', 'OPEN', 'SENT', 'PARTIALLY_SERVED', 'SERVED'])

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

// ─── Order detail panel ───────────────────────────────────────────────────────
// Renders as a right-side Sheet on mobile and a centered Dialog on desktop

function OrderDetailPanel({ orderId, onClose }) {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const { data: order, isLoading } = usePosOrder(orderId)
  const reprint = useReprintPosReceipt()
  const cancel = useCancelPosOrder()
  const [cancelConfirm, setCancelConfirm] = useState(false)

  const lines = order?.lines ?? []
  const payments = order?.payments ?? []
  const isPaid = order?.status === 'PAID'
  const isCancelled = order?.status === 'CANCELLED'
  const isEditable = EDITABLE_STATUSES.has(order?.status)

  function handleOpenInTerminal() {
    onClose()
    navigate(`/app/m/atlas.pos/pos/terminal?order=${order.id}`)
  }

  const body = (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando detalle…</p>
      ) : !order ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No se encontró la orden.</p>
      ) : (
        <>
          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Canal</p>
              <p className="font-medium">{CHANNEL_LABELS[order.salesChannel] ?? order.salesChannel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Modalidad</p>
              <p className="font-medium">{FULFILLMENT_LABELS[order.fulfillmentType] ?? order.fulfillmentType}</p>
            </div>
            {order.table?.name && (
              <div>
                <p className="text-xs text-muted-foreground">Mesa</p>
                <p className="font-medium">{order.table.name}</p>
              </div>
            )}
            {order.guestCount > 1 && (
              <div>
                <p className="text-xs text-muted-foreground">Comensales</p>
                <p className="font-medium">{order.guestCount}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Lines */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Productos</p>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin productos</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((line) => (
                  <li key={line.id} className="flex items-start gap-2">
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground w-6 text-right pt-0.5">
                      {parseFloat(line.quantity)}×
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{line.productName}</p>
                      {line.note && <p className="text-xs text-amber-600 italic mt-0.5">{line.note}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      ${parseFloat(line.totalAmount ?? 0).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">${parseFloat(order.subtotalAmount ?? 0).toFixed(2)}</span>
            </div>
            {parseFloat(order.taxAmount ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">${parseFloat(order.taxAmount).toFixed(2)}</span>
              </div>
            )}
            {parseFloat(order.discountAmount ?? 0) > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Descuento</span>
                <span className="tabular-nums">−${parseFloat(order.discountAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>Total</span>
              <span className="tabular-nums">${parseFloat(order.totalAmount ?? 0).toFixed(2)}</span>
            </div>
            {isPaid && (
              <div className="flex justify-between text-emerald-700">
                <span>Pagado</span>
                <span className="tabular-nums">${parseFloat(order.paidAmount ?? 0).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Payments */}
          {payments.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pagos</p>
                <ul className="space-y-1.5">
                  {payments.map((p) => (
                    <li key={p.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{p.paymentMethod?.name ?? p.paymentMethodId}</span>
                      <span className="tabular-nums font-medium">${parseFloat(p.amount ?? 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notas</p>
                <p className="text-sm">{order.notes}</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )

  const footer = order && (
    <div className="shrink-0 px-5 py-4 border-t border-border space-y-2">
      {isEditable && (
        <Button className="w-full" onClick={handleOpenInTerminal}>
          <ExternalLink size={15} className="mr-2" />
          Abrir en terminal
        </Button>
      )}
      {isPaid && (
        <Button variant="outline" className="w-full" onClick={() => reprint.mutate(order.id)} disabled={reprint.isPending}>
          <Printer size={15} className="mr-2" />
          Reimprimir recibo
        </Button>
      )}
      {isEditable && (
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setCancelConfirm(true)}>
          <X size={15} className="mr-2" />
          Cancelar orden
        </Button>
      )}
    </div>
  )

  const titleText = `Orden #${order?.orderNumber ?? '…'}${order?.table?.name ? ` · Mesa ${order.table.name}` : ''}`
  const subtitleText = `${order ? fmt(order.openedAt) : ''}${order?.customerName ? ` · ${order.customerName}` : ''}`

  const confirmDialog = (
    <ConfirmDialog
      open={cancelConfirm}
      onOpenChange={setCancelConfirm}
      title="Cancelar orden"
      description={`¿Cancelar la orden #${order?.orderNumber}? Esta acción no se puede deshacer.`}
      confirmLabel="Cancelar orden"
      variant="destructive"
      onConfirm={() => {
        cancel.mutate(
          { orderId: order.id, reason: 'Cancelado desde historial' },
          { onSuccess: () => { setCancelConfirm(false); onClose() } },
        )
      }}
    />
  )

  if (isDesktop) {
    return (
      <>
        <DialogContent size="md" className="flex flex-col p-0 max-h-[90dvh]" aria-describedby="order-detail-desc">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-base">{titleText}</DialogTitle>
                <DialogDescription id="order-detail-desc" className="text-xs mt-0.5">{subtitleText}</DialogDescription>
              </div>
              {order && (
                <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[order.status] ?? STATUS_CLASSES.OPEN}`}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              )}
            </div>
          </DialogHeader>
          {body}
          {footer}
        </DialogContent>
        {confirmDialog}
      </>
    )
  }

  return (
    <>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0" aria-describedby="order-detail-desc">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base">{titleText}</SheetTitle>
              <SheetDescription id="order-detail-desc" className="text-xs mt-0.5">{subtitleText}</SheetDescription>
            </div>
            {order && (
              <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[order.status] ?? STATUS_CLASSES.OPEN}`}>
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
            )}
          </div>
        </SheetHeader>
        {body}
        {footer}
      </SheetContent>
      {confirmDialog}
    </>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function PosOrdersScreen() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const isDesktopOrders = useIsDesktop()

  const query = {}
  if (status && status !== 'ALL') query.status = status
  if (dateFrom) query.dateFrom = dateFrom
  if (dateTo) query.dateTo = dateTo

  const { data: orders = [], isLoading, isError } = usePosOrders(query)

  const filtered = orders.filter((o) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      String(o.orderNumber).includes(s) ||
      (o.customerName ?? '').toLowerCase().includes(s) ||
      (o.table?.name ?? '').toLowerCase().includes(s)
    )
  })

  const hasFilters = Boolean(dateFrom || dateTo || (status && status !== 'ALL'))
  const activeFilterCount = (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (status && status !== 'ALL' ? 1 : 0)

  function handleClearFilters() {
    setDateFrom(''); setDateTo(''); setStatus('ALL')
  }

  const filterFields = (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>Estado</Label>
        <SelectField
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'Todos los estados' },
            ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          ]}
        />
      </div>
      <DateField label="Desde" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      <DateField label="Hasta" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
    </>
  )

  return (
    <div className="min-h-full bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader
          title="Ordenes"
          description="Historial de ordenes, estado de pago y reimpresión de recibos."
        />

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <SearchInput
                placeholder="Número, cliente o mesa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <MobileFiltersSheet activeCount={activeFilterCount} onClear={handleClearFilters}>
              {filterFields}
            </MobileFiltersSheet>
          </div>
          <div className="hidden md:flex gap-3 flex-wrap items-end">
            <div className="flex flex-col gap-1.5 w-48">
              <Label>Estado</Label>
              <SelectField
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'ALL', label: 'Todos los estados' },
                  ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-40">
              <DateField label="Desde" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 w-40">
              <DateField label="Hasta" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="self-end">
                Limpiar
              </Button>
            )}
          </div>
        </div>

        {isError ? (
          <ErrorState title="Error al cargar" description="No se pudieron obtener las ordenes." />
        ) : isLoading ? (
          <Card>
            <CardContent className="p-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3.5 gap-4 border-b border-border last:border-0 animate-pulse">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-muted rounded w-40" />
                    <div className="h-3 bg-muted rounded w-28" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3.5 bg-muted rounded w-16" />
                    <div className="h-5 bg-muted rounded-full w-20" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin ordenes" description="No hay ordenes que coincidan con el filtro." />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3.5 gap-4 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedOrderId(o.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          #{o.orderNumber}
                          {o.table?.name ? ` · Mesa ${o.table.name}` : ''}
                          {o.customerName ? ` · ${o.customerName}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {CHANNEL_LABELS[o.salesChannel] ?? o.salesChannel} · {fmt(o.openedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold tabular-nums">
                          ${parseFloat(o.totalAmount ?? 0).toFixed(2)}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[o.status] ?? STATUS_CLASSES.OPEN}`}>
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                        <ChevronRight size={15} className="text-muted-foreground/50 shrink-0" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Order detail panel — Sheet on mobile, Dialog on desktop */}
      {isDesktopOrders ? (
        <Dialog open={Boolean(selectedOrderId)} onOpenChange={(open) => { if (!open) setSelectedOrderId(null) }}>
          {selectedOrderId && (
            <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
          )}
        </Dialog>
      ) : (
        <Sheet open={Boolean(selectedOrderId)} onOpenChange={(open) => { if (!open) setSelectedOrderId(null) }}>
          {selectedOrderId && (
            <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
          )}
        </Sheet>
      )}
    </div>
  )
}

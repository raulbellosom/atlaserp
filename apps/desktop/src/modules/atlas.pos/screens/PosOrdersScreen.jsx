import { useState } from 'react'
import {
  PageHeader, Card, CardContent, Badge, Button, Input, EmptyState, ErrorState, SelectField,
} from '@atlas/ui'
import { usePosOrders, useReprintPosReceipt } from '../hooks/usePosOrder'

const STATUS_LABELS = {
  DRAFT: 'Borrador', OPEN: 'Abierta', SENT: 'En cocina',
  PARTIALLY_SERVED: 'Parcialmente servida', SERVED: 'Servida',
  PAID: 'Pagada', CANCELLED: 'Cancelada', REFUNDED: 'Reembolsada',
}
const STATUS_VARIANTS = {
  DRAFT: 'secondary', OPEN: 'default', SENT: 'default',
  PARTIALLY_SERVED: 'default', SERVED: 'default',
  PAID: 'secondary', CANCELLED: 'destructive', REFUNDED: 'destructive',
}
const CHANNEL_LABELS = {
  IN_STORE: 'Sucursal', PHONE: 'Teléfono', WEBSITE: 'Web',
  UBER_EATS: 'Uber Eats', RAPPI: 'Rappi', DIDI_FOOD: 'DiDi Food', OTHER: 'Otro',
}
const STATUS_OPTIONS = ['OPEN', 'SENT', 'PARTIALLY_SERVED', 'SERVED', 'PAID', 'CANCELLED']

export default function PosOrdersScreen() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const query = {}
  if (status) query.status = status

  const { data: orders = [], isLoading, isError } = usePosOrders(query)
  const reprint = useReprintPosReceipt()

  const filtered = orders.filter((o) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      String(o.order_number).includes(s) ||
      (o.customer_name ?? '').toLowerCase().includes(s) ||
      (o.table?.name ?? '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="min-h-full bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Ordenes" description="Historial de ordenes, estado de pago y reimpresion de recibos." />

        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Buscar por #, cliente o mesa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <SelectField
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: 'Todos los estados' },
              ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
            ]}
          />
        </div>

        {isError ? (
          <ErrorState title="Error al cargar" description="No se pudieron obtener las ordenes." />
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando ordenes...</p>
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin ordenes" description="No hay ordenes que coincidan con el filtro." />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {filtered.map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        #{o.order_number}
                        {o.table?.name ? ` · Mesa ${o.table.name}` : ''}
                        {o.customer_name ? ` · ${o.customer_name}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {CHANNEL_LABELS[o.sales_channel] ?? o.sales_channel} ·{' '}
                        {new Date(o.opened_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">${parseFloat(o.total_amount ?? 0).toFixed(2)}</span>
                      <Badge variant={STATUS_VARIANTS[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                      {o.status === 'PAID' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reprint.mutate(o.id)}
                          disabled={reprint.isPending}
                        >
                          Reimprimir
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

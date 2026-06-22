import { useState } from 'react'
import {
  PageHeader, Card, CardContent, Button,
  SearchInput, EmptyState, ErrorState, SelectField, DateField, Label,
} from '@atlas/ui'
import { usePosOrders, useReprintPosReceipt } from '../hooks/usePosOrder'

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
const STATUS_OPTIONS = ['OPEN', 'SENT', 'PARTIALLY_SERVED', 'SERVED', 'PAID', 'CANCELLED']

export default function PosOrdersScreen() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const query = {}
  if (status && status !== 'ALL') query.status = status
  if (dateFrom) query.dateFrom = dateFrom
  if (dateTo) query.dateTo = dateTo

  const { data: orders = [], isLoading, isError } = usePosOrders(query)
  const reprint = useReprintPosReceipt()

  const filtered = orders.filter((o) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      String(o.orderNumber).includes(s) ||
      (o.customerName ?? '').toLowerCase().includes(s) ||
      (o.table?.name ?? '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="min-h-full bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader
          title="Ordenes"
          description="Historial de ordenes, estado de pago y reimpresión de recibos."
        />

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1.5 flex-1 min-w-48 max-w-xs">
            <Label>Buscar</Label>
            <SearchInput
              placeholder="Número, cliente o mesa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
            <DateField
              label="Desde"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 w-40">
            <DateField
              label="Hasta"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          {(dateFrom || dateTo || (status && status !== 'ALL')) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFrom(''); setDateTo(''); setStatus('ALL') }}
              className="self-end"
            >
              Limpiar
            </Button>
          )}
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
                  <li key={o.id} className="flex items-center justify-between px-4 py-3.5 gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        #{o.orderNumber}
                        {o.table?.name ? ` · Mesa ${o.table.name}` : ''}
                        {o.customerName ? ` · ${o.customerName}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {CHANNEL_LABELS[o.salesChannel] ?? o.salesChannel} ·{' '}
                        {new Date(o.openedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold tabular-nums">
                        ${parseFloat(o.totalAmount ?? 0).toFixed(2)}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[o.status] ?? STATUS_CLASSES.OPEN}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
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

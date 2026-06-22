import { useState, useEffect } from 'react'
import { Badge, Button } from '@atlas/ui'
import { useUpdateTicketStatus } from '../hooks/usePosKitchen'

function ElapsedTime({ sentAt }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const secs = Math.floor((Date.now() - new Date(sentAt).getTime()) / 1000)
  const mins = Math.floor(secs / 60)
  const label = mins < 1 ? 'hace un momento' : mins === 1 ? '1 min' : `${mins} min`
  const urgent = mins >= 15
  const warning = mins >= 8

  return (
    <span className={`text-xs font-medium tabular-nums ${urgent ? 'text-red-600' : warning ? 'text-amber-600' : 'text-muted-foreground'}`}>
      {label}
    </span>
  )
}

const STATUS_LABELS = {
  PENDING: 'Pendiente', IN_PREPARATION: 'En preparación',
  READY: 'Listo', DELIVERED: 'Entregado', CANCELLED: 'Cancelado',
}

const NEXT_STATUS = {
  PENDING: 'IN_PREPARATION',
  IN_PREPARATION: 'READY',
  READY: 'DELIVERED',
}

const STATUS_COLORS = {
  PENDING: 'border-amber-300 bg-amber-50',
  IN_PREPARATION: 'border-blue-300 bg-blue-50',
  READY: 'border-green-300 bg-green-50',
}

const COLUMNS = ['PENDING', 'IN_PREPARATION', 'READY']

export default function KitchenStationBoard({ tickets = [] }) {
  const updateStatus = useUpdateTicketStatus()

  const byStatus = COLUMNS.reduce((acc, s) => {
    acc[s] = tickets.filter((t) => t.status === s)
    return acc
  }, {})

  return (
    <div className="grid grid-cols-3 gap-4 p-4 h-full overflow-y-auto">
      {COLUMNS.map((col) => (
        <div key={col} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{STATUS_LABELS[col]}</h3>
            <Badge variant="secondary">{byStatus[col].length}</Badge>
          </div>
          {byStatus[col].map((ticket) => (
            <div
              key={ticket.id}
              className={`rounded-xl border-2 p-3 flex flex-col gap-2 ${STATUS_COLORS[col]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">
                    Orden #{ticket.order?.orderNumber}
                  </p>
                  {ticket.order?.table?.name && (
                    <p className="text-xs text-muted-foreground">Mesa: {ticket.order.table.name}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <ElapsedTime sentAt={ticket.sentAt} />
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {new Date(ticket.sentAt).toLocaleTimeString('es-MX', { timeStyle: 'short' })}
                  </p>
                </div>
              </div>
              <ul className="space-y-1">
                {(ticket.lines ?? []).map((line) => (
                  <li key={line.id} className="text-sm flex items-center gap-1">
                    <span className="font-medium">{parseFloat(line.quantity)}x</span>
                    <span>{line.orderLine?.productName ?? 'Producto'}</span>
                    {line.orderLine?.note && (
                      <span className="text-xs text-muted-foreground italic"> — {line.orderLine.note}</span>
                    )}
                  </li>
                ))}
              </ul>
              {NEXT_STATUS[col] && (
                <Button
                  size="sm"
                  variant={col === 'IN_PREPARATION' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => updateStatus.mutate({ ticketId: ticket.id, status: NEXT_STATUS[col] })}
                  disabled={updateStatus.isPending}
                >
                  {col === 'PENDING' ? 'Iniciar' : col === 'IN_PREPARATION' ? 'Listo' : 'Entregar'}
                </Button>
              )}
            </div>
          ))}
          {byStatus[col].length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-6 border border-dashed border-border rounded-xl">
              Sin tickets
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

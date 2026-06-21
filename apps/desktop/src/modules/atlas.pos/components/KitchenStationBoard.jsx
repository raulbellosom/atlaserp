import { Badge, Button } from '@atlas/ui'
import { useUpdateTicketStatus } from '../hooks/usePosKitchen'

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
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    Orden #{ticket.order?.order_number}
                  </p>
                  {ticket.order?.table?.name && (
                    <p className="text-xs text-muted-foreground">Mesa: {ticket.order.table.name}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(ticket.sent_at).toLocaleTimeString('es-MX', { timeStyle: 'short' })}
                </span>
              </div>
              <ul className="space-y-1">
                {(ticket.lines ?? []).map((line) => (
                  <li key={line.id} className="text-sm flex items-center gap-1">
                    <span className="font-medium">{parseFloat(line.quantity)}x</span>
                    <span>{line.order_line?.product_name ?? 'Producto'}</span>
                    {line.order_line?.note && (
                      <span className="text-xs text-muted-foreground italic"> — {line.order_line.note}</span>
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

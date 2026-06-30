import { EmptyState } from '@atlas/ui'

function waiterInitials(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

const STATUS_COLORS = {
  AVAILABLE: 'bg-green-100 border-green-400 text-green-800',
  OCCUPIED: 'bg-amber-100 border-amber-400 text-amber-800',
  BILL_REQUESTED: 'bg-orange-100 border-orange-400 text-orange-800',
  DIRTY: 'bg-slate-100 border-slate-400 text-slate-600',
  RESERVED: 'bg-blue-100 border-blue-400 text-blue-800',
  DISABLED: 'bg-gray-100 border-gray-300 text-gray-400',
}

const STATUS_DOT = {
  AVAILABLE: 'bg-green-500',
  OCCUPIED: 'bg-amber-500',
  BILL_REQUESTED: 'bg-orange-500',
  DIRTY: 'bg-slate-400',
  RESERVED: 'bg-blue-500',
  DISABLED: 'bg-gray-300',
}

const STATUS_LABELS = {
  AVAILABLE: 'Disponible', OCCUPIED: 'Ocupada', BILL_REQUESTED: 'Cuenta pedida',
  DIRTY: 'Sucia', RESERVED: 'Reservada', DISABLED: 'Deshabilitada',
}


export default function TableMap({ tables = [], onTableClick }) {
  if (tables.length === 0) {
    return (
      <EmptyState
        title="Sin mesas"
        description="Crea un plano con mesas en el diseñador de plantas."
      />
    )
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 p-4">
        {tables.map((table) => {
          const colorClass = STATUS_COLORS[table.status] ?? STATUS_COLORS.AVAILABLE
          const dotClass   = STATUS_DOT[table.status]   ?? STATUS_DOT.AVAILABLE
          const isDisabled = table.status === 'DISABLED'
          return (
            <button
              key={table.id}
              onClick={() => onTableClick(table)}
              disabled={isDisabled}
              className={[
                'relative aspect-square flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 shadow-sm min-h-18',
                'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                colorClass,
                isDisabled
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer hover:shadow-md hover:-translate-y-px active:translate-y-0 active:shadow-sm',
              ].join(' ')}
            >
              {/* Status indicator dot */}
              <span className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full shadow-sm ${dotClass}`} />

              {/* Waiter initials badge */}
              {table.waiterName && (
                <span
                  title={table.waiterName}
                  className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-current/20 text-current text-[8px] font-bold flex items-center justify-center ring-1 ring-current/30"
                >
                  {waiterInitials(table.waiterName)}
                </span>
              )}

              <span className="text-sm font-bold leading-tight px-1 text-center line-clamp-2">{table.name}</span>
              <span className="text-[10px] font-medium opacity-75 leading-none">{STATUS_LABELS[table.status]}</span>
              {table.capacity > 0 && (
                <span className="text-[9px] opacity-50 leading-none">{table.capacity}p</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

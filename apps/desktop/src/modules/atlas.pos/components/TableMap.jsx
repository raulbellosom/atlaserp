import { EmptyState } from '@atlas/ui'

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

const LEGEND_STATUSES = ['AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'DIRTY', 'RESERVED']

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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 p-4">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => onTableClick(table)}
              disabled={table.status === 'DISABLED'}
              className={`aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95 min-h-18 ${
                STATUS_COLORS[table.status] ?? STATUS_COLORS.AVAILABLE
              } ${table.status === 'DISABLED' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <span className="text-base font-bold leading-none">{table.name}</span>
              <span className="text-[10px] mt-1 font-medium opacity-80">{STATUS_LABELS[table.status]}</span>
              {table.capacity && (
                <span className="text-[10px] opacity-60">{table.capacity} pers.</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {/* Status legend */}
      <div className="shrink-0 border-t border-border bg-card/60 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1">
        {LEGEND_STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
            <span className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

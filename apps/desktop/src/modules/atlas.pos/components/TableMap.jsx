import { EmptyState } from '@atlas/ui'
import { useUpdateTableStatus } from '../hooks/usePosFloor'

const STATUS_COLORS = {
  AVAILABLE: 'bg-green-100 border-green-400 text-green-800',
  OCCUPIED: 'bg-amber-100 border-amber-400 text-amber-800',
  BILL_REQUESTED: 'bg-orange-100 border-orange-400 text-orange-800',
  DIRTY: 'bg-slate-100 border-slate-400 text-slate-600',
  RESERVED: 'bg-blue-100 border-blue-400 text-blue-800',
  DISABLED: 'bg-gray-100 border-gray-300 text-gray-400',
}

const STATUS_LABELS = {
  AVAILABLE: 'Disponible', OCCUPIED: 'Ocupada', BILL_REQUESTED: 'Cuenta pedida',
  DIRTY: 'Sucia', RESERVED: 'Reservada', DISABLED: 'Deshabilitada',
}

export default function TableMap({ tables = [], onTableClick }) {
  const updateStatus = useUpdateTableStatus()

  if (tables.length === 0) {
    return (
      <EmptyState
        title="Sin mesas"
        description="Crea un plano con mesas en el diseñador de plantas."
      />
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
      {tables.map((table) => (
        <button
          key={table.id}
          onClick={() => onTableClick(table)}
          disabled={table.status === 'DISABLED'}
          className={`aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95 ${
            STATUS_COLORS[table.status] ?? STATUS_COLORS.AVAILABLE
          } ${table.status === 'DISABLED' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <span className="text-lg font-bold leading-none">{table.name}</span>
          <span className="text-[10px] mt-1 font-medium">{STATUS_LABELS[table.status]}</span>
          {table.capacity && (
            <span className="text-[10px] opacity-70">{table.capacity} pers.</span>
          )}
        </button>
      ))}
    </div>
  )
}

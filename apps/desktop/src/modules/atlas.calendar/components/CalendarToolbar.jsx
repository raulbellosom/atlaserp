import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCalendarStore } from '../stores/useCalendarStore'

const VIEWS = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'agenda', label: 'Agenda' },
]

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatTitle(view, dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  if (view === 'day') {
    return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (view === 'week') {
    const start = new Date(d); start.setDate(d.getDate() - d.getDay())
    const end = new Date(start); end.setDate(start.getDate() + 6)
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
    }
    return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
  }
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export default function CalendarToolbar({ onNewEvent }) {
  const { activeView, selectedDate, setActiveView, navigatePrev, navigateNext, navigateToday } = useCalendarStore()

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--surface-1))]">
      <div className="flex items-center gap-0.5">
        <button
          onClick={navigatePrev}
          className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={navigateNext}
          className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] capitalize min-w-[180px]">
        {formatTitle(activeView, selectedDate)}
      </h2>

      <button
        onClick={navigateToday}
        className="text-xs px-2.5 py-1 rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
      >
        Hoy
      </button>

      <div className="flex-1" />

      <div className="flex items-center rounded-lg border border-[hsl(var(--border))] overflow-hidden">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            className={[
              'px-3 py-1 text-xs font-medium transition-colors',
              activeView === v.key
                ? 'bg-violet-600 text-white'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
            ].join(' ')}
          >
            {v.label}
          </button>
        ))}
      </div>

      <button
        onClick={onNewEvent}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium"
      >
        <Plus size={14} />
        Nuevo
      </button>
    </div>
  )
}

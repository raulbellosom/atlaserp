import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus } from 'lucide-react'
import { useCalendarStore } from '../stores/useCalendarStore'

const VIEWS = [
  { key: 'day',    label: 'Dia' },
  { key: 'week',   label: 'Semana' },
  { key: 'month',  label: 'Mes' },
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
    <div className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(var(--surface-1))]">
      {/* Navigation arrows */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={navigatePrev}
          className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
        >
          {activeView === 'month' ? <ChevronUp size={16} /> : <ChevronLeft size={16} />}
        </button>
        <button
          onClick={navigateNext}
          className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
        >
          {activeView === 'month' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Title — truncates on narrow */}
      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] capitalize truncate min-w-0 flex-1 sm:flex-none sm:min-w-40">
        {formatTitle(activeView, selectedDate)}
      </h2>

      {/* "Hoy" — hidden on narrow to save space */}
      <button
        onClick={navigateToday}
        className="hidden sm:block text-xs px-2.5 py-1 rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] shrink-0"
      >
        Hoy
      </button>

      <div className="hidden sm:block flex-1" />

      {/* View switcher — pill buttons on desktop */}
      <div className="hidden sm:flex items-center rounded-lg border border-[hsl(var(--border))] overflow-hidden shrink-0">
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

      {/* View switcher — compact select on narrow */}
      <select
        value={activeView}
        onChange={(e) => setActiveView(e.target.value)}
        className="sm:hidden text-xs border border-[hsl(var(--border))] rounded-md px-2 py-1 bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shrink-0 cursor-pointer"
      >
        {VIEWS.map((v) => (
          <option key={v.key} value={v.key}>{v.label}</option>
        ))}
      </select>

      {/* New event — icon only on narrow, icon+label on desktop */}
      <button
        onClick={onNewEvent}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium shrink-0"
      >
        <Plus size={14} />
        <span className="hidden sm:inline">Nuevo</span>
      </button>
    </div>
  )
}

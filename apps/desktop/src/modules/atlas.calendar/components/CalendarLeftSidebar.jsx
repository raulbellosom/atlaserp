import { Plus } from 'lucide-react'
import MiniCalendar from './MiniCalendar'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendars } from '../hooks/useCalendarData'

export default function CalendarLeftSidebar({ onNewCalendar }) {
  const { selectedDate, setSelectedDate, activeCalendarIds, toggleCalendarFilter } = useCalendarStore()
  const { data, isLoading } = useCalendars()
  const owned = data?.owned ?? []
  const shared = data?.shared ?? []

  function isActive(id) {
    return activeCalendarIds.length === 0 || activeCalendarIds.includes(id)
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] overflow-y-auto">
      <div className="pt-3">
        <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      </div>

      <div className="flex-1 px-3 pt-3 space-y-4 pb-4">
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Mis calendarios
            </span>
            <button onClick={onNewCalendar} className="p-0.5 rounded hover:bg-[hsl(var(--muted))]">
              <Plus size={12} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          </div>

          {isLoading && (
            <div className="text-xs text-[hsl(var(--muted-foreground))] py-1">Cargando...</div>
          )}

          {owned.map((cal) => (
            <label key={cal.id} className="flex items-center gap-2 py-0.5 cursor-pointer group">
              <input type="checkbox" checked={isActive(cal.id)} onChange={() => toggleCalendarFilter(cal.id)} className="sr-only" />
              <span
                className="w-3 h-3 rounded-sm shrink-0 border-2 flex items-center justify-center transition-colors"
                style={{ borderColor: cal.color, backgroundColor: isActive(cal.id) ? cal.color : 'transparent' }}
              >
                {isActive(cal.id) && <span className="text-white text-[8px] leading-none">✓</span>}
              </span>
              <span className="text-xs text-[hsl(var(--foreground))] truncate flex-1">{cal.name}</span>
            </label>
          ))}
        </section>

        {shared.length > 0 && (
          <section>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1.5">
              Compartidos
            </div>
            {shared.map((cal) => (
              <label key={cal.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                <input type="checkbox" checked={isActive(cal.id)} onChange={() => toggleCalendarFilter(cal.id)} className="sr-only" />
                <span
                  className="w-3 h-3 rounded-sm shrink-0 border-2 flex items-center justify-center transition-colors"
                  style={{ borderColor: cal.color, backgroundColor: isActive(cal.id) ? cal.color : 'transparent' }}
                >
                  {isActive(cal.id) && <span className="text-white text-[8px] leading-none">✓</span>}
                </span>
                <span className="text-xs text-[hsl(var(--foreground))] truncate flex-1">{cal.name}</span>
              </label>
            ))}
          </section>
        )}
      </div>
    </aside>
  )
}

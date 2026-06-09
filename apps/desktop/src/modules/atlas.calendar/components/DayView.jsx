import { useCalendarStore } from '../stores/useCalendarStore'
import { useYearEvents } from '../hooks/useCalendarData'
import EventChip from './EventChip'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function dateKeyUTC(d) {
  const dt = new Date(d)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`
}

export default function DayView({ onEventClick }) {
  const { selectedDate, activeCalendarIds } = useCalendarStore()
  const dateStr = selectedDate || new Date().toISOString().slice(0, 10)
  const d = new Date(dateStr + 'T12:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()

  // Pre-load adjacent years at year boundaries for seamless day navigation
  const needsPrevYear = month === 0
  const needsNextYear = month === 11

  const { data: yearEvents = [] } = useYearEvents(year, activeCalendarIds)
  const { data: prevYearEvents = [] } = useYearEvents(year - 1, activeCalendarIds, needsPrevYear)
  const { data: nextYearEvents = [] } = useYearEvents(year + 1, activeCalendarIds, needsNextYear)

  const events = [
    ...yearEvents,
    ...(needsPrevYear ? prevYearEvents : []),
    ...(needsNextYear ? nextYearEvents : []),
  ]

  // All-day events: match by UTC date; timed events: match by local date
  const allDayEvents = events.filter(ev => ev.allDay && dateKeyUTC(ev.startAt) === dateStr)
  const timedEvents = events.filter(ev => !ev.allDay && dateKey(new Date(ev.startAt)) === dateStr)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {allDayEvents.length > 0 && (
        <div className="border-b border-[hsl(var(--border))] p-2 space-y-1 bg-[hsl(var(--surface-2))] shrink-0">
          <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold mb-1">Todo el dia</div>
          {allDayEvents.map(ev => <EventChip key={ev.id} event={ev} onClick={onEventClick} compact />)}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const hourEvents = timedEvents.filter(ev => new Date(ev.startAt).getHours() === hour)
          return (
            <div key={hour} className="flex border-b border-[hsl(var(--border))]/50 min-h-[56px]">
              <div className="w-14 shrink-0 px-2 pt-1 border-r border-[hsl(var(--border))] text-right">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {String(hour).padStart(2,'0')}:00
                </span>
              </div>
              <div className="flex-1 p-1 space-y-0.5">
                {hourEvents.map(ev => <EventChip key={ev.id} event={ev} onClick={onEventClick} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

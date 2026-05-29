import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarEvents } from '../hooks/useCalendarData'
import EventChip from './EventChip'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function DayView({ onEventClick }) {
  const { selectedDate, activeCalendarIds } = useCalendarStore()
  const dateStr = selectedDate || new Date().toISOString().slice(0,10)
  const start = new Date(dateStr + 'T00:00:00').toISOString()
  const end = new Date(dateStr + 'T23:59:59').toISOString()

  const { data: events = [] } = useCalendarEvents({ start, end, calendarIds: activeCalendarIds })
  const allDayEvents = events.filter(ev => ev.allDay)
  const timedEvents = events.filter(ev => !ev.allDay)

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

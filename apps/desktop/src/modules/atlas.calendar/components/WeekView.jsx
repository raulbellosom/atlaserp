import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarEvents } from '../hooks/useCalendarData'
import EventChip from './EventChip'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const start = new Date(d); start.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start); x.setDate(start.getDate() + i); return x
  })
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function WeekView({ onEventClick }) {
  const { selectedDate, setSelectedDate, activeCalendarIds } = useCalendarStore()
  const days = getWeekDays(selectedDate || new Date().toISOString().slice(0,10))
  const rangeStart = new Date(days[0]); rangeStart.setHours(0,0,0,0)
  const rangeEnd = new Date(days[6]); rangeEnd.setHours(23,59,59,999)

  const { data: events = [] } = useCalendarEvents({
    start: rangeStart.toISOString(),
    end: rangeEnd.toISOString(),
    calendarIds: activeCalendarIds,
  })

  const today = new Date()
  const todayKey = dateKey(today)

  function eventsForDayHour(day, hour) {
    const dk = dateKey(day)
    return events.filter(ev => {
      if (ev.allDay) return false
      const s = new Date(ev.startAt)
      return dateKey(s) === dk && s.getHours() === hour
    })
  }

  function allDayEventsForDay(day) {
    const dk = dateKey(day)
    return events.filter(ev => ev.allDay && dateKey(new Date(ev.startAt)) === dk)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header row */}
      <div className="grid border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] shrink-0" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        <div className="border-r border-[hsl(var(--border))]" />
        {days.map((day) => {
          const dk = dateKey(day)
          const isToday = dk === todayKey
          const allDay = allDayEventsForDay(day)
          return (
            <div key={dk} onClick={() => setSelectedDate(dk)} className="border-r border-[hsl(var(--border))] last:border-r-0 p-1.5 cursor-pointer hover:bg-[hsl(var(--muted))]/30 min-h-[56px]">
              <div className="text-center">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">{DAYS_SHORT[day.getDay()]}</div>
                <div className={['text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full', isToday ? 'bg-violet-600 text-white' : 'text-[hsl(var(--foreground))]'].join(' ')}>
                  {day.getDate()}
                </div>
              </div>
              <div className="mt-0.5 space-y-0.5">
                {allDay.map(ev => <EventChip key={ev.id} event={ev} onClick={onEventClick} compact />)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="grid border-b border-[hsl(var(--border))]/50 min-h-[48px]" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
            <div className="border-r border-[hsl(var(--border))] px-1 pt-0.5 shrink-0">
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {String(hour).padStart(2,'0')}:00
              </span>
            </div>
            {days.map((day) => (
              <div key={dateKey(day)} className="border-r border-[hsl(var(--border))]/30 last:border-r-0 p-0.5 space-y-0.5">
                {eventsForDayHour(day, hour).map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={onEventClick} compact />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

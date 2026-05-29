import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarEvents } from '../hooks/useCalendarData'
import EventChip from './EventChip'

const WEEKDAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, new Date(year, month, 0).getDate() - i), current: false })
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), current: true })
  let extra = 1
  while (cells.length < 42) cells.push({ date: new Date(year, month + 1, extra++), current: false })
  return cells
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function groupEventsByDate(events) {
  const map = {}
  for (const ev of events) {
    const k = dateKey(new Date(ev.startAt))
    if (!map[k]) map[k] = []
    map[k].push(ev)
  }
  return map
}

export default function MonthView({ onEventClick, onDayClick }) {
  const { selectedDate, setSelectedDate, activeCalendarIds } = useCalendarStore()
  const d = new Date((selectedDate || new Date().toISOString().slice(0,10)) + 'T12:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()

  const rangeStart = new Date(year, month, 1).toISOString()
  const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  const { data: events = [] } = useCalendarEvents({ start: rangeStart, end: rangeEnd, calendarIds: activeCalendarIds })
  const byDate = groupEventsByDate(events)

  const cells = buildMonthGrid(year, month)
  const today = new Date()
  const todayKey = dateKey(today)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="py-2 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))] last:border-r-0">
            {wd}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
        {cells.map((cell, i) => {
          const key = dateKey(cell.date)
          const isToday = key === todayKey
          const isSelected = key === selectedDate
          const dayEvents = byDate[key] ?? []

          return (
            <div
              key={i}
              onClick={() => { setSelectedDate(key); onDayClick?.(key) }}
              className={[
                'border-r border-b border-[hsl(var(--border))] last:border-r-0 p-1 cursor-pointer overflow-hidden',
                'hover:bg-[hsl(var(--muted))]/30 transition-colors',
                !cell.current && 'bg-[hsl(var(--muted))]/20',
                isSelected && 'ring-1 ring-inset ring-violet-500',
              ].filter(Boolean).join(' ')}
            >
              <div className="flex justify-end mb-0.5">
                <span className={[
                  'text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium',
                  isToday ? 'bg-violet-600 text-white' : '',
                  !cell.current ? 'text-[hsl(var(--muted-foreground))] opacity-50' : 'text-[hsl(var(--foreground))]',
                ].join(' ')}>
                  {cell.date.getDate()}
                </span>
              </div>

              <div className="space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={onEventClick} compact />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))] pl-1">
                    +{dayEvents.length - 3} más
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useCalendarStore } from '../stores/useCalendarStore'
import { useYearEvents } from '../hooks/useCalendarData'
import {
  filterEventsForHour,
  splitVisibleEvents,
} from '../lib/calendar-overflow'
import EventChip from './EventChip'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MAX_VISIBLE_SLOT_EVENTS = 2
const MAX_VISIBLE_ALL_DAY_EVENTS = 1

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start)
    x.setDate(start.getDate() + i)
    return x
  })
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateKeyUTC(d) {
  const dt = new Date(d)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export default function WeekView({ onEventClick }) {
  const {
    selectedDate,
    setSelectedDate,
    activeCalendarIds,
    focusDate,
    focusTimeSlot,
  } = useCalendarStore()
  const days = getWeekDays(selectedDate || new Date().toISOString().slice(0, 10))

  const firstDay = days[0]
  const lastDay = days[6]
  const firstYear = firstDay.getFullYear()
  const lastYear = lastDay.getFullYear()
  const crossYear = lastYear !== firstYear

  const needsPrevYear = firstDay.getMonth() === 0
  const needsNextYear = lastDay.getMonth() === 11

  const { data: yearEvents = [] } = useYearEvents(firstYear, activeCalendarIds)
  const { data: nextYearEvents = [] } = useYearEvents(
    firstYear + 1,
    activeCalendarIds,
    crossYear || needsNextYear,
  )
  const { data: prevYearEvents = [] } = useYearEvents(
    firstYear - 1,
    activeCalendarIds,
    needsPrevYear,
  )

  const events = [
    ...yearEvents,
    ...(crossYear || needsNextYear ? nextYearEvents : []),
    ...(needsPrevYear ? prevYearEvents : []),
  ]

  const today = new Date()
  const todayKey = dateKey(today)

  function eventsForDayHour(day, hour) {
    const dayValue = dateKey(day)
    return filterEventsForHour(events, hour).filter((event) => {
      const start = new Date(event.startAt)
      return dateKey(start) === dayValue
    })
  }

  function allDayEventsForDay(day) {
    const dayValue = dateKey(day)
    return events.filter((event) => {
      if (!event.allDay) return false
      const startKey = dateKeyUTC(event.startAt)
      const endKey = event.endAt ? dateKeyUTC(event.endAt) : startKey
      return dayValue >= startKey && dayValue <= endKey
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        className="grid border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] shrink-0"
        style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}
      >
        <div className="border-r border-[hsl(var(--border))]" />
        {days.map((day) => {
          const dayValue = dateKey(day)
          const isToday = dayValue === todayKey
          const allDaySlot = splitVisibleEvents(
            allDayEventsForDay(day),
            MAX_VISIBLE_ALL_DAY_EVENTS,
          )

          return (
            <div
              key={dayValue}
              className="border-r border-[hsl(var(--border))] last:border-r-0 p-1.5 hover:bg-[hsl(var(--muted))]/30 h-[72px] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setSelectedDate(dayValue)}
                className="w-full text-center"
              >
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">
                  {DAYS_SHORT[day.getDay()]}
                </div>
                <div
                  className={[
                    'text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full',
                    isToday ? 'bg-violet-600 text-white' : 'text-[hsl(var(--foreground))]',
                  ].join(' ')}
                >
                  {day.getDate()}
                </div>
              </button>
              <div className="mt-0.5 flex flex-col gap-0.5 overflow-hidden">
                {allDaySlot.visible.map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    onClick={onEventClick}
                    compact
                    hideTime
                    hideReminder
                  />
                ))}
                {allDaySlot.hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={(uiEvent) => {
                      uiEvent.stopPropagation()
                      focusDate(dayValue)
                    }}
                    className="truncate rounded px-1 text-left text-[10px] font-medium text-violet-300 hover:text-violet-200"
                  >
                    +{allDaySlot.hiddenCount} más
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid h-[56px] border-b border-[hsl(var(--border))]/50"
            style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}
          >
            <div className="border-r border-[hsl(var(--border))] px-1 pt-0.5 shrink-0">
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {String(hour).padStart(2, '0')}:00
              </span>
            </div>
            {days.map((day) => {
              const dayValue = dateKey(day)
              const slot = splitVisibleEvents(
                eventsForDayHour(day, hour),
                MAX_VISIBLE_SLOT_EVENTS,
              )

              return (
                <div
                  key={dayValue}
                  className="border-r border-[hsl(var(--border))]/30 last:border-r-0 p-0.5 overflow-hidden"
                >
                  <div className="flex h-full flex-col gap-0.5 overflow-hidden">
                    {slot.visible.map((event) => (
                      <EventChip
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                        compact
                        hideTime
                        hideReminder
                      />
                    ))}
                    {slot.hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => focusTimeSlot(dayValue, hour)}
                        className="truncate rounded px-1 text-left text-[10px] font-medium text-violet-300 hover:text-violet-200"
                      >
                        +{slot.hiddenCount} más
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

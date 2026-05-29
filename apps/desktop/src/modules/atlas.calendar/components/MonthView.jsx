import { useState, useEffect, useCallback } from 'react'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarEvents } from '../hooks/useCalendarData'
import EventChip from './EventChip'

const WEEKDAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const SLIDE_CSS = `
  @keyframes cal-slide-in-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0%); }
  }
  @keyframes cal-slide-out-up {
    from { transform: translateY(0%); }
    to   { transform: translateY(-100%); }
  }
  @keyframes cal-slide-in-down {
    from { transform: translateY(-100%); }
    to   { transform: translateY(0%); }
  }
  @keyframes cal-slide-out-down {
    from { transform: translateY(0%); }
    to   { transform: translateY(100%); }
  }
`

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

function MonthGrid({ year, month, selectedDate, onSelectDate, onEventClick, activeCalendarIds }) {
  const rangeStart = new Date(year, month, 1).toISOString()
  const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  const { data: events = [] } = useCalendarEvents({ start: rangeStart, end: rangeEnd, calendarIds: activeCalendarIds })
  const byDate = groupEventsByDate(events)

  const cells = buildMonthGrid(year, month)
  const today = new Date()
  const todayKey = dateKey(today)

  return (
    <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden h-full">
      {cells.map((cell, i) => {
        const key = dateKey(cell.date)
        const isToday = key === todayKey
        const isSelected = key === selectedDate
        const dayEvents = byDate[key] ?? []

        return (
          <div
            key={i}
            onClick={() => { onSelectDate(key) }}
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
  )
}

const ANIM_DURATION = 320

export default function MonthView({ onEventClick, onDayClick }) {
  const { selectedDate, setSelectedDate, activeCalendarIds } = useCalendarStore()
  const ref = selectedDate || new Date().toISOString().slice(0, 10)
  const d = new Date(ref + 'T12:00:00')
  const targetYear = d.getFullYear()
  const targetMonth = d.getMonth()

  const [current, setCurrent] = useState({ year: targetYear, month: targetMonth })
  const [prev, setPrev] = useState(null)
  const [direction, setDirection] = useState('next')
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (targetYear === current.year && targetMonth === current.month) return

    const isNext =
      targetYear > current.year ||
      (targetYear === current.year && targetMonth > current.month)

    setPrev({ ...current })
    setDirection(isNext ? 'next' : 'prev')
    setCurrent({ year: targetYear, month: targetMonth })
    setAnimating(true)

    const t = setTimeout(() => {
      setPrev(null)
      setAnimating(false)
    }, ANIM_DURATION)

    return () => clearTimeout(t)
  }, [targetYear, targetMonth])

  function handleSelectDate(key) {
    setSelectedDate(key)
    onDayClick?.(key)
  }

  const inAnim  = direction === 'next' ? 'cal-slide-in-up'   : 'cal-slide-in-down'
  const outAnim = direction === 'next' ? 'cal-slide-out-up'  : 'cal-slide-out-down'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <style>{SLIDE_CSS}</style>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] shrink-0">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="py-2 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))] last:border-r-0">
            {wd}
          </div>
        ))}
      </div>

      {/* Grid area — overflow hidden so sliding grids are clipped */}
      <div className="flex-1 relative overflow-hidden">
        {/* Outgoing grid */}
        {animating && prev && (
          <div
            className="absolute inset-0 flex flex-col"
            style={{ animation: `${outAnim} ${ANIM_DURATION}ms cubic-bezier(0.4,0,0.2,1) forwards` }}
          >
            <MonthGrid
              year={prev.year}
              month={prev.month}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onEventClick={onEventClick}
              activeCalendarIds={activeCalendarIds}
            />
          </div>
        )}

        {/* Incoming / current grid */}
        <div
          className="absolute inset-0 flex flex-col"
          style={animating ? { animation: `${inAnim} ${ANIM_DURATION}ms cubic-bezier(0.4,0,0.2,1) forwards` } : undefined}
        >
          <MonthGrid
            year={current.year}
            month={current.month}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onEventClick={onEventClick}
            activeCalendarIds={activeCalendarIds}
          />
        </div>
      </div>
    </div>
  )
}

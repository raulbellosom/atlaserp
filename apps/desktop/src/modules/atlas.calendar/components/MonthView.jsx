import { useState, useEffect, useRef, useCallback } from 'react'
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

const ANIM_DURATION = 320
const SWIPE_THRESHOLD = 50    // px
const WHEEL_THRESHOLD = 60    // deltaY px accumulated
const WHEEL_COOLDOWN  = 600   // ms between wheel navigations

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month - 1, new Date(year, month, 0).getDate() - i), current: false })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(year, month, d), current: true })
  let extra = 1
  while (cells.length < 42)
    cells.push({ date: new Date(year, month + 1, extra++), current: false })
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

// Pure grid — receives events as prop, no internal fetch
function MonthGrid({ year, month, selectedDate, onSelectDate, onEventClick, onNewEvent, byDate }) {
  const cells = buildMonthGrid(year, month)
  const today = new Date()
  const todayKey = dateKey(today)

  return (
    <div className="grid grid-cols-7 grid-rows-6 h-full">
      {cells.map((cell, i) => {
        const key = dateKey(cell.date)
        const isToday   = key === todayKey
        const isSelected = key === selectedDate
        const dayEvents = byDate[key] ?? []

        return (
          <div
            key={i}
            onClick={() => onSelectDate(key)}
            onDoubleClick={(e) => { e.stopPropagation(); onNewEvent(key) }}
            className={[
              'border-r border-b border-[hsl(var(--border))] last:border-r-0 p-1 cursor-pointer overflow-hidden select-none',
              'hover:bg-[hsl(var(--muted))]/30 transition-colors',
              !cell.current && 'bg-[hsl(var(--muted))]/20',
              isSelected && 'ring-1 ring-inset ring-violet-500',
            ].filter(Boolean).join(' ')}
          >
            <div className="flex justify-end mb-0.5">
              <span className={[
                'text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium',
                isToday ? 'bg-violet-600 text-white' : '',
                !cell.current
                  ? 'text-[hsl(var(--muted-foreground))] opacity-50'
                  : 'text-[hsl(var(--foreground))]',
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

export default function MonthView({ onEventClick, onDayClick, onNewEvent }) {
  const { selectedDate, setSelectedDate, activeCalendarIds, navigatePrev, navigateNext } = useCalendarStore()
  const ref = selectedDate || new Date().toISOString().slice(0, 10)
  const d = new Date(ref + 'T12:00:00')
  const targetYear  = d.getFullYear()
  const targetMonth = d.getMonth()

  const [current,   setCurrent]   = useState({ year: targetYear, month: targetMonth })
  const [prev,      setPrev]      = useState(null)
  const [direction, setDirection] = useState('next')
  const [animating, setAnimating] = useState(false)

  // ── Month transition ───────────────────────────────────────────────────────
  useEffect(() => {
    if (targetYear === current.year && targetMonth === current.month) return

    const isNext =
      targetYear > current.year ||
      (targetYear === current.year && targetMonth > current.month)

    setPrev({ ...current })
    setDirection(isNext ? 'next' : 'prev')
    setCurrent({ year: targetYear, month: targetMonth })
    setAnimating(true)

    const t = setTimeout(() => { setPrev(null); setAnimating(false) }, ANIM_DURATION)
    return () => clearTimeout(t)
  }, [targetYear, targetMonth])

  // ── Preload events for prev + current + next month ─────────────────────────
  // One wide query — eliminates per-grid fetches and cache misses during animation
  const fetchStart = new Date(current.year, current.month - 1, 1).toISOString()
  const fetchEnd   = new Date(current.year, current.month + 2, 0, 23, 59, 59).toISOString()
  const { data: allEvents = [] } = useCalendarEvents({
    start: fetchStart,
    end:   fetchEnd,
    calendarIds: activeCalendarIds,
  })
  const byDate = groupEventsByDate(allEvents)

  // Also preload for the prev animation grid (it's from the SAME wide query)
  const prevFetchStart = prev
    ? new Date(prev.year, prev.month - 1, 1).toISOString()
    : fetchStart
  const prevFetchEnd = prev
    ? new Date(prev.year, prev.month + 2, 0, 23, 59, 59).toISOString()
    : fetchEnd
  const { data: prevEvents = [] } = useCalendarEvents({
    start: prevFetchStart,
    end:   prevFetchEnd,
    calendarIds: activeCalendarIds,
  })
  const prevByDate = groupEventsByDate(prevEvents)

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleSelectDate(key) {
    setSelectedDate(key)
    onDayClick?.(key)
  }

  function handleNewEvent(dateStr) {
    onNewEvent?.(dateStr)
  }

  // ── Swipe gestures (mobile) ────────────────────────────────────────────────
  const touchStartY = useRef(null)
  const touchStartX = useRef(null)

  function onTouchStart(e) {
    touchStartY.current = e.touches[0].clientY
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e) {
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartY.current = null
    touchStartX.current = null
    // Only trigger if vertical dominates and exceeds threshold
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_THRESHOLD) {
      if (dy < 0) navigateNext()
      else        navigatePrev()
    }
  }

  // ── Wheel / trackpad (desktop) ─────────────────────────────────────────────
  const wheelAccum   = useRef(0)
  const wheelLast    = useRef(0)
  const gridRef      = useRef(null)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return

    function onWheel(e) {
      // Only capture vertical scrolls; ignore horizontal (trackpad horizontal pan)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()

      const now = Date.now()
      if (now - wheelLast.current < WHEEL_COOLDOWN) return

      wheelAccum.current += e.deltaY
      if (Math.abs(wheelAccum.current) >= WHEEL_THRESHOLD) {
        if (wheelAccum.current > 0) navigateNext()
        else                        navigatePrev()
        wheelAccum.current = 0
        wheelLast.current  = now
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [navigateNext, navigatePrev])

  // ── Render ─────────────────────────────────────────────────────────────────
  const inAnim  = direction === 'next' ? 'cal-slide-in-up'  : 'cal-slide-in-down'
  const outAnim = direction === 'next' ? 'cal-slide-out-up' : 'cal-slide-out-down'

  const gridCommonProps = {
    selectedDate,
    onSelectDate: handleSelectDate,
    onEventClick,
    onNewEvent: handleNewEvent,
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{SLIDE_CSS}</style>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] shrink-0">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="py-2 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))] last:border-r-0">
            {wd}
          </div>
        ))}
      </div>

      {/* Grid area */}
      <div ref={gridRef} className="flex-1 relative overflow-hidden">
        {/* Outgoing grid */}
        {animating && prev && (
          <div
            className="absolute inset-0 flex flex-col"
            style={{ animation: `${outAnim} ${ANIM_DURATION}ms cubic-bezier(0.4,0,0.2,1) forwards` }}
          >
            <MonthGrid year={prev.year} month={prev.month} byDate={prevByDate} {...gridCommonProps} />
          </div>
        )}

        {/* Incoming / current grid */}
        <div
          className="absolute inset-0 flex flex-col"
          style={animating ? { animation: `${inAnim} ${ANIM_DURATION}ms cubic-bezier(0.4,0,0.2,1) forwards` } : undefined}
        >
          <MonthGrid year={current.year} month={current.month} byDate={byDate} {...gridCommonProps} />
        </div>
      </div>
    </div>
  )
}

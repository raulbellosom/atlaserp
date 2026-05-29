# Atlas Calendar — Plan B: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **PREREQUISITE:** Plan A (`2026-05-29-atlas-calendar-plan-a-backend.md`) must be complete and the API must be running before implementing this plan.

> **NOTE:** This plan may require minor adjustments after Plan A is deployed and tested (field names, API response shapes). Verify actual API responses before writing fetch calls.

> **NOTE ON PLAN SPLITTING:** This plan is intentionally separate from Plan A. See memory `feedback_split_large_plans`.

**Goal:** Build the full `atlas.calendar` frontend — CalendarScreen with Day/Week/Month/Agenda views, collapsible sidebars, all modals, Zustand store, TanStack Query hooks, and notification badge.

**Architecture:** Single root screen `CalendarScreen.jsx` renders the active view. Zustand manages UI state (active view, selected date, sidebar visibility, active calendar filters). TanStack Query fetches events and calendars. All components in `apps/desktop/src/modules/atlas.calendar/`. Registered in `ModuleOutlet.jsx` via `SCREEN_MAP`.

**Tech Stack:** React, TanStack Query v5, Zustand, Tailwind CSS, lucide-react icons, date-fns (already in desktop dependencies)

**Spec:** `docs/superpowers/specs/2026-05-29-atlas-calendar-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx` | Create | Root layout: sidebars + toolbar + active view |
| `apps/desktop/src/modules/atlas.calendar/stores/useCalendarStore.js` | Create | Zustand: view, date, sidebars, active calendar IDs |
| `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js` | Create | TanStack Query hooks for calendars, events, notifications |
| `apps/desktop/src/modules/atlas.calendar/components/CalendarToolbar.jsx` | Create | Top nav: date navigation + view switcher + "+ Nuevo" |
| `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx` | Create | Mini calendar + calendar list with checkboxes |
| `apps/desktop/src/modules/atlas.calendar/components/CalendarRightSidebar.jsx` | Create | Day summary: events for selected date |
| `apps/desktop/src/modules/atlas.calendar/components/MonthView.jsx` | Create | 7×6 month grid |
| `apps/desktop/src/modules/atlas.calendar/components/WeekView.jsx` | Create | 7-column × 24-row time grid |
| `apps/desktop/src/modules/atlas.calendar/components/DayView.jsx` | Create | Single-column × 24-row time grid |
| `apps/desktop/src/modules/atlas.calendar/components/AgendaView.jsx` | Create | Infinite-scroll chronological list |
| `apps/desktop/src/modules/atlas.calendar/components/EventChip.jsx` | Create | Reusable event pill for all grid views |
| `apps/desktop/src/modules/atlas.calendar/components/EventDetailModal.jsx` | Create | Read-only event detail with actions |
| `apps/desktop/src/modules/atlas.calendar/components/EventFormModal.jsx` | Create | Create/edit event with all fields |
| `apps/desktop/src/modules/atlas.calendar/components/CalendarFormModal.jsx` | Create | Create/edit calendar name + color |
| `apps/desktop/src/modules/atlas.calendar/components/CalendarShareModal.jsx` | Create | Manage calendar shares |
| `apps/desktop/src/modules/atlas.calendar/components/MiniCalendar.jsx` | Create | Month mini-calendar for left sidebar |
| `apps/desktop/src/app/ModuleOutlet.jsx` | Modify | Register `atlas.calendar:/calendar` in SCREEN_MAP |

---

## Task 1: Zustand store

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/stores/useCalendarStore.js`

- [ ] **Step 1: Create the store**

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

export const useCalendarStore = create(
  persist(
    (set, get) => ({
      activeView: 'month',         // 'day' | 'week' | 'month' | 'agenda'
      selectedDate: todayDateString(), // 'YYYY-MM-DD'
      leftSidebarOpen: true,
      rightSidebarOpen: true,
      activeCalendarIds: [],       // empty = show all

      setActiveView: (view) => set({ activeView: view }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
      toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),

      toggleCalendarFilter: (id) => set((s) => {
        const active = s.activeCalendarIds
        if (active.includes(id)) return { activeCalendarIds: active.filter((x) => x !== id) }
        return { activeCalendarIds: [...active, id] }
      }),
      setAllCalendarsActive: () => set({ activeCalendarIds: [] }),

      navigatePrev: () => {
        const { activeView, selectedDate } = get()
        const d = new Date(selectedDate + 'T12:00:00')
        if (activeView === 'day') d.setDate(d.getDate() - 1)
        else if (activeView === 'week') d.setDate(d.getDate() - 7)
        else if (activeView === 'month') d.setMonth(d.getMonth() - 1)
        else if (activeView === 'agenda') d.setDate(d.getDate() - 7)
        set({ selectedDate: d.toISOString().slice(0, 10) })
      },

      navigateNext: () => {
        const { activeView, selectedDate } = get()
        const d = new Date(selectedDate + 'T12:00:00')
        if (activeView === 'day') d.setDate(d.getDate() + 1)
        else if (activeView === 'week') d.setDate(d.getDate() + 7)
        else if (activeView === 'month') d.setMonth(d.getMonth() + 1)
        else if (activeView === 'agenda') d.setDate(d.getDate() + 7)
        set({ selectedDate: d.toISOString().slice(0, 10) })
      },

      navigateToday: () => set({ selectedDate: todayDateString() }),
    }),
    { name: 'atlas-calendar-prefs', partialise: (s) => ({ activeView: s.activeView, leftSidebarOpen: s.leftSidebarOpen, rightSidebarOpen: s.rightSidebarOpen }) }
  )
)
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.calendar/stores/useCalendarStore.js
```

Expected: No output (clean)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/
git commit -m "feat(calendar): add useCalendarStore Zustand store"
```

---

## Task 2: TanStack Query hooks

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js`

- [ ] **Step 1: Create the hooks file**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Calendars ─────────────────────────────────────────────────────────────────

export function useCalendars() {
  const token = useToken()
  return useQuery({
    queryKey: ['calendar', 'calendars'],
    queryFn: () => apiFetch('/calendar/calendars', token),
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateCalendar() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiFetch('/calendar/calendars', token, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'calendars'] }),
  })
}

export function useUpdateCalendar() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiFetch(`/calendar/calendars/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'calendars'] }),
  })
}

export function useDeleteCalendar() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiFetch(`/calendar/calendars/${id}`, token, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'calendars'] }),
  })
}

export function useShareCalendar() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ calendarId, ...data }) =>
      apiFetch(`/calendar/calendars/${calendarId}/share`, token, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'calendars'] }),
  })
}

export function useUpdateShare() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ calendarId, shareId, ...data }) =>
      apiFetch(`/calendar/calendars/${calendarId}/share/${shareId}`, token, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'calendars'] }),
  })
}

export function useDeleteShare() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ calendarId, shareId }) =>
      apiFetch(`/calendar/calendars/${calendarId}/share/${shareId}`, token, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'calendars'] }),
  })
}

// ── Events ────────────────────────────────────────────────────────────────────

export function useCalendarEvents({ start, end, calendarIds = [] }) {
  const token = useToken()
  const params = new URLSearchParams({ start, end })
  calendarIds.forEach((id) => params.append('calendar_ids', id))
  return useQuery({
    queryKey: ['calendar', 'events', start, end, calendarIds.join(',')],
    queryFn: () => apiFetch(`/calendar/events?${params}`, token),
    enabled: Boolean(token && start && end),
    staleTime: 60 * 1000,
  })
}

export function useCreateEvent() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiFetch('/calendar/events', token, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'events'] }),
  })
}

export function useUpdateEvent() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiFetch(`/calendar/events/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'events'] }),
  })
}

export function useDeleteEvent() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiFetch(`/calendar/events/${id}`, token, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'events'] }),
  })
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function useCalendarNotifications() {
  const token = useToken()
  return useQuery({
    queryKey: ['calendar', 'notifications'],
    queryFn: () => apiFetch('/calendar/notifications?unread_only=true', token),
    enabled: Boolean(token),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  })
}

export function useMarkNotificationRead() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiFetch(`/calendar/notifications/${id}/read`, token, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/calendar/notifications/read-all', token, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'notifications'] }),
  })
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js
```

Expected: No output (clean)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/hooks/
git commit -m "feat(calendar): add TanStack Query hooks for calendar data"
```

---

## Task 3: EventChip component

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/components/EventChip.jsx`

- [ ] **Step 1: Create EventChip**

```jsx
export default function EventChip({ event, onClick, compact = false }) {
  const bg = event.color || event.calendar?.color || '#6B46C1'

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(event) }}
      title={event.title}
      className={[
        'w-full text-left rounded px-1.5 text-white font-medium truncate cursor-pointer',
        'hover:brightness-90 transition-all',
        compact ? 'text-[11px] py-px' : 'text-xs py-0.5',
      ].join(' ')}
      style={{ backgroundColor: bg }}
    >
      {!event.allDay && !compact && (
        <span className="opacity-80 mr-1">
          {new Date(event.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
      )}
      {event.title}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/EventChip.jsx
git commit -m "feat(calendar): add EventChip component"
```

---

## Task 4: MiniCalendar component

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/components/MiniCalendar.jsx`

- [ ] **Step 1: Create MiniCalendar**

```jsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, current: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true })
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) cells.push({ day: d, current: false })
  return cells
}

export default function MiniCalendar({ selectedDate, onSelectDate }) {
  const sel = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date()
  const [viewYear, setViewYear] = useState(sel.getFullYear())
  const [viewMonth, setViewMonth] = useState(sel.getMonth())

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const cells = buildCalendarDays(viewYear, viewMonth)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function handleSelect(cell) {
    if (!cell.current) return
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`
    onSelectDate?.(ds)
  }

  return (
    <div className="select-none px-2 pb-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-[hsl(var(--muted))]">
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-[hsl(var(--muted))]">
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {DAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-[hsl(var(--muted-foreground))] font-medium py-0.5">{d}</div>
        ))}
        {cells.map((cell, i) => {
          const ds = cell.current
            ? `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`
            : null
          const isSelected = ds === selectedDate
          const isToday = ds === todayStr
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(cell)}
              className={[
                'text-[11px] w-6 h-6 mx-auto rounded-full flex items-center justify-center transition-colors',
                !cell.current && 'text-[hsl(var(--muted-foreground))] opacity-40 cursor-default',
                cell.current && 'hover:bg-[hsl(var(--muted))] cursor-pointer',
                isSelected && 'bg-violet-600 text-white hover:bg-violet-700',
                isToday && !isSelected && 'text-violet-600 font-bold',
              ].filter(Boolean).join(' ')}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/MiniCalendar.jsx
git commit -m "feat(calendar): add MiniCalendar component"
```

---

## Task 5: CalendarToolbar + CalendarLeftSidebar + CalendarRightSidebar

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/components/CalendarToolbar.jsx`
- Create: `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`
- Create: `apps/desktop/src/modules/atlas.calendar/components/CalendarRightSidebar.jsx`

- [ ] **Step 1: Create CalendarToolbar.jsx**

```jsx
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
  if (view === 'day') return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (view === 'week') {
    const start = new Date(d); start.setDate(d.getDate() - d.getDay())
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
  }
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export default function CalendarToolbar({ onNewEvent }) {
  const { activeView, selectedDate, setActiveView, navigatePrev, navigateNext, navigateToday } = useCalendarStore()

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[hsl(var(--border))] shrink-0 bg-[hsl(var(--surface-1))]">
      <div className="flex items-center gap-1">
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

      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] capitalize min-w-[160px]">
        {formatTitle(activeView, selectedDate)}
      </h2>

      <button
        onClick={navigateToday}
        className="text-xs px-2.5 py-1 rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] ml-1"
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium ml-2"
      >
        <Plus size={14} />
        Nuevo
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create CalendarLeftSidebar.jsx**

```jsx
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

      <div className="flex-1 px-3 pt-3 space-y-4">
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Mis calendarios
            </span>
            <button onClick={onNewCalendar} className="p-0.5 rounded hover:bg-[hsl(var(--muted))]">
              <Plus size={12} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          </div>

          {isLoading && <div className="text-xs text-[hsl(var(--muted-foreground))]">Cargando...</div>}

          {owned.map((cal) => (
            <label key={cal.id} className="flex items-center gap-2 py-0.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={isActive(cal.id)}
                onChange={() => toggleCalendarFilter(cal.id)}
                className="sr-only"
              />
              <span
                className="w-3 h-3 rounded-sm shrink-0 border-2 flex items-center justify-center"
                style={{ borderColor: cal.color, backgroundColor: isActive(cal.id) ? cal.color : 'transparent' }}
              >
                {isActive(cal.id) && <span className="text-white text-[8px]">✓</span>}
              </span>
              <span className="text-xs text-[hsl(var(--foreground))] truncate">{cal.name}</span>
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
                <input
                  type="checkbox"
                  checked={isActive(cal.id)}
                  onChange={() => toggleCalendarFilter(cal.id)}
                  className="sr-only"
                />
                <span
                  className="w-3 h-3 rounded-sm shrink-0 border-2 flex items-center justify-center"
                  style={{ borderColor: cal.color, backgroundColor: isActive(cal.id) ? cal.color : 'transparent' }}
                >
                  {isActive(cal.id) && <span className="text-white text-[8px]">✓</span>}
                </span>
                <span className="text-xs text-[hsl(var(--foreground))] truncate">{cal.name}</span>
              </label>
            ))}
          </section>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Create CalendarRightSidebar.jsx**

```jsx
import { Calendar, Plus } from 'lucide-react'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarEvents } from '../hooks/useCalendarData'

const WEEKDAYS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function CalendarRightSidebar({ onNewEvent }) {
  const { selectedDate, activeCalendarIds } = useCalendarStore()
  const d = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date()

  const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999)

  const { data: events = [] } = useCalendarEvents({
    start: dayStart.toISOString(),
    end: dayEnd.toISOString(),
    calendarIds: activeCalendarIds,
  })

  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()

  return (
    <aside className="w-56 shrink-0 flex flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]">
      <div className="p-4 border-b border-[hsl(var(--border))]">
        <div className={['text-4xl font-light', isToday ? 'text-violet-600' : 'text-[hsl(var(--foreground))]'].join(' ')}>
          {d.getDate()}
        </div>
        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 capitalize">
          {WEEKDAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getFullYear()}
        </div>
        {isToday && (
          <div className="text-xs text-violet-500 font-medium mt-0.5">Hoy</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <Calendar size={28} className="text-[hsl(var(--muted-foreground))] opacity-40" />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin eventos</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] opacity-60">No hay eventos programados</p>
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-lg p-2 text-xs"
              style={{ backgroundColor: (ev.color || ev.calendar?.color || '#6B46C1') + '20', borderLeft: `3px solid ${ev.color || ev.calendar?.color || '#6B46C1'}` }}
            >
              <div className="font-medium text-[hsl(var(--foreground))] truncate">{ev.title}</div>
              {!ev.allDay && (
                <div className="text-[hsl(var(--muted-foreground))] mt-0.5">
                  {new Date(ev.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  {ev.endAt && ` – ${new Date(ev.endAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-[hsl(var(--border))]">
        <button
          onClick={onNewEvent}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] hover:border-violet-500 hover:text-violet-500 transition-colors"
        >
          <Plus size={12} />
          Crear evento
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/
git commit -m "feat(calendar): add CalendarToolbar, CalendarLeftSidebar, CalendarRightSidebar"
```

---

## Task 6: MonthView

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/components/MonthView.jsx`

- [ ] **Step 1: Create MonthView.jsx**

```jsx
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarEvents } from '../hooks/useCalendarData'
import EventChip from './EventChip'

const WEEKDAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevDays - i)
    cells.push({ date: d, current: false })
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), current: true })
  while (cells.length < 42) {
    const d = new Date(year, month + 1, cells.length - daysInMonth - firstDay + 1)
    cells.push({ date: d, current: false })
  }
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
      <div className="grid grid-cols-7 border-b border-[hsl(var(--border))]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))] last:border-r-0">
            {d}
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
                'border-r border-b border-[hsl(var(--border))] last:border-r-0 p-1 cursor-pointer',
                'hover:bg-[hsl(var(--muted))]/50 transition-colors',
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/MonthView.jsx
git commit -m "feat(calendar): add MonthView component"
```

---

## Task 7: WeekView and DayView

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/components/WeekView.jsx`
- Create: `apps/desktop/src/modules/atlas.calendar/components/DayView.jsx`

- [ ] **Step 1: Create WeekView.jsx**

```jsx
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarEvents } from '../hooks/useCalendarData'
import EventChip from './EventChip'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const start = new Date(d); start.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(start); x.setDate(start.getDate() + i); return x })
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
    start: rangeStart.toISOString(), end: rangeEnd.toISOString(), calendarIds: activeCalendarIds
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
      {/* Header */}
      <div className="grid border-b border-[hsl(var(--border))]" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        <div className="border-r border-[hsl(var(--border))]" />
        {days.map((day) => {
          const dk = dateKey(day)
          const isToday = dk === todayKey
          const allDay = allDayEventsForDay(day)
          return (
            <div key={dk} onClick={() => setSelectedDate(dk)} className="border-r border-[hsl(var(--border))] last:border-r-0 p-1 cursor-pointer hover:bg-[hsl(var(--muted))]/50">
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
            <div className="border-r border-[hsl(var(--border))] px-1 pt-0.5">
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
```

- [ ] **Step 2: Create DayView.jsx**

```jsx
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
        <div className="border-b border-[hsl(var(--border))] p-2 space-y-1">
          <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold mb-1">Todo el dia</div>
          {allDayEvents.map(ev => <EventChip key={ev.id} event={ev} onClick={onEventClick} compact />)}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const hourEvents = timedEvents.filter(ev => new Date(ev.startAt).getHours() === hour)
          return (
            <div key={hour} className="flex border-b border-[hsl(var(--border))]/50 min-h-[56px]">
              <div className="w-14 shrink-0 px-2 pt-1 border-r border-[hsl(var(--border))]">
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/WeekView.jsx apps/desktop/src/modules/atlas.calendar/components/DayView.jsx
git commit -m "feat(calendar): add WeekView and DayView components"
```

---

## Task 8: AgendaView (infinite scroll)

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/components/AgendaView.jsx`

- [ ] **Step 1: Create AgendaView.jsx**

```jsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { CalendarX } from 'lucide-react'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarEvents } from '../hooks/useCalendarData'
import EventChip from './EventChip'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const WEEKDAYS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function addWeeks(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

function groupByDate(events) {
  const map = {}
  for (const ev of events) {
    const k = dateKey(new Date(ev.startAt))
    if (!map[k]) map[k] = []
    map[k].push(ev)
  }
  return map
}

export default function AgendaView({ onEventClick }) {
  const { selectedDate, activeCalendarIds } = useCalendarStore()
  const [weeksLoaded, setWeeksLoaded] = useState(2)
  const bottomRef = useRef(null)

  const base = selectedDate || new Date().toISOString().slice(0, 10)
  const rangeEnd = addWeeks(base, weeksLoaded)

  const { data: events = [], isFetching } = useCalendarEvents({
    start: new Date(base + 'T00:00:00').toISOString(),
    end: new Date(rangeEnd + 'T23:59:59').toISOString(),
    calendarIds: activeCalendarIds,
  })

  const byDate = groupByDate(events)
  const today = new Date()

  // Build day entries from base to rangeEnd
  const days = []
  const cursor = new Date(base + 'T12:00:00')
  const end = new Date(rangeEnd + 'T12:00:00')
  while (cursor <= end) {
    const k = dateKey(cursor)
    if (byDate[k]?.length) days.push({ key: k, date: new Date(cursor), events: byDate[k] })
    cursor.setDate(cursor.getDate() + 1)
  }

  const loadMore = useCallback(() => {
    if (!isFetching) setWeeksLoaded(w => w + 2)
  }, [isFetching])

  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore() }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  if (!isFetching && days.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
        <CalendarX size={36} className="text-[hsl(var(--muted-foreground))] opacity-40" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin eventos proximos</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">
      {days.map(({ key, date, events: dayEvents }) => {
        const isToday = dateKey(today) === key
        return (
          <div key={key} className="flex gap-4">
            <div className="w-16 shrink-0 pt-1 text-right">
              <div className={['text-xl font-semibold leading-none', isToday ? 'text-violet-600' : 'text-[hsl(var(--foreground))]'].join(' ')}>
                {date.getDate()}
              </div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] capitalize mt-0.5">
                {WEEKDAYS[date.getDay()].slice(0, 3)}
              </div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {MONTHS[date.getMonth()].slice(0, 3)}
              </div>
            </div>
            <div className="flex-1 space-y-1.5 border-l border-[hsl(var(--border))] pl-4">
              {dayEvents.map(ev => <EventChip key={ev.id} event={ev} onClick={onEventClick} />)}
            </div>
          </div>
        )
      })}

      <div ref={bottomRef} className="py-4 text-center">
        {isFetching && <span className="text-xs text-[hsl(var(--muted-foreground))]">Cargando...</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/AgendaView.jsx
git commit -m "feat(calendar): add AgendaView with infinite scroll"
```

---

## Task 9: EventDetailModal

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/components/EventDetailModal.jsx`

- [ ] **Step 1: Create EventDetailModal.jsx**

```jsx
import { X, MapPin, Video, Calendar, Clock, Users, Repeat, Edit2, Trash2 } from 'lucide-react'
import { useDeleteEvent } from '../hooks/useCalendarData'
import { toast } from 'sonner'

const STATUS_LABELS = { PENDING: 'Pendiente', ACCEPTED: 'Aceptado', DECLINED: 'Rechazado' }

export default function EventDetailModal({ event, onClose, onEdit, canEdit, canDelete }) {
  const deleteEvent = useDeleteEvent()

  if (!event) return null

  const calColor = event.color || event.calendar?.color || '#6B46C1'

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este evento?')) return
    try {
      await deleteEvent.mutateAsync(event.id)
      toast.success('Evento eliminado')
      onClose()
    } catch (err) {
      toast.error(err.message || 'Error al eliminar el evento')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color header */}
        <div className="h-2" style={{ backgroundColor: calColor }} />

        {/* Toolbar */}
        <div className="flex items-center justify-end gap-1 px-4 pt-3">
          {canEdit && (
            <button onClick={() => onEdit(event)} className="p-1.5 rounded hover:bg-[hsl(var(--muted))]">
              <Edit2 size={15} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="p-1.5 rounded hover:bg-[hsl(var(--muted))]">
              <Trash2 size={15} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))]">
            <X size={15} className="text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">{event.title}</h2>

          {event.description && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{event.description}</p>
          )}

          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <Clock size={14} className="text-[hsl(var(--muted-foreground))] mt-0.5 shrink-0" />
              <div className="text-sm text-[hsl(var(--foreground))]">
                {event.allDay ? (
                  <span>{new Date(event.startAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                ) : (
                  <>
                    <div>{new Date(event.startAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                    <div className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">
                      {new Date(event.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      {event.endAt && ` – ${new Date(event.endAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                    </div>
                  </>
                )}
              </div>
            </div>

            {event.location && (
              <div className="flex items-center gap-2.5">
                <MapPin size={14} className="text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))]">{event.location}</span>
              </div>
            )}

            {event.videoUrl && (
              <div className="flex items-center gap-2.5">
                <Video size={14} className="text-[hsl(var(--muted-foreground))] shrink-0" />
                <a href={event.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-500 hover:underline truncate">
                  Unirse a la videollamada
                </a>
              </div>
            )}

            {event.calendar && (
              <div className="flex items-center gap-2.5">
                <Calendar size={14} className="text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))]">{event.calendar.name}</span>
              </div>
            )}

            {event.recurrenceRule && (
              <div className="flex items-center gap-2.5">
                <Repeat size={14} className="text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {event.recurrenceRule.freq === 'DAILY' && 'Diario'}
                  {event.recurrenceRule.freq === 'WEEKLY' && 'Semanal'}
                  {event.recurrenceRule.freq === 'MONTHLY' && 'Mensual'}
                  {event.recurrenceRule.interval > 1 && ` cada ${event.recurrenceRule.interval}`}
                </span>
              </div>
            )}

            {event.attendees?.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Users size={14} className="text-[hsl(var(--muted-foreground))] mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  {event.attendees.map((att) => (
                    <div key={att.id} className="flex items-center gap-1.5">
                      <span className="text-sm text-[hsl(var(--foreground))]">
                        {att.user?.firstName} {att.user?.lastName}
                      </span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {STATUS_LABELS[att.status] ?? att.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/EventDetailModal.jsx
git commit -m "feat(calendar): add EventDetailModal component"
```

---

## Task 10: EventFormModal

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/components/EventFormModal.jsx`

- [ ] **Step 1: Create EventFormModal.jsx**

```jsx
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useCreateEvent, useUpdateEvent, useCalendars } from '../hooks/useCalendarData'
import { toast } from 'sonner'

const FREQ_OPTIONS = [
  { value: '', label: 'Sin repeticion' },
  { value: 'DAILY', label: 'Diario' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensual' },
]

function toLocalDatetimeValue(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EventFormModal({ event, defaultDate, defaultCalendarId, onClose, onSaved }) {
  const isEdit = Boolean(event?.id)
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const { data: calData } = useCalendars()
  const allCalendars = [...(calData?.owned ?? []), ...(calData?.shared ?? [])]

  const [form, setForm] = useState({
    title: '',
    description: '',
    calendarId: defaultCalendarId || '',
    startAt: defaultDate ? `${defaultDate}T09:00` : toLocalDatetimeValue(new Date().toISOString()),
    endAt: defaultDate ? `${defaultDate}T10:00` : '',
    allDay: false,
    location: '',
    videoUrl: '',
    color: '',
    recurrenceFreq: '',
    recurrenceInterval: 1,
  })

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title ?? '',
        description: event.description ?? '',
        calendarId: event.calendarId ?? '',
        startAt: toLocalDatetimeValue(event.startAt),
        endAt: toLocalDatetimeValue(event.endAt),
        allDay: event.allDay ?? false,
        location: event.location ?? '',
        videoUrl: event.videoUrl ?? '',
        color: event.color ?? '',
        recurrenceFreq: event.recurrenceRule?.freq ?? '',
        recurrenceInterval: event.recurrenceRule?.interval ?? 1,
      })
    }
    if (!form.calendarId && allCalendars.length > 0) {
      setForm(f => ({ ...f, calendarId: allCalendars[0].id }))
    }
  }, [event])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('El titulo es requerido'); return }
    if (!form.calendarId) { toast.error('Selecciona un calendario'); return }

    const recurrenceRule = form.recurrenceFreq
      ? { freq: form.recurrenceFreq, interval: Number(form.recurrenceInterval) || 1 }
      : null

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      calendarId: form.calendarId,
      startAt: new Date(form.startAt).toISOString(),
      endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      allDay: form.allDay,
      location: form.location.trim() || null,
      videoUrl: form.videoUrl.trim() || null,
      color: form.color || null,
      recurrenceRule,
    }

    try {
      if (isEdit) {
        await updateEvent.mutateAsync({ id: event.id, ...payload })
        toast.success('Evento actualizado')
      } else {
        await createEvent.mutateAsync(payload)
        toast.success('Evento creado')
      }
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Error al guardar el evento')
    }
  }

  const isPending = createEvent.isPending || updateEvent.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
            {isEdit ? 'Editar evento' : 'Nuevo evento'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))]">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <input
            type="text"
            placeholder="Titulo del evento"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full text-base font-medium bg-transparent border-b border-[hsl(var(--border))] pb-2 outline-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Inicio *</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? form.startAt.slice(0,10) : form.startAt}
                onChange={(e) => set('startAt', e.target.value)}
                className="w-full text-xs rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Fin</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? (form.endAt?.slice(0,10) ?? '') : form.endAt}
                onChange={(e) => set('endAt', e.target.value)}
                className="w-full text-xs rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />
            <span className="text-sm text-[hsl(var(--foreground))]">Todo el dia</span>
          </label>

          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Calendario *</label>
            <select
              value={form.calendarId}
              onChange={(e) => set('calendarId', e.target.value)}
              className="w-full text-sm rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
              required
            >
              <option value="">Seleccionar...</option>
              {allCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <textarea
            placeholder="Descripcion (opcional)"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className="w-full text-sm rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none resize-none"
          />

          <input
            type="text"
            placeholder="Ubicacion"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            className="w-full text-sm rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
          />

          <input
            type="url"
            placeholder="URL videollamada"
            value={form.videoUrl}
            onChange={(e) => set('videoUrl', e.target.value)}
            className="w-full text-sm rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
          />

          <div>
            <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Repeticion</label>
            <select
              value={form.recurrenceFreq}
              onChange={(e) => set('recurrenceFreq', e.target.value)}
              className="w-full text-sm rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
            >
              {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[hsl(var(--border))]">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear evento'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/EventFormModal.jsx
git commit -m "feat(calendar): add EventFormModal component"
```

---

## Task 11: CalendarFormModal + CalendarShareModal

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/components/CalendarFormModal.jsx`
- Create: `apps/desktop/src/modules/atlas.calendar/components/CalendarShareModal.jsx`

- [ ] **Step 1: Create CalendarFormModal.jsx**

```jsx
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useCreateCalendar, useUpdateCalendar } from '../hooks/useCalendarData'
import { toast } from 'sonner'

const COLORS = ['#6B46C1','#2563EB','#16A34A','#DC2626','#D97706','#DB2777','#0891B2','#7C3AED']

export default function CalendarFormModal({ calendar, onClose }) {
  const isEdit = Boolean(calendar?.id)
  const createCalendar = useCreateCalendar()
  const updateCalendar = useUpdateCalendar()
  const [name, setName] = useState(calendar?.name ?? '')
  const [color, setColor] = useState(calendar?.color ?? COLORS[0])

  useEffect(() => {
    if (calendar) { setName(calendar.name); setColor(calendar.color) }
  }, [calendar])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { toast.error('El nombre es requerido'); return }
    try {
      if (isEdit) { await updateCalendar.mutateAsync({ id: calendar.id, name: name.trim(), color }); toast.success('Calendario actualizado') }
      else { await createCalendar.mutateAsync({ name: name.trim(), color }); toast.success('Calendario creado') }
      onClose()
    } catch (err) { toast.error(err.message || 'Error al guardar') }
  }

  const isPending = createCalendar.isPending || updateCalendar.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-base font-semibold">{isEdit ? 'Editar calendario' : 'Nuevo calendario'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))]"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <input
            type="text"
            placeholder="Nombre del calendario"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm rounded-lg border border-[hsl(var(--border))] px-3 py-2 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
            required
          />
          <div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Color</div>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={['w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-white scale-110 shadow-md' : 'border-transparent'].join(' ')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[hsl(var(--border))]">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">Cancelar</button>
          <button type="submit" disabled={isPending} className="px-4 py-1.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50">
            {isPending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create CalendarShareModal.jsx**

```jsx
import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useShareCalendar, useUpdateShare, useDeleteShare } from '../hooks/useCalendarData'
import { toast } from 'sonner'

const ROLES = [
  { value: 'VIEWER', label: 'Solo ver' },
  { value: 'EDITOR', label: 'Editar eventos' },
  { value: 'MANAGER', label: 'Gestionar todo' },
]

export default function CalendarShareModal({ calendar, onClose }) {
  const shareCalendar = useShareCalendar()
  const updateShare = useUpdateShare()
  const deleteShare = useDeleteShare()
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('VIEWER')

  const shares = calendar?.shares ?? []

  async function handleAdd(e) {
    e.preventDefault()
    if (!userId.trim()) { toast.error('Ingresa un ID de usuario'); return }
    try {
      await shareCalendar.mutateAsync({ calendarId: calendar.id, userId: userId.trim(), role })
      toast.success('Acceso compartido')
      setUserId('')
    } catch (err) { toast.error(err.message || 'Error al compartir') }
  }

  async function handleRoleChange(shareId, newRole) {
    try {
      await updateShare.mutateAsync({ calendarId: calendar.id, shareId, role: newRole })
      toast.success('Rol actualizado')
    } catch (err) { toast.error(err.message || 'Error') }
  }

  async function handleRevoke(shareId) {
    try {
      await deleteShare.mutateAsync({ calendarId: calendar.id, shareId })
      toast.success('Acceso revocado')
    } catch (err) { toast.error(err.message || 'Error') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-base font-semibold">Compartir "{calendar?.name}"</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))]"><X size={15} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              placeholder="ID de usuario"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="flex-1 text-sm rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
            />
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="text-sm rounded-lg border border-[hsl(var(--border))] px-2 py-1.5 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button type="submit" disabled={shareCalendar.isPending} className="px-3 py-1.5 text-sm rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50">
              Invitar
            </button>
          </form>

          {shares.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Accesos actuales</div>
              {shares.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-[hsl(var(--foreground))] truncate">
                    {s.user?.firstName ?? s.userId}
                  </span>
                  <select
                    value={s.role}
                    onChange={(e) => handleRoleChange(s.id, e.target.value)}
                    className="text-xs rounded border border-[hsl(var(--border))] px-1.5 py-1 bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))] outline-none"
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <button onClick={() => handleRevoke(s.id)} className="p-1 rounded hover:bg-[hsl(var(--muted))]">
                    <Trash2 size={13} className="text-[hsl(var(--muted-foreground))]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/CalendarFormModal.jsx apps/desktop/src/modules/atlas.calendar/components/CalendarShareModal.jsx
git commit -m "feat(calendar): add CalendarFormModal and CalendarShareModal"
```

---

## Task 12: CalendarScreen root layout

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx`

- [ ] **Step 1: Create CalendarScreen.jsx**

```jsx
import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useCalendarStore } from '../stores/useCalendarStore'
import CalendarToolbar from '../components/CalendarToolbar'
import CalendarLeftSidebar from '../components/CalendarLeftSidebar'
import CalendarRightSidebar from '../components/CalendarRightSidebar'
import MonthView from '../components/MonthView'
import WeekView from '../components/WeekView'
import DayView from '../components/DayView'
import AgendaView from '../components/AgendaView'
import EventDetailModal from '../components/EventDetailModal'
import EventFormModal from '../components/EventFormModal'
import CalendarFormModal from '../components/CalendarFormModal'

export default function CalendarScreen() {
  const {
    activeView,
    selectedDate,
    setSelectedDate,
    leftSidebarOpen,
    rightSidebarOpen,
    toggleLeftSidebar,
    toggleRightSidebar,
  } = useCalendarStore()

  const [detailEvent, setDetailEvent] = useState(null)
  const [formEvent, setFormEvent] = useState(null)  // null=closed, {}=new, {id,...}=edit
  const [showCalendarForm, setShowCalendarForm] = useState(false)

  function openNewEvent() {
    setFormEvent({ _isNew: true })
  }

  function openEditEvent(event) {
    setDetailEvent(null)
    setFormEvent(event)
  }

  function handleDayClick(dateStr) {
    setSelectedDate(dateStr)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[hsl(var(--surface-1))]">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
        <button
          onClick={toggleLeftSidebar}
          className="p-2 ml-2 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
          title={leftSidebarOpen ? 'Ocultar sidebar' : 'Mostrar sidebar'}
        >
          {leftSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>
        <div className="flex-1">
          <CalendarToolbar onNewEvent={openNewEvent} />
        </div>
        <button
          onClick={toggleRightSidebar}
          className="p-2 mr-2 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
          title={rightSidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
        >
          {rightSidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {leftSidebarOpen && (
          <CalendarLeftSidebar onNewCalendar={() => setShowCalendarForm(true)} />
        )}

        <div className="flex-1 flex overflow-hidden">
          {activeView === 'month' && (
            <MonthView onEventClick={setDetailEvent} onDayClick={handleDayClick} />
          )}
          {activeView === 'week' && (
            <WeekView onEventClick={setDetailEvent} />
          )}
          {activeView === 'day' && (
            <DayView onEventClick={setDetailEvent} />
          )}
          {activeView === 'agenda' && (
            <AgendaView onEventClick={setDetailEvent} />
          )}
        </div>

        {rightSidebarOpen && (
          <CalendarRightSidebar onNewEvent={openNewEvent} />
        )}
      </div>

      {/* Modals */}
      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onEdit={openEditEvent}
          canEdit
          canDelete
        />
      )}

      {formEvent !== null && (
        <EventFormModal
          event={formEvent._isNew ? undefined : formEvent}
          defaultDate={selectedDate}
          onClose={() => setFormEvent(null)}
          onSaved={() => setFormEvent(null)}
        />
      )}

      {showCalendarForm && (
        <CalendarFormModal onClose={() => setShowCalendarForm(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/screens/
git commit -m "feat(calendar): add CalendarScreen root layout"
```

---

## Task 13: Register in ModuleOutlet + verify in browser

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1: Add atlas.calendar entries to SCREEN_MAP**

Open `apps/desktop/src/app/ModuleOutlet.jsx`. Find the `SCREEN_MAP` object and add before the closing `}`:

```js
  "atlas.calendar:/calendar": lazy(
    () => import("../modules/atlas.calendar/screens/CalendarScreen.jsx"),
  ),
  "atlas.calendar:/": lazy(
    () => import("../modules/atlas.calendar/screens/CalendarScreen.jsx"),
  ),
```

- [ ] **Step 2: Start dev server and verify**

```bash
pnpm dev
```

Navigate to `/app/m/atlas.calendar/calendar` in the browser.

Expected:
- Calendar module appears in the navigation sidebar
- CalendarScreen renders with toolbar, left sidebar (mini calendar + "Mis calendarios"), right sidebar (day summary)
- Clicking "+ Nuevo" opens EventFormModal
- Clicking a day in MonthView selects it and shows events in right sidebar
- Switching views (Dia/Semana/Mes/Agenda) works
- Sidebars collapse/expand with the toggle buttons

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(calendar): register atlas.calendar screens in ModuleOutlet"
```

---

## Verification checklist

After all tasks complete, manually verify:

- [ ] Calendar module appears in navigation with "Calendario" label and Calendar icon
- [ ] Mes view: days visible, events appear as colored chips, clicking a day selects it
- [ ] Semana view: 7-column grid with hourly slots, events in correct slots
- [ ] Dia view: single column, all-day events at top, timed events in correct hour rows
- [ ] Agenda view: events listed chronologically, scroll loads more weeks
- [ ] Left sidebar: mini calendar navigates correctly, calendar checkboxes filter events
- [ ] Right sidebar: shows events for selected date, "+ Crear evento" opens form
- [ ] EventFormModal: can create event with title + date + calendar, appears in view after save
- [ ] EventDetailModal: shows event fields, edit button opens form, delete removes event
- [ ] CalendarFormModal: creates new calendar, appears in left sidebar list
- [ ] Toolbar navigation: prev/next/Hoy change the visible month/week/day

---

## Notes for post-Plan-A adjustments

After Plan A is deployed, verify:

1. **API response field names** — confirm `calendarId`, `startAt`, `endAt`, `allDay` match exactly what the API returns (check with `GET /calendar/events`)
2. **Calendar list shape** — confirm `data.owned` and `data.shared` are the exact keys returned by `GET /calendar/calendars`
3. **Auth context** — confirm `c.get('userContext')?.profile?.id` in the API maps to the same user referenced in frontend hooks
4. **Shares on calendar response** — `CalendarShareModal` expects `calendar.shares` array; confirm the `GET /calendar/calendars` response includes shares for owned calendars

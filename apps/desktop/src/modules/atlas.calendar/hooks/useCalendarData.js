import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig'
import { useOfflineContext, useOfflineStore } from '@atlas/offline'

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
  const ctx = useOfflineContext()
  const isOnline = useOfflineStore((s) => s.isOnline)
  return useQuery({
    queryKey: ['calendar', 'calendars'],
    queryFn: async () => {
      if (!isOnline) {
        const db = ctx?.dbRef?.current
        if (!db) return { owned: [], shared: [] }
        const records = await db.offline_records
          .where('moduleKey').equals('atlas.calendar')
          .filter((r) => r.entityType === 'calendar')
          .toArray()
        // Shared calendars are not cached in Tier 2; only owned calendars are pulled
        return { owned: records.map((r) => r.data), shared: [] }
      }
      return apiFetch('/calendar/calendars', token)
    },
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
  const ctx = useOfflineContext()
  const isOnline = useOfflineStore((s) => s.isOnline)
  const params = new URLSearchParams()
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  calendarIds.forEach((id) => params.append('calendar_ids', id))
  return useQuery({
    queryKey: ['calendar', 'events', start, end, calendarIds.join(',')],
    queryFn: async () => {
      if (!isOnline) {
        const db = ctx?.dbRef?.current
        if (!db) return []
        const startMs = start ? new Date(start).getTime() : null
        const endMs = end ? new Date(end).getTime() : null
        const records = await db.offline_records
          .where('moduleKey').equals('atlas.calendar')
          .filter((r) => r.entityType === 'event')
          .toArray()
        return records
          .map((r) => r.data)
          .filter((ev) => {
            if (calendarIds.length && !calendarIds.includes(ev.calendarId)) return false
            const evMs = new Date(ev.startAt).getTime()
            if (startMs !== null && evMs < startMs) return false
            if (endMs !== null && evMs > endMs) return false
            return true
          })
      }
      return apiFetch(`/calendar/events?${params}`, token)
    },
    enabled: Boolean(token && start && end),
    staleTime: 60 * 1000,
  })
}

// Year-level events — stable query key prevents cache misses when navigating months
export function useYearEvents(year, calendarIds = [], enabled = true) {
  const token = useToken()
  const ctx = useOfflineContext()
  const isOnline = useOfflineStore((s) => s.isOnline)
  const params = new URLSearchParams()
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31, 23, 59, 59)
  params.set('start', yearStart.toISOString())
  params.set('end', yearEnd.toISOString())
  calendarIds.forEach((id) => params.append('calendar_ids', id))
  return useQuery({
    queryKey: ['calendar', 'events', 'year', year, calendarIds.join(',')],
    queryFn: async () => {
      if (!isOnline) {
        const db = ctx?.dbRef?.current
        if (!db) return []
        const startMs = yearStart.getTime()
        const endMs = yearEnd.getTime()
        const records = await db.offline_records
          .where('moduleKey').equals('atlas.calendar')
          .filter((r) => r.entityType === 'event')
          .toArray()
        return records
          .map((r) => r.data)
          .filter((ev) => {
            if (calendarIds.length && !calendarIds.includes(ev.calendarId)) return false
            const evMs = new Date(ev.startAt).getTime()
            return evMs >= startMs && evMs <= endMs
          })
      }
      return apiFetch(`/calendar/events?${params}`, token)
    },
    enabled: Boolean(token && enabled),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}

// User search for the calendar share combobox
export function useUserSearch(query) {
  const token = useToken()
  const q = query.trim()
  return useQuery({
    queryKey: ['identity', 'users', 'search', q],
    queryFn: () => apiFetch(`/identity/users?search=${encodeURIComponent(q)}&pageSize=10&enabled=true`, token),
    enabled: Boolean(token && q.length >= 2),
    staleTime: 30 * 1000,
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

export function useCalendarEvent(eventId, enabled = true) {
  const token = useToken()
  return useQuery({
    queryKey: ['calendar', 'event', eventId],
    queryFn: () => apiFetch(`/calendar/events/${eventId}`, token),
    enabled: Boolean(token && eventId && enabled),
    staleTime: 30 * 1000,
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

export function useAddEventReminder() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, minutesBefore }) =>
      apiFetch(`/calendar/events/${eventId}/reminders`, token, {
        method: 'POST',
        body: JSON.stringify({ minutes_before: minutesBefore }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['calendar', 'events'] })
      qc.invalidateQueries({ queryKey: ['calendar', 'event', vars?.eventId] })
    },
  })
}

export function useDeleteEventReminder() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, reminderId }) =>
      apiFetch(`/calendar/events/${eventId}/reminders/${reminderId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['calendar', 'events'] })
      qc.invalidateQueries({ queryKey: ['calendar', 'event', vars?.eventId] })
    },
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

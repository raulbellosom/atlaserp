import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { getSupabaseClient } from '../lib/supabase'

const RealtimeContext = createContext(null)

export function RealtimeProvider({ children }) {
  const { userProfile, session } = useAuth()
  const queryClient = useQueryClient()
  const listenersRef = useRef({})
  const [onlineUsers, setOnlineUsers] = useState({})
  const [lastSeenMap, setLastSeenMap] = useState({})

  // Stable `on` — registers a handler for a named broadcast event.
  // Returns an unsubscribe function. Safe to call before channels open.
  const on = useCallback((event, handler) => {
    if (!listenersRef.current[event]) listenersRef.current[event] = new Set()
    listenersRef.current[event].add(handler)
    return () => listenersRef.current[event]?.delete(handler)
  }, [])

  function dispatch(event, payload) {
    listenersRef.current[event]?.forEach((h) => {
      try { h(payload) } catch {}
    })
  }

  // User events channel — receives broadcasts sent by the API after writes
  useEffect(() => {
    if (!userProfile?.id || !session?.access_token) return
    const client = getSupabaseClient()
    const channel = client
      .channel(`user:${userProfile.id}:events`)
      .on('broadcast', { event: 'notification.new' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        dispatch('notification.new', payload)
      })
      .on('broadcast', { event: 'chat.message.new' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
        dispatch('chat.message.new', payload)
      })
      .on('broadcast', { event: 'chat.conversation.new' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
        dispatch('chat.conversation.new', payload)
      })
      .on('broadcast', { event: 'projects.task.updated' }, ({ payload }) => {
        dispatch('projects.task.updated', payload)
      })
      .subscribe()

    return () => { client.removeChannel(channel) }
  // session?.access_token intentionally omitted: Supabase manages auth for
  // Realtime internally; including it here re-opens the channel on every
  // token refresh (~60min) and drops broadcasts during the transition window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id, queryClient])

  // Company presence channel — tracks who is online across the whole company
  useEffect(() => {
    if (!userProfile?.id || !userProfile?.companyId) return
    const client = getSupabaseClient()

    const channel = client
      .channel(`company:${userProfile.companyId}:presence`, {
        config: { presence: { key: userProfile.id } },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const next = {}
        Object.entries(state).forEach(([, presences]) => {
          const p = presences?.[0]
          if (p?.userId) next[p.userId] = p
        })
        setOnlineUsers(next)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const now = new Date()
        setLastSeenMap((prev) => {
          const next = { ...prev }
          leftPresences.forEach((p) => { if (p?.userId) next[p.userId] = now })
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: userProfile.id,
            displayName: userProfile.displayName ?? userProfile.email ?? userProfile.id,
            status: 'online',
          })
        }
      })

    return () => { client.removeChannel(channel) }
  }, [userProfile?.id, userProfile?.companyId, userProfile?.displayName, userProfile?.email])

  // Company events channel — receives broadcast events for POS, Calendar, and other company-wide modules
  useEffect(() => {
    if (!userProfile?.id || !userProfile?.companyId) return
    const client = getSupabaseClient()
    const channel = client
      .channel(`company:${userProfile.companyId}:events`)
      .on('broadcast', { event: 'pos.order.updated' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pos'] })
      })
      .on('broadcast', { event: 'calendar.event.updated' }, () => {
        queryClient.invalidateQueries({ queryKey: ['calendar'] })
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [userProfile?.id, userProfile?.companyId, queryClient])

  const isUserOnline = useCallback((id) => Boolean(onlineUsers[id]), [onlineUsers])
  const getLastSeen = useCallback((id) => lastSeenMap[id] ?? null, [lastSeenMap])

  const value = useMemo(() => ({
    on,
    onlineUsers,
    lastSeenMap,
    isUserOnline,
    getLastSeen,
  }), [on, onlineUsers, lastSeenMap, isUserOnline, getLastSeen])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtimeContext() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('useRealtimeContext must be used inside RealtimeProvider')
  return ctx
}

export function useGlobalPresence() {
  const { onlineUsers, lastSeenMap, isUserOnline, getLastSeen } = useRealtimeContext()
  return { onlineUsers, lastSeenMap, isUserOnline, getLastSeen }
}

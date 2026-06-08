import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useGoogleCalendarStatus() {
  const token = useToken()

  return useQuery({
    queryKey: ['calendar', 'google', 'status'],
    queryFn: () => atlas.calendar.getGoogleStatus(token),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  })
}

export function useStartGoogleCalendarConnect() {
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => atlas.calendar.startGoogleConnect(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'google', 'status'] })
    },
  })
}

export function useGoogleCalendarList(enabled = true) {
  const token = useToken()

  return useQuery({
    queryKey: ['calendar', 'google', 'calendars'],
    queryFn: () => atlas.calendar.listGoogleCalendars(token),
    enabled: Boolean(token && enabled),
    staleTime: 60 * 1000,
  })
}

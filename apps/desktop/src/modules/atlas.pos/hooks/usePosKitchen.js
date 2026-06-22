import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosStationTickets(stationId, query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'kitchen', 'tickets', stationId, query],
    queryFn: () => atlas.pos.listStationTickets(stationId, query, token),
    select: (res) => Array.isArray(res) ? res : (res?.data ?? []),
    enabled: Boolean(token) && Boolean(stationId),
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

export function useUpdateTicketStatus() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, status }) =>
      atlas.pos.updateTicketStatus(ticketId, { status }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'kitchen'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar estado'),
  })
}

export function useUpdateTicketLineStatus() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, lineId, status }) =>
      atlas.pos.updateTicketLineStatus(ticketId, lineId, { status }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'kitchen'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar línea'),
  })
}

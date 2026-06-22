import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosReservations(query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'reservations', query],
    queryFn: () => atlas.pos.listReservations(query, token),
    select: (res) => Array.isArray(res) ? res : (res?.data ?? []),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  })
}

export function useCreatePosReservation() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createReservation(data, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'reservations'] })
      qc.invalidateQueries({ queryKey: ['pos', 'floors', 'detail'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
      toast.success('Reservación creada')
    },
    onError: (err) => toast.error(err?.message ?? 'Error al crear reservación'),
  })
}

export function useUpdatePosReservation() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pos.updateReservation(id, data, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'reservations'] })
      qc.invalidateQueries({ queryKey: ['pos', 'floors', 'detail'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
      toast.success('Reservación actualizada')
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar reservación'),
  })
}

export function useSeatPosReservation() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, sessionId }) => atlas.pos.seatReservation(id, { sessionId }, token),
    onSuccess: () => {
      toast.success('Reservación iniciada')
      qc.invalidateQueries({ queryKey: ['pos', 'reservations'] })
      qc.invalidateQueries({ queryKey: ['pos', 'floors', 'detail'] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al sentar reservación'),
  })
}

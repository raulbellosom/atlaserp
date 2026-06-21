import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosActiveMap(outletId) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'tables', 'active-map', outletId],
    queryFn: () => atlas.pos.getActiveMap(outletId ? { outlet_id: outletId } : {}, token),
    enabled: Boolean(token),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  })
}

export function usePosFloors(query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'floors', query],
    queryFn: () => atlas.pos.listFloors(query, token),
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
  })
}

export function useUpdateTableStatus() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tableId, status }) =>
      atlas.pos.updateTableStatus(tableId, { status }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar mesa'),
  })
}

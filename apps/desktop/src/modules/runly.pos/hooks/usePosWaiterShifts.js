import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useOpenWaiterShifts(outletId) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'waiter-shifts', outletId],
    queryFn: () => atlas.pos.listWaiterShifts({ status: 'OPEN', outletId }, token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token) && Boolean(outletId),
    refetchInterval: 30000,
  })
}

export function useCloseWaiterShift() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => atlas.pos.closeWaiterShift(id, data, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'waiter-shifts'] })
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
      toast.success('Corte recibido')
    },
    onError: (err) => toast.error(err?.message ?? 'Error al recibir el corte'),
  })
}

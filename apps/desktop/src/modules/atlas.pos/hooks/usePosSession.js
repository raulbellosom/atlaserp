import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosSessions(query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'sessions', query],
    queryFn: () => atlas.pos.listSessions(query, token),
    select: (res) => Array.isArray(res) ? res : (res?.data ?? []),
    enabled: Boolean(token),
    staleTime: 60 * 1000,
  })
}

export function usePosCurrentSession(terminalId) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'sessions', 'current', terminalId],
    queryFn: () => atlas.pos.getCurrentSession({ terminal_id: terminalId }, token),
    enabled: Boolean(token) && Boolean(terminalId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

export function usePosSession(id) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'sessions', 'detail', id],
    queryFn: () => atlas.pos.getSession(id, token),
    enabled: Boolean(token) && Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useOpenPosSession() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.openSession(data, token),
    onMutate: () => ({ toastId: toast.loading('Abriendo caja...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Caja abierta')
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al abrir caja')
    },
  })
}

export function useClosePosSession() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pos.closeSession(id, data, token),
    onMutate: () => ({ toastId: toast.loading('Cerrando caja...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Caja cerrada')
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
      qc.invalidateQueries({ queryKey: ['pos', 'sessions', 'detail', vars.id] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al cerrar caja')
    },
  })
}

export function useAddCashMovement() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, ...data }) => atlas.pos.addCashMovement(sessionId, data, token),
    onMutate: () => ({ toastId: toast.loading('Registrando movimiento...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Movimiento registrado')
      qc.invalidateQueries({ queryKey: ['pos', 'sessions', vars.sessionId] })
      qc.invalidateQueries({ queryKey: ['pos', 'sessions'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al registrar movimiento')
    },
  })
}

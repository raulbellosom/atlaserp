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
    select: (res) => Array.isArray(res) ? res : (res?.data ?? []),
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

export function usePosFloorDetail(id) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'floors', 'detail', id],
    queryFn: () => atlas.pos.getFloor(id, token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token) && Boolean(id),
    staleTime: 60 * 1000,
  })
}

export function useCreatePosFloor() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createFloor(data, token),
    onMutate: () => ({ toastId: toast.loading('Creando plano...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Plano creado')
      qc.invalidateQueries({ queryKey: ['pos', 'floors'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al crear plano')
    },
  })
}

export function useSaveFloorLayout() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, elements }) => atlas.pos.saveFloorLayout(id, { elements }, token),
    onMutate: () => ({ toastId: toast.loading('Guardando plano...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Plano guardado')
      qc.invalidateQueries({ queryKey: ['pos', 'floors', 'detail', vars.id] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar plano')
    },
  })
}

export function usePublishFloor() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => atlas.pos.publishFloor(id, token),
    onMutate: () => ({ toastId: toast.loading('Publicando plano...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Plano publicado como activo')
      qc.invalidateQueries({ queryKey: ['pos', 'floors'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al publicar plano')
    },
  })
}

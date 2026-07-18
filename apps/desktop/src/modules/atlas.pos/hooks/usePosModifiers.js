import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useProductModifierGroups(productId, { includeDisabled = false } = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'modifiers', 'product', productId, includeDisabled],
    queryFn: () => atlas.pos.listProductModifierGroups(productId, includeDisabled ? { includeDisabled: true } : {}, token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token) && Boolean(productId),
  })
}

export function useModifierGroupsByProducts(productIds = []) {
  const token = useToken()
  const key = [...productIds].sort().join(',')
  return useQuery({
    queryKey: ['pos', 'modifiers', 'bulk', key],
    queryFn: () => atlas.pos.listModifierGroups({ productIds: key }, token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token) && productIds.length > 0,
    staleTime: 60 * 1000,
  })
}

function useInvalidateModifiers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['pos', 'modifiers'] })
}

export function useCreateModifierGroup() {
  const token = useToken()
  const invalidate = useInvalidateModifiers()
  return useMutation({
    mutationFn: ({ productId, data }) => atlas.pos.createModifierGroup(productId, data, token),
    onSuccess: () => { invalidate(); toast.success('Grupo creado') },
    onError: (err) => toast.error(err?.message ?? 'Error al crear el grupo'),
  })
}

export function useUpdateModifierGroup() {
  const token = useToken()
  const invalidate = useInvalidateModifiers()
  return useMutation({
    mutationFn: ({ id, data }) => atlas.pos.updateModifierGroup(id, data, token),
    onSuccess: () => { invalidate(); toast.success('Grupo actualizado') },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar el grupo'),
  })
}

export function useCreateModifierOption() {
  const token = useToken()
  const invalidate = useInvalidateModifiers()
  return useMutation({
    mutationFn: ({ groupId, data }) => atlas.pos.createModifierOption(groupId, data, token),
    onSuccess: () => { invalidate(); toast.success('Opción creada') },
    onError: (err) => toast.error(err?.message ?? 'Error al crear la opción'),
  })
}

export function useUpdateModifierOption() {
  const token = useToken()
  const invalidate = useInvalidateModifiers()
  return useMutation({
    mutationFn: ({ id, data }) => atlas.pos.updateModifierOption(id, data, token),
    onSuccess: () => { invalidate(); toast.success('Opción actualizada') },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar la opción'),
  })
}

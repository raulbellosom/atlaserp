import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useProductConfigs() {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'product-configs'],
    queryFn: () => atlas.pos.listProductConfigs(token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token),
  })
}

export function useUpdateProductConfig() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, data }) => atlas.pos.updateProductConfig(productId, data, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'product-configs'] })
      toast.success('Configuración actualizada')
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar la configuración'),
  })
}

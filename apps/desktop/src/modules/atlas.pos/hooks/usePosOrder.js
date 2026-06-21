import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosOrders(query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'orders', query],
    queryFn: () => atlas.pos.listOrders(query, token),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  })
}

export function usePosOrder(id) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'orders', 'detail', id],
    queryFn: () => atlas.pos.getOrder(id, token),
    enabled: Boolean(token) && Boolean(id),
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

export function useCreatePosOrder() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createOrder(data, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al crear orden'),
  })
}

export function useAddPosOrderLine() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }) => atlas.pos.addOrderLine(orderId, data, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al agregar producto'),
  })
}

export function useUpdatePosOrderLine() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, lineId, ...data }) =>
      atlas.pos.updateOrderLine(orderId, lineId, data, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar línea'),
  })
}

export function useDeletePosOrderLine() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, lineId }) => atlas.pos.deleteOrderLine(orderId, lineId, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al eliminar línea'),
  })
}

export function useAddPosGuest() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }) => atlas.pos.addGuest(orderId, data, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al agregar comensal'),
  })
}

export function useSendToKitchen() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId) => atlas.pos.sendToKitchen(orderId, token),
    onMutate: () => ({ toastId: toast.loading('Enviando a cocina...') }),
    onSuccess: (_, orderId, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Comanda enviada a cocina')
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'kitchen'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al enviar a cocina')
    },
  })
}

export function useAddPosPayment() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }) => atlas.pos.addPayment(orderId, data, token),
    onMutate: () => ({ toastId: toast.loading('Registrando pago...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Pago registrado')
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al registrar pago')
    },
  })
}

export function useCancelPosOrder() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, reason }) => atlas.pos.cancelOrder(orderId, { reason }, token),
    onMutate: () => ({ toastId: toast.loading('Cancelando orden...') }),
    onSuccess: (_, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Orden cancelada')
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al cancelar orden')
    },
  })
}

export function useReprintPosReceipt() {
  const token = useToken()
  return useMutation({
    mutationFn: (orderId) => atlas.pos.reprintReceipt(orderId, token),
    onMutate: () => ({ toastId: toast.loading('Reimprimiendo recibo...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Recibo reenviado')
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al reimprimir')
    },
  })
}

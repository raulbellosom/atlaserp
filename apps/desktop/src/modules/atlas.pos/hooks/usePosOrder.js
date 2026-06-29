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
    select: (res) => Array.isArray(res) ? res : (res?.data ?? []),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  })
}

export function usePosOrder(id) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'orders', 'detail', id],
    queryFn: () => atlas.pos.getOrder(id, token),
    select: (res) => res?.data ?? null,
    enabled: Boolean(token) && Boolean(id),
    staleTime: 10 * 1000,
    refetchInterval: 60 * 1000,
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
      qc.invalidateQueries({ queryKey: ['pos', 'floors'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al crear orden'),
  })
}

export function useAddPosOrderLine() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, ...data }) => atlas.pos.addOrderLine(orderId, data, token),
    onMutate: async ({ orderId, productId, productName, unitPrice, quantity = 1 }) => {
      await qc.cancelQueries({ queryKey: ['pos', 'orders', 'detail', orderId] })
      const prev = qc.getQueryData(['pos', 'orders', 'detail', orderId])
      qc.setQueryData(['pos', 'orders', 'detail', orderId], (old) => {
        if (!old) return old
        const order = old?.data ?? old
        const qty = Number(quantity) || 1
        const price = Number(unitPrice ?? 0)
        const newLine = {
          id: `tmp-${Date.now()}`,
          productId, productName: productName ?? '',
          quantity: qty, unitPrice: price,
          discountAmount: 0, taxRate: 0, taxAmount: 0,
          totalAmount: qty * price,
        }
        const newLines = [...(order?.lines ?? []), newLine]
        const newSubtotal = newLines.reduce((s, l) => s + Number(l.unitPrice ?? 0) * Number(l.quantity ?? 0), 0)
        const updated = { ...order, lines: newLines, subtotalAmount: newSubtotal, totalAmount: newSubtotal }
        return old?.data !== undefined ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['pos', 'orders', 'detail', vars.orderId], ctx.prev)
      toast.error(err?.message ?? 'Error al agregar producto')
    },
  })
}

export function useUpdatePosOrderLine() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, lineId, ...data }) =>
      atlas.pos.updateOrderLine(orderId, lineId, data, token),
    onMutate: async ({ orderId, lineId, quantity, note }) => {
      await qc.cancelQueries({ queryKey: ['pos', 'orders', 'detail', orderId] })
      const prev = qc.getQueryData(['pos', 'orders', 'detail', orderId])
      qc.setQueryData(['pos', 'orders', 'detail', orderId], (old) => {
        if (!old) return old
        const order = old?.data ?? old
        const newLines = (order?.lines ?? []).map((l) => {
          if (l.id !== lineId) return l
          const qty = quantity !== undefined ? Number(quantity) : Number(l.quantity)
          return {
            ...l,
            quantity: qty,
            totalAmount: Number(l.unitPrice ?? 0) * qty,
            ...(note !== undefined ? { note: note ?? null } : {}),
          }
        })
        const newSubtotal = newLines.reduce((s, l) => s + Number(l.unitPrice ?? 0) * Number(l.quantity ?? 0), 0)
        const updated = { ...order, lines: newLines, subtotalAmount: newSubtotal, totalAmount: newSubtotal }
        return old?.data !== undefined ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['pos', 'orders', 'detail', vars.orderId], ctx.prev)
      toast.error(err?.message ?? 'Error al actualizar línea')
    },
  })
}

export function useDeletePosOrderLine() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, lineId }) => atlas.pos.deleteOrderLine(orderId, lineId, token),
    onMutate: async ({ orderId, lineId }) => {
      await qc.cancelQueries({ queryKey: ['pos', 'orders', 'detail', orderId] })
      const prev = qc.getQueryData(['pos', 'orders', 'detail', orderId])
      qc.setQueryData(['pos', 'orders', 'detail', orderId], (old) => {
        if (!old) return old
        const order = old?.data ?? old
        const newLines = (order?.lines ?? []).filter(l => l.id !== lineId)
        const newSubtotal = newLines.reduce((s, l) => s + Number(l.unitPrice ?? 0) * Number(l.quantity ?? 0), 0)
        const updated = { ...order, lines: newLines, subtotalAmount: newSubtotal, totalAmount: newSubtotal }
        return old?.data !== undefined ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['pos', 'orders', 'detail', vars.orderId], ctx.prev)
      toast.error(err?.message ?? 'Error al eliminar línea')
    },
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
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'seat-totals', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
      qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
      qc.invalidateQueries({ queryKey: ['pos', 'floors'] })
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
      qc.invalidateQueries({ queryKey: ['pos', 'floors'] })
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

export function useAssignOrderWaiter() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, waiterId }) =>
      atlas.pos.assignOrderWaiter(orderId, { waiterId }, token),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'detail', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders', 'seat-totals', vars.orderId] })
      qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
    },
    onError: (err) => toast.error(err?.message ?? 'Error al asignar mesero a la orden'),
  })
}

export function useOrderSeatTotals(orderId) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'orders', 'seat-totals', orderId],
    queryFn: () => atlas.pos.getOrderSeatTotals(orderId, token),
    select: (res) => res?.data ?? null,
    enabled: Boolean(token) && Boolean(orderId),
    staleTime: 5 * 1000,
  })
}

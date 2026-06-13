import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function loadingMutation(msg) {
  return {
    onMutate: () => ({ toastId: toast.loading(msg) }),
    onSuccess: (_, __, ctx) => toast.dismiss(ctx?.toastId),
    onError:   (_, __, ctx) => toast.dismiss(ctx?.toastId),
  }
}

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

// ── Items list ────────────────────────────────────────────────────────────────

export function useInventoryItems(params = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['inventory', 'items', params],
    queryFn: () => atlas.inventory.listItems(params, token),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  })
}

// ── Single item ───────────────────────────────────────────────────────────────

export function useInventoryItem(id) {
  const token = useToken()
  return useQuery({
    queryKey: ['inventory', 'items', id],
    queryFn: () => atlas.inventory.getItem(id, token),
    enabled: Boolean(token) && Boolean(id),
    staleTime: 30 * 1000,
  })
}

// ── Create item ───────────────────────────────────────────────────────────────

export function useCreateInventoryItem() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.inventory.createItem(data, token),
    ...loadingMutation('Creando activo...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] })
    },
  })
}

// ── Update item ───────────────────────────────────────────────────────────────

export function useUpdateInventoryItem() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.inventory.updateItem(id, data, token),
    ...loadingMutation('Guardando activo...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] })
      if (vars?.id) {
        qc.invalidateQueries({ queryKey: ['inventory', 'items', vars.id] })
      }
    },
  })
}

// ── Delete item ───────────────────────────────────────────────────────────────

export function useDeleteInventoryItem() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => atlas.inventory.deleteItem(id, token),
    ...loadingMutation('Eliminando activo...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] })
    },
  })
}

// ── Assign item ───────────────────────────────────────────────────────────────

export function useAssignInventoryItem() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...assignData }) => atlas.inventory.assignItem(itemId, assignData, token),
    ...loadingMutation('Asignando activo...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      if (vars?.itemId) {
        qc.invalidateQueries({ queryKey: ['inventory', 'items', vars.itemId] })
      }
      qc.invalidateQueries({ queryKey: ['inventory', 'assignments'] })
    },
  })
}

// ── Return item ───────────────────────────────────────────────────────────────

export function useReturnInventoryItem() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...returnData }) => atlas.inventory.returnItem(itemId, returnData, token),
    ...loadingMutation('Registrando devolucion...'),
    onSuccess: (data, vars, ctx) => {
      toast.dismiss(ctx?.toastId)
      if (vars?.itemId) {
        qc.invalidateQueries({ queryKey: ['inventory', 'items', vars.itemId] })
      }
      qc.invalidateQueries({ queryKey: ['inventory', 'assignments'] })
    },
  })
}

// ── Item assignment history ───────────────────────────────────────────────────

export function useInventoryItemAssignments(itemId) {
  const token = useToken()
  return useQuery({
    queryKey: ['inventory', 'items', itemId, 'assignments'],
    queryFn: () => atlas.inventory.getItemAssignments(itemId, token),
    enabled: Boolean(token) && Boolean(itemId),
    staleTime: 30 * 1000,
  })
}

// ── Items by employee ─────────────────────────────────────────────────────────

export function useInventoryItemsByEmployee(employeeId) {
  const token = useToken()
  return useQuery({
    queryKey: ['inventory', 'items', 'by-employee', employeeId],
    queryFn: () => atlas.inventory.getItemsByEmployee(employeeId, token),
    enabled: Boolean(token) && Boolean(employeeId),
    staleTime: 30 * 1000,
  })
}

// ── Assignments list ──────────────────────────────────────────────────────────

export function useInventoryAssignments(params = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['inventory', 'assignments', params],
    queryFn: () => atlas.inventory.listAssignments(params, token),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  })
}

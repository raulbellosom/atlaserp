import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function usePosSettings() {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'settings'],
    queryFn: () => atlas.pos.getSettings(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdatePosSettings() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.updateSettings(data, token),
    onMutate: () => ({ toastId: toast.loading('Guardando configuración...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Configuración guardada')
      qc.invalidateQueries({ queryKey: ['pos', 'settings'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar')
    },
  })
}

export function usePosOutlets() {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'outlets'],
    queryFn: () => atlas.pos.listOutlets(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePosOutlet() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createOutlet(data, token),
    onMutate: () => ({ toastId: toast.loading('Creando sucursal...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Sucursal creada')
      qc.invalidateQueries({ queryKey: ['pos', 'outlets'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al crear sucursal')
    },
  })
}

export function useUpdatePosOutlet() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pos.updateOutlet(id, data, token),
    onMutate: () => ({ toastId: toast.loading('Guardando sucursal...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Sucursal actualizada')
      qc.invalidateQueries({ queryKey: ['pos', 'outlets'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar')
    },
  })
}

export function usePosTerminals() {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'terminals'],
    queryFn: () => atlas.pos.listTerminals(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePosTerminal() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createTerminal(data, token),
    onMutate: () => ({ toastId: toast.loading('Creando terminal...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Terminal creada')
      qc.invalidateQueries({ queryKey: ['pos', 'terminals'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al crear terminal')
    },
  })
}

export function useUpdatePosTerminal() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pos.updateTerminal(id, data, token),
    onMutate: () => ({ toastId: toast.loading('Guardando terminal...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Terminal actualizada')
      qc.invalidateQueries({ queryKey: ['pos', 'terminals'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar')
    },
  })
}

export function usePosStations(query = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'stations', query],
    queryFn: () => atlas.pos.listStations(query, token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePosStation() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.pos.createStation(data, token),
    onMutate: () => ({ toastId: toast.loading('Creando estación...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Estación creada')
      qc.invalidateQueries({ queryKey: ['pos', 'stations'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al crear estación')
    },
  })
}

export function useUpdatePosStation() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pos.updateStation(id, data, token),
    onMutate: () => ({ toastId: toast.loading('Guardando estación...') }),
    onSuccess: (_, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.success('Estación actualizada')
      qc.invalidateQueries({ queryKey: ['pos', 'stations'] })
    },
    onError: (err, __, ctx) => {
      toast.dismiss(ctx?.toastId)
      toast.error(err?.message ?? 'Error al guardar')
    },
  })
}

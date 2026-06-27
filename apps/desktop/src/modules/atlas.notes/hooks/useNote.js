import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useNote(noteId) {
  const token = useToken()
  return useQuery({
    queryKey: ['notes', noteId],
    queryFn: () => atlas.notes.get(noteId, token),
    enabled: Boolean(token) && Boolean(noteId),
  })
}

export function useUpdateNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, data }) => atlas.notes.update(noteId, data, token),
    onSuccess: (_, { noteId }) => {
      qc.invalidateQueries({ queryKey: ['notes', noteId] })
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

export function useTrashNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId) => atlas.notes.trash(noteId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useRestoreNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId) => atlas.notes.restore(noteId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function usePermanentDeleteNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId) => atlas.notes.permanentDelete(noteId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

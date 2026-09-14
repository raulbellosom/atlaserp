import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useNoteShares(noteId) {
  const token = useToken()
  return useQuery({
    queryKey: ['notes', noteId, 'shares'],
    queryFn: () => atlas.notes.listShares(noteId, token),
    enabled: Boolean(token) && Boolean(noteId),
  })
}

export function useShareNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, targetUserId, permission }) =>
      atlas.notes.shareNote(noteId, { targetUserId, permission }, token),
    onSuccess: (_, { noteId }) =>
      qc.invalidateQueries({ queryKey: ['notes', noteId, 'shares'] }),
  })
}

export function useUpdateNoteShare() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, shareId, permission }) =>
      atlas.notes.updateShare(noteId, shareId, { permission }, token),
    onSuccess: (_, { noteId }) =>
      qc.invalidateQueries({ queryKey: ['notes', noteId, 'shares'] }),
  })
}

export function useRevokeNoteShare() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, shareId }) => atlas.notes.revokeShare(noteId, shareId, token),
    onSuccess: (_, { noteId }) =>
      qc.invalidateQueries({ queryKey: ['notes', noteId, 'shares'] }),
  })
}

export function usePublishNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId) => atlas.notes.publish(noteId, token),
    onSuccess: (_, noteId) => qc.invalidateQueries({ queryKey: ['notes', noteId] }),
  })
}

export function useUnpublishNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId) => atlas.notes.unpublish(noteId, token),
    onSuccess: (_, noteId) => qc.invalidateQueries({ queryKey: ['notes', noteId] }),
  })
}

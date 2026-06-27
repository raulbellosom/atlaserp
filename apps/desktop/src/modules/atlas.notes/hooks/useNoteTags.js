import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useNoteTags() {
  const token = useToken()
  return useQuery({
    queryKey: ['notes', 'tags'],
    queryFn: () => atlas.notes.listTags(token),
    enabled: Boolean(token),
  })
}

export function useCreateNoteTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.notes.createTag(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'tags'] }),
  })
}

export function useUpdateNoteTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tagId, data }) => atlas.notes.updateTag(tagId, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'tags'] }),
  })
}

export function useDeleteNoteTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tagId) => atlas.notes.deleteTag(tagId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'tags'] }),
  })
}

export function useSetNoteTags() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, tagIds }) => atlas.notes.setNoteTags(noteId, tagIds, token),
    onSuccess: (_, { noteId }) => {
      qc.invalidateQueries({ queryKey: ['notes', noteId] })
      qc.invalidateQueries({ queryKey: ['notes', 'tags'] })
    },
  })
}

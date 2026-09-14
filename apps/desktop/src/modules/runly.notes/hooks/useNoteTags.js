import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { runly } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useNoteTags() {
  const token = useToken()
  return useQuery({
    queryKey: ['notes', 'tags'],
    queryFn: () => runly.notes.listTags(token),
    enabled: Boolean(token),
  })
}

export function useCreateNoteTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => runly.notes.createTag(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'tags'] }),
  })
}

export function useUpdateNoteTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tagId, data }) => runly.notes.updateTag(tagId, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'tags'] }),
  })
}

export function useDeleteNoteTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tagId) => runly.notes.deleteTag(tagId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'tags'] }),
  })
}

export function useSetNoteTags() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, tagIds }) => runly.notes.setNoteTags(noteId, tagIds, token),
    onSuccess: (_, { noteId }) => {
      qc.invalidateQueries({ queryKey: ['notes', noteId] })
      qc.invalidateQueries({ queryKey: ['notes', 'tags'] })
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

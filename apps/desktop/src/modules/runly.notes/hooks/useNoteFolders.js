import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { runly } from '../../../lib/runly'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useNoteFolders() {
  const token = useToken()
  return useQuery({
    queryKey: ['notes', 'folders'],
    queryFn: () => runly.notes.listFolders(token),
    enabled: Boolean(token),
  })
}

export function useCreateNoteFolder() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => runly.notes.createFolder(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'folders'] }),
  })
}

export function useUpdateNoteFolder() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ folderId, data }) => runly.notes.updateFolder(folderId, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'folders'] }),
  })
}

export function useDeleteNoteFolder() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (folderId) => runly.notes.deleteFolder(folderId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', 'folders'] }),
  })
}

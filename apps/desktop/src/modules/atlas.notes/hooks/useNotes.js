import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useNotes(params = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['notes', params],
    queryFn: () => atlas.notes.list(params, token),
    enabled: Boolean(token),
  })
}

export function useCreateNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.notes.create(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

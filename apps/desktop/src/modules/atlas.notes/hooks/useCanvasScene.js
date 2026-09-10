import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

export function useCanvasScene(noteId) {
  const { session } = useAuth()
  const token = session?.access_token
  return useQuery({
    queryKey: ['canvas-scene', noteId],
    queryFn: () => atlas.notes.getCanvas(noteId, token),
    enabled: Boolean(token && noteId),
    staleTime: Infinity, // the realtime channel keeps it fresh; refetch only on remount
  })
}

export function useSaveCanvasScene(noteId) {
  const { session } = useAuth()
  const token = session?.access_token
  return useMutation({
    mutationFn: (scene) => atlas.notes.saveCanvas(noteId, scene, token),
  })
}

export function usePublicCanvasScene(slug) {
  return useQuery({
    queryKey: ['public-canvas', slug],
    queryFn: () => atlas.notes.getPublicCanvas(slug),
    enabled: Boolean(slug),
    retry: false,
    staleTime: 0,
  })
}

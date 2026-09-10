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
    // Always pull a fresh scene on (re)mount. The app persists queries to
    // IndexedDB for 24h, so `staleTime: Infinity` here would show a stale
    // snapshot after a page reload — exactly the "I drew but it's gone on
    // reload" bug. The realtime channel keeps the OPEN session in sync.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
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

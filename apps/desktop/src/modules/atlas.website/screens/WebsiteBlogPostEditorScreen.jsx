import { useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WebsiteGrapesEditor } from '../../../website/WebsiteGrapesEditor.jsx'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { toast } from 'sonner'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function WebsiteBlogPostEditorScreen() {
  const { '*': wildcard } = useParams()
  const postId = wildcard?.match(/^blog\/([^/]+)\/editor$/)?.[1] ?? null
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()
  const grapesDataRef = useRef(null)
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const postQuery = useQuery({
    queryKey: ['blog-post', postId, token],
    queryFn: () => apiFetch(`/website/blog/posts/${postId}`, { headers }),
    enabled: Boolean(token) && Boolean(postId),
    staleTime: 30_000,
  })

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/website/blog/posts/${postId}/save-draft`, {
        method: 'POST', headers,
        body: JSON.stringify({ builderData: grapesDataRef.current ?? {} }),
      }),
    onSuccess: () => {
      toast.success('Borrador guardado')
      queryClient.invalidateQueries({ queryKey: ['blog-post', postId] })
    },
    onError: (err) => toast.error(err.message || 'Error al guardar el borrador'),
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`/website/blog/posts/${postId}/save-draft`, {
        method: 'POST', headers,
        body: JSON.stringify({ builderData: grapesDataRef.current ?? {} }),
      })
      return apiFetch(`/website/blog/posts/${postId}/publish`, { method: 'POST', headers })
    },
    onSuccess: () => {
      toast.success('Entrada publicada')
      queryClient.invalidateQueries({ queryKey: ['blog-post', postId] })
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] })
    },
    onError: (err) => toast.error(err.message || 'Error al publicar'),
  })

  if (postQuery.isPending) {
    return (
      <div className="h-screen flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm">
        Cargando editor...
      </div>
    )
  }

  if (postQuery.isError || !postId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-[hsl(var(--muted-foreground))]">No se pudo cargar la entrada.</p>
          <button onClick={() => navigate('/app/m/atlas.website/blog')} className="text-sm underline">Volver al blog</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] z-10">
        <button
          onClick={() => navigate('/app/m/atlas.website/blog')}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          Volver al blog
        </button>
        <span className="text-sm font-medium text-[hsl(var(--foreground))]">{postQuery.data?.title}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => saveDraftMutation.mutate()}
            disabled={saveDraftMutation.isPending || publishMutation.isPending}
            className="px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            {saveDraftMutation.isPending ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending || saveDraftMutation.isPending}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {publishMutation.isPending ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <WebsiteGrapesEditor
          initialData={postQuery.data?.draftBuilderData ?? null}
          onDataChange={(data) => { grapesDataRef.current = data }}
          height="100%"
        />
      </div>
    </div>
  )
}

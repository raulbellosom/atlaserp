import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Puck } from '@measured/puck'
import '@measured/puck/puck.css'
import { atlasWebsiteConfig } from '../../../website/atlasWebsiteConfig.js'
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
  const [puckData, setPuckData] = useState(null)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const postQuery = useQuery({
    queryKey: ['blog-post', postId, token],
    queryFn: () => apiFetch(`/website/blog/posts/${postId}`, { headers }),
    enabled: Boolean(token) && Boolean(postId),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (postQuery.data && puckData === null) {
      const draft = postQuery.data.draftBuilderData
      setPuckData(draft && Object.keys(draft).length > 0 ? draft : { content: [], root: {} })
    }
  }, [postQuery.data, puckData])

  const saveDraftMutation = useMutation({
    mutationFn: (builderData) =>
      apiFetch(`/website/blog/posts/${postId}/save-draft`, {
        method: 'POST', headers, body: JSON.stringify({ builderData }),
      }),
    onSuccess: () => {
      toast.success('Borrador guardado')
      queryClient.invalidateQueries({ queryKey: ['blog-post', postId] })
    },
    onError: (err) => toast.error(err.message || 'Error al guardar el borrador'),
  })

  const publishMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/website/blog/posts/${postId}/publish`, { method: 'POST', headers }),
    onSuccess: () => {
      toast.success('Entrada publicada')
      queryClient.invalidateQueries({ queryKey: ['blog-post', postId] })
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] })
    },
    onError: (err) => toast.error(err.message || 'Error al publicar'),
  })

  const handleChange = useCallback((data) => { setPuckData(data) }, [])

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
          <button
            onClick={() => navigate('/app/m/atlas.website/blog')}
            className="text-sm underline"
          >
            Volver al blog
          </button>
        </div>
      </div>
    )
  }

  const initialData = puckData ?? { content: [], root: {} }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] z-10">
        <button
          onClick={() => navigate('/app/m/atlas.website/blog')}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          Volver al blog
        </button>
        <span className="text-sm font-medium text-[hsl(var(--foreground))]">
          {postQuery.data?.title}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => saveDraftMutation.mutate(puckData)}
            disabled={saveDraftMutation.isPending}
            className="px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            {saveDraftMutation.isPending ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {publishMutation.isPending ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Puck config={atlasWebsiteConfig} data={initialData} onChange={handleChange} />
      </div>
    </div>
  )
}

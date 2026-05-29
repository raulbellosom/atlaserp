import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Button } from '@atlas/ui'
import { toast } from 'sonner'
import WebsiteNewBlogPostDialog from './WebsiteNewBlogPostDialog.jsx'

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const STATUS_LABELS = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' }
const STATUS_COLORS = {
  draft:     'bg-yellow-50 text-yellow-700 border-yellow-200',
  published: 'bg-green-50  text-green-700  border-green-200',
  archived:  'bg-gray-50   text-gray-500   border-gray-200',
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

export default function WebsiteBlogScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiGet('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })
  const siteId = siteQuery.data?.data?.id ?? null

  const catsQuery = useQuery({
    queryKey: ['blog-categories', siteId, token],
    queryFn: () => apiGet(`/website/blog/categories?siteId=${siteId}`, token),
    enabled: Boolean(token) && Boolean(siteId),
    staleTime: 60_000,
  })
  const categories = catsQuery.data?.data ?? []

  const postsQuery = useQuery({
    queryKey: ['blog-posts', siteId, categoryFilter, token],
    queryFn: () => apiGet(
      `/website/blog/posts?siteId=${siteId}${categoryFilter ? `&categoryId=${categoryFilter}` : ''}`,
      token,
    ),
    enabled: Boolean(token) && Boolean(siteId),
    staleTime: 30_000,
  })
  const posts = postsQuery.data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await fetch(`${getApiUrl()}/website/blog/posts/${postId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      toast.success('Entrada eliminada')
      queryClient.invalidateQueries({ queryKey: ['blog-posts', siteId] })
    },
    onError: () => toast.error('Error al eliminar la entrada'),
  })

  if (siteQuery.isPending) {
    return <div className="p-8 text-[hsl(var(--muted-foreground))] text-sm">Cargando...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Blog</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Gestiona las entradas del blog publico.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={!siteId}>
          Nueva entrada
        </Button>
      </div>

      {!siteId ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-10 text-center">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            Configura tu sitio web primero desde la seccion &quot;Sitio web&quot;.
          </p>
        </div>
      ) : (
        <>
          {categories.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Filtrar:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-0 text-sm focus:outline-none"
              >
                <option value="">Todas las categorias</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {postsQuery.isPending ? (
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Cargando entradas...</div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-[hsl(var(--border))] p-10 text-center space-y-4">
              <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay entradas de blog aun.</p>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                Crear primera entrada
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--muted))]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Titulo</th>
                    <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Categoria</th>
                    <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Estado</th>
                    <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Publicado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {posts.map((post) => (
                    <tr key={post.id} className="hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[hsl(var(--foreground))]">{post.title}</td>
                      <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                        {post.category?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[post.status] ?? ''}`}>
                          {STATUS_LABELS[post.status] ?? post.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] text-xs">
                        {fmtDate(post.publishedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/app/m/atlas.website/blog/${post.id}/editor`)}
                            className="text-xs text-[hsl(var(--primary))] hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Eliminar "${post.title}"?`)) deleteMutation.mutate(post.id)
                            }}
                            disabled={deleteMutation.isPending}
                            className="text-xs text-[hsl(var(--destructive))] hover:underline disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <WebsiteNewBlogPostDialog
        siteId={siteId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(post) => {
          queryClient.invalidateQueries({ queryKey: ['blog-posts', siteId] })
          navigate(`/app/m/atlas.website/blog/${post.id}/editor`)
        }}
      />
    </div>
  )
}

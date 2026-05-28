import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../../apps/desktop/src/auth/AuthProvider.jsx'
import { getApiUrl } from '../../../../apps/desktop/src/lib/runtimeConfig.js'

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const STATUS_LABELS = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' }
const STATUS_COLORS = {
  draft:     'bg-yellow-50 text-yellow-700 border-yellow-200',
  published: 'bg-green-50  text-green-700  border-green-200',
  archived:  'bg-gray-50   text-gray-500   border-gray-200',
}

export default function WebsitePagesScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiGet('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })
  const siteId = siteQuery.data?.data?.id ?? null

  const pagesQuery = useQuery({
    queryKey: ['website-pages', siteId, token],
    queryFn: () => apiGet(`/website/pages?siteId=${siteId}`, token),
    enabled: Boolean(token) && Boolean(siteId),
    staleTime: 30_000,
  })

  const pages = pagesQuery.data?.data ?? []

  if (siteQuery.isPending) {
    return <div className="p-8 text-[hsl(var(--muted-foreground))] text-sm">Cargando...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Paginas</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Gestiona las paginas del sitio publico.
          </p>
        </div>
        <button
          onClick={() => navigate('/app/m/atlas.website/pages/new')}
          className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Nueva pagina
        </button>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-10 text-center">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay paginas creadas aun.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Titulo</th>
                <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Ruta</th>
                <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[hsl(var(--foreground))]">{page.title}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-mono text-xs">{page.route_path}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[page.status] ?? ''}`}>
                      {STATUS_LABELS[page.status] ?? page.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/app/m/atlas.website/pages/${page.id}/editor`)}
                      className="text-xs text-[hsl(var(--primary))] hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

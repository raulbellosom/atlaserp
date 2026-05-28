import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../../apps/desktop/src/auth/AuthProvider.jsx'
import { getApiUrl } from '../../../../apps/desktop/src/lib/runtimeConfig.js'

export default function WebsiteOverviewScreen() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const token = session?.access_token

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: async () => {
      const res = await fetch(
        `${getApiUrl()}/website/site`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  const site = siteQuery.data?.data ?? null

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Sitio web</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Administra tu sitio publico desde este panel.
        </p>
      </div>

      {site ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-1">
            <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Estado</p>
            <p className="text-lg font-medium capitalize">{site.status}</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-1">
            <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Dominio</p>
            <p className="text-lg font-medium">{site.domain || '—'}</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-1">
            <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Nombre</p>
            <p className="text-lg font-medium">{site.name}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center space-y-3">
          <p className="text-[hsl(var(--muted-foreground))]">No hay un sitio web configurado aun.</p>
          <button
            onClick={() => navigate('/app/m/atlas.website/pages')}
            className="text-sm underline text-[hsl(var(--primary))]"
          >
            Ir a Paginas para empezar
          </button>
        </div>
      )}
    </div>
  )
}

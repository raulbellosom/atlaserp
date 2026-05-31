import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import WebsiteSiteWizard from './WebsiteSiteWizard.jsx'

async function apiFetch(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function WebsiteOverviewScreen() {
  const { session } = useAuth()
  const token = session?.access_token

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiFetch('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  if (siteQuery.isPending) {
    return <div className="flex items-center justify-center h-full text-sm text-[hsl(var(--muted-foreground))]">Cargando...</div>
  }

  const site = siteQuery.data?.data ?? null
  if (!site) return <WebsiteSiteWizard />

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">{site.name}</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Tipo: {site.site_type} · Estado: {site.status}
      </p>
      {site.domain && (
        <a
          href={`https://${site.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[hsl(var(--primary))] underline"
        >
          {site.domain}
        </a>
      )}
    </div>
  )
}

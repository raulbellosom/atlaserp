import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { serializePage } from '@raulbellosom/atlas-web-builder'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Button } from '@atlas/ui'
import { LayoutTemplate, Check } from 'lucide-react'
import { toast } from 'sonner'
import { allTemplates } from '../../../website/atlasTemplates/index.js'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function routeToSlug(routePath) {
  const clean = routePath
    .replace(/^\//, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
  return clean || 'inicio'
}

export default function WebsiteTemplatesScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selected, setSelected]             = useState(null)
  const [selectedPageIds, setSelectedPageIds] = useState([])

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn:  () => apiFetch('/website/site', token),
    enabled:  Boolean(token),
    staleTime: 60_000,
  })
  const site = siteQuery.data?.data ?? null

  function handleSelectTemplate(tpl) {
    setSelected(tpl)
    setSelectedPageIds(tpl.pages.map((p) => p.id))
  }

  function togglePage(pageId) {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    )
  }

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !site) throw new Error('Sin plantilla o sitio seleccionado')
      const pagesToCreate = selected.pages.filter((p) => selectedPageIds.includes(p.id))
      let firstPageId = null
      let created = 0
      let skipped = 0

      for (const p of pagesToCreate) {
        try {
          const slug = routeToSlug(p.routePath)
          const res = await apiFetch('/website/pages', token, {
            method: 'POST',
            body: JSON.stringify({
              siteId:     site.id,
              title:      p.label,
              slug,
              routePath:  p.routePath.startsWith('/') ? p.routePath : `/${p.routePath}`,
              pageType:   'page',
              visibility: 'public',
            }),
          })
          const created_ = res.data ?? res
          if (!firstPageId) firstPageId = created_.id

          await apiFetch(`/website/pages/${created_.id}/draft`, token, {
            method: 'POST',
            body: JSON.stringify({ draft_builder_data: serializePage(p.page) }),
          })
          created++
        } catch (err) {
          if (err.message?.includes('ya esta en uso')) {
            skipped++
          } else {
            throw err
          }
        }
      }

      return { firstPageId, created, skipped }
    },
    onSuccess: ({ firstPageId, created, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['website-pages'] })
      const msg = `${created} pagina${created !== 1 ? 's' : ''} creada${created !== 1 ? 's' : ''}`
      const skip = skipped > 0 ? ` · ${skipped} omitida${skipped !== 1 ? 's' : ''} (ruta ya existe)` : ''
      toast.success(msg + skip)
      if (firstPageId) {
        navigate(`/app/m/atlas.website/pages/${firstPageId}/editor`)
      } else {
        navigate('/app/m/atlas.website/pages')
      }
    },
    onError: (err) => toast.error(err.message),
  })

  if (siteQuery.isPending) {
    return <div className="p-8 text-sm text-[hsl(var(--muted-foreground))]">Cargando...</div>
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Plantillas</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Aplica una plantilla para crear paginas con diseno predefinido.
        </p>
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allTemplates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => handleSelectTemplate(tpl)}
            className={`text-left rounded-xl border-2 p-5 transition-all w-full ${
              selected?.id === tpl.id
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--muted)/0.4)]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${tpl.color}20` }}
              >
                <LayoutTemplate size={18} style={{ color: tpl.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-[hsl(var(--foreground))]">{tpl.label}</h3>
                  {selected?.id === tpl.id && (
                    <Check size={16} className="text-[hsl(var(--primary))] shrink-0" />
                  )}
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                  {tpl.description}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                  {tpl.pages.length} pagina{tpl.pages.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Page selection panel */}
      {selected && (
        <div className="rounded-xl border border-[hsl(var(--border))] p-6 space-y-4">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Paginas incluidas en "{selected.label}"
          </h2>
          <div className="space-y-2">
            {selected.pages.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
                  p.required ? 'opacity-70' : 'cursor-pointer hover:bg-[hsl(var(--muted)/0.5)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedPageIds.includes(p.id)}
                  onChange={() => { if (!p.required) togglePage(p.id) }}
                  disabled={p.required}
                  className="rounded"
                />
                <span className="flex-1 text-sm font-medium text-[hsl(var(--foreground))]">
                  {p.label}
                </span>
                <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                  {p.routePath}
                </span>
                {p.required && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded px-1.5 py-0.5">
                    requerida
                  </span>
                )}
              </label>
            ))}
          </div>

          {!site && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Configura tu sitio web primero para poder aplicar plantillas.
            </p>
          )}

          <div className="flex justify-end pt-2 border-t border-[hsl(var(--border))]">
            <Button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending || selectedPageIds.length === 0 || !site}
            >
              {applyMutation.isPending
                ? 'Creando paginas...'
                : `Aplicar — ${selectedPageIds.length} pagina${selectedPageIds.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

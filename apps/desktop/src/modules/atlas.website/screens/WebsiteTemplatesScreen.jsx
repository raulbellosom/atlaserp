import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { serializePage } from '@raulbellosom/atlas-web-builder'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { LayoutTemplate } from 'lucide-react'
import { toast } from 'sonner'
import { allTemplates } from '../../../website/atlasTemplates/index.js'
import { TemplatePreviewDialog } from './TemplatePreviewDialog.jsx'

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

  const [previewTpl,  setPreviewTpl]  = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn:  () => apiFetch('/website/site', token),
    enabled:  Boolean(token),
    staleTime: 60_000,
  })
  const site = siteQuery.data?.data ?? null

  const applyMutation = useMutation({
    mutationFn: async ({ template, pageIds }) => {
      if (!template || !site) throw new Error('Sin plantilla o sitio seleccionado')
      const pagesToCreate = template.pages.filter((p) => pageIds.includes(p.id))
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
      setPreviewOpen(false)
      queryClient.invalidateQueries({ queryKey: ['website-pages'] })
      if (created === 0) {
        const skip = skipped > 0
          ? `${skipped} pagina${skipped !== 1 ? 's' : ''} omitida${skipped !== 1 ? 's' : ''} (ruta ya existe)`
          : 'Ninguna pagina fue creada.'
        toast.info(skip + ' Edítalas directamente desde Páginas.')
        return
      }
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
          Selecciona una plantilla para previsualizar y aplicar sus paginas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allTemplates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => { setPreviewTpl(tpl); setPreviewOpen(true) }}
            className="text-left rounded-xl border-2 border-[hsl(var(--border))] p-5 transition-all w-full hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--muted)/0.4)] hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${tpl.color}20` }}
              >
                <LayoutTemplate size={18} style={{ color: tpl.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[hsl(var(--foreground))]">{tpl.label}</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                  {tpl.description}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                  {tpl.pages.length} pagina{tpl.pages.length !== 1 ? 's' : ''} · Clic para previsualizar
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <TemplatePreviewDialog
        template={previewTpl}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        applying={applyMutation.isPending}
        onApply={(pageIds) => {
          if (!site) {
            toast.error('Configura tu sitio web primero.')
            return
          }
          applyMutation.mutate({ template: previewTpl, pageIds })
        }}
      />
    </div>
  )
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { TemplatePickerModal } from '../../../website/TemplatePickerModal.jsx'
import { allTemplates } from '../../../website/atlasTemplates/index.js'

const CATEGORY_LABELS = {
  all: 'Todos', hosteleria: 'Hosteleria', bienestar: 'Bienestar',
  tecnologia: 'Tecnologia', comercio: 'Comercio', negocios: 'Negocios',
  salud: 'Salud', creativo: 'Creativo', medios: 'Medios',
  educacion: 'Educacion', social: 'Social',
}

export default function WebsiteTemplatesScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState(null)

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/website/site`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  const siteId = siteQuery.data?.data?.id ?? null

  const categories = ['all', ...new Set(allTemplates.map((t) => t.category).filter(Boolean))]
  const filtered = categoryFilter === 'all'
    ? allTemplates
    : allTemplates.filter((t) => t.category === categoryFilter)

  function handleApplyClick(tpl) {
    setActiveTemplate(tpl)
    setPickerOpen(true)
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Plantillas</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Aplica una plantilla para crear multiples paginas de una vez.
        </p>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              categoryFilter === cat
                ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Color header */}
            <div
              className="h-24 flex items-center justify-center relative"
              style={{ background: `linear-gradient(135deg, ${tpl.color} 0%, ${tpl.color}bb 100%)` }}
            >
              <span className="text-5xl font-black opacity-20 text-white uppercase select-none">
                {tpl.label.charAt(0)}
              </span>
              {tpl.category && (
                <span className="absolute top-2 right-3 text-xs font-bold text-white bg-black/25 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {tpl.category}
                </span>
              )}
            </div>

            <div className="p-5 space-y-3">
              <div>
                <p className="font-bold text-[hsl(var(--foreground))]">{tpl.label}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed line-clamp-2">
                  {tpl.description}
                </p>
              </div>

              {/* Page badges */}
              <div className="flex flex-wrap gap-1.5">
                {(tpl.pages ?? []).map((p) => (
                  <span
                    key={p.id}
                    className="text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full"
                  >
                    {p.label}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleApplyClick(tpl)}
                disabled={!siteId}
                title={!siteId ? 'Configura tu sitio web primero' : undefined}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: tpl.color }}
              >
                {siteId ? 'Aplicar plantilla' : 'Configura tu sitio primero'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Template picker modal — opens at step 2 with pre-selected template */}
      {pickerOpen && activeTemplate && (
        <TemplatePickerModal
          isOpen={pickerOpen}
          onClose={() => { setPickerOpen(false); setActiveTemplate(null) }}
          token={token}
          siteId={siteId}
          initialTemplate={activeTemplate}
          onHomePageApplied={() => { setPickerOpen(false); setActiveTemplate(null) }}
        />
      )}
    </div>
  )
}

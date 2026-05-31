// apps/desktop/src/modules/atlas.website/screens/WebsiteSiteWizard.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { defineTheme, defaultTheme, serializePage } from '@raulbellosom/atlas-web-builder'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Button, Input, Label } from '@atlas/ui'
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

const SITE_TYPES = [
  { value: 'informational', label: 'Sitio informativo',       description: 'Paginas estaticas con formulario de contacto' },
  { value: 'ecommerce',     label: 'Tienda online',           description: 'Catalogo de productos, carrito y pagos' },
  { value: 'bookings',      label: 'Sitio con reservaciones', description: 'Agenda publica integrada con el calendario' },
]

const FONTS = [
  { value: 'Inter',            label: 'Inter (moderno)' },
  { value: 'Playfair Display', label: 'Playfair Display (elegante)' },
  { value: 'Space Grotesk',    label: 'Space Grotesk (tecnico)' },
  { value: 'DM Sans',          label: 'DM Sans (amigable)' },
  { value: 'Merriweather',     label: 'Merriweather (editorial)' },
]

export default function WebsiteSiteWizard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const [step, setStep]         = useState(1)
  const [siteType, setSiteType] = useState('informational')
  const [identity, setIdentity] = useState({
    name:         '',
    primaryColor: '#6D28D9',
    bgColor:      '#FFFFFF',
    font:         'Inter',
  })
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedPages,    setSelectedPages]    = useState([])

  function handleTemplateSelect(tpl) {
    setSelectedTemplate(tpl)
    setSelectedPages(tpl.pages.map((p) => p.id))
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const themeTokens = {
        ...defaultTheme.tokens,
        color: {
          ...defaultTheme.tokens?.color,
          primary: identity.primaryColor,
          bg:      identity.bgColor,
        },
      }
      const builtTheme = defineTheme({
        ...defaultTheme,
        id:     'atlas-site',
        name:   'Site Theme',
        tokens: themeTokens,
      })

      const siteRes = await apiFetch('/website/site', token, {
        method: 'POST',
        body: JSON.stringify({ name: identity.name, site_type: siteType }),
      })
      const site = siteRes.data ?? siteRes

      await apiFetch('/website/theme', token, {
        method: 'POST',
        body: JSON.stringify({
          site_id:    site.id,
          tokens:     builtTheme.tokens,
          typography: identity.font,
        }),
      })

      let firstPageId = null
      if (selectedTemplate) {
        const pagesToCreate = selectedTemplate.pages.filter((p) => selectedPages.includes(p.id))
        for (const p of pagesToCreate) {
          const pageRes = await apiFetch('/website/pages', token, {
            method: 'POST',
            body: JSON.stringify({
              site_id:            site.id,
              title:              p.label,
              slug:               p.routePath,
              draft_builder_data: serializePage(p.page),
            }),
          })
          const created = pageRes.data ?? pageRes
          if (!firstPageId) firstPageId = created.id
        }
      }

      return { siteId: site.id, firstPageId }
    },
    onSuccess: ({ firstPageId }) => {
      toast.success('Sitio creado correctamente')
      queryClient.invalidateQueries({ queryKey: ['website-site'] })
      if (firstPageId) {
        navigate(`/app/m/atlas.website/pages/${firstPageId}/editor`)
      } else {
        navigate('/app/m/atlas.website/pages')
      }
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[hsl(var(--background))]">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Crear sitio web</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Paso {step} de 3</p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Tipo de sitio</h2>
            <div className="grid gap-3">
              {SITE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSiteType(t.value)}
                  className={`text-left p-4 rounded-xl border-2 transition-colors ${
                    siteType === t.value
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)]'
                  }`}
                >
                  <p className="font-medium text-sm text-[hsl(var(--foreground))]">{t.label}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>Siguiente</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Identidad visual</h2>
            <div className="space-y-1">
              <Label htmlFor="site-name">Nombre del sitio</Label>
              <Input
                id="site-name"
                placeholder="Mi empresa"
                value={identity.name}
                onChange={(e) => setIdentity((i) => ({ ...i, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="primary-color">Color primario</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="primary-color"
                    type="color"
                    value={identity.primaryColor}
                    onChange={(e) => setIdentity((i) => ({ ...i, primaryColor: e.target.value }))}
                    className="h-9 w-14 rounded border border-[hsl(var(--border))] cursor-pointer"
                  />
                  <Input
                    value={identity.primaryColor}
                    onChange={(e) => setIdentity((i) => ({ ...i, primaryColor: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="bg-color">Color de fondo</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="bg-color"
                    type="color"
                    value={identity.bgColor}
                    onChange={(e) => setIdentity((i) => ({ ...i, bgColor: e.target.value }))}
                    className="h-9 w-14 rounded border border-[hsl(var(--border))] cursor-pointer"
                  />
                  <Input
                    value={identity.bgColor}
                    onChange={(e) => setIdentity((i) => ({ ...i, bgColor: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="site-font">Tipografia</Label>
              <select
                id="site-font"
                className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                value={identity.font}
                onChange={(e) => setIdentity((i) => ({ ...i, font: e.target.value }))}
              >
                {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Atras</Button>
              <Button className="flex-1" disabled={!identity.name} onClick={() => setStep(3)}>Siguiente</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Plantilla</h2>
            {!selectedTemplate ? (
              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {allTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleTemplateSelect(tpl)}
                    className="text-left rounded-xl border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)] overflow-hidden transition-colors"
                  >
                    <div className="h-16" style={{ background: `linear-gradient(135deg, ${tpl.color}, ${tpl.color}99)` }} />
                    <div className="p-3">
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{tpl.label}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{tpl.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Plantilla: {selectedTemplate.label}</p>
                  <button
                    type="button"
                    className="text-xs text-[hsl(var(--muted-foreground))] underline"
                    onClick={() => setSelectedTemplate(null)}
                  >
                    Cambiar
                  </button>
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Paginas a crear:</p>
                <div className="space-y-2">
                  {selectedTemplate.pages.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPages.includes(p.id)}
                        disabled={p.required}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPages((prev) => [...prev, p.id])
                          else setSelectedPages((prev) => prev.filter((id) => id !== p.id))
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-[hsl(var(--foreground))]">{p.label}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">{p.routePath}</span>
                      {p.required && <span className="text-xs text-[hsl(var(--muted-foreground))]">(requerida)</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Atras</Button>
              <Button
                className="flex-1"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending
                  ? 'Creando...'
                  : selectedTemplate
                    ? `Crear ${selectedPages.length} pagina${selectedPages.length !== 1 ? 's' : ''}`
                    : 'Crear sitio sin plantilla'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

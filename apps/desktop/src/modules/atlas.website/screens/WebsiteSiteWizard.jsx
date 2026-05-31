import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { defineTheme, defaultTheme, serializePage } from '@raulbellosom/atlas-web-builder'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
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

// ─── Color extraction (same as CompanyBranding) ───────────────────────────────

function extractColorsFromImageEl(img, count = 8) {
  try {
    const canvas = document.createElement('canvas')
    const SIZE = 64
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, SIZE, SIZE)
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
    const freq = {}
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const brightness = (r + g + b) / 3
      if (brightness > 238 || brightness < 18) continue
      const qr = Math.round(r / 28) * 28
      const qg = Math.round(g / 28) * 28
      const qb = Math.round(b / 28) * 28
      const key = `${qr},${qg},${qb}`
      freq[key] = (freq[key] || 0) + 1
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
    const picked = []
    for (const [key] of sorted) {
      const [r, g, b] = key.split(',').map(Number)
      const hex = '#' + [r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('')
      const tooClose = picked.some((p) => {
        const pr = parseInt(p.slice(1, 3), 16)
        const pg = parseInt(p.slice(3, 5), 16)
        const pb = parseInt(p.slice(5, 7), 16)
        return Math.abs(pr - r) + Math.abs(pg - g) + Math.abs(pb - b) < 55
      })
      if (!tooClose) {
        picked.push(hex)
        if (picked.length >= count) break
      }
    }
    return picked
  } catch { return [] }
}

function extractColorsFromFile(file, count = 8) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { resolve(extractColorsFromImageEl(img, count)); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve([]); URL.revokeObjectURL(url) }
    img.src = url
  })
}

// Fetch the image as a blob first so canvas extraction works regardless of CORS policy on signed URLs
async function extractColorsFromBlobUrl(url, count = 8) {
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const blob = await res.blob()
    return extractColorsFromFile(blob, count)
  } catch { return [] }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#4F46E5', '#0A7BFF', '#6C3BFF', '#A80070',
  '#E8330A', '#F59E0B', '#10B981', '#0EA5E9',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
]

const SITE_TYPES = [
  {
    value: 'informational',
    label: 'Sitio informativo',
    description: 'Paginas estaticas con formulario de contacto',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.1"/>
        <path d="M8 28h24M8 22h16M8 16h24M20 28V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <rect x="22" y="14" width="10" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    features: ['Paginas estaticas', 'Formulario de contacto', 'SEO optimizado'],
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-700',
    accentBorder: 'border-violet-500',
    accentRing: 'ring-violet-200',
  },
  {
    value: 'ecommerce',
    label: 'Tienda online',
    description: 'Catalogo de productos, carrito y pagos',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.1"/>
        <path d="M6 8h4l2.5 14h15l2.5-10H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="16" cy="26" r="2" stroke="currentColor" strokeWidth="2"/>
        <circle cx="24" cy="26" r="2" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    features: ['Catalogo de productos', 'Carrito de compras', 'Pasarela de pagos'],
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-500',
    accentRing: 'ring-emerald-200',
  },
  {
    value: 'bookings',
    label: 'Reservaciones',
    description: 'Agenda publica integrada con el calendario',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.1"/>
        <rect x="8" y="10" width="24" height="22" rx="3" stroke="currentColor" strokeWidth="2"/>
        <path d="M8 16h24M14 8v4M26 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="20" cy="24" r="3" fill="currentColor"/>
      </svg>
    ),
    features: ['Agenda publica', 'Disponibilidad en vivo', 'Confirmaciones automaticas'],
    accentBg: 'bg-orange-50',
    accentText: 'text-orange-700',
    accentBorder: 'border-orange-500',
    accentRing: 'ring-orange-200',
  },
]

const FONTS = [
  { value: 'Inter',            label: 'Inter',            family: 'Inter, sans-serif' },
  { value: 'Playfair Display', label: 'Playfair Display', family: "'Playfair Display', serif" },
  { value: 'Space Grotesk',    label: 'Space Grotesk',    family: "'Space Grotesk', sans-serif" },
  { value: 'DM Sans',          label: 'DM Sans',          family: "'DM Sans', sans-serif" },
  { value: 'Merriweather',     label: 'Merriweather',     family: "'Merriweather', serif" },
]

const STEPS = [
  { n: 1, label: 'Tipo de sitio' },
  { n: 2, label: 'Identidad' },
  { n: 3, label: 'Plantilla' },
]

const FIVE_MB = 5 * 1024 * 1024

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <circle cx="10" cy="10" r="10" fill="currentColor"/>
      <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── LogoZone sub-component (adapted from CompanyBranding) ───────────────────

function LogoZone({ logoFile, logoPreviewUrl, companyLogoUrl, useCompanyLogo, onFile, onUseCompany, onRemove }) {
  const [isDragging, setIsDragging] = useState(false)
  const [sizeError, setSizeError]   = useState('')
  const inputRef = useRef(null)

  const handleFile = useCallback((file) => {
    setSizeError('')
    if (!file) return
    if (file.size > FIVE_MB) { setSizeError('Archivo demasiado grande. Maximo 5 MB'); return }
    onFile(file)
  }, [onFile])

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }

  const displayUrl = logoPreviewUrl ?? (useCompanyLogo ? companyLogoUrl : null)
  const hasLogo    = Boolean(displayUrl)

  if (hasLogo) {
    return (
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-xl border-2 border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
          <img src={displayUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1"/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            {logoFile ? logoFile.name : 'Logo de la empresa'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : 'Se usara como logo del sitio'}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
              Cambiar logo
            </button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={onRemove}
              className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">
              Quitar
            </button>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="sr-only"/>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {companyLogoUrl && (
        <button type="button" onClick={onUseCompany}
          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-400 transition-all text-left">
          <div className="w-10 h-10 rounded-lg border border-indigo-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
            <img src={companyLogoUrl} alt="Logo empresa" className="max-w-full max-h-full object-contain p-0.5"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-700">Usar logo de la empresa</p>
            <p className="text-xs text-indigo-400">El mismo logo configurado en Empresa</p>
          </div>
          <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-indigo-400 shrink-0">
            <path d="M7 10h6M10 7l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      <div
        role="button" tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 px-4 text-center cursor-pointer transition-all select-none ${
          isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-gray-50'
        }`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDragging ? 'bg-indigo-100' : 'bg-gray-100'}`}>
          <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${isDragging ? 'text-indigo-600' : 'text-gray-400'}`}>
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4-4 4M12 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">Subir logo propio</p>
          <p className="text-xs text-gray-400">PNG, SVG o WebP · Max 5 MB</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="sr-only"/>
      </div>
      {sizeError && <p className="text-xs text-red-500">{sizeError}</p>}
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function WebsiteSiteWizard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const [step, setStep]         = useState(1)
  const [siteType, setSiteType] = useState('')

  const [identity, setIdentity] = useState({
    name:         '',
    primaryColor: '#4F46E5',
    bgColor:      '#FFFFFF',
    font:         'Inter',
  })

  const [logoFile,          setLogoFile]          = useState(null)
  const [logoPreviewUrl,    setLogoPreviewUrl]    = useState(null)
  const [useCompanyLogo,    setUseCompanyLogo]    = useState(false)
  const [suggestedColors,   setSuggestedColors]   = useState(PRESET_COLORS)
  const [companyLogoColors, setCompanyLogoColors] = useState([])

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedPages,    setSelectedPages]    = useState([])

  // Fetch company branding for default logo
  const brandingQuery = useQuery({
    queryKey: ['company-branding-wizard'],
    queryFn:  () => apiFetch('/company/branding', token),
    enabled:  Boolean(token),
    staleTime: 60_000,
  })
  const companyLogoUrl = brandingQuery.data?.data?.logoUrl ?? null

  // Pre-extract colors from company logo as blob (avoids canvas CORS taint on signed URLs)
  useEffect(() => {
    if (!companyLogoUrl) return
    let cancelled = false
    extractColorsFromBlobUrl(companyLogoUrl).then((colors) => {
      if (!cancelled) setCompanyLogoColors(colors)
    })
    return () => { cancelled = true }
  }, [companyLogoUrl])

  // Apply pre-extracted company logo colors when user picks it
  useEffect(() => {
    if (!useCompanyLogo) return
    if (companyLogoColors.length >= 3) setSuggestedColors(companyLogoColors)
  }, [useCompanyLogo, companyLogoColors])

  // Extract colors from custom logo file (blob URL → no CORS issue)
  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null)
      if (!useCompanyLogo) setSuggestedColors(PRESET_COLORS)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreviewUrl(url)
    extractColorsFromFile(logoFile).then((colors) => {
      setSuggestedColors(colors.length >= 3 ? colors : PRESET_COLORS)
    })
    return () => URL.revokeObjectURL(url)
  }, [logoFile]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTemplateSelect(tpl) {
    setSelectedTemplate(tpl)
    setSelectedPages(tpl.pages.map((p) => p.id))
  }

  function handleLogoRemove() {
    setLogoFile(null)
    setLogoPreviewUrl(null)
    setUseCompanyLogo(false)
    setSuggestedColors(PRESET_COLORS)
  }

  function handleUseCompanyLogo() {
    setLogoFile(null)
    setLogoPreviewUrl(null)
    setUseCompanyLogo(true)
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

      // Upload custom logo if provided
      let logoFileId = null
      if (logoFile) {
        const formData = new FormData()
        formData.append('file', logoFile)
        formData.append('moduleKey', 'atlas.website')
        formData.append('entityType', 'WebsiteSite')
        const uploadRes = await fetch(`${getApiUrl()}/files/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          logoFileId = uploadData.data?.id ?? null
        }
      }

      // Patch site with logo + settings
      if (logoFileId || useCompanyLogo) {
        await apiFetch(`/website/site/${site.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({
            settings: {
              logoFileId:     logoFileId,
              useCompanyLogo: useCompanyLogo && !logoFileId,
            },
          }),
        })
      }

      let firstPageId = null
      if (selectedTemplate) {
        const pagesToCreate = selectedTemplate.pages.filter((p) => selectedPages.includes(p.id))
        for (const p of pagesToCreate) {
          const rawSlug = p.routePath.replace(/^\//, '').replace(/[^a-z0-9-]/g, '-') || 'inicio'
          // 1. Create the page record
          const pageRes = await apiFetch('/website/pages', token, {
            method: 'POST',
            body: JSON.stringify({
              siteId:    site.id,
              title:     p.label,
              slug:      rawSlug,
              routePath: p.routePath,
            }),
          })
          const created = pageRes.data ?? pageRes
          if (!firstPageId) firstPageId = created.id
          // 2. Save template content as draft
          if (p.page) {
            await apiFetch(`/website/pages/${created.id}/draft`, token, {
              method: 'POST',
              body: JSON.stringify({ draft_builder_data: serializePage(p.page) }),
            })
          }
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
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #f8f7ff 0%, #ffffff 50%, #f0fdf4 100%)' }}>

      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }}/>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #34d399 0%, transparent 70%)' }}/>
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Nuevo sitio web</h1>
          <p className="text-gray-500 mt-1 text-sm">Configura tu presencia digital en 3 pasos</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shadow-sm"
                  style={{
                    background: step > s.n ? '#22c55e' : step === s.n ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#e5e7eb',
                    color: step >= s.n ? 'white' : '#9ca3af',
                  }}>
                  {step > s.n
                    ? <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4"><path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : s.n}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${step === s.n ? 'text-indigo-600' : 'text-gray-400'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-20 h-0.5 mx-2 mb-5 rounded-full transition-all duration-500"
                  style={{ background: step > s.n ? '#22c55e' : '#e5e7eb' }}/>
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/80 border border-gray-100 overflow-hidden">

          {/* ── Step 1: Tipo de sitio ── */}
          {step === 1 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Tipo de sitio</h2>
                <p className="text-gray-500 text-sm mt-0.5">Elige el proposito principal de tu sitio</p>
              </div>
              <div className="grid gap-3">
                {SITE_TYPES.map((t) => {
                  const isSelected = siteType === t.value
                  return (
                    <button key={t.value} type="button" onClick={() => setSiteType(t.value)}
                      className={`group relative text-left rounded-2xl border-2 p-5 transition-all duration-200 ${
                        isSelected
                          ? `${t.accentBorder} ${t.accentBg} shadow-md ring-4 ${t.accentRing}`
                          : 'border-gray-100 hover:border-gray-200 hover:shadow-md bg-gray-50/50 hover:bg-white'
                      }`}>
                      <div className="flex items-start gap-4">
                        <div className={`shrink-0 transition-colors ${isSelected ? t.accentText : 'text-gray-400 group-hover:text-gray-600'}`}>
                          {t.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`font-semibold text-base transition-colors ${isSelected ? t.accentText : 'text-gray-800'}`}>
                              {t.label}
                            </p>
                            {isSelected && <div className={`shrink-0 ${t.accentText}`}><CheckIcon /></div>}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {t.features.map((f) => (
                              <span key={f} className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                                isSelected
                                  ? `${t.accentText} ${t.accentBg} border ${t.accentBorder}`
                                  : 'text-gray-500 bg-white border border-gray-200'
                              }`}>{f}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-6">
                <button type="button" disabled={!siteType} onClick={() => setStep(2)}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  style={{ background: siteType ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#e5e7eb' }}>
                  Siguiente paso
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Identidad visual ── */}
          {step === 2 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Identidad visual</h2>
                <p className="text-gray-500 text-sm mt-0.5">Logo, nombre y paleta de colores de tu sitio</p>
              </div>
              <div className="space-y-6">

                {/* Logo */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Logo del sitio</label>
                  <LogoZone
                    logoFile={logoFile}
                    logoPreviewUrl={logoPreviewUrl}
                    companyLogoUrl={companyLogoUrl}
                    useCompanyLogo={useCompanyLogo}
                    onFile={(file) => { setUseCompanyLogo(false); setLogoFile(file) }}
                    onUseCompany={handleUseCompanyLogo}
                    onRemove={handleLogoRemove}
                  />
                </div>

                <hr className="border-gray-100"/>

                {/* Nombre */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del sitio</label>
                  <input
                    type="text"
                    placeholder="Ej. Mi empresa S.A."
                    value={identity.name}
                    onChange={(e) => setIdentity((i) => ({ ...i, name: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
                  />
                </div>

                {/* Colores */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Color primario</label>
                    <div className="flex items-center gap-2.5 border-2 border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                      <div className="relative">
                        <input type="color" value={identity.primaryColor}
                          onChange={(e) => setIdentity((i) => ({ ...i, primaryColor: e.target.value }))}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                        <div className="w-8 h-8 rounded-lg shadow-sm border border-white border-opacity-50"
                          style={{ background: identity.primaryColor }}/>
                      </div>
                      <input type="text" value={identity.primaryColor}
                        onChange={(e) => setIdentity((i) => ({ ...i, primaryColor: e.target.value }))}
                        className="flex-1 text-sm font-mono text-gray-700 outline-none bg-transparent"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Color de fondo</label>
                    <div className="flex items-center gap-2.5 border-2 border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                      <div className="relative">
                        <input type="color" value={identity.bgColor}
                          onChange={(e) => setIdentity((i) => ({ ...i, bgColor: e.target.value }))}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                        <div className="w-8 h-8 rounded-lg shadow-sm border border-gray-200"
                          style={{ background: identity.bgColor }}/>
                      </div>
                      <input type="text" value={identity.bgColor}
                        onChange={(e) => setIdentity((i) => ({ ...i, bgColor: e.target.value }))}
                        className="flex-1 text-sm font-mono text-gray-700 outline-none bg-transparent"/>
                    </div>
                  </div>
                </div>

                {/* Colores extraidos del logo */}
                {suggestedColors !== PRESET_COLORS && suggestedColors.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Colores extraidos del logo
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {suggestedColors.map((color) => (
                        <button key={color} type="button" onClick={() => setIdentity((i) => ({ ...i, primaryColor: color }))}
                          aria-label={`Usar ${color}`}
                          className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 ${
                            identity.primaryColor === color ? 'border-gray-800 scale-110 ring-2 ring-gray-800/20' : 'border-gray-200 hover:border-gray-400'
                          }`}
                          style={{ background: color }}/>
                      ))}
                    </div>
                  </div>
                )}

                {/* Colores predefinidos */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Colores predefinidos</p>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button key={color} type="button" onClick={() => setIdentity((i) => ({ ...i, primaryColor: color }))}
                        aria-label={`Usar ${color}`}
                        className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 ${
                          identity.primaryColor === color ? 'border-gray-800 scale-110 ring-2 ring-gray-800/20' : 'border-gray-200 hover:border-gray-400'
                        }`}
                        style={{ background: color }}/>
                    ))}
                  </div>
                </div>

                {/* Preview strip */}
                <div className="h-8 rounded-xl shadow-sm border border-gray-100 transition-all duration-300"
                  style={{ background: `linear-gradient(90deg, ${identity.primaryColor} 0%, ${identity.primaryColor}bb 40%, ${identity.bgColor} 100%)` }}/>

                {/* Tipografia */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipografia</label>
                  <div className="grid grid-cols-5 gap-2">
                    {FONTS.map((f) => (
                      <button key={f.value} type="button"
                        onClick={() => setIdentity((i) => ({ ...i, font: f.value }))}
                        className={`rounded-xl border-2 p-3 text-center transition-all duration-150 ${
                          identity.font === f.value
                            ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                        <p className="text-lg font-semibold text-gray-800 leading-none" style={{ fontFamily: f.family }}>Aa</p>
                        <p className="text-[10px] text-gray-500 mt-1.5 leading-tight truncate">{f.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-3.5 rounded-2xl font-semibold text-sm text-gray-600 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
                  Atras
                </button>
                <button type="button" disabled={!identity.name.trim()} onClick={() => setStep(3)}
                  className="flex-1 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  style={{ background: identity.name.trim() ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#e5e7eb' }}>
                  Siguiente paso
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Plantilla ── */}
          {step === 3 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Elige una plantilla</h2>
                <p className="text-gray-500 text-sm mt-0.5">O empieza desde cero con una pagina en blanco</p>
              </div>

              {!selectedTemplate ? (
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                  {allTemplates.map((tpl) => (
                    <button key={tpl.id} type="button" onClick={() => handleTemplateSelect(tpl)}
                      className="text-left rounded-2xl border-2 border-gray-100 hover:border-indigo-400 hover:shadow-lg overflow-hidden transition-all duration-200 group bg-white">
                      <div className="h-24 relative overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${tpl.color}, ${tpl.color}aa)` }}>
                        <div className="absolute inset-0 opacity-10"
                          style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px' }}/>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg viewBox="0 0 44 30" fill="none" className="w-11 h-8 text-white opacity-70">
                            <rect x="1" y="1" width="42" height="28" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                            <rect x="4" y="5" width="15" height="5" rx="1" fill="currentColor" fillOpacity="0.8"/>
                            <rect x="4" y="12" width="24" height="2" rx="1" fill="currentColor" fillOpacity="0.5"/>
                            <rect x="4" y="16" width="20" height="2" rx="1" fill="currentColor" fillOpacity="0.5"/>
                            <rect x="4" y="21" width="12" height="5" rx="1" fill="currentColor" fillOpacity="0.6"/>
                          </svg>
                        </div>
                        <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                          {tpl.pages?.length ?? 0} pag
                        </div>
                      </div>
                      <div className="p-3.5">
                        <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{tpl.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tpl.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: selectedTemplate.color }}/>
                      <span className="text-sm font-semibold text-indigo-800">{selectedTemplate.label}</span>
                    </div>
                    <button type="button" onClick={() => setSelectedTemplate(null)}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors">
                      Cambiar plantilla
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2.5">Paginas a incluir</p>
                    <div className="space-y-2">
                      {selectedTemplate.pages.map((p) => (
                        <label key={p.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedPages.includes(p.id) ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50/50'
                          } ${p.required ? 'opacity-75' : ''}`}>
                          <input type="checkbox" checked={selectedPages.includes(p.id)} disabled={p.required}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedPages((prev) => [...prev, p.id])
                              else setSelectedPages((prev) => prev.filter((id) => id !== p.id))
                            }}
                            className="w-4 h-4 rounded accent-indigo-600"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{p.label}</p>
                            <p className="text-xs text-gray-400 font-mono">{p.routePath}</p>
                          </div>
                          {p.required && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Requerida</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(2)}
                  className="flex-1 py-3.5 rounded-2xl font-semibold text-sm text-gray-600 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
                  Atras
                </button>
                <button type="button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}
                  className="flex-1 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all duration-200 disabled:opacity-60 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                  {createMutation.isPending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Creando sitio...
                    </>
                  ) : selectedTemplate
                    ? `Crear con ${selectedPages.length} pagina${selectedPages.length !== 1 ? 's' : ''}`
                    : 'Crear sitio en blanco'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Puedes editar toda la configuracion despues desde el panel
        </p>
      </div>
    </div>
  )
}

# Atlas Website — Wizard & Nav Refactor (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 825-line WebsiteSiteWizard into focused step components, add new Mode and Info steps, make the wizard full-screen, and restructure the sidebar nav into collapsible groups.

**Architecture:** The wizard orchestrator (`WebsiteWizard.jsx`) manages all step state and the API mutation; each step is a pure presentational component under `screens/wizard/`. The nav restructure adds a `children` array to manifest items and updates `isPathAllowedByNavigation` to resolve child paths.

**Tech Stack:** React, Tailwind CSS, TanStack Query, React Hook Form + Zod, @atlas/ui, Hono API (unchanged).

**Prerequisite:** Run `pnpm dev:frontend` before verifying any task. All visual verification is manual in the browser at `http://localhost:5173`.

---

### Task 1: Manifest nav groups + isPathAllowedByNavigation fix

**Files:**
- Modify: `apps/api/src/manifests/official/feature-modules.js` (atlas.website navigation block, lines 317–374)
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx` (`isPathAllowedByNavigation` function, lines 242–255)

- [ ] **Step 1: Update the atlas.website manifest navigation**

Replace the flat 8-item navigation array with grouped children:

```js
// apps/api/src/manifests/official/feature-modules.js
// Replace the navigation: [...] block inside atlasWebsiteManifest

  navigation: [
    {
      label: 'Sitio web',
      path: '/app/m/atlas.website',
      icon: 'Globe',
      layout: 'main',
      permissionKey: 'website.access',
    },
    {
      label: 'Contenido',
      icon: 'BookOpen',
      layout: 'main',
      permissionKey: 'website.pages.read',
      children: [
        { label: 'Paginas',  path: '/pages', icon: 'FileText', permissionKey: 'website.pages.read' },
        { label: 'Blog',     path: '/blog',  icon: 'BookOpen', permissionKey: 'website.pages.read' },
      ],
    },
    {
      label: 'Diseno',
      icon: 'Palette',
      layout: 'main',
      permissionKey: 'website.theme.read',
      children: [
        { label: 'Tema',       path: '/theme',     icon: 'Palette',        permissionKey: 'website.theme.read' },
        { label: 'Plantillas', path: '/templates', icon: 'LayoutTemplate', permissionKey: 'website.pages.create' },
      ],
    },
    {
      label: 'Negocio',
      icon: 'CreditCard',
      layout: 'main',
      permissionKey: 'website.site.update',
      children: [
        { label: 'Formularios', path: '/forms',    icon: 'FormInput',  permissionKey: 'website.pages.read' },
        { label: 'Pagos',       path: '/payments', icon: 'CreditCard', permissionKey: 'website.site.update' },
      ],
    },
    {
      label: 'Configuracion',
      path: '/settings',
      icon: 'Settings',
      layout: 'main',
      permissionKey: 'website.site.update',
    },
  ],
```

- [ ] **Step 2: Fix isPathAllowedByNavigation to handle children**

Replace the `isPathAllowedByNavigation` function in `apps/desktop/src/app/ModuleOutlet.jsx`:

```js
function isPathAllowedByNavigation(module, subPath) {
  const navigation = module?.navigation ?? [];
  if (!navigation.length) return subPath === '/';
  if (subPath === '/') return true;

  const modulePrefix = `/app/m/${module.key}`;

  function pathMatches(navPath) {
    if (!navPath) return false;
    if (navPath === '/') return true;
    // Normalize full paths to relative
    const rel = navPath.startsWith(modulePrefix)
      ? (navPath.slice(modulePrefix.length) || '/')
      : navPath;
    if (rel === '/') return false; // root handled above
    return subPath === rel || subPath.startsWith(`${rel}/`);
  }

  function itemAllows(item) {
    if (pathMatches(item?.path)) return true;
    return (item?.children ?? []).some((child) => pathMatches(child?.path));
  }

  return navigation.some(itemAllows);
}
```

- [ ] **Step 3: Restart API and frontend, verify nav renders correctly**

```bash
# Stop existing dev servers, then:
pnpm dev
```

Open `http://localhost:5173`, navigate to Sitio web. Verify:
- Sidebar shows "Contenido" group with Paginas and Blog underneath
- "Diseno" group with Tema and Plantillas
- "Negocio" group with Formularios and Pagos
- "Configuracion" as standalone item
- Clicking each nav item navigates correctly without "Acceso restringido" error

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/manifests/official/feature-modules.js apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(website): restructure nav into collapsible groups with children"
```

---

### Task 2: WizardStepMode.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepMode.jsx`

- [ ] **Step 1: Create the wizard subfolder and WizardStepMode.jsx**

```jsx
// apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepMode.jsx
import { Globe, Upload } from 'lucide-react'

const MODES = [
  {
    value: 'web_builder',
    label: 'Web Builder',
    description: 'Editor visual de paginas, bloques y plantillas.',
    icon: Globe,
    features: ['Editor visual', 'Plantillas prediseñadas', 'Blog y formularios'],
  },
  {
    value: 'zip',
    label: 'Subir ZIP / Pre-render',
    description: 'Sube el dist de tu proyecto ya compilado.',
    icon: Upload,
    features: ['Sitio estatico personalizado', 'Cualquier framework', 'Sin editor visual'],
  },
]

export function WizardStepMode({ value, onNext }) {
  return (
    <div className="space-y-3">
      {MODES.map((mode) => {
        const Icon = mode.icon
        const selected = value === mode.value
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onNext(mode.value)}
            className={`w-full text-left rounded-2xl border-2 p-5 transition-all duration-200 ${
              selected
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:border-primary/40 hover:bg-muted/40'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 mt-0.5 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-base ${selected ? 'text-primary' : 'text-foreground'}`}>
                  {mode.label}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{mode.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {mode.features.map((f) => (
                    <span
                      key={f}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                        selected
                          ? 'border-primary/30 text-primary bg-primary/10'
                          : 'border-border text-muted-foreground bg-background'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepMode.jsx
git commit -m "feat(website): add WizardStepMode component (web_builder / zip)"
```

---

### Task 3: WizardStepInfo.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepInfo.jsx`

- [ ] **Step 1: Create WizardStepInfo.jsx**

```jsx
// apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepInfo.jsx
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, TextareaField, CreatableComboboxField } from '@atlas/ui'

const GIROS = [
  { value: 'restaurantes', label: 'Restaurantes y alimentos' },
  { value: 'spa',          label: 'Spa y bienestar' },
  { value: 'ecommerce',    label: 'Comercio electronico' },
  { value: 'servicios',    label: 'Servicios profesionales' },
  { value: 'agencia',      label: 'Agencia creativa' },
  { value: 'salud',        label: 'Salud y medicina' },
  { value: 'educacion',    label: 'Educacion' },
  { value: 'hosteleria',   label: 'Hosteleria y turismo' },
  { value: 'tecnologia',   label: 'Tecnologia' },
  { value: 'construccion', label: 'Construccion' },
  { value: 'legal',        label: 'Servicios legales' },
  { value: 'moda',         label: 'Moda y ropa' },
]

const schema = z.object({
  name:        z.string().min(1, 'Requerido').max(255),
  domain:      z.string().max(255).optional(),
  giro:        z.string().max(100).optional(),
  description: z.string().max(500).optional(),
})

export function WizardStepInfo({ defaultValues, onNext, onBack }) {
  const { register, handleSubmit, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { name: '', domain: '', giro: '', description: '' },
  })

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <TextField
        label="Nombre del sitio"
        placeholder="Mi empresa S.A."
        required
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Dominio"
        placeholder="misitioweb.com"
        hint="Puedes configurarlo despues si aun no lo tienes."
        {...register('domain')}
      />
      <Controller
        name="giro"
        control={control}
        render={({ field }) => (
          <CreatableComboboxField
            label="Giro o sector"
            placeholder="Buscar o escribir giro..."
            options={GIROS}
            value={field.value}
            onChange={field.onChange}
            onCreate={(newVal) => field.onChange(newVal)}
          />
        )}
      />
      <TextareaField
        label="Descripcion corta"
        placeholder="Breve descripcion de tu negocio o sitio."
        {...register('description')}
      />
      <div className="flex gap-3 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 rounded-xl font-semibold text-sm text-foreground border-2 border-border hover:bg-muted transition-all"
          >
            Atras
          </button>
        )}
        <button
          type="submit"
          className="flex-1 py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
        >
          Siguiente
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepInfo.jsx
git commit -m "feat(website): add WizardStepInfo with name, domain, giro, description fields"
```

---

### Task 4: WizardStepType.jsx (dark-safe)

**Files:**
- Create: `apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepType.jsx`

- [ ] **Step 1: Create WizardStepType.jsx using semantic Tailwind tokens**

The existing `SITE_TYPES` in `WebsiteSiteWizard.jsx` use hardcoded colors like `bg-violet-50` that break in dark mode. Replace with semantic pairs (`dark:` variants).

```jsx
// apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepType.jsx

const SITE_TYPES = [
  {
    value: 'website',
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
    accent: 'violet',
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
    accent: 'emerald',
  },
  {
    value: 'blog',
    label: 'Blog / Contenido',
    description: 'Publicaciones, articulos y marketing de contenidos',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.1"/>
        <path d="M8 14h24M8 20h18M8 26h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    features: ['Posts y articulos', 'Categorias y etiquetas', 'RSS'],
    accent: 'orange',
  },
  {
    value: 'landing',
    label: 'Landing page',
    description: 'Pagina de captura con llamada a la accion',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.1"/>
        <rect x="8" y="10" width="24" height="22" rx="3" stroke="currentColor" strokeWidth="2"/>
        <path d="M14 22h12M14 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <rect x="13" y="25" width="14" height="4" rx="2" fill="currentColor" fillOpacity="0.4"/>
      </svg>
    ),
    features: ['Hero visual', 'CTA destacado', 'Formulario integrado'],
    accent: 'sky',
  },
]

// Maps accent name to Tailwind class pairs (light + dark)
const ACCENT_CLASSES = {
  violet: {
    selected: 'border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-950/30 ring-violet-200 dark:ring-violet-800/40',
    text:     'text-violet-700 dark:text-violet-300',
    badge:    'border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40',
  },
  emerald: {
    selected: 'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-emerald-200 dark:ring-emerald-800/40',
    text:     'text-emerald-700 dark:text-emerald-300',
    badge:    'border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40',
  },
  orange: {
    selected: 'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-950/30 ring-orange-200 dark:ring-orange-800/40',
    text:     'text-orange-700 dark:text-orange-300',
    badge:    'border-orange-300 dark:border-orange-600 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40',
  },
  sky: {
    selected: 'border-sky-500 dark:border-sky-400 bg-sky-50 dark:bg-sky-950/30 ring-sky-200 dark:ring-sky-800/40',
    text:     'text-sky-700 dark:text-sky-300',
    badge:    'border-sky-300 dark:border-sky-600 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40',
  },
}

export function WizardStepType({ value, onNext, onBack }) {
  return (
    <div className="space-y-3">
      {SITE_TYPES.map((t) => {
        const isSelected = value === t.value
        const ac = ACCENT_CLASSES[t.accent]
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onNext(t.value)}
            className={`w-full group text-left rounded-2xl border-2 p-5 transition-all duration-200 ${
              isSelected
                ? `${ac.selected} ring-4`
                : 'border-border hover:border-border/80 hover:shadow-md bg-card/50 hover:bg-card'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 transition-colors ${isSelected ? ac.text : 'text-muted-foreground group-hover:text-foreground'}`}>
                {t.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-base transition-colors ${isSelected ? ac.text : 'text-foreground'}`}>
                  {t.label}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {t.features.map((f) => (
                    <span
                      key={f}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                        isSelected ? ac.badge : 'text-muted-foreground bg-background border-border'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        )
      })}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-foreground border-2 border-border hover:bg-muted transition-all"
        >
          Atras
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepType.jsx
git commit -m "feat(website): add WizardStepType with dark-safe accent colors"
```

---

### Task 5: colorExtract utility + WizardStepIdentity.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.website/lib/colorExtract.js`
- Create: `apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepIdentity.jsx`

- [ ] **Step 1: Extract color utility from WebsiteSiteWizard.jsx**

```js
// apps/desktop/src/modules/atlas.website/lib/colorExtract.js

export function extractColorsFromImageEl(img, count = 8) {
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

export function extractColorsFromFile(file, count = 8) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { resolve(extractColorsFromImageEl(img, count)); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve([]); URL.revokeObjectURL(url) }
    img.src = url
  })
}

export async function extractColorsFromBlobUrl(url, count = 8) {
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const blob = await res.blob()
    return extractColorsFromFile(blob, count)
  } catch { return [] }
}

export const PRESET_COLORS = [
  '#4F46E5', '#0A7BFF', '#6C3BFF', '#A80070',
  '#E8330A', '#F59E0B', '#10B981', '#0EA5E9',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
]
```

- [ ] **Step 2: Create WizardStepIdentity.jsx**

```jsx
// apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepIdentity.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { extractColorsFromFile, extractColorsFromBlobUrl, PRESET_COLORS } from '../../lib/colorExtract.js'

const FONTS = [
  { value: 'Inter',            label: 'Inter',            family: 'Inter, sans-serif' },
  { value: 'Playfair Display', label: 'Playfair Display', family: "'Playfair Display', serif" },
  { value: 'Space Grotesk',    label: 'Space Grotesk',    family: "'Space Grotesk', sans-serif" },
  { value: 'DM Sans',          label: 'DM Sans',          family: "'DM Sans', sans-serif" },
  { value: 'Merriweather',     label: 'Merriweather',     family: "'Merriweather', serif" },
]

const FIVE_MB = 5 * 1024 * 1024

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

  if (displayUrl) {
    return (
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-xl border-2 border-border bg-card flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
          <img src={displayUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1"/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {logoFile ? logoFile.name : 'Logo de la empresa'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : 'Se usara como logo del sitio'}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              Cambiar logo
            </button>
            <span className="text-muted-foreground">|</span>
            <button type="button" onClick={onRemove}
              className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors">
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
          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all text-left">
          <div className="w-10 h-10 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
            <img src={companyLogoUrl} alt="Logo empresa" className="max-w-full max-h-full object-contain p-0.5"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">Usar logo de la empresa</p>
            <p className="text-xs text-muted-foreground">El mismo logo configurado en Empresa</p>
          </div>
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
          isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
        }`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDragging ? 'bg-primary/10' : 'bg-muted'}`}>
          <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}>
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4-4 4M12 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Subir logo propio</p>
          <p className="text-xs text-muted-foreground">PNG, SVG o WebP · Max 5 MB</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="sr-only"/>
      </div>
      {sizeError && <p className="text-xs text-destructive">{sizeError}</p>}
    </div>
  )
}

export function WizardStepIdentity({ defaultValues, companyLogoUrl, onNext, onBack }) {
  const [identity, setIdentity] = useState(defaultValues ?? {
    primaryColor: '#4F46E5',
    bgColor: '#FFFFFF',
    font: 'Inter',
  })
  const [logoFile,        setLogoFile]        = useState(null)
  const [logoPreviewUrl,  setLogoPreviewUrl]  = useState(null)
  const [useCompanyLogo,  setUseCompanyLogo]  = useState(false)
  const [suggestedColors, setSuggestedColors] = useState(PRESET_COLORS)

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

  useEffect(() => {
    if (!useCompanyLogo || !companyLogoUrl) return
    extractColorsFromBlobUrl(companyLogoUrl).then((colors) => {
      if (colors.length >= 3) setSuggestedColors(colors)
    })
  }, [useCompanyLogo, companyLogoUrl])

  function handleSubmit() {
    onNext({ ...identity, logoFile, useCompanyLogo })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Logo del sitio</label>
        <LogoZone
          logoFile={logoFile}
          logoPreviewUrl={logoPreviewUrl}
          companyLogoUrl={companyLogoUrl}
          useCompanyLogo={useCompanyLogo}
          onFile={(f) => { setUseCompanyLogo(false); setLogoFile(f) }}
          onUseCompany={() => { setLogoFile(null); setLogoPreviewUrl(null); setUseCompanyLogo(true) }}
          onRemove={() => { setLogoFile(null); setLogoPreviewUrl(null); setUseCompanyLogo(false); setSuggestedColors(PRESET_COLORS) }}
        />
      </div>

      <hr className="border-border"/>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">Color primario</label>
          <div className="flex items-center gap-2.5 border-2 border-border rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all bg-background">
            <div className="relative">
              <input type="color" value={identity.primaryColor}
                onChange={(e) => setIdentity((i) => ({ ...i, primaryColor: e.target.value }))}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
              <div className="w-8 h-8 rounded-lg shadow-sm border border-border/50" style={{ background: identity.primaryColor }}/>
            </div>
            <input type="text" value={identity.primaryColor}
              onChange={(e) => setIdentity((i) => ({ ...i, primaryColor: e.target.value }))}
              className="flex-1 text-sm font-mono text-foreground outline-none bg-transparent"/>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">Color de fondo</label>
          <div className="flex items-center gap-2.5 border-2 border-border rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all bg-background">
            <div className="relative">
              <input type="color" value={identity.bgColor}
                onChange={(e) => setIdentity((i) => ({ ...i, bgColor: e.target.value }))}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
              <div className="w-8 h-8 rounded-lg shadow-sm border border-border" style={{ background: identity.bgColor }}/>
            </div>
            <input type="text" value={identity.bgColor}
              onChange={(e) => setIdentity((i) => ({ ...i, bgColor: e.target.value }))}
              className="flex-1 text-sm font-mono text-foreground outline-none bg-transparent"/>
          </div>
        </div>
      </div>

      {suggestedColors !== PRESET_COLORS && suggestedColors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Colores extraidos del logo</p>
          <div className="flex gap-2 flex-wrap">
            {suggestedColors.map((color) => (
              <button key={color} type="button" onClick={() => setIdentity((i) => ({ ...i, primaryColor: color }))}
                aria-label={`Usar ${color}`}
                className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 ${
                  identity.primaryColor === color ? 'border-foreground scale-110 ring-2 ring-foreground/20' : 'border-border hover:border-foreground/40'
                }`}
                style={{ background: color }}/>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Colores predefinidos</p>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button key={color} type="button" onClick={() => setIdentity((i) => ({ ...i, primaryColor: color }))}
              aria-label={`Usar ${color}`}
              className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 ${
                identity.primaryColor === color ? 'border-foreground scale-110 ring-2 ring-foreground/20' : 'border-border hover:border-foreground/40'
              }`}
              style={{ background: color }}/>
          ))}
        </div>
      </div>

      <div className="h-8 rounded-xl border border-border transition-all duration-300"
        style={{ background: `linear-gradient(90deg, ${identity.primaryColor} 0%, ${identity.primaryColor}bb 40%, ${identity.bgColor} 100%)` }}/>

      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Tipografia</label>
        <div className="grid grid-cols-5 gap-2">
          {FONTS.map((f) => (
            <button key={f.value} type="button"
              onClick={() => setIdentity((i) => ({ ...i, font: f.value }))}
              className={`rounded-xl border-2 p-3 text-center transition-all duration-150 ${
                identity.font === f.value
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-border/80 bg-card'
              }`}>
              <p className="text-lg font-semibold text-foreground leading-none" style={{ fontFamily: f.family }}>Aa</p>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight truncate">{f.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-foreground border-2 border-border hover:bg-muted transition-all">
          Atras
        </button>
        <button type="button" onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
          Siguiente
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/lib/colorExtract.js apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepIdentity.jsx
git commit -m "feat(website): add colorExtract utility and dark-safe WizardStepIdentity"
```

---

### Task 6: WizardStepTemplate.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepTemplate.jsx`

- [ ] **Step 1: Create WizardStepTemplate.jsx**

```jsx
// apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepTemplate.jsx
import { useState } from 'react'
import { allTemplates } from '../../../../website/atlasTemplates/index.js'

export function WizardStepTemplate({ onNext, onBack, isPending }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedPages,    setSelectedPages]    = useState([])

  function handleSelect(tpl) {
    setSelectedTemplate(tpl)
    setSelectedPages(tpl.pages.map((p) => p.id))
  }

  function handleSubmit() {
    onNext({ template: selectedTemplate, selectedPages })
  }

  return (
    <div className="space-y-4">
      {!selectedTemplate ? (
        <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
          {allTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleSelect(tpl)}
              className="text-left rounded-2xl border-2 border-border hover:border-primary/40 hover:shadow-lg overflow-hidden transition-all duration-200 group bg-card"
            >
              <div className="h-24 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${tpl.color}, ${tpl.color}aa)` }}>
                <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                  {tpl.pages?.length ?? 0} pag
                </div>
              </div>
              <div className="p-3.5">
                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{tpl.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full" style={{ background: selectedTemplate.color }}/>
              <span className="text-sm font-semibold text-primary">{selectedTemplate.label}</span>
            </div>
            <button type="button" onClick={() => setSelectedTemplate(null)}
              className="text-xs text-primary/70 hover:text-primary font-semibold transition-colors">
              Cambiar plantilla
            </button>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-2.5">Paginas a incluir</p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {selectedTemplate.pages.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedPages.includes(p.id) ? 'border-primary/30 bg-primary/5' : 'border-border bg-card/50'
                  } ${p.required ? 'opacity-75' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPages.includes(p.id)}
                    disabled={p.required}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedPages((prev) => [...prev, p.id])
                      else setSelectedPages((prev) => prev.filter((id) => id !== p.id))
                    }}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.routePath}</p>
                  </div>
                  {p.required && (
                    <span className="text-xs bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                      Requerida
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-foreground border-2 border-border hover:bg-muted transition-all">
          Atras
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
        >
          {isPending ? (
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
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/wizard/WizardStepTemplate.jsx
git commit -m "feat(website): add WizardStepTemplate component"
```

---

### Task 7: WebsiteWizard.jsx orchestrator + wire up in Overview

**Files:**
- Create: `apps/desktop/src/modules/atlas.website/screens/WebsiteWizard.jsx`
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx` (import + usage)
- Delete: `apps/desktop/src/modules/atlas.website/screens/WebsiteSiteWizard.jsx`

- [ ] **Step 1: Create WebsiteWizard.jsx**

```jsx
// apps/desktop/src/modules/atlas.website/screens/WebsiteWizard.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { defineTheme, defaultTheme, serializePage } from '@raulbellosom/atlas-web-builder'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { WizardStepMode }     from './wizard/WizardStepMode.jsx'
import { WizardStepInfo }     from './wizard/WizardStepInfo.jsx'
import { WizardStepType }     from './wizard/WizardStepType.jsx'
import { WizardStepIdentity } from './wizard/WizardStepIdentity.jsx'
import { WizardStepTemplate } from './wizard/WizardStepTemplate.jsx'

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

// Steps for each mode
const STEPS_WEB = ['mode', 'info', 'type', 'identity', 'template']
const STEPS_ZIP = ['mode', 'info']

const STEP_META = {
  mode:     { n: 1, label: 'Modo' },
  info:     { n: 2, label: 'Informacion' },
  type:     { n: 3, label: 'Tipo de sitio' },
  identity: { n: 4, label: 'Identidad' },
  template: { n: 5, label: 'Plantilla' },
}

export default function WebsiteWizard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const [stepIdx, setStepIdx] = useState(0)
  const [data, setData] = useState({
    mode:     null,
    info:     { name: '', domain: '', giro: '', description: '' },
    siteType: 'website',
    identity: { primaryColor: '#4F46E5', bgColor: '#FFFFFF', font: 'Inter', logoFile: null, useCompanyLogo: false },
    template: null,
    selectedPages: [],
  })

  const steps = data.mode === 'zip' ? STEPS_ZIP : STEPS_WEB
  const currentStep = steps[stepIdx]

  // Fetch company branding for logo suggestion in identity step
  const brandingQuery = useQuery({
    queryKey: ['company-branding-wizard'],
    queryFn:  () => apiFetch('/company/branding', token),
    enabled:  Boolean(token),
    staleTime: 60_000,
  })
  const companyLogoUrl = brandingQuery.data?.data?.logoUrl ?? null

  const createMutation = useMutation({
    mutationFn: async (finalData) => {
      // 1. Create site
      const siteRes = await apiFetch('/website/site', token, {
        method: 'POST',
        body: JSON.stringify({
          name:     finalData.info.name,
          domain:   finalData.info.domain || undefined,
          siteType: finalData.siteType,
        }),
      })
      const site = siteRes.data ?? siteRes

      // 2. Store giro + buildMode in settings
      if (finalData.info.giro || finalData.mode) {
        await apiFetch(`/website/site/${site.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({
            settings: {
              giro:      finalData.info.giro || null,
              buildMode: finalData.mode,
            },
          }),
        })
      }

      if (finalData.mode === 'zip') {
        return { siteId: site.id, firstPageId: null, mode: 'zip' }
      }

      // 3. Web Builder: create theme
      const themeTokens = {
        ...defaultTheme.tokens,
        color: {
          ...defaultTheme.tokens?.color,
          primary: finalData.identity.primaryColor,
          bg:      finalData.identity.bgColor,
        },
      }
      const builtTheme = defineTheme({ ...defaultTheme, id: 'atlas-site', name: 'Site Theme', tokens: themeTokens })
      await apiFetch('/website/theme', token, {
        method: 'POST',
        body: JSON.stringify({ site_id: site.id, tokens: builtTheme.tokens, typography: finalData.identity.font }),
      })

      // 4. Upload custom logo if provided
      let logoFileId = null
      if (finalData.identity.logoFile) {
        const formData = new FormData()
        formData.append('file', finalData.identity.logoFile)
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
      if (logoFileId || finalData.identity.useCompanyLogo) {
        await apiFetch(`/website/site/${site.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({
            settings: {
              logoFileId,
              useCompanyLogo: finalData.identity.useCompanyLogo && !logoFileId,
              giro: finalData.info.giro || null,
              buildMode: finalData.mode,
            },
          }),
        })
      }

      // 5. Create pages from template
      let firstPageId = null
      if (finalData.template) {
        const pagesToCreate = finalData.template.pages.filter((p) => finalData.selectedPages.includes(p.id))
        for (const p of pagesToCreate) {
          const rawSlug = p.routePath.replace(/^\//, '').replace(/[^a-z0-9-]/g, '-') || 'inicio'
          const pageRes = await apiFetch('/website/pages', token, {
            method: 'POST',
            body: JSON.stringify({ siteId: site.id, title: p.label, slug: rawSlug, routePath: p.routePath }),
          })
          const created = pageRes.data ?? pageRes
          if (!firstPageId) firstPageId = created.id
          if (p.page) {
            await apiFetch(`/website/pages/${created.id}/draft`, token, {
              method: 'POST',
              body: JSON.stringify({ draft_builder_data: serializePage(p.page) }),
            })
          }
        }
      }

      return { siteId: site.id, firstPageId, mode: 'web_builder' }
    },
    onSuccess: ({ firstPageId, mode }) => {
      toast.success('Sitio creado correctamente')
      queryClient.invalidateQueries({ queryKey: ['website-site'] })
      if (mode === 'zip') {
        navigate('/app/m/atlas.website/settings')
      } else if (firstPageId) {
        navigate(`/app/m/atlas.website/pages/${firstPageId}/editor`)
      } else {
        navigate('/app/m/atlas.website/pages')
      }
    },
    onError: (err) => toast.error(err.message),
  })

  function advance(stepData) {
    const key = currentStep
    const newData = {
      ...data,
      ...(key === 'mode'     ? { mode: stepData }     : {}),
      ...(key === 'info'     ? { info: stepData }     : {}),
      ...(key === 'type'     ? { siteType: stepData } : {}),
      ...(key === 'identity' ? { identity: stepData } : {}),
      ...(key === 'template' ? stepData               : {}),
    }
    setData(newData)

    const newSteps = newData.mode === 'zip' ? STEPS_ZIP : STEPS_WEB
    const nextIdx = stepIdx + 1

    if (nextIdx >= newSteps.length) {
      createMutation.mutate(newData)
    } else {
      setStepIdx(nextIdx)
    }
  }

  function back() {
    setStepIdx((i) => Math.max(0, i - 1))
  }

  const displaySteps = data.mode === 'zip' ? STEPS_ZIP : STEPS_WEB

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background flex items-center justify-center p-6">
      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-lg bg-primary">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-primary-foreground">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Nuevo sitio web</h1>
          <p className="text-muted-foreground mt-1 text-sm">Configura tu presencia digital</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8">
          {displaySteps.map((s, i) => {
            const meta = STEP_META[s]
            const done = i < stepIdx
            const active = i === stepIdx
            return (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm ${
                    done   ? 'bg-green-500 text-white' :
                    active ? 'bg-primary text-primary-foreground' :
                             'bg-muted text-muted-foreground'
                  }`}>
                    {done
                      ? <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4"><path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : meta.n}
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                    {meta.label}
                  </span>
                </div>
                {i < displaySteps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 mb-5 rounded-full transition-all duration-500 ${done ? 'bg-green-500' : 'bg-border'}`}/>
                )}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
          <div className="p-8">
            {currentStep === 'mode' && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Modo de construccion</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Como vas a construir tu sitio</p>
              </div>
            )}
            {currentStep === 'info' && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Informacion del sitio</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Datos basicos de tu sitio web</p>
              </div>
            )}
            {currentStep === 'type' && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Tipo de sitio</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Elige el proposito principal</p>
              </div>
            )}
            {currentStep === 'identity' && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Identidad visual</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Logo, colores y tipografia</p>
              </div>
            )}
            {currentStep === 'template' && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Elige una plantilla</h2>
                <p className="text-muted-foreground text-sm mt-0.5">O empieza desde cero</p>
              </div>
            )}

            {currentStep === 'mode' && (
              <WizardStepMode value={data.mode} onNext={advance} />
            )}
            {currentStep === 'info' && (
              <WizardStepInfo defaultValues={data.info} onNext={advance} onBack={back} />
            )}
            {currentStep === 'type' && (
              <WizardStepType value={data.siteType} onNext={advance} onBack={back} />
            )}
            {currentStep === 'identity' && (
              <WizardStepIdentity
                defaultValues={data.identity}
                companyLogoUrl={companyLogoUrl}
                onNext={advance}
                onBack={back}
              />
            )}
            {currentStep === 'template' && (
              <WizardStepTemplate
                onNext={advance}
                onBack={back}
                isPending={createMutation.isPending}
              />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Puedes editar toda la configuracion despues desde el panel
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update WebsiteOverviewScreen.jsx to import WebsiteWizard**

In `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx`, replace:

```js
import WebsiteSiteWizard from './WebsiteSiteWizard.jsx'
```

with:

```js
import WebsiteWizard from './WebsiteWizard.jsx'
```

And replace the usage on line 122:

```jsx
if (!site) return <WebsiteSiteWizard />
```

with:

```jsx
if (!site) return <WebsiteWizard />
```

- [ ] **Step 3: Delete old WebsiteSiteWizard.jsx**

```bash
rm apps/desktop/src/modules/atlas.website/screens/WebsiteSiteWizard.jsx
```

- [ ] **Step 4: Verify wizard in browser**

Open `http://localhost:5173`, navigate to Sitio web module (ensure no site exists, or delete one via Zona de peligro). Verify:
- Wizard covers the full viewport (sidebar hidden behind it)
- Step 1 shows two mode cards (Web Builder / ZIP)
- Clicking a mode card advances to Step 2 (Informacion)
- Step 2 shows name, domain, giro (combobox with creatable), description fields
- For Web Builder: Step 3 shows 4 site type cards with dark-safe colors
- Step 4 shows identity (logo, colors, fonts) — all use semantic colors, no hex backgrounds
- Step 5 shows template grid
- Completing the wizard creates the site and redirects

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsiteWizard.jsx \
        apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx
git commit -m "feat(website): replace 825-line wizard with 5-step split orchestrator (full-screen, dark-safe)"
```

---

**Plan A complete.** Proceed to Plan B (`2026-06-05-atlas-website-screens-refactor.md`) for the admin screen refactors.

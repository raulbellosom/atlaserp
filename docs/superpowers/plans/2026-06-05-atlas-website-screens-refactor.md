# Atlas Website — Admin Screens Refactor (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor all 8 atlas.website admin screens to use `@atlas/ui` components, full-width layouts, and dark-safe Tailwind tokens. Requires Plan A to be completed first.

**Architecture:** Each screen is an independent component. No API changes. Shared pattern: `PageHeader` at top, full-width content area, `EmptyState`/`ErrorState` for empty cases, `ConfirmDialog` for destructive actions, zero hardcoded hex colors.

**Tech Stack:** React, Tailwind CSS (semantic tokens only), TanStack Query, @atlas/ui (PageHeader, AtlasTable, Sheet, ConfirmDialog, EmptyState, StatCard, Tabs), Hono API (unchanged).

**Dark mode rule:** Never use bare `bg-white`, `text-gray-900`, `border-gray-200` without `dark:` counterparts. Use semantic tokens: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-muted`. Grid rule: no outer `max-w-*` on page container — use full width; `max-w-3xl` only inside form panels.

**Prerequisite:** Plan A must be complete. Run `pnpm dev:frontend` before verifying any task.

---

### Task 1: WebsiteOverviewScreen.jsx — full-width dashboard

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx`

The current screen is constrained to `max-w-4xl`. Replace with a full-width two-column dashboard: left column has site status, URL, mode badge, preview + publish buttons; right column has stat cards linking to their sections.

- [ ] **Step 1: Rewrite WebsiteOverviewScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Button, Input, Label, Switch, StatCard, PageHeader,
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
  Badge,
} from '@atlas/ui'
import { Globe, FileText, BookOpen, MessageSquare, Eye, Upload } from 'lucide-react'
import { toast } from 'sonner'
import WebsiteWizard from './WebsiteWizard.jsx'

const SITE_TYPES = [
  { value: 'website',   label: 'Sitio informativo' },
  { value: 'ecommerce', label: 'Tienda online' },
  { value: 'blog',      label: 'Blog / Contenido' },
  { value: 'landing',   label: 'Landing page' },
]

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export default function WebsiteOverviewScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [deleteOpen, setDeleteOpen]     = useState(false)
  const [deleteText, setDeleteText]     = useState('')
  const [formName, setFormName]         = useState('')
  const [formDomain, setFormDomain]     = useState('')
  const [formSiteType, setFormSiteType] = useState('website')

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn:  () => apiFetch('/website/site', token),
    enabled:  Boolean(token),
    staleTime: 60_000,
  })
  const site = siteQuery.data?.data ?? null

  useEffect(() => {
    if (site) {
      setFormName(site.name ?? '')
      setFormDomain(site.domain ?? '')
      setFormSiteType(site.siteType ?? 'website')
    }
  }, [site])

  const publishedPagesQuery = useQuery({
    queryKey: ['website-pages-stats', 'published', site?.id],
    queryFn:  () => apiFetch(`/website/pages?siteId=${site.id}&status=published&pageSize=1`, token),
    enabled:  Boolean(token) && Boolean(site?.id),
    staleTime: 60_000,
  })
  const draftPagesQuery = useQuery({
    queryKey: ['website-pages-stats', 'draft', site?.id],
    queryFn:  () => apiFetch(`/website/pages?siteId=${site.id}&status=draft&pageSize=1`, token),
    enabled:  Boolean(token) && Boolean(site?.id),
    staleTime: 60_000,
  })
  const blogQuery = useQuery({
    queryKey: ['website-blog-stats', site?.id],
    queryFn:  () => apiFetch(`/website/blog/posts?siteId=${site.id}&pageSize=1`, token),
    enabled:  Boolean(token) && Boolean(site?.id),
    staleTime: 60_000,
  })
  const formsQuery = useQuery({
    queryKey: ['website-forms-stats', site?.id],
    queryFn:  () => apiFetch(`/website/forms?siteId=${site.id}`, token),
    enabled:  Boolean(token) && Boolean(site?.id),
    staleTime: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: (data) => apiFetch(`/website/site/${site.id}`, token, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-site'] })
      toast.success('Sitio actualizado')
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/website/site/${site.id}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-site'] })
      setDeleteOpen(false)
      setDeleteText('')
      toast.success('Sitio web eliminado')
    },
    onError: (err) => toast.error(err.message),
  })

  if (siteQuery.isPending) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Cargando...</div>
  }

  if (!site) return <WebsiteWizard />

  const submissionsTotal = (formsQuery.data?.data ?? []).reduce((sum, f) => sum + (f._count?.submissions ?? 0), 0)
  const buildMode = site.settings?.buildMode ?? 'web_builder'
  const isPublished = site.status === 'published'

  function handleSaveConfig() {
    updateMutation.mutate({ name: formName.trim() || undefined, domain: formDomain.trim() || null, siteType: formSiteType })
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={site.name}
        description={site.domain ? `https://${site.domain}` : 'Dominio no configurado'}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={isPublished ? 'success' : 'secondary'}>
              {isPublished ? 'Publicado' : 'Borrador'}
            </Badge>
            {site.domain && (
              <Button variant="outline" size="sm" asChild>
                <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer">
                  <Eye size={14} className="mr-1.5"/> Ver sitio
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant={isPublished ? 'outline' : 'default'}
              onClick={() => updateMutation.mutate({ status: isPublished ? 'draft' : 'published' })}
              disabled={updateMutation.isPending}
            >
              {isPublished ? 'Despublicar' : 'Publicar'}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cursor-pointer" onClick={() => navigate('/app/m/atlas.website/pages')}>
          <StatCard label="Pag. publicadas" value={publishedPagesQuery.data?.total ?? '—'} icon={Globe} loading={publishedPagesQuery.isPending}/>
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/app/m/atlas.website/pages')}>
          <StatCard label="Borradores" value={draftPagesQuery.data?.total ?? '—'} icon={FileText} loading={draftPagesQuery.isPending}/>
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/app/m/atlas.website/blog')}>
          <StatCard label="Posts de blog" value={blogQuery.data?.total ?? '—'} icon={BookOpen} loading={blogQuery.isPending}/>
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/app/m/atlas.website/forms')}>
          <StatCard label="Envios" value={formsQuery.isPending ? '—' : submissionsTotal} icon={MessageSquare} loading={formsQuery.isPending}/>
        </div>
      </div>

      {/* Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border p-6 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Configuracion del sitio</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Estado:</span>
              <Switch checked={isPublished} onCheckedChange={(c) => updateMutation.mutate({ status: c ? 'published' : 'draft' })} disabled={updateMutation.isPending}/>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="site-name">Nombre</Label>
              <Input id="site-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Mi sitio web"/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-domain">Dominio</Label>
              <Input id="site-domain" value={formDomain} onChange={(e) => setFormDomain(e.target.value)} placeholder="misitioweb.com"/>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de sitio</Label>
              <Select value={formSiteType} onValueChange={setFormSiteType}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {SITE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-destructive/30 p-6 space-y-3 bg-card">
          <h2 className="text-base font-semibold text-destructive">Zona de peligro</h2>
          <p className="text-sm text-muted-foreground">
            Eliminar el sitio web borra permanentemente todas las paginas, posts de blog, formularios, menus y temas.
          </p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Eliminar sitio web</Button>
        </section>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!open) { setDeleteOpen(false); setDeleteText('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar sitio web</DialogTitle>
            <DialogDescription>
              Esta accion es irreversible. Se eliminaran todas las paginas, posts de blog,
              formularios, menus y temas del sitio <strong>{site.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label>Escribe el nombre del sitio para confirmar: <strong>{site.name}</strong></Label>
            <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder={site.name}/>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteText('') }}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteText !== site.name || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to Sitio web overview. Verify:
- Full-width layout, no `max-w` constraint
- Two-column layout on wide screens (config + danger zone)
- Stat cards are clickable and navigate correctly
- Status badge and toggle work
- Dark mode: all text and borders visible

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx
git commit -m "refactor(website): overview to full-width dashboard with two-column layout"
```

---

### Task 2: WebsitePagesScreen.jsx — full-width grid

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx`

- [ ] **Step 1: Read the current file to understand what to preserve**

Open `apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx` and identify:
- Existing query hooks and mutations (keep them)
- Any dialog/sheet components (keep their logic, just update styling)
- The page card rendering section (replace with full-width grid)

- [ ] **Step 2: Update the page container and card grid**

Remove `max-w-4xl` from the outer wrapper. Change the page list from a narrow list to a responsive grid. The specific changes are:

1. Wrap everything in `<div className="p-6 space-y-6">` (not `p-8 max-w-4xl`)
2. Replace the page list rendering with:

```jsx
{/* Page grid — add this where the list of pages currently renders */}
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
  {pages.map((page) => (
    <button
      key={page.id}
      onClick={() => navigate(`/app/m/atlas.website/pages/${page.id}/editor`)}
      className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate text-sm">
          {page.title}
        </p>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${
          page.status === 'published'
            ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
            : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        }`}>
          {page.status === 'published' ? 'Publicada' : 'Borrador'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground font-mono">{page.slug}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {new Date(page.updatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </button>
  ))}
</div>
```

3. Add `PageHeader` at the top of the screen with a "Nueva pagina" button.
4. All existing dialogs/mutations remain unchanged — only the layout wrapper and card rendering change.

- [ ] **Step 3: Verify in browser**

Navigate to Paginas. Verify:
- Cards fill the full available width in a responsive grid
- Each card shows title, status badge, slug, and date
- Dark mode: status badges use `dark:` pairs, no bare `text-green-700` without dark counterpart
- "Nueva pagina" button opens the existing dialog correctly

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx
git commit -m "refactor(website): pages screen to full-width responsive card grid"
```

---

### Task 3: WebsiteTemplatesScreen.jsx full-width grid + WebsiteTemplateDetailScreen.jsx

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.website/screens/WebsiteTemplateDetailScreen.jsx`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx` (register new screen)

The existing `TemplatePreviewScreen.jsx` (46 lines) is a stub — the new `WebsiteTemplateDetailScreen.jsx` replaces it conceptually with a proper detail + apply flow.

- [ ] **Step 1: Rewrite WebsiteTemplatesScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@atlas/ui'
import { LayoutTemplate } from 'lucide-react'
import { allTemplates } from '../../../website/atlasTemplates/index.js'

export default function WebsiteTemplatesScreen() {
  const navigate = useNavigate()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Plantillas"
        description="Selecciona una plantilla para previsualizarla y elegir las paginas que deseas crear."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {allTemplates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => navigate(`/app/m/atlas.website/templates/${tpl.id}/preview`)}
            className="text-left rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all group"
          >
            {/* Thumbnail */}
            <div
              className="aspect-video relative overflow-hidden flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${tpl.color}22, ${tpl.color}44)` }}
            >
              <LayoutTemplate size={36} style={{ color: tpl.color }} className="opacity-40"/>
              <div
                className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ background: tpl.color }}
              >
                {tpl.pages.length} pag{tpl.pages.length !== 1 ? 's' : ''}
              </div>
            </div>
            {/* Info */}
            <div className="p-4">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{tpl.label}</h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{tpl.description}</p>
              <p className="text-xs text-muted-foreground mt-2">Clic para previsualizar</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create WebsiteTemplateDetailScreen.jsx**

This replaces `TemplatePreviewScreen.jsx` as the detail view. The existing TemplatePreviewScreen.jsx file stays (it still renders in the iframe); this new screen wraps it with proper chrome and a "Usar esta plantilla" flow.

```jsx
// apps/desktop/src/modules/atlas.website/screens/WebsiteTemplateDetailScreen.jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader, Button, ConfirmDialog, Badge } from '@atlas/ui'
import { ArrowLeft, LayoutTemplate } from 'lucide-react'
import { allTemplates } from '../../../website/atlasTemplates/index.js'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { toast } from 'sonner'

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

export default function WebsiteTemplateDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const tpl = allTemplates.find((t) => t.id === id)

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn:  () => apiFetch('/website/site', token),
    enabled:  Boolean(token),
    staleTime: 60_000,
  })
  const site = siteQuery.data?.data ?? null

  const pagesQuery = useQuery({
    queryKey: ['website-pages-count', site?.id],
    queryFn:  () => apiFetch(`/website/pages?siteId=${site.id}&pageSize=1`, token),
    enabled:  Boolean(token) && Boolean(site?.id),
    staleTime: 60_000,
  })
  const hasPages = (pagesQuery.data?.total ?? 0) > 0

  if (!tpl) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Plantilla no encontrada.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/m/atlas.website/templates')}>
          <ArrowLeft size={14} className="mr-1"/>
          Plantillas
        </Button>
      </div>
      <PageHeader
        title={tpl.label}
        description={tpl.description}
        actions={
          <Button onClick={() => setConfirmOpen(true)}>
            <LayoutTemplate size={14} className="mr-1.5"/>
            Usar esta plantilla
          </Button>
        }
      />
      <div className="flex gap-2 flex-wrap">
        {tpl.pages.map((p) => (
          <Badge key={p.id} variant="secondary">{p.label}</Badge>
        ))}
      </div>
      {/* Preview iframe placeholder — real preview relies on existing TemplatePreviewScreen logic */}
      <div className="rounded-xl border border-border bg-muted overflow-hidden" style={{ height: '60vh' }}>
        <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
          <LayoutTemplate size={32}/>
          <p className="text-sm">Vista previa disponible en el editor</p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Usar esta plantilla"
        description={
          hasPages
            ? `Esto reemplazara las paginas actuales del sitio con las paginas de la plantilla "${tpl.label}". Los contenidos existentes se perderan.`
            : `Se crearan ${tpl.pages.length} paginas con la plantilla "${tpl.label}".`
        }
        confirmLabel="Usar plantilla"
        variant={hasPages ? 'destructive' : 'default'}
        onConfirm={() => {
          toast.info('Aplicar plantilla — implementar segun flujo de negocio')
          setConfirmOpen(false)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Register WebsiteTemplateDetailScreen in ModuleOutlet.jsx**

In `apps/desktop/src/app/ModuleOutlet.jsx`, add inside `SCREEN_MAP`:

```js
"atlas.website:/templates/:id/detail": lazy(
  () => import("../modules/atlas.website/screens/WebsiteTemplateDetailScreen.jsx"),
),
```

And in the `resolveScreen` atlas.website block, add before the existing preview check:

```js
if (/^\/templates\/[^/]+\/detail$/.test(subPath)) {
  return SCREEN_MAP["atlas.website:/templates/:id/detail"] ?? null;
}
```

Then update `WebsiteTemplatesScreen.jsx` to navigate to `/detail` instead of `/preview`:

```jsx
onClick={() => navigate(`/app/m/atlas.website/templates/${tpl.id}/detail`)}
```

- [ ] **Step 4: Verify in browser**

Navigate to Plantillas. Verify:
- Full-width grid with thumbnail cards (aspect-video thumbnails, color-coded)
- Clicking a card goes to template detail screen
- Detail screen shows template name, page list badges, and "Usar esta plantilla" button
- "Usar esta plantilla" opens ConfirmDialog (destructive variant if pages exist)

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx \
        apps/desktop/src/modules/atlas.website/screens/WebsiteTemplateDetailScreen.jsx \
        apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "refactor(website): templates full-width grid + new detail screen with ConfirmDialog"
```

---

### Task 4: WebsiteBlogScreen.jsx — AtlasTable

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsiteBlogScreen.jsx`

- [ ] **Step 1: Read the current file**

Open `apps/desktop/src/modules/atlas.website/screens/WebsiteBlogScreen.jsx` (196 lines). Identify existing query hooks (keep them), the post list rendering (replace), and existing dialogs (keep).

- [ ] **Step 2: Update the layout**

Apply these changes:
1. Outer wrapper: `<div className="p-6 space-y-6">` (remove `max-w-4xl`, remove `p-8`)
2. Add `PageHeader` at top with "Nuevo post" action button
3. Replace the post list with `AtlasTable`:

```jsx
import { AtlasTable, PageHeader, EmptyState } from '@atlas/ui'
import { BookOpen } from 'lucide-react'

// Column definitions for AtlasTable
const COLUMNS = [
  { key: 'title',     label: 'Titulo',  render: (row) => <span className="font-medium text-foreground">{row.title}</span> },
  { key: 'status',    label: 'Estado',  render: (row) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
      row.status === 'published'
        ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    }`}>
      {row.status === 'published' ? 'Publicado' : 'Borrador'}
    </span>
  )},
  { key: 'publishedAt', label: 'Fecha', render: (row) => (
    <span className="text-sm text-muted-foreground">
      {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString('es-MX') : '—'}
    </span>
  )},
]

// In the render:
{posts.length === 0 ? (
  <EmptyState
    icon={BookOpen}
    title="Sin posts"
    description="Crea el primer post de tu blog."
    action={<Button onClick={openNewPostDialog}>Nuevo post</Button>}
  />
) : (
  <AtlasTable
    columns={COLUMNS}
    rows={posts}
    onRowClick={(row) => navigate(`/app/m/atlas.website/blog/${row.id}/editor`)}
  />
)}
```

- [ ] **Step 3: Verify in browser**

Navigate to Blog. Verify:
- `PageHeader` with "Nuevo post" button at top
- Table shows posts with status badges (dark mode safe)
- Empty state shows when no posts exist
- Row click navigates to editor

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsiteBlogScreen.jsx
git commit -m "refactor(website): blog screen to full-width AtlasTable with EmptyState"
```

---

### Task 5: WebsiteFormsScreen.jsx — tabs + Sheet

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsiteFormsScreen.jsx`

- [ ] **Step 1: Read the current file**

Open `apps/desktop/src/modules/atlas.website/screens/WebsiteFormsScreen.jsx` (248 lines). Identify existing form + submission queries, and the form builder panel.

- [ ] **Step 2: Update layout**

Changes:
1. Outer wrapper: `<div className="p-6 space-y-6">` (remove `max-w-4xl`)
2. Add `PageHeader` with "Nuevo formulario" button
3. Add `Tabs` (from `@atlas/ui`) for "Formularios" / "Respuestas"
4. Formularios tab: form list with search field. Each item is a card with form name, submission count, and click to open Sheet
5. Respuestas tab: `AtlasTable` of submissions filterable by form

Key import additions:
```jsx
import { PageHeader, Tabs, TabsList, TabsTrigger, TabsContent, AtlasTable, EmptyState, Sheet, SheetContent, SheetHeader, SheetTitle } from '@atlas/ui'
import { FormInput } from 'lucide-react'
```

The form builder (`FormFieldBuilder`) stays inside a `Sheet` exactly as before — only the outer layout changes.

- [ ] **Step 3: Verify in browser**

Navigate to Formularios. Verify:
- Full-width layout
- Two tabs: Formularios / Respuestas
- Forms tab shows cards with name and submission count
- Clicking a form opens Sheet with form builder
- Dark mode: all text and borders visible

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsiteFormsScreen.jsx
git commit -m "refactor(website): forms screen to full-width tabs (forms + submissions)"
```

---

### Task 6: WebsiteThemeScreen.jsx — two-panel layout

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsiteThemeScreen.jsx`

- [ ] **Step 1: Read the current file**

Open `apps/desktop/src/modules/atlas.website/screens/WebsiteThemeScreen.jsx` (278 lines). Identify existing query hooks and mutation (keep), and the color/typography editors.

- [ ] **Step 2: Update to two-panel layout**

```jsx
// Replace outer wrapper with:
<div className="p-6 space-y-6 h-full">
  <PageHeader
    title="Tema"
    description="Colores, tipografia y apariencia de tu sitio."
    actions={
      <Button variant="outline" onClick={() => navigate('/app/m/atlas.website/templates')}>
        Cambiar plantilla
      </Button>
    }
  />
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
    {/* Left: config panels */}
    <div className="space-y-4">
      {/* ThemeColorEditor and ThemeTypographyEditor remain unchanged inside here */}
      <ThemeColorEditor ... />
      <ThemeTypographyEditor ... />
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Guardando...' : 'Guardar tema'}
        </Button>
      </div>
    </div>
    {/* Right: preview panel */}
    <div className="rounded-xl border border-border bg-muted overflow-hidden sticky top-6" style={{ minHeight: '400px' }}>
      <div className="flex items-center justify-center h-full p-8 text-center text-muted-foreground">
        <div>
          <div className="w-16 h-16 rounded-xl mb-3 mx-auto" style={{ background: currentPrimaryColor }}/>
          <p className="text-sm font-medium">Vista previa del color primario</p>
          <p className="text-xs mt-1">{currentPrimaryColor}</p>
        </div>
      </div>
    </div>
  </div>
</div>
```

Note: `ThemeColorEditor` and `ThemeTypographyEditor` are separate files in `screens/` — they are NOT modified in this task. Only the parent screen layout changes.

- [ ] **Step 3: Fix ThemeColorEditor and ThemeTypographyEditor dark mode**

Open `apps/desktop/src/modules/atlas.website/screens/ThemeColorEditor.jsx` and `ThemeTypographyEditor.jsx`. Replace any hardcoded `text-gray-*`, `bg-white`, `border-gray-*` with semantic tokens:
- `text-gray-900` → `text-foreground`
- `text-gray-500` → `text-muted-foreground`
- `bg-white` → `bg-background`
- `border-gray-200` → `border-border`

- [ ] **Step 4: Verify in browser**

Navigate to Tema. Verify:
- Two-column layout on wide screens
- "Cambiar plantilla" button navigates to Plantillas
- Color and typography editors work
- Preview panel shows current primary color
- Dark mode: all controls visible

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsiteThemeScreen.jsx \
        apps/desktop/src/modules/atlas.website/screens/ThemeColorEditor.jsx \
        apps/desktop/src/modules/atlas.website/screens/ThemeTypographyEditor.jsx
git commit -m "refactor(website): theme screen to two-panel layout with dark-safe editors"
```

---

### Task 7: WebsitePaymentsScreen.jsx — gateway cards

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx`

- [ ] **Step 1: Read the current file**

Open `apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx` (176 lines). Identify existing Stripe config state and mutation (keep).

- [ ] **Step 2: Update layout**

Changes:
1. Outer wrapper: `<div className="p-6 space-y-6">` (remove `max-w-4xl`)
2. Add `PageHeader` with title "Pagos" and description "Configura pasarelas de pago para tu tienda"
3. Replace any raw `div` with `border` to use `bg-card border border-border rounded-xl`
4. Replace hardcoded status indicators with semantic colors:
   - Connected: `text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30`
   - Disconnected: `text-muted-foreground bg-muted`
5. Stripe config fields stay inside a `Sheet` — keep existing logic, just update trigger UI

Stripe card structure:
```jsx
<div className="rounded-xl border border-border bg-card p-5 flex items-start justify-between gap-4">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg bg-[#635BFF]/10 flex items-center justify-center shrink-0">
      {/* Stripe S icon */}
      <span className="text-[#635BFF] font-bold text-lg">S</span>
    </div>
    <div>
      <p className="font-semibold text-foreground">Stripe</p>
      <p className="text-xs text-muted-foreground">Pagos con tarjeta y transferencias</p>
    </div>
  </div>
  <div className="flex items-center gap-3">
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
      isConnected
        ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
        : 'text-muted-foreground bg-muted border-border'
    }`}>
      {isConnected ? 'Conectado' : 'No configurado'}
    </span>
    <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
      {isConnected ? 'Editar' : 'Configurar'}
    </Button>
  </div>
</div>
```

- [ ] **Step 3: Verify in browser**

Navigate to Pagos. Verify:
- `PageHeader` at top
- Stripe gateway card with status badge (dark mode safe)
- "Configurar" button opens Sheet with key fields
- Dark mode: card background and borders visible

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx
git commit -m "refactor(website): payments screen to full-width gateway cards with dark-safe status badges"
```

---

### Task 8: WebsiteSettingsScreen.jsx — fix dark mode + default state

**Files:**
- Modify: `apps/desktop/src/modules/atlas.website/screens/WebsiteSettingsScreen.jsx`
- Modify: `apps/desktop/src/modules/atlas.website/components/WebsiteSourceSelector.jsx`

This is the screen shown in the bug screenshots — dark cards on dark background. The fix has two parts:
1. Replace hardcoded colors in `WebsiteSourceSelector` and `DistUploadPanel` with semantic tokens
2. Add an `EmptyState` when no site exists (instead of invisible blank cards)

- [ ] **Step 1: Fix WebsiteSourceSelector.jsx**

Open `apps/desktop/src/modules/atlas.website/components/WebsiteSourceSelector.jsx` (96 lines). Apply:
- Replace any `bg-[#0d1117]`, `bg-gray-900`, `bg-black`, `#1a1a2e` etc. with `bg-card dark:bg-card`
- Replace `border-gray-700`, `border-[#333]` etc. with `border-border`
- Replace `text-gray-300`, `text-white` etc. with `text-foreground`
- Replace `text-gray-500` with `text-muted-foreground`
- The selected state should use `border-primary bg-primary/5` instead of hardcoded accent

The selector cards pattern:
```jsx
<button
  onClick={() => onChange(option.value)}
  className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
    value === option.value
      ? 'border-primary bg-primary/5'
      : 'border-border bg-card hover:border-primary/40'
  }`}
>
  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
    value === option.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
  }`}>
    <Icon size={18}/>
  </div>
  <div>
    <p className="font-semibold text-foreground">{option.label}</p>
    <p className="text-sm text-muted-foreground">{option.description}</p>
  </div>
</button>
```

- [ ] **Step 2: Add EmptyState for no-site case in WebsiteSettingsScreen.jsx**

In `WebsiteSettingsScreen.jsx`, locate where `siteId` is undefined (site not yet created). Add:

```jsx
// After the siteQuery is resolved, before the tabs render:
if (!siteQuery.isPending && !siteId) {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Configuracion" description="Ajusta las integraciones y credenciales de tu sitio web."/>
      <EmptyState
        title="No hay sitio configurado"
        description="Completa el asistente de configuracion para activar estas opciones."
        action={
          <Button onClick={() => navigate('/app/m/atlas.website')}>
            Ir al asistente
          </Button>
        }
      />
    </div>
  )
}
```

- [ ] **Step 3: Fix the main settings layout**

1. Outer wrapper: `<div className="p-6 space-y-6">` (remove `max-w-4xl`)
2. Add `PageHeader` at the top
3. The `Tabs` component stays; ensure `TabsContent` panels use `bg-card border border-border rounded-xl p-5` (not hardcoded dark backgrounds)
4. SMTP form fields: replace native `<input>` with `TextField` and `PasswordField` from `@atlas/ui` if any were bypassed

- [ ] **Step 4: Verify in browser — critical dark mode test**

Enable dark mode. Navigate to Configuracion. Verify:
- Source selector cards are visible (not black-on-black)
- SMTP fields have visible labels and inputs
- If no site exists, shows EmptyState with "Ir al asistente" button
- If site exists in ZIP mode, the "Fuente del sitio" tab shows the selector
- Tabs render correctly in both light and dark mode

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.website/screens/WebsiteSettingsScreen.jsx \
        apps/desktop/src/modules/atlas.website/components/WebsiteSourceSelector.jsx
git commit -m "fix(website): settings screen dark mode — replace hardcoded colors with semantic tokens, add EmptyState for no-site state"
```

---

**Plan B complete.** All 8 admin screens refactored. Both plans together deliver the full spec from `docs/superpowers/specs/2026-06-05-atlas-website-admin-refactor-design.md`.

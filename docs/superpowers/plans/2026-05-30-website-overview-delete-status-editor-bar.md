# Website Overview Redesign, Delete, Status Toggle & Editor Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hard-delete for the website, redesign the overview screen with stats + editable config, add a draft/published status toggle, and embed a peek/pin editor context bar on the public-facing website for authenticated editors.

**Architecture:** Backend gets a `deleteSite` service function (hard-delete in a Prisma interactive transaction) and a `status` filter on `listPages`. The overview screen is rebuilt with stat cards + inline config form + danger zone. A new `EditorContextBar` component mounts in `PublicWebsiteEntry` only when the user is authenticated AND passes a permission check (`GET /website/site` returns 200).

**Tech Stack:** Hono (API), Prisma 7 interactive transactions, React + TanStack Query, @atlas/ui components (StatCard, Dialog, Switch, Select, Input, Button), Tailwind CSS, lucide-react icons.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/routes/website/website-service.js` | Modify | Add `deleteSite()` function; add `status` param to `listPages` |
| `apps/api/src/routes/website/pages-routes.js` | Modify | Forward `status` query param to `listPages` |
| `apps/api/src/routes/website/index.js` | Modify | Add `DELETE /website/site/:id` route |
| `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx` | Rewrite | Stats dashboard + editable config + danger zone dialog |
| `apps/desktop/src/website/EditorContextBar.jsx` | Create | Peek/pin editor bar for the public website |
| `apps/desktop/src/shell/PublicWebsiteEntry.jsx` | Modify | Permission check + render EditorContextBar |

---

## Task 1: Add `status` filter to `listPages` (API)

**Files:**
- Modify: `apps/api/src/routes/website/website-service.js` (lines ~81-107)
- Modify: `apps/api/src/routes/website/pages-routes.js` (lines ~9-24)

- [ ] **Step 1: Add `status` param to `listPages` in `website-service.js`**

  Find the `listPages` function. Change its signature and add one filter line:

  ```js
  // Before:
  async function listPages({ companyId, siteId, page = 1, pageSize = 30, pageType = null }) {
    const skip = (page - 1) * pageSize
    const where = { companyId, siteId, enabled: true }
    if (pageType) where.pageType = pageType

  // After:
  async function listPages({ companyId, siteId, page = 1, pageSize = 30, pageType = null, status = null }) {
    const skip = (page - 1) * pageSize
    const where = { companyId, siteId, enabled: true }
    if (pageType) where.pageType = pageType
    if (status) where.status = status
  ```

- [ ] **Step 2: Forward `status` from the route handler in `pages-routes.js`**

  Find the `GET /pages` handler. Add `status` to the destructured query params and pass it to the service:

  ```js
  // Before:
  const { siteId, page, pageSize, page_type } = c.req.query()
  // ...
  const result = await websiteSvc.listPages({
    companyId,
    siteId:   site.id,
    page:     parseInt(page     ?? '1',  10),
    pageSize: parseInt(pageSize ?? '30', 10),
    pageType: page_type ?? null,
  })

  // After:
  const { siteId, page, pageSize, page_type, status } = c.req.query()
  // ...
  const result = await websiteSvc.listPages({
    companyId,
    siteId:   site.id,
    page:     parseInt(page     ?? '1',  10),
    pageSize: parseInt(pageSize ?? '30', 10),
    pageType: page_type ?? null,
    status:   status ?? null,
  })
  ```

- [ ] **Step 3: Verify syntax**

  ```
  node --check apps/api/src/routes/website/website-service.js
  node --check apps/api/src/routes/website/pages-routes.js
  ```

  Expected: no output (no syntax errors).

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/routes/website/website-service.js apps/api/src/routes/website/pages-routes.js
  git commit -m "feat(website): add status filter to listPages endpoint"
  ```

---

## Task 2: Add `deleteSite` service function + DELETE route

**Files:**
- Modify: `apps/api/src/routes/website/website-service.js`
- Modify: `apps/api/src/routes/website/index.js`

- [ ] **Step 1: Add `deleteSite` to `website-service.js`**

  Add this function inside `createWebsiteService({ prisma })`, after `updateSite`:

  ```js
  async function deleteSite({ companyId, siteId, actorId }) {
    const site = await prisma.websiteSite.findFirst({
      where: { id: siteId, companyId },
      select: { id: true, name: true },
    })
    if (!site) throw notFound('Sitio')

    await prisma.auditLog.create({
      data: {
        actorId:    actorId ?? null,
        moduleKey:  'atlas.website',
        entityType: 'website.site',
        entityId:   siteId,
        action:     'site.delete',
        before:     JSON.stringify(site),
        after:      null,
      },
    })

    await prisma.$transaction(async (tx) => {
      const menuIds = (await tx.websiteMenu.findMany({
        where: { siteId }, select: { id: true },
      })).map((m) => m.id)

      const pageIds = (await tx.websitePage.findMany({
        where: { siteId }, select: { id: true },
      })).map((p) => p.id)

      // Forms cascade to fields+submissions via onDelete:Cascade in schema
      await tx.websiteForm.deleteMany({ where: { siteId } })

      if (menuIds.length) {
        await tx.websiteMenuItem.deleteMany({ where: { menuId: { in: menuIds } } })
      }
      await tx.websiteMenu.deleteMany({ where: { siteId } })
      await tx.websitePublishedRender.deleteMany({ where: { siteId } })

      if (pageIds.length) {
        await tx.websitePageVersion.deleteMany({ where: { pageId: { in: pageIds } } })
      }
      await tx.websitePage.deleteMany({ where: { siteId } })
      await tx.websiteBlogPost.deleteMany({ where: { siteId } })
      await tx.websiteBlogCategory.deleteMany({ where: { siteId } })
      await tx.websiteTheme.deleteMany({ where: { siteId } })
      await tx.websiteSite.delete({ where: { id: siteId } })
    })
  }
  ```

  Then add `deleteSite` to the returned object at the bottom of `createWebsiteService`:

  ```js
  return {
    getSite,
    createSite,
    updateSite,
    deleteSite,   // <-- add this line
    listPages,
    // ... rest unchanged
  }
  ```

- [ ] **Step 2: Add `DELETE /website/site/:id` route in `index.js`**

  After the `app.patch('/website/site/:id', ...)` handler, add:

  ```js
  app.delete(
    '/website/site/:id',
    requirePermission('website.site.update'),
    async (c) => {
      const companyId = c.get('companyId')
      const actorId   = c.get('userId') ?? c.get('user')?.id ?? null
      const siteId    = c.req.param('id')
      try {
        await websiteSvc.deleteSite({ companyId, siteId, actorId })
        return c.body(null, 204)
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    },
  )
  ```

- [ ] **Step 3: Verify syntax**

  ```
  node --check apps/api/src/routes/website/website-service.js
  node --check apps/api/src/routes/website/index.js
  ```

  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/routes/website/website-service.js apps/api/src/routes/website/index.js
  git commit -m "feat(website): add deleteSite service and DELETE /website/site/:id route"
  ```

---

## Task 3: Redesign `WebsiteOverviewScreen`

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx`

- [ ] **Step 1: Replace the entire file content**

  ```jsx
  import { useState, useEffect } from 'react'
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
  import { useNavigate } from 'react-router-dom'
  import { useAuth } from '../../../auth/AuthProvider.jsx'
  import { getApiUrl } from '../../../lib/runtimeConfig.js'
  import {
    Button, Input, Label, Switch, StatCard,
    Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
    Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
  } from '@atlas/ui'
  import { Globe, FileText, BookOpen, MessageSquare } from 'lucide-react'
  import { toast } from 'sonner'
  import WebsiteSiteWizard from './WebsiteSiteWizard.jsx'

  const SITE_TYPES = [
    { value: 'informational', label: 'Sitio informativo' },
    { value: 'ecommerce',     label: 'Tienda online' },
    { value: 'bookings',      label: 'Sitio con reservaciones' },
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
    const [formSiteType, setFormSiteType] = useState('informational')

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
        setFormSiteType(site.siteType ?? 'informational')
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
      return (
        <div className="flex items-center justify-center h-full text-sm text-[hsl(var(--muted-foreground))]">
          Cargando...
        </div>
      )
    }

    if (!site) return <WebsiteSiteWizard />

    const submissionsTotal = (formsQuery.data?.data ?? [])
      .reduce((sum, f) => sum + (f._count?.submissions ?? 0), 0)

    function handleSaveConfig() {
      updateMutation.mutate({
        name:     formName.trim() || undefined,
        domain:   formDomain.trim() || null,
        siteType: formSiteType,
      })
    }

    function handleStatusToggle(checked) {
      updateMutation.mutate({ status: checked ? 'published' : 'draft' })
    }

    function closeDeleteDialog() {
      setDeleteOpen(false)
      setDeleteText('')
    }

    return (
      <div className="p-8 space-y-8 max-w-4xl">
        {/* Stats */}
        <section>
          <h2 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-4">
            Resumen
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="cursor-pointer" onClick={() => navigate('/app/m/atlas.website/pages')}>
              <StatCard
                label="Pag. publicadas"
                value={publishedPagesQuery.data?.total ?? '—'}
                icon={Globe}
                loading={publishedPagesQuery.isPending}
              />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/app/m/atlas.website/pages')}>
              <StatCard
                label="Borradores"
                value={draftPagesQuery.data?.total ?? '—'}
                icon={FileText}
                loading={draftPagesQuery.isPending}
              />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/app/m/atlas.website/blog')}>
              <StatCard
                label="Posts de blog"
                value={blogQuery.data?.total ?? '—'}
                icon={BookOpen}
                loading={blogQuery.isPending}
              />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/app/m/atlas.website/forms')}>
              <StatCard
                label="Envios de formulario"
                value={formsQuery.isPending ? '—' : submissionsTotal}
                icon={MessageSquare}
                loading={formsQuery.isPending}
              />
            </div>
          </div>
        </section>

        {/* Config */}
        <section className="rounded-xl border border-[hsl(var(--border))] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
              Configuracion del sitio
            </h2>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                site.status === 'published'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
              }`}>
                {site.status === 'published' ? 'Publicado' : 'Borrador'}
              </span>
              <Switch
                checked={site.status === 'published'}
                onCheckedChange={handleStatusToggle}
                disabled={updateMutation.isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="site-name">Nombre</Label>
              <Input
                id="site-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Mi sitio web"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-domain">Dominio</Label>
              <Input
                id="site-domain"
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
                placeholder="misitioweb.com"
              />
            </div>
          </div>

          <div className="space-y-1.5 max-w-xs">
            <Label>Tipo de sitio</Label>
            <Select value={formSiteType} onValueChange={setFormSiteType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-xl border border-red-200 p-6 space-y-3">
          <h2 className="text-base font-semibold text-red-700">Zona de peligro</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Eliminar el sitio web borra de forma permanente todas las paginas, posts de blog,
            formularios, menus y temas. Esta accion no se puede deshacer.
          </p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Eliminar sitio web
          </Button>
        </section>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteOpen} onOpenChange={(open) => { if (!open) closeDeleteDialog() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar sitio web</DialogTitle>
              <DialogDescription>
                Esta accion es irreversible. Se eliminaran todas las paginas, posts de blog,
                formularios, menus y temas del sitio <strong>{site.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <Label>
                Escribe el nombre del sitio para confirmar:{' '}
                <strong>{site.name}</strong>
              </Label>
              <Input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder={site.name}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDeleteDialog}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleteText !== site.name || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify syntax**

  ```
  node --check apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx
  ```

  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx
  git commit -m "feat(website): redesign overview screen with stats, config form, and delete dialog"
  ```

---

## Task 4: Create `EditorContextBar` component

**Files:**
- Create: `apps/desktop/src/website/EditorContextBar.jsx`

- [ ] **Step 1: Create the file**

  ```jsx
  import { useState, useRef, useEffect } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { Pin, PinOff } from 'lucide-react'

  const BAR_HEIGHT = 40
  const STORAGE_KEY = 'atlas-editor-bar-pinned'
  const ACCENT = '#6366f1'

  export function EditorContextBar({ site, page, onPinChange }) {
    const navigate = useNavigate()
    const [pinned, setPinned] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
    const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
    const hideTimer = useRef(null)

    useEffect(() => () => clearTimeout(hideTimer.current), [])

    function togglePin() {
      const next = !pinned
      setPinned(next)
      localStorage.setItem(STORAGE_KEY, String(next))
      if (!next) setVisible(false)
      onPinChange?.(next)
    }

    function show() {
      clearTimeout(hideTimer.current)
      setVisible(true)
    }

    function scheduleHide() {
      if (pinned) return
      hideTimer.current = setTimeout(() => setVisible(false), 150)
    }

    const status = site?.status ?? 'draft'
    const statusLabel = status === 'published' ? 'Publicado' : 'Borrador'
    const statusStyle = status === 'published'
      ? { backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }
      : { backgroundColor: '#fefce8', color: '#a16207', borderColor: '#fde68a' }

    return (
      <>
        {/* Corner trigger — always present */}
        <div
          style={{ position: 'fixed', top: 0, left: 0, width: 64, height: 64, zIndex: 9999 }}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          {!visible && (
            <>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 48, height: 2, backgroundColor: ACCENT, borderRadius: 1 }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 48, backgroundColor: ACCENT, borderRadius: 1 }} />
            </>
          )}
        </div>

        {/* Bar */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: BAR_HEIGHT,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 12,
            paddingRight: 16,
            backgroundColor: 'rgba(15, 15, 15, 0.88)',
            backdropFilter: 'blur(8px)',
            transform: visible ? 'translateY(0)' : 'translateY(-100%)',
            opacity: visible ? 1 : 0,
            transition: 'transform 200ms ease, opacity 200ms ease',
          }}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          {/* Pin toggle */}
          <button
            onClick={togglePin}
            title={pinned ? 'Desfijar barra' : 'Fijar barra'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              display: 'flex', alignItems: 'center',
              color: pinned ? ACCENT : '#6b7280',
              transition: 'color 150ms',
            }}
          >
            {pinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>

          {/* Status chip */}
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px',
            borderRadius: 9999, border: '1px solid',
            ...statusStyle,
          }}>
            {statusLabel}
          </span>

          {/* Site + page name */}
          <span style={{
            fontSize: 12, color: '#9ca3af', flex: 1,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {site?.name}
            {page?.title ? ` · ${page.title}` : ''}
          </span>

          {/* Edit button */}
          {page?.id && (
            <button
              onClick={() => navigate(`/app/m/atlas.website/pages/${page.id}/editor`)}
              style={{
                fontSize: 12, color: '#e5e7eb', cursor: 'pointer', whiteSpace: 'nowrap',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, padding: '4px 12px',
              }}
            >
              Editar esta pagina
            </button>
          )}

          {/* Panel link */}
          <button
            onClick={() => navigate('/app/m/atlas.website')}
            style={{
              fontSize: 12, color: '#9ca3af',
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Panel
          </button>
        </div>
      </>
    )
  }
  ```

- [ ] **Step 2: Verify syntax**

  ```
  node --check apps/desktop/src/website/EditorContextBar.jsx
  ```

  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/website/EditorContextBar.jsx
  git commit -m "feat(website): add EditorContextBar peek/pin component for public website"
  ```

---

## Task 5: Update `PublicWebsiteEntry` with editor permission check

**Files:**
- Modify: `apps/desktop/src/shell/PublicWebsiteEntry.jsx`

- [ ] **Step 1: Replace the entire file content**

  The current file is 60 lines. Replace it with:

  ```jsx
  import { useState, useEffect } from 'react'
  import { useLocation, useNavigate } from 'react-router-dom'
  import { useQuery } from '@tanstack/react-query'
  import { useAuth } from '../auth/AuthProvider.jsx'
  import { getApiUrl } from '../lib/runtimeConfig.js'
  import { AppLoader } from '../components/AppLoader.jsx'
  import { PublicWebsite404 } from './PublicWebsite404.jsx'
  import { WebsitePageRenderer } from '../website/WebsitePageRenderer.jsx'
  import { EditorContextBar } from '../website/EditorContextBar.jsx'

  const STORAGE_KEY = 'atlas-editor-bar-pinned'

  async function fetchWebsiteResolve(pathname) {
    const url = `${getApiUrl()}/public/website/resolve?path=${encodeURIComponent(pathname)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async function fetchEditorCheck(token) {
    const res = await fetch(`${getApiUrl()}/website/site`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  }

  export function PublicWebsiteEntry() {
    const location = useLocation()
    const navigate = useNavigate()
    const { session } = useAuth()
    const token = session?.access_token

    const [barPinned, setBarPinned] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')

    useEffect(() => {
      document.documentElement.style.overflow = 'auto'
      document.body.style.overflow = 'auto'
      return () => {
        document.documentElement.style.overflow = ''
        document.body.style.overflow = ''
      }
    }, [])

    const resolveQuery = useQuery({
      queryKey: ['public-website-resolve', location.pathname],
      queryFn:  () => fetchWebsiteResolve(location.pathname),
      staleTime: 60_000,
      retry: 1,
    })

    // Only runs when the user is authenticated — checks if they have editor access
    const editorCheckQuery = useQuery({
      queryKey: ['editor-check', token],
      queryFn:  () => fetchEditorCheck(token),
      enabled:  Boolean(token),
      staleTime: 60_000,
      retry: 0,
    })

    const resolveData = resolveQuery.data
    const isEditor = Boolean(token) && Boolean(editorCheckQuery.data?.data)

    useEffect(() => {
      if (resolveData && resolveData.initialized === false) {
        navigate('/setup', { replace: true })
      }
    }, [resolveData, navigate])

    if (resolveQuery.isPending) return <AppLoader message="Cargando..." />
    if (resolveQuery.isError) return <PublicWebsite404 />
    if (resolveData?.initialized === false) return null
    if (!resolveData?.page) return <PublicWebsite404 />

    return (
      <>
        {isEditor && (
          <EditorContextBar
            site={editorCheckQuery.data?.data}
            page={resolveData.page}
            onPinChange={setBarPinned}
          />
        )}
        <div style={{ paddingTop: isEditor && barPinned ? 40 : 0 }}>
          <WebsitePageRenderer
            page={resolveData.page}
            theme={resolveData.theme}
          />
        </div>
      </>
    )
  }
  ```

- [ ] **Step 2: Verify syntax**

  ```
  node --check apps/desktop/src/shell/PublicWebsiteEntry.jsx
  ```

  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/shell/PublicWebsiteEntry.jsx
  git commit -m "feat(website): add editor context bar to public website entry for authenticated editors"
  ```

---

## Self-Review

**Spec coverage check:**
- [x] Hard-delete website — Task 2 (`deleteSite` + `DELETE /website/site/:id`)
- [x] Overview stats dashboard — Task 3 (4 StatCard components)
- [x] Editable config (name, domain, siteType) — Task 3 (config form with Save button)
- [x] Status toggle (draft/published) — Task 3 (Switch calls PATCH immediately)
- [x] Danger zone with name-confirmation dialog — Task 3 (Dialog with text input)
- [x] Wizard appears after delete — Task 3 (query invalidation makes `!site` true → wizard renders)
- [x] `status` filter on listPages — Task 1
- [x] Editor bar peek trigger on top-left corner — Task 4
- [x] Editor bar pin/unpin with localStorage persistence — Task 4
- [x] Editor bar hidden while cursor away (non-pinned) — Task 4 (`scheduleHide`)
- [x] Bar shows status chip + site name + page title + edit link + panel link — Task 4
- [x] Layout offset (paddingTop: 40) only when pinned — Task 5
- [x] Permission check via authenticated `GET /website/site` — Task 5
- [x] Non-authenticated visitors see no bar — Task 5 (`enabled: Boolean(token)`)

**Placeholder scan:** No TBDs, TODOs, or "similar to" references found.

**Type consistency:** `site.siteType` (camelCase from Prisma) used in Task 3 matches SITE_TYPES values (`'informational'`, `'ecommerce'`, `'bookings'`). `onPinChange` prop defined in Task 4, consumed in Task 5. `page.id` and `page.title` come from `resolveData.page` which is the `WebsitePage` Prisma model — both fields exist in the schema.

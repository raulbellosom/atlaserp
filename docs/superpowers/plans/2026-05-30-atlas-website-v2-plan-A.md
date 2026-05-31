# atlas.website v2 — Plan A: Migración + Builder + Editor + Wizard + Renderer + Templates

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisites:**
> - `atlas.catalog` Plan A + B complete (module installed, products API working)
> - Platform Settings SMTP Plan complete
> - `@raulbellosom/atlas-web-builder` available on npm

**Goal:** Remove all GrapesJS code from `atlas.website`, install `@raulbellosom/atlas-web-builder`, rewrite the page editor and public renderer, and build the site creation wizard with theme injection.

**Architecture:** The builder package provides `AtlasWebBuilderEditor` (edit mode) and `AtlasWebRenderer` (public mode). Pages are stored as `atlas-web-builder` Page JSON in `draft_builder_data` / `published_builder_data`. The wizard creates the site and theme records and opens the editor with the selected template.

**Tech Stack:** `@raulbellosom/atlas-web-builder`, React 18, TanStack Query, Tailwind, `@atlas/ui`

---

## File Map

### Delete (all GrapesJS code)
- `apps/desktop/src/website/atlasBlocks/` — entire directory
- `apps/desktop/src/website/atlasGrapesConfig.js`
- `apps/desktop/src/website/atlasBlocksBaseCSS.js`
- `apps/desktop/src/website/WebsiteGrapesEditor.jsx`
- `apps/desktop/src/website/WebsiteInlineEditor.jsx`
- `apps/desktop/src/website/WebsiteEditBar.jsx`
- `apps/desktop/src/website/atlasTemplates/` — entire directory (templates get rewritten below)

### Create
- `apps/desktop/src/website/atlasBlocks/contactFormBlock.js`
- `apps/desktop/src/website/atlasBlocks/blogIndexBlock.js`
- `apps/desktop/src/website/atlasBlocks/atlasNavbarBlock.js`
- `apps/desktop/src/website/atlasBlocks/atlasFooterBlock.js`
- `apps/desktop/src/website/atlasBlocks/index.js`
- `apps/desktop/src/website/atlasTemplates/templateRestaurante.js`
- `apps/desktop/src/website/atlasTemplates/templateNegocio.js`
- `apps/desktop/src/website/atlasTemplates/index.js`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteSiteWizard.jsx`

### Rewrite
- `apps/desktop/src/website/WebsitePageRenderer.jsx` — replace GrapesJS render with `AtlasWebRenderer`
- `apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx` — replace with `AtlasWebBuilderEditor`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx` — show wizard if no site, dashboard if exists
- `apps/desktop/src/modules/atlas.website/screens/WebsiteThemeScreen.jsx` — replace with `defineTheme` token editor

### Modify
- `apps/desktop/package.json` — add `@raulbellosom/atlas-web-builder`
- `apps/api/src/manifests/official/feature-modules.js` — update website navigation

---

## Task 1 — Delete GrapesJS code + install builder package

- [ ] **Step 1: Delete all GrapesJS files**

  ```bash
  rm -rf apps/desktop/src/website/atlasBlocks
  rm -rf apps/desktop/src/website/atlasTemplates
  rm apps/desktop/src/website/atlasGrapesConfig.js
  rm apps/desktop/src/website/atlasBlocksBaseCSS.js
  rm apps/desktop/src/website/WebsiteGrapesEditor.jsx
  rm apps/desktop/src/website/WebsiteInlineEditor.jsx
  rm apps/desktop/src/website/WebsiteEditBar.jsx
  ```

- [ ] **Step 2: Install the builder package**

  ```bash
  pnpm --filter @atlas/desktop add @raulbellosom/atlas-web-builder
  ```

- [ ] **Step 3: Verify package installed**

  ```bash
  grep "atlas-web-builder" apps/desktop/package.json
  ```
  Expected: version string present.

- [ ] **Step 4: Verify the frontend still starts (with expected import errors)**

  ```bash
  pnpm dev:frontend
  ```
  Expected: Vite starts but shows import errors for the deleted GrapesJS files. These are fixed in the next tasks.

- [ ] **Step 5: Commit the deletion**

  ```bash
  git add -A apps/desktop/src/website/ apps/desktop/package.json pnpm-lock.yaml
  git commit -m "chore(website): remove GrapesJS, install atlas-web-builder"
  ```

---

## Task 2 — Rewrite WebsitePageRenderer

**Files:**
- Rewrite: `apps/desktop/src/website/WebsitePageRenderer.jsx`

- [ ] **Step 1: Rewrite the file**

  ```jsx
  // apps/desktop/src/website/WebsitePageRenderer.jsx
  import { AtlasWebBuilderProvider, AtlasWebRenderer, baseBlocks, defineTheme, defaultTheme, parsePage } from '@raulbellosom/atlas-web-builder'
  import '@raulbellosom/atlas-web-builder/styles'

  export function WebsitePageRenderer({ page, theme }) {
    const resolvedTheme = theme?.tokens
      ? defineTheme({ ...defaultTheme, id: 'atlas-site', name: 'Site Theme', tokens: { ...defaultTheme.tokens, ...theme.tokens } })
      : defaultTheme

    if (!page?.publishedBuilderData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <p className="text-sm text-gray-400">Esta pagina no tiene contenido publicado aun.</p>
        </div>
      )
    }

    let parsedPage
    try {
      parsedPage = typeof page.publishedBuilderData === 'string'
        ? parsePage(page.publishedBuilderData)
        : parsePage(JSON.stringify(page.publishedBuilderData))
    } catch {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <p className="text-sm text-gray-400">Esta pagina no tiene contenido publicado aun.</p>
        </div>
      )
    }

    return (
      <AtlasWebBuilderProvider blocks={baseBlocks} theme={resolvedTheme}>
        <AtlasWebRenderer page={parsedPage} mode="public" />
      </AtlasWebBuilderProvider>
    )
  }
  ```

- [ ] **Step 2: Verify syntax**

  ```bash
  node --check apps/desktop/src/website/WebsitePageRenderer.jsx
  ```

---

## Task 3 — Rewrite WebsitePageEditorScreen

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx`

- [ ] **Step 1: Read current file to understand structure**

  Read `apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx` to understand current data fetching (how it loads the page and saves).

- [ ] **Step 2: Rewrite the file**

  ```jsx
  // apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx
  import { useEffect, useState } from 'react'
  import { useParams, useNavigate } from 'react-router-dom'
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
  import { AtlasWebBuilderEditor, baseBlocks, serializePage, parsePage, defaultTheme, defineTheme } from '@raulbellosom/atlas-web-builder'
  import '@raulbellosom/atlas-web-builder/styles'
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

  function createAssetSource(token) {
    const apiUrl = getApiUrl()
    return {
      async list() {
        try {
          const data = await apiFetch('/files?pageSize=100', token)
          const files = (data.data ?? []).filter((f) => f.mimeType?.startsWith('image/'))
          if (!files.length) return []
          const urlRes = await apiFetch('/files/batch-signed-urls', token, {
            method: 'POST',
            body: JSON.stringify({ fileIds: files.map((f) => f.id) }),
          })
          const urlMap = urlRes.data ?? {}
          return files.filter((f) => urlMap[f.id]).map((f) => ({
            id: f.id, name: f.originalName ?? f.id, kind: 'image', url: urlMap[f.id],
          }))
        } catch { return [] }
      },
      async upload(file) {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`${apiUrl}/files/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        })
        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        const f = data.data
        return { id: f.id, name: f.originalName ?? f.id, kind: 'image', url: f.url ?? '' }
      },
      async remove(id) {
        await apiFetch(`/files/${id}`, token, { method: 'DELETE' })
      },
    }
  }

  export default function WebsitePageEditorScreen() {
    const { pageId } = useParams()
    const navigate   = useNavigate()
    const { session } = useAuth()
    const token = session?.access_token
    const queryClient = useQueryClient()

    const pageQuery = useQuery({
      queryKey: ['website-page', pageId, token],
      queryFn: () => apiFetch(`/website/pages/${pageId}`, token),
      enabled: Boolean(token) && Boolean(pageId),
    })

    const siteQuery = useQuery({
      queryKey: ['website-site', token],
      queryFn: () => apiFetch('/website/site', token),
      enabled: Boolean(token),
      staleTime: 60_000,
    })

    const themeQuery = useQuery({
      queryKey: ['website-theme', token],
      queryFn: () => apiFetch('/website/theme', token),
      enabled: Boolean(token),
      staleTime: 60_000,
    })

    const saveDraftMutation = useMutation({
      mutationFn: (page) =>
        apiFetch(`/website/pages/${pageId}/draft`, token, {
          method: 'POST',
          body: JSON.stringify({ draft_builder_data: serializePage(page) }),
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['website-page', pageId] })
        toast.success('Borrador guardado')
      },
      onError: (err) => toast.error(err.message),
    })

    const publishMutation = useMutation({
      mutationFn: (page) =>
        apiFetch(`/website/pages/${pageId}/publish`, token, {
          method: 'POST',
          body: JSON.stringify({ draft_builder_data: serializePage(page) }),
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['website-page', pageId] })
        toast.success('Pagina publicada')
      },
      onError: (err) => toast.error(err.message),
    })

    const pageData   = pageQuery.data?.data ?? null
    const themeData  = themeQuery.data?.data ?? null

    const resolvedTheme = themeData?.tokens
      ? defineTheme({ ...defaultTheme, id: 'atlas-site', name: 'Site Theme', tokens: { ...defaultTheme.tokens, ...themeData.tokens } })
      : defaultTheme

    let initialPage = null
    if (pageData?.draft_builder_data) {
      try {
        initialPage = typeof pageData.draft_builder_data === 'string'
          ? parsePage(pageData.draft_builder_data)
          : parsePage(JSON.stringify(pageData.draft_builder_data))
      } catch { initialPage = null }
    }

    if (!initialPage && pageData) {
      initialPage = {
        schemaVersion: 1,
        id:            `page_${pageData.id}`,
        slug:          pageData.slug ?? '/',
        title:         pageData.title ?? 'Nueva pagina',
        visibility:    'public',
        regions:       { main: { id: 'region_main', children: [] } },
        blocks:        {},
        seo:           { title: pageData.title ?? '', description: '', canonical: null, ogImageAssetId: null },
        updatedAt:     new Date().toISOString(),
      }
    }

    if (pageQuery.isPending || !initialPage) {
      return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Cargando editor...</div>
    }

    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <AtlasWebBuilderEditor
          blocks={baseBlocks}
          initialPage={initialPage}
          theme={resolvedTheme}
          assets={createAssetSource(token)}
          brandName="Atlas ERP"
          onSaveDraft={(page) => saveDraftMutation.mutate(page)}
          onPublish={(page) => publishMutation.mutate(page)}
        />
      </div>
    )
  }
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx
  ```

---

## Task 4 — Add draft + publish API endpoints

The editor calls `POST /website/pages/:id/draft` and `POST /website/pages/:id/publish`. These may already exist — check `apps/api/src/routes/website/pages-routes.js`.

- [ ] **Step 1: Read pages-routes.js to check for draft and publish endpoints**

  Open `apps/api/src/routes/website/pages-routes.js` and look for routes matching `/pages/:id/draft` and `/pages/:id/publish`.

- [ ] **Step 2a: If draft endpoint is missing, add it**

  In `createPagesRouter`, add:
  ```js
  app.post('/website/pages/:id/draft', requirePermission('website.pages.update'), async (c) => {
    const companyId = c.get('companyId')
    const id = c.req.param('id')
    const { draft_builder_data } = await c.req.json()
    await websiteSvc.saveDraft({ companyId, id, draftBuilderData: draft_builder_data })
    return c.json({ ok: true })
  })
  ```

  In `website-service.js`, add `saveDraft`:
  ```js
  async function saveDraft({ companyId, id, draftBuilderData }) {
    await prisma.$queryRaw`
      UPDATE website_page
      SET draft_builder_data = ${draftBuilderData}::jsonb, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
  }
  ```

- [ ] **Step 2b: If publish endpoint is missing, add it**

  ```js
  app.post('/website/pages/:id/publish', requirePermission('website.pages.update'), async (c) => {
    const companyId = c.get('companyId')
    const id = c.req.param('id')
    const { draft_builder_data } = await c.req.json()
    await websiteSvc.publishPage({ companyId, id, draftBuilderData: draft_builder_data })
    return c.json({ ok: true })
  })
  ```

  ```js
  async function publishPage({ companyId, id, draftBuilderData }) {
    await prisma.$queryRaw`
      UPDATE website_page
      SET draft_builder_data     = ${draftBuilderData}::jsonb,
          published_builder_data = ${draftBuilderData}::jsonb,
          status = 'published',
          updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
  }
  ```

- [ ] **Step 3: Add `GET /website/pages/:id` endpoint if missing**

  The editor needs to load a single page by ID. Check if it exists; if not:
  ```js
  app.get('/website/pages/:id', requirePermission('website.pages.read'), async (c) => {
    const companyId = c.get('companyId')
    const id = c.req.param('id')
    const page = await websiteSvc.getPageById({ companyId, id })
    if (!page) return c.json({ error: 'Not found' }, 404)
    return c.json({ data: page })
  })
  ```

  ```js
  async function getPageById({ companyId, id }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM website_page
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid AND enabled = true
      LIMIT 1
    `
    return rows[0] ?? null
  }
  ```

- [ ] **Step 4: Add `GET /website/theme` endpoint if missing**

  ```js
  app.get('/website/theme', requirePermission('website.theme.read'), async (c) => {
    const companyId = c.get('companyId')
    const theme = await websiteSvc.getActiveTheme({ companyId })
    return c.json({ data: theme })
  })
  ```

  ```js
  async function getActiveTheme({ companyId }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM website_theme
      WHERE company_id = ${companyId}::uuid AND enabled = true
      ORDER BY created_at DESC LIMIT 1
    `
    return rows[0] ?? null
  }
  ```

- [ ] **Step 5: Verify syntax**

  ```bash
  node --check apps/api/src/routes/website/pages-routes.js
  node --check apps/api/src/routes/website/website-service.js
  ```

---

## Task 5 — Site creation wizard

**Files:**
- Create: `apps/desktop/src/modules/atlas.website/screens/WebsiteSiteWizard.jsx`
- Rewrite: `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx`

- [ ] **Step 1: Create WebsiteSiteWizard.jsx**

  ```jsx
  // apps/desktop/src/modules/atlas.website/screens/WebsiteSiteWizard.jsx
  import { useState } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { useMutation, useQueryClient } from '@tanstack/react-query'
  import { defineTheme, defaultTheme } from '@raulbellosom/atlas-web-builder'
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
    { value: 'informational', label: 'Sitio informativo',        description: 'Paginas estaticas con formulario de contacto' },
    { value: 'ecommerce',     label: 'Tienda online',            description: 'Catalogo de productos, carrito y pagos' },
    { value: 'bookings',      label: 'Sitio con reservaciones',  description: 'Agenda publica integrada con el calendario' },
  ]

  const FONTS = [
    { value: 'Inter',             label: 'Inter (moderno)' },
    { value: 'Playfair Display',  label: 'Playfair Display (elegante)' },
    { value: 'Space Grotesk',     label: 'Space Grotesk (tecnico)' },
    { value: 'DM Sans',           label: 'DM Sans (amigable)' },
    { value: 'Merriweather',      label: 'Merriweather (editorial)' },
  ]

  export default function WebsiteSiteWizard() {
    const navigate = useNavigate()
    const { session } = useAuth()
    const token = session?.access_token
    const queryClient = useQueryClient()

    const [step, setStep]         = useState(1)
    const [siteType, setSiteType] = useState('informational')
    const [identity, setIdentity] = useState({
      name:          '',
      primaryColor:  '#6D28D9',
      bgColor:       '#FFFFFF',
      font:          'Inter',
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
        const builtTheme = defineTheme({ ...defaultTheme, id: 'atlas-site', name: 'Site Theme', tokens: themeTokens })

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
                draft_builder_data: JSON.stringify(p.page),
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

          {/* Step 1 — Site type */}
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

          {/* Step 2 — Identity */}
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
                    <Input value={identity.primaryColor} onChange={(e) => setIdentity((i) => ({ ...i, primaryColor: e.target.value }))} className="font-mono text-sm" />
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
                    <Input value={identity.bgColor} onChange={(e) => setIdentity((i) => ({ ...i, bgColor: e.target.value }))} className="font-mono text-sm" />
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

          {/* Step 3 — Template + pages */}
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
                    <button type="button" className="text-xs text-[hsl(var(--muted-foreground))] underline" onClick={() => setSelectedTemplate(null)}>
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
  ```

- [ ] **Step 2: Rewrite WebsiteOverviewScreen.jsx to show wizard or dashboard**

  ```jsx
  // apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx
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
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/desktop/src/modules/atlas.website/screens/WebsiteSiteWizard.jsx
  node --check apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx
  ```

---

## Task 6 — Add `POST /website/theme` API endpoint

The wizard POSTs the theme after creating the site. Check if this endpoint exists in `themes-routes.js`.

- [ ] **Step 1: Check themes-routes.js**

  Open `apps/api/src/routes/website/themes-routes.js`. If `POST /website/theme` is missing, add it.

- [ ] **Step 2: Add endpoint if missing**

  In the themes service (`website-service.js`), add:
  ```js
  async function createTheme({ companyId, siteId, tokens, typography }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO website_theme (company_id, site_id, tokens, typography)
      VALUES (${companyId}::uuid, ${siteId}::uuid, ${JSON.stringify(tokens)}::jsonb, ${typography})
      RETURNING *
    `
    return rows[0]
  }
  ```

  In `themes-routes.js`:
  ```js
  app.post('/website/theme', requirePermission('website.theme.update'), async (c) => {
    const companyId = c.get('companyId')
    const { site_id, tokens, typography } = await c.req.json()
    const theme = await websiteSvc.createTheme({ companyId, siteId: site_id, tokens, typography })
    return c.json({ data: theme }, 201)
  })
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/api/src/routes/website/themes-routes.js
  ```

---

## Task 7 — Create minimal templates (atlas-web-builder format)

The wizard needs templates in the new JSON format. Create at least 2 representative templates.

**Files:**
- Create: `apps/desktop/src/website/atlasTemplates/templateRestaurante.js`
- Create: `apps/desktop/src/website/atlasTemplates/templateNegocio.js`
- Create: `apps/desktop/src/website/atlasTemplates/index.js`

- [ ] **Step 1: Create atlasTemplates directory**

  ```bash
  mkdir -p apps/desktop/src/website/atlasTemplates
  ```

- [ ] **Step 2: Create templateRestaurante.js**

  ```js
  // apps/desktop/src/website/atlasTemplates/templateRestaurante.js
  function makeId() { return `blk_${Math.random().toString(36).slice(2, 9)}` }

  const heroId     = makeId()
  const sectionId  = makeId()
  const headingId  = makeId()
  const textId     = makeId()

  export const templateRestaurante = {
    id:          'restaurante',
    label:       'Restaurante',
    category:    'hosteleria',
    color:       '#92400e',
    description: 'Sitio para restaurantes con menu, galeria y reservas.',
    pages: [
      {
        id:        'home',
        label:     'Inicio',
        routePath: '/',
        required:  true,
        page: {
          schemaVersion: 1,
          id:         'page_home',
          slug:       '/',
          title:      'Inicio',
          visibility: 'public',
          regions: { main: { id: 'region_main', children: [heroId, sectionId] } },
          blocks: {
            [heroId]: {
              id: heroId, type: 'HeroBlock',
              props: { title: 'Bienvenido a nuestro restaurante', subtitle: 'Sabor autentico en cada plato', variant: 'centered', ctaLabel: 'Ver menu', ctaHref: '/menu' },
              children: {},
            },
            [sectionId]: {
              id: sectionId, type: 'SectionBlock',
              props: { paddingY: 'lg', background: 'muted' },
              children: { default: { id: `region_${sectionId}`, children: [headingId, textId] } },
            },
            [headingId]: { id: headingId, type: 'HeadingBlock', props: { level: 'h2', text: 'Nuestra historia' }, children: {} },
            [textId]:    { id: textId,    type: 'TextBlock',    props: { text: 'Desde 1990 ofrecemos la mejor gastronomia de la region.' }, children: {} },
          },
          seo:       { title: 'Restaurante - Inicio', description: 'El mejor restaurante de la ciudad', canonical: null, ogImageAssetId: null },
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        id:        'menu',
        label:     'Menu',
        routePath: '/menu',
        required:  false,
        page: {
          schemaVersion: 1,
          id:         'page_menu',
          slug:       '/menu',
          title:      'Menu',
          visibility: 'public',
          regions: { main: { id: 'region_main', children: [] } },
          blocks: {},
          seo:       { title: 'Menu', description: '', canonical: null, ogImageAssetId: null },
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        id:        'contacto',
        label:     'Contacto',
        routePath: '/contacto',
        required:  false,
        page: {
          schemaVersion: 1,
          id:         'page_contacto',
          slug:       '/contacto',
          title:      'Contacto',
          visibility: 'public',
          regions: { main: { id: 'region_main', children: [] } },
          blocks: {},
          seo:       { title: 'Contacto', description: '', canonical: null, ogImageAssetId: null },
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ],
  }
  ```

- [ ] **Step 3: Create templateNegocio.js**

  ```js
  // apps/desktop/src/website/atlasTemplates/templateNegocio.js
  function makeId() { return `blk_${Math.random().toString(36).slice(2, 9)}` }

  const heroId = makeId()
  const colId  = makeId()

  export const templateNegocio = {
    id:          'negocio',
    label:       'Negocio General',
    category:    'negocios',
    color:       '#374151',
    description: 'Pagina profesional para cualquier tipo de negocio.',
    pages: [
      {
        id:        'home',
        label:     'Inicio',
        routePath: '/',
        required:  true,
        page: {
          schemaVersion: 1,
          id:         'page_home',
          slug:       '/',
          title:      'Inicio',
          visibility: 'public',
          regions: { main: { id: 'region_main', children: [heroId, colId] } },
          blocks: {
            [heroId]: {
              id: heroId, type: 'HeroBlock',
              props: { title: 'Tu negocio al siguiente nivel', subtitle: 'Soluciones profesionales para tu empresa', variant: 'split' },
              children: {},
            },
            [colId]: {
              id: colId, type: 'ColumnsBlock',
              props: { columns: 3, gap: 'lg' },
              children: {},
            },
          },
          seo:       { title: 'Inicio', description: '', canonical: null, ogImageAssetId: null },
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        id:        'servicios',
        label:     'Servicios',
        routePath: '/servicios',
        required:  false,
        page: {
          schemaVersion: 1,
          id:         'page_servicios',
          slug:       '/servicios',
          title:      'Servicios',
          visibility: 'public',
          regions: { main: { id: 'region_main', children: [] } },
          blocks: {},
          seo:       { title: 'Servicios', description: '', canonical: null, ogImageAssetId: null },
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        id:        'contacto',
        label:     'Contacto',
        routePath: '/contacto',
        required:  false,
        page: {
          schemaVersion: 1,
          id:         'page_contacto',
          slug:       '/contacto',
          title:      'Contacto',
          visibility: 'public',
          regions: { main: { id: 'region_main', children: [] } },
          blocks: {},
          seo:       { title: 'Contacto', description: '', canonical: null, ogImageAssetId: null },
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ],
  }
  ```

- [ ] **Step 4: Create index.js**

  ```js
  // apps/desktop/src/website/atlasTemplates/index.js
  import { templateRestaurante } from './templateRestaurante.js'
  import { templateNegocio }     from './templateNegocio.js'

  export const allTemplates = [
    templateRestaurante,
    templateNegocio,
  ]
  ```

  Note: The remaining 8 templates from the original spec (Spa, Agencia, Ecommerce, Servicios, Clinica, Portfolio, Inmobiliaria, Blog, ONG, Educacion) follow the same pattern. Add them to this index after creating each one.

- [ ] **Step 5: Verify syntax**

  ```bash
  node --check apps/desktop/src/website/atlasTemplates/index.js
  ```

---

## Task 8 — Update manifest navigation + smoke-test

- [ ] **Step 1: Update atlas.website navigation in feature-modules.js**

  Open `apps/api/src/manifests/official/feature-modules.js` and replace the `atlas.website` navigation array with:

  ```js
  navigation: [
    { label: 'Sitio web',   path: '/app/m/atlas.website',              icon: 'Globe',          layout: 'main', permissionKey: 'website.access' },
    { label: 'Paginas',     path: '/app/m/atlas.website/pages',        icon: 'FileText',       layout: 'main', permissionKey: 'website.pages.read' },
    { label: 'Plantillas',  path: '/app/m/atlas.website/templates',    icon: 'LayoutTemplate', layout: 'main', permissionKey: 'website.pages.create' },
    { label: 'Blog',        path: '/app/m/atlas.website/blog',         icon: 'BookOpen',       layout: 'main', permissionKey: 'website.pages.read' },
    { label: 'Formularios', path: '/app/m/atlas.website/forms',        icon: 'FormInput',      layout: 'main', permissionKey: 'website.pages.read' },
    { label: 'Tema',        path: '/app/m/atlas.website/theme',        icon: 'Palette',        layout: 'main', permissionKey: 'website.theme.read' },
    { label: 'Pagos',       path: '/app/m/atlas.website/payments',     icon: 'CreditCard',     layout: 'main', permissionKey: 'website.site.update' },
  ],
  ```

  Remove the old `'Menus'` entry.

- [ ] **Step 2: Start dev servers**

  ```bash
  pnpm dev
  ```

- [ ] **Step 3: Verify wizard appears for new site**

  Log in. Navigate to `/app/m/atlas.website`. If no site exists, the wizard should show. Complete all 3 steps with test data. Confirm the editor opens after wizard completion.

- [ ] **Step 4: Test editor save + publish**

  In the editor, add a block. Click "Guardar borrador". Confirm success toast. Click "Publicar". Confirm success toast.

- [ ] **Step 5: Test public renderer**

  Navigate to `http://localhost:5173/` (or any published page path). Confirm `AtlasWebRenderer` renders the page content.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/desktop/src/website/ \
          apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx \
          apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx \
          apps/desktop/src/modules/atlas.website/screens/WebsiteSiteWizard.jsx \
          apps/api/src/routes/website/ \
          apps/api/src/manifests/official/feature-modules.js
  git commit -m "feat(website): replace GrapesJS with atlas-web-builder, add site wizard and templates"
  ```

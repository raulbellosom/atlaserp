# Hosted Build — Plan A: Backend API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend for hosted dist/ builds: Prisma migration, upload pipeline, serving layer with cache and SEO injection, and the /public/site/* catch-all route.

**Architecture:** A new `dist-upload-service.js` handles zip extraction and Supabase Storage uploads. A new `dist-serve-service.js` handles route resolution, in-memory caching (5min TTL), and SEO meta-tag injection. A new catch-all `GET /public/site/*` in index.js delegates to the serve service based on WebsiteSite.sourceType ('none' | 'builder' | 'dist').

**Tech Stack:** Hono, Prisma (raw SQL for AME3 tables), JSZip (already installed), Supabase Storage (atlas-website bucket), Node.js built-in test runner.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create migration | `prisma/migrations/20260601020000_add_website_source_type/migration.sql` | Add 5 columns to website_site |
| Modify | `prisma/schema.prisma` | Add 5 fields to WebsiteSite model |
| Modify | `prisma/seed.js` | Seed primary_company_id InstanceConfig key + website.dist.upload permission |
| Create | `apps/api/src/services/dist-upload-service.js` | zip extraction, Supabase upload, prerender detection |
| Create | `apps/api/src/services/__tests__/dist-upload-service.test.js` | unit tests for pure functions |
| Create | `apps/api/src/services/dist-serve-service.js` | cache, route resolution, SEO injection, source switch |
| Create | `apps/api/src/services/__tests__/dist-serve-service.test.js` | unit tests for pure functions |
| Create | `apps/api/src/routes/website/dist-routes.js` | POST upload, DELETE dist endpoints |
| Modify | `apps/api/src/routes/website/index.js` | mount dist routes |
| Modify | `apps/api/src/index.js` | mount GET /public/site/* catch-all |
| Modify | `apps/api/src/permission-catalog.js` | add website.dist.upload permission |
| Modify | `apps/api/src/manifests/official/feature-modules.js` | add website.dist.upload to atlasWebsiteManifest |

---

## Tasks

### Task 1: Prisma migration and schema update

- [ ] **1.1** Create directory `prisma/migrations/20260601020000_add_website_source_type/` and write `migration.sql`:

```sql
ALTER TABLE website_site
  ADD COLUMN IF NOT EXISTS source_type        TEXT        NOT NULL DEFAULT 'builder',
  ADD COLUMN IF NOT EXISTS dist_uploaded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dist_file_count    INTEGER,
  ADD COLUMN IF NOT EXISTS dist_has_prerender BOOLEAN,
  ADD COLUMN IF NOT EXISTS dist_manifest      JSONB;
```

- [ ] **1.2** Add the following 5 fields inside `model WebsiteSite { ... }` in `prisma/schema.prisma`, after the `seoDefaults` line (line 634):

```prisma
  sourceType        String    @default("builder") @map("source_type")
  distUploadedAt    DateTime? @map("dist_uploaded_at")
  distFileCount     Int?      @map("dist_file_count")
  distHasPrerender  Boolean?  @map("dist_has_prerender")
  distManifest      Json?     @map("dist_manifest")
```

- [ ] **1.3** Apply the migration: `pnpm db:migrate`

- [ ] **1.4** Regenerate the Prisma client: `pnpm db:generate`

- [ ] **1.5** Syntax-check the API entry point: `node --check apps/api/src/index.js && echo OK`

- [ ] **1.6** Commit with message: `feat(db): add source_type and dist columns to website_site`

---

### Task 2: Seed primary_company_id and website.dist.upload permission

- [ ] **2.1** In `prisma/seed.js`, add the following block BEFORE the final `console.log(...)` line (currently line 195):

```js
// Seed primary_company_id InstanceConfig (first company, idempotent)
const firstCompany = await prisma.company.findFirst({ select: { id: true } })
if (firstCompany) {
  await prisma.instanceConfig.upsert({
    where: { key: 'primary_company_id' },
    update: {},
    create: { key: 'primary_company_id', value: firstCompany.id },
  })
}
```

- [ ] **2.2** In `apps/api/src/permission-catalog.js`, find the `"website.menus.update"` entry (currently the last website permission, around line 828) and add the following entry AFTER it, before the closing `};` of `PERMISSION_CATALOG`:

```js
  "website.dist.upload": {
    displayNameEs: "Subir build del sitio",
    descriptionEs: "Permite subir y eliminar el dist/ compilado del sitio publico.",
    groupKey: "website",
    order: 13,
  },
```

- [ ] **2.3** In `apps/api/src/manifests/official/feature-modules.js`, inside the `atlasWebsiteManifest` `permissions` array (currently ending at `website.menus.update`), add:

```js
{ key: "website.dist.upload", name: "Subir build del sitio" },
```

Also add it to the `acl.actions` map:

```js
"website.dist.upload": "website.dist.upload",
```

- [ ] **2.4** Run the seed: `node prisma/seed.js` — verify no errors in output.

- [ ] **2.5** Commit with message: `feat(seed): seed primary_company_id config and website.dist.upload permission`

---

### Task 3: dist-upload-service.js with tests

- [ ] **3.1** Create `apps/api/src/services/__tests__/dist-upload-service.test.js` with the following content:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findRootPrefix, getMimeType, detectPrerender } from '../dist-upload-service.js'

describe('findRootPrefix', () => {
  it('returns empty string when index.html is at zip root', () => {
    const files = ['index.html', 'assets/main.js', 'assets/style.css']
    assert.equal(findRootPrefix(files), '')
  })

  it('returns prefix when index.html is inside a single folder', () => {
    const files = ['dist/index.html', 'dist/assets/main.js']
    assert.equal(findRootPrefix(files), 'dist/')
  })

  it('returns null when no index.html found', () => {
    const files = ['assets/main.js', 'README.md']
    assert.equal(findRootPrefix(files), null)
  })

  it('returns null when index.html is nested more than one level', () => {
    const files = ['output/dist/index.html']
    assert.equal(findRootPrefix(files), null)
  })
})

describe('getMimeType', () => {
  it('returns correct MIME for html', () => assert.equal(getMimeType('index.html'), 'text/html'))
  it('returns correct MIME for js', () => assert.equal(getMimeType('main.js'), 'application/javascript'))
  it('returns correct MIME for css', () => assert.equal(getMimeType('style.css'), 'text/css'))
  it('returns correct MIME for png', () => assert.equal(getMimeType('logo.png'), 'image/png'))
  it('returns octet-stream for unknown', () => assert.equal(getMimeType('file.xyz'), 'application/octet-stream'))
})

describe('detectPrerender', () => {
  it('returns false when only root index.html exists', () => {
    const paths = ['index.html', 'assets/main.js']
    assert.equal(detectPrerender(paths), false)
  })

  it('returns true when route-level HTML files exist', () => {
    const paths = ['index.html', 'productos/index.html', 'assets/main.js']
    assert.equal(detectPrerender(paths), true)
  })

  it('returns true when flat route HTML files exist', () => {
    const paths = ['index.html', 'contacto.html']
    assert.equal(detectPrerender(paths), true)
  })
})
```

- [ ] **3.2** Run tests to confirm they fail (exported functions do not exist yet):
  `node --test apps/api/src/services/__tests__/dist-upload-service.test.js`

- [ ] **3.3** Create `apps/api/src/services/dist-upload-service.js` with the following content:

```js
const BUCKET = 'atlas-website'
const MAX_BYTES = 100 * 1024 * 1024

const MIME_MAP = {
  html: 'text/html', css: 'text/css', js: 'application/javascript',
  mjs: 'application/javascript', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
  txt: 'text/plain', xml: 'application/xml', map: 'application/json',
}

export function getMimeType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

export function findRootPrefix(filePaths) {
  if (filePaths.includes('index.html')) return ''
  const wrapped = filePaths.find(p => {
    const parts = p.split('/')
    return parts.length === 2 && parts[1] === 'index.html'
  })
  if (wrapped) return wrapped.slice(0, wrapped.lastIndexOf('/') + 1)
  return null
}

export function detectPrerender(relativePaths) {
  return relativePaths.some(p => p.endsWith('.html') && p !== 'index.html')
}

export function createDistUploadService({ prisma, supabaseAdmin }) {
  async function uploadDist({ siteId, fileBuffer, fileName, companySlug }) {
    if (fileBuffer.byteLength > MAX_BYTES) {
      throw Object.assign(new Error('El archivo supera el limite de 100MB'), { status: 413 })
    }

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(fileBuffer)

    const allPaths = Object.keys(zip.files).filter(k => !zip.files[k].dir)
    const rootPrefix = findRootPrefix(allPaths)
    if (rootPrefix === null) {
      throw Object.assign(
        new Error('El zip debe contener un index.html en la raiz o en una carpeta de primer nivel'),
        { status: 422 }
      )
    }

    const storagePrefix = `dist/${companySlug}/`
    const manifest = []

    for (const [zipPath, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      const relative = zipPath.slice(rootPrefix.length)
      if (!relative) continue

      const content = await entry.async('nodebuffer')
      const objectKey = `${storagePrefix}${relative}`

      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(objectKey, content, { contentType: getMimeType(relative), upsert: true })

      if (error) {
        throw Object.assign(
          new Error(`Error al subir ${relative}: ${error.message}`),
          { status: 500 }
        )
      }
      manifest.push(objectKey)
    }

    const relativePaths = manifest.map(k => k.slice(storagePrefix.length))
    const hasPrerender = detectPrerender(relativePaths)
    const now = new Date()

    await prisma.$executeRaw`
      UPDATE website_site
      SET source_type        = 'dist',
          dist_uploaded_at   = ${now},
          dist_file_count    = ${manifest.length},
          dist_has_prerender = ${hasPrerender},
          dist_manifest      = ${JSON.stringify(manifest)}::jsonb
      WHERE id = ${siteId}::uuid
    `

    return { fileCount: manifest.length, hasPrerender, uploadedAt: now }
  }

  async function deleteDist({ siteId, companySlug }) {
    const site = await prisma.$queryRaw`
      SELECT dist_manifest FROM website_site WHERE id = ${siteId}::uuid
    `
    const manifest = site[0]?.dist_manifest ?? []

    if (manifest.length > 0) {
      await supabaseAdmin.storage.from(BUCKET).remove(manifest)
    }

    await prisma.$executeRaw`
      UPDATE website_site
      SET source_type        = 'builder',
          dist_uploaded_at   = NULL,
          dist_file_count    = NULL,
          dist_has_prerender = NULL,
          dist_manifest      = NULL
      WHERE id = ${siteId}::uuid
    `
  }

  return { uploadDist, deleteDist }
}
```

- [ ] **3.4** Run tests again — all must PASS:
  `node --test apps/api/src/services/__tests__/dist-upload-service.test.js`

- [ ] **3.5** Syntax-check: `node --check apps/api/src/services/dist-upload-service.js && echo OK`

- [ ] **3.6** Commit with message: `feat(api): dist-upload-service — zip extraction, Supabase upload, prerender detection`

---

### Task 4: dist-serve-service.js with tests

- [ ] **4.1** Create `apps/api/src/services/__tests__/dist-serve-service.test.js` with the following content:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isAssetPath, resolveHtmlCandidates, injectSeoTags } from '../dist-serve-service.js'

describe('isAssetPath', () => {
  it('returns true for .js files', () => assert.equal(isAssetPath('/assets/main.js'), true))
  it('returns true for .css files', () => assert.equal(isAssetPath('/assets/style.css'), true))
  it('returns true for .png files', () => assert.equal(isAssetPath('/logo.png'), true))
  it('returns true for .woff2 files', () => assert.equal(isAssetPath('/font.woff2'), true))
  it('returns false for root path', () => assert.equal(isAssetPath('/'), false))
  it('returns false for clean routes', () => assert.equal(isAssetPath('/productos'), false))
  it('returns false for nested routes', () => assert.equal(isAssetPath('/bandas/rock-band'), false))
})

describe('resolveHtmlCandidates', () => {
  it('returns three candidates for a clean route', () => {
    const result = resolveHtmlCandidates('myco', '/productos/zapatos')
    assert.deepEqual(result, [
      'dist/myco/productos/zapatos/index.html',
      'dist/myco/productos/zapatos.html',
      'dist/myco/index.html',
    ])
  })

  it('returns only fallback for root path', () => {
    const result = resolveHtmlCandidates('myco', '/')
    assert.deepEqual(result, [
      'dist/myco/index.html',
      'dist/myco/index.html',
      'dist/myco/index.html',
    ])
  })
})

describe('injectSeoTags', () => {
  it('injects title when missing', () => {
    const html = '<html><head></head><body></body></html>'
    const seo = { title: 'Mi Sitio', description: 'Descripcion' }
    const result = injectSeoTags(html, seo)
    assert.ok(result.includes('<title>Mi Sitio</title>'))
    assert.ok(result.includes('<meta name="description"'))
  })

  it('does not overwrite existing title', () => {
    const html = '<html><head><title>Titulo Propio</title></head><body></body></html>'
    const seo = { title: 'Mi Sitio' }
    const result = injectSeoTags(html, seo)
    const titleCount = (result.match(/<title>/g) ?? []).length
    assert.equal(titleCount, 1)
    assert.ok(result.includes('Titulo Propio'))
  })

  it('returns html unchanged when seoDefaults is null', () => {
    const html = '<html><head></head><body></body></html>'
    const result = injectSeoTags(html, null)
    assert.equal(result, html)
  })
})
```

- [ ] **4.2** Run tests to confirm they fail (exported functions do not exist yet):
  `node --test apps/api/src/services/__tests__/dist-serve-service.test.js`

- [ ] **4.3** Create `apps/api/src/services/dist-serve-service.js` with the following content:

```js
const BUCKET = 'atlas-website'
const ASSET_EXTENSIONS = new Set([
  'js', 'mjs', 'css', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'eot', 'map', 'json', 'txt', 'xml', 'pdf',
])
const HTML_CACHE = new Map()
const HTML_CACHE_TTL = 5 * 60 * 1000
const HTML_CACHE_MAX = 500

export function isAssetPath(urlPath) {
  const lastSegment = urlPath.split('/').pop() ?? ''
  const dot = lastSegment.lastIndexOf('.')
  if (dot === -1) return false
  const ext = lastSegment.slice(dot + 1).toLowerCase()
  return ASSET_EXTENSIONS.has(ext)
}

export function resolveHtmlCandidates(companySlug, urlPath) {
  const clean = urlPath.replace(/^\/+/, '').replace(/\/+$/, '')
  const base = `dist/${companySlug}/`
  const fallback = `${base}index.html`
  if (!clean) return [fallback, fallback, fallback]
  return [
    `${base}${clean}/index.html`,
    `${base}${clean}.html`,
    fallback,
  ]
}

export function injectSeoTags(html, seoDefaults) {
  if (!seoDefaults) return html
  const tags = []

  if (seoDefaults.title && !html.includes('<title>')) {
    tags.push(`<title>${escapeHtml(seoDefaults.title)}</title>`)
  }
  if (seoDefaults.description && !html.includes('name="description"')) {
    tags.push(`<meta name="description" content="${escapeHtml(seoDefaults.description)}" />`)
  }
  if (seoDefaults.ogTitle && !html.includes('property="og:title"')) {
    tags.push(`<meta property="og:title" content="${escapeHtml(seoDefaults.ogTitle)}" />`)
  }
  if (seoDefaults.ogDescription && !html.includes('property="og:description"')) {
    tags.push(`<meta property="og:description" content="${escapeHtml(seoDefaults.ogDescription)}" />`)
  }
  if (seoDefaults.ogImage && !html.includes('property="og:image"')) {
    tags.push(`<meta property="og:image" content="${escapeHtml(seoDefaults.ogImage)}" />`)
  }
  if (seoDefaults.robots && !html.includes('name="robots"')) {
    tags.push(`<meta name="robots" content="${escapeHtml(seoDefaults.robots)}" />`)
  }
  if (seoDefaults.canonical && !html.includes('rel="canonical"')) {
    tags.push(`<link rel="canonical" href="${escapeHtml(seoDefaults.canonical)}" />`)
  }

  if (tags.length === 0) return html
  return html.replace('<head>', `<head>\n  ${tags.join('\n  ')}`)
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getCacheKey(companyId, urlPath) {
  return `${companyId}:${urlPath}`
}

function getCached(key) {
  const entry = HTML_CACHE.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > HTML_CACHE_TTL) { HTML_CACHE.delete(key); return null }
  return entry.html
}

function setCache(key, html) {
  if (HTML_CACHE.size >= HTML_CACHE_MAX) {
    const firstKey = HTML_CACHE.keys().next().value
    HTML_CACHE.delete(firstKey)
  }
  HTML_CACHE.set(key, { html, cachedAt: Date.now() })
}

export function invalidateCache(companyId) {
  for (const key of HTML_CACHE.keys()) {
    if (key.startsWith(`${companyId}:`)) HTML_CACHE.delete(key)
  }
}

export function createDistServeService({ prisma, supabaseAdmin }) {
  let _primaryCompanyCache = null
  let _primaryCompanyCachedAt = 0
  const COMPANY_CACHE_TTL = 60_000

  async function getPrimaryCompany() {
    if (_primaryCompanyCache && Date.now() - _primaryCompanyCachedAt < COMPANY_CACHE_TTL) {
      return _primaryCompanyCache
    }
    const config = await prisma.instanceConfig.findUnique({ where: { key: 'primary_company_id' } })
    if (!config) return null

    const rows = await prisma.$queryRaw`
      SELECT ws.id, ws.source_type, ws.seo_defaults, ws.company_id,
             c.slug as company_slug
      FROM website_site ws
      JOIN company c ON c.id = ws.company_id
      WHERE ws.company_id = ${config.value}::uuid
        AND ws.enabled = true
      LIMIT 1
    `
    const site = rows[0] ?? null
    _primaryCompanyCache = site
    _primaryCompanyCachedAt = Date.now()
    return site
  }

  function invalidatePrimaryCache() {
    _primaryCompanyCache = null
  }

  async function serve(c, urlPath) {
    const site = await getPrimaryCompany()

    if (!site) {
      return c.json({ error: 'Sitio no configurado' }, 404)
    }

    const sourceType = site.source_type

    if (sourceType === 'none') {
      return c.json({ error: 'Sitio no disponible' }, 404)
    }

    if (sourceType === 'builder') {
      return null // signal to caller: delegate to existing builder handler
    }

    // source_type === 'dist'
    if (isAssetPath(urlPath)) {
      const objectKey = `dist/${site.company_slug}${urlPath}`
      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectKey}`
      return c.redirect(publicUrl, 302)
    }

    // HTML route
    const cacheKey = getCacheKey(site.company_id, urlPath)
    const cached = getCached(cacheKey)
    if (cached) {
      return c.html(cached)
    }

    const candidates = resolveHtmlCandidates(site.company_slug, urlPath)
    let html = null

    for (const objectKey of [...new Set(candidates)]) {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(objectKey)
      if (!error && data) {
        html = await data.text()
        break
      }
    }

    if (!html) {
      return c.json({ error: 'Pagina no encontrada' }, 404)
    }

    const injected = injectSeoTags(html, site.seo_defaults)
    setCache(cacheKey, injected)

    c.header('Cache-Control', 'public, max-age=300')
    return c.html(injected)
  }

  return { serve, invalidatePrimaryCache }
}
```

- [ ] **4.4** Run tests — all must PASS:
  `node --test apps/api/src/services/__tests__/dist-serve-service.test.js`

- [ ] **4.5** Syntax-check: `node --check apps/api/src/services/dist-serve-service.js && echo OK`

- [ ] **4.6** Commit with message: `feat(api): dist-serve-service — cache, route resolution, SEO injection`

---

### Task 5: dist-routes.js and mounting in website router

- [ ] **5.1** Create `apps/api/src/routes/website/dist-routes.js` with the following content:

```js
import { Hono } from 'hono'
import { createDistUploadService } from '../../services/dist-upload-service.js'

export function createDistRoutes({ prisma, supabaseAdmin, requirePermission }) {
  const app = new Hono()
  const uploadService = createDistUploadService({ prisma, supabaseAdmin })

  app.post(
    '/website/sites/:siteId/dist/upload',
    requirePermission('website.dist.upload'),
    async (c) => {
      try {
        const { siteId } = c.req.param()
        const body = await c.req.parseBody()
        const file = body.file

        if (!file || typeof file.arrayBuffer !== 'function') {
          return c.json({ error: 'Campo "file" requerido' }, 422)
        }

        const site = await prisma.$queryRaw`
          SELECT ws.id, c.slug as company_slug
          FROM website_site ws
          JOIN company c ON c.id = ws.company_id
          WHERE ws.id = ${siteId}::uuid AND ws.enabled = true
          LIMIT 1
        `
        if (!site[0]) return c.json({ error: 'Sitio no encontrado' }, 404)

        const buffer = await file.arrayBuffer()
        const result = await uploadService.uploadDist({
          siteId,
          fileBuffer: buffer,
          fileName: file.name,
          companySlug: site[0].company_slug,
        })

        return c.json({ data: result }, 201)
      } catch (err) {
        return c.json({ error: err.message }, err.status ?? 500)
      }
    }
  )

  app.delete(
    '/website/sites/:siteId/dist',
    requirePermission('website.dist.upload'),
    async (c) => {
      try {
        const { siteId } = c.req.param()
        const site = await prisma.$queryRaw`
          SELECT ws.id, c.slug as company_slug
          FROM website_site ws
          JOIN company c ON c.id = ws.company_id
          WHERE ws.id = ${siteId}::uuid AND ws.enabled = true
          LIMIT 1
        `
        if (!site[0]) return c.json({ error: 'Sitio no encontrado' }, 404)

        await uploadService.deleteDist({ siteId, companySlug: site[0].company_slug })
        return c.json({ data: { success: true } })
      } catch (err) {
        return c.json({ error: err.message }, err.status ?? 500)
      }
    }
  )

  return app
}
```

- [ ] **5.2** Modify `apps/api/src/routes/website/index.js`:

  a. Add the import at the top of the file (after existing imports):
  ```js
  import { createDistRoutes } from './dist-routes.js'
  ```

  b. Update the `createWebsiteRouter` function signature to accept `supabaseAdmin`:
  ```js
  export function createWebsiteRouter({ prisma, requirePermission, supabaseAdmin }) {
  ```

  c. Add the dist routes mount inside the function body, alongside the other `app.route(...)` calls:
  ```js
  app.route('/', createDistRoutes({ prisma, supabaseAdmin, requirePermission }))
  ```

- [ ] **5.3** In `apps/api/src/index.js`, find where `createWebsiteRouter` is called (search for `createWebsiteRouter({`) and add `supabaseAdmin` to the call:
  ```js
  const websiteRouter = createWebsiteRouter({ prisma, requirePermission, supabaseAdmin });
  ```

- [ ] **5.4** Syntax-check: `node --check apps/api/src/routes/website/dist-routes.js && node --check apps/api/src/routes/website/index.js && echo OK`

- [ ] **5.5** Commit with message: `feat(api): dist-routes — POST upload and DELETE dist endpoints`

---

### Task 6: /public/site/* catch-all in index.js

- [ ] **6.1** In `apps/api/src/index.js`, add the import at the top alongside the other service imports (after the existing import block, around line 65–70):

```js
import { createDistServeService } from "./services/dist-serve-service.js";
```

- [ ] **6.2** After the existing service instantiation block (search for the area where `filesService`, `companyService`, etc. are created with `create*Service({ prisma ... })`), instantiate the serve service:

```js
const distServeService = createDistServeService({ prisma, supabaseAdmin });
```

- [ ] **6.3** In `apps/api/src/index.js`, after the block of `app.route("/public/website", ...)` and `app.route("/public/storefront", ...)` calls (around line 2956), add the public site catch-all route as the LAST route before `serve()`:

```js
// Public site catch-all — must be registered last among public routes
app.get("/public/site/*", async (c) => {
  const fullPath = c.req.path.replace(/^\/public\/site/, '') || '/'
  const result = await distServeService.serve(c, fullPath)
  if (result === null) {
    // Builder mode: delegate to existing public-website handler
    const builderPath = `/public/website/resolve${fullPath === '/' ? '' : '?path=' + encodeURIComponent(fullPath)}`
    return c.redirect(builderPath, 307)
  }
  return result
})
```

- [ ] **6.4** Syntax-check: `node --check apps/api/src/index.js && echo OK`

- [ ] **6.5** Commit with message: `feat(api): mount GET /public/site/* catch-all with dist serve and builder fallback`

---

### Task 7: Smoke test full upload flow

With the API running (`pnpm dev:api`):

- [ ] **7.1** Create a minimal test dist zip (PowerShell):

```powershell
New-Item -ItemType Directory -Force -Path "$env:TEMP\testdist\assets" | Out-Null
Set-Content "$env:TEMP\testdist\index.html" '<html><head><title>Test</title></head><body>Hello dist</body></html>'
Set-Content "$env:TEMP\testdist\assets\main.js" 'console.log("hi")'
Compress-Archive -Path "$env:TEMP\testdist\*" -DestinationPath "$env:TEMP\testdist.zip" -Force
```

- [ ] **7.2** Obtain an admin JWT (`$ATLAS_TOKEN`) from the running ERP session and note a valid `SITE_ID` from the database.

- [ ] **7.3** Upload the zip:

```bash
curl -s -X POST http://localhost:4010/website/sites/$SITE_ID/dist/upload \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -F "file=@/tmp/testdist.zip" | jq .
```

Expected response:
```json
{ "data": { "fileCount": 2, "hasPrerender": false, "uploadedAt": "..." } }
```

- [ ] **7.4** Verify serving (requires `primary_company_id` config to point to the site's company):

```bash
curl -s http://localhost:4010/public/site/ | head -c 500
```

Expected: HTML containing `<title>Test</title>` and `Hello dist`.

- [ ] **7.5** Verify asset redirect:

```bash
curl -I http://localhost:4010/public/site/assets/main.js
```

Expected: `HTTP/1.1 302` with `Location:` pointing to the Supabase Storage URL.

- [ ] **7.6** Verify delete:

```bash
curl -s -X DELETE http://localhost:4010/website/sites/$SITE_ID/dist \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq .
```

Expected: `{ "data": { "success": true } }`

- [ ] **7.7** Verify that after delete, `/public/site/` redirects to builder (307):

```bash
curl -I http://localhost:4010/public/site/
```

Expected: `HTTP/1.1 307` redirect to `/public/website/resolve`.

- [ ] **7.8** Commit with message:
  `feat(website): hosted build backend — upload, serve, cache, SEO injection`

---

## Verification Checklist

Before marking this plan complete, confirm all of the following:

- [ ] Migration applied with `pnpm db:migrate` — no errors
- [ ] `pnpm db:generate` succeeded — Prisma client includes `sourceType`, `distUploadedAt`, `distFileCount`, `distHasPrerender`, `distManifest` on `WebsiteSite`
- [ ] `node prisma/seed.js` — no errors, `primary_company_id` key exists in `InstanceConfig`
- [ ] All `dist-upload-service` unit tests PASS
- [ ] All `dist-serve-service` unit tests PASS
- [ ] `node --check apps/api/src/index.js` exits 0
- [ ] Upload smoke test returns `{ data: { fileCount, hasPrerender, uploadedAt } }`
- [ ] Serve smoke test returns expected HTML with injected tags
- [ ] Asset path returns 302 redirect to Supabase URL
- [ ] Delete endpoint resets `source_type` to `'builder'`
- [ ] After delete, catch-all correctly falls back to builder (307 redirect)

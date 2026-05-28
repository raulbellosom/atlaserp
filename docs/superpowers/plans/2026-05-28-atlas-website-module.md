# Atlas Website Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** `2026-05-28-atlas-website-foundation.md` must be complete before starting this plan.

**Goal:** Ship `modules/official/atlas.website` as a fully operational AME3 feature module: 7 DB-owned models, private CRUD + publish API, ERP admin screens, Puck visual editor, 11 official blocks, and a full public page renderer.

**Architecture:** atlas.website is a `FEATURE` AME3 module living at `modules/official/atlas.website/`. Private routes are auto-discovered by the route loader (authenticated). The public endpoint from Plan A queries these tables. Admin screens live in `modules/official/atlas.website/components/` and are lazy-imported from `ModuleOutlet`. The Puck editor loads `draftBuilderData` and writes back via `POST /website/pages/:id/save-draft`; publishing upserts `WebsitePublishedRender` and copies draft to published fields. `WebsitePageRenderer` renders `publishedBuilderData` using Puck's render-only `<Render>` component.

**Tech Stack:** AME3 (`defineAtlasModule`, `defineModel`, `defineView`), Hono, Prisma `$queryRaw`, React 18, `@measured/puck`, TanStack Query, Tailwind, Zod

---

## File Map

### Create — module
- `modules/official/atlas.website/module.manifest.js`
- `modules/official/atlas.website/models/website-site.model.js`
- `modules/official/atlas.website/models/website-page.model.js`
- `modules/official/atlas.website/models/website-page-version.model.js`
- `modules/official/atlas.website/models/website-theme.model.js`
- `modules/official/atlas.website/models/website-menu.model.js`
- `modules/official/atlas.website/models/website-menu-item.model.js`
- `modules/official/atlas.website/models/website-published-render.model.js`
- `modules/official/atlas.website/api/service-helpers.js`
- `modules/official/atlas.website/api/website-service.js`
- `modules/official/atlas.website/api/pages-routes.js`
- `modules/official/atlas.website/api/themes-routes.js`
- `modules/official/atlas.website/api/menus-routes.js`
- `modules/official/atlas.website/api/index.js`
- `modules/official/atlas.website/validators/index.js`
- `modules/official/atlas.website/views/pages.table.js`
- `modules/official/atlas.website/views/pages.form.js`
- `modules/official/atlas.website/views/pages.detail.js`
- `modules/official/atlas.website/views/pages.page.js`
- `modules/official/atlas.website/migrations/.gitkeep`

### Create — admin screens (React, bundled by Vite)
- `modules/official/atlas.website/components/WebsiteOverviewScreen.jsx`
- `modules/official/atlas.website/components/WebsitePagesScreen.jsx`
- `modules/official/atlas.website/components/WebsitePageEditorScreen.jsx`
- `modules/official/atlas.website/components/WebsiteThemeScreen.jsx`
- `modules/official/atlas.website/components/WebsiteMenusScreen.jsx`
- `modules/official/atlas.website/components/WebsiteBlogScreen.jsx`
- `modules/official/atlas.website/components/WebsiteFormsScreen.jsx`

### Create — Puck blocks + block registry
- `apps/desktop/src/website/blocks/Section.jsx`
- `apps/desktop/src/website/blocks/Hero.jsx`
- `apps/desktop/src/website/blocks/Heading.jsx`
- `apps/desktop/src/website/blocks/TextBlock.jsx`
- `apps/desktop/src/website/blocks/ImageBlock.jsx`
- `apps/desktop/src/website/blocks/CTA.jsx`
- `apps/desktop/src/website/blocks/FeatureGrid.jsx`
- `apps/desktop/src/website/blocks/FAQ.jsx`
- `apps/desktop/src/website/blocks/ContactFormBlock.jsx`
- `apps/desktop/src/website/blocks/BlogPostsBlock.jsx`
- `apps/desktop/src/website/blocks/ProductGridBlock.jsx`
- `apps/desktop/src/website/atlasWebsiteConfig.js` — Puck config with all blocks

### Modify
- `apps/desktop/src/website/WebsitePageRenderer.jsx` — replace stub with Puck `<Render>`
- `apps/desktop/src/app/ModuleOutlet.jsx` — add atlas.website entries to SCREEN_MAP + resolveScreen
- `apps/api/src/manifests/official/feature-modules.js` — add atlas.website manifest export
- `apps/api/src/manifests/official/module-manifests-service.js` — add website to list (if needed)
- `apps/desktop/package.json` — add `@measured/puck`

---

## Task 1 — Install @measured/puck

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Add dependency**

  In `apps/desktop/package.json`, add to `dependencies`:
  ```json
  "@measured/puck": "^0.19.0"
  ```

- [ ] **Step 2: Install**

  ```bash
  pnpm install
  ```
  Expected: puck + its deps (react, react-dom peer deps already satisfied) installed.

- [ ] **Step 3: Verify import resolves**

  ```bash
  node -e "import('@measured/puck').then(m => console.log(Object.keys(m).join(', ')))"
  ```
  (Or just proceed — Vite will fail at build if it can't resolve.)

- [ ] **Step 4: Commit**

  ```bash
  git add apps/desktop/package.json pnpm-lock.yaml
  git commit -m "feat(website): install @measured/puck"
  ```

---

## Task 2 — Module manifest

**Files:**
- Create: `modules/official/atlas.website/module.manifest.js`

Key decisions:
- `kind: "FEATURE"` — installable/uninstallable by the user
- `core: false` — not forced-enabled
- Navigation paths are ABSOLUTE (e.g. `/app/m/atlas.website/pages`). They are normalised to relative by `normalizeModuleNavigationPath` in `runtimeModules.js`.

- [ ] **Step 1: Create the manifest**

  ```js
  // modules/official/atlas.website/module.manifest.js
  import { defineAtlasModule } from '@atlas/module-engine'

  export default defineAtlasModule({
    key: 'atlas.website',
    name: 'Sitio web',
    version: '0.1.0',
    kind: 'FEATURE',
    core: false,
    uninstallable: true,
    description: 'Sitio web publico, editor visual de paginas y publicacion de contenido.',
    summary: 'CMS, editor Puck y publicacion de paginas.',
    icon: 'Globe',
    color: '#6366f1',
    accentColor: '#4f46e5',
    initials: 'WB',
    dependencies: [{ key: 'atlas.core' }],
    models: [
      './models/website-site.model.js',
      './models/website-page.model.js',
      './models/website-page-version.model.js',
      './models/website-theme.model.js',
      './models/website-menu.model.js',
      './models/website-menu-item.model.js',
      './models/website-published-render.model.js',
    ],
    views: [
      './views/pages.table.js',
      './views/pages.form.js',
      './views/pages.detail.js',
      './views/pages.page.js',
    ],
    lifecycle: {
      installable: true,
      uninstallable: true,
      resettable: true,
      supportsDataPurge: true,
      defaultUninstallPolicy: 'purge-owned-tables',
      ownedModels: [
        'website.site',
        'website.page',
        'website.page_version',
        'website.theme',
        'website.menu',
        'website.menu_item',
        'website.published_render',
      ],
      ownedTables: [
        'website_site',
        'website_page',
        'website_page_version',
        'website_theme',
        'website_menu',
        'website_menu_item',
        'website_published_render',
      ],
      ownedEntities: [],
      sharedEntities: ['Company', 'AuditLog'],
    },
    permissions: [
      { key: 'website.access',         name: 'Acceso al Sitio web' },
      { key: 'website.site.read',       name: 'Ver configuracion del sitio' },
      { key: 'website.site.update',     name: 'Editar configuracion del sitio' },
      { key: 'website.pages.read',      name: 'Ver paginas' },
      { key: 'website.pages.create',    name: 'Crear paginas' },
      { key: 'website.pages.update',    name: 'Editar paginas' },
      { key: 'website.pages.publish',   name: 'Publicar paginas' },
      { key: 'website.pages.delete',    name: 'Eliminar paginas' },
      { key: 'website.theme.read',      name: 'Ver temas' },
      { key: 'website.theme.update',    name: 'Editar temas' },
      { key: 'website.menus.read',      name: 'Ver menus' },
      { key: 'website.menus.update',    name: 'Editar menus' },
    ],
    acl: {
      module: 'website.access',
      actions: {
        'website.site.read':     'website.site.read',
        'website.site.update':   'website.site.update',
        'website.pages.read':    'website.pages.read',
        'website.pages.create':  'website.pages.create',
        'website.pages.update':  'website.pages.update',
        'website.pages.publish': 'website.pages.publish',
        'website.pages.delete':  'website.pages.delete',
        'website.theme.read':    'website.theme.read',
        'website.theme.update':  'website.theme.update',
        'website.menus.read':    'website.menus.read',
        'website.menus.update':  'website.menus.update',
      },
    },
    navigation: [
      {
        label: 'Sitio web',
        path: '/app/m/atlas.website',
        icon: 'Globe',
        layout: 'main',
        permissionKey: 'website.access',
      },
      {
        label: 'Paginas',
        path: '/app/m/atlas.website/pages',
        icon: 'FileText',
        layout: 'main',
        permissionKey: 'website.pages.read',
      },
      {
        label: 'Tema',
        path: '/app/m/atlas.website/theme',
        icon: 'Palette',
        layout: 'main',
        permissionKey: 'website.theme.read',
      },
      {
        label: 'Menus',
        path: '/app/m/atlas.website/menus',
        icon: 'Menu',
        layout: 'main',
        permissionKey: 'website.menus.read',
      },
      {
        label: 'Blog',
        path: '/app/m/atlas.website/blog',
        icon: 'BookOpen',
        layout: 'main',
        permissionKey: 'website.pages.read',
      },
      {
        label: 'Formularios',
        path: '/app/m/atlas.website/forms',
        icon: 'FormInput',
        layout: 'main',
        permissionKey: 'website.pages.read',
      },
    ],
  })
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add modules/official/atlas.website/module.manifest.js
  git commit -m "feat(website): add atlas.website module manifest"
  ```

---

## Task 3 — Data models (7 files)

**Files:**
- Create: `modules/official/atlas.website/models/*.model.js`

All tables use snake_case names prefixed `website_`. Do not edit `prisma/schema.prisma`; Atlas ORM provisions these tables via `POST /modules/atlas.website/sync`.

- [ ] **Step 1: website-site.model.js**

  ```js
  // modules/official/atlas.website/models/website-site.model.js
  import { defineModel } from '@atlas/module-engine'

  export default defineModel({
    key: 'website.site',
    name: 'website.site',
    label: 'Sitio web',
    tableName: 'website_site',
    companyScoped: true,
    softDelete: true,
    fields: [
      { name: 'name',             type: 'text',     label: 'Nombre',          required: true },
      { name: 'domain',           type: 'text',     label: 'Dominio' },
      { name: 'default_locale',   type: 'text',     label: 'Idioma',          default: 'es' },
      { name: 'status',           type: 'select',   label: 'Estado',
        options: ['draft', 'published', 'maintenance'], default: 'draft' },
      { name: 'homepage_page_id', type: 'text',     label: 'Pagina de inicio' },
      { name: 'theme_id',         type: 'text',     label: 'Tema activo' },
      { name: 'settings',         type: 'json',     label: 'Configuracion' },
      { name: 'seo_defaults',     type: 'json',     label: 'SEO por defecto' },
    ],
  })
  ```

- [ ] **Step 2: website-page.model.js**

  ```js
  // modules/official/atlas.website/models/website-page.model.js
  import { defineModel } from '@atlas/module-engine'

  export default defineModel({
    key: 'website.page',
    name: 'website.page',
    label: 'Pagina',
    tableName: 'website_page',
    companyScoped: true,
    softDelete: true,
    fields: [
      { name: 'site_id',               type: 'text',     label: 'Sitio',     required: true },
      { name: 'title',                 type: 'text',     label: 'Titulo',    required: true },
      { name: 'slug',                  type: 'text',     label: 'Slug',      required: true },
      { name: 'route_path',            type: 'text',     label: 'Ruta',      required: true },
      { name: 'status',                type: 'select',   label: 'Estado',
        options: ['draft', 'published', 'archived'], default: 'draft' },
      { name: 'page_type',             type: 'select',   label: 'Tipo',
        options: ['page', 'landing', 'system'], default: 'page' },
      { name: 'draft_builder_data',    type: 'json',     label: 'Borrador Puck' },
      { name: 'published_builder_data',type: 'json',     label: 'Publicado Puck' },
      { name: 'seo',                   type: 'json',     label: 'SEO' },
      { name: 'visibility',            type: 'select',   label: 'Visibilidad',
        options: ['public', 'authenticated', 'private'], default: 'public' },
      { name: 'published_at',          type: 'datetime', label: 'Publicado en' },
      { name: 'created_by_id',         type: 'text' },
      { name: 'updated_by_id',         type: 'text' },
    ],
    indexes: [
      { fields: ['company_id', 'site_id', 'route_path'], unique: true },
      { fields: ['company_id', 'status'] },
    ],
  })
  ```

- [ ] **Step 3: website-page-version.model.js**

  ```js
  // modules/official/atlas.website/models/website-page-version.model.js
  import { defineModel } from '@atlas/module-engine'

  export default defineModel({
    key: 'website.page_version',
    name: 'website.page_version',
    label: 'Version de pagina',
    tableName: 'website_page_version',
    companyScoped: true,
    softDelete: false,
    fields: [
      { name: 'page_id',        type: 'text',   required: true },
      { name: 'version_number', type: 'number', required: true },
      { name: 'builder_data',   type: 'json' },
      { name: 'seo',            type: 'json' },
      { name: 'status',         type: 'select',
        options: ['snapshot', 'published'], default: 'snapshot' },
      { name: 'created_by_id',  type: 'text' },
    ],
  })
  ```

- [ ] **Step 4: website-theme.model.js**

  ```js
  // modules/official/atlas.website/models/website-theme.model.js
  import { defineModel } from '@atlas/module-engine'

  export default defineModel({
    key: 'website.theme',
    name: 'website.theme',
    label: 'Tema',
    tableName: 'website_theme',
    companyScoped: true,
    softDelete: true,
    fields: [
      { name: 'site_id',    type: 'text',     required: true },
      { name: 'name',       type: 'text',     label: 'Nombre', required: true },
      { name: 'tokens',     type: 'json',     label: 'Tokens de color' },
      { name: 'typography', type: 'json',     label: 'Tipografia' },
      { name: 'layout',     type: 'json',     label: 'Layout' },
      { name: 'custom_css', type: 'textarea', label: 'CSS personalizado' },
      { name: 'is_default', type: 'boolean',  label: 'Por defecto', default: false },
    ],
  })
  ```

- [ ] **Step 5: website-menu.model.js**

  ```js
  // modules/official/atlas.website/models/website-menu.model.js
  import { defineModel } from '@atlas/module-engine'

  export default defineModel({
    key: 'website.menu',
    name: 'website.menu',
    label: 'Menu',
    tableName: 'website_menu',
    companyScoped: true,
    softDelete: true,
    fields: [
      { name: 'site_id',  type: 'text',   required: true },
      { name: 'name',     type: 'text',   label: 'Nombre',   required: true },
      { name: 'location', type: 'select', label: 'Ubicacion',
        options: ['header', 'footer', 'mobile', 'custom'], default: 'header' },
    ],
  })
  ```

- [ ] **Step 6: website-menu-item.model.js**

  ```js
  // modules/official/atlas.website/models/website-menu-item.model.js
  import { defineModel } from '@atlas/module-engine'

  export default defineModel({
    key: 'website.menu_item',
    name: 'website.menu_item',
    label: 'Item de menu',
    tableName: 'website_menu_item',
    companyScoped: true,
    softDelete: true,
    fields: [
      { name: 'menu_id',    type: 'text',   required: true },
      { name: 'parent_id',  type: 'text' },
      { name: 'label',      type: 'text',   label: 'Etiqueta', required: true },
      { name: 'url',        type: 'text',   label: 'URL' },
      { name: 'page_id',    type: 'text',   label: 'Pagina vinculada' },
      { name: 'target',     type: 'select', label: 'Destino',
        options: ['_self', '_blank'], default: '_self' },
      { name: 'icon',       type: 'text',   label: 'Icono' },
      { name: 'sort_order', type: 'number', label: 'Orden', default: 0 },
    ],
  })
  ```

- [ ] **Step 7: website-published-render.model.js**

  ```js
  // modules/official/atlas.website/models/website-published-render.model.js
  import { defineModel } from '@atlas/module-engine'

  export default defineModel({
    key: 'website.published_render',
    name: 'website.published_render',
    label: 'Render publicado',
    tableName: 'website_published_render',
    companyScoped: true,
    softDelete: false,
    fields: [
      { name: 'site_id',      type: 'text',     required: true },
      { name: 'source_type',  type: 'select',   required: true,
        options: ['page', 'blog_post', 'product', 'collection'] },
      { name: 'source_id',    type: 'text',     required: true },
      { name: 'path',         type: 'text',     required: true },
      { name: 'html',         type: 'text' },
      { name: 'title',        type: 'text' },
      { name: 'description',  type: 'text' },
      { name: 'og_image',     type: 'text' },
      { name: 'status_code',  type: 'number',   default: 200 },
      { name: 'content_hash', type: 'text' },
      { name: 'published_at', type: 'datetime' },
    ],
    indexes: [
      { fields: ['site_id', 'path'], unique: true },
    ],
  })
  ```

- [ ] **Step 8: Create migrations placeholder**

  ```bash
  mkdir -p modules/official/atlas.website/migrations
  touch modules/official/atlas.website/migrations/.gitkeep
  ```

- [ ] **Step 9: Commit**

  ```bash
  git add modules/official/atlas.website/models/ \
          modules/official/atlas.website/migrations/
  git commit -m "feat(website): add 7 Atlas ORM models for atlas.website"
  ```

---

## Task 4 — Validators

**Files:**
- Create: `modules/official/atlas.website/validators/index.js`

- [ ] **Step 1: Create validators**

  ```js
  // modules/official/atlas.website/validators/index.js
  import { z } from 'zod'

  export const createPageSchema = z.object({
    siteId:    z.string().uuid(),
    title:     z.string().min(1).max(255),
    slug:      z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
    routePath: z.string().min(1).max(512).startsWith('/'),
    pageType:  z.enum(['page', 'landing', 'system']).default('page'),
    visibility:z.enum(['public', 'authenticated', 'private']).default('public'),
    seo:       z.record(z.unknown()).optional(),
  })

  export const updatePageSchema = z.object({
    title:      z.string().min(1).max(255).optional(),
    slug:       z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
    routePath:  z.string().min(1).max(512).startsWith('/').optional(),
    visibility: z.enum(['public', 'authenticated', 'private']).optional(),
    seo:        z.record(z.unknown()).optional(),
  })

  export const saveDraftSchema = z.object({
    builderData: z.record(z.unknown()),
    seo:         z.record(z.unknown()).optional(),
  })

  export const createSiteSchema = z.object({
    name:          z.string().min(1).max(255),
    domain:        z.string().optional(),
    defaultLocale: z.string().default('es'),
  })

  export const updateSiteSchema = z.object({
    name:           z.string().min(1).max(255).optional(),
    domain:         z.string().optional(),
    status:         z.enum(['draft', 'published', 'maintenance']).optional(),
    homepagePageId: z.string().uuid().optional().nullable(),
    themeId:        z.string().uuid().optional().nullable(),
    settings:       z.record(z.unknown()).optional(),
    seoDefaults:    z.record(z.unknown()).optional(),
  })
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add modules/official/atlas.website/validators/
  git commit -m "feat(website): add Zod validators for website module"
  ```

---

## Task 5 — Service layer

**Files:**
- Create: `modules/official/atlas.website/api/service-helpers.js`
- Create: `modules/official/atlas.website/api/website-service.js`

All functions must live inside the `createWebsiteService({ prisma })` factory. No top-level prisma access. Use `prisma.$queryRaw` for AME3 tables. DB generates IDs via `DEFAULT uuidv7()`.

- [ ] **Step 1: service-helpers.js**

  ```js
  // modules/official/atlas.website/api/service-helpers.js

  export class WebsiteServiceError extends Error {
    constructor(message, status = 500) {
      super(message)
      this.name = 'WebsiteServiceError'
      this.status = status
    }
  }

  export function notFound(entity) {
    return new WebsiteServiceError(`${entity} no encontrado.`, 404)
  }

  export function conflict(message) {
    return new WebsiteServiceError(message, 409)
  }
  ```

- [ ] **Step 2: website-service.js**

  ```js
  // modules/official/atlas.website/api/website-service.js
  import { WebsiteServiceError, notFound, conflict } from './service-helpers.js'

  export { WebsiteServiceError }

  export function createWebsiteService({ prisma }) {
    async function getOrCreateSite({ companyId }) {
      const rows = await prisma.$queryRaw`
        SELECT id, name, domain, status, homepage_page_id, theme_id, settings, seo_defaults
        FROM website_site
        WHERE company_id = ${companyId} AND enabled = true
        ORDER BY created_at ASC
        LIMIT 1
      `
      return rows[0] ?? null
    }

    async function createSite({ companyId, data, actorId }) {
      const rows = await prisma.$queryRaw`
        INSERT INTO website_site
          (company_id, name, domain, default_locale, status, enabled, created_at, updated_at)
        VALUES
          (${companyId}, ${data.name}, ${data.domain ?? null}, ${data.defaultLocale ?? 'es'},
           'draft', true, NOW(), NOW())
        RETURNING *
      `
      const created = rows[0]
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: 'atlas.website',
          entityType: 'website.site',
          entityId: created.id,
          action: 'site.create',
          before: null,
          after: JSON.stringify(created),
        },
      })
      return created
    }

    async function updateSite({ companyId, siteId, data, actorId }) {
      const before = await prisma.$queryRaw`
        SELECT * FROM website_site WHERE id = ${siteId} AND company_id = ${companyId}
      `.then(r => r[0] ?? null)
      if (!before) throw notFound('Sitio')

      const rows = await prisma.$queryRaw`
        UPDATE website_site SET
          name            = COALESCE(${data.name ?? null},           name),
          domain          = COALESCE(${data.domain ?? null},         domain),
          status          = COALESCE(${data.status ?? null},         status),
          homepage_page_id= COALESCE(${data.homepagePageId ?? null}, homepage_page_id),
          theme_id        = COALESCE(${data.themeId ?? null},        theme_id),
          settings        = COALESCE(${data.settings ? JSON.stringify(data.settings) : null}::jsonb, settings),
          seo_defaults    = COALESCE(${data.seoDefaults ? JSON.stringify(data.seoDefaults) : null}::jsonb, seo_defaults),
          updated_at      = NOW()
        WHERE id = ${siteId} AND company_id = ${companyId}
        RETURNING *
      `
      const after = rows[0]
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: 'atlas.website',
          entityType: 'website.site',
          entityId: siteId,
          action: 'site.update',
          before: JSON.stringify(before),
          after: JSON.stringify(after),
        },
      })
      return after
    }

    async function listPages({ companyId, siteId, page = 1, pageSize = 30 }) {
      const offset = (page - 1) * pageSize
      const rows = await prisma.$queryRaw`
        SELECT id, title, slug, route_path, status, page_type, visibility,
               published_at, created_at, updated_at
        FROM website_page
        WHERE company_id = ${companyId}
          AND site_id = ${siteId}
          AND enabled = true
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `
      const countRows = await prisma.$queryRaw`
        SELECT COUNT(*) AS total FROM website_page
        WHERE company_id = ${companyId} AND site_id = ${siteId} AND enabled = true
      `
      return { data: rows, total: Number(countRows[0]?.total ?? 0), page, pageSize }
    }

    async function getPage({ companyId, pageId }) {
      const rows = await prisma.$queryRaw`
        SELECT * FROM website_page
        WHERE id = ${pageId} AND company_id = ${companyId} AND enabled = true
        LIMIT 1
      `
      if (!rows[0]) throw notFound('Pagina')
      return rows[0]
    }

    async function createPage({ companyId, siteId, data, actorId }) {
      const existing = await prisma.$queryRaw`
        SELECT id FROM website_page
        WHERE company_id = ${companyId}
          AND site_id = ${siteId}
          AND route_path = ${data.routePath}
          AND enabled = true
        LIMIT 1
      `
      if (existing[0]) throw conflict(`La ruta "${data.routePath}" ya esta en uso.`)

      const rows = await prisma.$queryRaw`
        INSERT INTO website_page
          (company_id, site_id, title, slug, route_path, status, page_type,
           visibility, draft_builder_data, seo, created_by_id, updated_by_id,
           enabled, created_at, updated_at)
        VALUES
          (${companyId}, ${siteId}, ${data.title}, ${data.slug}, ${data.routePath},
           'draft', ${data.pageType ?? 'page'}, ${data.visibility ?? 'public'},
           '{}'::jsonb, ${data.seo ? JSON.stringify(data.seo) : '{}'}::jsonb,
           ${actorId ?? null}, ${actorId ?? null},
           true, NOW(), NOW())
        RETURNING *
      `
      const created = rows[0]
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: 'atlas.website',
          entityType: 'website.page',
          entityId: created.id,
          action: 'page.create',
          before: null,
          after: JSON.stringify(created),
        },
      })
      return created
    }

    async function updatePage({ companyId, pageId, data, actorId }) {
      const before = await getPage({ companyId, pageId })
      const rows = await prisma.$queryRaw`
        UPDATE website_page SET
          title       = COALESCE(${data.title ?? null},      title),
          slug        = COALESCE(${data.slug ?? null},       slug),
          route_path  = COALESCE(${data.routePath ?? null},  route_path),
          visibility  = COALESCE(${data.visibility ?? null}, visibility),
          seo         = COALESCE(${data.seo ? JSON.stringify(data.seo) : null}::jsonb, seo),
          updated_by_id = ${actorId ?? null},
          updated_at  = NOW()
        WHERE id = ${pageId} AND company_id = ${companyId}
        RETURNING *
      `
      const after = rows[0]
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: 'atlas.website',
          entityType: 'website.page',
          entityId: pageId,
          action: 'page.update',
          before: JSON.stringify(before),
          after: JSON.stringify(after),
        },
      })
      return after
    }

    async function saveDraft({ companyId, pageId, builderData, seo, actorId }) {
      const before = await getPage({ companyId, pageId })
      const rows = await prisma.$queryRaw`
        UPDATE website_page SET
          draft_builder_data = ${JSON.stringify(builderData)}::jsonb,
          seo                = COALESCE(${seo ? JSON.stringify(seo) : null}::jsonb, seo),
          updated_by_id      = ${actorId ?? null},
          updated_at         = NOW()
        WHERE id = ${pageId} AND company_id = ${companyId}
        RETURNING *
      `
      const after = rows[0]
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: 'atlas.website',
          entityType: 'website.page',
          entityId: pageId,
          action: 'page.save_draft',
          before: JSON.stringify({ draft_builder_data: before.draft_builder_data }),
          after:  JSON.stringify({ draft_builder_data: after.draft_builder_data }),
        },
      })
      return after
    }

    async function publishPage({ companyId, pageId, actorId }) {
      const before = await getPage({ companyId, pageId })

      const versionRows = await prisma.$queryRaw`
        SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
        FROM website_page_version
        WHERE page_id = ${pageId} AND company_id = ${companyId}
      `
      const nextVersion = Number(versionRows[0]?.next_version ?? 1)

      await prisma.$queryRaw`
        INSERT INTO website_page_version
          (company_id, page_id, version_number, builder_data, seo, status, created_by_id, created_at)
        VALUES
          (${companyId}, ${pageId}, ${nextVersion},
           ${JSON.stringify(before.draft_builder_data ?? {})}::jsonb,
           ${JSON.stringify(before.seo ?? {})}::jsonb,
           'published', ${actorId ?? null}, NOW())
      `

      const rows = await prisma.$queryRaw`
        UPDATE website_page SET
          published_builder_data = draft_builder_data,
          status                 = 'published',
          published_at           = NOW(),
          updated_by_id          = ${actorId ?? null},
          updated_at             = NOW()
        WHERE id = ${pageId} AND company_id = ${companyId}
        RETURNING *
      `
      const after = rows[0]

      await prisma.$queryRaw`
        INSERT INTO website_published_render
          (company_id, site_id, source_type, source_id, path, status_code,
           published_at, updated_at)
        VALUES
          (${companyId}, ${after.site_id}, 'page', ${pageId},
           ${after.route_path}, 200, NOW(), NOW())
        ON CONFLICT (site_id, path) DO UPDATE SET
          source_id    = EXCLUDED.source_id,
          source_type  = EXCLUDED.source_type,
          status_code  = 200,
          published_at = NOW(),
          updated_at   = NOW()
      `

      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: 'atlas.website',
          entityType: 'website.page',
          entityId: pageId,
          action: 'page.publish',
          before: JSON.stringify({ status: before.status }),
          after:  JSON.stringify({ status: 'published', published_at: after.published_at }),
        },
      })
      return after
    }

    async function softDeletePage({ companyId, pageId, actorId }) {
      const before = await getPage({ companyId, pageId })
      await prisma.$queryRaw`
        UPDATE website_page SET enabled = false, updated_at = NOW()
        WHERE id = ${pageId} AND company_id = ${companyId}
      `
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: 'atlas.website',
          entityType: 'website.page',
          entityId: pageId,
          action: 'page.delete',
          before: JSON.stringify(before),
          after: null,
        },
      })
    }

    async function listThemes({ companyId, siteId }) {
      return prisma.$queryRaw`
        SELECT id, name, is_default, tokens, typography, layout, custom_css
        FROM website_theme
        WHERE company_id = ${companyId} AND site_id = ${siteId} AND enabled = true
        ORDER BY is_default DESC, name ASC
      `
    }

    async function listMenus({ companyId, siteId }) {
      return prisma.$queryRaw`
        SELECT m.id, m.name, m.location,
          COALESCE(
            json_agg(
              json_build_object(
                'id', mi.id, 'label', mi.label, 'url', mi.url,
                'page_id', mi.page_id, 'target', mi.target,
                'sort_order', mi.sort_order, 'parent_id', mi.parent_id
              ) ORDER BY mi.sort_order
            ) FILTER (WHERE mi.id IS NOT NULL),
            '[]'::json
          ) AS items
        FROM website_menu m
        LEFT JOIN website_menu_item mi ON mi.menu_id = m.id AND mi.enabled = true
        WHERE m.company_id = ${companyId} AND m.site_id = ${siteId} AND m.enabled = true
        GROUP BY m.id, m.name, m.location
      `
    }

    return {
      getOrCreateSite,
      createSite,
      updateSite,
      listPages,
      getPage,
      createPage,
      updatePage,
      saveDraft,
      publishPage,
      softDeletePage,
      listThemes,
      listMenus,
    }
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add modules/official/atlas.website/api/service-helpers.js \
          modules/official/atlas.website/api/website-service.js
  git commit -m "feat(website): add website service (site, pages, draft, publish, menus, themes)"
  ```

---

## Task 6 — Route files + API index

**Files:**
- Create: `modules/official/atlas.website/api/pages-routes.js`
- Create: `modules/official/atlas.website/api/themes-routes.js`
- Create: `modules/official/atlas.website/api/menus-routes.js`
- Create: `modules/official/atlas.website/api/index.js`

Routes are thin: validate → call service → return JSON. Auth + company ID come from the Hono context set by `authMiddleware` (`c.get('user')`, `c.get('companyId')`).

- [ ] **Step 1: pages-routes.js**

  ```js
  // modules/official/atlas.website/api/pages-routes.js
  import { Hono } from 'hono'
  import { zValidator } from '@hono/zod-validator'
  import { createPageSchema, updatePageSchema, saveDraftSchema } from '../validators/index.js'
  import { WebsiteServiceError } from './service-helpers.js'

  export function createPagesRouter({ websiteSvc, requirePermission }) {
    const app = new Hono()

    app.get('/pages', requirePermission('website.pages.read'), async (c) => {
      const companyId = c.get('companyId')
      const { siteId, page, pageSize } = c.req.query()
      const site = siteId
        ? { id: siteId }
        : await websiteSvc.getOrCreateSite({ companyId })
      if (!site) return c.json({ data: [], total: 0 })
      const result = await websiteSvc.listPages({
        companyId,
        siteId: site.id,
        page:     parseInt(page     ?? '1',  10),
        pageSize: parseInt(pageSize ?? '30', 10),
      })
      return c.json(result)
    })

    app.post(
      '/pages',
      requirePermission('website.pages.create'),
      zValidator('json', createPageSchema),
      async (c) => {
        const companyId = c.get('companyId')
        const actorId   = c.get('userId') ?? c.get('user')?.id ?? null
        const data      = c.req.valid('json')
        try {
          const page = await websiteSvc.createPage({
            companyId,
            siteId: data.siteId,
            data,
            actorId,
          })
          return c.json(page, 201)
        } catch (err) {
          if (err instanceof WebsiteServiceError) {
            return c.json({ error: err.message }, err.status)
          }
          throw err
        }
      },
    )

    app.get('/pages/:id', requirePermission('website.pages.read'), async (c) => {
      const companyId = c.get('companyId')
      try {
        const page = await websiteSvc.getPage({ companyId, pageId: c.req.param('id') })
        return c.json(page)
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    })

    app.patch(
      '/pages/:id',
      requirePermission('website.pages.update'),
      zValidator('json', updatePageSchema),
      async (c) => {
        const companyId = c.get('companyId')
        const actorId   = c.get('userId') ?? c.get('user')?.id ?? null
        try {
          const updated = await websiteSvc.updatePage({
            companyId,
            pageId: c.req.param('id'),
            data:   c.req.valid('json'),
            actorId,
          })
          return c.json(updated)
        } catch (err) {
          if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
          throw err
        }
      },
    )

    app.post(
      '/pages/:id/save-draft',
      requirePermission('website.pages.update'),
      zValidator('json', saveDraftSchema),
      async (c) => {
        const companyId = c.get('companyId')
        const actorId   = c.get('userId') ?? c.get('user')?.id ?? null
        const { builderData, seo } = c.req.valid('json')
        try {
          const updated = await websiteSvc.saveDraft({
            companyId,
            pageId: c.req.param('id'),
            builderData,
            seo,
            actorId,
          })
          return c.json(updated)
        } catch (err) {
          if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
          throw err
        }
      },
    )

    app.post('/pages/:id/publish', requirePermission('website.pages.publish'), async (c) => {
      const companyId = c.get('companyId')
      const actorId   = c.get('userId') ?? c.get('user')?.id ?? null
      try {
        const published = await websiteSvc.publishPage({
          companyId,
          pageId: c.req.param('id'),
          actorId,
        })
        return c.json(published)
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    })

    app.delete('/pages/:id', requirePermission('website.pages.delete'), async (c) => {
      const companyId = c.get('companyId')
      const actorId   = c.get('userId') ?? c.get('user')?.id ?? null
      try {
        await websiteSvc.softDeletePage({ companyId, pageId: c.req.param('id'), actorId })
        return c.json({ success: true })
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    })

    return app
  }
  ```

- [ ] **Step 2: themes-routes.js**

  ```js
  // modules/official/atlas.website/api/themes-routes.js
  import { Hono } from 'hono'

  export function createThemesRouter({ websiteSvc, requirePermission }) {
    const app = new Hono()

    app.get('/themes', requirePermission('website.theme.read'), async (c) => {
      const companyId = c.get('companyId')
      const siteId    = c.req.query('siteId')
      if (!siteId) return c.json({ data: [] })
      const themes = await websiteSvc.listThemes({ companyId, siteId })
      return c.json({ data: themes })
    })

    return app
  }
  ```

- [ ] **Step 3: menus-routes.js**

  ```js
  // modules/official/atlas.website/api/menus-routes.js
  import { Hono } from 'hono'

  export function createMenusRouter({ websiteSvc, requirePermission }) {
    const app = new Hono()

    app.get('/menus', requirePermission('website.menus.read'), async (c) => {
      const companyId = c.get('companyId')
      const siteId    = c.req.query('siteId')
      if (!siteId) return c.json({ data: [] })
      const menus = await websiteSvc.listMenus({ companyId, siteId })
      return c.json({ data: menus })
    })

    return app
  }
  ```

- [ ] **Step 4: api/index.js**

  The factory signature must match what `route-loader-service.js` expects: a default export function that receives `{ prisma, requirePermission, moduleContext }` and returns a Hono app.

  ```js
  // modules/official/atlas.website/api/index.js
  import { Hono } from 'hono'
  import { createWebsiteService } from './website-service.js'
  import { createPagesRouter } from './pages-routes.js'
  import { createThemesRouter } from './themes-routes.js'
  import { createMenusRouter } from './menus-routes.js'

  export default function createWebsiteRouter({ prisma, requirePermission }) {
    const app = new Hono()
    const websiteSvc = createWebsiteService({ prisma })

    app.route('/website', createPagesRouter({ websiteSvc, requirePermission }))
    app.route('/website', createThemesRouter({ websiteSvc, requirePermission }))
    app.route('/website', createMenusRouter({ websiteSvc, requirePermission }))

    app.get('/website/site', requirePermission('website.site.read'), async (c) => {
      const companyId = c.get('companyId')
      const site = await websiteSvc.getOrCreateSite({ companyId })
      return c.json({ data: site })
    })

    return app
  }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add modules/official/atlas.website/api/
  git commit -m "feat(website): add private API routes (pages CRUD, draft, publish, site, themes, menus)"
  ```

---

## Task 7 — Blueprint views

**Files:**
- Create: `modules/official/atlas.website/views/pages.table.js`
- Create: `modules/official/atlas.website/views/pages.form.js`
- Create: `modules/official/atlas.website/views/pages.detail.js`
- Create: `modules/official/atlas.website/views/pages.page.js`

These blueprints allow `BlueprintCrudScreen` to render the pages admin as a fallback if no custom screen is registered (useful during development).

- [ ] **Step 1: pages.table.js**

  ```js
  // modules/official/atlas.website/views/pages.table.js
  import { defineView } from '@atlas/module-engine'

  export default defineView({
    key: 'website.pages.table',
    kind: 'TABLE',
    version: '0.1.0',
    schema: {
      entity: 'website.page',
      component: 'AtlasTable',
      apiPath: '/website/pages',
      primaryField: 'title',
      searchable: true,
      columns: [
        { field: 'title',      label: 'Titulo',  sortable: true, link: true },
        { field: 'route_path', label: 'Ruta',    sortable: false },
        { field: 'status',     label: 'Estado',  sortable: true },
        { field: 'page_type',  label: 'Tipo',    sortable: false },
        { field: 'published_at', label: 'Publicado', type: 'datetime' },
      ],
      actions: [
        { label: 'Crear pagina', permission: 'website.pages.create', variant: 'primary' },
      ],
      rowActions: [
        { label: 'Editar',    permission: 'website.pages.update' },
        { label: 'Eliminar',  permission: 'website.pages.delete' },
      ],
      emptyState: { message: 'No hay paginas creadas.' },
    },
  })
  ```

- [ ] **Step 2: pages.form.js**

  ```js
  // modules/official/atlas.website/views/pages.form.js
  import { defineView } from '@atlas/module-engine'

  export default defineView({
    key: 'website.pages.form',
    kind: 'FORM',
    version: '0.1.0',
    schema: {
      entity: 'website.page',
      apiPath: '/website/pages',
      fields: [
        { name: 'title',      label: 'Titulo',      type: 'text',     required: true },
        { name: 'slug',       label: 'Slug',        type: 'text',     required: true },
        { name: 'route_path', label: 'Ruta',        type: 'text',     required: true },
        { name: 'page_type',  label: 'Tipo',        type: 'select',
          options: ['page', 'landing', 'system'] },
        { name: 'visibility', label: 'Visibilidad', type: 'select',
          options: ['public', 'authenticated', 'private'] },
      ],
    },
  })
  ```

- [ ] **Step 3: pages.detail.js**

  ```js
  // modules/official/atlas.website/views/pages.detail.js
  import { defineView } from '@atlas/module-engine'

  export default defineView({
    key: 'website.pages.detail',
    kind: 'DETAIL',
    version: '0.1.0',
    schema: {
      entity: 'website.page',
      apiPath: '/website/pages',
      fields: [
        { name: 'title',       label: 'Titulo' },
        { name: 'route_path',  label: 'Ruta' },
        { name: 'status',      label: 'Estado' },
        { name: 'page_type',   label: 'Tipo' },
        { name: 'visibility',  label: 'Visibilidad' },
        { name: 'published_at',label: 'Publicado en', type: 'datetime' },
      ],
    },
  })
  ```

- [ ] **Step 4: pages.page.js**

  ```js
  // modules/official/atlas.website/views/pages.page.js
  import { definePage } from '@atlas/module-engine'

  export default definePage({
    key: 'website.pages',
    path: '/app/m/atlas.website/pages',
    title: 'Paginas',
    views: ['website.pages.table', 'website.pages.form', 'website.pages.detail'],
  })
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add modules/official/atlas.website/views/
  git commit -m "feat(website): add AME3 blueprint views for website pages"
  ```

---

## Task 8 — Register module in feature-modules.js + seed

**Files:**
- Modify: `apps/api/src/manifests/official/feature-modules.js`

The module manifest must be imported and added to the `featureModules` array. Because the manifest lives in `modules/official/`, it must be imported via a relative path or the path alias. Use a relative path from `apps/api/src/manifests/official/`.

- [ ] **Step 1: Add import and export to feature-modules.js**

  In `apps/api/src/manifests/official/feature-modules.js`, **at the top** add:
  ```js
  import websiteManifest from '../../../../../modules/official/atlas.website/module.manifest.js'
  ```

  Replace the last line:
  ```js
  export const featureModules = [];
  ```
  With:
  ```js
  export const featureModules = [websiteManifest];
  ```

- [ ] **Step 2: Verify seed loads the module**

  ```bash
  node --check apps/api/src/manifests/official/feature-modules.js
  node -e "
    import('./apps/api/src/manifests/official/feature-modules.js')
      .then(m => console.log(m.featureModules.map(f => f.key)))
  "
  ```
  Expected: `[ 'atlas.website' ]`

- [ ] **Step 3: Run seed**

  ```bash
  pnpm db:seed
  ```
  Expected: atlas.website appears in the AtlasModule table as `status: UNINSTALLED`.
  
  Verify in Prisma Studio (`pnpm db:studio`) or with:
  ```bash
  node -e "
    import('./prisma/seed.js')
  "
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/manifests/official/feature-modules.js
  git commit -m "feat(website): register atlas.website in feature-modules seed"
  ```

---

## Task 9 — Admin screen components

**Files:**
- Create: `modules/official/atlas.website/components/WebsiteOverviewScreen.jsx`
- Create: `modules/official/atlas.website/components/WebsitePagesScreen.jsx`
- Create: `modules/official/atlas.website/components/WebsiteThemeScreen.jsx`
- Create: `modules/official/atlas.website/components/WebsiteMenusScreen.jsx`
- Create: `modules/official/atlas.website/components/WebsiteBlogScreen.jsx`
- Create: `modules/official/atlas.website/components/WebsiteFormsScreen.jsx`

These are imported by Vite (see Task 11). Keep each under 300 lines. Placeholder screens for Blog and Forms show a "coming soon" state — that is correct and intentional for this phase.

- [ ] **Step 1: WebsiteOverviewScreen.jsx**

  ```jsx
  // modules/official/atlas.website/components/WebsiteOverviewScreen.jsx
  import { useQuery } from '@tanstack/react-query'
  import { useNavigate } from 'react-router-dom'
  import { atlas } from '../../../apps/desktop/src/lib/atlas.js'
  import { useAuth } from '../../../apps/desktop/src/auth/AuthProvider.jsx'

  export default function WebsiteOverviewScreen() {
    const { session } = useAuth()
    const navigate = useNavigate()
    const token = session?.access_token

    const siteQuery = useQuery({
      queryKey: ['website-site', token],
      queryFn: async () => {
        const res = await fetch(
          `${atlas.baseUrl ?? ''}/website/site`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      },
      enabled: Boolean(token),
      staleTime: 60_000,
    })

    const site = siteQuery.data?.data ?? null

    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Sitio web</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Administra tu sitio publico desde este panel.
          </p>
        </div>

        {site ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-1">
              <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Estado</p>
              <p className="text-lg font-medium capitalize">{site.status}</p>
            </div>
            <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-1">
              <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Dominio</p>
              <p className="text-lg font-medium">{site.domain || '—'}</p>
            </div>
            <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-1">
              <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Nombre</p>
              <p className="text-lg font-medium">{site.name}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center space-y-3">
            <p className="text-[hsl(var(--muted-foreground))]">No hay un sitio web configurado aun.</p>
            <button
              onClick={() => navigate('/app/m/atlas.website/pages')}
              className="text-sm underline text-[hsl(var(--primary))]"
            >
              Ir a Paginas para empezar
            </button>
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: WebsitePagesScreen.jsx**

  ```jsx
  // modules/official/atlas.website/components/WebsitePagesScreen.jsx
  import { useState } from 'react'
  import { useQuery } from '@tanstack/react-query'
  import { useNavigate } from 'react-router-dom'
  import { useAuth } from '../../../apps/desktop/src/auth/AuthProvider.jsx'
  import { getApiUrl } from '../../../apps/desktop/src/lib/runtimeConfig.js'

  async function apiGet(path, token) {
    const res = await fetch(`${getApiUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  const STATUS_LABELS = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' }
  const STATUS_COLORS = {
    draft:     'bg-yellow-50 text-yellow-700 border-yellow-200',
    published: 'bg-green-50  text-green-700  border-green-200',
    archived:  'bg-gray-50   text-gray-500   border-gray-200',
  }

  export default function WebsitePagesScreen() {
    const { session } = useAuth()
    const token = session?.access_token
    const navigate = useNavigate()
    const [creatingPage, setCreatingPage] = useState(false)

    const siteQuery = useQuery({
      queryKey: ['website-site', token],
      queryFn: () => apiGet('/website/site', token),
      enabled: Boolean(token),
      staleTime: 60_000,
    })
    const siteId = siteQuery.data?.data?.id ?? null

    const pagesQuery = useQuery({
      queryKey: ['website-pages', siteId, token],
      queryFn: () => apiGet(`/website/pages?siteId=${siteId}`, token),
      enabled: Boolean(token) && Boolean(siteId),
      staleTime: 30_000,
    })

    const pages = pagesQuery.data?.data ?? []

    if (siteQuery.isPending) {
      return <div className="p-8 text-[hsl(var(--muted-foreground))] text-sm">Cargando...</div>
    }

    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Paginas</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Gestiona las paginas del sitio publico.
            </p>
          </div>
          <button
            onClick={() => setCreatingPage(true)}
            className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Nueva pagina
          </button>
        </div>

        {pages.length === 0 ? (
          <div className="rounded-xl border border-[hsl(var(--border))] p-10 text-center">
            <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay paginas creadas aun.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Titulo</th>
                  <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Ruta</th>
                  <th className="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {pages.map((page) => (
                  <tr key={page.id} className="hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[hsl(var(--foreground))]">{page.title}</td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-mono text-xs">{page.route_path}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[page.status] ?? ''}`}>
                        {STATUS_LABELS[page.status] ?? page.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/app/m/atlas.website/pages/${page.id}/editor`)}
                        className="text-xs text-[hsl(var(--primary))] hover:underline"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 3: WebsiteThemeScreen.jsx, WebsiteMenusScreen.jsx, WebsiteBlogScreen.jsx, WebsiteFormsScreen.jsx — placeholder screens**

  Each is a simple placeholder. Create all four:

  ```jsx
  // modules/official/atlas.website/components/WebsiteThemeScreen.jsx
  export default function WebsiteThemeScreen() {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Tema</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Configuracion de colores, tipografia y estilos del sitio. Disponible proximamente.
        </p>
      </div>
    )
  }
  ```

  ```jsx
  // modules/official/atlas.website/components/WebsiteMenusScreen.jsx
  export default function WebsiteMenusScreen() {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Menus</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Configuracion de menus de navegacion. Disponible proximamente.
        </p>
      </div>
    )
  }
  ```

  ```jsx
  // modules/official/atlas.website/components/WebsiteBlogScreen.jsx
  export default function WebsiteBlogScreen() {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Blog</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Administracion del blog publico. Disponible proximamente.
        </p>
      </div>
    )
  }
  ```

  ```jsx
  // modules/official/atlas.website/components/WebsiteFormsScreen.jsx
  export default function WebsiteFormsScreen() {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Formularios</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Gestion de formularios de contacto y captacion. Disponible proximamente.
        </p>
      </div>
    )
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add modules/official/atlas.website/components/
  git commit -m "feat(website): add ERP admin screens for website module (overview, pages, placeholders)"
  ```

---

## Task 10 — Puck block registry + 11 official blocks

**Files:**
- Create: `apps/desktop/src/website/blocks/` (11 files)
- Create: `apps/desktop/src/website/atlasWebsiteConfig.js`

The Puck config object is shared between the editor (Task 11) and the renderer (Task 12). Each block is a simple React component with a Puck `fields` descriptor.

- [ ] **Step 1: Section.jsx**

  ```jsx
  // apps/desktop/src/website/blocks/Section.jsx
  export function Section({ children, backgroundColor, paddingY }) {
    return (
      <section
        style={{ backgroundColor: backgroundColor || 'transparent' }}
        className={`w-full ${paddingY || 'py-16'}`}
      >
        <div className="max-w-6xl mx-auto px-6">{children}</div>
      </section>
    )
  }

  Section.fields = {
    backgroundColor: { type: 'text', label: 'Color de fondo (hex/css)' },
    paddingY:        { type: 'text', label: 'Padding vertical (clase Tailwind)' },
  }
  ```

- [ ] **Step 2: Hero.jsx**

  ```jsx
  // apps/desktop/src/website/blocks/Hero.jsx
  export function Hero({ headline, subheadline, ctaLabel, ctaHref, backgroundImage }) {
    return (
      <section
        className="w-full min-h-[480px] flex items-center justify-center bg-gray-900 text-white"
        style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
          {headline    && <h1 className="text-4xl md:text-5xl font-bold">{headline}</h1>}
          {subheadline && <p className="text-lg md:text-xl text-gray-200">{subheadline}</p>}
          {ctaLabel    && (
            <a
              href={ctaHref || '#'}
              className="inline-block px-7 py-3 rounded-lg bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              {ctaLabel}
            </a>
          )}
        </div>
      </section>
    )
  }

  Hero.fields = {
    headline:        { type: 'text',  label: 'Titulo principal' },
    subheadline:     { type: 'text',  label: 'Subtitulo' },
    ctaLabel:        { type: 'text',  label: 'Texto del boton' },
    ctaHref:         { type: 'text',  label: 'Enlace del boton' },
    backgroundImage: { type: 'text',  label: 'URL de imagen de fondo' },
  }
  ```

- [ ] **Step 3: Heading.jsx**

  ```jsx
  // apps/desktop/src/website/blocks/Heading.jsx
  const TAG_MAP = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4' }
  const SIZE_MAP = {
    h1: 'text-4xl font-bold',
    h2: 'text-3xl font-semibold',
    h3: 'text-2xl font-semibold',
    h4: 'text-xl font-medium',
  }

  export function Heading({ text, level, align }) {
    const Tag = TAG_MAP[level] || 'h2'
    return (
      <Tag
        className={`${SIZE_MAP[level] || SIZE_MAP.h2} text-gray-900 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''}`}
      >
        {text || 'Titulo'}
      </Tag>
    )
  }

  Heading.fields = {
    text:  { type: 'text',   label: 'Texto' },
    level: { type: 'select', label: 'Nivel', options: [
      { label: 'H1', value: 'h1' }, { label: 'H2', value: 'h2' },
      { label: 'H3', value: 'h3' }, { label: 'H4', value: 'h4' },
    ]},
    align: { type: 'select', label: 'Alineacion', options: [
      { label: 'Izquierda', value: 'left' },
      { label: 'Centro',    value: 'center' },
      { label: 'Derecha',   value: 'right' },
    ]},
  }
  ```

- [ ] **Step 4: TextBlock.jsx**

  ```jsx
  // apps/desktop/src/website/blocks/TextBlock.jsx
  export function TextBlock({ content, size }) {
    const sizeClass = size === 'large' ? 'text-lg' : size === 'small' ? 'text-sm' : 'text-base'
    return (
      <p className={`${sizeClass} text-gray-700 leading-relaxed`}>{content || 'Texto aqui...'}</p>
    )
  }

  TextBlock.fields = {
    content: { type: 'textarea', label: 'Contenido' },
    size: { type: 'select', label: 'Tamano', options: [
      { label: 'Normal', value: 'base' },
      { label: 'Grande', value: 'large' },
      { label: 'Pequeno', value: 'small' },
    ]},
  }
  ```

- [ ] **Step 5: ImageBlock.jsx**

  ```jsx
  // apps/desktop/src/website/blocks/ImageBlock.jsx
  export function ImageBlock({ src, alt, width, rounded }) {
    if (!src) {
      return (
        <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
          <span className="text-gray-400 text-sm">Imagen</span>
        </div>
      )
    }
    return (
      <img
        src={src}
        alt={alt || ''}
        className={`${rounded ? 'rounded-xl' : ''} max-w-full`}
        style={width ? { width } : {}}
      />
    )
  }

  ImageBlock.fields = {
    src:     { type: 'text',     label: 'URL de imagen' },
    alt:     { type: 'text',     label: 'Texto alternativo' },
    width:   { type: 'text',     label: 'Ancho (CSS, ej: 100%)' },
    rounded: { type: 'radio',    label: 'Esquinas redondeadas', options: [
      { label: 'Si', value: true }, { label: 'No', value: false },
    ]},
  }
  ```

- [ ] **Step 6: CTA.jsx**

  ```jsx
  // apps/desktop/src/website/blocks/CTA.jsx
  export function CTA({ title, description, buttonLabel, buttonHref, variant }) {
    const bg = variant === 'dark' ? 'bg-gray-900 text-white' : 'bg-indigo-600 text-white'
    const btnClass = variant === 'dark'
      ? 'bg-white text-gray-900 hover:bg-gray-100'
      : 'bg-white text-indigo-600 hover:bg-indigo-50'

    return (
      <section className={`w-full rounded-2xl px-8 py-12 text-center space-y-4 ${bg}`}>
        {title       && <h2 className="text-2xl font-bold">{title}</h2>}
        {description && <p className="text-base opacity-80">{description}</p>}
        {buttonLabel && (
          <a
            href={buttonHref || '#'}
            className={`inline-block mt-2 px-6 py-3 rounded-lg font-semibold text-sm transition-colors ${btnClass}`}
          >
            {buttonLabel}
          </a>
        )}
      </section>
    )
  }

  CTA.fields = {
    title:       { type: 'text',   label: 'Titulo' },
    description: { type: 'textarea', label: 'Descripcion' },
    buttonLabel: { type: 'text',   label: 'Texto del boton' },
    buttonHref:  { type: 'text',   label: 'Enlace' },
    variant:     { type: 'select', label: 'Estilo', options: [
      { label: 'Indigo', value: 'indigo' }, { label: 'Oscuro', value: 'dark' },
    ]},
  }
  ```

- [ ] **Step 7: FeatureGrid.jsx**

  ```jsx
  // apps/desktop/src/website/blocks/FeatureGrid.jsx
  const DEFAULT_FEATURES = [
    { icon: '★', title: 'Caracteristica 1', description: 'Descripcion de la caracteristica.' },
    { icon: '●', title: 'Caracteristica 2', description: 'Descripcion de la caracteristica.' },
    { icon: '◆', title: 'Caracteristica 3', description: 'Descripcion de la caracteristica.' },
  ]

  export function FeatureGrid({ title, features, columns }) {
    const items = (features && features.length > 0) ? features : DEFAULT_FEATURES
    const cols = columns === '2' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'

    return (
      <div className="space-y-8">
        {title && <h2 className="text-3xl font-semibold text-center text-gray-900">{title}</h2>}
        <div className={`grid gap-6 ${cols}`}>
          {items.map((f, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-6 space-y-2">
              {f.icon  && <span className="text-2xl">{f.icon}</span>}
              {f.title && <h3 className="font-semibold text-gray-900">{f.title}</h3>}
              {f.description && <p className="text-sm text-gray-600">{f.description}</p>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  FeatureGrid.fields = {
    title:    { type: 'text',   label: 'Titulo de la seccion' },
    columns:  { type: 'select', label: 'Columnas', options: [
      { label: '2', value: '2' }, { label: '3', value: '3' },
    ]},
    features: {
      type:       'array',
      label:      'Caracteristicas',
      arrayFields: {
        icon:        { type: 'text', label: 'Icono (emoji o texto)' },
        title:       { type: 'text', label: 'Titulo' },
        description: { type: 'textarea', label: 'Descripcion' },
      },
    },
  }
  ```

- [ ] **Step 8: FAQ.jsx**

  ```jsx
  // apps/desktop/src/website/blocks/FAQ.jsx
  import { useState } from 'react'

  const DEFAULT_ITEMS = [
    { question: '¿Como funciona?', answer: 'Aqui va la respuesta.' },
  ]

  export function FAQ({ title, items }) {
    const faqs = (items && items.length > 0) ? items : DEFAULT_ITEMS
    const [open, setOpen] = useState(null)

    return (
      <div className="space-y-6">
        {title && <h2 className="text-3xl font-semibold text-center text-gray-900">{title}</h2>}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                className="w-full text-left px-5 py-4 font-medium text-gray-900 flex justify-between items-center"
                onClick={() => setOpen(open === i ? null : i)}
              >
                {faq.question}
                <span className="text-gray-400">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-sm text-gray-600">{faq.answer}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  FAQ.fields = {
    title: { type: 'text', label: 'Titulo de la seccion' },
    items: {
      type:       'array',
      label:      'Preguntas',
      arrayFields: {
        question: { type: 'text',     label: 'Pregunta' },
        answer:   { type: 'textarea', label: 'Respuesta' },
      },
    },
  }
  ```

- [ ] **Step 9: ContactFormBlock.jsx, BlogPostsBlock.jsx, ProductGridBlock.jsx — placeholder blocks**

  ```jsx
  // apps/desktop/src/website/blocks/ContactFormBlock.jsx
  export function ContactFormBlock({ title }) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center space-y-2">
        {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
        <p className="text-sm text-gray-400">Formulario de contacto — disponible con atlas.forms</p>
      </div>
    )
  }
  ContactFormBlock.fields = {
    title: { type: 'text', label: 'Titulo del formulario' },
  }
  ```

  ```jsx
  // apps/desktop/src/website/blocks/BlogPostsBlock.jsx
  export function BlogPostsBlock({ title, count }) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center space-y-2">
        {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
        <p className="text-sm text-gray-400">Ultimas {count || 3} entradas — disponible con atlas.blog</p>
      </div>
    )
  }
  BlogPostsBlock.fields = {
    title: { type: 'text',   label: 'Titulo' },
    count: { type: 'number', label: 'Cantidad de posts' },
  }
  ```

  ```jsx
  // apps/desktop/src/website/blocks/ProductGridBlock.jsx
  export function ProductGridBlock({ title, count }) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center space-y-2">
        {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
        <p className="text-sm text-gray-400">Grilla de {count || 4} productos — disponible con atlas.shop</p>
      </div>
    )
  }
  ProductGridBlock.fields = {
    title: { type: 'text',   label: 'Titulo' },
    count: { type: 'number', label: 'Cantidad de productos' },
  }
  ```

- [ ] **Step 10: atlasWebsiteConfig.js — Puck config object**

  ```js
  // apps/desktop/src/website/atlasWebsiteConfig.js
  import { Section }           from './blocks/Section.jsx'
  import { Hero }              from './blocks/Hero.jsx'
  import { Heading }           from './blocks/Heading.jsx'
  import { TextBlock }         from './blocks/TextBlock.jsx'
  import { ImageBlock }        from './blocks/ImageBlock.jsx'
  import { CTA }               from './blocks/CTA.jsx'
  import { FeatureGrid }       from './blocks/FeatureGrid.jsx'
  import { FAQ }               from './blocks/FAQ.jsx'
  import { ContactFormBlock }  from './blocks/ContactFormBlock.jsx'
  import { BlogPostsBlock }    from './blocks/BlogPostsBlock.jsx'
  import { ProductGridBlock }  from './blocks/ProductGridBlock.jsx'

  export const atlasWebsiteConfig = {
    components: {
      Section:          { fields: Section.fields,          render: Section },
      Hero:             { fields: Hero.fields,             render: Hero },
      Heading:          { fields: Heading.fields,          render: Heading },
      TextBlock:        { fields: TextBlock.fields,        render: TextBlock },
      ImageBlock:       { fields: ImageBlock.fields,       render: ImageBlock },
      CTA:              { fields: CTA.fields,              render: CTA },
      FeatureGrid:      { fields: FeatureGrid.fields,      render: FeatureGrid },
      FAQ:              { fields: FAQ.fields,              render: FAQ },
      ContactFormBlock: { fields: ContactFormBlock.fields, render: ContactFormBlock },
      BlogPostsBlock:   { fields: BlogPostsBlock.fields,   render: BlogPostsBlock },
      ProductGridBlock: { fields: ProductGridBlock.fields, render: ProductGridBlock },
    },
  }
  ```

- [ ] **Step 11: Commit**

  ```bash
  git add apps/desktop/src/website/blocks/ \
          apps/desktop/src/website/atlasWebsiteConfig.js
  git commit -m "feat(website): add Puck block registry and 11 official website blocks"
  ```

---

## Task 11 — WebsitePageEditorScreen (Puck editor)

**Files:**
- Create: `modules/official/atlas.website/components/WebsitePageEditorScreen.jsx`

This screen reads `pageId` from the URL params, loads `draftBuilderData`, renders the Puck editor, and exposes Save Draft + Publish buttons.

- [ ] **Step 1: Create the screen**

  ```jsx
  // modules/official/atlas.website/components/WebsitePageEditorScreen.jsx
  import { useState, useCallback } from 'react'
  import { useParams, useNavigate } from 'react-router-dom'
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
  import { Puck } from '@measured/puck'
  import '@measured/puck/puck.css'
  import { atlasWebsiteConfig } from '../../../apps/desktop/src/website/atlasWebsiteConfig.js'
  import { useAuth } from '../../../apps/desktop/src/auth/AuthProvider.jsx'
  import { getApiUrl } from '../../../apps/desktop/src/lib/runtimeConfig.js'

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${getApiUrl()}${path}`, options)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  export default function WebsitePageEditorScreen() {
    const { '*': wildcard } = useParams()
    const pageId = wildcard?.match(/^pages\/([^/]+)\/editor$/)?.[1] ?? null
    const navigate = useNavigate()
    const { session } = useAuth()
    const token = session?.access_token
    const queryClient = useQueryClient()
    const [puckData, setPuckData] = useState(null)

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const pageQuery = useQuery({
      queryKey: ['website-page', pageId, token],
      queryFn: () => apiFetch(`/website/pages/${pageId}`, { headers }),
      enabled: Boolean(token) && Boolean(pageId),
      staleTime: 30_000,
      onSuccess: (page) => {
        if (!puckData) {
          const draft = page.draft_builder_data
          setPuckData(draft && Object.keys(draft).length > 0 ? draft : { content: [], root: {} })
        }
      },
    })

    const saveDraftMutation = useMutation({
      mutationFn: (builderData) =>
        apiFetch(`/website/pages/${pageId}/save-draft`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ builderData }),
        }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-page', pageId] }),
    })

    const publishMutation = useMutation({
      mutationFn: () =>
        apiFetch(`/website/pages/${pageId}/publish`, { method: 'POST', headers }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['website-page', pageId] })
        queryClient.invalidateQueries({ queryKey: ['public-website-resolve'] })
      },
    })

    const handleChange = useCallback((data) => {
      setPuckData(data)
    }, [])

    if (pageQuery.isPending) {
      return <div className="h-screen flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm">Cargando editor...</div>
    }

    if (pageQuery.isError || !pageId) {
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-[hsl(var(--muted-foreground))]">No se pudo cargar la pagina.</p>
            <button onClick={() => navigate('/app/m/atlas.website/pages')} className="text-sm underline">Volver</button>
          </div>
        </div>
      )
    }

    const initialData = puckData ?? { content: [], root: {} }

    return (
      <div className="h-screen flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] z-10">
          <button
            onClick={() => navigate('/app/m/atlas.website/pages')}
            className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            Volver
          </button>
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            {pageQuery.data?.title}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => saveDraftMutation.mutate(puckData)}
              disabled={saveDraftMutation.isPending}
              className="px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
            >
              {saveDraftMutation.isPending ? 'Guardando...' : 'Guardar borrador'}
            </button>
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {publishMutation.isPending ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Puck
            config={atlasWebsiteConfig}
            data={initialData}
            onChange={handleChange}
          />
        </div>
      </div>
    )
  }
  ```

  Note: `useParams()` returns the `*` wildcard which for the route `/app/m/atlas.website/pages/123/editor` will be `pages/123/editor`. The regex extracts the page ID.

- [ ] **Step 2: Commit**

  ```bash
  git add modules/official/atlas.website/components/WebsitePageEditorScreen.jsx
  git commit -m "feat(website): add Puck page editor screen with save-draft and publish"
  ```

---

## Task 12 — Full WebsitePageRenderer (Puck render mode)

**Files:**
- Modify: `apps/desktop/src/website/WebsitePageRenderer.jsx`

Replace the stub with Puck's `<Render>` component.

- [ ] **Step 1: Replace stub**

  ```jsx
  // apps/desktop/src/website/WebsitePageRenderer.jsx
  import { Render } from '@measured/puck'
  import '@measured/puck/puck.css'
  import { atlasWebsiteConfig } from './atlasWebsiteConfig.js'

  export function WebsitePageRenderer({ page, theme, menus }) {
    if (!page?.publishedBuilderData || !page.publishedBuilderData.content) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <p className="text-sm text-gray-400">Esta pagina no tiene contenido publicado aun.</p>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-white" data-page-id={page.id}>
        <Render config={atlasWebsiteConfig} data={page.publishedBuilderData} />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify build**

  ```bash
  pnpm --filter @atlas/desktop build:web
  ```
  Expected: build succeeds, no Puck import errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/src/website/WebsitePageRenderer.jsx
  git commit -m "feat(website): implement WebsitePageRenderer with Puck Render component"
  ```

---

## Task 13 — ModuleOutlet: SCREEN_MAP + resolveScreen for atlas.website

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

Add atlas.website lazy imports to SCREEN_MAP and a dynamic-path case to resolveScreen. The screen components live in `modules/official/atlas.website/components/` and are resolved via relative import from `ModuleOutlet`.

The relative path from `apps/desktop/src/app/ModuleOutlet.jsx` to `modules/official/` is `../../../../modules/official/`.

- [ ] **Step 1: Add lazy imports to SCREEN_MAP**

  After the last entry in `SCREEN_MAP` (the `atlas.ledger` entries, line ~93), add:

  ```js
  "atlas.website:/":
    lazy(() => import("../../../../modules/official/atlas.website/components/WebsiteOverviewScreen.jsx")),
  "atlas.website:/pages":
    lazy(() => import("../../../../modules/official/atlas.website/components/WebsitePagesScreen.jsx")),
  "atlas.website:/pages/:id/editor":
    lazy(() => import("../../../../modules/official/atlas.website/components/WebsitePageEditorScreen.jsx")),
  "atlas.website:/theme":
    lazy(() => import("../../../../modules/official/atlas.website/components/WebsiteThemeScreen.jsx")),
  "atlas.website:/menus":
    lazy(() => import("../../../../modules/official/atlas.website/components/WebsiteMenusScreen.jsx")),
  "atlas.website:/blog":
    lazy(() => import("../../../../modules/official/atlas.website/components/WebsiteBlogScreen.jsx")),
  "atlas.website:/forms":
    lazy(() => import("../../../../modules/official/atlas.website/components/WebsiteFormsScreen.jsx")),
  ```

- [ ] **Step 2: Add resolveScreen case for atlas.website**

  In the `resolveScreen` function, before the final `if (subPath === "/")` check (around line 216), add:

  ```js
  if (moduleKey === "atlas.website") {
    if (/^\/pages\/[^/]+\/editor$/.test(subPath)) {
      return SCREEN_MAP["atlas.website:/pages/:id/editor"] ?? null;
    }
    return SCREEN_MAP[`atlas.website:${subPath}`] ?? null;
  }
  ```

- [ ] **Step 3: Syntax check**

  ```bash
  node --check apps/desktop/src/app/ModuleOutlet.jsx
  ```

- [ ] **Step 4: Smoke-test in browser**

  Run `pnpm dev:frontend`. Navigate to `/app/m/atlas.website`. Confirm it shows the overview screen (requires atlas.website to be installed via module catalog first).

- [ ] **Step 5: Commit**

  ```bash
  git add apps/desktop/src/app/ModuleOutlet.jsx
  git commit -m "feat(website): add atlas.website screens to ModuleOutlet SCREEN_MAP"
  ```

---

## Task 14 — Install and sync atlas.website, end-to-end test

**Steps:**

- [ ] **Step 1: Ensure atlas.website appears in module catalog**

  Run `pnpm db:seed` (if not already done). Open `/app/m/atlas.core/modules` — atlas.website should appear as UNINSTALLED.

- [ ] **Step 2: Install the module**

  Via the module catalog UI or:
  ```bash
  curl -X POST http://localhost:4010/modules/atlas.website/install \
    -H "Authorization: Bearer $ATLAS_TOKEN"
  ```

- [ ] **Step 3: Sync tables**

  ```bash
  curl -X POST http://localhost:4010/modules/atlas.website/sync \
    -H "Authorization: Bearer $ATLAS_TOKEN"
  ```
  Expected: `website_site`, `website_page`, etc. tables are created in the DB.

- [ ] **Step 4: Create a test site + page via API**

  ```bash
  # Create site (replace TOKEN)
  curl -X POST http://localhost:4010/website/site \
    -H "Authorization: Bearer $ATLAS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Mi Sitio","domain":"localhost"}'

  # Note the site ID from response, then create a page
  curl -X POST http://localhost:4010/website/pages \
    -H "Authorization: Bearer $ATLAS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "siteId":"<SITE_ID>",
      "title":"Inicio",
      "slug":"inicio",
      "routePath":"/"
    }'
  ```

  Update the site status to `published` with `PATCH /website/site`.

- [ ] **Step 5: Publish page via editor**

  Navigate to `/app/m/atlas.website/pages` → select the page → open editor → add a Hero block → click "Publicar".

- [ ] **Step 6: Verify public website**

  Navigate to `http://localhost:5173/` — should render the published page with the Hero block.

- [ ] **Step 7: Commit if anything required**

  ```bash
  git add .
  git commit -m "test(website): manual end-to-end verification complete"
  ```

---

## Verification Checklist

```
[ ] GET /public/website/resolve?path=/ returns published page data
[ ] http://localhost:5173/ renders WebsitePageRenderer with published Puck content
[ ] http://localhost:5173/about shows PublicWebsite404 (no page at /about)
[ ] http://localhost:5173/app still requires auth
[ ] /app/m/atlas.website shows overview screen
[ ] /app/m/atlas.website/pages shows pages list
[ ] /app/m/atlas.website/pages/:id/editor shows Puck editor
[ ] Save Draft persists draftBuilderData without changing published state
[ ] Publish copies draft to publishedBuilderData and upserts WebsitePublishedRender
[ ] WebsiteThemeScreen shows placeholder (correct for this phase)
[ ] pnpm --filter @atlas/desktop build:web succeeds (no import errors)
[ ] node --check passes for all modified .js/.jsx files
[ ] All 7 website_* tables exist in DB after sync
```

---

## Future work (not in these plans)

- AME3 route loader: formal `publicRouter` export support per module (replaces direct mount in index.js)
- atlas.website theme screen: full token editor
- atlas.website menus screen: full drag-drop menu builder
- atlas.blog: blog posts, categories, RSS
- atlas.forms: dynamic forms, submissions
- atlas.shop: products, cart, checkout
- Worker-generated HTML for SEO / static render cache
- Sitemap + robots.txt generation
- SMTP provider integration

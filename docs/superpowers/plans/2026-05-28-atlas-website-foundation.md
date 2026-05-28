# Atlas Website Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/` and all unmatched public paths resolve against the website DB instead of the old InitGuard redirect; make the Docker web image universal (no rebuild needed per environment).

**Architecture:** A new `runtimeConfig.js` module centralises API-URL resolution (window config → Vite env → hardcoded default). A shell entrypoint script writes `runtime-config.js` into Nginx's static dir at container start. `main.jsx` gains `PublicWebsiteEntry` at `/` and `*`, backed by a new unauthenticated `GET /public/website/resolve` Hono route. The existing `/setup`, `/login`, `/app`, `/p` routes are untouched.

**Tech Stack:** React 18, React Router 7, TanStack Query, Hono, Prisma (`$queryRaw`), Nginx Alpine, Docker, POSIX sh

---

## File Map

### Create
- `apps/desktop/public/runtime-config.js` — dev-mode placeholder (empty config object)
- `apps/desktop/src/lib/runtimeConfig.js` — runtime-config reader + `getApiUrl()`
- `apps/desktop/src/shell/PublicWebsite404.jsx` — public 404 page
- `apps/desktop/src/shell/PublicWebsiteEntry.jsx` — public-path resolver + renderer mount
- `apps/desktop/src/website/WebsitePageRenderer.jsx` — stub renderer (Puck wired in Plan B)
- `apps/api/src/routes/public-website.js` — unauthenticated Hono router
- `infra/nginx/web-entrypoint.sh` — writes runtime-config.js then execs nginx

### Modify
- `apps/desktop/index.html` — add `<script src="/runtime-config.js"></script>`
- `apps/desktop/src/lib/atlas.js` — use `getApiUrl()`
- `apps/desktop/src/shell/PublicModuleOutlet.jsx` — use `getApiUrl()`
- `apps/desktop/src/shell/ModuleBundleLoader.jsx` — use `getApiUrl()`
- `apps/desktop/src/main.jsx` — swap InitGuard for PublicWebsiteEntry; swap `*` redirect
- `apps/api/src/index.js` — import + mount public website router
- `infra/docker/web.Dockerfile` — copy entrypoint, set ENTRYPOINT
- `infra/installer/docker-compose.yml` — add ATLAS_API_URL env to web services

---

## Task 1 — Dev-mode runtime-config placeholder

**Files:**
- Create: `apps/desktop/public/runtime-config.js`

The file in `public/` is served as-is by Vite during dev. In production Docker the container entrypoint overwrites `/usr/share/nginx/html/runtime-config.js` with actual values. An empty object means all fallbacks activate naturally in dev.

- [ ] **Step 1: Create the placeholder**

  ```js
  // apps/desktop/public/runtime-config.js
  window.__ATLAS_RUNTIME_CONFIG__ = {};
  ```

- [ ] **Step 2: Verify dev server still starts**

  Run: `pnpm dev:frontend`
  Expected: Vite starts on port 5173 with no errors. Visiting `/runtime-config.js` returns `window.__ATLAS_RUNTIME_CONFIG__ = {};`.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/public/runtime-config.js
  git commit -m "feat(infra): add dev-mode runtime-config.js placeholder"
  ```

---

## Task 2 — Runtime config module + update three API-URL consumers

**Files:**
- Create: `apps/desktop/src/lib/runtimeConfig.js`
- Modify: `apps/desktop/src/lib/atlas.js` (line 3)
- Modify: `apps/desktop/src/shell/PublicModuleOutlet.jsx` (line 9)
- Modify: `apps/desktop/src/shell/ModuleBundleLoader.jsx` (line 7)

- [ ] **Step 1: Create runtimeConfig.js**

  ```js
  // apps/desktop/src/lib/runtimeConfig.js
  const _rc =
    (typeof window !== 'undefined' ? window.__ATLAS_RUNTIME_CONFIG__ : null) ?? {}

  export const runtimeConfig = _rc

  export function getApiUrl() {
    return (
      _rc.ATLAS_API_URL ||
      import.meta.env.VITE_ATLAS_API_URL ||
      'http://localhost:4010'
    )
  }
  ```

- [ ] **Step 2: Update atlas.js**

  Replace entire file:
  ```js
  // apps/desktop/src/lib/atlas.js
  import { createAtlasClient } from '@atlas/sdk'
  import { getApiUrl } from './runtimeConfig.js'

  export const atlas = createAtlasClient({ baseUrl: getApiUrl() })
  ```

- [ ] **Step 3: Update PublicModuleOutlet.jsx line 9**

  Replace:
  ```js
  const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
  ```
  With:
  ```js
  import { getApiUrl } from '../lib/runtimeConfig.js'
  ```
  Then replace every occurrence of `API_BASE_URL` in that file with `getApiUrl()`.

  Confirm: only one occurrence — in the `queryFn`:
  ```js
  const res = await fetch(`${getApiUrl()}/public/blueprints`)
  ```

- [ ] **Step 4: Update ModuleBundleLoader.jsx line 7**

  Replace:
  ```js
  const apiBase = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
  ```
  With:
  ```js
  import { getApiUrl } from '../lib/runtimeConfig.js'
  ```
  Then replace every occurrence of `apiBase` with `getApiUrl()`.

  Confirm: two occurrences — `new URL(\`${getApiUrl()}/modules/${key}/bundle.js\`)` and the `bundleUrl` construction. The `apiBase` constant is module-level; after removing it, Vite will error if any usage remains — check with `node --check`.

- [ ] **Step 5: Smoke-test**

  Run: `pnpm dev:frontend`
  Expected: app loads, API calls succeed (no change in behaviour because `getApiUrl()` still returns `http://localhost:4010` in dev).

- [ ] **Step 6: Commit**

  ```bash
  git add apps/desktop/src/lib/runtimeConfig.js \
          apps/desktop/src/lib/atlas.js \
          apps/desktop/src/shell/PublicModuleOutlet.jsx \
          apps/desktop/src/shell/ModuleBundleLoader.jsx
  git commit -m "feat(infra): centralise API URL resolution in runtimeConfig"
  ```

---

## Task 3 — Add runtime-config.js script tag to index.html

**Files:**
- Modify: `apps/desktop/index.html`

The script must load **before** the main module so `window.__ATLAS_RUNTIME_CONFIG__` is defined when `runtimeConfig.js` is evaluated. The file 404s silently in dev (the public placeholder handles that); in Docker the entrypoint writes real values first.

- [ ] **Step 1: Add script tag**

  In `apps/desktop/index.html`, insert before the closing `</head>` tag (currently line 35):
  ```html
      <script src="/runtime-config.js"></script>
    </head>
  ```

  Full result for that area:
  ```html
      <meta name="twitter:image" content="/og-image.png" />
      <script src="/runtime-config.js"></script>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.jsx"></script>
    </body>
  ```

- [ ] **Step 2: Verify**

  Run: `pnpm dev:frontend`
  Open browser devtools → Network. Request for `/runtime-config.js` should return 200 with `window.__ATLAS_RUNTIME_CONFIG__ = {};`.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/desktop/index.html
  git commit -m "feat(infra): load runtime-config.js before React bundle"
  ```

---

## Task 4 — Docker entrypoint script + Dockerfile + docker-compose

**Files:**
- Create: `infra/nginx/web-entrypoint.sh`
- Modify: `infra/docker/web.Dockerfile`
- Modify: `infra/installer/docker-compose.yml`

The entrypoint script runs at container startup, writes `runtime-config.js` from env vars, then hands off to nginx. Values not present in the environment default to empty string; the frontend falls through to `import.meta.env` / hardcoded default.

- [ ] **Step 1: Create web-entrypoint.sh**

  ```sh
  #!/bin/sh
  set -e
  cat > /usr/share/nginx/html/runtime-config.js <<EOF
  window.__ATLAS_RUNTIME_CONFIG__ = {
    "ATLAS_API_URL": "${ATLAS_API_URL:-}",
    "SUPABASE_URL": "${SUPABASE_URL:-}",
    "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY:-}"
  };
  EOF
  exec nginx -g 'daemon off;'
  ```

- [ ] **Step 2: Update web.Dockerfile**

  Replace the full file:
  ```dockerfile
  FROM node:22-alpine AS build
  WORKDIR /app
  RUN corepack enable
  COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
  COPY apps/api/package.json apps/api/package.json
  COPY apps/desktop/package.json apps/desktop/package.json
  COPY apps/worker/package.json apps/worker/package.json
  COPY packages packages
  COPY apps/desktop apps/desktop
  RUN pnpm install --frozen-lockfile

  ARG VITE_ATLAS_API_URL
  ARG VITE_SUPABASE_URL
  ARG VITE_SUPABASE_ANON_KEY
  ENV VITE_ATLAS_API_URL=$VITE_ATLAS_API_URL
  ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
  ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

  RUN pnpm --filter @atlas/desktop build:web

  FROM nginx:alpine
  COPY --from=build /app/apps/desktop/dist /usr/share/nginx/html
  COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
  COPY infra/nginx/web-entrypoint.sh /docker-entrypoint.sh
  RUN chmod +x /docker-entrypoint.sh
  EXPOSE 80
  ENTRYPOINT ["/docker-entrypoint.sh"]
  ```

- [ ] **Step 3: Update docker-compose.yml — add ATLAS_API_URL to web services**

  For `atlas-web-external` (lines 30–37), add an `environment` block:
  ```yaml
    atlas-web-external:
      image: ${ATLAS_WEB_EXTERNAL_IMAGE:-raulbellosom/atlaserp:web-external-latest}
      container_name: atlas-web-external
      profiles: ["external"]
      environment:
        ATLAS_API_URL: ${ATLAS_API_URL:-}
        SUPABASE_URL: ${SUPABASE_URL:-}
        SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:-}
      ports:
        - "5173:80"
      restart: unless-stopped
  ```

  For `atlas-web-local` (lines 68–75), add:
  ```yaml
    atlas-web-local:
      image: ${ATLAS_WEB_LOCAL_IMAGE:-raulbellosom/atlaserp:web-local-latest}
      container_name: atlas-web-local
      profiles: ["local"]
      environment:
        ATLAS_API_URL: http://localhost:4010
        SUPABASE_URL: ${SUPABASE_URL:-}
        SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:-}
      ports:
        - "5173:80"
      restart: unless-stopped
  ```

  Note: `ATLAS_API_URL=http://localhost:4010` for local because the browser (on the host) reaches the API container via the mapped host port. The web container only uses this value to write it into `runtime-config.js`; it never makes server-side requests.

- [ ] **Step 4: Commit**

  ```bash
  git add infra/nginx/web-entrypoint.sh \
          infra/docker/web.Dockerfile \
          infra/installer/docker-compose.yml
  git commit -m "feat(infra): universal web Docker image with runtime config injection"
  ```

---

## Task 5 — PublicWebsite404 component

**Files:**
- Create: `apps/desktop/src/shell/PublicWebsite404.jsx`

- [ ] **Step 1: Create the component**

  ```jsx
  // apps/desktop/src/shell/PublicWebsite404.jsx
  import { Link } from 'react-router-dom'

  export function PublicWebsite404() {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
        <div className="max-w-md w-full text-center space-y-4">
          <p className="text-8xl font-bold text-gray-100 select-none">404</p>
          <h1 className="text-2xl font-semibold text-gray-900">Pagina no encontrada</h1>
          <p className="text-gray-500 text-sm">
            La pagina que buscas no existe o no ha sido publicada todavia.
          </p>
          <Link
            to="/"
            className="inline-block mt-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/desktop/src/shell/PublicWebsite404.jsx
  git commit -m "feat(website): add public 404 page"
  ```

---

## Task 6 — WebsitePageRenderer stub

**Files:**
- Create: `apps/desktop/src/website/WebsitePageRenderer.jsx`

This is a minimal stub. Plan B replaces the inner render logic with `@measured/puck` render-only mode. The outer component signature is final and must not change.

- [ ] **Step 1: Create the stub**

  ```jsx
  // apps/desktop/src/website/WebsitePageRenderer.jsx

  export function WebsitePageRenderer({ page, theme, menus }) {
    if (!page?.publishedBuilderData || !Object.keys(page.publishedBuilderData).length) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <p className="text-sm text-gray-400">Esta pagina no tiene contenido publicado aun.</p>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-white" data-page-id={page.id}>
        <p className="p-8 text-sm text-gray-400 text-center">
          Renderizador Puck pendiente — datos recibidos correctamente.
        </p>
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/desktop/src/website/WebsitePageRenderer.jsx
  git commit -m "feat(website): add WebsitePageRenderer stub (Puck wired in Plan B)"
  ```

---

## Task 7 — PublicWebsiteEntry component

**Files:**
- Create: `apps/desktop/src/shell/PublicWebsiteEntry.jsx`

`PublicWebsiteEntry` is mounted at both `/` (home) and `*` (all unmatched paths). It reads `location.pathname`, calls the resolve endpoint, and either redirects to `/setup`, shows 404, or renders `WebsitePageRenderer`.

- [ ] **Step 1: Create the component**

  ```jsx
  // apps/desktop/src/shell/PublicWebsiteEntry.jsx
  import { useEffect } from 'react'
  import { useLocation, useNavigate } from 'react-router-dom'
  import { useQuery } from '@tanstack/react-query'
  import { getApiUrl } from '../lib/runtimeConfig.js'
  import { AppLoader } from '../components/AppLoader.jsx'
  import { PublicWebsite404 } from './PublicWebsite404.jsx'
  import { WebsitePageRenderer } from '../website/WebsitePageRenderer.jsx'

  async function fetchWebsiteResolve(pathname) {
    const url = `${getApiUrl()}/public/website/resolve?path=${encodeURIComponent(pathname)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  export function PublicWebsiteEntry() {
    const location = useLocation()
    const navigate = useNavigate()

    const { data, isPending, isError } = useQuery({
      queryKey: ['public-website-resolve', location.pathname],
      queryFn: () => fetchWebsiteResolve(location.pathname),
      staleTime: 60_000,
      retry: 1,
    })

    useEffect(() => {
      if (data && data.initialized === false) {
        navigate('/setup', { replace: true })
      }
    }, [data, navigate])

    if (isPending) return <AppLoader message="Cargando..." />
    if (isError) return <PublicWebsite404 />
    if (data?.initialized === false) return null
    if (!data?.page) return <PublicWebsite404 />

    return (
      <WebsitePageRenderer
        page={data.page}
        theme={data.theme}
        menus={data.menus}
      />
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/desktop/src/shell/PublicWebsiteEntry.jsx
  git commit -m "feat(website): add PublicWebsiteEntry component"
  ```

---

## Task 8 — Update main.jsx routing

**Files:**
- Modify: `apps/desktop/src/main.jsx`

Two changes:
1. Replace `<Route path="/" element={<InitGuard />} />` with `PublicWebsiteEntry`.
2. Replace `<Route path="*" element={<Navigate to="/" replace />} />` with `PublicWebsiteEntry`.
3. Remove the now-unused `InitGuard` function and `resolveNextPath` helper.

`SetupRouteGuard`, `LoginRouteGuard`, and `AppAccessGuard` are unchanged.

- [ ] **Step 1: Add import at top of main.jsx**

  After line 33 (`import "./styles.css"`), add:
  ```js
  import { PublicWebsiteEntry } from "./shell/PublicWebsiteEntry.jsx";
  ```

- [ ] **Step 2: Remove InitGuard and resolveNextPath**

  Delete lines 56–86 (the `resolveNextPath` function and the entire `InitGuard` function body).

- [ ] **Step 3: Update routes inside App()**

  Change:
  ```jsx
  <Route path="/" element={<InitGuard />} />
  ```
  To:
  ```jsx
  <Route path="/" element={<PublicWebsiteEntry />} />
  ```

  Change:
  ```jsx
  <Route path="*" element={<Navigate to="/" replace />} />
  ```
  To:
  ```jsx
  <Route path="*" element={<PublicWebsiteEntry />} />
  ```

- [ ] **Step 4: Remove unused Navigate import if no longer used elsewhere**

  Scan main.jsx for other `<Navigate` usages. If `<Navigate to="home" replace />` inside the `/app` subtree remains, keep the import. If not, remove `Navigate` from the react-router-dom import.
  
  (It IS still used: `<Route index element={<Navigate to="home" replace />} />` inside `/app`. Keep the import.)

- [ ] **Step 5: Syntax check**

  Run: `node --check apps/desktop/src/main.jsx`
  Expected: no output (clean).

- [ ] **Step 6: Smoke-test**

  Run: `pnpm dev:frontend`
  - Navigate to `http://localhost:5173/` — should call `/public/website/resolve?path=/` (visible in Network tab). If API returns `initialized:false`, browser redirects to `/setup`. If API is down, shows 404 page.
  - Navigate to `http://localhost:5173/about` — same behaviour for path `/about`.
  - Navigate to `http://localhost:5173/app` — still requires auth (AtlasApp guard unchanged).
  - Navigate to `http://localhost:5173/login` — login page unchanged.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/desktop/src/main.jsx
  git commit -m "feat(website): replace InitGuard with PublicWebsiteEntry at root and catch-all"
  ```

---

## Task 9 — Public website resolve API

**Files:**
- Create: `apps/api/src/routes/public-website.js`
- Modify: `apps/api/src/index.js` (add import + one mount line)

Design decision: the website public API is mounted directly in `apps/api/src/index.js` **without** auth middleware, next to the existing `GET /public/blueprints` endpoint (line ~2675). The private website admin routes (Plan B) go through the AME3 route loader as authenticated module routes. This is the minimal safe approach; Plan B documents the path to a proper AME3 public-router extension.

The endpoint queries `website_site` and `website_page` tables using `prisma.$queryRaw`. These tables do not exist until atlas.website is installed (Plan B), so the endpoint catches the error and returns a safe fallback.

- [ ] **Step 1: Create public-website.js**

  ```js
  // apps/api/src/routes/public-website.js
  import { Hono } from 'hono'

  export function createPublicWebsiteRouter({ prisma }) {
    const app = new Hono()

    app.get('/resolve', async (c) => {
      try {
        const instanceConfig = await prisma.instanceConfig.findFirst({
          where: { key: 'initialized' },
        })
        if (!instanceConfig) {
          return c.json({ initialized: false })
        }

        const routePath = c.req.query('path') || '/'

        const company = await prisma.company.findFirst({
          where: { enabled: true },
          orderBy: { createdAt: 'asc' },
        })
        if (!company) {
          return c.json({ initialized: true, site: null, page: null, theme: null, menus: [] })
        }

        const sites = await prisma.$queryRaw`
          SELECT id, name, domain, status, theme_id
          FROM website_site
          WHERE company_id = ${company.id}
            AND enabled = true
            AND status = 'published'
          ORDER BY created_at ASC
          LIMIT 1
        `
        const site = sites[0] ?? null
        if (!site) {
          return c.json({ initialized: true, site: null, page: null, theme: null, menus: [] })
        }

        const pages = await prisma.$queryRaw`
          SELECT id, title, route_path, published_builder_data, seo
          FROM website_page
          WHERE company_id = ${company.id}
            AND site_id = ${site.id}
            AND route_path = ${routePath}
            AND status = 'published'
            AND enabled = true
          LIMIT 1
        `
        const page = pages[0] ?? null

        let theme = null
        if (site.theme_id) {
          const themes = await prisma.$queryRaw`
            SELECT tokens, typography, layout, custom_css
            FROM website_theme
            WHERE id = ${site.theme_id} AND enabled = true
            LIMIT 1
          `
          theme = themes[0] ?? null
        }

        const menus = await prisma.$queryRaw`
          SELECT
            m.id, m.name, m.location,
            COALESCE(
              json_agg(
                json_build_object(
                  'id',         mi.id,
                  'label',      mi.label,
                  'url',        mi.url,
                  'page_id',    mi.page_id,
                  'target',     mi.target,
                  'sort_order', mi.sort_order,
                  'parent_id',  mi.parent_id
                ) ORDER BY mi.sort_order
              ) FILTER (WHERE mi.id IS NOT NULL),
              '[]'::json
            ) AS items
          FROM website_menu m
          LEFT JOIN website_menu_item mi
            ON mi.menu_id = m.id AND mi.enabled = true
          WHERE m.company_id = ${company.id}
            AND m.site_id = ${site.id}
            AND m.enabled = true
          GROUP BY m.id, m.name, m.location
        `

        return c.json({
          initialized: true,
          site: { id: site.id, name: site.name, domain: site.domain },
          page: page
            ? {
                id:                   page.id,
                title:                page.title,
                routePath:            page.route_path,
                publishedBuilderData: page.published_builder_data ?? {},
                seo:                  page.seo ?? {},
              }
            : null,
          theme,
          menus,
        })
      } catch (err) {
        if (err?.message?.includes('does not exist') || err?.code === '42P01') {
          return c.json({ initialized: true, site: null, page: null, theme: null, menus: [] })
        }
        console.error('[public/website/resolve]', err?.message)
        return c.json({ initialized: true, site: null, page: null, theme: null, menus: [] }, 500)
      }
    })

    return app
  }
  ```

  The `42P01` / "does not exist" catch handles the case where atlas.website has not been installed yet (tables don't exist). In that case the endpoint returns a clean "no site" response rather than a 500.

- [ ] **Step 2: Mount in apps/api/src/index.js**

  Near the top of `index.js` (after the existing route imports, around line 30-40), add:
  ```js
  import { createPublicWebsiteRouter } from './routes/public-website.js'
  ```

  Near line 2675 where `GET /public/blueprints` is defined, add two lines immediately before it:
  ```js
  const publicWebsiteRouter = createPublicWebsiteRouter({ prisma })
  app.route('/public/website', publicWebsiteRouter)
  ```

- [ ] **Step 3: Test the endpoint locally**

  With API running (`pnpm dev:api`):
  ```bash
  curl http://localhost:4010/public/website/resolve?path=/
  ```
  Expected (before atlas.website is installed):
  ```json
  {"initialized":true,"site":null,"page":null,"theme":null,"menus":[]}
  ```
  Or if instance is not initialized:
  ```json
  {"initialized":false}
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/routes/public-website.js apps/api/src/index.js
  git commit -m "feat(website): add public website resolve endpoint"
  ```

---

## Verification

After all 9 tasks complete, verify end-to-end behaviour:

**1. API endpoint**
```bash
# Instance not initialized
curl http://localhost:4010/public/website/resolve?path=/
# → { "initialized": false }

# Instance initialized, atlas.website not installed
curl http://localhost:4010/public/website/resolve?path=/
# → { "initialized": true, "site": null, "page": null, ... }
```

**2. Frontend routing**
```
pnpm dev
```
- `http://localhost:5173/` — calls resolve, redirects to /setup if not initialized, shows 404 if no site
- `http://localhost:5173/about` — same, for path `/about`
- `http://localhost:5173/app` — still requires auth
- `http://localhost:5173/login` — unchanged
- `http://localhost:5173/p/some-public-page` — unchanged (PublicModuleOutlet)
- `http://localhost:5173/setup` — unchanged (SetupWizard)

**3. Runtime config injection (Docker — manual test)**
```bash
docker build -f infra/docker/web.Dockerfile -t atlas-web-test .
docker run -e ATLAS_API_URL=http://example-api:4010 -p 8080:80 atlas-web-test
curl http://localhost:8080/runtime-config.js
# → window.__ATLAS_RUNTIME_CONFIG__ = {"ATLAS_API_URL":"http://example-api:4010",...};
```

**4. Node syntax check**
```bash
node --check apps/desktop/src/main.jsx
node --check apps/desktop/src/shell/PublicWebsiteEntry.jsx
node --check apps/desktop/src/website/WebsitePageRenderer.jsx
node --check apps/api/src/routes/public-website.js
```

---

## What Plan B adds

Plan B (`2026-05-28-atlas-website-module.md`) builds on this foundation:
- `modules/official/atlas.website/` — AME3 module with 7 models, private API, views
- Admin screens in `/app/m/atlas.website/*`
- Puck editor at `/app/m/atlas.website/pages/:id/editor`
- `@measured/puck` block registry + 11 official blocks
- Full `WebsitePageRenderer` implementation using Puck render-only mode
- Seed: atlas.website added to `featureModules` in `feature-modules.js`

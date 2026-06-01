# Hosted Build — Plan B: Frontend + Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Nginx to route /app/ to ERP SPA and / to the API, configure Vite base path, add React Router basename, and build the Website Settings UI for selecting the site source and uploading dist/ builds.

**Architecture:** Nginx spa.conf splits routing — /app/* goes to static SPA files, /* proxies to the API at http://api:4010/public/site. Vite is configured with base: '/app/' so all SPA assets are emitted under /app/. The Website Settings screen gains a new "Fuente del sitio" card with a source selector (none/builder/dist) and a dist upload panel.

**Tech Stack:** Nginx, Vite, React, React Hook Form, TanStack Query, @atlas/ui components (no native HTML selects or dialogs — use SelectField, Dialog, ConfirmDialog from @atlas/ui).

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `infra/nginx/spa.conf` | Split routing: /app/ → SPA, / → API proxy |
| Modify | `apps/desktop/vite.config.js` | Add `base: process.env.VITE_BASE_PATH ?? '/'` |
| Modify | `infra/docker/web.Dockerfile` | Add `ARG VITE_BASE_PATH=/app/` build arg |
| Modify | `apps/desktop/src/main.jsx` | Add `basename` to `BrowserRouter` |
| Create | `apps/desktop/src/modules/atlas.website/components/WebsiteSourceSelector.jsx` | Radio-style source selector card |
| Create | `apps/desktop/src/modules/atlas.website/components/DistUploadPanel.jsx` | File upload panel for dist/ |
| Modify | `apps/desktop/src/modules/atlas.website/screens/WebsiteSettingsScreen.jsx` | Add source selector + upload panel section |
| Modify | `packages/sdk/src/index.js` | Add website.getSite, website.updateSite, website.uploadDist, website.deleteDist methods |

---

## Context Notes (from reading the codebase)

- `infra/nginx/spa.conf` currently serves everything with `try_files $uri $uri/ /index.html`. Must be replaced with split routing.
- `apps/desktop/vite.config.js` uses `defineConfig` with no `base` field — must add it. File uses `process.env` variables via `envDir: "../.."`. The `base` field must use `process.env.VITE_BASE_PATH` (not `import.meta.env`) since vite.config.js runs in Node at build time.
- `apps/desktop/src/main.jsx` uses `<BrowserRouter>` from `react-router-dom` (not `createBrowserRouter`). The `basename` prop must be added to this component. Routes include `/app`, `/login`, `/setup`, `/acceso` and a catch-all `/*` for `PublicWebsiteEntry`. After the basename change, all internal paths already start with `/app` which matches the new `basename="/app"` — no route path strings need to change.
- `apps/desktop/src/app/AtlasApp.jsx` does not own the router — it is a consumer via `<Outlet>`. No changes needed there.
- `WebsiteSettingsScreen.jsx` uses a local `apiFetch` helper with `getApiUrl()`. The new sections should follow the same pattern (local apiFetch + TanStack Query), consistent with the existing SMTP card.
- The SDK (`packages/sdk/src/index.js`) has no `website` domain yet. Must add it. The pattern is `request(path, { headers: withAuthHeaders(token), ... })`.
- `infra/docker/web.Dockerfile` already passes three `ARG/ENV` pairs for Vite. `VITE_BASE_PATH` must be added the same way.
- No `components/` directory exists yet under `apps/desktop/src/modules/atlas.website/` — it must be created with the two new files.

---

## Tasks

### Task 1: Nginx config — split /app/ and / routing

- [ ] Read `infra/nginx/spa.conf` to confirm current content (currently a single `location /` block with `try_files`).
- [ ] Replace `infra/nginx/spa.conf` entirely with the new split-routing config:

```nginx
server {
    listen 80;
    server_name _;

    # ERP admin SPA — served from Nginx static files
    # All /app/* routes (including nested) fall back to index.html for client-side routing
    location /app/ {
        alias /usr/share/nginx/html/;
        index index.html;
        try_files $uri @app_fallback;
    }

    location @app_fallback {
        root /usr/share/nginx/html;
        try_files /index.html =404;
    }

    # Public site — proxied to Atlas API
    # The API handles source switching (none/builder/dist)
    location / {
        proxy_pass         http://api:4010/public/site$request_uri;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```

- [ ] Verify the config by reviewing it — confirm:
  - `location /app/` uses `alias` (not `root`) because the path prefix must be stripped before mapping to the filesystem.
  - `@app_fallback` uses `root` (not `alias`) because it directly serves `/index.html` from the html root.
  - `location /` uses `proxy_pass` with `$request_uri` appended so the full path is forwarded to the API.
  - No trailing slash on `proxy_pass http://api:4010/public/site` is correct — Nginx appends `$request_uri` including the leading slash.
- [ ] Commit: `git add infra/nginx/spa.conf && git commit -m "feat(nginx): route /app/ to SPA, / to API for public site serving"`

---

### Task 2: Vite base path + Dockerfile build arg

- [ ] Read `apps/desktop/vite.config.js` to confirm there is no existing `base` field.
- [ ] Add `base: process.env.VITE_BASE_PATH ?? '/',` as the first key inside the `defineConfig({...})` object, before `envDir`. This ensures local dev (`pnpm dev:frontend`) runs at `/` while the Docker production build uses `/app/`.

The modified top of the config should look like:

```js
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  // Read shared monorepo env vars from repository root (.env, .env.local, etc.).
  envDir: "../..",
  plugins: [tailwindcss(), react()],
  // ... rest unchanged
```

- [ ] Read `infra/docker/web.Dockerfile` to confirm the ARG/ENV pattern used for the existing three Vite variables.
- [ ] Add `VITE_BASE_PATH` as a fourth ARG/ENV pair in `infra/docker/web.Dockerfile`, immediately after the existing three, before the `RUN pnpm --filter @atlas/desktop build:web` line:

```dockerfile
ARG VITE_BASE_PATH=/app/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
```

- [ ] Verify `apps/desktop/vite.config.js` syntax: `node --check apps/desktop/vite.config.js || echo "check skipped: ES module syntax"`. If node --check fails due to ES module `import` syntax, simply review the file manually for obvious errors.
- [ ] Commit both files: `git add apps/desktop/vite.config.js infra/docker/web.Dockerfile && git commit -m "feat(vite): add VITE_BASE_PATH build arg for /app/ prefix in production"`

---

### Task 3: React Router basename

- [ ] Read `apps/desktop/src/main.jsx` to confirm `<BrowserRouter>` location (line ~197).
- [ ] Add `basename` prop to `<BrowserRouter>` in `main.jsx`. The spec calls for `import.meta.env.PROD ? '/app' : '/'`. Since `VITE_BASE_PATH` is available at runtime via `import.meta.env`, use the env var directly so the value is consistent with the Vite base:

```jsx
<BrowserRouter basename={import.meta.env.VITE_BASE_PATH?.replace(/\/$/, '') ?? ''}>
```

The `.replace(/\/$/, '')` strips the trailing slash from `/app/` to give `/app`, which is what React Router expects for `basename`. In local dev `VITE_BASE_PATH` is undefined so this resolves to `''` (root), matching current dev behavior.

- [ ] Verify that the existing route paths in `main.jsx` do NOT need to change — they are all already absolute paths (`/app`, `/login`, `/setup`, `/acceso`, `/p`) relative to the basename. React Router handles the prefix automatically.
- [ ] Also add `VITE_BASE_PATH` to `.env.example` if it exists in the repo root:
  - Check if `d:\RacoonDevs\atlaserp-v2\.env.example` exists.
  - If it does, add `VITE_BASE_PATH=/app/` after the last `VITE_` line.
- [ ] Commit: `git add apps/desktop/src/main.jsx && git commit -m "feat(router): add basename from VITE_BASE_PATH for /app/ production routing"`

---

### Task 4: SDK — add website dist methods

- [ ] Read `packages/sdk/src/index.js` to confirm there is no existing `website` domain key in the returned object.
- [ ] Add a `website` domain object to the client returned by `createAtlasClient`. Insert it after the `notifications` domain block. The four methods needed are:

  - `getSite(siteId, token)` — `GET /website/sites/:siteId`
  - `updateSite(siteId, data, token)` — `PATCH /website/sites/:siteId` with JSON body
  - `uploadDist(siteId, file, token)` — `POST /website/sites/:siteId/dist/upload` with FormData (field name: `file`)
  - `deleteDist(siteId, token)` — `DELETE /website/sites/:siteId/dist`

```js
website: {
  getSite: (siteId, token) =>
    request(`/website/sites/${encodeURIComponent(siteId)}`, {
      headers: withAuthHeaders(token),
    }),
  updateSite: (siteId, data, token) =>
    request(`/website/sites/${encodeURIComponent(siteId)}`, {
      method: 'PATCH',
      headers: withAuthHeaders(token),
      body: JSON.stringify(data),
    }),
  uploadDist: (siteId, file, token) => {
    const formData = new FormData()
    formData.append('file', file)
    return request(`/website/sites/${encodeURIComponent(siteId)}/dist/upload`, {
      method: 'POST',
      headers: withAuthHeaders(token),
      body: formData,
    })
  },
  deleteDist: (siteId, token) =>
    request(`/website/sites/${encodeURIComponent(siteId)}/dist`, {
      method: 'DELETE',
      headers: withAuthHeaders(token),
    }),
},
```

- [ ] Verify the SDK file syntax: `node --check packages/sdk/src/index.js`
- [ ] Commit: `git add packages/sdk/src/index.js && git commit -m "feat(sdk): add website.getSite, updateSite, uploadDist, deleteDist methods"`

---

### Task 5: WebsiteSourceSelector component

- [ ] Create the directory `apps/desktop/src/modules/atlas.website/components/` (it does not exist yet — the Write tool will create it implicitly).
- [ ] Create `apps/desktop/src/modules/atlas.website/components/WebsiteSourceSelector.jsx` with the following complete implementation:

```jsx
const SOURCE_OPTIONS = [
  {
    value: 'none',
    label: 'Sin sitio publico',
    description: 'La ruta raiz devuelve 404. Solo existe /app/ para el panel de administracion.',
  },
  {
    value: 'builder',
    label: 'Constructor de paginas',
    description: 'Sirve las paginas creadas en el editor visual del ERP.',
  },
  {
    value: 'dist',
    label: 'Build propio (dist/)',
    description: 'Sirve tu app compilada de React, Astro, Next.js (static export), SvelteKit u otro framework.',
  },
]

export function WebsiteSourceSelector({ currentSource, onSelect, isLoading }) {
  return (
    <div className="space-y-2">
      {SOURCE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => !isLoading && onSelect(option.value)}
          disabled={isLoading || currentSource === option.value}
          className={[
            'w-full text-left px-4 py-3 rounded-lg border transition-colors',
            currentSource === option.value
              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
              : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)]',
            isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <div
              className={[
                'w-4 h-4 rounded-full border-2 flex-shrink-0',
                currentSource === option.value
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
                  : 'border-[hsl(var(--muted-foreground))]',
              ].join(' ')}
            />
            <div>
              <p className="text-sm font-medium">{option.label}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {option.description}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
```

Props contract:
- `currentSource` — `'none' | 'builder' | 'dist'` string, the currently active source from the API
- `onSelect(value)` — called with the new source value when the user clicks a different option; the parent is responsible for calling `PATCH /website/sites/:siteId`
- `isLoading` — `boolean` disables all buttons while the mutation is in flight

- [ ] Commit: `git add apps/desktop/src/modules/atlas.website/components/WebsiteSourceSelector.jsx && git commit -m "feat(website): add WebsiteSourceSelector radio card component"`

---

### Task 6: DistUploadPanel component

- [ ] Create `apps/desktop/src/modules/atlas.website/components/DistUploadPanel.jsx` with the following complete implementation:

```jsx
import { useState, useRef } from 'react'
import { Button } from '@atlas/ui'
import { ConfirmDialog } from '@atlas/ui'

const MAX_SIZE_MB = 100
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DistUploadPanel({ site, onUpload, onDelete, isUploading, uploadError }) {
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileInputRef = useRef(null)

  const hasExistingDist = Boolean(site?.distUploadedAt)

  function handleFileChange(e) {
    setFileError(null)
    const selected = e.target.files?.[0]
    if (!selected) {
      setFile(null)
      return
    }
    if (!selected.name.endsWith('.zip')) {
      setFileError('Solo se aceptan archivos .zip')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setFileError(`El archivo supera el limite de ${MAX_SIZE_MB}MB`)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(selected)
  }

  function handleUpload() {
    if (!file || isUploading) return
    onUpload(file)
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleConfirmDelete() {
    setShowDeleteConfirm(false)
    onDelete()
  }

  return (
    <div className="space-y-4">
      {hasExistingDist && (
        <div className="rounded-lg border border-[hsl(var(--border))] p-3 bg-[hsl(var(--muted)/0.3)] text-sm space-y-1">
          <p className="font-medium">Build actual</p>
          <p className="text-[hsl(var(--muted-foreground))]">
            Desplegado el {formatDate(site.distUploadedAt)}
          </p>
          <p className="text-[hsl(var(--muted-foreground))]">
            {site.distFileCount ?? 0} archivo{(site.distFileCount ?? 0) !== 1 ? 's' : ''}
            {site.distHasPrerender
              ? ' · Prerenderizado (multiples rutas HTML)'
              : ' · SPA (index.html fallback)'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium block">
          Seleccionar archivo .zip
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-[hsl(var(--muted-foreground))] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[hsl(var(--primary))] file:text-white file:cursor-pointer disabled:opacity-50"
        />
        {fileError && (
          <p className="text-xs text-red-600">{fileError}</p>
        )}
        {uploadError && (
          <p className="text-xs text-red-600">{uploadError}</p>
        )}
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Formato: .zip (max {MAX_SIZE_MB}MB). Incluye el output de tu bundler (Vite, Astro, Next.js static export, SvelteKit, etc.).
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          size="sm"
        >
          {isUploading ? 'Subiendo...' : 'Subir build'}
        </Button>

        {hasExistingDist && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isUploading}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Eliminar build
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Eliminar build"
        description="Se eliminaran todos los archivos del build actual. El sitio volvera al constructor de paginas hasta que subas un nuevo build. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
```

Props contract:
- `site` — object with `distUploadedAt` (ISO string | null), `distFileCount` (number | null), `distHasPrerender` (boolean | null)
- `onUpload(file)` — called with the `File` object when the user clicks "Subir build"
- `onDelete()` — called after the user confirms deletion in the `ConfirmDialog`
- `isUploading` — boolean, disables upload button and file input during upload
- `uploadError` — string | null, error message from the last upload mutation

- [ ] Commit: `git add apps/desktop/src/modules/atlas.website/components/DistUploadPanel.jsx && git commit -m "feat(website): add DistUploadPanel component with zip upload and ConfirmDialog delete"`

---

### Task 7: Integrate into Website Settings screen

- [ ] Read `apps/desktop/src/modules/atlas.website/screens/WebsiteSettingsScreen.jsx` to understand the current structure (currently: one `Card` for SMTP settings, using a local `apiFetch` helper and TanStack Query mutations).

- [ ] Add the "Fuente del sitio" section to `WebsiteSettingsScreen.jsx`. The integration follows the same pattern as the existing SMTP card: local `apiFetch`, `useQuery` for data, `useMutation` for changes.

The full updated file must:

1. Add imports for the two new components and the necessary icons:
```jsx
import { WebsiteSourceSelector } from '../components/WebsiteSourceSelector.jsx'
import { DistUploadPanel } from '../components/DistUploadPanel.jsx'
import { Globe } from 'lucide-react'
```

2. Add a `useSite` query that fetches the site data. The screen needs to get the `siteId` first. Follow the existing pattern in other website screens — use `GET /website/sites` to get the list and pick the first site, or `GET /website/overview` if that endpoint returns the siteId. Check `WebsiteOverviewScreen.jsx` to confirm which endpoint gives the site ID:
   - Read `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx` briefly to find how other screens get `siteId`.
   - Use the same approach.

3. Add a `sourceQuery` using TanStack Query:
```js
const sourceQuery = useQuery({
  queryKey: ['website-site-source', siteId],
  queryFn: () => apiFetch(`/website/sites/${siteId}`, token),
  enabled: Boolean(token) && Boolean(siteId),
})
```

4. Add a `sourceChangeMutation` using `useMutation`:
```js
const sourceChangeMutation = useMutation({
  mutationFn: (newSource) =>
    apiFetch(`/website/sites/${siteId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ sourceType: newSource }),
    }),
  onSuccess: () => {
    toast.success('Fuente del sitio actualizada')
    sourceQuery.refetch()
  },
  onError: (err) => toast.error(err.message),
})
```

5. Add an `uploadDistMutation` using `useMutation` with `FormData` (no `Content-Type` header — let the browser set multipart boundary):
```js
const uploadDistMutation = useMutation({
  mutationFn: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiFetch(`/website/sites/${siteId}/dist/upload`, token, {
      method: 'POST',
      headers: {},   // override to remove Content-Type so FormData boundary is set by browser
      body: formData,
    })
  },
  onSuccess: (res) => {
    toast.success(`Build subido: ${res.data.fileCount} archivos`)
    sourceQuery.refetch()
  },
  onError: (err) => toast.error(err.message),
})
```

   Note: the existing `apiFetch` helper always sets `Content-Type: application/json`. For FormData upload, pass an empty `headers: {}` override in `options` that replaces the default `Content-Type`. Review the `apiFetch` helper to confirm it merges headers with spread — if it does `{ 'Content-Type': 'application/json', ...options.headers }`, then passing `options.headers = { 'Content-Type': undefined }` will not work. Instead, create a separate `apiFetchForm` helper in the screen that omits `Content-Type`:

```js
async function apiFetchForm(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
```

   Use `apiFetchForm` in `uploadDistMutation` and `deleteDistMutation`.

6. Add a `deleteDistMutation`:
```js
const deleteDistMutation = useMutation({
  mutationFn: () =>
    apiFetchForm(`/website/sites/${siteId}/dist`, token, { method: 'DELETE' }),
  onSuccess: () => {
    toast.success('Build eliminado. El sitio volvera al constructor de paginas.')
    sourceQuery.refetch()
  },
  onError: (err) => toast.error(err.message),
})
```

7. Add the "Fuente del sitio" `Card` to the JSX, placed above the existing SMTP card:

```jsx
<Card className="p-0 overflow-hidden">
  <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 flex items-center gap-2">
    <Globe className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
    <div>
      <p className="text-sm font-semibold">Fuente del sitio</p>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
        Elige que se sirve en la ruta raiz de tu dominio.
      </p>
    </div>
  </div>

  <div className="p-4 space-y-4">
    {sourceQuery.isPending ? (
      <div className="space-y-2">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    ) : (
      <>
        <WebsiteSourceSelector
          currentSource={sourceQuery.data?.data?.sourceType ?? 'builder'}
          onSelect={(value) => sourceChangeMutation.mutate(value)}
          isLoading={sourceChangeMutation.isPending}
        />

        {(sourceQuery.data?.data?.sourceType === 'dist') && (
          <div className="pt-2 border-t border-[hsl(var(--border))]">
            <p className="text-sm font-medium mb-3">Archivos del build</p>
            <DistUploadPanel
              site={sourceQuery.data?.data}
              onUpload={(file) => uploadDistMutation.mutate(file)}
              onDelete={() => deleteDistMutation.mutate()}
              isUploading={uploadDistMutation.isPending || deleteDistMutation.isPending}
              uploadError={uploadDistMutation.isError ? uploadDistMutation.error?.message : null}
            />
          </div>
        )}
      </>
    )}
  </div>
</Card>
```

- [ ] Verify the screen file stays under 1000 lines (the CLAUDE.md hard limit). The current file is 218 lines; after adding ~80 lines of code it will still be well under the limit.
- [ ] Commit: `git add apps/desktop/src/modules/atlas.website/screens/WebsiteSettingsScreen.jsx && git commit -m "feat(website): add hosted build UI — source selector and dist upload panel in settings"`

---

## Self-Review Checklist

Before marking this plan complete, verify:

- [ ] **Spec section 2 (Routing):** Nginx routes `/app/` to SPA and `/` to `http://api:4010/public/site`. Covered in Task 1.
- [ ] **Spec section 3 (React Router basename):** `basename` added to `<BrowserRouter>`. Covered in Task 3.
- [ ] **Spec section 7 (Upload pipeline — client side):** `POST /website/sites/:siteId/dist/upload` with FormData `file` field. Covered in Tasks 4 and 7.
- [ ] **Spec section 7 (Delete):** `DELETE /website/sites/:siteId/dist`. Covered in Tasks 4 and 7.
- [ ] **Spec section 9 (Admin UI):** Source selector with three options (none/builder/dist), dist upload panel with deploy info + upload + delete. Covered in Tasks 5, 6, 7.
- [ ] **No native HTML selects or dialogs:** `WebsiteSourceSelector` uses `<button>` elements (radio-card pattern), not `<select>`. `DistUploadPanel` uses `ConfirmDialog` from `@atlas/ui` for the delete confirmation, not `window.confirm()`.
- [ ] **All UI text in Spanish:** Labels, descriptions, toast messages, and button text are all in Spanish.
- [ ] **Component props consistent:** `WebsiteSourceSelector` receives `currentSource`, `onSelect`, `isLoading` — all passed correctly from `WebsiteSettingsScreen`. `DistUploadPanel` receives `site`, `onUpload`, `onDelete`, `isUploading`, `uploadError` — all passed correctly from `WebsiteSettingsScreen`.
- [ ] **No placeholders:** Every code block is complete and runnable.
- [ ] **Vite base + Dockerfile:** `base: process.env.VITE_BASE_PATH ?? '/'` in vite.config.js; `ARG VITE_BASE_PATH=/app/` + `ENV VITE_BASE_PATH=$VITE_BASE_PATH` in web.Dockerfile. Covered in Task 2.
- [ ] **`Button` and `ConfirmDialog` imported from `@atlas/ui`:** Not from local files. Both are exported from `packages/ui/src/index.js`.
- [ ] **File size limits:** `WebsiteSettingsScreen.jsx` will be ~300 lines after changes — well within the 1000-line soft limit.

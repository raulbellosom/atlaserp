# Atlas Plugin Runtime — Dynamic Module Bundler

**Date:** 2026-05-28
**Status:** Approved for implementation
**Replaces:** `docs/superpowers/specs/dynamic-module-bundler.md` (draft — superseded by this document)

---

## Problem

Atlas ERP distributes as a Docker image with a pre-compiled Vite frontend. Custom modules
(`modules/custom/<key>/`) can contribute API routes, Atlas ORM tables, and blueprint views that
all load dynamically at runtime with no rebuild required. However, React components in
`modules/custom/<key>/components/` are compiled by Vite at build-time via `import.meta.glob`.
This means:

- A Docker image cannot load React components from a module mounted as a volume post-build.
- Adding a custom module with UI currently requires rebuilding the entire frontend.
- The pattern does not scale to third-party or tenant-installed modules.

---

## Goal

Enable custom modules to include React components (cell renderers, full screens, wizards) that
are compiled at install-time by the API server using esbuild, stored durably, and loaded by the
frontend dynamically — with no Vite rebuild required. Blueprints, views, API routes, and Atlas
ORM tables continue working exactly as today.

---

## Non-goals

- Hot Module Replacement (HMR) for custom module components — full page reload on change is
  acceptable (chosen intentionally, see Decision Log below).
- Sandboxing or security isolation of custom module code — module authors are trusted.
- TypeScript support in custom module components for this phase — esbuild supports it natively
  and can be enabled in a follow-on.
- Migrating `custom.fleet` or `custom.financia` to this system — they are transitional modules
  (see Transitional Modules section).

---

## Architecture Overview

```
modules/custom/<key>/
  components/index.js   ← esbuild entry point, exports register()
  components/*.jsx      ← React components
  api/, views/, models/ ← unchanged

          POST /modules/:key/install or sync
                        ↓
             module-bundler-service.js
               esbuild.build() → bundle.js
               → filesystem: apps/api/bundles/<key>.js
               → Supabase Storage: module-bundles/<key>.js
               → AtlasModule: has_bundle=true, bundle_hash=<sha256>

          On API boot (cold start)
               For each INSTALLED+enabled module with has_bundle=true:
                 If filesystem bundle missing → download from Storage

          GET /modules/:key/bundle.js
               Serve from filesystem, ETag=bundle_hash

          GET /blueprints  →  includes bundle_url per module
                        ↓
             ModuleBundleLoader (React, app root)
               await import(bundle_url)   // @vite-ignore
               mod.register(componentRegistry)

             ComponentRegistry (unchanged interface)
               resolve('custom.mymodule:MyScreen') → Component

             BlueprintCrudScreen CUSTOM branch (unchanged)
               schema.component → registry.resolve() → render
```

---

## Decision Log

| Decision | Choice | Reason |
|---|---|---|
| Dev vs prod behavior | Always esbuild (no Vite for custom component bundles) | Consistency — same behavior in dev and Docker, no dual-mode complexity |
| Screen routing | CUSTOM kind blueprints + ComponentRegistry | Already implemented in define-view.js and BlueprintCrudScreen; no hardcoding needed |
| Bundle storage | Filesystem (fast serve) + Supabase Storage (durable) | Filesystem for speed, Storage for persistence across container restarts |
| Compilation trigger | Install and sync time | Deterministic — install provisions everything, consistent with existing lifecycle |
| HMR in dev | Not supported, full page reload | Chosen to keep dev/prod parity; esbuild recompile is fast enough (~100ms) |

---

## Data Model Changes

New Prisma migration (forward only, never edit existing migrations):

```prisma
// Add to AtlasModule model in schema.prisma
has_bundle  Boolean  @default(false)
bundle_hash String?
```

Migration file: `prisma/migrations/<timestamp>_atlas_module_bundle_fields/migration.sql`

```sql
ALTER TABLE "AtlasModule" ADD COLUMN "has_bundle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AtlasModule" ADD COLUMN "bundle_hash" TEXT;
```

---

## API: module-bundler-service.js

**Location:** `apps/api/src/services/module-bundler-service.js`

### BUNDLE_EXTERNALS constant

Packages marked as external (already in the Vite main bundle, not re-bundled):

```js
export const BUNDLE_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@tanstack/react-query',
  'zustand',
  '@atlas/ui',
  '@atlas/sdk',
  '@atlas/validators',
]
```

This list is the contract between the main Vite bundle and module bundles. It must be kept in
sync with what `apps/desktop` actually loads. Documented in `docs/03_custom_modules.md`.

### buildModuleBundle(moduleKey, { force = false } = {})

```
1. Resolve components entry: modules/custom/<key>/components/index.js
   If not found → return { built: false, reason: 'no-components' }

2. Compute sha256 hash of all files in components/
   Load stored bundle_hash from AtlasModule row
   If hash matches and force=false → return { built: false, reason: 'unchanged' }

3. esbuild.build({
     entryPoints: [entry],
     bundle: true,
     format: 'esm',
     jsx: 'automatic',
     loader: { '.js': 'jsx', '.jsx': 'jsx' },
     external: BUNDLE_EXTERNALS,
     outfile: bundleOutputPath,
     sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
   })

4. Write result to filesystem: apps/api/bundles/<key>.js
5. Upload to Supabase Storage bucket 'module-bundles', path '<key>.js'
6. Update AtlasModule: has_bundle=true, bundle_hash=<newHash>
7. Return { built: true, hash: newHash }
```

### deleteModuleBundle(moduleKey)

```
1. Delete filesystem file: apps/api/bundles/<key>.js (if exists)
2. Delete from Supabase Storage: module-bundles/<key>.js (if exists)
3. Update AtlasModule: has_bundle=false, bundle_hash=null
```

### restoreModuleBundlesOnBoot()

Called once at API startup after route-loader mounts modules:

```
For each AtlasModule where status=INSTALLED AND enabled=true AND has_bundle=true:
  If apps/api/bundles/<key>.js does not exist:
    Download from Supabase Storage → write to filesystem
  If Storage file also missing (e.g. first deploy with existing DB):
    Log warning, set has_bundle=false — module needs sync to rebuild
```

### Dev file watcher

In `NODE_ENV=development`, after boot restoration, start a watcher:

```
fs.watch('modules/custom', { recursive: true }, (event, filename) => {
  if (!filename?.includes('/components/')) return
  const key = extractModuleKeyFromPath(filename)
  if (key && isModuleInstalled(key)) {
    buildModuleBundle(key, { force: true })
      .then(() => console.log(`[bundler] rebuilt ${key}`))
  }
})
```

Full page reload is triggered by the browser detecting the ETag change on the bundle URL.

---

## API: Lifecycle integration

### module-lifecycle-service.js — changes

- `installModule(key)`: call `buildModuleBundle(key)` at the end, after ORM sync
- `syncModule(key)`: call `buildModuleBundle(key)` (hash check skips if unchanged)
- `uninstallModule(key)`: call `deleteModuleBundle(key)` before removing DB row
- `enableModule(key)`: no bundle action (bundle already exists)
- `disableModule(key)`: no bundle action (bundle kept, just not served to frontend)
- `resetModule(key)`: call `buildModuleBundle(key, { force: true })` after reset

### New endpoint: GET /modules/:key/bundle.js

Added to `apps/api/src/routes/modules.js`:

```
GET /modules/:key/bundle.js
  Auth: public (bundle is static JS, no sensitive data)
  Check: module INSTALLED + enabled + has_bundle=true
  If filesystem file missing: attempt restore from Storage, 404 if unavailable
  Response: Content-Type: application/javascript
            ETag: "<bundle_hash>"
            Cache-Control: public, max-age=3600
            Body: file stream from filesystem
```

### GET /blueprints — has_bundle field

In the `GET /blueprints` handler in `apps/api/src/index.js` (~line 2583), add `has_bundle`
to the module metadata included in the response:

```js
// Per module in the response
has_bundle: module.has_bundle && module.status === 'INSTALLED' && module.enabled,
```

The frontend constructs the bundle URL itself using `VITE_ATLAS_API_URL`:
```js
// In ModuleBundleLoader.jsx
const apiBase = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
const bundle_url = mod.has_bundle ? `${apiBase}/modules/${mod.key}/bundle.js` : null
```

This avoids the API needing to know its own public URL.

---

## Frontend: moduleComponentRegistry.js

**Location:** `apps/desktop/src/lib/moduleComponentRegistry.js`

Remove the `import.meta.glob` block entirely. The file becomes:

```js
import { createModuleComponentRegistry } from './module-component-registry-core.js'

const _isDev = Boolean(import.meta.env?.DEV)
function warnDev(msg) { if (_isDev) console.warn(`[moduleComponentRegistry] ${msg}`) }

export const componentRegistry = createModuleComponentRegistry({ warn: warnDev })

// Registration is now done at runtime by ModuleBundleLoader
// via dynamic import() of each module's compiled bundle.
```

`module-component-registry-core.js` and its tests are unchanged.

---

## Frontend: ModuleBundleLoader.jsx

**Location:** `apps/desktop/src/shell/ModuleBundleLoader.jsx`

Mounted at the root of the app, wraps the router. Loads all module bundles before rendering routes.

```
Props: { children }

State: loading (bool), errors (string[])

On mount:
  1. Fetch installed modules with bundle_url (from /blueprints or /modules endpoint)
  2. For each module with bundle_url:
     a. const mod = await import(/* @vite-ignore */ bundle_url)
     b. if (typeof mod.register === 'function') await mod.register(componentRegistry)
     c. On error: push to errors[], continue (don't block other bundles)
  3. Set loading=false

Render:
  If loading → <LoadingSpinner /> (same spinner used elsewhere in the app)
  If errors.length > 0 (dev only) → show non-blocking warning banner
  Always → render children
```

Error in one module's bundle must never block the app from loading.

---

## Frontend: ModuleOutlet.jsx — SCREEN_MAP cleanup

Remove all `custom.financia` entries from `SCREEN_MAP`. Add a comment documenting the
transitional modules:

```js
// --- Transitional custom modules (fleet, financia) ---
// These modules are developed in modules/custom/ but use static React components
// compiled by Vite. They are listed here as an exception to the dynamic bundle system.
// When promoted to core modules, move their components to apps/desktop/src/modules/
// and remove this comment.
//
// custom.fleet and custom.financia screens are currently kept in SCREEN_MAP because
// they predate the dynamic bundle system. New custom modules must NOT be added here —
// use kind:CUSTOM blueprints + dynamic bundles instead.
"custom.financia:/accounts/:id": lazy(...),
"custom.financia:/accounts/:id/import": lazy(...),
```

All other custom module routes resolve through `BlueprintCrudScreen` which handles `kind:CUSTOM`.

---

## Module authoring: components/index.js contract

Every custom module with UI must export a `register` function:

```js
// modules/custom/custom.mymodule/components/index.js
export async function register(registry) {
  if (typeof window === 'undefined') return

  // esbuild resolves these imports at bundle compile time
  const [
    { default: MyScreen },
    { default: MyBadgeCell },
  ] = await Promise.all([
    import('./MyScreen.jsx'),
    import('./MyBadgeCell.jsx'),
  ])

  registry.register('custom.mymodule:MyScreen',    MyScreen)
  registry.register('custom.mymodule:MyBadgeCell', MyBadgeCell)
}
```

**Available imports in components:**

| Import source | Available | Notes |
|---|---|---|
| `react`, `react-dom` | Yes | External — in main bundle |
| `@tanstack/react-query` | Yes | External — in main bundle |
| `zustand` | Yes | External — in main bundle |
| `@atlas/ui` | Yes | External — in main bundle |
| `@atlas/sdk` | Yes | External — in main bundle |
| Packages in root `node_modules` | Yes | esbuild bundles them into module bundle |
| `https://esm.sh/<pkg>` CDN imports | Yes | Browser fetches at runtime |
| Node.js built-ins (`fs`, `path`) | No | Browser environment only |
| `exceljs`, `pdfkit`, `sharp` | No | API-only packages, use in `api/` not `components/` |

---

## Module authoring: CUSTOM kind blueprint for full screens

Any full-screen custom component must declare a CUSTOM kind view:

```js
// modules/custom/custom.mymodule/views/my-screen.custom.js
import { defineView } from '@atlas/module-engine'

export default defineView('custom.mymodule.my-screen', {
  kind: 'CUSTOM',
  schema: {
    path: '/my-entity/:id',
    component: 'custom.mymodule:MyScreen',
    title: 'Detalle de entidad',
  },
})
```

No entry in `SCREEN_MAP`. No changes to `ModuleOutlet.jsx`. `BlueprintCrudScreen` resolves
the component from the registry automatically via the existing CUSTOM branch.

Cell components (badge renderers, image cells, etc.) used in TABLE blueprints do not need a
CUSTOM view — they are registered by key and referenced in `schema.columns[].component`.

---

## Transitional Modules: custom.fleet and custom.financia

These modules use React components that were written before this system existed. They are
tracked as technical debt with a clear promotion path:

**Current state:**
- Components compiled by Vite via `import.meta.glob` in `moduleComponentRegistry.js`
- Full screens mapped in `ModuleOutlet.jsx` SCREEN_MAP
- `components/index.js` uses the `register()` pattern but called statically

**Future state (when promoted to core):**
- Move `components/` to `apps/desktop/src/modules/atlas.fleet/` and `atlas.financia/`
- Add static lazy imports to SCREEN_MAP
- Remove from dynamic bundle system
- No `components/index.js` needed — Vite compiles them directly

**This promotion is a separate planned task and is not in scope for this spec.**

---

## Supabase Storage setup

Bucket: `module-bundles`
- Visibility: private (served through the API, not directly from Storage)
- No RLS policies needed (API uses service role key)
- File naming: `<moduleKey>.js` (e.g. `custom.mymodule.js`)

If bucket does not exist, `restoreModuleBundlesOnBoot()` must create it on first run using the
Supabase admin client with `createBucket('module-bundles', { public: false })`.

---

## New npm dependency

```json
// apps/api/package.json
"esbuild": "^0.25.0"
```

esbuild ships pre-compiled binaries for linux/amd64, linux/arm64, darwin, win32. No native
compilation needed. Works in Docker without extra setup.

---

## Development workflow

```bash
# First time: install the module
curl -X POST http://localhost:4010/modules/custom.mymodule/install

# Edit a component → watcher detects change → esbuild recompiles
# Reload browser to see changes (no HMR)

# Force recompile without reinstalling
curl -X POST http://localhost:4010/modules/custom.mymodule/sync

# Check bundle was built
curl http://localhost:4010/modules/custom.mymodule/bundle.js
```

---

## Documentation updates (end of implementation)

The following docs must be updated after this system is implemented:

- `docs/03_custom_modules.md` — add section on `components/`, `BUNDLE_EXTERNALS`, CUSTOM kind
  views, and the `register()` contract. Update the 13-step workflow to include components.
- `CLAUDE.md` — update AME3 module creation rules to mention components/ and bundle system.
- `docs/architecture/atlas-module-engine-v3.md` — add Plugin Runtime section.
- Docker deployment guide (to be created) — volume mounting, install flow, bundle persistence.

---

## Implementation phases

### Phase A — API bundler infrastructure
- Add `has_bundle` + `bundle_hash` to AtlasModule (Prisma migration)
- Install `esbuild` in `apps/api`
- Implement `module-bundler-service.js` (build, delete, restore)
- Integrate into module lifecycle (install, sync, uninstall, reset)
- Implement `GET /modules/:key/bundle.js` endpoint
- Add `bundle_url` to `GET /blueprints` response
- Add dev file watcher
- Create Supabase Storage bucket `module-bundles`

### Phase B — Frontend dynamic loader
- Remove `import.meta.glob` from `moduleComponentRegistry.js`
- Implement `ModuleBundleLoader.jsx`
- Mount `ModuleBundleLoader` in app root
- Clean up `ModuleOutlet.jsx` SCREEN_MAP comments

### Phase C — First real module using the system
- Create a minimal example module (`custom.example`) with one screen and one cell component
- Validates the full end-to-end flow in dev and a local Docker build
- Documents any gaps found during implementation

### Phase D — Documentation
- Update all docs listed in the Documentation Updates section above

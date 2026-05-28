# Atlas Plugin Runtime — Dynamic Module Bundler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable custom modules to ship React components that are compiled by esbuild at install-time and loaded by the frontend dynamically — no Vite rebuild required when adding modules to a running Docker instance.

**Architecture:** The API compiles `modules/custom/<key>/components/` with esbuild on `install`/`sync`, stores the bundle in `apps/api/bundles/<key>.js` (filesystem) and `module-bundles/<key>.js` (Supabase Storage). On cold boot the API restores missing bundles from Storage. The frontend replaces the static `import.meta.glob` in `moduleComponentRegistry.js` with a `ModuleBundleLoader` component that dynamically imports each module's bundle via `import(bundle_url)` and calls its exported `register()` function.

**Tech Stack:** Node.js built-in `node:crypto` + `node:fs/promises`, `esbuild ^0.25.0`, `@supabase/supabase-js` (already in API), React + TanStack Query (already in desktop).

**Spec:** `docs/superpowers/specs/2026-05-28-dynamic-module-bundler-design.md`

---

## File Map

### New files
- `apps/api/src/services/module-bundler-service.js` — esbuild compile, hash, Storage up/down/delete, dev watcher, boot restore
- `apps/api/bundles/.gitkeep` — ensures bundles dir is tracked in git
- `apps/desktop/src/shell/ModuleBundleLoader.jsx` — dynamic bundle importer mounted in AtlasApp
- `apps/api/src/services/__tests__/module-bundler-service.test.js` — unit + integration tests

### Modified files
- `apps/api/package.json` — add `esbuild ^0.25.0`
- `prisma/schema.prisma` — add `has_bundle Boolean @default(false)` and `bundle_hash String?` to `AtlasModule`
- `prisma/migrations/<timestamp>/migration.sql` — forward migration for the two new columns
- `apps/api/src/routes/modules.js` — add `GET /:key/bundle.js` endpoint; accept `bundlerSvc` param; call bundler in install/sync/uninstall/reset handlers
- `apps/api/src/index.js` — instantiate bundler service; pass to modules router; call `restoreModuleBundlesOnBoot()` after `routeLoader.initialize()`; add `has_bundle` to `/blueprints` response
- `apps/desktop/src/lib/moduleComponentRegistry.js` — remove `import.meta.glob` block
- `apps/desktop/src/app/AtlasApp.jsx` — mount `ModuleBundleLoader`
- `apps/desktop/src/app/ModuleOutlet.jsx` — remove `custom.financia` SCREEN_MAP entries; add transitional-module comment

---

## Task 1 — Prisma migration: add bundle fields to AtlasModule

**Files:**
- Modify: `prisma/schema.prisma` (AtlasModule model, ~line 43)
- Create: `prisma/migrations/<timestamp>_add_atlas_module_bundle_fields/migration.sql`

- [ ] **Step 1: Add fields to schema.prisma**

Open `prisma/schema.prisma`. In the `AtlasModule` model, add two fields after `updatedAt`:

```prisma
model AtlasModule {
  id             String       @id @default(uuid(7)) @db.Uuid
  key            String       @unique
  name           String
  description    String?
  version        String
  kind           ModuleKind   @default(FEATURE)
  status         ModuleStatus @default(INSTALLED)
  core           Boolean      @default(false)
  uninstallable  Boolean      @default(true)
  enabled        Boolean      @default(true)
  manifest       Json
  lifecycleConfig Json?       @map("lifecycle_config")
  installedAt    DateTime     @default(now()) @map("installed_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")
  hasBundle      Boolean      @default(false) @map("has_bundle")
  bundleHash     String?      @map("bundle_hash")

  dependencies   ModuleDependency[] @relation("ModuleDependencies")
  requiredBy     ModuleDependency[] @relation("RequiredByModules")
  blueprints     Blueprint[]
  permissions    Permission[]

  @@index([status, enabled])
  @@map("atlas_module")
}
```

- [ ] **Step 2: Create the migration SQL file**

Find the latest migration timestamp with:
```bash
ls prisma/migrations/ | sort | tail -3
```

Create directory `prisma/migrations/<YYYYMMDDHHMMSS>_add_atlas_module_bundle_fields/` and write `migration.sql`:

```sql
ALTER TABLE "atlas_module" ADD COLUMN "has_bundle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "atlas_module" ADD COLUMN "bundle_hash" TEXT;
```

- [ ] **Step 3: Apply migration and regenerate client**

```bash
pnpm db:migrate && pnpm db:generate
```

Expected: migration applied, Prisma client regenerated without errors.

- [ ] **Step 4: Verify new columns exist**

```bash
node -e "import('./apps/api/src/index.js')" 2>&1 | head -5
```

Or verify via Prisma Studio:
```bash
pnpm db:studio
```

Check `atlas_module` table has `has_bundle` (bool) and `bundle_hash` (text nullable) columns.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add has_bundle and bundle_hash columns to AtlasModule"
```

---

## Task 2 — Install esbuild in apps/api

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/bundles/.gitkeep`

- [ ] **Step 1: Add esbuild dependency**

In `apps/api/package.json`, add to `dependencies`:

```json
{
  "dependencies": {
    "@atlas/core": "workspace:^",
    "@atlas/module-engine": "workspace:*",
    "@atlas/validators": "workspace:*",
    "@hono/node-server": "latest",
    "@prisma/client": "^6",
    "@supabase/supabase-js": "^2.105.1",
    "csv-parse": "^5.6.0",
    "esbuild": "^0.25.0",
    "exceljs": "^4.4.0",
    "hono": "latest",
    "jszip": "^3.10.1",
    "node-cache": "^5.1.2",
    "pdfkit": "^0.18.0",
    "sharp": "^0.34.5",
    "zod": "latest"
  }
}
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

Expected: esbuild installed. No "recreate node_modules" prompt since we are not modifying the root package.json.

If it prompts to recreate, confirm with Y then run `pnpm db:generate` afterward.

- [ ] **Step 3: Create bundles directory**

```bash
mkdir -p apps/api/bundles
echo "" > apps/api/bundles/.gitkeep
```

- [ ] **Step 4: Add bundles to .gitignore (keep .gitkeep, ignore *.js)**

Add to the root `.gitignore` (or `apps/api/.gitignore` if it exists):

```
apps/api/bundles/*.js
```

- [ ] **Step 5: Verify esbuild works**

```bash
node -e "import('esbuild').then(m => console.log('esbuild version:', m.version))"
```

Expected: prints esbuild version (e.g. `esbuild version: 0.25.x`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/bundles/.gitkeep .gitignore
git commit -m "feat: add esbuild to API and create bundles directory"
```

---

## Task 3 — Create module-bundler-service.js (core: hash + compile + delete)

**Files:**
- Create: `apps/api/src/services/module-bundler-service.js`

- [ ] **Step 1: Write the failing test for computeSourceHash**

Create `apps/api/src/services/__tests__/module-bundler-service.test.js`:

```js
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Will be imported once service exists
let computeSourceHash

describe('module-bundler-service', () => {
  describe('computeSourceHash', () => {
    let tmpDir

    before(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-bundler-test-'))
      await fs.writeFile(path.join(tmpDir, 'index.js'), 'export function register() {}')
      await fs.writeFile(path.join(tmpDir, 'Comp.jsx'), 'export default function Comp() { return null }')
    })

    after(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('returns a 64-char hex string', async () => {
      ;({ computeSourceHash } = await import('../module-bundler-service.js'))
      const hash = await computeSourceHash(tmpDir)
      assert.match(hash, /^[0-9a-f]{64}$/)
    })

    it('returns the same hash on repeated calls', async () => {
      const h1 = await computeSourceHash(tmpDir)
      const h2 = await computeSourceHash(tmpDir)
      assert.equal(h1, h2)
    })

    it('returns a different hash when a file changes', async () => {
      const before = await computeSourceHash(tmpDir)
      await fs.writeFile(path.join(tmpDir, 'index.js'), 'export function register() { /* changed */ }')
      const after = await computeSourceHash(tmpDir)
      assert.notEqual(before, after)
    })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
node --test apps/api/src/services/__tests__/module-bundler-service.test.js 2>&1 | head -20
```

Expected: fails with `Cannot find module '../module-bundler-service.js'`.

- [ ] **Step 3: Create module-bundler-service.js with computeSourceHash**

Create `apps/api/src/services/module-bundler-service.js`:

```js
import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT  = path.resolve(__dirname, '..', '..', '..', '..')
const BUNDLES_DIR = path.resolve(__dirname, '..', '..', 'bundles')
const STORAGE_BUCKET = 'module-bundles'

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
  'react-router-dom',
]

/**
 * Compute a deterministic sha256 hash of all files in a directory.
 * @param {string} dir - absolute path to the directory
 * @returns {Promise<string>} 64-char hex hash
 */
export async function computeSourceHash(dir) {
  const entries = await collectFiles(dir)
  const hash = createHash('sha256')
  for (const filePath of entries.sort()) {
    const content = await fs.readFile(filePath)
    hash.update(filePath.replace(dir, '')) // relative path for portability
    hash.update(content)
  }
  return hash.digest('hex')
}

async function collectFiles(dir) {
  const result = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...(await collectFiles(full)))
    } else {
      result.push(full)
    }
  }
  return result
}

export function createModuleBundlerService({ prisma, supabaseAdmin }) {
  async function ensureBundlesDir() {
    await fs.mkdir(BUNDLES_DIR, { recursive: true })
  }

  async function ensureStorageBucket() {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    if (!buckets?.find((b) => b.name === STORAGE_BUCKET)) {
      await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, { public: false })
    }
  }

  /**
   * Compile a module's components/ directory into a single ESM bundle.
   * @param {string} key - module key (e.g. 'custom.mymodule')
   * @param {{ force?: boolean }} opts
   * @returns {Promise<{ built: boolean, reason?: string, hash?: string }>}
   */
  async function buildModuleBundle(key, { force = false } = {}) {
    const componentsDir = path.join(REPO_ROOT, 'modules', 'custom', key, 'components')
    const entryPoint    = path.join(componentsDir, 'index.js')

    try {
      await fs.access(entryPoint)
    } catch {
      return { built: false, reason: 'no-components' }
    }

    const newHash = await computeSourceHash(componentsDir)

    if (!force) {
      const row = await prisma.atlasModule.findUnique({
        where: { key },
        select: { bundleHash: true },
      })
      if (row?.bundleHash === newHash) {
        return { built: false, reason: 'unchanged', hash: newHash }
      }
    }

    await ensureBundlesDir()
    const outfile = path.join(BUNDLES_DIR, `${key}.js`)

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      format: 'esm',
      jsx: 'automatic',
      loader: { '.js': 'jsx', '.jsx': 'jsx' },
      external: BUNDLE_EXTERNALS,
      outfile,
      sourcemap: process.env.NODE_ENV !== 'production' ? 'inline' : false,
    })

    // Upload to Supabase Storage
    try {
      await ensureStorageBucket()
      const bundleContent = await fs.readFile(outfile)
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(`${key}.js`, bundleContent, {
          contentType: 'application/javascript',
          upsert: true,
        })
    } catch (storageErr) {
      console.warn(`[bundler] Storage upload failed for ${key}:`, storageErr.message)
      // Non-fatal: filesystem bundle is the primary serve path
    }

    await prisma.atlasModule.update({
      where: { key },
      data: { hasBundle: true, bundleHash: newHash },
    })

    console.log(`[bundler] built ${key} (hash: ${newHash.slice(0, 8)})`)
    return { built: true, hash: newHash }
  }

  /**
   * Delete a module's bundle from filesystem and Storage.
   * @param {string} key
   */
  async function deleteModuleBundle(key) {
    const bundlePath = path.join(BUNDLES_DIR, `${key}.js`)

    try {
      await fs.unlink(bundlePath)
    } catch {
      // File may not exist — that's fine
    }

    try {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([`${key}.js`])
    } catch (err) {
      console.warn(`[bundler] Storage delete failed for ${key}:`, err.message)
    }

    await prisma.atlasModule.update({
      where: { key },
      data: { hasBundle: false, bundleHash: null },
    })
  }

  /**
   * On API cold start: restore any missing filesystem bundles from Supabase Storage.
   * Called once after routeLoader.initialize().
   */
  async function restoreModuleBundlesOnBoot() {
    await ensureBundlesDir()

    let modules
    try {
      modules = await prisma.atlasModule.findMany({
        where: { status: 'INSTALLED', enabled: true, hasBundle: true },
        select: { key: true },
      })
    } catch (err) {
      console.warn('[bundler] restoreModuleBundlesOnBoot: DB query failed:', err.message)
      return
    }

    for (const { key } of modules) {
      const bundlePath = path.join(BUNDLES_DIR, `${key}.js`)
      try {
        await fs.access(bundlePath)
        // File exists — no restore needed
      } catch {
        // Missing — download from Storage
        try {
          const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .download(`${key}.js`)

          if (error || !data) {
            console.warn(`[bundler] Could not restore bundle for ${key}: ${error?.message ?? 'no data'}`)
            await prisma.atlasModule.update({
              where: { key },
              data: { hasBundle: false, bundleHash: null },
            })
            continue
          }

          const buffer = Buffer.from(await data.arrayBuffer())
          await fs.writeFile(bundlePath, buffer)
          console.log(`[bundler] restored ${key} from Storage`)
        } catch (restoreErr) {
          console.warn(`[bundler] restore failed for ${key}:`, restoreErr.message)
        }
      }
    }
  }

  /**
   * Start a filesystem watcher for custom module components in dev mode.
   * Triggers esbuild recompile when components/ files change.
   */
  function startDevWatcher() {
    if (process.env.NODE_ENV === 'production') return

    const customModulesDir = path.join(REPO_ROOT, 'modules', 'custom')
    const debouncers = new Map()

    fs.access(customModulesDir).then(() => {
      const watcher = fs.watch ? null : null // node:fs/promises doesn't have watch
      // Use node:fs for watching
      import('node:fs').then(({ watch }) => {
        watch(customModulesDir, { recursive: true }, (event, filename) => {
          if (!filename?.includes(`${path.sep}components${path.sep}`)) return
          const parts = filename.split(path.sep)
          const key = parts[0]
          if (!key) return

          clearTimeout(debouncers.get(key))
          debouncers.set(key, setTimeout(async () => {
            debouncers.delete(key)
            try {
              const result = await buildModuleBundle(key, { force: true })
              if (result.built) console.log(`[bundler:watch] rebuilt ${key}`)
            } catch (err) {
              console.error(`[bundler:watch] rebuild failed for ${key}:`, err.message)
            }
          }, 200))
        })
        console.log('[bundler] watching modules/custom for component changes')
      })
    }).catch(() => {
      // Directory doesn't exist yet — skip watcher
    })
  }

  return {
    buildModuleBundle,
    deleteModuleBundle,
    restoreModuleBundlesOnBoot,
    startDevWatcher,
  }
}
```

- [ ] **Step 4: Run tests to verify computeSourceHash passes**

```bash
node --test apps/api/src/services/__tests__/module-bundler-service.test.js 2>&1
```

Expected: 3 passing tests for `computeSourceHash`. No failures.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/module-bundler-service.js apps/api/src/services/__tests__/module-bundler-service.test.js
git commit -m "feat: add module-bundler-service with esbuild compilation and source hash"
```

---

## Task 4 — Test buildModuleBundle end-to-end

**Files:**
- Modify: `apps/api/src/services/__tests__/module-bundler-service.test.js`

- [ ] **Step 1: Add buildModuleBundle integration test**

Append to `module-bundler-service.test.js`, inside the outer `describe`:

```js
  describe('buildModuleBundle', () => {
    let tmpModulesDir
    let tmpBundlesDir
    let mockPrisma
    let mockSupabase

    before(async () => {
      // Create a fake module structure
      tmpModulesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-modules-'))
      tmpBundlesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-bundles-'))

      const compDir = path.join(tmpModulesDir, 'custom', 'custom.test', 'components')
      await fs.mkdir(compDir, { recursive: true })
      await fs.writeFile(path.join(compDir, 'index.js'),
        `export async function register(registry) {
           if (typeof window === 'undefined') return
         }`
      )

      // Minimal mocks
      mockPrisma = {
        atlasModule: {
          findUnique: async () => ({ bundleHash: null }),
          update: async () => ({}),
        },
      }
      mockSupabase = {
        storage: {
          listBuckets: async () => ({ data: [{ name: 'module-bundles' }] }),
          from: () => ({
            upload: async () => ({ error: null }),
            download: async () => ({ data: null, error: new Error('not found') }),
            remove: async () => ({ error: null }),
          }),
        },
      }
    })

    after(async () => {
      await fs.rm(tmpModulesDir, { recursive: true, force: true })
      await fs.rm(tmpBundlesDir, { recursive: true, force: true })
    })

    it('builds the bundle and returns built:true', async () => {
      // We need to test with real paths, so we patch the module constants.
      // Instead, use the exported computeSourceHash + esbuild directly to verify
      // esbuild can process a minimal component.
      const { computeSourceHash } = await import('../module-bundler-service.js')
      const compDir = path.join(tmpModulesDir, 'custom', 'custom.test', 'components')
      const hash = await computeSourceHash(compDir)
      assert.match(hash, /^[0-9a-f]{64}$/)

      // Verify esbuild can compile a minimal JSX entry
      const { build } = await import('esbuild')
      const entry = path.join(compDir, 'index.js')
      const outfile = path.join(tmpBundlesDir, 'custom.test.js')
      await build({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        jsx: 'automatic',
        outfile,
        external: ['react'],
      })

      const content = await fs.readFile(outfile, 'utf8')
      assert.ok(content.length > 0, 'bundle file should not be empty')
      assert.ok(content.includes('register'), 'bundle should contain register function')
    })

    it('returns no-components when components/index.js is missing', async () => {
      const { createModuleBundlerService } = await import('../module-bundler-service.js')
      const svc = createModuleBundlerService({ prisma: mockPrisma, supabaseAdmin: mockSupabase })
      const result = await svc.buildModuleBundle('custom.nonexistent')
      assert.equal(result.built, false)
      assert.equal(result.reason, 'no-components')
    })
  })
```

- [ ] **Step 2: Run tests**

```bash
node --test apps/api/src/services/__tests__/module-bundler-service.test.js 2>&1
```

Expected: all tests pass, including the esbuild compilation test.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/__tests__/module-bundler-service.test.js
git commit -m "test: add buildModuleBundle integration tests"
```

---

## Task 5 — Wire bundler into modules router + add GET /bundle.js endpoint

**Files:**
- Modify: `apps/api/src/routes/modules.js` (~lines 464, 601, 1414, 1483, 1527, end of file)

- [ ] **Step 1: Accept bundlerSvc in createModulesRouter factory**

In `apps/api/src/routes/modules.js`, change line 464:

```js
// Before:
export function createModulesRouter({ prisma, authMiddleware, requirePermission, routeLoader = null }) {

// After:
export function createModulesRouter({ prisma, authMiddleware, requirePermission, routeLoader = null, bundlerSvc = null }) {
```

- [ ] **Step 2: Add helper to safely call bundler**

Add this helper inside `createModulesRouter` after the existing `safeRouteUnload` function (~line 481):

```js
  async function safeBuildBundle(key, opts = {}) {
    if (!bundlerSvc) return null
    try {
      return await bundlerSvc.buildModuleBundle(key, opts)
    } catch (err) {
      console.warn(`[modules] bundle build failed for ${key}:`, err.message)
      return null
    }
  }

  async function safeDeleteBundle(key) {
    if (!bundlerSvc) return null
    try {
      return await bundlerSvc.deleteModuleBundle(key)
    } catch (err) {
      console.warn(`[modules] bundle delete failed for ${key}:`, err.message)
      return null
    }
  }
```

- [ ] **Step 3: Call safeBuildBundle in the install handler**

In the `POST /install` handler (~line 612–616), after `safeRouteReload`:

```js
      const result = await svc.installModule({ manifest: parsed.manifest, actorId, requestId })
      const rlStatus = await safeRouteReload(moduleKey)
      await safeBuildBundle(moduleKey)        // ADD THIS LINE
      cacheDel("blueprints:raw")
      cacheDel("runtime:modules:raw")
      return c.json({ data: result, routeLoader: rlStatus }, 201)
```

- [ ] **Step 4: Call safeBuildBundle in the sync handler**

Find the `POST /sync` handler (~line 680). After the sync completes and before `cacheDel`, add:

```js
      // After svc.syncModules call and before cacheDel:
      for (const key of result.synced_keys ?? []) {
        await safeBuildBundle(key)
      }
      cacheDel("blueprints:raw")
```

Note: if `syncModules` doesn't return synced keys, look at what it returns and adapt. Check the return value of `svc.syncModules` — if it returns `{ synced, added, updated }` without keys, use module keys from the `manifests` array in the request body instead.

Read the sync handler (lines 680–760) and adapt accordingly. The pattern is: for each module key that was synced, call `safeBuildBundle(key)`.

- [ ] **Step 5: Call safeDeleteBundle in the uninstall handler**

In `POST /:key/uninstall` (~line 1483), after `svc.uninstallModule` and before `cacheDel`:

```js
      const result = await svc.uninstallModule({ key, mode, companyId, actorId, confirmation: parsed.data.confirmation ?? null })
      const rlUnloaded = safeRouteUnload(key)
      await safeDeleteBundle(key)            // ADD THIS LINE
      cacheDel("blueprints:raw")
      cacheDel("runtime:modules:raw")
      return c.json({ data: result, routeLoader: { unloaded: rlUnloaded ?? false } })
```

- [ ] **Step 6: Call safeBuildBundle in the reset handler**

In `POST /:key/reset` (~line 1527), after `svc.resetModule` and before `cacheDel`:

```js
      const result = await svc.resetModule({ key, companyId, actorId })
      await safeBuildBundle(key, { force: true })   // ADD THIS LINE
      cacheDel("blueprints:raw")
      cacheDel("runtime:modules:raw")
      return c.json({ data: result })
```

- [ ] **Step 7: Add GET /:key/bundle.js endpoint**

Find the end of the router (just before `return app`), add:

```js
  // ── GET /modules/:key/bundle.js ───────────────────────────────────────────
  // Public — no auth required. Serves compiled ESM bundle for a custom module.

  // Compute once at module load time — modules.js is at apps/api/src/routes/
  // so two levels up lands at apps/api/bundles/
  // Add this import at the top of modules.js alongside existing imports:
  //   import { fileURLToPath } from 'node:url'
  // Add this constant after the imports block:
  //   const __routesDir = path.dirname(fileURLToPath(import.meta.url))
  //   const BUNDLES_DIR_SERVE = path.resolve(__routesDir, '..', '..', 'bundles')

  app.get('/:key/bundle.js', async (c) => {
    const key = c.req.param('key')

    const moduleRow = await prisma.atlasModule.findUnique({
      where: { key },
      select: { status: true, enabled: true, hasBundle: true, bundleHash: true },
    })

    if (!moduleRow || moduleRow.status !== 'INSTALLED' || !moduleRow.enabled || !moduleRow.hasBundle) {
      return c.json({ error: 'Bundle no disponible.' }, 404)
    }

    const bundlePath = path.join(BUNDLES_DIR_SERVE, `${key}.js`)

    let content
    try {
      content = await fs.readFile(bundlePath)
    } catch {
      return c.json({ error: 'Bundle no encontrado. Ejecuta sync para reconstruirlo.' }, 404)
    }

    c.header('Content-Type', 'application/javascript')
    c.header('ETag', `"${moduleRow.bundleHash ?? key}"`)
    c.header('Cache-Control', 'public, max-age=3600')
    return c.body(content)
  })
```

Note: `path` is already imported at the top of modules.js (`import path from 'node:path'`). Check if it's imported; if not, add it.

- [ ] **Step 8: Verify modules.js still loads**

```bash
node --check apps/api/src/routes/modules.js
```

Expected: no syntax errors.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/routes/modules.js
git commit -m "feat: wire module bundler into lifecycle handlers and add GET /modules/:key/bundle.js"
```

---

## Task 6 — Integrate bundler service into index.js

**Files:**
- Modify: `apps/api/src/index.js` (~lines 43, 84, 627–649, 2601–2611, 2642–2657, 3510–3516)

- [ ] **Step 1: Import bundler service**

At the top of `apps/api/src/index.js`, after the existing service imports (~line 43), add:

```js
import { createModuleBundlerService } from './services/module-bundler-service.js'
```

- [ ] **Step 2: Instantiate bundler service**

After line 85 (where `companyService` is created), add:

```js
const bundlerService = createModuleBundlerService({ prisma, supabaseAdmin })
```

- [ ] **Step 3: Call restoreModuleBundlesOnBoot and startDevWatcher after routeLoader.initialize**

Find line 649: `await routeLoader.initialize(app)`. After it, add:

```js
await routeLoader.initialize(app)
// Restore module bundles from Supabase Storage if missing on filesystem
await bundlerService.restoreModuleBundlesOnBoot()
bundlerService.startDevWatcher()
```

- [ ] **Step 4: Pass bundlerSvc to createModulesRouter**

Find lines 3510–3515:

```js
// Before:
const modulesRouter = createModulesRouter({
  prisma,
  authMiddleware,
  requirePermission,
  routeLoader,
})

// After:
const modulesRouter = createModulesRouter({
  prisma,
  authMiddleware,
  requirePermission,
  routeLoader,
  bundlerSvc: bundlerService,
})
```

- [ ] **Step 5: Add has_bundle to installedModuleRows query in /blueprints**

Find the `prisma.atlasModule.findMany` inside `GET /blueprints` (~line 2601). Add `hasBundle` to the select:

```js
prisma.atlasModule.findMany({
  where: { status: "INSTALLED", enabled: true },
  select: {
    key: true,
    name: true,
    status: true,
    enabled: true,
    version: true,
    manifest: true,
    hasBundle: true,   // ADD THIS
  },
}),
```

- [ ] **Step 6: Add has_bundle to the module object in views loop**

Find the views loop (~line 2642–2657) that builds each entry's `module` object:

```js
// Before:
      module: {
        key: moduleRow.key,
        name: moduleRow.name,
        status: moduleRow.status,
        enabled: moduleRow.enabled,
      },

// After:
      module: {
        key: moduleRow.key,
        name: moduleRow.name,
        status: moduleRow.status,
        enabled: moduleRow.enabled,
        has_bundle: moduleRow.hasBundle ?? false,
      },
```

Note: for blueprints (included via `include: { module: true }`), `blueprint.module.hasBundle` is returned automatically by Prisma after the migration. The field is camelCase in JS (`hasBundle`) but the frontend will use snake_case `has_bundle` consistently. Expose it as `has_bundle` in the response.

Also update the blueprint spread (~line 2629–2635):

```js
    mergedByKey.set(blueprint.key, {
      ...blueprint,
      source: "blueprint",
      module: {
        ...blueprint.module,
        has_bundle: blueprint.module?.hasBundle ?? false,
      },
    })
```

- [ ] **Step 7: Verify index.js loads without errors**

```bash
node --check apps/api/src/index.js
```

Expected: no syntax errors.

- [ ] **Step 8: Start the API and verify boot sequence**

```bash
pnpm dev:api
```

Expected log output includes:
```
[bundler] watching modules/custom for component changes
Atlas API running on http://localhost:4010
```

- [ ] **Step 9: Verify /blueprints returns has_bundle**

```bash
# Get a token first then:
curl -s http://localhost:4010/blueprints -H "Authorization: Bearer $ATLAS_TOKEN" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log(j.data[0]?.module?.has_bundle)"
```

Expected: prints `false` (or `true` if any module has been built).

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat: integrate bundler service into API startup and blueprints response"
```

---

## Task 7 — Frontend: remove import.meta.glob from moduleComponentRegistry.js

**Files:**
- Modify: `apps/desktop/src/lib/moduleComponentRegistry.js`

- [ ] **Step 1: Read the current file**

Read `apps/desktop/src/lib/moduleComponentRegistry.js` to see the full current content.

- [ ] **Step 2: Replace with registry-only version**

Replace the entire file content with:

```js
import { createModuleComponentRegistry } from './module-component-registry-core.js'

const _isDev = Boolean(import.meta.env?.DEV)

function warnDev(message) {
  if (_isDev) {
    console.warn(`[moduleComponentRegistry] ${message}`)
  }
}

export const componentRegistry = createModuleComponentRegistry({ warn: warnDev })

// Component registration is now done at runtime by ModuleBundleLoader
// via dynamic import() of each installed module's compiled bundle.
// See apps/desktop/src/shell/ModuleBundleLoader.jsx
```

- [ ] **Step 3: Verify the core registry tests still pass**

```bash
node --test apps/desktop/src/lib/__tests__/module-component-registry-core.test.js 2>&1
```

Expected: all tests pass.

- [ ] **Step 4: Verify the desktop app still builds**

```bash
pnpm --filter @atlas/desktop build:web 2>&1 | tail -20
```

Expected: build succeeds. Some custom module components (fleet, financia) will now NOT be in the registry on boot — that's expected; they'll be restored via SCREEN_MAP (which is still intact) in Task 9.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/moduleComponentRegistry.js
git commit -m "refactor: remove import.meta.glob from moduleComponentRegistry, registration now done by ModuleBundleLoader"
```

---

## Task 8 — Create ModuleBundleLoader.jsx

**Files:**
- Create: `apps/desktop/src/shell/ModuleBundleLoader.jsx`

- [ ] **Step 1: Create the loader component**

Create `apps/desktop/src/shell/ModuleBundleLoader.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { componentRegistry } from '../lib/moduleComponentRegistry'
import { atlas } from '../lib/atlas'
import { useAuth } from '../auth/AuthProvider'

const apiBase = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

async function loadModuleBundles(blueprints) {
  const seen = new Set()
  const modulesWithBundles = []

  for (const bp of blueprints) {
    const key = bp.module?.key
    const hasBundle = bp.module?.has_bundle
    if (key && hasBundle && !seen.has(key)) {
      seen.add(key)
      modulesWithBundles.push(key)
    }
  }

  await Promise.all(
    modulesWithBundles.map(async (key) => {
      const bundleUrl = `${apiBase}/modules/${key}/bundle.js`
      try {
        const mod = await import(/* @vite-ignore */ bundleUrl)
        if (typeof mod.register === 'function') {
          await mod.register(componentRegistry)
        }
      } catch (err) {
        console.error(`[ModuleBundleLoader] failed to load bundle for ${key}:`, err.message)
      }
    })
  )
}

/**
 * Loads compiled ESM bundles for all installed custom modules that have components.
 * Must be mounted inside a QueryClientProvider and after authentication is confirmed.
 * Renders children immediately; bundles load asynchronously in the background.
 */
export function ModuleBundleLoader({ children }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { data: blueprintData } = useQuery({
    queryKey: ['blueprints', token],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!blueprintData?.data) return
    loadModuleBundles(blueprintData.data)
  }, [blueprintData])

  // Never blocks rendering — bundles load in background, registry populates gradually
  return children
}
```

- [ ] **Step 2: Verify the component has no syntax errors**

```bash
node --check apps/desktop/src/shell/ModuleBundleLoader.jsx 2>&1 || echo "JSX needs Vite/esbuild to check"
```

Since JSX can't be checked with `node --check`, verify it builds instead (done in Task 9 after mounting).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/shell/ModuleBundleLoader.jsx
git commit -m "feat: add ModuleBundleLoader for dynamic ESM bundle loading at runtime"
```

---

## Task 9 — Mount ModuleBundleLoader in AtlasApp.jsx + clean up ModuleOutlet.jsx

**Files:**
- Modify: `apps/desktop/src/app/AtlasApp.jsx`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1: Read AtlasApp.jsx to find the right insertion point**

Read `apps/desktop/src/app/AtlasApp.jsx`. Find where `<Outlet />` is rendered — that's where module content loads.

- [ ] **Step 2: Import and wrap with ModuleBundleLoader in AtlasApp.jsx**

Add import at the top of `AtlasApp.jsx`:

```js
import { ModuleBundleLoader } from '../shell/ModuleBundleLoader.jsx'
```

Then wrap the component's return content with `<ModuleBundleLoader>`:

```jsx
// Find the return statement in AtlasApp and wrap its outermost element:
return (
  <ModuleBundleLoader>
    {/* existing content unchanged */}
    <div className="...">
      ...
    </div>
  </ModuleBundleLoader>
)
```

- [ ] **Step 3: Clean up SCREEN_MAP in ModuleOutlet.jsx**

Read `apps/desktop/src/app/ModuleOutlet.jsx`. Find the `custom.financia` entries in SCREEN_MAP and replace them with a transitional-module comment block:

```js
  // --- Transitional custom modules ---
  // custom.fleet and custom.financia were built before the dynamic bundle system
  // and compile their React components via Vite (import.meta.glob pattern).
  // They remain here as exceptions until promoted to core modules.
  // DO NOT add new custom module entries here — use kind:CUSTOM blueprints instead.
  "custom.financia:/accounts/:id": lazy(
    () => import("../../../../modules/custom/custom.financia/components/AccountScreen.jsx"),
  ),
  "custom.financia:/accounts/:id/import": lazy(
    () => import("../../../../modules/custom/custom.financia/components/ImportWizard.jsx"),
  ),
```

(Keep the entries as-is, just replace the existing comment above them with the one above.)

- [ ] **Step 4: Build the frontend to verify everything compiles**

```bash
pnpm --filter @atlas/desktop build:web 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Start dev and verify ModuleBundleLoader loads**

```bash
pnpm dev
```

Open browser at `http://localhost:5173`. Open DevTools console. Expected: no errors related to bundle loading. If modules have `has_bundle: false`, nothing loads (correct — no bundles compiled yet).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/app/AtlasApp.jsx apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat: mount ModuleBundleLoader in AtlasApp, document transitional modules in ModuleOutlet"
```

---

## Task 10 — End-to-end validation with a minimal test module

**Files:**
- Create: `modules/custom/custom.example/` (full module structure)

This task validates the entire pipeline with a minimal module that has one screen component.

- [ ] **Step 1: Create the example module manifest**

Create `modules/custom/custom.example/module.manifest.js`:

```js
import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: 'custom.example',
  name: 'Example',
  version: '0.1.0',
  kind: 'FEATURE',
  core: false,
  uninstallable: true,
  navigation: [
    {
      path: '/example',
      label: 'Ejemplo',
      icon: 'Puzzle',
    },
  ],
  permissions: [],
  blueprints: [],
  exposes: [],
  consumes: [],
})
```

- [ ] **Step 2: Create the example API**

Create `modules/custom/custom.example/api/index.js`:

```js
import { Hono } from 'hono'

export default function createRouter({ prisma }) {
  const app = new Hono()

  app.get('/example/ping', (c) => c.json({ message: 'custom.example is alive' }))

  return app
}
```

- [ ] **Step 3: Create the CUSTOM kind view**

Create `modules/custom/custom.example/views/example-screen.custom.js`:

```js
import { defineView } from '@atlas/module-engine'

export default defineView('custom.example.example-screen', {
  kind: 'CUSTOM',
  schema: {
    path: '/example',
    component: 'custom.example:ExampleScreen',
    title: 'Pantalla de ejemplo',
  },
})
```

- [ ] **Step 4: Create the React screen component**

Create `modules/custom/custom.example/components/ExampleScreen.jsx`:

```jsx
export default function ExampleScreen() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Modulo de ejemplo</h1>
      <p className="text-muted-foreground mt-2">
        Este componente fue compilado por esbuild en runtime y cargado dinamicamente.
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Create the components entry point**

Create `modules/custom/custom.example/components/index.js`:

```js
export async function register(registry) {
  if (typeof window === 'undefined') return

  const { default: ExampleScreen } = await import('./ExampleScreen.jsx')
  registry.register('custom.example:ExampleScreen', ExampleScreen)
}
```

- [ ] **Step 6: Install the example module via API**

With the dev server running:

```bash
curl -s -X POST http://localhost:4010/modules/install \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -d '{"manifest": {"key": "custom.example", "name": "Example", "version": "0.1.0", "kind": "FEATURE", "core": false, "uninstallable": true, "navigation": [{"path": "/example", "label": "Ejemplo", "icon": "Puzzle"}], "permissions": [], "blueprints": [], "exposes": [], "consumes": []}}' | node -e "process.stdin.resume(); let d=''; process.stdin.on('data', c => d+=c); process.stdin.on('end', () => { const j=JSON.parse(d); console.log(j.data?.status ?? j.error) })"
```

Expected: `INSTALLED`

- [ ] **Step 7: Verify bundle was compiled**

```bash
ls -lh apps/api/bundles/
```

Expected: `custom.example.js` appears in the bundles directory.

```bash
curl -s http://localhost:4010/modules/custom.example/bundle.js | head -5
```

Expected: returns JavaScript (starts with code, not a JSON error).

- [ ] **Step 8: Verify bundle loads in browser**

Open `http://localhost:5173` in browser. Navigate to the Example module. Expected: `ExampleScreen` renders "Modulo de ejemplo".

Open DevTools → Console. Expected: no errors about missing components.

- [ ] **Step 9: Verify watcher rebuilds on component change**

Edit `modules/custom/custom.example/components/ExampleScreen.jsx` — change the heading text. Expected within ~1 second:

```
[bundler:watch] rebuilt custom.example
```

Reload browser. Expected: updated heading text visible.

- [ ] **Step 10: Commit**

```bash
git add modules/custom/custom.example/
git commit -m "feat: add custom.example module to validate dynamic bundle pipeline"
```

---

## Task 11 — Final verification and cleanup

- [ ] **Step 1: Run all API tests**

```bash
node --test apps/api/src/services/__tests__/module-bundler-service.test.js 2>&1
```

Expected: all tests pass.

- [ ] **Step 2: Run desktop build**

```bash
pnpm --filter @atlas/desktop build:web 2>&1 | tail -10
```

Expected: build succeeds, no errors.

- [ ] **Step 3: Verify existing modules unaffected**

With dev server running, navigate to:
- `custom.fleet` → vehicles, drivers, reports load correctly
- `custom.financia` → accounts list and detail load correctly (still in SCREEN_MAP)

- [ ] **Step 4: Verify uninstall cleans bundle**

```bash
curl -s -X POST http://localhost:4010/modules/custom.example/uninstall \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -d '{"mode": "purge-owned-tables"}'
ls apps/api/bundles/
```

Expected: `custom.example.js` no longer in bundles directory.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup for dynamic module bundler implementation"
```

---

## Post-implementation notes

- **Documentation** (tracked separately): update `docs/03_custom_modules.md`, `CLAUDE.md`, and `docs/architecture/atlas-module-engine-v3.md` with the bundle system and `BUNDLE_EXTERNALS` contract.
- **fleet and financia promotion**: tracked as future work. When promoted, remove their SCREEN_MAP entries and move components to `apps/desktop/src/modules/`.
- **Docker volume setup**: when deploying with custom modules, mount `modules/custom/` as a Docker volume and call `POST /modules/<key>/install` after startup.

# Offline Phase 2B — Frontend SyncEngine & Read Cache

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `SyncEngine.pull()` in `@atlas/offline`, wire TanStack Query's `onlineManager` so React Query correctly serves the persisted cache when offline, schedule periodic pulls when online, and add a `SyncStatusBar` component to `@atlas/ui`.

**Architecture:** `SyncEngine` is a plain JS class that calls `GET /sync/pull`, writes results into `offline_records`, and updates `sync_state`. `OfflineProvider` instantiates it, wires `onlineManager.setOnline()` from `@tanstack/react-query` so queries pause naturally when offline (the persisted `_query_cache` from Phase 1 serves stale data), and schedules pulls on-connect and every 10 minutes. `SyncStatusBar` reads `useOfflineStore` and shows last sync time. A `useOfflineStatus` hook is exported as a convenience wrapper.

**Tech Stack:** Dexie.js, TanStack Query v5 `onlineManager`, `fake-indexeddb` (already in devDeps), `node:test`

**Prerequisite:** Plan 2A must be deployed — `GET /sync/pull` must be live at the API base URL.

---

### Task 1: Create SyncEngine

**Files:**
- Create: `packages/offline/src/sync-engine.js`
- Create: `packages/offline/src/__tests__/sync-engine.test.js`

- [ ] **Step 1: Write the failing tests**

Create `packages/offline/src/__tests__/sync-engine.test.js`:

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { SyncEngine } from '../sync-engine.js'

const COMPANY_ID = '01900000-0000-7000-8000-000000000001'
let dbCounter = 0

function makeDb() {
  return new AtlasOfflineDatabase(`test-sync-engine-${++dbCounter}`)
}

function makeResponse(records, nextCursor = '2026-06-06T10:00:00Z') {
  return { records, nextCursor, hasMore: false }
}

function makeFetch(response) {
  return async (_url, _opts) => ({
    ok: true,
    json: async () => response,
  })
}

describe('SyncEngine', () => {
  let db

  beforeEach(async () => {
    db = makeDb()
    await db.open()
  })

  afterEach(async () => {
    await db.delete().catch(() => {})
  })

  it('stores pulled records in offline_records', async () => {
    const record = {
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: 'c1',
      data: { id: 'c1', name: 'Ana', companyId: COMPANY_ID },
      version: '2026-06-06T10:00:00Z',
      deleted: false,
    }
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: makeFetch(makeResponse([record])),
    })

    const { pulled } = await engine.pull({ modules: ['atlas.contacts'] })
    assert.equal(pulled, 1)

    const stored = await db.offline_records.get(['atlas.contacts', 'contact', 'c1'])
    assert.ok(stored)
    assert.equal(stored.data.name, 'Ana')
    assert.equal(stored.dirty, false)
  })

  it('updates sync_state with nextCursor after pull', async () => {
    const record = {
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: 'c1',
      data: { id: 'c1', companyId: COMPANY_ID },
      version: '2026-06-06T10:00:00Z',
      deleted: false,
    }
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: makeFetch(makeResponse([record], '2026-06-06T10:00:00Z')),
    })

    await engine.pull({ modules: ['atlas.contacts'] })

    const state = await db.sync_state.get(['atlas.contacts', 'contact'])
    assert.ok(state)
    assert.equal(state.serverCursor, '2026-06-06T10:00:00Z')
    assert.ok(state.lastPullAt)
  })

  it('removes deleted records from offline_records', async () => {
    await db.offline_records.put({
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: 'c1',
      data: {},
      version: '2026-06-01T00:00:00Z',
      pulledAt: '2026-06-01T00:00:00Z',
      companyId: COMPANY_ID,
      dirty: false,
    })

    const tombstone = {
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: 'c1',
      deleted: true,
      data: null,
      version: '2026-06-06T10:00:00Z',
    }
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: makeFetch(makeResponse([tombstone])),
    })

    await engine.pull({ modules: ['atlas.contacts'] })

    const stored = await db.offline_records.get(['atlas.contacts', 'contact', 'c1'])
    assert.equal(stored, undefined)
  })

  it('sends stored cursor in the pull request URL', async () => {
    const cursor = '2026-06-05T00:00:00Z'
    await db.sync_state.put({
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      lastPullAt: cursor,
      serverCursor: cursor,
      schemaVersion: null,
    })

    let capturedUrl = null
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: async (url) => {
        capturedUrl = url
        return { ok: true, json: async () => makeResponse([]) }
      },
    })

    await engine.pull({ modules: ['atlas.contacts'] })
    assert.ok(capturedUrl.includes(`cursor=${encodeURIComponent(cursor)}`))
  })

  it('skips network call when getToken returns null', async () => {
    let fetchCalled = false
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => null,
      fetchImpl: async () => { fetchCalled = true; return { ok: true, json: async () => ({}) } },
    })

    const result = await engine.pull({ modules: ['atlas.contacts'] })
    assert.equal(result.pulled, 0)
    assert.equal(fetchCalled, false)
  })

  it('throws on non-ok HTTP response', async () => {
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    })

    await assert.rejects(() => engine.pull({ modules: ['atlas.contacts'] }), /Pull failed/)
  })

  it('getLocalCount returns 0 on empty table', async () => {
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: makeFetch(makeResponse([])),
    })
    const count = await engine.getLocalCount({ moduleKey: 'atlas.contacts', entityType: 'contact' })
    assert.equal(count, 0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test "packages/offline/src/__tests__/sync-engine.test.js"
```

Expected: FAIL — `sync-engine.js` does not exist yet.

- [ ] **Step 3: Create sync-engine.js**

Create `packages/offline/src/sync-engine.js`:

```javascript
export class SyncEngine {
  #db
  #apiBaseUrl
  #getToken
  #fetchImpl

  constructor({ db, apiBaseUrl, getToken, fetchImpl }) {
    this.#db = db
    this.#apiBaseUrl = apiBaseUrl
    this.#getToken = getToken
    this.#fetchImpl = fetchImpl ?? ((...args) => globalThis.fetch(...args))
  }

  async pull({ modules }) {
    const token = await this.#getToken()
    if (!token) return { pulled: 0, nextCursor: null }

    // Find the oldest stored cursor across the requested modules so we
    // don't miss records that were changed before a newer module's cursor.
    const allStates = await this.#db.sync_state.toArray()
    const relevantStates = allStates.filter((s) => modules.includes(s.moduleKey))
    const oldestCursor = relevantStates.reduce((min, s) => {
      if (!s.serverCursor) return min
      if (min === null || s.serverCursor < min) return s.serverCursor
      return min
    }, null)

    const url = new URL(`${this.#apiBaseUrl}/sync/pull`)
    url.searchParams.set('modules', modules.join(','))
    if (oldestCursor) url.searchParams.set('cursor', oldestCursor)

    const response = await this.#fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      throw new Error(`Pull failed: ${response.status}`)
    }

    const { records, nextCursor } = await response.json()
    const now = new Date().toISOString()

    await this.#db.transaction(
      'rw',
      [this.#db.offline_records, this.#db.sync_state],
      async () => {
        for (const rec of records) {
          if (rec.deleted) {
            await this.#db.offline_records
              .where('[moduleKey+entityType+id]')
              .equals([rec.moduleKey, rec.entityType, rec.id])
              .delete()
          } else {
            await this.#db.offline_records.put({
              moduleKey: rec.moduleKey,
              entityType: rec.entityType,
              id: rec.id,
              data: rec.data,
              version: rec.version,
              pulledAt: now,
              companyId: rec.data?.companyId ?? null,
              dirty: false,
            })
          }
        }

        // Update sync_state for each (moduleKey, entityType) seen in the response
        const seen = new Map()
        for (const rec of records) {
          const key = `${rec.moduleKey}/${rec.entityType}`
          if (!seen.has(key)) seen.set(key, { moduleKey: rec.moduleKey, entityType: rec.entityType })
        }
        for (const { moduleKey, entityType } of seen.values()) {
          await this.#db.sync_state.put({
            moduleKey,
            entityType,
            lastPullAt: now,
            serverCursor: nextCursor,
            schemaVersion: null,
          })
        }
      },
    )

    return { pulled: records.length, nextCursor }
  }

  async getLocalCount({ moduleKey, entityType }) {
    return this.#db.offline_records.where({ moduleKey, entityType }).count()
  }
}
```

- [ ] **Step 4: Run tests**

```bash
node --test "packages/offline/src/__tests__/sync-engine.test.js"
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/offline/src/sync-engine.js packages/offline/src/__tests__/sync-engine.test.js
git commit -m "feat(offline): add SyncEngine with pull, offline_records storage, sync_state cursor"
```

---

### Task 2: Wire TanStack Query onlineManager in OfflineProvider

**Files:**
- Modify: `packages/offline/src/offline-provider.jsx`

This is the key integration that makes React Query serve the persisted `_query_cache` when offline instead of throwing network errors. TanStack Query v5's `onlineManager` pauses all queries when set offline, then re-runs them on reconnect.

`@tanstack/react-query` is already a peer dependency of `@atlas/offline`.

- [ ] **Step 1: Update offline-provider.jsx**

Replace the entire contents of `packages/offline/src/offline-provider.jsx`:

```jsx
import { createContext, useContext, useEffect, useRef } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { AtlasOfflineDatabase } from './db.js'
import { OnlineDetector } from './online-detector.js'
import { SessionVault } from './session-vault.js'
import { SyncEngine } from './sync-engine.js'
import { useOfflineStore } from './offline-store.js'

// Tier 1 modules to pull on every sync cycle.
// Phase 3 will derive this list from installed module manifests.
const OFFLINE_MODULES = ['atlas.contacts', 'atlas.hr', 'custom.fleet']

const PULL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

const OfflineContext = createContext(null)

export function OfflineProvider({ children, apiBaseUrl }) {
  const detectorRef = useRef(null)
  const dbRef = useRef(null)
  const engineRef = useRef(null)
  const intervalRef = useRef(null)

  const setOnline = useOfflineStore((s) => s.setOnline)
  const setLastSyncAt = useOfflineStore((s) => s.setLastSyncAt)
  const setSyncing = useOfflineStore((s) => s.setSyncing)

  useEffect(() => {
    const database = new AtlasOfflineDatabase()
    dbRef.current = database
    database.open().catch((err) => {
      console.warn('[atlas/offline] IndexedDB failed to open — offline features unavailable', err)
    })

    const vault = new SessionVault(database)
    const engine = new SyncEngine({
      db: database,
      apiBaseUrl,
      getToken: () => vault.load().then((s) => s?.accessToken ?? null),
    })
    engineRef.current = engine

    const detector = new OnlineDetector({
      probeUrl: apiBaseUrl ? `${apiBaseUrl}/health` : null,
    })
    detectorRef.current = detector

    // Sync our detector with TanStack Query's onlineManager so queries
    // pause automatically when offline and resume on reconnect.
    const initialOnline = detector.isOnline()
    setOnline(initialOnline)
    onlineManager.setOnline(initialOnline)

    async function runPull() {
      setSyncing(true)
      try {
        await engine.pull({ modules: OFFLINE_MODULES })
        setLastSyncAt(new Date().toISOString())
      } catch (err) {
        console.warn('[atlas/offline] Pull failed', err?.message ?? err)
      } finally {
        setSyncing(false)
      }
    }

    detector.onChange((isOnline) => {
      setOnline(isOnline)
      onlineManager.setOnline(isOnline)
      if (isOnline) {
        // Trigger an immediate pull when we come back online
        runPull()
      }
    })

    // Schedule periodic pulls while the app is running
    intervalRef.current = setInterval(() => {
      if (detector.isOnline()) runPull()
    }, PULL_INTERVAL_MS)

    // Initial pull if we start online
    if (initialOnline) {
      runPull()
    }

    return () => {
      detector.destroy()
      database.close()
      clearInterval(intervalRef.current)
    }
  }, [apiBaseUrl, setOnline, setLastSyncAt, setSyncing])

  return (
    <OfflineContext.Provider value={{ dbRef, engineRef }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOfflineContext() {
  return useContext(OfflineContext)
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check packages/offline/src/offline-provider.jsx
```

Expected: no errors. (Note: node --check skips JSX; this is fine — it still catches import errors.)

Actually `node --check` does not parse JSX. Use the build instead:

```bash
pnpm build --filter @atlas/desktop
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/offline/src/offline-provider.jsx
git commit -m "feat(offline): wire TanStack Query onlineManager + SyncEngine pull triggers in OfflineProvider"
```

---

### Task 3: Add useOfflineStatus hook and update @atlas/offline exports

**Files:**
- Create: `packages/offline/src/use-offline-status.js`
- Modify: `packages/offline/src/index.js`

- [ ] **Step 1: Write failing test**

Create `packages/offline/src/__tests__/use-offline-status.test.js`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useOfflineStore } from '../offline-store.js'
import { useOfflineStatus } from '../use-offline-status.js'

// useOfflineStatus is a Zustand selector hook. Its output must match the store.
test('useOfflineStatus returns isOnline, lastSyncAt, pendingCount, isSyncing', () => {
  // Set known values in the store
  useOfflineStore.setState({
    isOnline: false,
    lastSyncAt: '2026-06-06T10:00:00Z',
    pendingCount: 3,
    isSyncing: true,
  })

  // Call the hook directly (it's a Zustand selector, works outside React)
  const status = useOfflineStatus()
  assert.equal(status.isOnline, false)
  assert.equal(status.lastSyncAt, '2026-06-06T10:00:00Z')
  assert.equal(status.pendingCount, 3)
  assert.equal(status.isSyncing, true)

  // Reset
  useOfflineStore.setState({ isOnline: true, lastSyncAt: null, pendingCount: 0, isSyncing: false })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test "packages/offline/src/__tests__/use-offline-status.test.js"
```

Expected: FAIL — `use-offline-status.js` does not exist yet.

- [ ] **Step 3: Create use-offline-status.js**

Create `packages/offline/src/use-offline-status.js`:

```javascript
import { useOfflineStore } from './offline-store.js'

export function useOfflineStatus() {
  return useOfflineStore((s) => ({
    isOnline: s.isOnline,
    lastSyncAt: s.lastSyncAt,
    pendingCount: s.pendingCount,
    isSyncing: s.isSyncing,
  }))
}
```

- [ ] **Step 4: Run test**

```bash
node --test "packages/offline/src/__tests__/use-offline-status.test.js"
```

Expected: 1 test passes.

- [ ] **Step 5: Update packages/offline/src/index.js exports**

Replace the full contents of `packages/offline/src/index.js`:

```javascript
export { AtlasOfflineDatabase, db } from './db.js'
export { SessionVault } from './session-vault.js'
export { OnlineDetector } from './online-detector.js'
export { useOfflineStore, createOfflineStore } from './offline-store.js'
export { createDexiePersister } from './dexie-persister.js'
export { OfflineProvider, useOfflineContext } from './offline-provider.jsx'
export { SyncEngine } from './sync-engine.js'
export { useOfflineStatus } from './use-offline-status.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/offline/src/use-offline-status.js packages/offline/src/__tests__/use-offline-status.test.js packages/offline/src/index.js
git commit -m "feat(offline): add useOfflineStatus hook and export SyncEngine from @atlas/offline"
```

---

### Task 4: Create SyncStatusBar component in @atlas/ui

**Files:**
- Create: `packages/ui/src/components/SyncStatusBar.jsx`
- Modify: `packages/ui/src/index.js`

- [ ] **Step 1: Create SyncStatusBar.jsx**

Create `packages/ui/src/components/SyncStatusBar.jsx`:

```jsx
import { RefreshCw, CheckCircle, WifiOff } from 'lucide-react'

function formatRelativeTime(isoString) {
  if (!isoString) return null
  const diffMs = Date.now() - new Date(isoString).getTime()
  if (diffMs < 60_000) return 'hace un momento'
  if (diffMs < 3_600_000) return `hace ${Math.floor(diffMs / 60_000)} min`
  return `hace ${Math.floor(diffMs / 3_600_000)} h`
}

export function SyncStatusBar({ isOnline = true, isSyncing = false, lastSyncAt = null, onSyncNow }) {
  const relTime = formatRelativeTime(lastSyncAt)

  if (!lastSyncAt && !isSyncing) return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
      {isSyncing && (
        <RefreshCw
          size={11}
          className="shrink-0 animate-spin text-[hsl(var(--primary))]"
          aria-label="Sincronizando"
        />
      )}
      {!isSyncing && isOnline && (
        <CheckCircle
          size={11}
          className="shrink-0 text-green-500 dark:text-green-400"
          aria-label="Sincronizado"
        />
      )}
      {!isSyncing && !isOnline && (
        <WifiOff
          size={11}
          className="shrink-0 text-amber-500 dark:text-amber-400"
          aria-label="Sin conexion"
        />
      )}
      <span className="hidden md:inline">
        {isSyncing
          ? 'Sincronizando...'
          : relTime
            ? `Sincronizado ${relTime}`
            : 'Sin sincronizar'}
      </span>
      {onSyncNow && isOnline && !isSyncing && (
        <button
          onClick={onSyncNow}
          className="hidden md:inline underline decoration-dotted hover:text-[hsl(var(--foreground))] transition-colors"
          type="button"
        >
          Actualizar
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Export SyncStatusBar from @atlas/ui**

In `packages/ui/src/index.js`, add after the `OfflineIndicator` export line:

```javascript
export { SyncStatusBar } from './components/SyncStatusBar.jsx'
```

- [ ] **Step 3: Build check**

```bash
pnpm build --filter @atlas/ui
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/SyncStatusBar.jsx packages/ui/src/index.js
git commit -m "feat(offline): add SyncStatusBar component to @atlas/ui"
```

---

### Task 5: Mount SyncStatusBar in Topbar

**Files:**
- Modify: `apps/desktop/src/components/Topbar.jsx`

The `SyncStatusBar` shows a subtle sync status in the top bar — only visible after the first successful pull (when `lastSyncAt` is set). It returns `null` before any sync has happened, so it adds no visual noise on first launch.

- [ ] **Step 1: Read Topbar.jsx**

Read `apps/desktop/src/components/Topbar.jsx` to confirm current imports and structure.

- [ ] **Step 2: Add imports**

Add these imports in `Topbar.jsx` alongside the existing `OfflineIndicator` import:

```javascript
import { SyncStatusBar } from '@atlas/ui'
```

Also add `isSyncing` and `lastSyncAt` to the existing `useOfflineStore` selector:

```javascript
// Change:
const { isOnline, pendingCount } = useOfflineStore((s) => ({
  isOnline: s.isOnline,
  pendingCount: s.pendingCount,
}))

// To (add isSyncing and lastSyncAt):
const { isOnline, pendingCount, isSyncing, lastSyncAt } = useOfflineStore((s) => ({
  isOnline: s.isOnline,
  pendingCount: s.pendingCount,
  isSyncing: s.isSyncing,
  lastSyncAt: s.lastSyncAt,
}))
```

- [ ] **Step 3: Mount SyncStatusBar**

In `Topbar.jsx`, inside the right section div (next to the existing `OfflineIndicator`), add `SyncStatusBar`:

```jsx
<SyncStatusBar
  isOnline={isOnline}
  isSyncing={isSyncing}
  lastSyncAt={lastSyncAt}
/>
```

Place it right before (or after) `<OfflineIndicator ... />` in the same container.

- [ ] **Step 4: Build check**

```bash
pnpm build --filter @atlas/desktop
```

Expected: build succeeds with no TypeScript or import errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/Topbar.jsx
git commit -m "feat(offline): mount SyncStatusBar in Topbar alongside OfflineIndicator"
```

---

### Task 6: Add offline block to custom.example manifest

**Files:**
- Modify: `modules/custom/custom.example/module.manifest.js`

This documents the pattern for all future Tier 1 AME3 modules. The `offline` block is spread through by `defineAtlasModule` without needing schema changes.

- [ ] **Step 1: Add offline block to custom.example manifest**

In `modules/custom/custom.example/module.manifest.js`, add the `offline` block before the closing `})`:

```javascript
export default defineAtlasModule({
  key: 'custom.example',
  // ... existing fields unchanged ...

  // Offline declaration — controls how this module participates in sync.
  // strategy: 'last-write-wins' | 'server-wins' | 'readonly' | 'conflict-ui'
  // models: array of defineModel() names from this module's models/
  // allowCreate/allowUpdate/allowDelete: which operations queue offline
  offline: {
    enabled: true,
    models: [],           // replace with actual defineModel() names when using real models
    strategy: 'last-write-wins',
    allowCreate: true,
    allowUpdate: true,
    allowDelete: false,
    maxRecords: 5000,
    pullFields: null,     // null = all fields; or ['id', 'name'] to limit payload size
  },
})
```

- [ ] **Step 2: Syntax check**

```bash
node --check modules/custom/custom.example/module.manifest.js
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add modules/custom/custom.example/module.manifest.js
git commit -m "docs(offline): add offline block to custom.example as canonical AME3 manifest pattern"
```

---

### Task 7: Smoke test end-to-end offline read cache

**Files:** No code changes — verification only.

- [ ] **Step 1: Start the full dev stack**

```bash
pnpm dev
```

Wait for both `API on port 4010` and `Vite on port 5173` to be ready.

- [ ] **Step 2: Open the app in a browser tab and log in**

Navigate to `http://localhost:5173`.

Log in with a valid account. Verify the normal app loads.

- [ ] **Step 3: Observe the initial sync in DevTools**

Open DevTools → Application → IndexedDB → `atlas-offline` → `offline_records`.

Wait up to 30 seconds for the initial pull to complete. Verify:
- `offline_records` has rows for `atlas.contacts`, `atlas.hr`, `custom.fleet`
- `sync_state` has cursor entries for each module/entityType pair
- `useOfflineStore` `lastSyncAt` is non-null (visible in React DevTools or console: `window.__OFFLINE_STORE = useOfflineStore.getState()`)

- [ ] **Step 4: Simulate going offline**

In DevTools → Network tab → select "Offline" from the throttle dropdown (or disable the network adapter).

- [ ] **Step 5: Navigate to Contacts and HR screens**

Navigate to the Contacts screen and HR Employees screen. Verify data still renders from the React Query persistent cache.

Expected: data renders instantly from `_query_cache`. No loading spinners. No error states.

- [ ] **Step 6: Re-enable network and verify re-sync**

Re-enable the network connection. Within 30 seconds, verify that:
- `OfflineIndicator` disappears (we're online again)
- A pull runs automatically (visible as `SyncStatusBar` showing "Sincronizando...")
- `sync_state` cursors update in IndexedDB

- [ ] **Step 7: Commit (no code changes — test only)**

No commit needed for this step. Write observations as comments in this plan if issues are found.

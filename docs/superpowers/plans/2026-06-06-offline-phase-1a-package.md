# Offline Phase 1A — `@atlas/offline` Package

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `packages/offline` workspace package containing the Dexie database schema, SessionVault, OnlineDetector, Zustand offline store, and DexiePersister — with full test coverage. No app integration yet; that is Plan 1B.

**Architecture:** A new `@atlas/offline` ESM package under `packages/offline/`. All offline primitives live here. The package has no knowledge of the app shell or UI — it is a pure infrastructure library. Tests use Node built-in test runner with `fake-indexeddb` to mock IndexedDB.

**Tech Stack:** Dexie 3.x (IndexedDB ORM), Zustand 5.x (peer), `@tanstack/react-query-persist-client` 5.x, `fake-indexeddb` 4.x (tests only), Node built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-06-06-offline-architecture-design.md` — sections 4, 5, 7, 8.

---

## File Map

```
packages/offline/
  package.json                          NEW — package manifest
  src/
    db.js                               NEW — Dexie class with 6 tables
    session-vault.js                    NEW — read/write JWT offline
    online-detector.js                  NEW — navigator.onLine + /health probe
    offline-store.js                    NEW — Zustand store for sync state
    dexie-persister.js                  NEW — TanStack Query v5 persister
    offline-provider.jsx                NEW — React context (OfflineProvider)
    index.js                            NEW — public API re-exports
    __tests__/
      db.test.js                        NEW
      session-vault.test.js             NEW
      online-detector.test.js           NEW
      offline-store.test.js             NEW
      dexie-persister.test.js           NEW
```

---

## Task 1: Bootstrap the package

**Files:**
- Create: `packages/offline/package.json`
- Create: `packages/offline/src/index.js`

- [ ] **Step 1.1: Create package.json**

```json
{
  "name": "@atlas/offline",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "test": "node --test src/__tests__/"
  },
  "dependencies": {
    "dexie": "^3.2.7"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-query-persist-client": "^5.0.0"
  },
  "devDependencies": {
    "fake-indexeddb": "^4.0.2",
    "zustand": "workspace:*"
  }
}
```

- [ ] **Step 1.2: Create empty `src/index.js`**

```javascript
// Re-exported as each module is implemented
export { AtlasOfflineDatabase, db } from './db.js'
export { SessionVault } from './session-vault.js'
export { OnlineDetector } from './online-detector.js'
export { useOfflineStore } from './offline-store.js'
export { createDexiePersister } from './dexie-persister.js'
export { OfflineProvider, useOfflineContext } from './offline-provider.jsx'
```

- [ ] **Step 1.3: Install dependencies**

Run from repo root:
```bash
pnpm install
```

Expected: pnpm resolves `dexie` and `fake-indexeddb` into `packages/offline/node_modules` (or hoisted). No errors.

- [ ] **Step 1.4: Commit**

```bash
git add packages/offline/package.json packages/offline/src/index.js
git commit -m "feat(offline): bootstrap @atlas/offline package"
```

---

## Task 2: Dexie database schema

**Files:**
- Create: `packages/offline/src/db.js`
- Create: `packages/offline/src/__tests__/db.test.js`

- [ ] **Step 2.1: Write the failing test**

Create `packages/offline/src/__tests__/db.test.js`:

```javascript
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'

let db

before(async () => {
  db = new AtlasOfflineDatabase('test-atlas-offline')
  await db.open()
})

after(async () => {
  await db.delete()
})

test('db - opens without error', async () => {
  assert.equal(db.isOpen(), true)
})

test('db - has offline_records table', () => {
  assert.ok(db.offline_records, 'offline_records table must exist')
})

test('db - has mutation_queue table', () => {
  assert.ok(db.mutation_queue, 'mutation_queue table must exist')
})

test('db - has sync_state table', () => {
  assert.ok(db.sync_state, 'sync_state table must exist')
})

test('db - has session_vault table', () => {
  assert.ok(db.session_vault, 'session_vault table must exist')
})

test('db - has conflicts table', () => {
  assert.ok(db.conflicts, 'conflicts table must exist')
})

test('db - has _query_cache table', () => {
  assert.ok(db._query_cache, '_query_cache table must exist')
})

test('offline_records - can put and get a record', async () => {
  await db.offline_records.put({
    moduleKey: 'atlas.contacts',
    entityType: 'contact',
    id: 'test-id-1',
    data: { name: 'Raul' },
    version: new Date().toISOString(),
    pulledAt: new Date().toISOString(),
    companyId: 'company-1',
    dirty: false,
  })
  const row = await db.offline_records.get(['atlas.contacts', 'contact', 'test-id-1'])
  assert.equal(row.data.name, 'Raul')
})

test('mutation_queue - can put and get a mutation', async () => {
  await db.mutation_queue.put({
    id: 'mut-1',
    idempotencyKey: 'idem-1',
    moduleKey: 'atlas.contacts',
    entityType: 'contact',
    recordId: null,
    operation: 'CREATE',
    payload: { name: 'New Contact' },
    status: 'PENDING',
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    companyId: 'company-1',
    userId: 'user-1',
  })
  const row = await db.mutation_queue.get('mut-1')
  assert.equal(row.operation, 'CREATE')
  assert.equal(row.status, 'PENDING')
})

test('sync_state - can put and get cursor', async () => {
  await db.sync_state.put({
    moduleKey: 'atlas.contacts',
    entityType: 'contact',
    lastPullAt: new Date().toISOString(),
    serverCursor: '2026-06-06T00:00:00Z',
    schemaVersion: '0.1.0',
  })
  const row = await db.sync_state.get(['atlas.contacts', 'contact'])
  assert.equal(row.schemaVersion, '0.1.0')
})

test('session_vault - can put and retrieve session', async () => {
  await db.session_vault.put({
    id: 'current',
    accessToken: 'tok-abc',
    refreshToken: 'ref-abc',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    userProfile: { id: 'user-1', name: 'Raul' },
    companyId: 'company-1',
    apiBaseUrl: 'https://api.example.com',
    storedAt: new Date().toISOString(),
  })
  const row = await db.session_vault.get('current')
  assert.equal(row.accessToken, 'tok-abc')
})
```

- [ ] **Step 2.2: Run test to confirm it fails**

```bash
node --test packages/offline/src/__tests__/db.test.js
```

Expected: `ERR_MODULE_NOT_FOUND` or similar — `db.js` does not exist yet.

- [ ] **Step 2.3: Implement `packages/offline/src/db.js`**

```javascript
import Dexie from 'dexie'

export class AtlasOfflineDatabase extends Dexie {
  constructor(name = 'atlas-offline') {
    super(name)

    this.version(1).stores({
      // [moduleKey+entityType+id] compound primary key
      offline_records: '[moduleKey+entityType+id], moduleKey, entityType, companyId, dirty, pulledAt',

      // id is the primary key (UUID v7 generated by caller)
      mutation_queue: 'id, status, moduleKey, entityType, queuedAt, companyId, userId',

      // [moduleKey+entityType] compound primary key
      sync_state: '[moduleKey+entityType]',

      // single-row table — always id = 'current'
      session_vault: 'id',

      // id is the primary key
      conflicts: 'id, status, moduleKey, entityType, recordId, detectedAt',

      // single-row table for React Query dehydrated cache
      _query_cache: 'id',
    })
  }
}

// Singleton instance — created lazily so tests can create their own instances
let _db = null

export function db() {
  if (!_db) {
    _db = new AtlasOfflineDatabase()
  }
  return _db
}
```

- [ ] **Step 2.4: Run test to confirm it passes**

```bash
node --test packages/offline/src/__tests__/db.test.js
```

Expected: All tests pass. Output shows `✔` for each test.

- [ ] **Step 2.5: Commit**

```bash
git add packages/offline/src/db.js packages/offline/src/__tests__/db.test.js
git commit -m "feat(offline): add Dexie database schema with 6 tables"
```

---

## Task 3: SessionVault

**Files:**
- Create: `packages/offline/src/session-vault.js`
- Create: `packages/offline/src/__tests__/session-vault.test.js`

- [ ] **Step 3.1: Write the failing test**

Create `packages/offline/src/__tests__/session-vault.test.js`:

```javascript
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { SessionVault } from '../session-vault.js'

let database
let vault

before(async () => {
  database = new AtlasOfflineDatabase('test-session-vault')
  await database.open()
  vault = new SessionVault(database)
})

after(async () => {
  await database.delete()
})

test('SessionVault - store() persists session fields', async () => {
  await vault.store({
    accessToken: 'access-123',
    refreshToken: 'refresh-123',
    expiresAt: '2026-06-07T00:00:00Z',
    userProfile: { id: 'u1', name: 'Test' },
    companyId: 'c1',
    apiBaseUrl: 'https://api.test',
  })
  const row = await database.session_vault.get('current')
  assert.equal(row.accessToken, 'access-123')
  assert.equal(row.companyId, 'c1')
})

test('SessionVault - load() returns stored session', async () => {
  const session = await vault.load()
  assert.equal(session.accessToken, 'access-123')
  assert.equal(session.refreshToken, 'refresh-123')
})

test('SessionVault - load() returns null when vault is empty', async () => {
  const emptyDb = new AtlasOfflineDatabase('test-session-vault-empty')
  await emptyDb.open()
  const emptyVault = new SessionVault(emptyDb)
  const result = await emptyVault.load()
  assert.equal(result, null)
  await emptyDb.delete()
})

test('SessionVault - update() patches existing session', async () => {
  await vault.update({ accessToken: 'new-access-456' })
  const session = await vault.load()
  assert.equal(session.accessToken, 'new-access-456')
  assert.equal(session.refreshToken, 'refresh-123') // unchanged
})

test('SessionVault - clear() removes stored session', async () => {
  await vault.clear()
  const session = await vault.load()
  assert.equal(session, null)
})

test('SessionVault - isExpired() returns true when past expiresAt', async () => {
  await vault.store({
    accessToken: 'tok',
    refreshToken: 'ref',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    userProfile: {},
    companyId: 'c1',
    apiBaseUrl: 'https://api.test',
  })
  assert.equal(await vault.isExpired(), true)
})

test('SessionVault - isExpired() returns false when within validity window', async () => {
  await vault.store({
    accessToken: 'tok',
    refreshToken: 'ref',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    userProfile: {},
    companyId: 'c1',
    apiBaseUrl: 'https://api.test',
  })
  assert.equal(await vault.isExpired(), false)
})
```

- [ ] **Step 3.2: Run test to confirm it fails**

```bash
node --test packages/offline/src/__tests__/session-vault.test.js
```

Expected: `ERR_MODULE_NOT_FOUND` — `session-vault.js` does not exist.

- [ ] **Step 3.3: Implement `packages/offline/src/session-vault.js`**

```javascript
export class SessionVault {
  constructor(database) {
    this._db = database
  }

  async store({ accessToken, refreshToken, expiresAt, userProfile, companyId, apiBaseUrl }) {
    await this._db.session_vault.put({
      id: 'current',
      accessToken,
      refreshToken,
      expiresAt,
      userProfile,
      companyId,
      apiBaseUrl,
      storedAt: new Date().toISOString(),
    })
  }

  async load() {
    const row = await this._db.session_vault.get('current')
    return row ?? null
  }

  async update(fields) {
    const existing = await this.load()
    if (!existing) return
    await this._db.session_vault.put({ ...existing, ...fields })
  }

  async clear() {
    await this._db.session_vault.delete('current')
  }

  async isExpired() {
    const session = await this.load()
    if (!session?.expiresAt) return true
    return new Date(session.expiresAt) <= new Date()
  }
}
```

- [ ] **Step 3.4: Run test to confirm it passes**

```bash
node --test packages/offline/src/__tests__/session-vault.test.js
```

Expected: All 6 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add packages/offline/src/session-vault.js packages/offline/src/__tests__/session-vault.test.js
git commit -m "feat(offline): add SessionVault for offline JWT persistence"
```

---

## Task 4: OnlineDetector

**Files:**
- Create: `packages/offline/src/online-detector.js`
- Create: `packages/offline/src/__tests__/online-detector.test.js`

- [ ] **Step 4.1: Write the failing test**

Create `packages/offline/src/__tests__/online-detector.test.js`:

```javascript
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { OnlineDetector } from '../online-detector.js'

test('OnlineDetector - isOnline() reflects navigator.onLine', () => {
  const detector = new OnlineDetector({ getNavigatorOnline: () => true })
  assert.equal(detector.isOnline(), true)

  const offlineDetector = new OnlineDetector({ getNavigatorOnline: () => false })
  assert.equal(offlineDetector.isOnline(), false)
})

test('OnlineDetector - onChange callback fires when state transitions', () => {
  let currentOnline = true
  const detector = new OnlineDetector({ getNavigatorOnline: () => currentOnline })

  const changes = []
  detector.onChange((isOnline) => changes.push(isOnline))

  detector._handleOnline()
  assert.deepEqual(changes, [])  // no change — was already online

  detector._handleOffline()
  assert.deepEqual(changes, [false])

  detector._handleOnline()
  assert.deepEqual(changes, [false, true])
})

test('OnlineDetector - multiple onChange callbacks all fire', () => {
  const detector = new OnlineDetector({ getNavigatorOnline: () => true })
  const calls = []
  detector.onChange((v) => calls.push('a:' + v))
  detector.onChange((v) => calls.push('b:' + v))
  detector._handleOffline()
  assert.deepEqual(calls, ['a:false', 'b:false'])
})

test('OnlineDetector - destroy removes all listeners', () => {
  const detector = new OnlineDetector({ getNavigatorOnline: () => true })
  const calls = []
  detector.onChange((v) => calls.push(v))
  detector.destroy()
  detector._handleOffline()
  assert.deepEqual(calls, [])
})
```

- [ ] **Step 4.2: Run test to confirm it fails**

```bash
node --test packages/offline/src/__tests__/online-detector.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4.3: Implement `packages/offline/src/online-detector.js`**

```javascript
const HEALTH_PROBE_INTERVAL_MS = 30_000

export class OnlineDetector {
  constructor({ getNavigatorOnline = () => navigator.onLine, probeUrl = null } = {}) {
    this._getNavigatorOnline = getNavigatorOnline
    this._probeUrl = probeUrl
    this._callbacks = []
    this._currentState = getNavigatorOnline()
    this._probeTimer = null

    this._handleOnline = this._handleOnline.bind(this)
    this._handleOffline = this._handleOffline.bind(this)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._handleOnline)
      window.addEventListener('offline', this._handleOffline)
    }

    if (probeUrl) {
      this._probeTimer = setInterval(() => this._probe(), HEALTH_PROBE_INTERVAL_MS)
    }
  }

  isOnline() {
    return this._currentState
  }

  onChange(callback) {
    this._callbacks.push(callback)
  }

  destroy() {
    this._callbacks = []
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._handleOnline)
      window.removeEventListener('offline', this._handleOffline)
    }
    if (this._probeTimer) {
      clearInterval(this._probeTimer)
      this._probeTimer = null
    }
  }

  _handleOnline() {
    if (this._currentState === true) return
    this._currentState = true
    this._notify(true)
  }

  _handleOffline() {
    if (this._currentState === false) return
    this._currentState = false
    this._notify(false)
  }

  _notify(isOnline) {
    for (const cb of this._callbacks) {
      try { cb(isOnline) } catch {}
    }
  }

  async _probe() {
    if (!this._probeUrl) return
    try {
      await fetch(this._probeUrl, { method: 'HEAD', cache: 'no-store' })
      this._handleOnline()
    } catch {
      this._handleOffline()
    }
  }
}
```

- [ ] **Step 4.4: Run test to confirm it passes**

```bash
node --test packages/offline/src/__tests__/online-detector.test.js
```

Expected: All 4 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add packages/offline/src/online-detector.js packages/offline/src/__tests__/online-detector.test.js
git commit -m "feat(offline): add OnlineDetector with event-based state tracking"
```

---

## Task 5: Offline Zustand store

**Files:**
- Create: `packages/offline/src/offline-store.js`
- Create: `packages/offline/src/__tests__/offline-store.test.js`

- [ ] **Step 5.1: Write the failing test**

Create `packages/offline/src/__tests__/offline-store.test.js`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOfflineStore } from '../offline-store.js'

test('createOfflineStore - initial state', () => {
  const store = createOfflineStore()
  const state = store.getState()
  assert.equal(state.isOnline, true)
  assert.equal(state.pendingCount, 0)
  assert.equal(state.lastSyncAt, null)
  assert.equal(state.isSyncing, false)
})

test('createOfflineStore - setOnline updates isOnline', () => {
  const store = createOfflineStore()
  store.getState().setOnline(false)
  assert.equal(store.getState().isOnline, false)
  store.getState().setOnline(true)
  assert.equal(store.getState().isOnline, true)
})

test('createOfflineStore - setPendingCount updates pendingCount', () => {
  const store = createOfflineStore()
  store.getState().setPendingCount(5)
  assert.equal(store.getState().pendingCount, 5)
})

test('createOfflineStore - setLastSyncAt updates lastSyncAt', () => {
  const store = createOfflineStore()
  const ts = new Date().toISOString()
  store.getState().setLastSyncAt(ts)
  assert.equal(store.getState().lastSyncAt, ts)
})

test('createOfflineStore - setSyncing updates isSyncing', () => {
  const store = createOfflineStore()
  store.getState().setSyncing(true)
  assert.equal(store.getState().isSyncing, true)
})
```

- [ ] **Step 5.2: Run test to confirm it fails**

```bash
node --test packages/offline/src/__tests__/offline-store.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 5.3: Implement `packages/offline/src/offline-store.js`**

```javascript
import { createStore } from 'zustand/vanilla'
import { create } from 'zustand'

const stateCreator = (set) => ({
  isOnline: true,
  pendingCount: 0,
  lastSyncAt: null,
  isSyncing: false,
  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setSyncing: (isSyncing) => set({ isSyncing }),
})

// Vanilla store used in tests and non-React contexts
export function createOfflineStore() {
  return createStore(stateCreator)
}

// React hook for components
export const useOfflineStore = create(stateCreator)
```

- [ ] **Step 5.4: Run test to confirm it passes**

```bash
node --test packages/offline/src/__tests__/offline-store.test.js
```

Expected: All 5 tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add packages/offline/src/offline-store.js packages/offline/src/__tests__/offline-store.test.js
git commit -m "feat(offline): add offline Zustand store for sync state"
```

---

## Task 6: DexiePersister for TanStack Query v5

**Files:**
- Create: `packages/offline/src/dexie-persister.js`
- Create: `packages/offline/src/__tests__/dexie-persister.test.js`

- [ ] **Step 6.1: Write the failing test**

Create `packages/offline/src/__tests__/dexie-persister.test.js`:

```javascript
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { createDexiePersister } from '../dexie-persister.js'

let database
let persister

const MOCK_CLIENT = {
  buster: 'v1',
  timestamp: Date.now(),
  clientState: { mutations: [], queries: [{ queryKey: ['test'], state: { data: 'hello' } }] },
}

before(async () => {
  database = new AtlasOfflineDatabase('test-dexie-persister')
  await database.open()
  persister = createDexiePersister(database)
})

after(async () => {
  await database.delete()
})

test('createDexiePersister - restoreClient() returns undefined when empty', async () => {
  const result = await persister.restoreClient()
  assert.equal(result, undefined)
})

test('createDexiePersister - persistClient() stores dehydrated cache', async () => {
  await persister.persistClient(MOCK_CLIENT)
  const row = await database._query_cache.get('persisted')
  assert.ok(row, 'row must exist in _query_cache')
  assert.equal(row.data.buster, 'v1')
})

test('createDexiePersister - restoreClient() returns stored cache', async () => {
  const restored = await persister.restoreClient()
  assert.ok(restored, 'must return stored client')
  assert.equal(restored.buster, 'v1')
  assert.equal(restored.clientState.queries[0].state.data, 'hello')
})

test('createDexiePersister - removeClient() deletes stored cache', async () => {
  await persister.removeClient()
  const restored = await persister.restoreClient()
  assert.equal(restored, undefined)
})

test('createDexiePersister - persistClient() silently swallows errors', async () => {
  const badPersister = createDexiePersister({ _query_cache: { put: async () => { throw new Error('disk full') } } })
  await assert.doesNotReject(() => badPersister.persistClient(MOCK_CLIENT))
})
```

- [ ] **Step 6.2: Run test to confirm it fails**

```bash
node --test packages/offline/src/__tests__/dexie-persister.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 6.3: Implement `packages/offline/src/dexie-persister.js`**

```javascript
export function createDexiePersister(database) {
  return {
    async persistClient(persistedClient) {
      try {
        await database._query_cache.put({ id: 'persisted', data: persistedClient })
      } catch {}
    },

    async restoreClient() {
      try {
        const row = await database._query_cache.get('persisted')
        return row?.data ?? undefined
      } catch {
        return undefined
      }
    },

    async removeClient() {
      try {
        await database._query_cache.delete('persisted')
      } catch {}
    },
  }
}
```

- [ ] **Step 6.4: Run test to confirm it passes**

```bash
node --test packages/offline/src/__tests__/dexie-persister.test.js
```

Expected: All 5 tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add packages/offline/src/dexie-persister.js packages/offline/src/__tests__/dexie-persister.test.js
git commit -m "feat(offline): add DexiePersister for TanStack Query v5 cache persistence"
```

---

## Task 7: OfflineProvider React context

**Files:**
- Create: `packages/offline/src/offline-provider.jsx`

Note: React context components cannot be tested with `node --test` — they require a browser or jsdom environment. Integration testing happens in Plan 1B when the provider is wired into the app. This task implements the component only.

- [ ] **Step 7.1: Implement `packages/offline/src/offline-provider.jsx`**

```jsx
import { createContext, useContext, useEffect, useRef } from 'react'
import { AtlasOfflineDatabase } from './db.js'
import { SessionVault } from './session-vault.js'
import { OnlineDetector } from './online-detector.js'
import { useOfflineStore } from './offline-store.js'
import { createDexiePersister } from './dexie-persister.js'

const OfflineContext = createContext(null)

export function OfflineProvider({ children, apiBaseUrl }) {
  const detectorRef = useRef(null)
  const dbRef = useRef(null)
  const setOnline = useOfflineStore((s) => s.setOnline)

  useEffect(() => {
    const database = new AtlasOfflineDatabase()
    dbRef.current = database
    database.open().catch(() => {})

    const detector = new OnlineDetector({
      probeUrl: apiBaseUrl ? `${apiBaseUrl}/health` : null,
    })
    detectorRef.current = detector

    setOnline(detector.isOnline())
    detector.onChange((isOnline) => setOnline(isOnline))

    return () => {
      detector.destroy()
      database.close()
    }
  }, [apiBaseUrl, setOnline])

  return (
    <OfflineContext.Provider value={{ dbRef }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOfflineContext() {
  return useContext(OfflineContext)
}
```

- [ ] **Step 7.2: Run all package tests to confirm nothing regressed**

```bash
node --test packages/offline/src/__tests__/
```

Expected: All tests across all test files pass.

- [ ] **Step 7.3: Update `src/index.js` to confirm exports are complete**

Verify `packages/offline/src/index.js` contains exactly:

```javascript
export { AtlasOfflineDatabase, db } from './db.js'
export { SessionVault } from './session-vault.js'
export { OnlineDetector } from './online-detector.js'
export { useOfflineStore, createOfflineStore } from './offline-store.js'
export { createDexiePersister } from './dexie-persister.js'
export { OfflineProvider, useOfflineContext } from './offline-provider.jsx'
```

- [ ] **Step 7.4: Commit**

```bash
git add packages/offline/src/offline-provider.jsx packages/offline/src/index.js
git commit -m "feat(offline): add OfflineProvider React context"
```

---

## Task 8: Run full package test suite and final check

- [ ] **Step 8.1: Run all tests**

```bash
node --test packages/offline/src/__tests__/
```

Expected output (all pass):
```
✔ db - opens without error
✔ db - has offline_records table
✔ db - has mutation_queue table
✔ db - has sync_state table
✔ db - has session_vault table
✔ db - has conflicts table
✔ db - has _query_cache table
✔ offline_records - can put and get a record
✔ mutation_queue - can put and get a mutation
✔ sync_state - can put and get cursor
✔ session_vault - can put and retrieve session
✔ SessionVault - store() persists session fields
... (all remaining tests)
ℹ tests 25
ℹ pass 25
ℹ fail 0
```

- [ ] **Step 8.2: Verify package is importable from desktop app**

```bash
cd apps/desktop && node -e "import('@atlas/offline').then(m => console.log('exports:', Object.keys(m))).catch(e => console.error(e))"
```

Expected: prints `exports: [ 'AtlasOfflineDatabase', 'db', 'SessionVault', 'OnlineDetector', 'useOfflineStore', 'createOfflineStore', 'createDexiePersister', 'OfflineProvider', 'useOfflineContext' ]`

- [ ] **Step 8.3: Final commit**

```bash
git add -A
git commit -m "feat(offline): complete @atlas/offline package — Phase 1A done"
```

---

## What comes next

**Plan 1B** (`2026-06-06-offline-phase-1b-app-integration.md`) wires this package into the app:
- `AuthProvider` writes to `SessionVault` on session events
- `main.jsx` wraps with `PersistQueryClientProvider` using `createDexiePersister`
- `AtlasApp.jsx` wraps with `OfflineProvider`
- `OfflineIndicator` component added to `@atlas/ui`
- `OfflineIndicator` placed in `Topbar`

Do not begin Plan 1B until all tests in this plan pass and the package is committed.

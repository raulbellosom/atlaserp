# Offline Phase 4B — Conflict Resolution Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire conflict detection end-to-end on the frontend: capture `clientUpdatedAt` when queuing UPDATE mutations, write conflict records to the `conflicts` Dexie table when the server returns CONFLICT, and surface a `ConflictDialog` component for manual resolution.

**Architecture:** Three layers added in sequence: (1) `offline-transport.js` captures the local record's `updatedAt` before the optimistic write and stores it in `mutation_queue` via `MutationQueue.enqueue()`; (2) `SyncEngine.push()` forwards `clientUpdatedAt` to the server and on CONFLICT writes a record to the `conflicts` Dexie table with `localData` + `serverData`; (3) new `useConflicts` hook polls the `conflicts` table, and `ConflictDialog` in `@atlas/ui` shows a side-by-side comparison letting the user pick which version wins.

**Tech Stack:** Dexie.js (IndexedDB), React, `@atlas/ui`, `node --test`, Vite JSX check

**Prerequisite:** Plan 4A complete — server can now return `{ status: 'CONFLICT', record }` for `conflict-ui` modules.

---

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/offline/src/mutation-queue.js` | Add `clientUpdatedAt` field to `enqueue()` |
| Modify | `packages/offline/src/offline-transport.js` | Capture `clientUpdatedAt` from offline_records before optimistic write |
| Modify | `packages/offline/src/__tests__/offline-transport.test.js` | Test that UPDATE captures `clientUpdatedAt` |
| Modify | `packages/offline/src/sync-engine.js` | Send `clientUpdatedAt` in mutations array; write to `conflicts` table on CONFLICT result |
| Modify | `packages/offline/src/__tests__/sync-engine.test.js` | Test conflict writes to `conflicts` table |
| Create | `packages/offline/src/use-conflicts.js` | Hook polling `conflicts` table for PENDING entries |
| Modify | `packages/offline/src/index.js` | Export `useConflicts` |
| Create | `packages/ui/src/components/ConflictDialog.jsx` | Side-by-side comparison dialog with resolve buttons |
| Modify | `packages/ui/src/index.js` | Export `ConflictDialog` |

---

### Task 1: Capture clientUpdatedAt in MutationQueue and offline-transport

`MutationQueue.enqueue()` gets a new optional `clientUpdatedAt` parameter. `offline-transport.js` reads the existing offline record before the optimistic write (the read is already done for UPDATE — just reuse it) and passes `clientUpdatedAt` to `enqueue()`.

**Files:**
- Modify: `packages/offline/src/mutation-queue.js`
- Modify: `packages/offline/src/offline-transport.js`
- Modify: `packages/offline/src/__tests__/offline-transport.test.js`

- [ ] **Step 1: Write a failing test for clientUpdatedAt capture**

Add this test to `packages/offline/src/__tests__/offline-transport.test.js`, inside the existing `describe` block after existing tests:

```js
it('UPDATE mutation stores clientUpdatedAt from existing offline record', async () => {
  const existingUpdatedAt = '2026-06-06T09:00:00.000Z'
  await db.offline_records.put({
    moduleKey: 'atlas.contacts',
    entityType: 'contact',
    id: 'c-existing',
    data: { id: 'c-existing', name: 'Old Name', companyId: 'co-1', updatedAt: existingUpdatedAt },
    version: existingUpdatedAt,
    pulledAt: existingUpdatedAt,
    companyId: 'co-1',
    dirty: false,
  })

  await transport.queue('/contacts/c-existing', {
    method: 'PUT',
    body: JSON.stringify({ name: 'New Name' }),
  })

  const items = await db.mutation_queue.toArray()
  assert.equal(items.length, 1)
  assert.equal(items[0].clientUpdatedAt, existingUpdatedAt)
})

it('CREATE mutation stores clientUpdatedAt as null', async () => {
  await transport.queue('/contacts', {
    method: 'POST',
    body: JSON.stringify({ name: 'Brand New' }),
  })

  const items = await db.mutation_queue.toArray()
  assert.equal(items.length, 1)
  assert.equal(items[0].clientUpdatedAt, null)
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
node --test packages/offline/src/__tests__/offline-transport.test.js 2>&1 | tail -20
```

Expected: 2 new tests fail (`clientUpdatedAt` not stored yet), all existing tests pass.

- [ ] **Step 3: Update MutationQueue.enqueue() to accept clientUpdatedAt**

Replace `packages/offline/src/mutation-queue.js` with:

```js
export class MutationQueue {
  #db

  constructor({ db }) {
    this.#db = db
  }

  async enqueue({ id, idempotencyKey, moduleKey, entityType, recordId, operation, payload, companyId, userId, clientUpdatedAt }) {
    await this.#db.mutation_queue.put({
      id,
      idempotencyKey,
      moduleKey,
      entityType,
      recordId: recordId ?? null,
      operation,
      payload,
      status: 'PENDING',
      queuedAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
      companyId: companyId ?? null,
      userId: userId ?? null,
      clientUpdatedAt: clientUpdatedAt ?? null,
    })
  }

  async getPending({ limit = 50 } = {}) {
    return this.#db.mutation_queue.where('status').equals('PENDING').limit(limit).sortBy('queuedAt')
  }

  async markSyncing(id) {
    await this.#db.mutation_queue.update(id, { status: 'SYNCING' })
  }

  async markDone(id) {
    await this.#db.mutation_queue.update(id, { status: 'DONE' })
  }

  async markFailed(id, lastError) {
    const item = await this.#db.mutation_queue.get(id)
    if (!item) return
    const attempts = (item.attempts ?? 0) + 1
    const status = attempts >= 3 ? 'FAILED' : 'PENDING'
    await this.#db.mutation_queue.update(id, { status, attempts, lastError: lastError ?? null })
  }

  async markConflict(id, lastError) {
    await this.#db.mutation_queue.update(id, { status: 'CONFLICT', lastError: lastError ?? null })
  }

  async getPendingCount() {
    const [pending, syncing, conflict, failed] = await Promise.all([
      this.#db.mutation_queue.where('status').equals('PENDING').count(),
      this.#db.mutation_queue.where('status').equals('SYNCING').count(),
      this.#db.mutation_queue.where('status').equals('CONFLICT').count(),
      this.#db.mutation_queue.where('status').equals('FAILED').count(),
    ])
    return pending + syncing + conflict + failed
  }

  async getAll({ statuses } = {}) {
    if (!statuses || statuses.length === 0) {
      return this.#db.mutation_queue.orderBy('queuedAt').toArray()
    }
    return this.#db.mutation_queue.where('status').anyOf(statuses).sortBy('queuedAt')
  }

  async discard(id) {
    await this.#db.mutation_queue.delete(id)
  }

  async resetToRetry(id) {
    await this.#db.mutation_queue.update(id, { status: 'PENDING', attempts: 0, lastError: null })
  }
}
```

- [ ] **Step 4: Update offline-transport.js to capture clientUpdatedAt**

Replace `packages/offline/src/offline-transport.js` with:

```js
import { MutationQueue } from './mutation-queue.js'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH'])

// Maps API path patterns to module metadata.
// Patterns with ID must come before patterns without ID (more specific first).
const ROUTE_MAP = [
  // atlas.contacts
  { pattern: /^\/contacts\/([^/?#]+)$/, moduleKey: 'atlas.contacts', entityType: 'contact', hasId: true },
  { pattern: /^\/contacts$/, moduleKey: 'atlas.contacts', entityType: 'contact', hasId: false },
  // atlas.hr — departments
  { pattern: /^\/hr\/departments\/([^/?#]+)$/, moduleKey: 'atlas.hr', entityType: 'department', hasId: true },
  { pattern: /^\/hr\/departments$/, moduleKey: 'atlas.hr', entityType: 'department', hasId: false },
  // atlas.hr — job-titles
  { pattern: /^\/hr\/job-titles\/([^/?#]+)$/, moduleKey: 'atlas.hr', entityType: 'job_title', hasId: true },
  { pattern: /^\/hr\/job-titles$/, moduleKey: 'atlas.hr', entityType: 'job_title', hasId: false },
  // atlas.hr — employees
  { pattern: /^\/hr\/employees\/([^/?#]+)$/, moduleKey: 'atlas.hr', entityType: 'employee', hasId: true },
  { pattern: /^\/hr\/employees$/, moduleKey: 'atlas.hr', entityType: 'employee', hasId: false },
  // custom.fleet — vehicles
  { pattern: /^\/fleet\/vehicles\/([^/?#]+)$/, moduleKey: 'custom.fleet', entityType: 'vehicle', hasId: true },
  { pattern: /^\/fleet\/vehicles$/, moduleKey: 'custom.fleet', entityType: 'vehicle', hasId: false },
  // custom.fleet — drivers
  { pattern: /^\/fleet\/drivers\/([^/?#]+)$/, moduleKey: 'custom.fleet', entityType: 'driver', hasId: true },
  { pattern: /^\/fleet\/drivers$/, moduleKey: 'custom.fleet', entityType: 'driver', hasId: false },
]

export function parseMutationRoute(path, method) {
  const upperMethod = (method ?? 'GET').toUpperCase()
  // Strip query string and trailing slash before matching
  const cleanPath = path.split('?')[0].replace(/\/+$/, '')
  for (const route of ROUTE_MAP) {
    const match = cleanPath.match(route.pattern)
    if (!match) continue
    const recordId = route.hasId ? match[1] : null
    const operation = upperMethod === 'POST' ? 'CREATE' : 'UPDATE'
    return { moduleKey: route.moduleKey, entityType: route.entityType, operation, recordId }
  }
  return null
}

export function createOfflineTransport({ db, getSession }) {
  const mutationQueue = new MutationQueue({ db })

  async function queue(path, options) {
    const method = (options?.method ?? 'GET').toUpperCase()
    if (!MUTATION_METHODS.has(method)) return null

    const parsed = parseMutationRoute(path, method)
    if (!parsed) return null

    const { moduleKey, entityType, operation, recordId } = parsed
    const session = await getSession()

    let payload = {}
    if (options?.body) {
      try {
        payload = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
      } catch {
        payload = {}
      }
    }

    const id = crypto.randomUUID()
    const idempotencyKey = crypto.randomUUID()

    // For UPDATE mutations, read the existing record once: used for both
    // clientUpdatedAt capture (conflict detection) and the optimistic write below.
    let existingRecord = null
    let clientUpdatedAt = null
    if (operation === 'UPDATE' && recordId) {
      existingRecord = await db.offline_records.get([moduleKey, entityType, recordId])
      clientUpdatedAt = existingRecord?.data?.updatedAt ?? null
    }

    await mutationQueue.enqueue({
      id,
      idempotencyKey,
      moduleKey,
      entityType,
      recordId,
      operation,
      payload,
      companyId: session?.companyId ?? null,
      userId: session?.userProfile?.id ?? null,
      clientUpdatedAt,
    })

    // Optimistic update: apply the change to offline_records immediately
    if (operation === 'UPDATE' && existingRecord) {
      await db.offline_records.put({ ...existingRecord, data: { ...existingRecord.data, ...payload }, dirty: true })
    } else if (operation === 'CREATE') {
      const localId = recordId ?? id
      await db.offline_records.put({
        moduleKey,
        entityType,
        id: localId,
        data: { id: localId, companyId: session?.companyId ?? null, ...payload },
        version: new Date().toISOString(),
        pulledAt: new Date().toISOString(),
        companyId: session?.companyId ?? null,
        dirty: true,
      })
    }

    return { queued: true, id }
  }

  return { queue, mutationQueue }
}
```

- [ ] **Step 5: Run all offline-transport tests**

```bash
node --test packages/offline/src/__tests__/offline-transport.test.js 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/offline/src/mutation-queue.js packages/offline/src/offline-transport.js packages/offline/src/__tests__/offline-transport.test.js
git commit -m "feat(offline): capture clientUpdatedAt in mutation queue for conflict detection"
```

---

### Task 2: SyncEngine sends clientUpdatedAt and writes to conflicts table on CONFLICT

When the server returns `{ status: 'CONFLICT', record: serverRecord }`, the engine writes a row to the `conflicts` Dexie table (which already exists in the schema). The transaction already covering `mutation_queue` and `offline_records` is expanded to include `conflicts`.

**Files:**
- Modify: `packages/offline/src/sync-engine.js`
- Modify: `packages/offline/src/__tests__/sync-engine.test.js`

- [ ] **Step 1: Write a failing test for conflict table write**

Add this test to `packages/offline/src/__tests__/sync-engine.test.js` inside the `describe('SyncEngine', ...)` block, after existing push tests:

```js
it('CONFLICT result writes entry to conflicts table with localData and serverData', async () => {
  // Seed an offline record so localData can be read
  await db.offline_records.put({
    moduleKey: 'atlas.contacts',
    entityType: 'contact',
    id: 'c1',
    data: { id: 'c1', name: 'Local Name', companyId: COMPANY_ID, updatedAt: '2026-06-06T09:00:00.000Z' },
    version: '2026-06-06T09:00:00.000Z',
    pulledAt: '2026-06-06T09:00:00.000Z',
    companyId: COMPANY_ID,
    dirty: true,
  })
  await db.mutation_queue.put({
    id: 'mut-conflict-1',
    idempotencyKey: 'ik-conflict-1',
    moduleKey: 'atlas.contacts',
    entityType: 'contact',
    recordId: 'c1',
    operation: 'UPDATE',
    payload: { name: 'Local Name' },
    status: 'PENDING',
    queuedAt: '2026-06-06T10:00:00.000Z',
    attempts: 0,
    lastError: null,
    companyId: COMPANY_ID,
    userId: 'u1',
    clientUpdatedAt: '2026-06-06T09:00:00.000Z',
  })

  const serverRecord = { id: 'c1', name: 'Server Name', companyId: COMPANY_ID, updatedAt: '2026-06-06T10:30:00.000Z' }

  const engine = new SyncEngine({
    db,
    apiBaseUrl: 'http://localhost:4010',
    getToken: async () => 'tok',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        results: [{ idempotencyKey: 'ik-conflict-1', status: 'CONFLICT', record: serverRecord }],
      }),
    }),
  })

  const result = await engine.push()
  assert.deepEqual(result, { pushed: 0, failed: 1 })

  // Mutation should be marked CONFLICT
  const mut = await db.mutation_queue.get('mut-conflict-1')
  assert.equal(mut.status, 'CONFLICT')

  // Conflicts table should have one PENDING entry
  const conflicts = await db.conflicts.where('status').equals('PENDING').toArray()
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].mutationId, 'mut-conflict-1')
  assert.equal(conflicts[0].recordId, 'c1')
  assert.equal(conflicts[0].moduleKey, 'atlas.contacts')
  assert.ok(conflicts[0].localData, 'localData must be present')
  assert.equal(conflicts[0].localData.name, 'Local Name')
  assert.ok(conflicts[0].serverData, 'serverData must be present')
  assert.equal(conflicts[0].serverData.name, 'Server Name')
  assert.equal(conflicts[0].status, 'PENDING')
  assert.ok(conflicts[0].detectedAt)
})
```

- [ ] **Step 2: Run to verify the test fails**

```bash
node --test packages/offline/src/__tests__/sync-engine.test.js 2>&1 | tail -20
```

Expected: new test fails (conflicts table empty), all other tests pass.

- [ ] **Step 3: Update sync-engine.js**

Replace `packages/offline/src/sync-engine.js` with:

```js
import { MutationQueue } from './mutation-queue.js'

export class SyncEngine {
  #db
  #apiBaseUrl
  #getToken
  #fetchImpl
  #pulling = false
  #pushing = false
  #mutationQueue

  constructor({ db, apiBaseUrl, getToken, fetchImpl }) {
    this.#db = db
    this.#getToken = getToken
    // fetchImpl is injected for testing; in production globalThis.fetch is used
    this.#fetchImpl = fetchImpl ?? ((...args) => globalThis.fetch(...args))
    this.#apiBaseUrl = (apiBaseUrl ?? '').replace(/\/$/, '')
    this.#mutationQueue = new MutationQueue({ db })
  }

  async pull({ modules }) {
    if (this.#pulling) return { pulled: 0, nextCursor: null }
    this.#pulling = true
    try {
    const token = await this.#getToken()
    if (!token) return { pulled: 0, nextCursor: null }

    // Find the oldest stored cursor across requested modules so we don't
    // miss records changed before a newer module's cursor.
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
    } finally {
      this.#pulling = false
    }
  }

  async push() {
    if (this.#pushing) return { pushed: 0, failed: 0 }
    this.#pushing = true
    try {
      const token = await this.#getToken()
      if (!token) return { pushed: 0, failed: 0 }

      const pending = await this.#mutationQueue.getPending({ limit: 50 })
      if (pending.length === 0) return { pushed: 0, failed: 0 }

      for (const item of pending) {
        await this.#mutationQueue.markSyncing(item.id)
      }

      const mutations = pending.map((item) => ({
        idempotencyKey: item.idempotencyKey,
        moduleKey: item.moduleKey,
        entityType: item.entityType,
        operation: item.operation,
        recordId: item.recordId ?? null,
        payload: item.payload,
        queuedAt: item.queuedAt,
        clientUpdatedAt: item.clientUpdatedAt ?? null,
      }))

      const response = await this.#fetchImpl(`${this.#apiBaseUrl}/sync/push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mutations }),
      })

      if (!response.ok) {
        for (const item of pending) {
          await this.#mutationQueue.markFailed(item.id, `Push failed: ${response.status}`)
        }
        throw new Error(`Push failed: ${response.status}`)
      }

      const { results } = await response.json()
      let pushed = 0
      let failed = 0

      await this.#db.transaction(
        'rw',
        [this.#db.mutation_queue, this.#db.offline_records, this.#db.conflicts],
        async () => {
          for (const result of results) {
            const item = pending.find((p) => p.idempotencyKey === result.idempotencyKey)
            if (!item) continue

            if (result.status === 'OK') {
              await this.#mutationQueue.markDone(item.id)
              if (result.record) {
                await this.#db.offline_records.put({
                  moduleKey: item.moduleKey,
                  entityType: item.entityType,
                  id: result.record.id,
                  data: result.record,
                  version: result.record.updatedAt ?? new Date().toISOString(),
                  pulledAt: new Date().toISOString(),
                  companyId: result.record.companyId ?? item.companyId ?? null,
                  dirty: false,
                })
              }
              pushed++
            } else if (result.status === 'CONFLICT') {
              const localRecord = await this.#db.offline_records.get(
                [item.moduleKey, item.entityType, item.recordId]
              )
              await this.#db.conflicts.put({
                id: crypto.randomUUID(),
                mutationId: item.id,
                moduleKey: item.moduleKey,
                entityType: item.entityType,
                recordId: item.recordId,
                localData: localRecord?.data ?? item.payload,
                serverData: result.record ?? null,
                detectedAt: new Date().toISOString(),
                status: 'PENDING',
              })
              await this.#mutationQueue.markConflict(item.id, 'Conflicto detectado en el servidor')
              failed++
            } else {
              await this.#mutationQueue.markFailed(item.id, result.status ?? 'Error')
              failed++
            }
          }
        },
      )

      return { pushed, failed }
    } finally {
      this.#pushing = false
    }
  }

  async getLocalCount({ moduleKey, entityType }) {
    return this.#db.offline_records.where({ moduleKey, entityType }).count()
  }
}
```

- [ ] **Step 4: Run all sync-engine tests**

```bash
node --test packages/offline/src/__tests__/sync-engine.test.js 2>&1 | tail -20
```

Expected: All tests pass including the new conflicts table test.

- [ ] **Step 5: Commit**

```bash
git add packages/offline/src/sync-engine.js packages/offline/src/__tests__/sync-engine.test.js
git commit -m "feat(offline): write conflict record to Dexie on push CONFLICT result"
```

---

### Task 3: ConflictDialog component + useConflicts hook + exports

`useConflicts` polls the `conflicts` Dexie table (same pattern as `usePendingMutations`). `ConflictDialog` is a `@atlas/ui` Dialog that shows `localData` vs `serverData` side-by-side and exposes `onResolveLocal` / `onResolveServer` callbacks — the caller decides what to do with the chosen version (e.g. queue a new UPDATE or discard the local mutation). No resolution logic lives inside the dialog itself.

This task has no backend; verify with a Vite JSX build check instead of unit tests.

**Files:**
- Create: `packages/offline/src/use-conflicts.js`
- Modify: `packages/offline/src/index.js`
- Create: `packages/ui/src/components/ConflictDialog.jsx`
- Modify: `packages/ui/src/index.js`

- [ ] **Step 1: Create use-conflicts.js**

Create `packages/offline/src/use-conflicts.js`:

```js
import { useState, useEffect } from 'react'
import { useOfflineContext } from './offline-provider.jsx'

const POLL_INTERVAL_MS = 3000

export function useConflicts() {
  const ctx = useOfflineContext()
  const [conflicts, setConflicts] = useState([])

  useEffect(() => {
    if (!ctx?.dbRef?.current) return
    const db = ctx.dbRef.current
    let mounted = true

    async function load() {
      try {
        const items = await db.conflicts.where('status').equals('PENDING').sortBy('detectedAt')
        if (mounted) setConflicts(items)
      } catch (err) {
        console.warn('[atlas/offline] load conflicts failed', err?.message ?? err)
      }
    }

    load()
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [ctx?.dbRef])

  return conflicts
}
```

- [ ] **Step 2: Export useConflicts from packages/offline/src/index.js**

In `packages/offline/src/index.js`, add one line after the `usePendingMutations` export:

```js
export { useConflicts } from './use-conflicts.js'
```

Full updated file:

```js
export { AtlasOfflineDatabase, db } from './db.js'
export { SessionVault } from './session-vault.js'
export { OnlineDetector } from './online-detector.js'
export { useOfflineStore, createOfflineStore } from './offline-store.js'
export { createDexiePersister } from './dexie-persister.js'
export { OfflineProvider, useOfflineContext } from './offline-provider.jsx'
export { SyncEngine } from './sync-engine.js'
export { useOfflineStatus } from './use-offline-status.js'
export { MutationQueue } from './mutation-queue.js'
export { createOfflineTransport, parseMutationRoute } from './offline-transport.js'
export { usePendingMutations } from './use-pending-mutations.js'
export { useConflicts } from './use-conflicts.js'
```

- [ ] **Step 3: Create ConflictDialog.jsx**

Create `packages/ui/src/components/ConflictDialog.jsx`:

```jsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog.jsx'
import { Button } from './Button.jsx'

const SKIP_FIELDS = new Set(['id', 'companyId', 'userId', 'createdAt', 'updatedAt', 'enabled'])

function getDisplayKeys(local, server) {
  const all = [...new Set([...Object.keys(local ?? {}), ...Object.keys(server ?? {})])]
    .filter((k) => !SKIP_FIELDS.has(k))
  const diff = all.filter((k) => String((local ?? {})[k] ?? '') !== String((server ?? {})[k] ?? ''))
  return diff.length > 0 ? diff : all
}

function formatVal(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export function ConflictDialog({ conflict, open, onResolveLocal, onResolveServer, onClose }) {
  if (!conflict) return null

  const local = conflict.localData ?? {}
  const server = conflict.serverData ?? {}
  const keys = getDisplayKeys(local, server)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conflicto de sincronizacion</DialogTitle>
          <DialogDescription>
            Este registro fue modificado en el servidor mientras estaba sin conexion.
            Selecciona que version conservar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tu version
            </p>
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              {keys.map((k) => (
                <div key={k}>
                  <span className="font-medium">{k}: </span>
                  <span className={String(local[k] ?? '') !== String(server[k] ?? '') ? 'text-destructive' : ''}>
                    {formatVal(local[k])}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Version del servidor
            </p>
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              {keys.map((k) => (
                <div key={k}>
                  <span className="font-medium">{k}: </span>
                  <span className={String(local[k] ?? '') !== String(server[k] ?? '') ? 'text-primary' : ''}>
                    {formatVal(server[k])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={() => onResolveServer(conflict)}>
            Usar version del servidor
          </Button>
          <Button onClick={() => onResolveLocal(conflict)}>
            Usar mi version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Export ConflictDialog from packages/ui/src/index.js**

Add one line after the `PendingMutationsPanel` export in `packages/ui/src/index.js`:

```js
export { ConflictDialog } from "./components/ConflictDialog.jsx";
```

The end of `packages/ui/src/index.js` should now read:

```js
export { OfflineIndicator } from "./components/OfflineIndicator.jsx";
export { SyncStatusBar } from "./components/SyncStatusBar.jsx";
export { PendingMutationsPanel } from "./components/PendingMutationsPanel.jsx";
export { ConflictDialog } from "./components/ConflictDialog.jsx";
```

- [ ] **Step 5: Verify JSX builds without errors**

```bash
cd apps/desktop && pnpm exec vite build 2>&1 | tail -10
```

Expected: Build succeeds (or shows only pre-existing warnings, no new errors).

- [ ] **Step 6: Commit**

```bash
git add packages/offline/src/use-conflicts.js packages/offline/src/index.js packages/ui/src/components/ConflictDialog.jsx packages/ui/src/index.js
git commit -m "feat(offline): add useConflicts hook and ConflictDialog component"
```

---

## Self-Review Checklist

- [x] Spec coverage: `conflicts` table surfaced in UI via `useConflicts` — covered in Task 3
- [x] Spec coverage: `ConflictDialog` component — covered in Task 3
- [x] Spec coverage: `conflict-ui` strategy usable by any module — covered in Plan 4A backend + Task 1 `clientUpdatedAt` capture
- [x] No placeholders — all code is complete
- [x] Type consistency: `conflict.localData`, `conflict.serverData`, `conflict.mutationId` written in Task 2 (`sync-engine.js`) and read in Task 3 (`ConflictDialog`, `useConflicts`)
- [x] Dexie transaction in `sync-engine.js` now includes `this.#db.conflicts` — atomic with mutation_queue and offline_records updates
- [x] `useConflicts` uses same polling pattern as `usePendingMutations` (3s interval, mounted guard, console.warn on error)
- [x] `ConflictDialog` uses Dialog/Button from `@atlas/ui` — no native HTML dialogs
- [x] All UI text in Spanish
- [x] `onResolveLocal` / `onResolveServer` callbacks give callers control — dialog contains no resolution logic itself

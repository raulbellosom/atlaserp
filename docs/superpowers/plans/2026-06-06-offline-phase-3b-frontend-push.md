# Offline Phase 3B — Frontend Mutation Queue + Push Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the client-side mutation queue, SyncEngine.push(), SDK offline transport intercept, and PendingMutationsPanel so Tier 1 modules are fully offline-writable.

**Architecture:** `MutationQueue` manages the local `mutation_queue` Dexie table. `SyncEngine.push()` drains the queue by calling `POST /sync/push` on reconnect. `createOfflineTransport` intercepts SDK mutations when offline and enqueues them. `OfflineProvider` wires push+pull into a single `runSync()` cycle. `PendingMutationsPanel` renders queued/failed mutations with retry/discard.

**Tech Stack:** Dexie.js, Zustand, React, node:test, fake-indexeddb (tests only)

**Prerequisites:** Plan 3A must be merged (SyncMutationLog + POST /sync/push must exist on the API).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/offline/src/mutation-queue.js` | Create | Manages `mutation_queue` Dexie table |
| `packages/offline/src/__tests__/mutation-queue.test.js` | Create | 8 node:test tests |
| `packages/offline/src/sync-engine.js` | Modify | Add `push()` method, `#pushing`/`#mutationQueue` fields |
| `packages/offline/src/__tests__/sync-engine.test.js` | Modify | Add 8 push tests |
| `packages/offline/src/offline-transport.js` | Create | Route parser + offline mutation queue factory |
| `packages/offline/src/__tests__/offline-transport.test.js` | Create | 5 node:test tests |
| `packages/sdk/src/index.js` | Modify | Add `setOfflineTransport()` + intercept in `request()` |
| `packages/offline/src/offline-provider.jsx` | Modify | Create transport, `onTransportReady` prop, `runSync` |
| `apps/desktop/src/app/AtlasApp.jsx` | Modify | Pass `onTransportReady` to wire transport into SDK |
| `packages/offline/src/use-pending-mutations.js` | Create | Hook polling `mutation_queue` for active items |
| `packages/offline/src/index.js` | Modify | Add exports |
| `packages/ui/src/components/PendingMutationsPanel.jsx` | Create | UI list of queued/failed mutations |
| `packages/ui/src/index.js` | Modify | Add export |

---

### Task 1: `MutationQueue` class

**Files:**
- Create: `packages/offline/src/mutation-queue.js`
- Create: `packages/offline/src/__tests__/mutation-queue.test.js`

- [ ] **Step 1: Write failing tests**

Create `packages/offline/src/__tests__/mutation-queue.test.js`:

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { MutationQueue } from '../mutation-queue.js'

let dbCounter = 0
function makeDb() {
  return new AtlasOfflineDatabase(`test-mq-${++dbCounter}`)
}

const ITEM = {
  id: 'mut-1',
  idempotencyKey: 'ik-1',
  moduleKey: 'atlas.contacts',
  entityType: 'contact',
  recordId: null,
  operation: 'CREATE',
  payload: { name: 'Ana' },
  companyId: 'co-1',
  userId: 'u-1',
}

describe('MutationQueue', () => {
  let db
  let queue

  beforeEach(async () => {
    db = makeDb()
    await db.open()
    queue = new MutationQueue({ db })
  })

  afterEach(async () => {
    await db.delete().catch(() => {})
  })

  it('enqueue puts record with PENDING status and queuedAt', async () => {
    await queue.enqueue(ITEM)
    const row = await db.mutation_queue.get('mut-1')
    assert.ok(row)
    assert.equal(row.status, 'PENDING')
    assert.equal(row.attempts, 0)
    assert.ok(row.queuedAt)
    assert.equal(row.lastError, null)
  })

  it('getPending returns only PENDING items sorted by queuedAt', async () => {
    await queue.enqueue({ ...ITEM, id: 'mut-a', queuedAt: undefined })
    await queue.enqueue({ ...ITEM, id: 'mut-b', idempotencyKey: 'ik-2', queuedAt: undefined })
    await db.mutation_queue.update('mut-b', { status: 'DONE' })
    const pending = await queue.getPending()
    assert.equal(pending.length, 1)
    assert.equal(pending[0].id, 'mut-a')
  })

  it('markDone sets status to DONE', async () => {
    await queue.enqueue(ITEM)
    await queue.markDone('mut-1')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row.status, 'DONE')
  })

  it('markFailed with attempts < 3 keeps status PENDING and increments attempts', async () => {
    await queue.enqueue(ITEM)
    await queue.markFailed('mut-1', 'Network error')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row.status, 'PENDING')
    assert.equal(row.attempts, 1)
    assert.equal(row.lastError, 'Network error')
  })

  it('markFailed at attempt 3 sets status to FAILED', async () => {
    await queue.enqueue(ITEM)
    await queue.markFailed('mut-1', 'err')
    await queue.markFailed('mut-1', 'err')
    await queue.markFailed('mut-1', 'err')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row.status, 'FAILED')
    assert.equal(row.attempts, 3)
  })

  it('markConflict sets status to CONFLICT', async () => {
    await queue.enqueue(ITEM)
    await queue.markConflict('mut-1', 'Conflicto del servidor')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row.status, 'CONFLICT')
    assert.equal(row.lastError, 'Conflicto del servidor')
  })

  it('getPendingCount includes PENDING + SYNCING + CONFLICT + FAILED', async () => {
    await queue.enqueue({ ...ITEM, id: 'a', idempotencyKey: 'ik-a' })
    await queue.enqueue({ ...ITEM, id: 'b', idempotencyKey: 'ik-b' })
    await queue.enqueue({ ...ITEM, id: 'c', idempotencyKey: 'ik-c' })
    await queue.enqueue({ ...ITEM, id: 'd', idempotencyKey: 'ik-d' })
    await db.mutation_queue.update('b', { status: 'SYNCING' })
    await db.mutation_queue.update('c', { status: 'CONFLICT' })
    await db.mutation_queue.update('d', { status: 'FAILED' })
    const count = await queue.getPendingCount()
    assert.equal(count, 4)
  })

  it('discard removes the entry from the queue', async () => {
    await queue.enqueue(ITEM)
    await queue.discard('mut-1')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row, undefined)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
node --test packages/offline/src/__tests__/mutation-queue.test.js
```

Expected: `Error: Cannot find module '../mutation-queue.js'`

- [ ] **Step 3: Implement `mutation-queue.js`**

Create `packages/offline/src/mutation-queue.js`:

```javascript
export class MutationQueue {
  #db

  constructor({ db }) {
    this.#db = db
  }

  async enqueue({ id, idempotencyKey, moduleKey, entityType, recordId, operation, payload, companyId, userId }) {
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

- [ ] **Step 4: Run tests and verify all 8 pass**

```bash
node --test packages/offline/src/__tests__/mutation-queue.test.js
```

Expected: `8 passing`

- [ ] **Step 5: Commit**

```bash
git add packages/offline/src/mutation-queue.js packages/offline/src/__tests__/mutation-queue.test.js
git commit -m "feat(offline): add MutationQueue class with enqueue/markDone/markFailed/markConflict"
```

---

### Task 2: `SyncEngine.push()` method

**Files:**
- Modify: `packages/offline/src/sync-engine.js`
- Modify: `packages/offline/src/__tests__/sync-engine.test.js`

- [ ] **Step 1: Write the failing push tests**

Add these 8 tests to the END of the existing `describe('SyncEngine', ...)` block in `packages/offline/src/__tests__/sync-engine.test.js`:

```javascript
  // ─── push() tests ───────────────────────────────────────────────────────────

  it('push returns { pushed: 0, failed: 0 } when mutation queue is empty', async () => {
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: makeFetch({ results: [] }),
    })
    const result = await engine.push()
    assert.deepEqual(result, { pushed: 0, failed: 0 })
  })

  it('push returns { pushed: 0, failed: 0 } when getToken returns null', async () => {
    await db.mutation_queue.put({
      id: 'mut-1', idempotencyKey: 'ik-1', moduleKey: 'atlas.contacts',
      entityType: 'contact', recordId: null, operation: 'CREATE',
      payload: { name: 'X' }, status: 'PENDING', queuedAt: '2026-06-06T10:00:00Z',
      attempts: 0, lastError: null, companyId: COMPANY_ID, userId: 'u1',
    })
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => null,
      fetchImpl: async () => { throw new Error('should not be called') },
    })
    const result = await engine.push()
    assert.deepEqual(result, { pushed: 0, failed: 0 })
  })

  it('concurrent push calls are coalesced — second returns immediately', async () => {
    await db.mutation_queue.put({
      id: 'mut-1', idempotencyKey: 'ik-1', moduleKey: 'atlas.contacts',
      entityType: 'contact', recordId: null, operation: 'CREATE',
      payload: {}, status: 'PENDING', queuedAt: '2026-06-06T10:00:00Z',
      attempts: 0, lastError: null, companyId: COMPANY_ID, userId: 'u1',
    })

    let resolvePush
    const fetchImpl = async () => {
      await new Promise((resolve) => { resolvePush = resolve })
      return { ok: true, json: async () => ({ results: [{ idempotencyKey: 'ik-1', status: 'OK', record: { id: 'c1', companyId: COMPANY_ID, updatedAt: '2026-06-06T10:00:00Z' } }] }) }
    }
    const engine = new SyncEngine({ db, apiBaseUrl: 'http://localhost:4010', getToken: async () => 'tok', fetchImpl })

    const first = engine.push()
    const second = await engine.push()
    assert.deepEqual(second, { pushed: 0, failed: 0 })

    while (typeof resolvePush !== 'function') {
      await new Promise((r) => setImmediate(r))
    }
    resolvePush()
    await first
  })

  it('successful OK result marks mutation DONE and updates offline_records', async () => {
    await db.mutation_queue.put({
      id: 'mut-1', idempotencyKey: 'ik-1', moduleKey: 'atlas.contacts',
      entityType: 'contact', recordId: null, operation: 'CREATE',
      payload: { name: 'Ana' }, status: 'PENDING', queuedAt: '2026-06-06T10:00:00Z',
      attempts: 0, lastError: null, companyId: COMPANY_ID, userId: 'u1',
    })

    const serverRecord = { id: 'srv-c1', companyId: COMPANY_ID, name: 'Ana', updatedAt: '2026-06-06T10:00:00Z' }
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: async (_url, opts) => {
        assert.ok(opts.method === 'POST')
        return { ok: true, json: async () => ({ results: [{ idempotencyKey: 'ik-1', status: 'OK', record: serverRecord }] }) }
      },
    })

    const result = await engine.push()
    assert.deepEqual(result, { pushed: 1, failed: 0 })

    const mut = await db.mutation_queue.get('mut-1')
    assert.equal(mut.status, 'DONE')

    const stored = await db.offline_records.get(['atlas.contacts', 'contact', 'srv-c1'])
    assert.ok(stored)
    assert.equal(stored.dirty, false)
    assert.equal(stored.data.name, 'Ana')
  })

  it('CONFLICT result marks mutation CONFLICT', async () => {
    await db.mutation_queue.put({
      id: 'mut-1', idempotencyKey: 'ik-1', moduleKey: 'atlas.contacts',
      entityType: 'contact', recordId: 'c1', operation: 'UPDATE',
      payload: { name: 'New' }, status: 'PENDING', queuedAt: '2026-06-06T10:00:00Z',
      attempts: 0, lastError: null, companyId: COMPANY_ID, userId: 'u1',
    })

    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ results: [{ idempotencyKey: 'ik-1', status: 'CONFLICT', record: null }] }),
      }),
    })

    const result = await engine.push()
    assert.deepEqual(result, { pushed: 0, failed: 1 })

    const mut = await db.mutation_queue.get('mut-1')
    assert.equal(mut.status, 'CONFLICT')
  })

  it('non-OK HTTP response marks all pending as failed', async () => {
    await db.mutation_queue.put({
      id: 'mut-1', idempotencyKey: 'ik-1', moduleKey: 'atlas.contacts',
      entityType: 'contact', recordId: null, operation: 'CREATE',
      payload: {}, status: 'PENDING', queuedAt: '2026-06-06T10:00:00Z',
      attempts: 0, lastError: null, companyId: COMPANY_ID, userId: 'u1',
    })

    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    })

    await assert.rejects(() => engine.push(), /Push failed/)
    const mut = await db.mutation_queue.get('mut-1')
    assert.equal(mut.attempts, 1)
  })

  it('NOT_FOUND result increments attempts via markFailed', async () => {
    await db.mutation_queue.put({
      id: 'mut-1', idempotencyKey: 'ik-1', moduleKey: 'atlas.contacts',
      entityType: 'contact', recordId: 'ghost', operation: 'UPDATE',
      payload: {}, status: 'PENDING', queuedAt: '2026-06-06T10:00:00Z',
      attempts: 0, lastError: null, companyId: COMPANY_ID, userId: 'u1',
    })

    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ results: [{ idempotencyKey: 'ik-1', status: 'NOT_FOUND', record: null }] }),
      }),
    })

    const result = await engine.push()
    assert.deepEqual(result, { pushed: 0, failed: 1 })
    const mut = await db.mutation_queue.get('mut-1')
    assert.equal(mut.attempts, 1)
  })

  it('batch with OK + CONFLICT returns correct pushed/failed counts', async () => {
    await db.mutation_queue.put({
      id: 'mut-a', idempotencyKey: 'ik-a', moduleKey: 'atlas.contacts',
      entityType: 'contact', recordId: null, operation: 'CREATE',
      payload: {}, status: 'PENDING', queuedAt: '2026-06-06T10:00:00Z',
      attempts: 0, lastError: null, companyId: COMPANY_ID, userId: 'u1',
    })
    await db.mutation_queue.put({
      id: 'mut-b', idempotencyKey: 'ik-b', moduleKey: 'atlas.contacts',
      entityType: 'contact', recordId: 'c2', operation: 'UPDATE',
      payload: {}, status: 'PENDING', queuedAt: '2026-06-06T10:01:00Z',
      attempts: 0, lastError: null, companyId: COMPANY_ID, userId: 'u1',
    })

    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          results: [
            { idempotencyKey: 'ik-a', status: 'OK', record: { id: 'srv-a', companyId: COMPANY_ID, updatedAt: '2026-06-06T10:00:00Z' } },
            { idempotencyKey: 'ik-b', status: 'CONFLICT', record: null },
          ],
        }),
      }),
    })

    const result = await engine.push()
    assert.deepEqual(result, { pushed: 1, failed: 1 })
  })
```

- [ ] **Step 2: Run the tests to see failures**

```bash
node --test packages/offline/src/__tests__/sync-engine.test.js
```

Expected: existing 8 tests pass, new 8 push tests fail with `engine.push is not a function`.

- [ ] **Step 3: Modify `sync-engine.js` to add `push()`**

The full updated `packages/offline/src/sync-engine.js` (keep the entire existing `pull()` and `getLocalCount()` methods, add import and new fields/method):

```javascript
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
          await this.#mutationQueue.markConflict(item.id, JSON.stringify(result))
          failed++
        } else {
          await this.#mutationQueue.markFailed(item.id, result.status ?? 'Error')
          failed++
        }
      }

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

- [ ] **Step 4: Run all sync-engine tests and verify 16 pass**

```bash
node --test packages/offline/src/__tests__/sync-engine.test.js
```

Expected: `16 passing` (8 original pull tests + 8 new push tests).

- [ ] **Step 5: Commit**

```bash
git add packages/offline/src/sync-engine.js packages/offline/src/__tests__/sync-engine.test.js
git commit -m "feat(offline): add SyncEngine.push() — drains mutation queue to /sync/push"
```

---

### Task 3: `createOfflineTransport` factory

**Files:**
- Create: `packages/offline/src/offline-transport.js`
- Create: `packages/offline/src/__tests__/offline-transport.test.js`

- [ ] **Step 1: Write failing tests**

Create `packages/offline/src/__tests__/offline-transport.test.js`:

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { createOfflineTransport, parseMutationRoute } from '../offline-transport.js'

let dbCounter = 0
function makeDb() {
  return new AtlasOfflineDatabase(`test-transport-${++dbCounter}`)
}

const SESSION = {
  companyId: 'co-1',
  userProfile: { id: 'u-1' },
  accessToken: 'tok',
}

describe('parseMutationRoute', () => {
  it('maps POST /contacts to atlas.contacts CREATE', () => {
    const result = parseMutationRoute('/contacts', 'POST')
    assert.deepEqual(result, { moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null })
  })

  it('maps PATCH /contacts/:id to atlas.contacts UPDATE', () => {
    const result = parseMutationRoute('/contacts/abc-123', 'PUT')
    assert.deepEqual(result, { moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: 'abc-123' })
  })

  it('maps POST /fleet/vehicles to custom.fleet vehicle CREATE', () => {
    const result = parseMutationRoute('/fleet/vehicles', 'POST')
    assert.deepEqual(result, { moduleKey: 'custom.fleet', entityType: 'vehicle', operation: 'CREATE', recordId: null })
  })

  it('returns null for unmapped paths', () => {
    const result = parseMutationRoute('/finance/accounts', 'POST')
    assert.equal(result, null)
  })
})

describe('createOfflineTransport.queue', () => {
  let db
  let transport

  beforeEach(async () => {
    db = makeDb()
    await db.open()
    transport = createOfflineTransport({ db, getSession: async () => SESSION })
  })

  afterEach(async () => {
    await db.delete().catch(() => {})
  })

  it('queue enqueues mutation with PENDING status for a CREATE', async () => {
    const result = await transport.queue('/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ana', type: 'person' }),
    })
    assert.ok(result?.queued)
    const items = await db.mutation_queue.toArray()
    assert.equal(items.length, 1)
    assert.equal(items[0].status, 'PENDING')
    assert.equal(items[0].moduleKey, 'atlas.contacts')
    assert.equal(items[0].operation, 'CREATE')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
node --test packages/offline/src/__tests__/offline-transport.test.js
```

Expected: `Error: Cannot find module '../offline-transport.js'`

- [ ] **Step 3: Implement `offline-transport.js`**

Create `packages/offline/src/offline-transport.js`:

```javascript
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
  // Strip query string before matching
  const cleanPath = path.split('?')[0]
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
      payload = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
    }

    const id = crypto.randomUUID()
    const idempotencyKey = crypto.randomUUID()

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
    })

    // Optimistic update: apply the change to offline_records immediately
    if (operation === 'UPDATE' && recordId) {
      const existing = await db.offline_records.get([moduleKey, entityType, recordId])
      if (existing) {
        await db.offline_records.put({ ...existing, data: { ...existing.data, ...payload }, dirty: true })
      }
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

- [ ] **Step 4: Run all offline-transport tests and verify 5 pass**

```bash
node --test packages/offline/src/__tests__/offline-transport.test.js
```

Expected: `5 passing`

- [ ] **Step 5: Commit**

```bash
git add packages/offline/src/offline-transport.js packages/offline/src/__tests__/offline-transport.test.js
git commit -m "feat(offline): add createOfflineTransport with route parser and optimistic updates"
```

---

### Task 4: SDK intercept + OfflineProvider + AtlasApp wiring

**Files:**
- Modify: `packages/sdk/src/index.js`
- Modify: `packages/offline/src/offline-provider.jsx`
- Modify: `apps/desktop/src/app/AtlasApp.jsx`

- [ ] **Step 1: Add `setOfflineTransport` to SDK**

In `packages/sdk/src/index.js`, the `createAtlasClient` function starts at line 1. Add a closure variable and modify `request()`.

Add `let _offlineTransport = null` after the opening `export function createAtlasClient({ baseUrl }) {` line.

Modify the `request` function. Currently it starts:
```javascript
  async function request(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(`${baseUrl}${path}`, {
```

Change it to:
```javascript
  async function request(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const method = (options.method ?? 'GET').toUpperCase();
    const MUTATION_METHODS = ['POST', 'PUT', 'PATCH'];
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!isOnline && _offlineTransport && MUTATION_METHODS.includes(method) && !isFormData) {
      const queued = await _offlineTransport.queue(path, options);
      if (queued) return queued;
    }
    const response = await fetch(`${baseUrl}${path}`, {
```

Then in the return object at the bottom of `createAtlasClient`, add `setOfflineTransport` as the last entry before the closing `}`:
```javascript
    setOfflineTransport(transport) {
      _offlineTransport = transport;
    },
```

- [ ] **Step 2: Verify SDK syntax**

```bash
node --check packages/sdk/src/index.js
```

Expected: no output.

- [ ] **Step 3: Update `offline-provider.jsx` to create transport, add `onTransportReady` prop, and integrate `runSync`**

Replace the entire contents of `packages/offline/src/offline-provider.jsx` with:

```javascript
import { createContext, useContext, useEffect, useRef } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { AtlasOfflineDatabase } from './db.js'
import { OnlineDetector } from './online-detector.js'
import { SessionVault } from './session-vault.js'
import { SyncEngine } from './sync-engine.js'
import { createOfflineTransport } from './offline-transport.js'
import { useOfflineStore } from './offline-store.js'

// Tier 1 modules synced on every cycle.
// Phase 4 will derive this list from installed module manifests with offline.enabled = true.
const OFFLINE_MODULES = ['atlas.contacts', 'atlas.hr', 'custom.fleet']

const PULL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

const OfflineContext = createContext(null)

export function OfflineProvider({ children, apiBaseUrl, onTransportReady }) {
  const detectorRef = useRef(null)
  const dbRef = useRef(null)
  const engineRef = useRef(null)
  const intervalRef = useRef(null)

  const setOnline = useOfflineStore((s) => s.setOnline)
  const setLastSyncAt = useOfflineStore((s) => s.setLastSyncAt)
  const setSyncing = useOfflineStore((s) => s.setSyncing)
  const setPendingCount = useOfflineStore((s) => s.setPendingCount)

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

    const transport = createOfflineTransport({
      db: database,
      getSession: () => vault.load(),
    })

    if (onTransportReady) {
      onTransportReady(transport)
    }

    async function updatePendingCount() {
      try {
        const count = await transport.mutationQueue.getPendingCount()
        setPendingCount(count)
      } catch {}
    }

    async function runSync() {
      setSyncing(true)
      try {
        // Push first, then pull — so the server sees our changes before we refresh
        await engine.push().catch((err) => {
          console.warn('[atlas/offline] Push failed', err?.message ?? err)
        })
        await engine.pull({ modules: OFFLINE_MODULES })
        setLastSyncAt(new Date().toISOString())
      } catch (err) {
        console.warn('[atlas/offline] Pull failed', err?.message ?? err)
      } finally {
        setSyncing(false)
        await updatePendingCount()
      }
    }

    const detector = new OnlineDetector({
      probeUrl: apiBaseUrl ? `${apiBaseUrl}/health` : null,
    })
    detectorRef.current = detector

    const initialOnline = detector.isOnline()
    setOnline(initialOnline)
    onlineManager.setOnline(initialOnline)

    detector.onChange((isOnline) => {
      setOnline(isOnline)
      onlineManager.setOnline(isOnline)
      if (isOnline) runSync()
    })

    intervalRef.current = setInterval(() => {
      if (detector.isOnline()) runSync()
    }, PULL_INTERVAL_MS)

    if (initialOnline) runSync()

    return () => {
      detector.destroy()
      database.close()
      clearInterval(intervalRef.current)
    }
  }, [apiBaseUrl, setOnline, setLastSyncAt, setSyncing, setPendingCount, onTransportReady])

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

- [ ] **Step 4: Update `AtlasApp.jsx` to wire the transport into the SDK**

In `apps/desktop/src/app/AtlasApp.jsx`, add the import for `atlas`:

After the existing imports (around line 14), add:
```javascript
import { atlas } from '../lib/atlas.js'
```

Then modify the `<OfflineProvider>` usage (currently at line 235) from:
```javascript
    <OfflineProvider apiBaseUrl={apiBaseUrl}>
```
to:
```javascript
    <OfflineProvider apiBaseUrl={apiBaseUrl} onTransportReady={(t) => atlas.setOfflineTransport(t)}>
```

- [ ] **Step 5: Verify the build still passes**

```bash
cd apps/desktop && pnpm exec vite build 2>&1 | tail -5
```

Expected: ends with `✓ built in` — no errors. JSX files cannot be checked with `node --check`; the Vite build is the correct check for `.jsx` files.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/index.js packages/offline/src/offline-provider.jsx apps/desktop/src/app/AtlasApp.jsx
git commit -m "feat(offline): wire offline transport into SDK and OfflineProvider"
```

---

### Task 5: `usePendingMutations` hook + package exports

**Files:**
- Create: `packages/offline/src/use-pending-mutations.js`
- Modify: `packages/offline/src/index.js`

- [ ] **Step 1: Create `use-pending-mutations.js`**

Create `packages/offline/src/use-pending-mutations.js`:

```javascript
import { useState, useEffect } from 'react'
import { useOfflineContext } from './offline-provider.jsx'

const ACTIVE_STATUSES = ['PENDING', 'SYNCING', 'CONFLICT', 'FAILED']
const POLL_INTERVAL_MS = 3000

export function usePendingMutations() {
  const ctx = useOfflineContext()
  const [mutations, setMutations] = useState([])

  useEffect(() => {
    if (!ctx?.dbRef?.current) return
    const db = ctx.dbRef.current
    let mounted = true

    async function load() {
      try {
        const items = await db.mutation_queue
          .where('status')
          .anyOf(ACTIVE_STATUSES)
          .sortBy('queuedAt')
        if (mounted) setMutations(items)
      } catch {}
    }

    load()
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [ctx?.dbRef])

  return mutations
}
```

- [ ] **Step 2: Add exports to `packages/offline/src/index.js`**

The current `packages/offline/src/index.js` ends with:
```javascript
export { useOfflineStatus } from './use-offline-status.js'
```

Add after that line:
```javascript
export { MutationQueue } from './mutation-queue.js'
export { createOfflineTransport, parseMutationRoute } from './offline-transport.js'
export { usePendingMutations } from './use-pending-mutations.js'
```

- [ ] **Step 3: Verify syntax**

```bash
node --check packages/offline/src/use-pending-mutations.js
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/offline/src/use-pending-mutations.js packages/offline/src/index.js
git commit -m "feat(offline): add usePendingMutations hook and update @atlas/offline exports"
```

---

### Task 6: `PendingMutationsPanel` component + `@atlas/ui` export

**Files:**
- Create: `packages/ui/src/components/PendingMutationsPanel.jsx`
- Modify: `packages/ui/src/index.js`

- [ ] **Step 1: Create the component**

Create `packages/ui/src/components/PendingMutationsPanel.jsx`:

```jsx
import { RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from './Badge.jsx'
import { Button } from './Button.jsx'
import { EmptyState } from './EmptyState.jsx'

const STATUS_LABEL = {
  PENDING: 'Pendiente',
  SYNCING: 'Sincronizando',
  CONFLICT: 'Conflicto',
  FAILED: 'Error',
}

const STATUS_VARIANT = {
  PENDING: 'secondary',
  SYNCING: 'outline',
  CONFLICT: 'destructive',
  FAILED: 'destructive',
}

const OP_LABEL = {
  CREATE: 'Crear',
  UPDATE: 'Actualizar',
  DELETE: 'Eliminar',
}

export function PendingMutationsPanel({ mutations = [], onRetry, onDiscard }) {
  if (mutations.length === 0) {
    return (
      <EmptyState
        title="Sin cambios pendientes"
        description="Todos los cambios estan sincronizados."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {mutations.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant={STATUS_VARIANT[m.status] ?? 'secondary'}>
              {STATUS_LABEL[m.status] ?? m.status}
            </Badge>
            <span className="font-medium truncate text-[hsl(var(--foreground))]">
              {OP_LABEL[m.operation] ?? m.operation} {m.entityType}
            </span>
            {m.lastError && (
              <span
                className="hidden md:inline text-xs text-[hsl(var(--muted-foreground))] max-w-45 truncate"
                title={m.lastError}
              >
                {m.lastError}
              </span>
            )}
          </div>
          {(m.status === 'FAILED' || m.status === 'CONFLICT') && (
            <div className="flex shrink-0 items-center gap-1 ml-2">
              {onRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRetry(m.id)}
                  title="Reintentar"
                >
                  <RefreshCw size={13} />
                </Button>
              )}
              {onDiscard && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[hsl(var(--destructive))]"
                  onClick={() => onDiscard(m.id)}
                  title="Descartar"
                >
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add export to `packages/ui/src/index.js`**

The current `packages/ui/src/index.js` ends with:
```javascript
export { SyncStatusBar } from "./components/SyncStatusBar.jsx";
```

Add after that line:
```javascript
export { PendingMutationsPanel } from "./components/PendingMutationsPanel.jsx";
```

- [ ] **Step 3: Run Vite build to verify no compile errors**

```bash
cd apps/desktop && pnpm exec vite build 2>&1 | tail -5
```

Expected: ends with `✓ built in` — no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/PendingMutationsPanel.jsx packages/ui/src/index.js
git commit -m "feat(offline): add PendingMutationsPanel component to @atlas/ui"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|---|---|
| `mutation_queue` local IndexedDB table (already existed in db.js) | Pre-existing |
| `MutationQueue` class with enqueue/markDone/markFailed/markConflict | Task 1 |
| `SyncEngine.push()` drains queue to POST /sync/push | Task 2 |
| Idempotency key in each mutation | Task 2 (`idempotencyKey` field in mutations array) |
| Server OK → mark DONE, update offline_records | Task 2 |
| Server CONFLICT → mark CONFLICT | Task 2 |
| Server error → increment attempts via markFailed | Task 2 |
| `createOfflineTransport` with route parser | Task 3 |
| Optimistic UPDATE to offline_records on enqueue | Task 3 |
| Optimistic CREATE inserts into offline_records | Task 3 |
| SDK `setOfflineTransport` intercept | Task 4 |
| `OfflineProvider` push-then-pull on reconnect | Task 4 |
| `pendingCount` in Zustand store updated after each sync | Task 4 |
| `usePendingMutations` hook | Task 5 |
| `PendingMutationsPanel` with retry/discard | Task 6 |
| Retry button calls `onRetry(id)` | Task 6 |
| Discard button calls `onDiscard(id)` | Task 6 |

### Data flow summary (for verification)

```
User submits form (online)  → SDK.request() → fetch() normally
User submits form (offline) → SDK.request() → offlineTransport.queue()
                               → MutationQueue.enqueue() (PENDING)
                               → offline_records optimistic update (dirty: true)
                               → returns { queued: true }

Reconnect event fires       → OfflineProvider.runSync()
                               → SyncEngine.push() → POST /sync/push
                                  → results: OK → markDone + offline_records updated
                                  → results: CONFLICT → markConflict
                                  → http error → markFailed (attempts++)
                               → SyncEngine.pull() → GET /sync/pull
                               → setLastSyncAt + setPendingCount

PendingMutationsPanel       → usePendingMutations() polls mutation_queue every 3s
                               → shows PENDING/SYNCING/CONFLICT/FAILED rows
                               → FAILED/CONFLICT: Reintentar → mutationQueue.resetToRetry()
                               → FAILED/CONFLICT: Descartar → mutationQueue.discard()
```

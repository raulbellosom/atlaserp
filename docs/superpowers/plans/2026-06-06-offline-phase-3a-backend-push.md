# Offline Phase 3A — Backend Push Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `SyncMutationLog` Prisma model, implement `POST /sync/push` endpoint, and add worker cleanup for expired log rows.

**Architecture:** The push endpoint receives batches of offline mutations, checks idempotency, applies them with last-write-wins strategy for Tier 1 modules (atlas.contacts, atlas.hr, custom.fleet), and logs each applied mutation in `SyncMutationLog` for 72h. The worker deletes expired log rows every 6 hours.

**Tech Stack:** Node.js, Hono, Prisma 7, node:test (no Vitest/Jest)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/migrations/20260606100000_add_sync_mutation_log/migration.sql` | Create | SQL for the new table |
| `prisma/schema.prisma` | Modify (append) | Add `SyncMutationLog` Prisma model |
| `apps/api/src/services/sync-push-service.js` | Create | Push business logic + idempotency |
| `apps/api/src/services/__tests__/sync-push-service.test.js` | Create | 10 node:test tests |
| `apps/api/src/routes/sync.js` | Modify | Add `POST /sync/push` handler |
| `apps/api/src/services/sync-cleanup-worker.js` | Create | Deletes expired `SyncMutationLog` rows |
| `apps/worker/src/index.js` | Modify | Register cleanup job on 6h interval |

---

### Task 1: `SyncMutationLog` Prisma model + migration

**Files:**
- Create: `prisma/migrations/20260606100000_add_sync_mutation_log/migration.sql`
- Modify: `prisma/schema.prisma` (append after `SyncCursor` at line 1453)

- [ ] **Step 1: Create migration directory and SQL file**

Create `prisma/migrations/20260606100000_add_sync_mutation_log/migration.sql` with this exact content:

```sql
CREATE TABLE "sync_mutation_log" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "idempotency_key" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "module_key" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "record_id" UUID,
  "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sync_mutation_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sync_mutation_log_idempotency_key_key" ON "sync_mutation_log"("idempotency_key");
CREATE INDEX "sync_mutation_log_idempotency_key_idx" ON "sync_mutation_log"("idempotency_key");
CREATE INDEX "sync_mutation_log_company_id_applied_at_idx" ON "sync_mutation_log"("company_id", "applied_at");
```

- [ ] **Step 2: Append `SyncMutationLog` to `prisma/schema.prisma`**

After the closing `}` of the `SyncCursor` model (currently at line 1453), append:

```prisma
model SyncMutationLog {
  id             String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  idempotencyKey String   @unique @db.Uuid @map("idempotency_key")
  companyId      String   @db.Uuid @map("company_id")
  userId         String   @db.Uuid @map("user_id")
  moduleKey      String   @map("module_key")
  entityType     String   @map("entity_type")
  operation      String
  recordId       String?  @db.Uuid @map("record_id")
  appliedAt      DateTime @default(now()) @map("applied_at")
  expiresAt      DateTime @map("expires_at")

  @@index([idempotencyKey])
  @@index([companyId, appliedAt])
  @@map("sync_mutation_log")
}
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm db:generate
```

Expected output: `✔ Generated Prisma Client` with no errors. If it fails check for typos in the schema.

- [ ] **Step 4: Verify `prisma.syncMutationLog` is accessible**

Run a quick syntax check:

```bash
node --check apps/api/src/services/sync-service.js
```

Expected: no output (clean). The Prisma client regeneration makes `syncMutationLog` available.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/20260606100000_add_sync_mutation_log/migration.sql prisma/schema.prisma
git commit -m "feat(offline): add SyncMutationLog Prisma model and migration"
```

---

### Task 2: `sync-push-service.js` with tests

**Files:**
- Create: `apps/api/src/services/sync-push-service.js`
- Create: `apps/api/src/services/__tests__/sync-push-service.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `apps/api/src/services/__tests__/sync-push-service.test.js`:

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createSyncPushService, SyncPushServiceError } from '../sync-push-service.js'

const COMPANY_ID = '01900000-0000-7000-8000-000000000001'
const USER_ID = '01900000-0000-7000-8000-000000000002'
const IK = '01900000-0000-7000-8000-000000000099'
const RECORD_ID = '01900000-0000-7000-8000-000000000010'
const now = new Date()

function makePrisma(overrides = {}) {
  return {
    userProfile: {
      findUnique: async () => ({ id: USER_ID }),
      ...(overrides.userProfile ?? {}),
    },
    membership: {
      findFirst: async () => ({ companyId: COMPANY_ID }),
      ...(overrides.membership ?? {}),
    },
    syncMutationLog: {
      findUnique: async () => null,
      create: async (args) => ({ id: 'log-1', ...args.data }),
      ...(overrides.syncMutationLog ?? {}),
    },
    contact: {
      findUnique: async ({ where }) => ({
        id: where.id,
        companyId: COMPANY_ID,
        name: 'Ana',
        type: 'person',
        updatedAt: now,
        createdAt: now,
      }),
      create: async ({ data }) => ({ id: data.id ?? 'new-c1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, companyId: COMPANY_ID, updatedAt: now, ...data }),
      ...(overrides.contact ?? {}),
    },
    hrEmployee: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'e1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.hrEmployee ?? {}),
    },
    hrDepartment: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'd1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.hrDepartment ?? {}),
    },
    hrJobTitle: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'jt1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.hrJobTitle ?? {}),
    },
    fleetVehicle: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'v1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.fleetVehicle ?? {}),
    },
    fleetDriver: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'dr1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.fleetDriver ?? {}),
    },
  }
}

describe('sync-push-service', () => {
  it('returns empty results when mutations array is empty', async () => {
    const svc = createSyncPushService({ prisma: makePrisma() })
    const result = await svc.push({ authUserId: USER_ID, mutations: [] })
    assert.deepEqual(result, { results: [] })
  })

  it('throws profile_not_found when user has no profile', async () => {
    const prisma = makePrisma({ userProfile: { findUnique: async () => null } })
    const svc = createSyncPushService({ prisma })
    await assert.rejects(
      () => svc.push({ authUserId: USER_ID, mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null, payload: { name: 'X', type: 'person' } }] }),
      (err) => err instanceof SyncPushServiceError && err.code === 'profile_not_found',
    )
  })

  it('throws no_active_company when user has no membership', async () => {
    const prisma = makePrisma({ membership: { findFirst: async () => null } })
    const svc = createSyncPushService({ prisma })
    await assert.rejects(
      () => svc.push({ authUserId: USER_ID, mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null, payload: {} }] }),
      (err) => err instanceof SyncPushServiceError && err.code === 'no_active_company',
    )
  })

  it('returns OK without re-applying when idempotencyKey already in SyncMutationLog', async () => {
    const prisma = makePrisma({
      syncMutationLog: { findUnique: async () => ({ id: 'log-1', idempotencyKey: IK, recordId: RECORD_ID }) },
      contact: { findUnique: async ({ where }) => ({ id: where.id, companyId: COMPANY_ID, name: 'Ana', updatedAt: now }) },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: RECORD_ID, payload: { name: 'Ana' } }],
    })
    assert.equal(result.results.length, 1)
    assert.equal(result.results[0].status, 'OK')
  })

  it('CREATE contact returns OK with the created record', async () => {
    let createCalled = false
    const prisma = makePrisma({
      contact: {
        findUnique: async () => null,
        create: async ({ data }) => { createCalled = true; return { id: 'new-c1', updatedAt: now, ...data } },
        update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null, payload: { name: 'Bob', type: 'person' } }],
    })
    assert.equal(result.results.length, 1)
    assert.equal(result.results[0].status, 'OK')
    assert.ok(result.results[0].record)
    assert.ok(createCalled)
  })

  it('UPDATE contact returns OK with the updated record', async () => {
    let updateCalled = false
    const prisma = makePrisma({
      contact: {
        findUnique: async ({ where }) => ({ id: where.id, companyId: COMPANY_ID, name: 'Old', updatedAt: now }),
        create: async ({ data }) => ({ id: 'x', updatedAt: now, ...data }),
        update: async ({ where, data }) => { updateCalled = true; return { id: where.id, companyId: COMPANY_ID, updatedAt: now, ...data } },
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: RECORD_ID, payload: { name: 'New' } }],
    })
    assert.equal(result.results[0].status, 'OK')
    assert.equal(result.results[0].record.name, 'New')
    assert.ok(updateCalled)
  })

  it('UPDATE on nonexistent record returns NOT_FOUND', async () => {
    const prisma = makePrisma({
      contact: {
        findUnique: async () => null,
        create: async ({ data }) => ({ id: 'x', updatedAt: now, ...data }),
        update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: 'nonexistent-id', payload: {} }],
    })
    assert.equal(result.results[0].status, 'NOT_FOUND')
  })

  it('UPDATE on record from different company returns PERMISSION_DENIED', async () => {
    const OTHER_COMPANY = '01900000-0000-7000-8000-000000000999'
    const prisma = makePrisma({
      contact: {
        findUnique: async ({ where }) => ({ id: where.id, companyId: OTHER_COMPANY, name: 'X', updatedAt: now }),
        create: async ({ data }) => ({ id: 'x', updatedAt: now, ...data }),
        update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: RECORD_ID, payload: {} }],
    })
    assert.equal(result.results[0].status, 'PERMISSION_DENIED')
  })

  it('unknown moduleKey returns ERROR result', async () => {
    const svc = createSyncPushService({ prisma: makePrisma() })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.unknown_xyz', entityType: 'widget', operation: 'CREATE', recordId: null, payload: {} }],
    })
    assert.equal(result.results[0].status, 'ERROR')
  })

  it('unsupported operation returns ERROR result', async () => {
    const svc = createSyncPushService({ prisma: makePrisma() })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'DELETE', recordId: RECORD_ID, payload: {} }],
    })
    assert.equal(result.results[0].status, 'ERROR')
  })

  it('batch with CREATE + UPDATE returns two results in order', async () => {
    const IK2 = '01900000-0000-7000-8000-000000000098'
    const svc = createSyncPushService({ prisma: makePrisma() })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [
        { idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null, payload: { name: 'New1', type: 'person' } },
        { idempotencyKey: IK2, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: RECORD_ID, payload: { name: 'Updated' } },
      ],
    })
    assert.equal(result.results.length, 2)
    assert.equal(result.results[0].status, 'OK')
    assert.equal(result.results[1].status, 'OK')
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
node --test apps/api/src/services/__tests__/sync-push-service.test.js
```

Expected: `Error: Cannot find module '../sync-push-service.js'` — that's the right failure.

- [ ] **Step 3: Implement `sync-push-service.js`**

Create `apps/api/src/services/sync-push-service.js`:

```javascript
export class SyncPushServiceError extends Error {
  constructor(message, status = 500, code = 'sync_push_error') {
    super(message)
    this.name = 'SyncPushServiceError'
    this.status = status
    this.code = code
  }
}

const MUTATION_EXPIRY_HOURS = 72

function makePushHandler(entityType, prismaKey) {
  return {
    entityType,
    async findById({ prisma, id }) {
      return prisma[prismaKey].findUnique({ where: { id } })
    },
    async create({ prisma, companyId, recordId, payload }) {
      const data = { ...payload, companyId }
      if (recordId) data.id = recordId
      return prisma[prismaKey].create({ data })
    },
    async update({ prisma, recordId, payload }) {
      return prisma[prismaKey].update({ where: { id: recordId }, data: payload })
    },
  }
}

const PUSH_MODULE_REGISTRY = {
  'atlas.contacts': {
    handlers: {
      contact: makePushHandler('contact', 'contact'),
    },
  },
  'atlas.hr': {
    handlers: {
      employee: makePushHandler('employee', 'hrEmployee'),
      department: makePushHandler('department', 'hrDepartment'),
      job_title: makePushHandler('job_title', 'hrJobTitle'),
    },
  },
  'custom.fleet': {
    handlers: {
      vehicle: makePushHandler('vehicle', 'fleetVehicle'),
      driver: makePushHandler('driver', 'fleetDriver'),
    },
  },
}

export function createSyncPushService({ prisma }) {
  async function resolveContext(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    })
    if (!profile) {
      throw new SyncPushServiceError('Perfil de usuario no encontrado.', 404, 'profile_not_found')
    }
    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      orderBy: { createdAt: 'desc' },
      select: { companyId: true },
    })
    if (!membership?.companyId) {
      throw new SyncPushServiceError('No tienes una empresa activa.', 403, 'no_active_company')
    }
    return { companyId: membership.companyId, userId: profile.id }
  }

  async function push({ authUserId, mutations }) {
    if (!mutations || mutations.length === 0) {
      return { results: [] }
    }

    const { companyId, userId } = await resolveContext(authUserId)
    const results = []

    for (const mutation of mutations) {
      const { idempotencyKey, moduleKey, entityType, operation, recordId, payload } = mutation

      // 1. Idempotency check — if already applied, return OK
      const existingLog = await prisma.syncMutationLog.findUnique({ where: { idempotencyKey } })
      if (existingLog) {
        const mod = PUSH_MODULE_REGISTRY[moduleKey]
        let record = null
        if (mod) {
          const handler = mod.handlers[entityType]
          const lookupId = existingLog.recordId ?? recordId
          if (handler && lookupId) {
            record = await handler.findById({ prisma, id: lookupId }).catch(() => null)
          }
        }
        results.push({ idempotencyKey, status: 'OK', record })
        continue
      }

      // 2. Resolve module + handler
      const mod = PUSH_MODULE_REGISTRY[moduleKey]
      if (!mod) {
        results.push({ idempotencyKey, status: 'ERROR', record: null })
        continue
      }
      const handler = mod.handlers[entityType]
      if (!handler) {
        results.push({ idempotencyKey, status: 'ERROR', record: null })
        continue
      }

      // 3. Apply mutation
      try {
        let record = null

        if (operation === 'CREATE') {
          record = await handler.create({ prisma, companyId, recordId: recordId ?? null, payload: payload ?? {} })
        } else if (operation === 'UPDATE') {
          const existing = await handler.findById({ prisma, id: recordId })
          if (!existing) {
            results.push({ idempotencyKey, status: 'NOT_FOUND', record: null })
            continue
          }
          if (existing.companyId !== companyId) {
            results.push({ idempotencyKey, status: 'PERMISSION_DENIED', record: null })
            continue
          }
          record = await handler.update({ prisma, recordId, payload: payload ?? {} })
        } else {
          results.push({ idempotencyKey, status: 'ERROR', record: null })
          continue
        }

        // 4. Write idempotency log
        const expiresAt = new Date(Date.now() + MUTATION_EXPIRY_HOURS * 60 * 60 * 1000)
        await prisma.syncMutationLog.create({
          data: {
            idempotencyKey,
            companyId,
            userId,
            moduleKey,
            entityType,
            operation,
            recordId: record?.id ?? recordId ?? null,
            expiresAt,
          },
        })

        results.push({ idempotencyKey, status: 'OK', record })
      } catch {
        results.push({ idempotencyKey, status: 'ERROR', record: null })
      }
    }

    return { results }
  }

  return { push }
}
```

- [ ] **Step 4: Run the tests and verify all 10 pass**

```bash
node --test apps/api/src/services/__tests__/sync-push-service.test.js
```

Expected: `10 passing` — all green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/sync-push-service.js apps/api/src/services/__tests__/sync-push-service.test.js
git commit -m "feat(offline): add sync-push-service with idempotency and last-write-wins"
```

---

### Task 3: Wire `POST /sync/push` into `routes/sync.js`

**Files:**
- Modify: `apps/api/src/routes/sync.js`

- [ ] **Step 1: Add the import and route**

The current `apps/api/src/routes/sync.js` starts with:
```javascript
import { Hono } from 'hono'
import { createSyncService, SyncServiceError } from '../services/sync-service.js'
```

And exports `createSyncRouter({ prisma })` with `GET /sync/pull` and `GET /sync/status`.

Modify `apps/api/src/routes/sync.js` to add the push route. The complete updated file:

```javascript
import { Hono } from 'hono'
import { createSyncService, SyncServiceError } from '../services/sync-service.js'
import { createSyncPushService } from '../services/sync-push-service.js'

export function createSyncRouter({ prisma }) {
  const app = new Hono()
  const service = createSyncService({ prisma })
  const pushService = createSyncPushService({ prisma })

  function handleError(c, err, scope) {
    if (err instanceof SyncServiceError) {
      return c.json({ error: err.message, code: err.code }, err.status)
    }
    console.error(`[${scope}]`, err?.message ?? err)
    return c.json({ error: 'Error interno' }, 500)
  }

  // GET /sync/pull?modules=atlas.contacts,atlas.hr&cursor=ISO-timestamp
  app.get('/sync/pull', async (c) => {
    try {
      const authUserId = c.get('authUserId')
      const modulesParam = c.req.query('modules') ?? ''
      const cursor = c.req.query('cursor') ?? null
      const modules = modulesParam
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
      const result = await service.pull({ authUserId, modules, cursor })
      return c.json(result)
    } catch (err) {
      return handleError(c, err, 'GET /sync/pull')
    }
  })

  // GET /sync/status — returns stored SyncCursor rows for the current company
  app.get('/sync/status', async (c) => {
    try {
      const authUserId = c.get('authUserId')
      const result = await service.getStatus({ authUserId })
      return c.json({ cursors: result })
    } catch (err) {
      return handleError(c, err, 'GET /sync/status')
    }
  })

  // POST /sync/push — apply a batch of offline mutations
  app.post('/sync/push', async (c) => {
    try {
      const authUserId = c.get('authUserId')
      const body = await c.req.json()
      const mutations = Array.isArray(body?.mutations) ? body.mutations : []
      const result = await pushService.push({ authUserId, mutations })
      return c.json(result)
    } catch (err) {
      return handleError(c, err, 'POST /sync/push')
    }
  })

  return app
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/api/src/routes/sync.js
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/sync.js
git commit -m "feat(offline): add POST /sync/push route"
```

---

### Task 4: Worker cleanup job for expired `SyncMutationLog` rows

**Files:**
- Create: `apps/api/src/services/sync-cleanup-worker.js`
- Modify: `apps/worker/src/index.js`

- [ ] **Step 1: Create `sync-cleanup-worker.js`**

Create `apps/api/src/services/sync-cleanup-worker.js`:

```javascript
const SYNC_CLEANUP_INTERVAL_MS = Number(
  process.env.ATLAS_SYNC_CLEANUP_INTERVAL_MS ?? 6 * 60 * 60 * 1000, // 6 hours
)

export function createSyncLogCleanupWorker({ prisma }) {
  async function processExpiredLogs() {
    const result = await prisma.syncMutationLog.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return { deleted: result.count }
  }

  return { processExpiredLogs, SYNC_CLEANUP_INTERVAL_MS }
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/api/src/services/sync-cleanup-worker.js
```

Expected: no output.

- [ ] **Step 3: Wire cleanup job into `apps/worker/src/index.js`**

Read `apps/worker/src/index.js` first. It currently imports `createNotificationDeliveryWorker` and `createCalendarNotificationService`.

Add after the existing `import` statements (before the `PrismaClient` initialization):

```javascript
import { createSyncLogCleanupWorker } from '../../api/src/services/sync-cleanup-worker.js'
```

Then after the existing `const deliveryWorker = ...` and `const calendarNotificationService = ...` lines, add:

```javascript
const syncCleanupWorker = createSyncLogCleanupWorker({ prisma })
const SYNC_CLEANUP_INTERVAL_MS = syncCleanupWorker.SYNC_CLEANUP_INTERVAL_MS
```

Then add a new tick function after the existing `runDeliveryTick` function:

```javascript
async function runSyncCleanupTick() {
  try {
    const result = await syncCleanupWorker.processExpiredLogs()
    if (result.deleted > 0) {
      console.log(`[worker] sync log cleanup ${formatLogTimestamp()} deleted=${result.deleted}`)
    }
  } catch (err) {
    console.error('[worker] sync log cleanup tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}
```

Then after the existing `setInterval` calls (before `process.on('SIGTERM', ...)`), add:

```javascript
runSyncCleanupTick()
setInterval(() => {
  runSyncCleanupTick()
}, SYNC_CLEANUP_INTERVAL_MS)
```

- [ ] **Step 4: Verify syntax of the worker**

```bash
node --check apps/worker/src/index.js
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/sync-cleanup-worker.js apps/worker/src/index.js
git commit -m "feat(offline): add SyncMutationLog cleanup worker job (6h interval)"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|---|---|
| `SyncMutationLog` Prisma model + migration | Task 1 |
| `POST /sync/push` endpoint | Task 3 |
| Idempotency key checking | Task 2 (sync-push-service) |
| `last-write-wins` apply per mutation | Task 2 |
| Log applied mutation in `SyncMutationLog` with `expiresAt` | Task 2 |
| Worker cleanup for expired log rows | Task 4 |
| `SyncPushServiceError` pattern | Task 2 |

All spec requirements for Phase 3A are covered. Phase 3B (frontend) is a separate plan.

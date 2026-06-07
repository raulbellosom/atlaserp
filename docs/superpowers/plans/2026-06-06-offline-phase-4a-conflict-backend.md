# Offline Phase 4A — Conflict Detection Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the push service to detect and report write conflicts for modules that opt into `conflict-ui` strategy, by comparing `clientUpdatedAt` (sent by the client) against the server record's `updatedAt`.

**Architecture:** Add an optional `strategy` field to each `PUSH_MODULE_REGISTRY` entry (defaults to `'last-write-wins'`). For `'conflict-ui'` modules, the UPDATE handler checks whether `clientUpdatedAt` matches `existing.updatedAt`; a mismatch returns `{ status: 'CONFLICT', record: existing }` instead of applying the update. The registry is injectable for test isolation via an optional `registry` param on `createSyncPushService`.

**Tech Stack:** Node.js, Hono, Prisma 7, `node --test`

---

### Task 1: Add strategy + conflict detection to sync-push-service

No existing modules use `conflict-ui` today — the change is purely additive. Existing tests must continue to pass unchanged.

**Files:**
- Modify: `apps/api/src/services/sync-push-service.js`
- Modify: `apps/api/src/services/__tests__/sync-push-service.test.js`

- [ ] **Step 1: Write two failing tests**

Add these tests at the end of `apps/api/src/services/__tests__/sync-push-service.test.js`, inside the `describe('createSyncPushService', ...)` block (or at the top level, matching existing style):

```js
// Near the bottom of the test file, after existing tests

describe('conflict-ui strategy', () => {
  const CONFLICT_REGISTRY = {
    'atlas.contacts': {
      strategy: 'conflict-ui',
      handlers: {
        contact: {
          entityType: 'contact',
          async findById({ prisma, id }) { return prisma.contact.findUnique({ where: { id } }) },
          async create({ prisma, companyId, recordId, payload }) {
            const data = { ...payload, companyId }
            if (recordId) data.id = recordId
            return prisma.contact.create({ data })
          },
          async update({ prisma, recordId, payload }) {
            return prisma.contact.update({ where: { id: recordId }, data: payload })
          },
        },
      },
    },
  }

  it('returns CONFLICT when clientUpdatedAt differs from server updatedAt', async () => {
    const serverUpdatedAt = new Date('2026-06-06T10:00:00.000Z')
    let updateCalled = false
    const prisma = makePrisma({
      contact: {
        findUnique: async ({ where }) => ({
          id: where.id, companyId: COMPANY_ID, name: 'Server Name', updatedAt: serverUpdatedAt,
        }),
        update: async () => { updateCalled = true; return {} },
      },
    })

    const svc = createSyncPushService({ prisma, registry: CONFLICT_REGISTRY })
    const result = await svc.push({
      authUserId: 'auth-u1',
      mutations: [{
        idempotencyKey: IK,
        moduleKey: 'atlas.contacts',
        entityType: 'contact',
        operation: 'UPDATE',
        recordId: RECORD_ID,
        payload: { name: 'My Version' },
        clientUpdatedAt: '2026-06-06T09:00:00.000Z', // older than server
      }],
    })

    assert.equal(result.results[0].status, 'CONFLICT')
    assert.ok(result.results[0].record, 'server record must be included')
    assert.equal(result.results[0].record.name, 'Server Name')
    assert.equal(updateCalled, false, 'update must not be called on CONFLICT')
  })

  it('applies UPDATE normally when clientUpdatedAt matches server updatedAt', async () => {
    const serverUpdatedAt = new Date('2026-06-06T10:00:00.000Z')
    let updateCalled = false
    const prisma = makePrisma({
      contact: {
        findUnique: async ({ where }) => ({
          id: where.id, companyId: COMPANY_ID, name: 'Server Name', updatedAt: serverUpdatedAt,
        }),
        update: async ({ where, data }) => {
          updateCalled = true
          return { id: where.id, companyId: COMPANY_ID, updatedAt: serverUpdatedAt, ...data }
        },
      },
    })

    const svc = createSyncPushService({ prisma, registry: CONFLICT_REGISTRY })
    const result = await svc.push({
      authUserId: 'auth-u1',
      mutations: [{
        idempotencyKey: IK,
        moduleKey: 'atlas.contacts',
        entityType: 'contact',
        operation: 'UPDATE',
        recordId: RECORD_ID,
        payload: { name: 'My Version' },
        clientUpdatedAt: serverUpdatedAt.toISOString(), // exact match
      }],
    })

    assert.equal(result.results[0].status, 'OK')
    assert.equal(updateCalled, true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test apps/api/src/services/__tests__/sync-push-service.test.js 2>&1 | tail -20
```

Expected: 2 new tests fail, all existing tests still pass.

- [ ] **Step 3: Implement the changes in sync-push-service.js**

Replace `apps/api/src/services/sync-push-service.js` with:

```js
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
    strategy: 'last-write-wins',
    handlers: {
      contact: makePushHandler('contact', 'contact'),
    },
  },
  'atlas.hr': {
    strategy: 'last-write-wins',
    handlers: {
      employee: makePushHandler('employee', 'hrEmployee'),
      department: makePushHandler('department', 'hrDepartment'),
      job_title: makePushHandler('job_title', 'hrJobTitle'),
    },
  },
  'custom.fleet': {
    strategy: 'last-write-wins',
    handlers: {
      vehicle: makePushHandler('vehicle', 'fleetVehicle'),
      driver: makePushHandler('driver', 'fleetDriver'),
    },
  },
}

export function createSyncPushService({ prisma, registry }) {
  const moduleRegistry = registry ?? PUSH_MODULE_REGISTRY

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
      const { idempotencyKey, moduleKey, entityType, operation, recordId, payload, clientUpdatedAt } = mutation

      // 1. Idempotency check — if already applied, return OK
      const existingLog = await prisma.syncMutationLog.findUnique({ where: { idempotencyKey } })
      if (existingLog) {
        const mod = moduleRegistry[moduleKey]
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
      const mod = moduleRegistry[moduleKey]
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

          // Conflict detection for conflict-ui modules
          if (mod.strategy === 'conflict-ui' && clientUpdatedAt != null && existing.updatedAt != null) {
            const serverTs = existing.updatedAt instanceof Date
              ? existing.updatedAt.toISOString()
              : String(existing.updatedAt)
            if (serverTs !== clientUpdatedAt) {
              results.push({ idempotencyKey, status: 'CONFLICT', record: existing })
              continue
            }
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

- [ ] **Step 4: Run all push service tests**

```bash
node --test apps/api/src/services/__tests__/sync-push-service.test.js 2>&1 | tail -20
```

Expected: All tests pass including the 2 new conflict-ui tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/sync-push-service.js apps/api/src/services/__tests__/sync-push-service.test.js
git commit -m "feat(offline): add conflict-ui strategy detection to sync push service"
```

---

## Self-Review Checklist

- [x] Spec coverage: conflict detection for `conflict-ui` modules — covered in Task 1
- [x] No placeholders — all code is complete
- [x] Type consistency: `clientUpdatedAt` destructured in push loop, used only when `mod.strategy === 'conflict-ui'`
- [x] Backward compat: existing `last-write-wins` modules unaffected (strategy check skipped); existing tests pass since they use the default registry
- [x] No idempotency log written for CONFLICT results (correct — the mutation was not applied)

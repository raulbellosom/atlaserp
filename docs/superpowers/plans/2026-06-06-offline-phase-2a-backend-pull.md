# Offline Phase 2A — Backend Pull Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/sync/pull` endpoint that serves delta records for Tier 1 offline modules (`atlas.contacts`, `atlas.hr`, `custom.fleet`), backed by a `SyncCursor` Prisma table that the server can optionally use to track per-company sync state.

**Architecture:** A new `SyncCursor` Prisma model is added for future server-side cursor tracking. A new `sync-service.js` contains a hardcoded module registry that queries Prisma with `updatedAt > cursor` filters and returns normalized records. The `sync.js` route exposes `GET /sync/pull` and `GET /sync/status`, registered via `mountWithAuth` in `apps/api/src/index.js`.

**Tech Stack:** Node.js, Hono, Prisma 7, PostgreSQL, `node:test` test runner

---

### Task 1: Add SyncCursor model to Prisma schema and migrate

**Files:**
- Modify: `prisma/schema.prisma` (append at end of file)

- [ ] **Step 1: Append SyncCursor model to schema.prisma**

Add after the last model in `prisma/schema.prisma`:

```prisma
model SyncCursor {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  companyId  String   @db.Uuid @map("company_id")
  moduleKey  String   @map("module_key")
  entityType String   @map("entity_type")
  cursor     DateTime
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@unique([companyId, moduleKey, entityType])
  @@index([companyId])
  @@map("sync_cursor")
}
```

- [ ] **Step 2: Run migration and regenerate Prisma client**

```bash
pnpm db:migrate
pnpm db:generate
```

Expected output from `db:migrate`:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your schema.
```

A new migration file `prisma/migrations/<timestamp>_add_sync_cursor/migration.sql` is created.

- [ ] **Step 3: Verify Prisma client has syncCursor accessor**

```bash
node --check apps/api/src/index.js
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(offline): add SyncCursor Prisma model and migration"
```

---

### Task 2: Create sync-service.js

**Files:**
- Create: `apps/api/src/services/sync-service.js`
- Create: `apps/api/src/services/__tests__/sync-service.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/services/__tests__/sync-service.test.js`:

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createSyncService, SyncServiceError } from '../sync-service.js'

const COMPANY_ID = '01900000-0000-7000-8000-000000000001'
const USER_ID = '01900000-0000-7000-8000-000000000002'
const now = new Date()
const past = new Date(now.getTime() - 60_000)

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
    contact: {
      findMany: async () => [],
      ...(overrides.contact ?? {}),
    },
    hrEmployee: {
      findMany: async () => [],
      ...(overrides.hrEmployee ?? {}),
    },
    hrDepartment: {
      findMany: async () => [],
      ...(overrides.hrDepartment ?? {}),
    },
    hrJobTitle: {
      findMany: async () => [],
      ...(overrides.hrJobTitle ?? {}),
    },
    fleetVehicle: {
      findMany: async () => [],
      ...(overrides.fleetVehicle ?? {}),
    },
    fleetDriver: {
      findMany: async () => [],
      ...(overrides.fleetDriver ?? {}),
    },
    syncCursor: {
      findMany: async () => [],
      ...(overrides.syncCursor ?? {}),
    },
  }
}

describe('sync-service', () => {
  it('returns empty records when no modules requested', async () => {
    const svc = createSyncService({ prisma: makePrisma() })
    const result = await svc.pull({ authUserId: USER_ID, modules: [], cursor: null })
    assert.deepEqual(result, { records: [], nextCursor: null, hasMore: false })
  })

  it('throws profile_not_found when user has no profile', async () => {
    const prisma = makePrisma({ userProfile: { findUnique: async () => null } })
    const svc = createSyncService({ prisma })
    await assert.rejects(
      () => svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: null }),
      (err) => err instanceof SyncServiceError && err.code === 'profile_not_found',
    )
  })

  it('throws no_active_company when user has no membership', async () => {
    const prisma = makePrisma({ membership: { findFirst: async () => null } })
    const svc = createSyncService({ prisma })
    await assert.rejects(
      () => svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: null }),
      (err) => err instanceof SyncServiceError && err.code === 'no_active_company',
    )
  })

  it('returns contacts for atlas.contacts module', async () => {
    const contact = { id: 'c1', companyId: COMPANY_ID, type: 'person', name: 'Ana', updatedAt: now, createdAt: past }
    const svc = createSyncService({ prisma: makePrisma({ contact: { findMany: async () => [contact] } }) })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: null })
    assert.equal(result.records.length, 1)
    assert.equal(result.records[0].moduleKey, 'atlas.contacts')
    assert.equal(result.records[0].entityType, 'contact')
    assert.equal(result.records[0].id, 'c1')
    assert.equal(result.records[0].deleted, false)
    assert.ok(result.nextCursor)
  })

  it('passes cursor as Date gt filter when provided', async () => {
    let capturedWhere = null
    const svc = createSyncService({
      prisma: makePrisma({
        contact: { findMany: async ({ where }) => { capturedWhere = where; return [] } },
      }),
    })
    const cursorStr = past.toISOString()
    await svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: cursorStr })
    assert.ok(capturedWhere?.updatedAt?.gt instanceof Date)
    assert.equal(capturedWhere.updatedAt.gt.toISOString(), cursorStr)
  })

  it('returns employee, department, job_title for atlas.hr module', async () => {
    const employee = { id: 'e1', companyId: COMPANY_ID, firstName: 'Juan', lastName: 'Paz', status: 'active', updatedAt: now, createdAt: past }
    const department = { id: 'd1', companyId: COMPANY_ID, name: 'TI', enabled: true, updatedAt: now, createdAt: past }
    const jobTitle = { id: 'jt1', companyId: COMPANY_ID, name: 'Dev', enabled: true, updatedAt: now, createdAt: past }
    const svc = createSyncService({
      prisma: makePrisma({
        hrEmployee: { findMany: async () => [employee] },
        hrDepartment: { findMany: async () => [department] },
        hrJobTitle: { findMany: async () => [jobTitle] },
      }),
    })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.hr'], cursor: null })
    const types = result.records.map((r) => r.entityType)
    assert.ok(types.includes('employee'))
    assert.ok(types.includes('department'))
    assert.ok(types.includes('job_title'))
  })

  it('returns vehicle and driver for custom.fleet module', async () => {
    const vehicle = { id: 'v1', companyId: COMPANY_ID, plate: 'ABC-123', status: 'active', updatedAt: now, createdAt: past }
    const driver = { id: 'dr1', companyId: COMPANY_ID, firstName: 'Luis', lastName: 'Vega', phone: '555', licenseNumber: 'L1', status: 'active', updatedAt: now, createdAt: past }
    const svc = createSyncService({
      prisma: makePrisma({
        fleetVehicle: { findMany: async () => [vehicle] },
        fleetDriver: { findMany: async () => [driver] },
      }),
    })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['custom.fleet'], cursor: null })
    const types = result.records.map((r) => r.entityType)
    assert.ok(types.includes('vehicle'))
    assert.ok(types.includes('driver'))
  })

  it('sets nextCursor to max version across all returned records', async () => {
    const older = new Date('2026-06-01T00:00:00Z')
    const newer = new Date('2026-06-02T00:00:00Z')
    const c1 = { id: 'c1', companyId: COMPANY_ID, type: 'person', name: 'A', updatedAt: older, createdAt: older }
    const c2 = { id: 'c2', companyId: COMPANY_ID, type: 'person', name: 'B', updatedAt: newer, createdAt: older }
    const svc = createSyncService({ prisma: makePrisma({ contact: { findMany: async () => [c1, c2] } }) })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: null })
    assert.equal(result.nextCursor, newer.toISOString())
  })

  it('silently skips unknown module keys', async () => {
    const svc = createSyncService({ prisma: makePrisma() })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.unknown_module_xyz'], cursor: null })
    assert.equal(result.records.length, 0)
    assert.equal(result.hasMore, false)
  })

  it('returns sync cursor status via getStatus()', async () => {
    const cursors = [{ moduleKey: 'atlas.contacts', entityType: 'contact', cursor: now, updatedAt: now }]
    const svc = createSyncService({ prisma: makePrisma({ syncCursor: { findMany: async () => cursors } }) })
    const result = await svc.getStatus({ authUserId: USER_ID })
    assert.equal(result.length, 1)
    assert.equal(result[0].moduleKey, 'atlas.contacts')
    assert.equal(result[0].entityType, 'contact')
    assert.ok(result[0].cursor)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test "apps/api/src/services/__tests__/sync-service.test.js"
```

Expected: FAIL — `sync-service.js` does not exist yet.

- [ ] **Step 3: Create sync-service.js**

Create `apps/api/src/services/sync-service.js`:

```javascript
export class SyncServiceError extends Error {
  constructor(message, status = 500, code = 'sync_error') {
    super(message)
    this.name = 'SyncServiceError'
    this.status = status
    this.code = code
  }
}

const RECORDS_LIMIT = 500

function makeHandler(entityType, prismaKey) {
  return {
    entityType,
    async fetch({ prisma, companyId, cursor, limit }) {
      const where = { companyId }
      if (cursor) where.updatedAt = { gt: new Date(cursor) }
      return prisma[prismaKey].findMany({
        where,
        take: limit,
        orderBy: { updatedAt: 'asc' },
      })
    },
    toRecord(row) {
      return {
        id: row.id,
        data: row,
        version: row.updatedAt.toISOString(),
        deleted: false,
      }
    },
  }
}

const SYNC_MODULE_REGISTRY = {
  'atlas.contacts': {
    handlers: [makeHandler('contact', 'contact')],
  },
  'atlas.hr': {
    handlers: [
      makeHandler('employee', 'hrEmployee'),
      makeHandler('department', 'hrDepartment'),
      makeHandler('job_title', 'hrJobTitle'),
    ],
  },
  'custom.fleet': {
    handlers: [
      makeHandler('vehicle', 'fleetVehicle'),
      makeHandler('driver', 'fleetDriver'),
    ],
  },
}

export function createSyncService({ prisma }) {
  async function resolveCompanyContext(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    })
    if (!profile) {
      throw new SyncServiceError('Perfil de usuario no encontrado.', 404, 'profile_not_found')
    }
    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      orderBy: { createdAt: 'desc' },
      select: { companyId: true },
    })
    if (!membership?.companyId) {
      throw new SyncServiceError('No tienes una empresa activa.', 403, 'no_active_company')
    }
    return { companyId: membership.companyId }
  }

  async function pull({ authUserId, modules, cursor }) {
    if (!modules || modules.length === 0) {
      return { records: [], nextCursor: cursor ?? null, hasMore: false }
    }

    const { companyId } = await resolveCompanyContext(authUserId)
    const records = []
    let hasMore = false

    for (const moduleKey of modules) {
      const mod = SYNC_MODULE_REGISTRY[moduleKey]
      if (!mod) continue
      for (const handler of mod.handlers) {
        const rows = await handler.fetch({ prisma, companyId, cursor, limit: RECORDS_LIMIT + 1 })
        if (rows.length > RECORDS_LIMIT) {
          hasMore = true
          rows.splice(RECORDS_LIMIT)
        }
        for (const row of rows) {
          records.push({ moduleKey, entityType: handler.entityType, ...handler.toRecord(row) })
        }
      }
    }

    const nextCursor =
      records.length > 0
        ? records.reduce((max, r) => (r.version > max ? r.version : max), records[0].version)
        : cursor ?? null

    return { records, nextCursor, hasMore }
  }

  async function getStatus({ authUserId }) {
    const { companyId } = await resolveCompanyContext(authUserId)
    const cursors = await prisma.syncCursor.findMany({
      where: { companyId },
      orderBy: [{ moduleKey: 'asc' }, { entityType: 'asc' }],
    })
    return cursors.map((c) => ({
      moduleKey: c.moduleKey,
      entityType: c.entityType,
      cursor: c.cursor.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  }

  return { pull, getStatus }
}
```

- [ ] **Step 4: Run tests**

```bash
node --test "apps/api/src/services/__tests__/sync-service.test.js"
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/sync-service.js apps/api/src/services/__tests__/sync-service.test.js
git commit -m "feat(offline): add sync-service with pull/status for contacts, HR, fleet"
```

---

### Task 3: Create routes/sync.js

**Files:**
- Create: `apps/api/src/routes/sync.js`

- [ ] **Step 1: Create sync router**

Create `apps/api/src/routes/sync.js`:

```javascript
import { Hono } from 'hono'
import { createSyncService, SyncServiceError } from '../services/sync-service.js'

export function createSyncRouter({ prisma }) {
  const app = new Hono()
  const service = createSyncService({ prisma })

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

  return app
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/api/src/routes/sync.js
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/sync.js
git commit -m "feat(offline): add sync router with GET /sync/pull and GET /sync/status"
```

---

### Task 4: Register sync router in API index

**Files:**
- Modify: `apps/api/src/index.js` (two edits: import near line 60, mountWithAuth near line 3914)

- [ ] **Step 1: Add import for createSyncRouter**

In `apps/api/src/index.js`, add this import after the last router import (near line 60, after the `createNotificationsRouter` import):

```javascript
import { createSyncRouter } from "./routes/sync.js";
```

- [ ] **Step 2: Register the router with mountWithAuth**

In `apps/api/src/index.js`, add after the last `mountWithAuth` call (after the `createNotificationsRouter` line, around line 3914):

```javascript
mountWithAuth(app, createSyncRouter({ prisma }));
```

- [ ] **Step 3: Syntax check**

```bash
node --check apps/api/src/index.js
```

Expected: no errors.

- [ ] **Step 4: Build check**

```bash
pnpm build --filter @atlas/api
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Smoke test the endpoints**

Start the API server (`pnpm dev:api`) then in a separate terminal (replace `$ATLAS_TOKEN` with a valid JWT):

```bash
# Status — should return empty cursors array initially
curl -s "http://localhost:4010/sync/status" \
  -H "Authorization: Bearer $ATLAS_TOKEN"
# Expected: {"cursors":[]}

# Pull contacts — returns all contacts for the user's company
curl -s "http://localhost:4010/sync/pull?modules=atlas.contacts" \
  -H "Authorization: Bearer $ATLAS_TOKEN"
# Expected: {"records":[...],"nextCursor":"2026-...","hasMore":false}

# Pull with cursor — returns only records changed after the cursor
curl -s "http://localhost:4010/sync/pull?modules=atlas.contacts&cursor=2026-01-01T00:00:00Z" \
  -H "Authorization: Bearer $ATLAS_TOKEN"
# Expected: records with updatedAt > 2026-01-01T00:00:00Z
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(offline): register sync router in API"
```

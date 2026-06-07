# atlas.catalog Tier 1 Offline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `atlas.catalog` (products and categories) to the offline architecture as a Tier 1 module — full offline CRUD with last-write-wins conflict strategy.

**Architecture:** `CatalogProduct` and `CatalogCategory` are standard company-scoped Prisma models (both have `companyId` + `updatedAt`) so the existing `makeHandler`/`makePushHandler` helpers work directly with no custom logic. The catalog screens use the Atlas SDK → TanStack Query persister handles offline reads automatically, so no hook-level Dexie fallback is needed (unlike `atlas.calendar` which used raw `apiFetch`). Only four registries need updating: `SYNC_MODULE_REGISTRY` (pull), `PUSH_MODULE_REGISTRY` (push), `ROUTE_MAP` (transport interceptor), and `OFFLINE_MODULES` (periodic sync list).

**Tech Stack:** Node.js (test runner: `node --test`), Prisma 7, Dexie.js (IndexedDB), Zustand, TanStack Query v5

---

## File Map

| File | Change |
|---|---|
| `apps/api/src/services/sync-service.js` | Add `atlas.catalog` to `SYNC_MODULE_REGISTRY` (2 handlers) |
| `apps/api/src/services/__tests__/sync-service.test.js` | Add catalog mocks to `makePrisma` + `describe('atlas.catalog module', ...)` |
| `apps/api/src/services/sync-push-service.js` | Add `atlas.catalog` to `PUSH_MODULE_REGISTRY` (2 handlers) |
| `apps/api/src/services/__tests__/sync-push-service.test.js` | Add catalog mocks to `makePrisma` + `describe('atlas.catalog push', ...)` |
| `packages/offline/src/offline-transport.js` | Add 4 catalog route entries to `ROUTE_MAP` |
| `packages/offline/src/__tests__/offline-transport.test.js` | Add 4 `parseMutationRoute` tests for catalog paths |
| `packages/offline/src/offline-provider.jsx` | Add `'atlas.catalog'` to `OFFLINE_MODULES` array |

---

### Task 1: Backend — sync pull + sync push for atlas.catalog

**Files:**
- Modify: `apps/api/src/services/sync-service.js` (SYNC_MODULE_REGISTRY, ~line 35)
- Modify: `apps/api/src/services/__tests__/sync-service.test.js` (makePrisma + new describe block)
- Modify: `apps/api/src/services/sync-push-service.js` (PUSH_MODULE_REGISTRY, ~line 29)
- Modify: `apps/api/src/services/__tests__/sync-push-service.test.js` (makePrisma + new describe block)

- [ ] **Step 1: Add catalog pull tests (they must fail first)**

In `apps/api/src/services/__tests__/sync-service.test.js`:

1a. Add `catalogProduct` and `catalogCategory` to `makePrisma` (insert after `calendarEvent` block, ~line 49):

```js
    catalogProduct: {
      findMany: async () => [],
      ...(overrides.catalogProduct ?? {}),
    },
    catalogCategory: {
      findMany: async () => [],
      ...(overrides.catalogCategory ?? {}),
    },
```

1b. Append a new describe block **after** the `atlas.calendar` describe block (after line 235):

```js
  describe('atlas.catalog module', () => {
    it('returns product and category records for atlas.catalog', async () => {
      const product = { id: 'p1', companyId: COMPANY_ID, name: 'Widget', sku: 'W-001', enabled: true, updatedAt: now, createdAt: past }
      const category = { id: 'cat1', companyId: COMPANY_ID, name: 'Herramientas', enabled: true, updatedAt: now, createdAt: past }
      const svc = createSyncService({
        prisma: makePrisma({
          catalogProduct: { findMany: async () => [product] },
          catalogCategory: { findMany: async () => [category] },
        }),
      })
      const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.catalog'], cursor: null })
      const types = result.records.map((r) => r.entityType)
      assert.ok(types.includes('product'), 'must include product entityType')
      assert.ok(types.includes('category'), 'must include category entityType')
      assert.equal(result.records.find((r) => r.entityType === 'product').id, 'p1')
      assert.equal(result.records.find((r) => r.entityType === 'category').id, 'cat1')
    })

    it('product handler filters by companyId (not userId)', async () => {
      let capturedWhere = null
      const svc = createSyncService({
        prisma: makePrisma({
          catalogProduct: { findMany: async ({ where }) => { capturedWhere = where; return [] } },
        }),
      })
      await svc.pull({ authUserId: USER_ID, modules: ['atlas.catalog'], cursor: null })
      assert.equal(capturedWhere?.companyId, COMPANY_ID)
      assert.equal(capturedWhere?.ownerId, undefined, 'product must NOT filter by ownerId')
    })

    it('category handler filters by companyId', async () => {
      let capturedWhere = null
      const svc = createSyncService({
        prisma: makePrisma({
          catalogCategory: { findMany: async ({ where }) => { capturedWhere = where; return [] } },
        }),
      })
      await svc.pull({ authUserId: USER_ID, modules: ['atlas.catalog'], cursor: null })
      assert.equal(capturedWhere?.companyId, COMPANY_ID)
    })
  })
```

- [ ] **Step 2: Run sync-service tests — expect the 3 new catalog tests to fail**

```bash
node --test apps/api/src/services/__tests__/sync-service.test.js
```

Expected: existing tests pass; the 3 new `atlas.catalog module` tests fail with something like `atlas.catalog` not found in SYNC_MODULE_REGISTRY.

- [ ] **Step 3: Add atlas.catalog to SYNC_MODULE_REGISTRY**

In `apps/api/src/services/sync-service.js`, append to `SYNC_MODULE_REGISTRY` (after the `atlas.calendar` block, before the closing `}`):

```js
  'atlas.catalog': {
    handlers: [
      makeHandler('product', 'catalogProduct'),
      makeHandler('category', 'catalogCategory'),
    ],
  },
```

The full SYNC_MODULE_REGISTRY ending should look like:

```js
  'atlas.catalog': {
    handlers: [
      makeHandler('product', 'catalogProduct'),
      makeHandler('category', 'catalogCategory'),
    ],
  },
}
```

- [ ] **Step 4: Run sync-service tests — all must pass**

```bash
node --test apps/api/src/services/__tests__/sync-service.test.js
```

Expected: all tests pass (previously 14 tests, now 17).

- [ ] **Step 5: Add catalog push tests (they must fail first)**

In `apps/api/src/services/__tests__/sync-push-service.test.js`:

5a. Add `catalogProduct` and `catalogCategory` to `makePrisma` (insert after `fleetDriver` block, ~line 67):

```js
    catalogProduct: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'p1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, companyId: COMPANY_ID, updatedAt: now, ...data }),
      ...(overrides.catalogProduct ?? {}),
    },
    catalogCategory: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'cat1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, companyId: COMPANY_ID, updatedAt: now, ...data }),
      ...(overrides.catalogCategory ?? {}),
    },
```

5b. Append a new describe block **after** the `conflict-ui strategy` describe block (after line 302):

```js
describe('atlas.catalog push', () => {
  const PRODUCT_ID = '01900000-0000-7000-8000-000000000020'
  const CATEGORY_ID = '01900000-0000-7000-8000-000000000021'

  it('CREATE product returns OK with created record', async () => {
    let createCalled = false
    const prisma = makePrisma({
      catalogProduct: {
        findUnique: async () => null,
        create: async ({ data }) => { createCalled = true; return { id: 'p-new', updatedAt: now, ...data } },
        update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.catalog', entityType: 'product', operation: 'CREATE', recordId: null, payload: { name: 'Widget', sku: 'W-001' } }],
    })
    assert.equal(result.results[0].status, 'OK')
    assert.ok(result.results[0].record)
    assert.ok(createCalled)
  })

  it('CREATE category returns OK with created record', async () => {
    let createCalled = false
    const prisma = makePrisma({
      catalogCategory: {
        findUnique: async () => null,
        create: async ({ data }) => { createCalled = true; return { id: 'cat-new', updatedAt: now, ...data } },
        update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.catalog', entityType: 'category', operation: 'CREATE', recordId: null, payload: { name: 'Herramientas' } }],
    })
    assert.equal(result.results[0].status, 'OK')
    assert.ok(result.results[0].record)
    assert.ok(createCalled)
  })

  it('UPDATE product returns OK with updated record', async () => {
    let updateCalled = false
    const prisma = makePrisma({
      catalogProduct: {
        findUnique: async ({ where }) => ({ id: where.id, companyId: COMPANY_ID, name: 'Old', sku: 'W-001', updatedAt: now }),
        create: async ({ data }) => ({ id: 'x', updatedAt: now, ...data }),
        update: async ({ where, data }) => { updateCalled = true; return { id: where.id, companyId: COMPANY_ID, updatedAt: now, ...data } },
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.catalog', entityType: 'product', operation: 'UPDATE', recordId: PRODUCT_ID, payload: { name: 'Widget Pro' } }],
    })
    assert.equal(result.results[0].status, 'OK')
    assert.equal(result.results[0].record.name, 'Widget Pro')
    assert.ok(updateCalled)
  })

  it('unknown entityType for atlas.catalog returns ERROR', async () => {
    const svc = createSyncPushService({ prisma: makePrisma() })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.catalog', entityType: 'widget', operation: 'CREATE', recordId: null, payload: {} }],
    })
    assert.equal(result.results[0].status, 'ERROR')
  })
})
```

- [ ] **Step 6: Run sync-push-service tests — expect the 4 new catalog tests to fail**

```bash
node --test apps/api/src/services/__tests__/sync-push-service.test.js
```

Expected: existing tests pass; 4 new `atlas.catalog push` tests fail because `atlas.catalog` is not in `PUSH_MODULE_REGISTRY`.

- [ ] **Step 7: Add atlas.catalog to PUSH_MODULE_REGISTRY**

In `apps/api/src/services/sync-push-service.js`, append to `PUSH_MODULE_REGISTRY` (after the `custom.fleet` block, before the closing `}`):

```js
  'atlas.catalog': {
    strategy: 'last-write-wins',
    handlers: {
      product: makePushHandler('product', 'catalogProduct'),
      category: makePushHandler('category', 'catalogCategory'),
    },
  },
```

- [ ] **Step 8: Run sync-push-service tests — all must pass**

```bash
node --test apps/api/src/services/__tests__/sync-push-service.test.js
```

Expected: all tests pass (previously 13 + 2 conflict tests, now 17 + 2 conflict = 19 total).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/sync-service.js apps/api/src/services/__tests__/sync-service.test.js apps/api/src/services/sync-push-service.js apps/api/src/services/__tests__/sync-push-service.test.js
git commit -m "feat(offline): add atlas.catalog to SYNC_MODULE_REGISTRY and PUSH_MODULE_REGISTRY"
```

---

### Task 2: Frontend — ROUTE_MAP + OFFLINE_MODULES for atlas.catalog

**Files:**
- Modify: `packages/offline/src/offline-transport.js` (ROUTE_MAP, ~line 7)
- Modify: `packages/offline/src/__tests__/offline-transport.test.js` (parseMutationRoute describe block)
- Modify: `packages/offline/src/offline-provider.jsx` (OFFLINE_MODULES, line 12)

- [ ] **Step 1: Add catalog route tests (they must fail first)**

In `packages/offline/src/__tests__/offline-transport.test.js`, add 4 tests to the `describe('parseMutationRoute', ...)` block (insert before the closing `}` of that describe block, after line 37):

```js
  it('maps POST /catalog/products to atlas.catalog product CREATE', () => {
    const result = parseMutationRoute('/catalog/products', 'POST')
    assert.deepEqual(result, { moduleKey: 'atlas.catalog', entityType: 'product', operation: 'CREATE', recordId: null })
  })

  it('maps PATCH /catalog/products/:id to atlas.catalog product UPDATE', () => {
    const result = parseMutationRoute('/catalog/products/prod-abc-123', 'PATCH')
    assert.deepEqual(result, { moduleKey: 'atlas.catalog', entityType: 'product', operation: 'UPDATE', recordId: 'prod-abc-123' })
  })

  it('maps POST /catalog/categories to atlas.catalog category CREATE', () => {
    const result = parseMutationRoute('/catalog/categories', 'POST')
    assert.deepEqual(result, { moduleKey: 'atlas.catalog', entityType: 'category', operation: 'CREATE', recordId: null })
  })

  it('maps PATCH /catalog/categories/:id to atlas.catalog category UPDATE', () => {
    const result = parseMutationRoute('/catalog/categories/cat-xyz-456', 'PATCH')
    assert.deepEqual(result, { moduleKey: 'atlas.catalog', entityType: 'category', operation: 'UPDATE', recordId: 'cat-xyz-456' })
  })
```

- [ ] **Step 2: Run transport tests — expect 4 new catalog tests to fail**

```bash
node --test packages/offline/src/__tests__/offline-transport.test.js
```

Expected: existing 11 tests pass; 4 new catalog tests fail because catalog routes are not in ROUTE_MAP.

- [ ] **Step 3: Add catalog routes to ROUTE_MAP**

In `packages/offline/src/offline-transport.js`, add 4 catalog entries to `ROUTE_MAP` (append before the closing `]` of the array, after the `custom.fleet — drivers` comment block, ~line 25):

```js
  // atlas.catalog — products
  { pattern: /^\/catalog\/products\/([^/?#]+)$/, moduleKey: 'atlas.catalog', entityType: 'product', hasId: true },
  { pattern: /^\/catalog\/products$/, moduleKey: 'atlas.catalog', entityType: 'product', hasId: false },
  // atlas.catalog — categories
  { pattern: /^\/catalog\/categories\/([^/?#]+)$/, moduleKey: 'atlas.catalog', entityType: 'category', hasId: true },
  { pattern: /^\/catalog\/categories$/, moduleKey: 'atlas.catalog', entityType: 'category', hasId: false },
```

Note: patterns with `:id` (hasId: true) must stay before patterns without ID in the array — they already do because each pair is ordered (specific before general) and ROUTE_MAP iterates in order.

- [ ] **Step 4: Run transport tests — all must pass**

```bash
node --test packages/offline/src/__tests__/offline-transport.test.js
```

Expected: all 15 tests pass.

- [ ] **Step 5: Add atlas.catalog to OFFLINE_MODULES**

In `packages/offline/src/offline-provider.jsx`, update line 12:

```js
const OFFLINE_MODULES = ['atlas.contacts', 'atlas.hr', 'custom.fleet', 'atlas.calendar', 'atlas.catalog']
```

No test is needed for this one-line change — the periodic sync integration is covered by the sync-engine tests that already verify `pull({ modules })` passes the array through correctly.

- [ ] **Step 6: Run all offline package tests to confirm no regressions**

```bash
node --test packages/offline/src/__tests__/offline-transport.test.js
```

Expected: all 15 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/offline/src/offline-transport.js packages/offline/src/__tests__/offline-transport.test.js packages/offline/src/offline-provider.jsx
git commit -m "feat(offline): add atlas.catalog to ROUTE_MAP and OFFLINE_MODULES"
```

---

## Self-Review

### Spec coverage

Offline spec section 11 Tier 1 requirements for `atlas.catalog`:
- ✅ Pull (backend): `SYNC_MODULE_REGISTRY` entry with product + category handlers — Task 1
- ✅ Push (backend): `PUSH_MODULE_REGISTRY` entry with last-write-wins strategy — Task 1
- ✅ Transport interception: `ROUTE_MAP` entries for products and categories paths — Task 2
- ✅ Periodic sync: `OFFLINE_MODULES` updated — Task 2
- ✅ Offline reads: Catalog screens use Atlas SDK → TQ persister handles automatically (no hook changes needed)

### Placeholder scan

No TBD, TODO, or "implement later" found. All steps include exact code.

### Type consistency

- `makeHandler('product', 'catalogProduct')` — Prisma accessor matches `CatalogProduct` model
- `makeHandler('category', 'catalogCategory')` — Prisma accessor matches `CatalogCategory` model
- `makePushHandler('product', 'catalogProduct')` — same key, consistent
- `makePushHandler('category', 'catalogCategory')` — same key, consistent
- `entityType: 'product'` and `entityType: 'category'` are used consistently across SYNC_MODULE_REGISTRY, PUSH_MODULE_REGISTRY, ROUTE_MAP, and all test assertions

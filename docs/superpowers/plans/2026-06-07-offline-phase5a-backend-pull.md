# Offline Phase 5A — Backend Pull Support for atlas.ledger

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the pull sync service so that `/sync/pull?modules=atlas.ledger` returns ledger accounts, transactions, categories, and transaction types scoped by `companyId`.

**Architecture:** Add `atlas.ledger` to the existing `SYNC_MODULE_REGISTRY` in `sync-service.js` using the same `makeHandler(entityType, prismaKey)` factory already used for contacts, HR, fleet, and catalog. No new routes, no new Prisma models, no frontend changes.

**Tech Stack:** Node.js, Hono, Prisma 7, `node --test` for tests.

---

## File Map

| File | Action |
|---|---|
| `apps/api/src/services/sync-service.js` | Modify — add `atlas.ledger` entry to `SYNC_MODULE_REGISTRY` |
| `apps/api/src/services/__tests__/sync-service.test.js` | Modify — add `makePrisma` stubs + `atlas.ledger` describe block |

---

## Task 1: Add `atlas.ledger` to `SYNC_MODULE_REGISTRY`

**Files:**
- Modify: `apps/api/src/services/sync-service.js`
- Modify: `apps/api/src/services/__tests__/sync-service.test.js`

### Background

`sync-service.js` exports `createSyncService({ prisma })`. Inside it, `SYNC_MODULE_REGISTRY` maps module keys to arrays of entity handlers. The `makeHandler(entityType, prismaKey)` factory creates a handler that:
- Fetches records filtered by `companyId` (and optionally by cursor `updatedAt > cursor`)
- Returns them in the standard `{ id, data, version, deleted }` shape

The four ledger Prisma models and their keys:

| entityType | prismaKey | Prisma model |
|---|---|---|
| `account` | `ledgerAccount` | `LedgerAccount` |
| `transaction` | `ledgerTransaction` | `LedgerTransaction` |
| `category` | `ledgerCategory` | `LedgerCategory` |
| `transaction_type` | `ledgerTransactionType` | `LedgerTransactionType` |

All four have `companyId` and `updatedAt` — `makeHandler` works directly with no custom logic.

The existing test file `sync-service.test.js` has a `makePrisma(overrides)` helper that returns a mock Prisma client. You need to add the four ledger keys to it, then add a `describe('atlas.ledger module', ...)` block with tests.

### Steps

- [ ] **Step 1: Add failing tests for atlas.ledger**

Read `apps/api/src/services/__tests__/sync-service.test.js` first (required). Then add:

1. Add four mock stubs to `makePrisma` (after the existing `catalogCategory` entry):

```js
    ledgerAccount: {
      findMany: async () => [],
      ...(overrides.ledgerAccount ?? {}),
    },
    ledgerTransaction: {
      findMany: async () => [],
      ...(overrides.ledgerTransaction ?? {}),
    },
    ledgerCategory: {
      findMany: async () => [],
      ...(overrides.ledgerCategory ?? {}),
    },
    ledgerTransactionType: {
      findMany: async () => [],
      ...(overrides.ledgerTransactionType ?? {}),
    },
```

2. Add the test block after the existing `describe('atlas.catalog module', ...)` block:

```js
  describe('atlas.ledger module', () => {
    it('returns account, transaction, category, transaction_type records', async () => {
      const account = {
        id: 'acc-1', companyId: COMPANY_ID, name: 'BBVA Principal', bank: 'BBVA',
        accountNumber: '1234', currency: 'MXN', openingBalance: 0,
        enabled: true, createdAt: past, updatedAt: now,
      }
      const transaction = {
        id: 'tx-1', companyId: COMPANY_ID, accountId: 'acc-1',
        categoryId: null, tipoId: null, fecha: now, numero: '001',
        nombre: 'Deposito inicial', referencia: null, concepto: null,
        deposito: 1000, retiro: null, enabled: true, createdAt: past, updatedAt: now,
      }
      const category = {
        id: 'cat-1', companyId: COMPANY_ID, name: 'Ingresos',
        color: '#22c55e', kind: 'income', enabled: true, createdAt: past, updatedAt: now,
      }
      const txType = {
        id: 'typ-1', companyId: COMPANY_ID, code: 'DEP', name: 'Deposito',
        enabled: true, createdAt: past, updatedAt: now,
      }
      const svc = createSyncService({
        prisma: makePrisma({
          ledgerAccount:          { findMany: async () => [account] },
          ledgerTransaction:      { findMany: async () => [transaction] },
          ledgerCategory:         { findMany: async () => [category] },
          ledgerTransactionType:  { findMany: async () => [txType] },
        }),
      })
      const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.ledger'], cursor: null })
      const types = result.records.map((r) => r.entityType)
      assert.ok(types.includes('account'),          'must include account')
      assert.ok(types.includes('transaction'),      'must include transaction')
      assert.ok(types.includes('category'),         'must include category')
      assert.ok(types.includes('transaction_type'), 'must include transaction_type')
      assert.equal(result.records.find((r) => r.entityType === 'account').id, 'acc-1')
      assert.equal(result.records.find((r) => r.entityType === 'transaction').id, 'tx-1')
    })

    it('account handler filters by companyId (not ownerId)', async () => {
      let capturedWhere = null
      const svc = createSyncService({
        prisma: makePrisma({
          ledgerAccount: {
            findMany: async ({ where }) => { capturedWhere = where; return [] },
          },
        }),
      })
      await svc.pull({ authUserId: USER_ID, modules: ['atlas.ledger'], cursor: null })
      assert.equal(capturedWhere?.companyId, COMPANY_ID)
      assert.equal(capturedWhere?.ownerId, undefined, 'ledger account must NOT filter by ownerId')
    })

    it('transaction handler filters by companyId', async () => {
      let capturedWhere = null
      const svc = createSyncService({
        prisma: makePrisma({
          ledgerTransaction: {
            findMany: async ({ where }) => { capturedWhere = where; return [] },
          },
        }),
      })
      await svc.pull({ authUserId: USER_ID, modules: ['atlas.ledger'], cursor: null })
      assert.equal(capturedWhere?.companyId, COMPANY_ID)
    })

    it('category handler filters by companyId', async () => {
      let capturedWhere = null
      const svc = createSyncService({
        prisma: makePrisma({
          ledgerCategory: {
            findMany: async ({ where }) => { capturedWhere = where; return [] },
          },
        }),
      })
      await svc.pull({ authUserId: USER_ID, modules: ['atlas.ledger'], cursor: null })
      assert.equal(capturedWhere?.companyId, COMPANY_ID)
    })
  })
```

- [ ] **Step 2: Run to verify tests fail**

```bash
node --test apps/api/src/services/__tests__/sync-service.test.js
```

Expected: the four new `atlas.ledger module` tests FAIL; all pre-existing tests still PASS.

- [ ] **Step 3: Add `atlas.ledger` to `SYNC_MODULE_REGISTRY`**

Read `apps/api/src/services/sync-service.js` (required before editing). Find the `SYNC_MODULE_REGISTRY` object. After the `'atlas.catalog'` entry, add:

```js
  'atlas.ledger': {
    handlers: [
      makeHandler('account',          'ledgerAccount'),
      makeHandler('transaction',      'ledgerTransaction'),
      makeHandler('category',         'ledgerCategory'),
      makeHandler('transaction_type', 'ledgerTransactionType'),
    ],
  },
```

- [ ] **Step 4: Run all sync-service tests to verify they pass**

```bash
node --test apps/api/src/services/__tests__/sync-service.test.js
```

Expected: all tests PASS (existing + 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/sync-service.js apps/api/src/services/__tests__/sync-service.test.js
git commit -m "feat(offline): add atlas.ledger to SYNC_MODULE_REGISTRY (4 entity handlers)"
```

---

## Self-Review

### Spec coverage

From `docs/superpowers/specs/2026-06-07-offline-phase5-tauri-sqlite.md` section 4.1:
- ✅ `makeHandler('account', 'ledgerAccount')` — Task 1 Step 3
- ✅ `makeHandler('transaction', 'ledgerTransaction')` — Task 1 Step 3
- ✅ `makeHandler('category', 'ledgerCategory')` — Task 1 Step 3
- ✅ `makeHandler('transaction_type', 'ledgerTransactionType')` — Task 1 Step 3
- ✅ No push handler (read-only) — not added ✓
- ✅ Tests for all 4 handlers — Task 1 Steps 1–2

### Placeholder scan

None. All code is explicit.

### Type consistency

- `entityType` values used in tests (`'account'`, `'transaction'`, `'category'`, `'transaction_type'`) match the `makeHandler` first-argument values in Step 3. ✓
- `prismaKey` values (`ledgerAccount`, etc.) match the `makePrisma` stub keys added in Step 1. ✓

# Offline Phase 5B - Tauri SQLite Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tauri-only SQLite cache for `atlas.ledger` so reconnect sync pulls ledger data into a local database without changing existing Dexie behavior for other offline modules.

**Architecture:** Keep the existing `SyncEngine` focused on Dexie-backed modules and introduce a separate `LedgerSyncAdapter` for `atlas.ledger`. `OfflineProvider` continues to push first, then runs the normal Dexie pull for non-ledger modules and a second guarded ledger pull that persists records into a per-company SQLite database via `LedgerSQLiteStore`.

**Tech Stack:** JavaScript ESM, React 19, Dexie, Tauri 2, `@tauri-apps/plugin-sql`, `node --test`.

---

## File Map

| File | Action |
|---|---|
| `apps/desktop/src-tauri/Cargo.toml` | Modify - add `tauri-plugin-sql = "2"` |
| `apps/desktop/src-tauri/src/lib.rs` | Modify - register the SQL plugin in the Tauri builder |
| `apps/desktop/src-tauri/capabilities/default.json` | Modify - add SQL plugin permission |
| `apps/desktop/package.json` | Modify - add `@tauri-apps/plugin-sql` dependency |
| `packages/offline/package.json` | Modify - add `@tauri-apps/api` and `@tauri-apps/plugin-sql` dependencies used by the offline package |
| `packages/offline/src/ledger-sqlite.js` | Create - SQLite store, schema migration, reporting queries, Tauri guard |
| `packages/offline/src/ledger-sync-adapter.js` | Create - dedicated pull adapter for `atlas.ledger` with Dexie cursor storage |
| `packages/offline/src/offline-provider.jsx` | Modify - instantiate SQLite store/adapter, sequence Dexie and ledger pulls, clean up resources |
| `packages/offline/src/offline-modules.js` | Modify - include `atlas.ledger` in the allow-list |
| `packages/offline/src/index.js` | Modify - export `LedgerSQLiteStore`, `LedgerSyncAdapter`, and `isTauriAvailable` |
| `packages/offline/src/__tests__/ledger-sqlite.test.js` | Create - unit tests for migrations, upserts, and query helpers |
| `packages/offline/src/__tests__/ledger-sync-adapter.test.js` | Create - unit tests for pull URL, cursor updates, deletes, and token guard |
| `packages/offline/src/__tests__/offline-modules.test.js` | Modify - assert `atlas.ledger` is included |
| `packages/offline/src/__tests__/offline-provider.test.jsx` | Create - integration tests for guarded dual-pull behavior and cleanup |

---

## Task 1: Wire the Tauri SQL plugin into the desktop shell

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src-tauri/capabilities/default.json`
- Modify: `apps/desktop/package.json`
- Modify: `packages/offline/package.json`

### Background

The repo already ships a Tauri 2 desktop shell under `apps/desktop/src-tauri/`. Tauri plugins are not enabled by `tauri.conf.json`; they are registered in Rust and granted permissions through capability JSON files. The SQL plugin must be available both to the desktop app bundle (`apps/desktop/package.json`) and to the shared offline package that imports it (`packages/offline/package.json`).

### Steps

- [ ] **Step 1: Inspect the current Tauri setup before editing**

Run:

```bash
Get-Content -Raw 'apps/desktop/src-tauri/src/lib.rs'
Get-Content -Raw 'apps/desktop/src-tauri/capabilities/default.json'
```

Expected: `lib.rs` registers only the shell plugin and `default.json` contains a permissions array you can extend.

- [ ] **Step 2: Add a failing dependency smoke check**

Create `packages/offline/src/__tests__/ledger-sqlite.test.js` with this initial smoke test at the top of the file:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isTauriAvailable } from '../ledger-sqlite.js'

describe('isTauriAvailable', () => {
  it('returns false when Tauri internals are missing', () => {
    const originalWindow = globalThis.window
    globalThis.window = undefined
    try {
      assert.equal(isTauriAvailable(), false)
    } finally {
      globalThis.window = originalWindow
    }
  })
})
```

This will fail until `packages/offline/src/ledger-sqlite.js` exists.

- [ ] **Step 3: Add the desktop and offline package dependencies**

Update `apps/desktop/package.json`:

```json
    "@tauri-apps/api": "latest",
    "@tauri-apps/plugin-sql": "^2.0.0",
```

Update `packages/offline/package.json`:

```json
  "dependencies": {
    "@tauri-apps/api": "latest",
    "@tauri-apps/plugin-sql": "^2.0.0",
    "dexie": "^3.2.7"
  },
```

- [ ] **Step 4: Register the Rust plugin and capability**

Update `apps/desktop/src-tauri/Cargo.toml` dependencies:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-sql = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Update `apps/desktop/src-tauri/src/lib.rs` so the builder includes both plugins:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Update `apps/desktop/src-tauri/capabilities/default.json` by adding the SQL permission entry to the `permissions` array:

```json
    "sql:default",
```

- [ ] **Step 5: Run lightweight verification**

Run:

```bash
pnpm --filter @atlas/offline test -- --test-name-pattern="isTauriAvailable"
pnpm --filter @atlas/desktop exec node -e "const pkg=require('./package.json'); console.log(Boolean(pkg.dependencies['@tauri-apps/plugin-sql']))"
```

Expected: the offline test still fails because `ledger-sqlite.js` is not implemented yet; the package dependency check prints `true`.

---

## Task 2: Build `LedgerSQLiteStore` with schema migration and query helpers

**Files:**
- Create: `packages/offline/src/ledger-sqlite.js`
- Create: `packages/offline/src/__tests__/ledger-sqlite.test.js`

### Background

`LedgerSQLiteStore` owns the local file-backed SQLite database for a single company. It must:
- lazily open `sqlite:${appDataDir}/atlas-erp/ledger-${companyId}.db`
- create four tables and indexes if missing
- upsert or delete pulled records by `entityType`
- expose read helpers needed by Phase 5C so we do not redesign the SQL layer later

Keep the implementation browser-safe by guarding all Tauri-specific imports behind runtime checks or lazy calls. The file must be importable in Node tests and web preview.

### Steps

- [ ] **Step 1: Replace the smoke test with a real mocked-SQLite test file**

Write `packages/offline/src/__tests__/ledger-sqlite.test.js` using the mockable seams below:

```js
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { LedgerSQLiteStore, isTauriAvailable } from '../ledger-sqlite.js'

function makeDbMock() {
  const executes = []
  const selects = []
  return {
    executes,
    selects,
    async execute(sql, params = []) {
      executes.push({ sql, params })
      return { rowsAffected: 1 }
    },
    async select(sql, params = []) {
      selects.push({ sql, params })
      if (sql.includes('FROM ledger_account')) {
        return [{ id: 'acc-1', name: 'Caja', bank: 'Atlas', currency: 'MXN' }]
      }
      if (sql.includes('FROM ledger_transaction')) {
        return [{ id: 'tx-1', nombre: 'Deposito', fecha: '2026-06-07', deposito: 10, retiro: null }]
      }
      if (sql.includes('SUM(COALESCE(deposito, 0) - COALESCE(retiro, 0))')) {
        return [{ balance: 110 }]
      }
      if (sql.includes('strftime')) {
        return [{ month: '06', deposit_total: 10, withdrawal_total: 2 }]
      }
      if (sql.includes('GROUP BY c.id')) {
        return [{ category_id: 'cat-1', category_name: 'Ingresos', total: 10 }]
      }
      return []
    },
    async close() {},
  }
}

describe('LedgerSQLiteStore', () => {
  let store
  let db

  beforeEach(() => {
    db = makeDbMock()
    store = new LedgerSQLiteStore({
      companyId: 'company-1',
      dbLoader: async () => db,
      appDataResolver: async () => 'C:/AtlasData',
    })
  })

  it('returns false outside Tauri', () => {
    const originalWindow = globalThis.window
    globalThis.window = undefined
    try {
      assert.equal(isTauriAvailable(), false)
    } finally {
      globalThis.window = originalWindow
    }
  })

  it('creates tables and indexes during open', async () => {
    await store.open()
    assert.ok(db.executes.some((entry) => entry.sql.includes('CREATE TABLE IF NOT EXISTS ledger_account')))
    assert.ok(db.executes.some((entry) => entry.sql.includes('CREATE INDEX IF NOT EXISTS idx_lt_account_fecha')))
  })

  it('upserts account rows', async () => {
    await store.open()
    await store.upsertBatch('account', [{
      id: 'acc-1',
      companyId: 'company-1',
      name: 'Caja',
      bank: 'Atlas',
      accountNumber: '1234',
      currency: 'MXN',
      openingBalance: 100,
      enabled: true,
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
    }])
    assert.ok(db.executes.some((entry) => entry.sql.includes('INSERT OR REPLACE INTO ledger_account')))
  })

  it('deletes rows when record is marked deleted', async () => {
    await store.open()
    await store.upsertBatch('transaction', [{ id: 'tx-1', deleted: true }])
    assert.ok(db.executes.some((entry) => entry.sql.includes('DELETE FROM ledger_transaction WHERE id = ?')))
  })

  it('queries transactions, balances, monthly summary, and category breakdown', async () => {
    await store.open()
    assert.equal((await store.getAccountList()).length, 1)
    assert.equal((await store.queryTransactions('acc-1', { start: '2026-06-01', end: '2026-06-30' })).length, 1)
    assert.equal(await store.getRunningBalance('acc-1', '2026-06-30'), 110)
    assert.equal((await store.getMonthlySummary('acc-1', 2026)).length, 1)
    assert.equal((await store.getCategoryBreakdown('acc-1', { start: '2026-06-01', end: '2026-06-30' })).length, 1)
  })
})
```

- [ ] **Step 2: Run the new test to confirm it fails**

Run:

```bash
node --test packages/offline/src/__tests__/ledger-sqlite.test.js
```

Expected: FAIL with module-not-found or missing exports for `../ledger-sqlite.js`.

- [ ] **Step 3: Implement `packages/offline/src/ledger-sqlite.js`**

Create the file with this structure:

```js
import { appDataDir } from '@tauri-apps/api/path'
import Database from '@tauri-apps/plugin-sql'

const ENTITY_CONFIG = {
  account: {
    table: 'ledger_account',
    columns: ['id', 'company_id', 'name', 'bank', 'account_number', 'currency', 'opening_balance', 'enabled', 'created_at', 'updated_at'],
    mapRecord(record) {
      return [
        record.id,
        record.companyId,
        record.name,
        record.bank,
        record.accountNumber ?? null,
        record.currency ?? 'MXN',
        Number(record.openingBalance ?? 0),
        record.enabled === false ? 0 : 1,
        record.createdAt,
        record.updatedAt,
      ]
    },
  },
  transaction: {
    table: 'ledger_transaction',
    columns: ['id', 'company_id', 'account_id', 'category_id', 'tipo_id', 'fecha', 'numero', 'nombre', 'referencia', 'concepto', 'deposito', 'retiro', 'enabled', 'created_at', 'updated_at'],
    mapRecord(record) {
      return [
        record.id,
        record.companyId,
        record.accountId,
        record.categoryId ?? null,
        record.tipoId ?? null,
        record.fecha,
        record.numero ?? null,
        record.nombre,
        record.referencia ?? null,
        record.concepto ?? null,
        record.deposito ?? null,
        record.retiro ?? null,
        record.enabled === false ? 0 : 1,
        record.createdAt,
        record.updatedAt,
      ]
    },
  },
  category: {
    table: 'ledger_category',
    columns: ['id', 'company_id', 'name', 'color', 'kind', 'enabled', 'created_at', 'updated_at'],
    mapRecord(record) {
      return [
        record.id,
        record.companyId,
        record.name,
        record.color ?? null,
        record.kind ?? 'both',
        record.enabled === false ? 0 : 1,
        record.createdAt,
        record.updatedAt,
      ]
    },
  },
  transaction_type: {
    table: 'ledger_transaction_type',
    columns: ['id', 'company_id', 'code', 'name', 'enabled', 'created_at', 'updated_at'],
    mapRecord(record) {
      return [
        record.id,
        record.companyId,
        record.code,
        record.name,
        record.enabled === false ? 0 : 1,
        record.createdAt,
        record.updatedAt,
      ]
    },
  },
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS ledger_account (...)`,
  `CREATE TABLE IF NOT EXISTS ledger_transaction (...)`,
  `CREATE TABLE IF NOT EXISTS ledger_category (...)`,
  `CREATE TABLE IF NOT EXISTS ledger_transaction_type (...)`,
  `CREATE INDEX IF NOT EXISTS idx_lt_account_fecha ON ledger_transaction(account_id, fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_lt_company_fecha ON ledger_transaction(company_id, fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_lt_category ON ledger_transaction(category_id)`,
]

export function isTauriAvailable() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

export class LedgerSQLiteStore {
  constructor({ companyId, dbLoader, appDataResolver } = {}) {
    this.companyId = companyId
    this.db = null
    this.#dbLoader = dbLoader ?? (async (path) => Database.load(path))
    this.#appDataResolver = appDataResolver ?? appDataDir
  }

  async open() { ... }
  async _migrate() { ... }
  async upsertBatch(entityType, records = []) { ... }
  async getAccountList() { ... }
  async queryTransactions(accountId, { start, end, limit = 100, offset = 0 } = {}) { ... }
  async getRunningBalance(accountId, upToDate) { ... }
  async getMonthlySummary(accountId, year) { ... }
  async getCategoryBreakdown(accountId, { start, end } = {}) { ... }
  async close() { ... }
}
```

Implementation requirements:
- use `sqlite:${normalizedPath}/atlas-erp/ledger-${companyId}.db`
- normalize backslashes to forward slashes before building the SQLite URI
- call `_migrate()` exactly once per successful `open()`
- make `upsertBatch()` accept either raw record objects or sync-record wrappers (`{ id, data, deleted }`) by normalizing `record.data ?? record`
- delete rows when `record.deleted === true`
- return plain JS objects from all query helpers

- [ ] **Step 4: Run the SQLite store tests until green**

Run:

```bash
node --test packages/offline/src/__tests__/ledger-sqlite.test.js
```

Expected: PASS.

---

## Task 3: Build `LedgerSyncAdapter` for pull-only ledger sync

**Files:**
- Create: `packages/offline/src/ledger-sync-adapter.js`
- Create: `packages/offline/src/__tests__/ledger-sync-adapter.test.js`

### Background

The adapter should reuse the same `/sync/pull` response contract as `SyncEngine`, but store data in SQLite and keep cursor state in Dexie `sync_state`. This avoids changing the server protocol and gives ledger the same incremental pull behavior as other modules.

### Steps

- [ ] **Step 1: Add failing adapter tests**

Create `packages/offline/src/__tests__/ledger-sync-adapter.test.js`:

```js
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { LedgerSyncAdapter } from '../ledger-sync-adapter.js'

let dbCounter = 0

function makeDb() {
  return new AtlasOfflineDatabase(`test-ledger-sync-${++dbCounter}`)
}

describe('LedgerSyncAdapter', () => {
  let db
  let storeCalls
  let adapter

  beforeEach(async () => {
    db = makeDb()
    await db.open()
    storeCalls = []
    adapter = new LedgerSyncAdapter({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      ledgerStore: {
        async upsertBatch(entityType, records) {
          storeCalls.push({ entityType, records })
        },
      },
      fetchImpl: async (url) => ({
        ok: true,
        json: async () => ({
          records: [
            { moduleKey: 'atlas.ledger', entityType: 'account', id: 'acc-1', data: { id: 'acc-1', companyId: 'company-1', name: 'Caja', bank: 'Atlas', currency: 'MXN', openingBalance: 0, enabled: true, createdAt: '2026-06-07T00:00:00Z', updatedAt: '2026-06-07T00:00:00Z' }, version: '2026-06-07T00:00:00Z', deleted: false },
            { moduleKey: 'atlas.ledger', entityType: 'transaction', id: 'tx-1', data: { id: 'tx-1', companyId: 'company-1', accountId: 'acc-1', fecha: '2026-06-07', nombre: 'Deposito', deposito: 10, retiro: null, enabled: true, createdAt: '2026-06-07T00:00:00Z', updatedAt: '2026-06-07T00:00:00Z' }, version: '2026-06-07T00:00:00Z', deleted: false },
          ],
          nextCursor: '2026-06-07T01:00:00Z',
        }),
      }),
    })
  })

  afterEach(async () => {
    await db.delete().catch(() => {})
  })

  it('pulls atlas.ledger records and groups them by entity type before writing', async () => {
    const result = await adapter.pull()
    assert.equal(result.pulled, 2)
    assert.equal(storeCalls.length, 2)
    assert.equal(storeCalls[0].entityType, 'account')
    assert.equal(storeCalls[1].entityType, 'transaction')
  })

  it('stores nextCursor in sync_state for seen entity types', async () => {
    await adapter.pull()
    const accountState = await db.sync_state.get(['atlas.ledger', 'account'])
    const txState = await db.sync_state.get(['atlas.ledger', 'transaction'])
    assert.equal(accountState.serverCursor, '2026-06-07T01:00:00Z')
    assert.equal(txState.serverCursor, '2026-06-07T01:00:00Z')
  })

  it('reuses the oldest stored ledger cursor in the request URL', async () => {
    await db.sync_state.put({
      moduleKey: 'atlas.ledger',
      entityType: 'account',
      lastPullAt: '2026-06-06T00:00:00Z',
      serverCursor: '2026-06-06T00:00:00Z',
      schemaVersion: null,
    })

    let capturedUrl = null
    adapter = new LedgerSyncAdapter({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      ledgerStore: { async upsertBatch() {} },
      fetchImpl: async (url) => {
        capturedUrl = url
        return { ok: true, json: async () => ({ records: [], nextCursor: null }) }
      },
    })

    await adapter.pull()
    assert.ok(capturedUrl.includes('modules=atlas.ledger'))
    assert.ok(capturedUrl.includes('cursor=2026-06-06T00%3A00%3A00Z'))
  })

  it('skips the network call when no token is available', async () => {
    let called = false
    adapter = new LedgerSyncAdapter({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => null,
      ledgerStore: { async upsertBatch() {} },
      fetchImpl: async () => { called = true; return { ok: true, json: async () => ({ records: [], nextCursor: null }) } },
    })
    const result = await adapter.pull()
    assert.deepEqual(result, { pulled: 0, nextCursor: null })
    assert.equal(called, false)
  })
})
```

- [ ] **Step 2: Run the adapter test to confirm it fails**

Run:

```bash
node --test packages/offline/src/__tests__/ledger-sync-adapter.test.js
```

Expected: FAIL because `ledger-sync-adapter.js` does not exist yet.

- [ ] **Step 3: Implement `packages/offline/src/ledger-sync-adapter.js`**

Create the adapter with the same concurrency and cursor behavior as `SyncEngine`:

```js
export class LedgerSyncAdapter {
  #db
  #apiBaseUrl
  #getToken
  #ledgerStore
  #fetchImpl
  #pulling = false

  constructor({ db, apiBaseUrl, getToken, ledgerStore, fetchImpl }) {
    this.#db = db
    this.#apiBaseUrl = (apiBaseUrl ?? '').replace(/\/$/, '')
    this.#getToken = getToken
    this.#ledgerStore = ledgerStore
    this.#fetchImpl = fetchImpl ?? ((...args) => globalThis.fetch(...args))
  }

  async pull() {
    if (this.#pulling) return { pulled: 0, nextCursor: null }
    this.#pulling = true
    try {
      const token = await this.#getToken()
      if (!token) return { pulled: 0, nextCursor: null }

      const allStates = await this.#db.sync_state.toArray()
      const relevantStates = allStates.filter((state) => state.moduleKey === 'atlas.ledger')
      const oldestCursor = relevantStates.reduce((min, state) => {
        if (!state.serverCursor) return min
        if (min === null || state.serverCursor < min) return state.serverCursor
        return min
      }, null)

      const url = new URL(`${this.#apiBaseUrl}/sync/pull`)
      url.searchParams.set('modules', 'atlas.ledger')
      if (oldestCursor) url.searchParams.set('cursor', oldestCursor)

      const response = await this.#fetchImpl(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        throw new Error(`Ledger pull failed: ${response.status}`)
      }

      const { records, nextCursor } = await response.json()
      const grouped = new Map()
      for (const record of records) {
        if (record.moduleKey !== 'atlas.ledger') continue
        const bucket = grouped.get(record.entityType) ?? []
        bucket.push(record)
        grouped.set(record.entityType, bucket)
      }

      for (const [entityType, entityRecords] of grouped.entries()) {
        await this.#ledgerStore.upsertBatch(entityType, entityRecords)
      }

      const now = new Date().toISOString()
      await this.#db.transaction('rw', [this.#db.sync_state], async () => {
        for (const entityType of grouped.keys()) {
          await this.#db.sync_state.put({
            moduleKey: 'atlas.ledger',
            entityType,
            lastPullAt: now,
            serverCursor: nextCursor,
            schemaVersion: null,
          })
        }
      })

      return { pulled: records.length, nextCursor }
    } finally {
      this.#pulling = false
    }
  }
}
```

- [ ] **Step 4: Run the adapter test until green**

Run:

```bash
node --test packages/offline/src/__tests__/ledger-sync-adapter.test.js
```

Expected: PASS.

---

## Task 4: Integrate ledger SQLite sync into `OfflineProvider`

**Files:**
- Modify: `packages/offline/src/offline-provider.jsx`
- Modify: `packages/offline/src/offline-modules.js`
- Modify: `packages/offline/src/index.js`
- Modify: `packages/offline/src/__tests__/offline-modules.test.js`
- Create: `packages/offline/src/__tests__/offline-provider.test.jsx`

### Background

`OfflineProvider` is the orchestration point. It already owns the Dexie database, transport, and `SyncEngine`. Phase 5B adds a second optional sync path only when the app is running inside Tauri and a company session is available.

The provider should:
- continue to open Dexie unconditionally
- instantiate `LedgerSQLiteStore` and `LedgerSyncAdapter` lazily
- exclude `atlas.ledger` from the Dexie pull
- run the ledger pull after the Dexie pull
- close the SQLite database on cleanup

### Steps

- [ ] **Step 1: Add failing integration tests**

Create `packages/offline/src/__tests__/offline-provider.test.jsx` with mocks for `SessionVault`, `SyncEngine`, `LedgerSQLiteStore`, and `LedgerSyncAdapter`:

```jsx
import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'

const syncPullCalls = []
const ledgerPullCalls = []
const openedCompanies = []
const closedCompanies = []

mock.module('../session-vault.js', {
  namedExports: {
    SessionVault: class {
      constructor() {}
      async load() {
        return {
          accessToken: 'tok',
          companyId: 'company-1',
        }
      }
    },
  },
})

mock.module('../sync-engine.js', {
  namedExports: {
    SyncEngine: class {
      async push() {}
      async pull(args) {
        syncPullCalls.push(args.modules)
        return { pulled: 0, nextCursor: null }
      }
    },
  },
})

mock.module('../ledger-sqlite.js', {
  namedExports: {
    isTauriAvailable: () => true,
    LedgerSQLiteStore: class {
      constructor({ companyId }) {
        this.companyId = companyId
      }
      async open() { openedCompanies.push(this.companyId) }
      async close() { closedCompanies.push(this.companyId) }
    },
  },
})

mock.module('../ledger-sync-adapter.js', {
  namedExports: {
    LedgerSyncAdapter: class {
      async pull() {
        ledgerPullCalls.push('pull')
        return { pulled: 0, nextCursor: null }
      }
    },
  },
})

const { OfflineProvider } = await import('../offline-provider.jsx')

describe('OfflineProvider ledger integration', () => {
  beforeEach(() => {
    syncPullCalls.length = 0
    ledgerPullCalls.length = 0
    openedCompanies.length = 0
    closedCompanies.length = 0
  })

  it('pulls non-ledger modules through SyncEngine and ledger through LedgerSyncAdapter', async () => {
    let renderer
    await act(async () => {
      renderer = TestRenderer.create(
        <OfflineProvider apiBaseUrl="http://localhost:4010">
          <div>child</div>
        </OfflineProvider>
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    assert.equal(syncPullCalls.length >= 1, true)
    assert.ok(syncPullCalls[0].includes('atlas.contacts'))
    assert.equal(syncPullCalls[0].includes('atlas.ledger'), false)
    assert.equal(ledgerPullCalls.length >= 1, true)
    assert.deepEqual(openedCompanies, ['company-1'])

    renderer.unmount()
  })
})
```

- [ ] **Step 2: Run the provider and module tests to confirm they fail**

Run:

```bash
node --test packages/offline/src/__tests__/offline-provider.test.jsx packages/offline/src/__tests__/offline-modules.test.js
```

Expected: FAIL because `offline-provider.jsx` does not yet import or use the ledger classes, and `OFFLINE_MODULES` does not yet include `atlas.ledger`.

- [ ] **Step 3: Update `OFFLINE_MODULES` and exports**

Modify `packages/offline/src/offline-modules.js`:

```js
export const OFFLINE_MODULES = [
  'atlas.contacts',
  'atlas.hr',
  'custom.fleet',
  'atlas.calendar',
  'atlas.catalog',
  'atlas.ledger',
]
```

Update `packages/offline/src/__tests__/offline-modules.test.js` to assert the sixth module:

```js
    assert.ok(OFFLINE_MODULES.includes('atlas.ledger'))
```

Update `packages/offline/src/index.js`:

```js
export { LedgerSQLiteStore, isTauriAvailable } from './ledger-sqlite.js'
export { LedgerSyncAdapter } from './ledger-sync-adapter.js'
```

- [ ] **Step 4: Wire `OfflineProvider`**

Modify `packages/offline/src/offline-provider.jsx` with these changes:

1. Add imports:

```js
import { LedgerSQLiteStore, isTauriAvailable } from './ledger-sqlite.js'
import { LedgerSyncAdapter } from './ledger-sync-adapter.js'
```

2. Add refs:

```js
  const ledgerStoreRef = useRef(null)
  const ledgerSyncAdapterRef = useRef(null)
```

3. After `engineRef.current = engine`, resolve the current session and initialize the ledger store only in Tauri:

```js
    async function initializeLedger() {
      if (!isTauriAvailable()) return
      try {
        const session = await vault.load()
        const companyId = session?.companyId ?? session?.memberships?.[0]?.companyId ?? null
        if (!companyId) return

        const ledgerStore = new LedgerSQLiteStore({ companyId })
        await ledgerStore.open()
        ledgerStoreRef.current = ledgerStore

        ledgerSyncAdapterRef.current = new LedgerSyncAdapter({
          db: database,
          apiBaseUrl,
          getToken: () => vault.load().then((s) => s?.accessToken ?? null),
          ledgerStore,
        })
      } catch (err) {
        console.warn('[atlas/offline] Ledger SQLite unavailable - atlas.ledger stays online-only', err?.message ?? err)
      }
    }
```

4. Call `initializeLedger()` before the first sync run.

5. Update `runSync()`:

```js
        await engine.pull({ modules: OFFLINE_MODULES.filter((moduleKey) => moduleKey !== 'atlas.ledger') })
        if (isTauriAvailable() && ledgerSyncAdapterRef.current) {
          await ledgerSyncAdapterRef.current.pull().catch((err) => {
            console.warn('[atlas/offline] Ledger pull failed', err?.message ?? err)
          })
        }
```

6. Close SQLite in cleanup:

```js
      ledgerSyncAdapterRef.current = null
      const ledgerStore = ledgerStoreRef.current
      ledgerStoreRef.current = null
      if (ledgerStore) {
        await ledgerStore.close().catch(() => {})
      }
```

7. Expose the new refs from context:

```js
    <OfflineContext.Provider value={{ dbRef, engineRef, ledgerStoreRef, ledgerSyncAdapterRef }}>
```

- [ ] **Step 5: Run targeted offline package tests**

Run:

```bash
node --test packages/offline/src/__tests__/ledger-sqlite.test.js packages/offline/src/__tests__/ledger-sync-adapter.test.js packages/offline/src/__tests__/offline-modules.test.js packages/offline/src/__tests__/offline-provider.test.jsx
```

Expected: PASS.

---

## Task 5: Run package-level verification and document follow-up

**Files:**
- No additional code changes expected unless verification finds issues

### Steps

- [ ] **Step 1: Run the full offline package test suite**

Run:

```bash
pnpm --filter @atlas/offline test
```

Expected: PASS.

- [ ] **Step 2: Run a desktop dependency install sanity check**

Run:

```bash
pnpm install --lockfile-only
pnpm --filter @atlas/desktop exec node -e "const pkg=require('./package.json'); console.log(pkg.dependencies['@tauri-apps/plugin-sql'])"
```

Expected: the lockfile updates cleanly and the dependency version prints.

- [ ] **Step 3: Run a syntax check on the new offline files**

Run:

```bash
node --check packages/offline/src/ledger-sqlite.js
node --check packages/offline/src/ledger-sync-adapter.js
```

Expected: both commands exit successfully.

---

## Self-Review

### Spec coverage

From `docs/superpowers/specs/2026-06-07-offline-phase5-tauri-sqlite.md`:
- `tauri-plugin-sql = "2"` in Cargo - Task 1 Step 4
- SQL capability/permission enabled - Task 1 Step 4
- `@tauri-apps/plugin-sql` in desktop package - Task 1 Step 3
- `LedgerSQLiteStore` with schema, migration, upserts, query helpers, close - Task 2 Step 3
- `isTauriAvailable()` export - Task 2 Step 3 and Task 4 Step 3
- `LedgerSyncAdapter` as Option B - Task 3 Step 3
- `OfflineProvider` guarded dual-pull flow - Task 4 Step 4
- `atlas.ledger` added to `OFFLINE_MODULES` - Task 4 Step 3

### Placeholder scan

None. Every file path, command, and code shape is explicit.

### Type consistency

- `LedgerSQLiteStore` is constructed with `{ companyId }` consistently across the plan.
- `LedgerSyncAdapter.pull()` returns `{ pulled, nextCursor }` like `SyncEngine.pull()`.
- `entityType` values stay aligned with the backend registry: `account`, `transaction`, `category`, `transaction_type`.

# Offline Phase 5 — Tauri SQLite for atlas.ledger

## 1. Context & Goals

Phases 1–4 of the offline architecture gave the app full offline CRUD for Tier 1 modules and read-cache for Tier 2 using IndexedDB (Dexie). `atlas.ledger` was left as Tier 3 (online-only) because its primary value is **financial reporting** — running balances, monthly cash-flow summaries, category breakdowns — none of which are feasible in IndexedDB without pulling every transaction record to JavaScript and computing in-memory.

SQLite solves this cleanly: it runs locally, supports full SQL (JOINs, GROUP BY, window functions for running totals), and is available in the Tauri desktop shell via `tauri-plugin-sql`.

### Goals

1. `atlas.ledger` account list and transaction history are available offline (read-only cache).
2. Local reporting queries (running balance, monthly summary, category breakdown) execute against local SQLite — no server round-trip needed even when online.
3. The solution is Tauri-only: web preview (`pnpm dev:frontend`) falls back gracefully to online-only.
4. The existing pull sync infrastructure (`/sync/pull`, `SyncEngine`) is reused — no new sync protocol.

### Non-goals

- Offline *writes* for ledger transactions (Phase 5 is read cache only; offline writes introduce double-entry integrity risks that require a separate spec).
- Replacing IndexedDB — the two stores coexist. IndexedDB handles Tier 1/2 modules; SQLite handles ledger reporting.
- Encrypting the local SQLite file (deferred; current threat model matches IndexedDB, which is already used for session data).

---

## 2. Key Decisions

### 2.1 Why SQLite and not IndexedDB for ledger?

| Capability | IndexedDB (Dexie) | SQLite |
|---|---|---|
| Running balance (`SUM ... ORDER BY fecha`) | No — requires full table scan in JS | Yes — window functions or cumulative SUM |
| Monthly cash flow (`GROUP BY MONTH(fecha)`) | No | Yes |
| Cross-account aggregation | No | Yes — JOIN + GROUP BY |
| Filter + sort + paginate efficiently | Partial — index-only, no compound filters | Yes |
| Records per company (typical) | < 5 000 | 10 000 – 500 000 |

For contacts/HR/fleet, record counts are small and queries are simple (list + filter). IndexedDB is fine. For a ledger used daily for years, transaction counts grow large and reporting is SQL-shaped.

### 2.2 `tauri-plugin-sql` vs. WASM SQLite (`sql.js`)

| | `tauri-plugin-sql` | `sql.js` (WASM) |
|---|---|---|
| Runs in Tauri only | Yes — Rust-native | No — works in any browser |
| Persistent file | Yes — app data dir | No — in-memory only (unless wrapped) |
| Performance | Native (C SQLite) | ~5× slower (WASM overhead) |
| Bundle size delta | ~500 KB (Rust lib already there) | ~1.5 MB WASM file |
| Tauri version | Tauri 2 compatible | N/A |

**Decision: `tauri-plugin-sql`**. The app is already Tauri-only for production; WASM adds bundle size for no benefit.

### 2.3 Sync module: extend existing pull infrastructure

The existing `/sync/pull` endpoint accepts `modules: string[]` and returns records. Extending it with `atlas.ledger` follows the exact same `makeHandler` + `SYNC_MODULE_REGISTRY` pattern used for contacts, HR, fleet, and catalog. No new API routes needed.

### 2.4 Read-only — no push for Phase 5

`atlas.ledger` mutations (create transaction, update transaction) continue to go through the live API only. Adding offline writes to a double-entry accounting system requires:
- Debit/credit balance enforcement at the transaction boundary
- Account opening-balance reconciliation
- Import-file idempotency at the local level

This is a separate spec. Phase 5 is purely a read cache.

### 2.5 SQLite file location and multi-tenancy

Tauri's `appDataDir()` returns the OS-appropriate user data directory. Store one SQLite file per company:

```
{appDataDir}/atlas-erp/ledger-{companyId}.db
```

This provides data isolation between companies on shared devices without requiring encryption. A single-file approach with a `company_id` filter would also work but makes wipe-on-logout harder.

---

## 3. Architecture

### 3.1 New components

```
apps/desktop/src-tauri/Cargo.toml         Add tauri-plugin-sql = "2"
apps/desktop/src-tauri/tauri.conf.json    Add sql plugin capability
apps/desktop/package.json                 Add @tauri-apps/plugin-sql
packages/offline/src/ledger-sqlite.js     LedgerSQLiteStore — schema, migrations, query helpers
packages/offline/src/index.js             Export LedgerSQLiteStore
apps/api/src/services/sync-service.js     Add atlas.ledger to SYNC_MODULE_REGISTRY
apps/desktop/src/modules/atlas.ledger/    Hook changes (use SQLite when offline cache is available)
```

### 3.2 Data flow

```
Online path (unchanged):
  React → atlas.ledger.* SDK → Hono API → Prisma → Supabase

Offline cache path (new):
  OfflineProvider.runSync()
    → SyncEngine.pull({ modules: ['atlas.ledger', ...] })
    → GET /sync/pull → returns LedgerAccount, LedgerTransaction records
    → LedgerSQLiteStore.upsertBatch(records)   ← new step

Reporting path (new, offline-first in the final Phase 5C implementation):
  useAccountTransactions(accountId, { start, end })
    → if (isTauri && sqliteReady && appOffline) LedgerSQLiteStore.queryTransactions(...)
    → else atlas.ledger.listAccountTransactions(accountId, token, { start, end })
```

Implementation note: the original design considered using SQLite even while online for reporting reads. The final Phase 5C implementation keeps the live API as the online source of truth so freshly created or edited movements appear immediately without waiting for the next pull cycle. SQLite is therefore the offline read path, not the primary online read path.

### 3.3 `LedgerSQLiteStore`

Location: `packages/offline/src/ledger-sqlite.js`

```js
import Database from '@tauri-apps/plugin-sql'

export class LedgerSQLiteStore {
  constructor(companyId) { this.companyId = companyId; this.db = null }

  async open(appDataDir) {
    this.db = await Database.load(`sqlite:${appDataDir}/atlas-erp/ledger-${this.companyId}.db`)
    await this._migrate()
  }

  async _migrate() { /* CREATE TABLE IF NOT EXISTS for all 4 tables */ }

  async upsertBatch(entityType, records) { /* INSERT OR REPLACE */ }

  async queryTransactions(accountId, { start, end, limit, offset }) { /* SELECT ... */ }

  async getRunningBalance(accountId, upToDate) { /* cumulative SUM */ }

  async getMonthlySummary(accountId, year) { /* GROUP BY month */ }

  async getCategoryBreakdown(accountId, { start, end }) { /* JOIN + GROUP BY */ }

  async getAccountList() { /* SELECT all accounts for company */ }

  close() { return this.db?.close() }
}
```

### 3.4 SQLite schema

Four tables mirror the Prisma models exactly (same column names, same types):

```sql
CREATE TABLE IF NOT EXISTS ledger_account (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  bank            TEXT NOT NULL,
  account_number  TEXT,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  opening_balance REAL NOT NULL DEFAULT 0,
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_transaction (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL,
  account_id  TEXT NOT NULL,
  category_id TEXT,
  tipo_id     TEXT,
  fecha       TEXT NOT NULL,
  numero      TEXT,
  nombre      TEXT NOT NULL,
  referencia  TEXT,
  concepto    TEXT,
  deposito    REAL,
  retiro      REAL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_category (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT,
  kind       TEXT NOT NULL DEFAULT 'both',
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_transaction_type (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for reporting performance
CREATE INDEX IF NOT EXISTS idx_lt_account_fecha ON ledger_transaction(account_id, fecha);
CREATE INDEX IF NOT EXISTS idx_lt_company_fecha ON ledger_transaction(company_id, fecha);
CREATE INDEX IF NOT EXISTS idx_lt_category      ON ledger_transaction(category_id);
```

### 3.5 Tauri runtime detection

```js
// packages/offline/src/ledger-sqlite.js
export function isTauriAvailable() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}
```

This guard ensures `LedgerSQLiteStore` is never instantiated in web preview or tests.

### 3.6 Integration with `OfflineProvider`

`OfflineProvider` already calls `engine.pull({ modules: OFFLINE_MODULES })`. After Phase 5:

```js
// packages/offline/src/offline-modules.js — add:
export const OFFLINE_MODULES = [
  'atlas.contacts',
  'atlas.hr',
  'custom.fleet',
  'atlas.calendar',
  'atlas.catalog',
  'atlas.ledger',   // ← add (pull-only; SQLite store handles persistence)
]
```

But the `SyncEngine.pull()` handler for `atlas.ledger` must route to the `LedgerSQLiteStore` instead of Dexie's `offline_records` table. Two options:

**Option A:** Special-case `atlas.ledger` in `SyncEngine.pull()` — check entity type, if ledger → write to SQLite.

**Option B:** New `LedgerSyncAdapter` that has its own pull loop and runs after the main Dexie pull.

**Decision: Option B** — keeps SyncEngine and LedgerSQLiteStore decoupled. The `OfflineProvider` runs both:

```js
await engine.pull({ modules: OFFLINE_MODULES.filter(m => m !== 'atlas.ledger') })
if (isTauriAvailable() && ledgerStore) {
  await ledgerSyncAdapter.pull()
}
```

`LedgerSyncAdapter` uses the same `/sync/pull` endpoint with `modules: ['atlas.ledger']` and writes results directly to `LedgerSQLiteStore`.

---

## 4. Backend API Changes

### 4.1 Extend `SYNC_MODULE_REGISTRY` in `sync-service.js`

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

All four models have `companyId` + `updatedAt`, so `makeHandler` works directly. No custom fetch logic needed.

### 4.2 No push handler needed

Phase 5 is read-only. No `PUSH_MODULE_REGISTRY` entry for `atlas.ledger`.

---

## 5. Frontend Hook Changes

Ledger hooks in `apps/desktop/src/modules/atlas.ledger/` currently call `atlas.ledger.*` directly. After Phase 5, they gain an optional SQLite fast path:

```js
// Example: useAccountTransactions
export function useAccountTransactions(accountId, { start, end } = {}) {
  const token = useToken()
  const { ledgerStore } = useLedgerSQLite()  // new context hook
  return useQuery({
    queryKey: ['ledger', 'transactions', accountId, start, end],
    queryFn: async () => {
      if (ledgerStore) {
        return ledgerStore.queryTransactions(accountId, { start, end })
      }
      return atlas.ledger.listAccountTransactions(accountId, token, { start, end })
    },
    enabled: Boolean(accountId && (token || ledgerStore)),
    staleTime: 60 * 1000,
  })
}
```

New hooks (SQLite-only, no API equivalent):
- `useRunningBalance(accountId, upToDate)` — cumulative balance for chart rendering
- `useMonthlyCashFlow(accountId, year)` — monthly deposito/retiro groups
- `useCategoryBreakdown(accountId, { start, end })` — pie chart data

---

## 6. Module Classification Changes

| Module | Phase 1–4 tier | Phase 5 tier |
|---|---|---|
| `atlas.ledger` | Tier 3 — online only | Tier 2.5 — read cache via SQLite, writes online only |

"Tier 2.5" means: account list and transaction history available offline; mutations (create/update/import) still require connectivity.

The offline navigation guard (`OFFLINE_MODULES`) is updated to include `atlas.ledger` — users can browse account history offline.

---

## 7. Phased Implementation

### Phase 5A — Backend pull support (API only)

- Add `atlas.ledger` to `SYNC_MODULE_REGISTRY` (4 entity handlers)
- Tests for all 4 handlers
- No frontend changes

**Deliverable:** `/sync/pull?modules=atlas.ledger` returns ledger data correctly scoped by companyId.

### Phase 5B — Tauri SQLite integration

- Add `tauri-plugin-sql` to Cargo.toml + tauri.conf.json
- Add `@tauri-apps/plugin-sql` to `apps/desktop/package.json`
- Implement `LedgerSQLiteStore` in `packages/offline/src/ledger-sqlite.js`
- Implement `LedgerSyncAdapter` using existing `/sync/pull`
- Wire into `OfflineProvider` (guarded by `isTauriAvailable()`)
- Add `atlas.ledger` to `OFFLINE_MODULES`

**Deliverable:** On reconnect, ledger data is pulled and stored in SQLite. No frontend reads yet.

### Phase 5C — Frontend ledger hooks read from SQLite

- `useLedgerSQLiteContext` / `useLedgerSQLite` hook
- Migrate `useAccountTransactions` and `useAccountList` to use SQLite during offline reads
- New `useRunningBalance`, `useMonthlyCashFlow`, `useCategoryBreakdown` hooks
- Update offline navigation guard: `atlas.ledger` no longer blocked offline

**Deliverable:** Account history browses offline. Running balance and category charts work offline. New local-SQL reporting hooks available.

**Status:** Implemented on 2026-06-07 via `docs/superpowers/specs/2026-06-07-offline-phase5c-ledger-hooks.md` and `docs/superpowers/plans/2026-06-07-offline-phase5c-ledger-hooks.md`.

---

## 8. Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| `tauri-plugin-sql` not available in web preview | `isTauriAvailable()` guard; all hooks fall back to API calls |
| SQLite file grows large over time | `LedgerSQLiteStore` keeps only `enabled = true` records; a `VACUUM` job on app open trims deleted rows |
| Running balance drift if sync is stale | Show "last synced: X min ago" in the account header; stale indicator > 30 min |
| Multi-company users: wrong company data | File is keyed by `companyId`; switching company opens a different DB file |
| Tauri version compatibility | App is on Tauri 2; `tauri-plugin-sql = "2"` targets Tauri 2 exactly |
| SQLite decimal precision vs. Postgres DECIMAL(15,2) | Store as REAL (double) — sufficient for MXN amounts up to ~9 trillion with 2 decimal places; display formatting is done in JS anyway |

---

## 9. Documentation Requirements

- `packages/offline/README.md`: add SQLite section explaining `isTauriAvailable()`, `LedgerSQLiteStore`, and `LedgerSyncAdapter`
- `docs/ai-context/ame3-runtime-capabilities.md`: note `useLedgerSQLite` hook availability
- `CLAUDE.md`: note that `atlas.ledger` is now Tier 2.5 (read cache via SQLite in Tauri builds)

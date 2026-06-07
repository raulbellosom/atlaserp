# Offline Phase 5C - Ledger SQLite Read Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the ledger offline phase by routing account list/detail/history/summary reads through the SQLite cache in Tauri while preserving API fallback and keeping writes online-only.

**Architecture:** Extend `LedgerSQLiteStore` so it can answer the same read shapes the current ledger screens already consume, then add a small desktop-side ledger data client plus React Query hooks that choose SQLite first and HTTP second. Update the four ledger screens to use those hooks and make online-only actions explicit when the app is offline.

**Tech Stack:** JavaScript ESM, React 19, `@tanstack/react-query`, Tauri 2, `@atlas/offline`, Node.js built-in test runner.

---

## File Map

| File | Action |
|---|---|
| `docs/superpowers/specs/2026-06-07-offline-phase5c-ledger-hooks.md` | Create - focused Phase 5C spec |
| `docs/superpowers/plans/2026-06-07-offline-phase5c-ledger-hooks.md` | Create - implementation plan |
| `packages/offline/src/ledger-sqlite.js` | Modify - add richer account/detail/reporting helpers |
| `packages/offline/src/__tests__/ledger-sqlite.test.js` | Modify - cover new SQLite read helpers |
| `apps/desktop/src/modules/atlas.ledger/lib/ledger-data-client.js` | Create - SQLite-first/fallback read client |
| `apps/desktop/src/modules/atlas.ledger/lib/__tests__/ledger-data-client.test.js` | Create - client selection and API parity tests |
| `apps/desktop/src/modules/atlas.ledger/hooks/use-ledger-queries.js` | Create - React Query hooks for account/list/history/summary |
| `apps/desktop/src/modules/atlas.ledger/screens/AccountsScreen.jsx` | Modify - use local list hook and offline-only view |
| `apps/desktop/src/modules/atlas.ledger/screens/AccountScreen.jsx` | Modify - use new account/types/categories hooks |
| `apps/desktop/src/modules/atlas.ledger/screens/SpreadsheetRegister.jsx` | Modify - use local history hook and disable writes offline |
| `apps/desktop/src/modules/atlas.ledger/screens/AccountSummary.jsx` | Modify - use local/API summary hook |
| `docs/superpowers/specs/2026-06-07-offline-phase5-tauri-sqlite.md` | Modify - mark 5C as implemented |
| `docs/TASKS.md` | Modify - reflect real offline phase completion |
| `CLAUDE.md` | Modify - document ledger Tier 2.5 read cache behavior |

---

## Task 1: Extend `LedgerSQLiteStore` for Phase 5C read parity

**Files:**
- Modify: `packages/offline/src/__tests__/ledger-sqlite.test.js`
- Modify: `packages/offline/src/ledger-sqlite.js`

- [ ] **Step 1: Add failing tests for account detail, catalogs, and summary shape**

Add these expectations to `packages/offline/src/__tests__/ledger-sqlite.test.js`:

```js
it('returns account list rows with current_balance and account ownership fields', async () => {
  await store.open()
  const rows = await store.getAccountList()
  assert.equal(rows[0].current_balance, 110)
})

it('returns a single account with current_balance', async () => {
  await store.open()
  const row = await store.getAccount('acc-1')
  assert.equal(row.id, 'acc-1')
})

it('returns local transaction types and categories', async () => {
  await store.open()
  assert.equal((await store.getTransactionTypes()).length, 1)
  assert.equal((await store.getCategories()).length, 1)
})

it('returns API-shaped account summary payload', async () => {
  await store.open()
  const summary = await store.getAccountSummary('acc-1', {
    start: '2026-06-01',
    end: '2026-06-30',
  })

  assert.deepEqual(Object.keys(summary), ['kpis', 'balance_series', 'by_category'])
  assert.equal(typeof summary.kpis.current_balance, 'number')
  assert.equal(Array.isArray(summary.balance_series), true)
  assert.equal(Array.isArray(summary.by_category), true)
})
```

- [ ] **Step 2: Run the SQLite store test and confirm the new assertions fail**

Run:

```bash
node --test packages/offline/src/__tests__/ledger-sqlite.test.js
```

Expected: FAIL because `getAccount`, `getTransactionTypes`, `getCategories`, and `getAccountSummary` do not exist yet and the current query shapes are not rich enough.

- [ ] **Step 3: Implement richer SQLite helpers**

Update `packages/offline/src/ledger-sqlite.js` so it adds:

```js
async getAccountList() { /* include owner_id, group_id, current_balance */ }
async getAccount(accountId) { /* same row shape as API detail */ }
async getTransactionTypes() { /* SELECT enabled type rows */ }
async getCategories() { /* SELECT enabled category rows */ }
async getAccountSummary(accountId, { start, end } = {}) { /* return kpis + balance_series + by_category */ }
```

Implementation notes:

- `getAccountList()` and `getAccount()` compute `current_balance` in SQL with the same aggregate shape the API uses.
- `queryTransactions()` joins account/type/category tables and returns `consecutive` and `saldo_actual`.
- `getAccountSummary()` returns the current API shape instead of raw SQL rows.
- `getCategoryBreakdown()` returns per-category `deposito` and `retiro`, not only a net total.

- [ ] **Step 4: Re-run the SQLite store test until it passes**

Run:

```bash
node --test packages/offline/src/__tests__/ledger-sqlite.test.js
```

Expected: PASS.

---

## Task 2: Add a SQLite-first ledger data client

**Files:**
- Create: `apps/desktop/src/modules/atlas.ledger/lib/__tests__/ledger-data-client.test.js`
- Create: `apps/desktop/src/modules/atlas.ledger/lib/ledger-data-client.js`

- [ ] **Step 1: Write a failing client test for SQLite-first behavior**

Create `apps/desktop/src/modules/atlas.ledger/lib/__tests__/ledger-data-client.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createLedgerDataClient } from '../ledger-data-client.js'

test('uses ledgerStore for account list before falling back to fetch', async () => {
  let fetchCalls = 0
  const client = createLedgerDataClient({
    apiBaseUrl: 'http://localhost:4010',
    fetchImpl: async () => {
      fetchCalls += 1
      return { ok: true, json: async () => ({ data: [] }) }
    },
  })

  const result = await client.listAccounts({
    token: null,
    ledgerStore: {
      async getAccountList() {
        return [{ id: 'acc-1', name: 'Caja', current_balance: 10 }]
      },
    },
  })

  assert.equal(fetchCalls, 0)
  assert.equal(result.data[0].id, 'acc-1')
})

test('falls back to HTTP when ledgerStore is unavailable', async () => {
  const client = createLedgerDataClient({
    apiBaseUrl: 'http://localhost:4010',
    fetchImpl: async (url) => ({
      ok: true,
      json: async () => ({ url, data: [{ id: 'acc-2' }] }),
    }),
  })

  const result = await client.listAccounts({ token: 'tok', ledgerStore: null })
  assert.equal(result.data[0].id, 'acc-2')
  assert.match(result.url, /\\/ledger\\/accounts$/)
})
```

- [ ] **Step 2: Run the client test to verify RED**

Run:

```bash
node --test apps/desktop/src/modules/atlas.ledger/lib/__tests__/ledger-data-client.test.js
```

Expected: FAIL because `ledger-data-client.js` does not exist yet.

- [ ] **Step 3: Implement the client**

Create `apps/desktop/src/modules/atlas.ledger/lib/ledger-data-client.js` with this shape:

```js
import { getApiUrl } from '../../../../lib/runtimeConfig.js'

export function createLedgerDataClient({ apiBaseUrl = getApiUrl(), fetchImpl } = {}) {
  const request = fetchImpl ?? ((...args) => globalThis.fetch(...args))

  return {
    listAccounts({ token, ledgerStore }) { ... },
    getAccount({ accountId, token, ledgerStore }) { ... },
    listTransactionTypes({ token, ledgerStore }) { ... },
    listCategories({ token, ledgerStore }) { ... },
    listTransactions({ accountId, token, ledgerStore, dateFrom, dateTo, pageSize = 500 }) { ... },
    getAccountSummary({ accountId, token, ledgerStore, dateFrom, dateTo }) { ... },
    getRunningBalance({ accountId, ledgerStore, upToDate }) { ... },
    getMonthlyCashFlow({ accountId, ledgerStore, year }) { ... },
    getCategoryBreakdown({ accountId, ledgerStore, dateFrom, dateTo }) { ... },
  }
}
```

Implementation notes:

- If `ledgerStore` exists, return local data immediately.
- If there is no `ledgerStore`, use the current API route.
- Keep the JSON payloads shaped exactly like the current screens expect.
- Use `getApiUrl()` instead of repeating `import.meta.env.VITE_ATLAS_API_URL`.

- [ ] **Step 4: Re-run the client test until green**

Run:

```bash
node --test apps/desktop/src/modules/atlas.ledger/lib/__tests__/ledger-data-client.test.js
```

Expected: PASS.

---

## Task 3: Add ledger hooks and migrate the read paths

**Files:**
- Create: `apps/desktop/src/modules/atlas.ledger/hooks/use-ledger-queries.js`
- Modify: `apps/desktop/src/modules/atlas.ledger/screens/AccountsScreen.jsx`
- Modify: `apps/desktop/src/modules/atlas.ledger/screens/AccountScreen.jsx`
- Modify: `apps/desktop/src/modules/atlas.ledger/screens/SpreadsheetRegister.jsx`
- Modify: `apps/desktop/src/modules/atlas.ledger/screens/AccountSummary.jsx`

- [ ] **Step 1: Create the shared ledger hooks**

Create `apps/desktop/src/modules/atlas.ledger/hooks/use-ledger-queries.js`:

```js
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOfflineContext, useOfflineStatus } from '@atlas/offline'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { createLedgerDataClient } from '../lib/ledger-data-client.js'

export function useLedgerSQLite() { ... }
export function useAccountList() { ... }
export function useAccount(accountId) { ... }
export function useLedgerTypes() { ... }
export function useLedgerCategories() { ... }
export function useAccountTransactions(accountId, { dateFrom, dateTo } = {}) { ... }
export function useRunningBalance(accountId, upToDate) { ... }
export function useMonthlyCashFlow(accountId, year) { ... }
export function useCategoryBreakdown(accountId, { dateFrom, dateTo } = {}) { ... }
export function useAccountSummary(accountId, { dateFrom, dateTo } = {}) { ... }
```

Requirements:

- query keys stay stable and explicit
- hooks enable when `(token || ledgerStore)` exists
- `useLedgerSQLite()` exposes `{ ledgerStore, isLedgerOfflineReady, isOnline, lastSyncAt }`

- [ ] **Step 2: Migrate `AccountsScreen`**

Replace the direct fetches for account list with `useAccountList()`.

Offline behavior:

```js
const { isOnline } = useOfflineStatus()
const { ledgerStore } = useLedgerSQLite()
const offlineLedgerView = !isOnline && !!ledgerStore
const effectiveTab = offlineLedgerView ? 'offline' : activeTab
```

Requirements:

- use the local account list when offline
- show a short note that collaboration/group breakdown returns when reconnecting
- keep create account/group actions online-only

- [ ] **Step 3: Migrate `AccountScreen`**

Replace direct fetches with:

```js
const { data: accountData, isLoading: accountLoading } = useAccount(accountId)
const { data: typesData } = useLedgerTypes()
const { data: categoriesData } = useLedgerCategories()
```

Requirements:

- `Registro` and `Resumen` still work offline
- `Acceso` remains online-only
- export/import buttons disable while offline

- [ ] **Step 4: Migrate `SpreadsheetRegister`**

Replace the read query with `useAccountTransactions(accountId, { dateFrom, dateTo })`.

Also add:

```js
const { isOnline } = useOfflineStatus()
const canEdit = isOnline && !!token
```

Requirements:

- disable add/edit/delete controls when `canEdit === false`
- show a one-line notice explaining that movements are read-only offline
- keep mutations unchanged for the online path

- [ ] **Step 5: Migrate `AccountSummary`**

Replace the direct fetch query with:

```js
const { data, isLoading, isError } = useAccountSummary(accountId, {
  dateFrom,
  dateTo,
})
```

The rendering code should stay almost identical because the hook preserves the current API payload.

---

## Task 4: Verify and update status docs

**Files:**
- Modify: `docs/superpowers/specs/2026-06-07-offline-phase5-tauri-sqlite.md`
- Modify: `docs/TASKS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run focused tests for RED/GREEN evidence**

Run:

```bash
node --test packages/offline/src/__tests__/ledger-sqlite.test.js apps/desktop/src/modules/atlas.ledger/lib/__tests__/ledger-data-client.test.js
```

Expected: PASS.

- [ ] **Step 2: Run syntax checks on the modified frontend files**

Run:

```bash
node --check packages/offline/src/ledger-sqlite.js
node --check apps/desktop/src/modules/atlas.ledger/lib/ledger-data-client.js
```

Expected: both commands exit successfully.

- [ ] **Step 3: Run a desktop production build sanity check**

Run:

```bash
pnpm.cmd --filter @atlas/desktop build:web
```

Expected: PASS.

- [ ] **Step 4: Update docs only after verification**

Update:

- `docs/superpowers/specs/2026-06-07-offline-phase5-tauri-sqlite.md` to mark 5C implemented
- `docs/TASKS.md` to record offline phase completion state
- `CLAUDE.md` to note that `atlas.ledger` is Tier 2.5 in Tauri builds

---

## Self-Review

### Spec coverage

- SQLite-backed account list/detail/history/summary: Tasks 1–3
- SQLite-first hook layer: Tasks 2–3
- Online-only writes with explicit UI behavior: Task 3
- Doc/status updates: Task 4

### Placeholder scan

No TBDs, no “similar to previous task”, and every verification command is explicit.

### Type consistency

- Store method names match the hook/client names (`getAccountList`, `getAccount`, `getAccountSummary`)
- Screen payload shapes stay aligned with the current snake_case API responses
- Query params consistently use `dateFrom` / `dateTo` at the hook boundary and `start` / `end` inside the SQLite store

# Offline Phase 5C — Ledger SQLite Read Hooks

## 1. Context

Phase 5A added `atlas.ledger` to `/sync/pull`.  
Phase 5B added the Tauri-only SQLite cache and dual-pull orchestration in `@atlas/offline`.

What still blocks the phase from being complete is the frontend: the ledger screens still call the live API directly for account lists, account detail, transactions, and summary charts. That means the cache exists but is not yet used by the UI.

Phase 5C closes that gap.

---

## 2. Goal

Make `atlas.ledger` read from local SQLite when the Tauri ledger cache is available **and the app is offline**, while preserving the current online API as the source of truth and keeping ledger writes online-only.

---

## 3. Required outcomes

1. `AccountsScreen` can show locally cached accounts offline.
2. `AccountScreen` header can load from SQLite offline.
3. `SpreadsheetRegister` can show transaction history from SQLite offline.
4. `AccountSummary` can render KPI cards, balance series, and category breakdown from SQLite offline.
5. Ledger write actions remain online-only and the UI makes that limitation explicit.
6. A small hook layer exists so the rest of `atlas.ledger` stops talking to `fetch()` directly for these read paths.

---

## 4. Non-goals

- Offline creation, update, import, or deletion of ledger transactions.
- Offline support for ledger groups, memberships, invites, exports, or imports.
- Replacing existing server endpoints.
- Reworking the current ledger screen layout or design system.

---

## 5. Design decisions

### 5.1 Add a thin ledger data client

Create a small client/helper layer in the desktop app that decides:

- use SQLite when `ledgerStoreRef.current` exists and the app is offline
- otherwise fall back to the existing HTTP endpoint

This keeps screen changes focused and avoids duplicating `if (ledgerStore)` logic across every component.

### 5.2 Add explicit ledger hooks

Create ledger hooks for:

- `useLedgerSQLite`
- `useAccountList`
- `useAccount`
- `useAccountTransactions`
- `useLedgerTypes`
- `useLedgerCategories`
- `useRunningBalance`
- `useMonthlyCashFlow`
- `useCategoryBreakdown`
- `useAccountSummary`

The first six are used immediately by the existing screens. The reporting hooks are also exported so Phase 5C leaves a stable API for future ledger charts/widgets.

### 5.3 Keep API response shapes stable

The new SQLite-backed methods should return the same field names the current screens already expect:

- accounts keep snake_case fields like `owner_id`, `group_id`, `current_balance`
- transactions keep `consecutive`, `saldo_actual`, `tipo_code`, `tipo_name`, `category_name`, `category_color`
- summary keeps `{ kpis, balance_series, by_category }`

This minimizes UI churn and reduces regression risk.

### 5.4 Expand `LedgerSQLiteStore` instead of adding JS-only reporting math

The local SQL store should own the local reporting queries. Phase 5C therefore extends `LedgerSQLiteStore` with:

- `getAccount(accountId)`
- `getTransactionTypes()`
- `getCategories()`
- richer `getAccountList()`
- richer `queryTransactions()`
- `getAccountSummary(accountId, { start, end })`

This keeps reporting logic in one place and matches the original reason for choosing SQLite.

### 5.5 Honest offline UX

When SQLite is serving local ledger data and the app is offline:

- account browsing stays available
- transaction/history charts stay available
- create/edit/delete/import/export/invite/group-management actions remain disabled or online-only
- the user sees a small explanatory message instead of silent failures

---

## 6. File changes

### New files

- `docs/superpowers/specs/2026-06-07-offline-phase5c-ledger-hooks.md`
- `docs/superpowers/plans/2026-06-07-offline-phase5c-ledger-hooks.md`
- `apps/desktop/src/modules/atlas.ledger/lib/ledger-data-client.js`
- `apps/desktop/src/modules/atlas.ledger/lib/__tests__/ledger-data-client.test.js`
- `apps/desktop/src/modules/atlas.ledger/hooks/use-ledger-queries.js`

### Modified files

- `packages/offline/src/ledger-sqlite.js`
- `packages/offline/src/__tests__/ledger-sqlite.test.js`
- `apps/desktop/src/modules/atlas.ledger/screens/AccountsScreen.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/AccountScreen.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/SpreadsheetRegister.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/AccountSummary.jsx`
- `docs/superpowers/specs/2026-06-07-offline-phase5-tauri-sqlite.md`
- `docs/TASKS.md`
- `CLAUDE.md`

---

## 7. Data contract requirements

### 7.1 `getAccountList()`

Must return account rows with:

- `id`
- `name`
- `bank`
- `account_number`
- `currency`
- `opening_balance`
- `owner_id`
- `group_id`
- `current_balance`
- `enabled`
- `created_at`
- `updated_at`

### 7.2 `getAccount(accountId)`

Must return the same account shape as the API detail route, including `current_balance`.

### 7.3 `queryTransactions(accountId, { start, end, limit, offset })`

Must return rows that match the spreadsheet expectations:

- transaction fields already rendered in the grid
- joined type/category labels
- `consecutive`
- `saldo_actual`

`saldo_actual` must be computed in SQL so it stays correct for large ledgers.

### 7.4 `getAccountSummary(accountId, { start, end })`

Must return:

```js
{
  kpis: {
    opening_balance,
    current_balance,
    total_deposito,
    total_retiro,
    net,
  },
  balance_series: [{ fecha, balance }],
  by_category: [{ category_name, color, deposito, retiro }],
}
```

The goal is parity with the current API summary route so the existing chart UI can stay intact.

---

## 8. Screen behavior requirements

### 8.1 `AccountsScreen`

- Uses `useAccountList()` for the primary list.
- When offline with SQLite available, shows a local “Disponibles offline” view instead of the online collaboration/group split.
- New account and new group actions remain online-only.

### 8.2 `AccountScreen`

- Uses hooks for account detail, types, and categories.
- Keeps access management online-only.
- Allows the `Registro` and `Resumen` tabs to work offline when SQLite is ready.

### 8.3 `SpreadsheetRegister`

- Reads rows via `useAccountTransactions()`.
- Keeps mutations online-only.
- Disables add/edit/delete interactions while offline and explains why.

### 8.4 `AccountSummary`

- Uses `useAccountSummary()` so charts and KPIs can come from SQLite or API through one stable interface.

---

## 9. Testing requirements

1. Extend `ledger-sqlite.test.js` to cover the new store methods and the richer summary shape.
2. Add a new desktop-side unit test for the SQLite-first/fallback client behavior.
3. Re-run the focused offline and desktop tests after implementation.
4. Update status docs only after verification succeeds.

---

## 10. Done definition

Phase 5C is complete only when all of the following are true:

- Tauri + cached ledger data allows account list/detail/history/summary browsing offline
- ledger writes remain online-only in UI behavior
- the new hook/client layer replaces direct read-path fetches in the affected ledger screens
- tests covering store and client behavior pass
- Phase 5 docs/status are updated to reflect 5A/5B/5C completion

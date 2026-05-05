# Phase 8 - Finance Module Implementation Plan

Date: 2026-05-04

## Delivery strategy

Phase 8 is implemented in three execution blocks:

1. **8.1 Accounting core**
2. **8.2 Full multi-currency**
3. **8.3 Financial analytics dashboard**

Each block closes only with explicit verification evidence.

## Task 0 - Documentation coherence baseline

Files:
- `docs/TASKS.md`
- `docs/00_project_status.md`
- `docs/09_next_steps.md`
- `AGENTS.md`
- `CLAUDE.md`

Changes:
- Align current project status with completed phases through 7.1.1.
- Add checklist completion policy: mark done only with explicit verification evidence and date.
- Register Phase 8 as subphased roadmap (8.1/8.2/8.3).

Validation:
- All five files reference the same phase status and next-cycle direction.

## Task 1 - Prisma model migration for Finance core

Files:
- `prisma/schema.prisma`
- `prisma/migrations/*` (new migration)

Changes:
- Evolve finance data model to company-scoped ledger:
  - company-scoped accounts
  - journal entry header
  - journal lines
  - historical FX rates
- Keep soft-disable semantics on business rows.
- Preserve compatibility with existing Prisma conventions and indexes.

Validation:
- `pnpm.cmd db:generate`
- `pnpm.cmd db:migrate`
- Prisma schema compiles and migration applies cleanly over tunnel.

## Task 2 - Finance validators and API contracts

Files:
- `packages/validators/src/index.js`
- `apps/api/src/index.js`
- `apps/api/src/services/finance-service.js` (new)

Changes:
- Add finance schemas for:
  - account create/update
  - journal entry create/update with line arrays
  - FX rate create/update
  - dashboard query filters
- Add authenticated `/finance/*` routes.
- Keep route handlers thin; delegate domain rules to `finance-service`.
- Enforce company scope and permission gating (`finance.read/create/update/delete`).

Validation:
- `node --check packages/validators/src/index.js`
- `node --check apps/api/src/services/finance-service.js`
- `node --check apps/api/src/index.js`

## Task 3 - Double-entry and balance engine (8.1)

Files:
- `apps/api/src/services/finance-service.js`

Changes:
- Implement account CRUD.
- Implement journal entry CRUD with strict balancing validation.
- Implement base balance computation:
  - per account
  - consolidated totals for active company
- Add deterministic decimal handling for debit/credit arithmetic.

Validation:
- Unbalanced payload returns `400`.
- Cross-company access blocked.
- Balance results match manual calculation fixtures.

## Task 4 - SDK finance domain

Files:
- `packages/sdk/src/index.js`

Changes:
- Add `atlas.finance.*` methods for accounts, entries, FX rates, and dashboard.
- Follow existing request/error conventions and auth header helpers.

Validation:
- `node --check packages/sdk/src/index.js`
- Desktop imports finance domain without runtime errors.

## Task 5 - Desktop Finance module shell and navigation

Files:
- `apps/desktop/src/app/ModuleOutlet.jsx`
- `apps/desktop/src/modules/atlas.finance/screens/*` (new)

Changes:
- Add route mapping for:
  - dashboard
  - accounts
  - entries
  - fx rates
- Build baseline screens with glassic-consistent composition.
- Reuse existing `@atlas/ui` components and module-shell patterns.

Validation:
- Finance routes open correctly when module is available.
- Disabled/uninstalled lifecycle guard behavior remains intact.

## Task 6 - Accounts UI and journal capture UI (8.1)

Files:
- `apps/desktop/src/modules/atlas.finance/screens/FinanceAccountsScreen.jsx` (new)
- `apps/desktop/src/modules/atlas.finance/screens/FinanceEntriesScreen.jsx` (new)

Changes:
- Accounts CRUD table/form using `DynamicTable` + `DynamicForm`.
- Journal entries list + detail/edit flows.
- Guided capture flow (income, expense, transfer) that maps to double-entry payloads.
- Advanced editor for manual line entry with client-side balance preview.

Validation:
- CRUD flows succeed through SDK/API.
- UI blocks submit when lines are unbalanced.

## Task 7 - Multi-currency engine and FX management UI (8.2)

Files:
- `apps/api/src/services/finance-service.js`
- `apps/desktop/src/modules/atlas.finance/screens/FinanceFxScreen.jsx` (new)

Changes:
- Implement historical FX CRUD by date/currency pair.
- Resolve conversion using historical rates tied to transaction date.
- Persist original currency values and converted base amounts.
- Expose clear errors for missing required rates.

Validation:
- FX CRUD works by company scope.
- Converted totals are reproducible for selected dates/rates.
- Missing rate scenario returns explicit Spanish error.

## Task 8 - Dashboard analytics (8.3)

Files:
- `apps/api/src/services/finance-service.js`
- `apps/desktop/src/modules/atlas.finance/screens/FinanceDashboardScreen.jsx` (new)

Changes:
- Implement `/finance/dashboard` aggregations:
  - consolidated balance
  - balances by account
  - income/expense windows
  - trend/variance summaries
- Render operational and analytical widgets in glassic style.

Validation:
- Dashboard values match fixture computations.
- Widgets react to date-window changes without regressions.

## Task 9 - Optional contacts linkage

Files:
- `apps/api/src/services/finance-service.js`
- `apps/desktop/src/modules/atlas.finance/screens/FinanceEntriesScreen.jsx`

Changes:
- Add optional `contactId` linkage on journal lines/entries.
- Use `atlas.contacts.picker` only when contacts module is installed and available.
- Keep workflows functional without contacts dependency.

Validation:
- Entry creation works with and without contact relation.
- Contacts unavailable scenario degrades gracefully.

## Task 10 - Verification and docs closure

Files:
- `docs/TASKS.md`
- `docs/00_project_status.md`
- `docs/09_next_steps.md`

Commands:
- `node --check apps/api/src/services/finance-service.js`
- `node --check apps/api/src/index.js`
- `node --check packages/sdk/src/index.js`
- `pnpm.cmd --filter @atlas/desktop build:web`

Smoke checklist:
1. Accounts CRUD.
2. Journal entry CRUD with balancing guard.
3. Historical FX CRUD and conversion traceability.
4. Dashboard widgets and trends.
5. Contacts optional relation behavior.
6. Module lifecycle/auth regressions.

Closure rule:
- Mark each subphase complete only after evidence is recorded with date in docs.

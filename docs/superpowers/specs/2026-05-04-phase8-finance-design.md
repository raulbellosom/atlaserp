# Phase 8 - Finance Module Design

Date: 2026-05-04

## Goal

Implement Finance as a production-ready module in three subphases:

1. **Phase 8.1**: accounting core with company-scoped double-entry ledger.
2. **Phase 8.2**: full multi-currency with manual historical FX rates.
3. **Phase 8.3**: financial analytics dashboard with operational and analytical widgets.

The implementation must keep Atlas architecture boundaries:
Desktop -> `@atlas/sdk` -> API -> Zod validation -> Prisma -> Supabase PostgreSQL.

## Scope

### In scope

1. Finance domain API and service layer under `apps/api`.
2. Shared Finance validators in `packages/validators`.
3. Finance SDK domain under `atlas.finance.*`.
4. Desktop Finance screens under `apps/desktop/src/modules/atlas.finance`.
5. Optional contact relation in finance transactions, only when contacts module is installed and available.
6. Glassic UI consistency using existing `@atlas/ui` components and visual tokens.

### Out of scope

1. Automatic external FX provider integration.
2. Tax authority integrations.
3. Bank statement ingestion and reconciliation automation.
4. Full statutory reporting package.

## Architecture

## Domain model strategy

Current `FinanceAccount` and `FinanceTransaction` are initial placeholders and must evolve to a company-scoped ledger model.

Target model in Phase 8:

1. **FinanceAccount** (company-scoped chart of accounts)
   - required fields: `companyId`, `code`, `name`, `type`, `currency`, `enabled`, timestamps.
2. **FinanceJournalEntry** (header/policy)
   - required fields: `companyId`, `entryNumber`, `occurredAt`, `concept`, `reference`, `status`, `metadata`, `enabled`, timestamps.
3. **FinanceJournalLine** (double-entry lines)
   - required fields: `entryId`, `accountId`, `debit`, `credit`, `currency`, `fxRate`, `baseCurrencyAmount`, `contactId?`, `metadata`.
4. **FinanceFxRate** (manual historical exchange rates)
   - required fields: `companyId`, `baseCurrency`, `quoteCurrency`, `rateDate`, `rate`, `source` (`manual`), `enabled`.

Rules:

1. Every journal entry must balance: sum(debit) == sum(credit), with decimal precision enforced in API.
2. Company scoping is mandatory on all queries/mutations.
3. Soft-disable (`enabled: false`) is used instead of hard delete for business entities.
4. Multi-currency conversion always resolves against manual historical FX by date and currency pair.

## API contracts

All responses follow Atlas conventions:

- success: `{ data: ... }`
- error: `{ error: string }`

Finance endpoints:

1. Accounts
   - `GET /finance/accounts`
   - `POST /finance/accounts`
   - `PUT /finance/accounts/:id`
   - `PATCH /finance/accounts/:id/enabled`
2. Journal entries
   - `GET /finance/entries`
   - `GET /finance/entries/:id`
   - `POST /finance/entries`
   - `PUT /finance/entries/:id`
   - `PATCH /finance/entries/:id/enabled`
3. FX rates
   - `GET /finance/fx-rates`
   - `POST /finance/fx-rates`
   - `PUT /finance/fx-rates/:id`
   - `PATCH /finance/fx-rates/:id/enabled`
4. Analytics
   - `GET /finance/dashboard`
   - query params: `from`, `to`, optional comparison window.

Authorization:

1. Auth required on all finance routes.
2. Write mutations require `finance.create`/`finance.update` permissions.
3. Read routes require `finance.read`.

## SDK contracts

Add `atlas.finance` domain in `packages/sdk/src/index.js`:

1. `listAccounts(token, params?)`
2. `createAccount(payload, token)`
3. `updateAccount(id, payload, token)`
4. `setAccountEnabled(id, enabled, token)`
5. `listEntries(token, params?)`
6. `getEntry(id, token)`
7. `createEntry(payload, token)`
8. `updateEntry(id, payload, token)`
9. `setEntryEnabled(id, enabled, token)`
10. `listFxRates(token, params?)`
11. `createFxRate(payload, token)`
12. `updateFxRate(id, payload, token)`
13. `setFxRateEnabled(id, enabled, token)`
14. `getDashboard(token, params?)`

## Desktop UX/UI

Finance routes:

1. `/app/m/atlas.finance/finance` -> dashboard.
2. `/app/m/atlas.finance/finance/accounts` -> chart of accounts.
3. `/app/m/atlas.finance/finance/entries` -> journal entries list.
4. `/app/m/atlas.finance/finance/fx` -> FX rates.

Interaction model:

1. Guided capture for common flows: income, expense, transfer.
2. Advanced editor for manual journal lines.
3. Validation errors shown in Spanish before submit.

UI constraints:

1. Reuse existing components (`PageHeader`, `DynamicTable`, `DynamicForm`, `Card`, `Badge`, `Sheet`, `Dialog`, `ConfirmDialog`).
2. Preserve glassic language from current shell (`glass`, `glass-strong`, `glass-subtle`, brand tokens).
3. No visual redesign outside module-specific content composition.

## Data flow and validation

1. Desktop builds payload using `DynamicForm`/custom editor and sends via `atlas.finance.*`.
2. API validates with finance Zod schemas in `@atlas/validators`.
3. Service layer enforces:
   - company ownership
   - permission checks
   - double-entry balancing
   - FX historical resolution
4. Prisma persists normalized rows.
5. Dashboard endpoint returns aggregated balances and trends for the active company only.

## Error handling

Required error classes:

1. Unbalanced entry -> `400` with explicit Spanish message.
2. Missing historical FX rate for required conversion -> `400`.
3. Cross-company access -> `403`/`404` per ownership policy.
4. Permission gap -> `403`.

## Testing and acceptance criteria

Minimum acceptance by subphase:

1. **8.1**:
   - account CRUD works with company scoping.
   - journal entries reject unbalanced payloads.
   - base balances per account and consolidated totals are correct.
2. **8.2**:
   - FX rates CRUD works by date/pair.
   - converted amounts follow historical rate selected by transaction date.
   - missing rate scenario is blocked with explicit error.
3. **8.3**:
   - dashboard widgets reflect live company data.
   - trend/variance values are reproducible from stored entries.

## Assumptions

1. No legacy Finance data backfill is required.
2. Multi-currency source is manual historical rates only in v1.
3. Contacts relation remains optional and conditional to installed/available contacts module.

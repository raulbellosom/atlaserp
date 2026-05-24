# atlas.ledger — Cuentas y Movimientos (Libro Auxiliar de Cuentas)

Date: 2026-05-09
Status: Proposed
Author: Claude Sonnet 4.6 (spec agent)
Spec file: docs/superpowers/specs/2026-05-09-atlas-ledger-design.md
Plan file: docs/superpowers/plans/2026-05-09-atlas-ledger.md (created after spec approval)

---

## 1. Feature title

atlas.ledger — Cuentas y Movimientos (Libro Auxiliar de Cuentas)

---

## 2. Status

Proposed

### Open questions resolved (2026-05-09)

All four open questions from the draft were decided by the spec author:

1. **Account type field**: Use the predefined list (`banco`, `caja`, `cliente`, `proveedor`, `otro`) stored as a free string in the DB. The UI renders it as a select. "Otro" catches any type not in the list.

2. **Export row cap**: No hard row limit in v1. The service uses the `exceljs` streaming workbook API to avoid loading all rows into memory. A `X-Atlas-Export-Count` response header will include the total row count. If memory issues appear in production, a cap can be added via forward migration config.

3. **Cancel reason minimum length**: 5 characters minimum, 500 maximum. Retained as-is.

4. **PDF library**: `pdfkit`. It produces exact, professional PDF output (custom tables, column alignment, headers, footers, page numbers) via a programmatic layout API. No browser or headless dependency. Output is deterministic.

---

## 3. Context

A client uses manually maintained Excel ledgers to track money movements across multiple internal accounts (bank accounts, petty cash funds, payroll accounts, client/supplier running balances). Each account has a chronological list of entries recording deposits, withdrawals, references, and a running balance column.

The client requested a module inside Atlas ERP that replicates this workflow digitally: create named accounts, record movements against them, view each account's history like a bank statement, filter by date or concept, and export filtered results to PDF or Excel for reporting and archiving.

The existing `atlas.finance` module provides double-entry accounting with journal entries, chart-of-accounts hierarchy, multi-currency FX, AR/AP subledger, and tax lines. That module is intentionally complex and does not fit the simpler auxiliary ledger use case. `atlas.ledger` is a separate, independent module.

---

## 4. Problem

Users have no structured way to track money movements per account inside Atlas ERP without adopting the full double-entry accounting system. Maintaining external Excel files is error-prone, disconnected from the ERP, and cannot be shared or exported in a controlled way.

The client needs:
1. A list of named accounts with current balances visible at a glance.
2. Per-account movement history with running balance (like a bank statement).
3. Filtering, cancellation, and export of movement records.

The problem is the absence of a lightweight, single-entry auxiliary ledger module — not a gap in the double-entry accounting module.

---

## 5. Goals

1. Users can create, edit, and soft-disable ledger accounts.
2. Users can view all accounts with their current balance in a list screen.
3. Users can open a single account and view its full movement history with running balance.
4. Users can add movements (deposits/income or withdrawals/expenses) to an account.
5. The API automatically calculates `balanceAfter` for each movement and maintains `currentBalance` on the account.
6. Users can cancel a movement (soft cancel with reason), which triggers recalculation of subsequent active movement balances.
7. Users can filter movements by date range, direction (income/expense), status, name, reference, concept, and amount range — both per-account and globally.
8. Users can export any filtered movement set to Excel (`.xlsx`).
9. Users can export any filtered movement set to PDF.
10. All data is scoped to the authenticated user's active company.
11. Cancelled movements are preserved in history with visual distinction.

---

## 6. Non-goals

1. Double-entry accounting, journal entries, or chart-of-accounts hierarchy — those belong to `atlas.finance`.
2. Tax calculation, withholding, or tax authority integration.
3. AR/AP document lifecycle (invoices, credit notes, application of payments).
4. Multi-currency or FX rate management.
5. Automatic bank statement ingestion or reconciliation.
6. Recurring/scheduled movements.
7. Budgets or budget comparison.
8. Integration with or reference to `atlas.finance` accounts or journal entries.
9. Importing movements from CSV/Excel (export only in v1).
10. Real-time balance streaming or notifications on balance thresholds.

---

## 7. User stories

- As an accountant, I want to create a ledger account named "Banco BBVA" so that I can track all movements associated with that bank account.
- As an accountant, I want to view a list of all accounts with their current balances so that I can quickly assess the financial position at a glance.
- As an accountant, I want to open a single account and see its movement history in chronological order with a running balance column so that it looks and works like a bank statement.
- As an accountant, I want to add an income movement to an account with a date, concept, reference, and amount so that incoming money is recorded correctly.
- As an accountant, I want to add an expense movement to an account with a date, concept, reference, and amount so that outgoing money is recorded correctly.
- As an accountant, I want to cancel a movement with a reason so that errors are corrected without deleting historical records.
- As an accountant, I want to filter movements by date range, type, concept, or reference so that I can find specific transactions quickly.
- As an accountant, I want to export a filtered set of movements to Excel so that I can share or archive the ledger data.
- As an accountant, I want to export a filtered set of movements to PDF so that I can print or attach a formal account statement to other documents.
- As an administrator, I want to control who can create accounts, add movements, cancel movements, and export reports via RBAC so that only authorized users can modify financial records.

---

## 8. UX requirements

### General

- All labels, placeholders, column headers, action buttons, section titles, and status values are in Spanish.
- Use existing `@atlas/ui` components: `AppShell`, `PageHeader`, `Button`, `Card`, `Input`, `Select`, `Badge`, and the `DynamicTable`-style table patterns from the Finance and Contacts modules.
- Use `SideSheet` (slide-in panel) pattern for account creation/edit and movement creation, consistent with `AccountSheet.jsx` and `DocumentSheet.jsx` in `atlas.finance`.
- Use a modal confirmation dialog for movement cancellation (requires a reason input).
- Loading states: show skeleton rows while data is fetching.
- Empty states: display a message and a primary action button when a list has no records (e.g., "Sin cuentas. Crear cuenta" for accounts list, "Sin movimientos. Agregar movimiento" for movements table).
- Error states: show an error alert with a retry button when API requests fail.

### Accounts list screen (`/ledger/accounts`)

- Table columns: Nombre, Tipo, Moneda, Saldo inicial, Saldo actual, Estado, Acciones.
- "Saldo actual" must always reflect the live value from the API.
- Disabled accounts are shown with muted styling. An "Habilitar / Deshabilitar" toggle action is available in the row actions menu.
- Click on a row (or "Ver cuenta" action) navigates to the account detail screen.
- A "Nueva cuenta" button opens the account creation sheet.

### Account detail screen (`/ledger/accounts/:id`)

- Header: account name, type badge, currency, current balance (prominent), description.
- Movements table columns: No., Fecha, Tipo, Nombre, Referencia, Concepto, Cargo, Abono, Saldo.
  - "Cargo" (expense/withdrawal) and "Abono" (income/deposit) are separate columns.
  - "Saldo" column shows `balanceAfter` for each row.
  - Cancelled movements are shown with a strikethrough style and a "Cancelado" badge.
- Filters bar above the table: Fecha inicio / Fecha fin, Tipo (Todos/Abono/Cargo), Estado (Todos/Activo/Cancelado), Nombre, Referencia, Concepto, Monto mínimo / Monto máximo.
- Filters are applied client-side only if the full dataset is small enough; otherwise they are sent as query params to the API. The API is the single source of truth for filtered results.
- "Agregar movimiento" button opens the movement creation sheet.
- Export buttons: "Exportar Excel" and "Exportar PDF" — both pass the active filters and the account ID to the respective export endpoint.
- Back navigation link returns to the accounts list.

### Global movements screen (`/ledger/movements`)

- Same filter bar as account detail but adds an "Cuenta" filter (account picker from the list of enabled accounts).
- Table columns: Cuenta, No., Fecha, Tipo, Nombre, Referencia, Concepto, Cargo, Abono, Saldo.
- Export buttons for Excel and PDF pass the active filters.

### Reports screen (`/ledger/reports`)

- A focused export screen with explicit filter controls: account (single or all), date range, direction, status.
- Two export action buttons: "Generar Excel" and "Generar PDF".
- Shows a preview summary (total abonos, total cargos, saldo de apertura del periodo, saldo final del periodo) before triggering the export.
- Summary figures are fetched from a dedicated summary endpoint with the same filter params.

### Ledger dashboard (`/ledger`)

- Cards showing: total accounts, total enabled accounts, sum of current balances (MXN only, labeled "Saldo total acumulado"), and movements recorded this month.
- Quick-access cards linking to the accounts list and movements list.
- Does not show per-account breakdown on the dashboard to keep it lightweight.

### Account sheet (create/edit)

- Fields: Nombre (required), Tipo (select: Banco, Caja, Cliente, Proveedor, Otro), Moneda (select: MXN, USD, EUR, default MXN), Saldo inicial (decimal, default 0), Descripción (optional textarea).
- On create: `currentBalance` is set equal to `initialBalance` by the API.
- On edit: only `name`, `type`, `description` are editable. `currency` and `initialBalance` are locked after movements exist (enforced by API).

### Movement sheet (add movement)

- Fields: Tipo (Abono / Cargo — required), Fecha (date picker, default today), Concepto (required text), Nombre (optional), Número (optional), Referencia (optional), Monto (required decimal > 0).
- The API calculates `balanceAfter` automatically. The UI does not predict or display it before saving.

### Cancel movement modal

- Fields: Motivo de cancelación (required textarea, min 5 chars).
- Shows the movement details (date, concept, amount, direction) for confirmation.
- On confirm: calls the cancel endpoint. On success: refreshes the movements list and account balance.

---

## 9. Routes/screens

| Route | Screen | Module | Description |
|---|---|---|---|
| `/app/m/atlas.ledger` | `LedgerScreen` (dashboard) | `atlas.ledger` | Ledger module dashboard with summary cards |
| `/app/m/atlas.ledger/accounts` | `LedgerAccounts` | `atlas.ledger` | List of all ledger accounts with current balances |
| `/app/m/atlas.ledger/accounts/:id` | `LedgerAccountDetail` | `atlas.ledger` | Single account with full movement history and filters |
| `/app/m/atlas.ledger/movements` | `LedgerMovements` | `atlas.ledger` | Global movements list with cross-account filters |
| `/app/m/atlas.ledger/reports` | `LedgerReports` | `atlas.ledger` | Summary and export screen |

The `/accounts/:id` route is reached by navigation within the module (clicking an account row) — it is not exposed as a sidebar navigation item.

---

## 10. Data model

### New model: LedgerAccount

Purpose: Represents a named account in the auxiliary ledger. Tracks initial and current balance.

| Field | Type | Constraint | Notes |
|---|---|---|---|
| `id` | String (CUID) | PK | |
| `companyId` | String | FK → Company | Required, all queries scoped to this |
| `name` | String | min 2, max 120 | Account name e.g. "Banco BBVA" |
| `type` | String | max 40 | Free-text category: "banco", "caja", "cliente", "proveedor", "otro" |
| `currency` | String | default "MXN" | ISO 4217 currency code |
| `initialBalance` | Decimal | default 0 | Starting balance when account is created |
| `currentBalance` | Decimal | default 0 | Maintained by API on every movement create/cancel |
| `description` | String? | max 500 | Optional notes |
| `createdById` | String? | FK → UserProfile nullable | Who created the account |
| `enabled` | Boolean | default true | Soft delete |
| `createdAt` | DateTime | auto | |
| `updatedAt` | DateTime | auto | |

Uniqueness: `[companyId, name]` — account names must be unique within a company.

### New model: LedgerMovement

Purpose: A single money movement (income or expense) against a ledger account. Stores the running balance after application.

| Field | Type | Constraint | Notes |
|---|---|---|---|
| `id` | String (CUID) | PK | |
| `companyId` | String | FK → Company | Required |
| `accountId` | String | FK → LedgerAccount | Required, cascade delete |
| `sequenceNumber` | Int | auto-assigned per account at creation | Immutable after creation, consecutive per account |
| `occurredAt` | DateTime | required | User-provided movement date |
| `direction` | LedgerMovementDirection | INCOME or EXPENSE | Required |
| `movementType` | String? | max 60 | Optional free-text category e.g. "transferencia" |
| `number` | String? | max 60 | Document number, invoice number, check number |
| `name` | String? | max 140 | Person or entity name (counterpart) |
| `reference` | String? | max 120 | External reference |
| `concept` | String | min 1, max 500 | Required description of the movement |
| `amount` | Decimal | > 0 | Always positive; direction determines income vs expense |
| `balanceAfter` | Decimal | calculated by API | Running balance after this movement is applied |
| `status` | LedgerMovementStatus | ACTIVE or CANCELLED | Default ACTIVE |
| `cancellationReason` | String? | max 500 | Required when status = CANCELLED |
| `cancelledAt` | DateTime? | | Timestamp of cancellation |
| `cancelledById` | String? | FK → UserProfile nullable | Who cancelled it |
| `createdById` | String? | FK → UserProfile nullable | Who created it |
| `metadata` | Json? | | Reserved for future use |
| `enabled` | Boolean | default true | Soft delete (set false only via admin, not via cancel) |
| `createdAt` | DateTime | auto | |
| `updatedAt` | DateTime | auto | |

### New enums

- `LedgerMovementDirection`: `INCOME`, `EXPENSE`
- `LedgerMovementStatus`: `ACTIVE`, `CANCELLED`

### Modified models

**Company**: Add relations to `ledgerAccounts` and `ledgerMovements` arrays.

No other existing models are modified.

---

## 11. Prisma impact

New models: `LedgerAccount`, `LedgerMovement`
New enums: `LedgerMovementDirection`, `LedgerMovementStatus`
Modified models: `Company` (add relation fields only — no schema column changes on Company)
New migration required: Yes — forward migration for new tables and enums.

Migration safety notes:
- Both tables are new. No existing data is affected.
- `LedgerAccount.currentBalance` and `LedgerMovement.balanceAfter` are `Decimal` columns, consistent with other finance Decimal usage.
- `LedgerMovement.sequenceNumber` is an `Int` — assigned by the service layer using `SELECT MAX(sequenceNumber) + 1` within a transaction, not a database sequence, to avoid cross-company contamination. Race condition is mitigated by wrapping the assignment in a Prisma transaction with a unique constraint on `[accountId, sequenceNumber]`.
- Adding nullable columns to `Company` (relations) does not require column changes — Prisma relations without `@relation` scalar fields on Company are foreign-key-free on the Company table itself.

Unique constraints required:
- `@@unique([companyId, name])` on `LedgerAccount`
- `@@unique([accountId, sequenceNumber])` on `LedgerMovement`

Indexes required:
- `@@index([companyId, enabled])` on `LedgerAccount`
- `@@index([companyId, occurredAt])` on `LedgerMovement`
- `@@index([accountId, occurredAt])` on `LedgerMovement`
- `@@index([accountId, status])` on `LedgerMovement`
- `@@index([companyId, status])` on `LedgerMovement`

---

## 12. API contract

All endpoints require authentication (JWT Bearer token). All responses follow Atlas convention: `{ data: ... }` on success, `{ error: string }` on failure.

All endpoints that read or write data enforce company scoping via `req.user.companyId` loaded by the auth middleware.

---

### GET /ledger/accounts

Auth: required
Permission: `ledger.accounts.read`
Query params: `enabled` (boolean, default true), `search` (string, partial match on name)
Response: `{ data: LedgerAccount[] }` — each account includes `currentBalance`, `currency`, `type`, `enabled`.

---

### POST /ledger/accounts

Auth: required
Permission: `ledger.accounts.create`
Body:
```json
{
  "name": "Banco BBVA",
  "type": "banco",
  "currency": "MXN",
  "initialBalance": 15000.00,
  "description": "Cuenta bancaria principal"
}
```
Response: `{ data: LedgerAccount }` — `currentBalance` is set equal to `initialBalance` by the service.
Error 409: account name already exists for this company.
Error 422: validation failure.

---

### GET /ledger/accounts/:id

Auth: required
Permission: `ledger.accounts.read`
Response: `{ data: LedgerAccount }` — includes `currentBalance`.
Error 404: account not found or belongs to another company.

---

### PUT /ledger/accounts/:id

Auth: required
Permission: `ledger.accounts.update`
Body:
```json
{
  "name": "Banco BBVA Empresarial",
  "type": "banco",
  "description": "Actualizado"
}
```
Notes: `currency` and `initialBalance` are immutable once movements exist. If the account has movements and either field is sent, the API returns 422 with message "No se puede cambiar la moneda o saldo inicial de una cuenta con movimientos."
Response: `{ data: LedgerAccount }`

---

### PATCH /ledger/accounts/:id/enabled

Auth: required
Permission: `ledger.accounts.delete`
Body: `{ "enabled": false }` or `{ "enabled": true }`
Response: `{ data: { id, enabled } }`

---

### GET /ledger/accounts/:id/movements

Auth: required
Permission: `ledger.movements.read`
Query params:
- `dateFrom` (ISO date string, optional)
- `dateTo` (ISO date string, optional)
- `direction` (INCOME | EXPENSE, optional)
- `status` (ACTIVE | CANCELLED, optional, default: all)
- `name` (string, optional, partial match)
- `reference` (string, optional, partial match)
- `concept` (string, optional, partial match)
- `amountMin` (decimal, optional)
- `amountMax` (decimal, optional)
- `page` (int, default 1)
- `pageSize` (int, default 50, max 500)
- `orderBy` (occurredAt | sequenceNumber, default occurredAt)
- `orderDir` (asc | desc, default asc)

Response:
```json
{
  "data": {
    "account": { "id", "name", "currency", "currentBalance" },
    "movements": [ LedgerMovement[] ],
    "pagination": { "page", "pageSize", "total", "totalPages" },
    "summary": {
      "totalIncome": 0,
      "totalExpense": 0,
      "openingBalance": 0,
      "closingBalance": 0
    }
  }
}
```
`openingBalance` is the `balanceAfter` of the last active movement before `dateFrom` (or `initialBalance` if none). `closingBalance` is the `balanceAfter` of the last active movement in the filtered set (or `openingBalance` if no movements in range).

---

### POST /ledger/accounts/:id/movements

Auth: required
Permission: `ledger.movements.create`
Body:
```json
{
  "occurredAt": "2026-05-09T00:00:00.000Z",
  "direction": "INCOME",
  "movementType": "transferencia",
  "number": "REF-001",
  "name": "Cliente ABC",
  "reference": "FAC-2026-001",
  "concept": "Cobro de factura enero",
  "amount": 5000.00
}
```
Service behavior:
1. Open Prisma transaction.
2. Select `currentBalance` from `LedgerAccount` with a row lock (`SELECT ... FOR UPDATE`).
3. Assign `sequenceNumber = MAX(sequenceNumber) + 1` for the account (or 1 if first movement).
4. Compute `balanceAfter = currentBalance + amount` (INCOME) or `currentBalance - amount` (EXPENSE).
5. Create `LedgerMovement` with `status: ACTIVE`.
6. Update `LedgerAccount.currentBalance = balanceAfter`.
7. Commit transaction.

Response: `{ data: LedgerMovement }` — includes calculated `balanceAfter`.
Error 404: account not found.
Error 422: amount ≤ 0, missing required fields.

---

### POST /ledger/movements/:id/cancel

Auth: required
Permission: `ledger.movements.cancel`
Body: `{ "reason": "Movimiento duplicado" }`

Service behavior:
1. Load movement, verify it belongs to the authenticated company, verify status is ACTIVE.
2. Mark movement as `CANCELLED`, set `cancellationReason`, `cancelledAt`, `cancelledById`.
3. Recalculate `balanceAfter` for all ACTIVE movements in the same account that have `occurredAt > cancelled.occurredAt OR (occurredAt == cancelled.occurredAt AND sequenceNumber > cancelled.sequenceNumber)`, ordered ASC.
4. Starting from the `balanceAfter` of the last ACTIVE movement before the cancelled one (or `initialBalance` if none), recompute each subsequent ACTIVE movement's `balanceAfter` and persist.
5. Update `LedgerAccount.currentBalance` to the `balanceAfter` of the last ACTIVE movement (or `initialBalance` if no active movements remain).
6. All steps in one Prisma transaction.

Response: `{ data: LedgerMovement }` — cancelled movement.
Error 404: movement not found.
Error 409: movement is already cancelled.
Error 422: missing or short reason.

---

### GET /ledger/movements

Auth: required
Permission: `ledger.movements.read`
Query params: same as `GET /ledger/accounts/:id/movements` plus `accountId` (optional, filter to specific account).
Response: same shape as `GET /ledger/accounts/:id/movements` but with account name and ID in each movement row, and no `account` header object.

---

### GET /ledger/summary

Auth: required
Permission: `ledger.accounts.read`
Response:
```json
{
  "data": {
    "totalAccounts": 5,
    "enabledAccounts": 4,
    "totalCurrentBalance": 42500.00,
    "balanceCurrency": "MXN",
    "movementsThisMonth": 23
  }
}
```
Note: `totalCurrentBalance` sums only MXN accounts. Accounts with other currencies are excluded from the sum but counted in `totalAccounts`. A `balanceCurrency` field confirms the currency of the sum.

---

### GET /ledger/reports/summary

Auth: required
Permission: `ledger.reports.read`
Query params: same as `/ledger/movements` (filter params, optional `accountId`).
Response:
```json
{
  "data": {
    "totalIncome": 50000.00,
    "totalExpense": 32000.00,
    "openingBalance": 10000.00,
    "closingBalance": 28000.00,
    "activeMovements": 15,
    "cancelledMovements": 2
  }
}
```

---

### GET /ledger/accounts/:id/export/excel

Auth: required
Permission: `ledger.reports.export`
Query params: same filter params as movement list endpoints.
Response: binary file download.
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="cuenta-[account-name]-[date].xlsx"`

---

### GET /ledger/accounts/:id/export/pdf

Auth: required
Permission: `ledger.reports.export`
Query params: same filter params.
Response: binary file download.
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="cuenta-[account-name]-[date].pdf"`

---

### GET /ledger/movements/export/excel

Auth: required
Permission: `ledger.reports.export`
Query params: same filter params as `/ledger/movements`.
Response: binary xlsx download.
- Content-Disposition: `attachment; filename="movimientos-[date].xlsx"`

---

### GET /ledger/movements/export/pdf

Auth: required
Permission: `ledger.reports.export`
Query params: same filter params.
Response: binary pdf download.
- Content-Disposition: `attachment; filename="movimientos-[date].pdf"`

---

## 13. SDK contract

Domain: `atlas.ledger`

```js
// Accounts
ledger.listAccounts(query, token)           // GET /ledger/accounts
ledger.createAccount(payload, token)        // POST /ledger/accounts
ledger.getAccount(id, token)               // GET /ledger/accounts/:id
ledger.updateAccount(id, payload, token)   // PUT /ledger/accounts/:id
ledger.setAccountEnabled(id, enabled, token) // PATCH /ledger/accounts/:id/enabled

// Movements
ledger.listAccountMovements(accountId, query, token)  // GET /ledger/accounts/:id/movements
ledger.createMovement(accountId, payload, token)      // POST /ledger/accounts/:id/movements
ledger.cancelMovement(movementId, reason, token)      // POST /ledger/movements/:id/cancel
ledger.listMovements(query, token)                    // GET /ledger/movements

// Dashboard/Summary
ledger.getSummary(token)                   // GET /ledger/summary
ledger.getReportSummary(query, token)      // GET /ledger/reports/summary

// Export — these return a Blob (file download)
ledger.exportAccountExcel(accountId, query, token)    // GET /ledger/accounts/:id/export/excel
ledger.exportAccountPdf(accountId, query, token)      // GET /ledger/accounts/:id/export/pdf
ledger.exportMovementsExcel(query, token)             // GET /ledger/movements/export/excel
ledger.exportMovementsPdf(query, token)               // GET /ledger/movements/export/pdf
```

Export methods must use `response.blob()` instead of `response.json()` in the SDK `request` helper. A dedicated `requestBlob(path, options)` helper should be added to the SDK or the existing `request` helper extended to support a `blob: true` option.

Query params are serialized as `URLSearchParams` from the `query` object before appending to the URL.

---

## 14. Validator contract

New schemas in `packages/validators/src/index.js`:

### `createLedgerAccountSchema`
```js
z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["banco", "caja", "cliente", "proveedor", "otro"]),
  currency: z.string().length(3).default("MXN"),
  initialBalance: z.number().min(0).default(0),
  description: z.string().trim().max(500).optional().or(z.literal(""))
})
```

### `updateLedgerAccountSchema`
```js
z.object({
  name: z.string().trim().min(2).max(120).optional(),
  type: z.enum(["banco", "caja", "cliente", "proveedor", "otro"]).optional(),
  description: z.string().trim().max(500).optional().or(z.literal(""))
})
// Note: currency and initialBalance are not in this schema (locked after movements exist)
```

### `createLedgerMovementSchema`
```js
z.object({
  occurredAt: z.string().datetime(),
  direction: z.enum(["INCOME", "EXPENSE"]),
  movementType: z.string().trim().max(60).optional().or(z.literal("")),
  number: z.string().trim().max(60).optional().or(z.literal("")),
  name: z.string().trim().max(140).optional().or(z.literal("")),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  concept: z.string().trim().min(1).max(500),
  amount: z.number().positive("El monto debe ser mayor a cero")
})
```

### `cancelLedgerMovementSchema`
```js
z.object({
  reason: z.string().trim().min(5).max(500)
})
```

### `ledgerMovementQuerySchema`
```js
z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  direction: z.enum(["INCOME", "EXPENSE"]).optional(),
  status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
  name: z.string().optional(),
  reference: z.string().optional(),
  concept: z.string().optional(),
  amountMin: z.coerce.number().min(0).optional(),
  amountMax: z.coerce.number().min(0).optional(),
  accountId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  orderBy: z.enum(["occurredAt", "sequenceNumber"]).default("occurredAt"),
  orderDir: z.enum(["asc", "desc"]).default("asc")
})
```

---

## 15. Module manifest impact

A new manifest entry must be added to `packages/maps/src/feature-modules.js` and exported in `featureModules`.

Module key: `atlas.ledger`
Dependencies: `[{ key: "atlas.core" }, { key: "atlas.identity" }]`
Core: `false`
Uninstallable: `true`
Icon: `BookOpen` (from lucide-react)
Color: `#6366f1` (indigo)
Category: `contabilidad`

Permissions (full list — see Section 18):
```js
permissions: [
  { key: "ledger.access", name: "Access Ledger" },
  { key: "ledger.accounts.read", name: "Read Ledger Accounts" },
  { key: "ledger.accounts.create", name: "Create Ledger Accounts" },
  { key: "ledger.accounts.update", name: "Update Ledger Accounts" },
  { key: "ledger.accounts.delete", name: "Delete Ledger Accounts" },
  { key: "ledger.movements.read", name: "Read Ledger Movements" },
  { key: "ledger.movements.create", name: "Create Ledger Movements" },
  { key: "ledger.movements.cancel", name: "Cancel Ledger Movements" },
  { key: "ledger.reports.read", name: "Read Ledger Reports" },
  { key: "ledger.reports.export", name: "Export Ledger Reports" }
]
```

Navigation:
```js
navigation: [
  { label: "Resumen", path: "/ledger", icon: "LayoutDashboard", layout: "main", permissionKey: "ledger.accounts.read" },
  { label: "Cuentas", path: "/ledger/accounts", icon: "Wallet", layout: "main", permissionKey: "ledger.accounts.read" },
  { label: "Movimientos", path: "/ledger/movements", icon: "ArrowRightLeft", layout: "main", permissionKey: "ledger.movements.read" },
  { label: "Reportes", path: "/ledger/reports", icon: "FileText", layout: "main", permissionKey: "ledger.reports.read" }
]
```

ACL module: `ledger.access`

ACL actions:
```js
{
  "ledger.accounts.read":    "ledger.accounts.read",
  "ledger.accounts.create":  "ledger.accounts.create",
  "ledger.accounts.update":  "ledger.accounts.update",
  "ledger.accounts.delete":  "ledger.accounts.delete",
  "ledger.accounts.enable":  "ledger.accounts.delete",
  "ledger.movements.read":   "ledger.movements.read",
  "ledger.movements.create": "ledger.movements.create",
  "ledger.movements.cancel": "ledger.movements.cancel",
  "ledger.reports.read":     "ledger.reports.read",
  "ledger.reports.export":   "ledger.reports.export"
}
```

ACL models:
```js
{
  LedgerAccount: {
    read:   "ledger.accounts.read",
    create: "ledger.accounts.create",
    update: "ledger.accounts.update",
    delete: "ledger.accounts.delete"
  },
  LedgerMovement: {
    read:   "ledger.movements.read",
    create: "ledger.movements.create",
    update: "ledger.movements.cancel",
    delete: "ledger.movements.cancel"
  }
}
```

No blueprints declared for v1 (custom React screens are used — blueprints would add no value here).

---

## 16. Navigation impact

| Label (Spanish) | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Resumen | /ledger | LayoutDashboard | main | ledger.accounts.read |
| Cuentas | /ledger/accounts | Wallet | main | ledger.accounts.read |
| Movimientos | /ledger/movements | ArrowRightLeft | main | ledger.movements.read |
| Reportes | /ledger/reports | FileText | main | ledger.reports.read |

The `/ledger/accounts/:id` route is not a navigation item — it is navigated programmatically from the accounts list.

---

## 17. Blueprint impact

N/A — No blueprints are defined for `atlas.ledger` in v1. The module uses custom React screens and components rather than DynamicForm/DynamicTable renderers.

---

## 18. RBAC/permissions

| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| `ledger.access` | Module-level runtime access check | No (module guard only) |
| `ledger.accounts.read` | `GET /ledger/accounts`, `GET /ledger/accounts/:id`, `GET /ledger/summary` | Yes — "Resumen" and "Cuentas" nav items |
| `ledger.accounts.create` | `POST /ledger/accounts` | No |
| `ledger.accounts.update` | `PUT /ledger/accounts/:id` | No |
| `ledger.accounts.delete` | `PATCH /ledger/accounts/:id/enabled` | No |
| `ledger.movements.read` | `GET /ledger/accounts/:id/movements`, `GET /ledger/movements` | Yes — "Movimientos" nav item |
| `ledger.movements.create` | `POST /ledger/accounts/:id/movements` | No |
| `ledger.movements.cancel` | `POST /ledger/movements/:id/cancel` | No |
| `ledger.reports.read` | `GET /ledger/reports/summary` | Yes — "Reportes" nav item |
| `ledger.reports.export` | `GET /ledger/accounts/:id/export/excel`, `GET /ledger/accounts/:id/export/pdf`, `GET /ledger/movements/export/excel`, `GET /ledger/movements/export/pdf` | No |

All permissions must be seeded in `prisma/seed.js` as `Permission` rows linked to the `atlas.ledger` module.

---

## 19. Multi-company behavior

- Every `LedgerAccount` has a `companyId` field. All queries filter by `req.user.companyId` loaded from the authenticated user's active membership.
- Every `LedgerMovement` has a `companyId` field. Both account-level and global movement queries include `WHERE companyId = req.user.companyId` as a non-negotiable WHERE clause in the service layer.
- The service layer never accepts `companyId` from the request body — it always derives it from the authenticated user's membership.
- Cross-company access is never intentional and is prevented by the company-scoped WHERE clause.
- Export endpoints apply the same company scoping before generating the file.
- Cancellation endpoint verifies `movement.companyId === req.user.companyId` before proceeding.

---

## 20. Files/storage impact

N/A — Export files are generated on-demand and returned as a streaming binary response. They are not stored in Supabase Storage and no `FileAsset` row is created. If the user wants to retain an export, they must save the downloaded file manually.

---

## 21. Export/import requirements

### Export decision

**Location**: Server-side (API), not client-side. Rationale: the API is the authority for filtered data and business logic. Generating exports in the frontend would require transferring potentially large datasets to the browser. Consistent with the architectural principle that business logic stays in `apps/api`.

**Delivery**: Streaming file download from the export endpoints. Not stored in Files module.

**New dependencies to add to `apps/api`**:
- `exceljs` — Excel (`.xlsx`) generation
- `pdfkit` — PDF generation

Neither library is currently installed. Both are well-maintained Node.js libraries with no browser-side requirements.

### Excel export format (`.xlsx`)

Sheet name: `Movimientos` (or `Cuenta - [account name]` for account-specific export).

Columns (in order):
| Column | Source field | Format |
|---|---|---|
| No. | `sequenceNumber` | Integer |
| Fecha | `occurredAt` | DD/MM/YYYY |
| Tipo | `direction` | "Abono" (INCOME) / "Cargo" (EXPENSE) |
| Número | `number` | Text |
| Nombre | `name` | Text |
| Referencia | `reference` | Text |
| Concepto | `concept` | Text |
| Cargo | `amount` if EXPENSE | Decimal, 2 decimal places, currency format |
| Abono | `amount` if INCOME | Decimal, 2 decimal places, currency format |
| Saldo | `balanceAfter` | Decimal, 2 decimal places, currency format |
| Estado | `status` | "Activo" / "Cancelado" |

Header row: bold, light gray fill.
Totals row at the bottom: "Total abonos", sum of income amounts; "Total cargos", sum of expense amounts.
Column widths: set sensible minimums (e.g., Concepto: 40, others 15-20).

Optional summary sheet `Resumen`:
- Empresa, Cuenta (if account-specific), Fecha de generación, Período, Saldo apertura, Total abonos, Total cargos, Saldo cierre.

### PDF export format

Generated with `pdfkit`.

Layout:
- Portrait A4, 40pt margins.
- Header section (first page only):
  - Company name (bold, 14pt)
  - "Libro Auxiliar de Cuentas" (12pt)
  - Account name (if account-specific, 12pt)
  - Period: "Del [dateFrom] al [dateTo]" (or "Todos los movimientos" if no date filter)
  - "Generado el: [timestamp]"
  - Horizontal rule
- Opening balance row: "Saldo de apertura: [amount] [currency]"
- Movement table with columns: No., Fecha, Nombre/Concepto, Referencia, Cargo, Abono, Saldo.
  - Cancelled movements: italic text with "(Cancelado)" appended to Concepto.
- Totals section at the end:
  - Total abonos: [sum]
  - Total cargos: [sum]
  - Saldo de cierre: [closingBalance]
- Footer: page numbers ("Página N de M"), timestamp.

### Import

N/A — No bulk import in v1.

---

## 22. Audit log requirements

| Action key | Trigger | Payload shape |
|---|---|---|
| `ledger.account.create` | `POST /ledger/accounts` | `after: { id, name, type, currency, initialBalance, companyId }` |
| `ledger.account.update` | `PUT /ledger/accounts/:id` | `before: { name, type, description }`, `after: { name, type, description }` |
| `ledger.account.disable` | `PATCH /ledger/accounts/:id/enabled` (enabled=false) | `after: { id, enabled: false }` |
| `ledger.account.enable` | `PATCH /ledger/accounts/:id/enabled` (enabled=true) | `after: { id, enabled: true }` |
| `ledger.movement.create` | `POST /ledger/accounts/:id/movements` | `after: { id, accountId, direction, amount, concept, occurredAt, balanceAfter }` |
| `ledger.movement.cancel` | `POST /ledger/movements/:id/cancel` | `before: { status: "ACTIVE", balanceAfter }`, `after: { status: "CANCELLED", cancellationReason, cancelledAt }` |

All audit log entries include `actorId` (from authenticated user), `moduleKey: "atlas.ledger"`, `entityType` (LedgerAccount or LedgerMovement), `entityId`.

---

## 23. Edge cases

1. **Cancelling a historical movement recalculates subsequent balances**: When a movement in the middle of the history is cancelled, the service must recompute `balanceAfter` for all subsequent ACTIVE movements in order. This is a O(n) operation on active movements after the cancelled one. For normal auxiliary ledger sizes (< 10,000 movements per account) this is acceptable inline.

2. **Account with no active movements after cancellation**: If all movements on an account are cancelled, `currentBalance` returns to `initialBalance`. The UI must handle this gracefully (no divide-by-zero, no NaN display).

3. **Concurrent movement creation on the same account**: Two simultaneous requests to create a movement on the same account could produce duplicate `sequenceNumber` values or incorrect `currentBalance`. Mitigation: the service wraps movement creation in a Prisma transaction and computes `sequenceNumber` as `MAX(sequenceNumber) + 1` within the locked transaction. The `@@unique([accountId, sequenceNumber])` constraint on `LedgerMovement` provides a database-level safeguard.

4. **Editing `currency` or `initialBalance` after movements exist**: The API must reject these changes. The service checks `_count: { movements: { gt: 0 } }` before allowing updates to these fields. Error message in Spanish: "No se puede cambiar la moneda o saldo inicial de una cuenta con movimientos."

5. **Disabling an account with active movements**: This is allowed — disabling an account is a soft delete that hides it from active use, but movements remain intact. Disabled accounts are excluded from the accounts list by default (`enabled=true` default filter) but movements on disabled accounts remain queryable through the global movements endpoint.

6. **Export with no matching movements**: The export must still produce a valid file with the header, summary rows (showing zeros), and a "Sin movimientos en el período seleccionado" message row. An empty file download is confusing to users.

7. **`occurredAt` set to a past date**: This is allowed — users often record movements retroactively. `sequenceNumber` is always assigned in insertion order (not by `occurredAt`), so a past-dated movement gets the next available sequence number. The UI must make this clear: "El número de secuencia refleja el orden de registro, no la fecha del movimiento."

8. **Very large export requests**: If the movement count for an export exceeds 10,000 rows, the service should still produce the file but should log a warning. No hard limit is imposed in v1. The export uses streaming writes with `exceljs` workbook streaming API to avoid loading all rows into memory.

9. **Non-MXN accounts in summary totals**: The dashboard summary only sums MXN accounts. The UI must display a note: "El saldo total acumulado incluye solo cuentas en MXN." This avoids currency mixing in the summary.

10. **Cancellation of an already-cancelled movement**: The cancel endpoint must return 409 with "El movimiento ya fue cancelado." The UI cancel action should be hidden for already-cancelled movements, but the API guard is mandatory.

---

## 24. Risks

1. **Risk**: Balance recalculation on cancel is O(n) and could be slow for accounts with thousands of movements.
   **Mitigation**: For v1, perform recalculation inline in a Prisma transaction. Add a `@@index([accountId, status, sequenceNumber])` index to make the query fast. If latency becomes a problem in a future version, consider deferring recalculation to the worker or adding a materialized snapshot.

2. **Risk**: `exceljs` and `pdfkit` are new dependencies in `apps/api`. They may add significant bundle size or introduce breaking changes.
   **Mitigation**: Both are mature, well-maintained libraries. `exceljs` has zero dependencies and is commonly used with Hono/Express. `pdfkit` is the de-facto Node.js PDF library. Pin exact versions at install time.

3. **Risk**: Concurrent movement creation race conditions (two requests hitting the balance update at the same time).
   **Mitigation**: Prisma transaction with `SELECT ... FOR UPDATE`-equivalent behavior (Prisma interactive transactions with serializable isolation or `$transaction` with row-level lock via raw query if needed). The `@@unique([accountId, sequenceNumber])` constraint provides a fallback guard.

4. **Risk**: Export endpoints could be called with no filters on a large dataset, generating very large files.
   **Mitigation**: Impose a default `pageSize` cap of 5,000 rows for exports in v1, returning a `X-Atlas-Truncated: true` header if the result was truncated. Document this limit in the spec. Future version can add pagination or background export.

5. **Risk**: The `atlas.finance` module also has entities named "accounts" and "movements" conceptually. Naming confusion in the codebase (services, SDK domains, DB tables).
   **Mitigation**: All Prisma models are prefixed `Ledger` (e.g., `LedgerAccount`, `LedgerMovement`). The SDK domain is `atlas.ledger` not `atlas.finance`. Service file is `ledger-service.js`. Module directory is `atlas.ledger`. No naming ambiguity at the code level.

6. **Risk**: The module is installed and used alongside `atlas.finance`. A user could try to reconcile or link the two, and expect integration that doesn't exist.
   **Mitigation**: Clear documentation and no cross-references between the two modules in the UI. The ledger module description explicitly states it is an auxiliary ledger, not a replacement for double-entry accounting.

---

## 25. Acceptance criteria

1. Given a user with `ledger.accounts.create`, when they POST `/ledger/accounts` with a valid payload, then a `LedgerAccount` is created with `currentBalance = initialBalance` and the response includes the new account.

2. Given a user without `ledger.accounts.create`, when they POST `/ledger/accounts`, then the API returns 403.

3. Given a user with `ledger.movements.create`, when they POST `/ledger/accounts/:id/movements` with `direction: INCOME` and `amount: 500`, and the account's `currentBalance` is 1000, then the new movement has `balanceAfter: 1500` and the account's `currentBalance` is updated to 1500.

4. Given a user with `ledger.movements.create`, when they POST with `direction: EXPENSE` and `amount: 200`, and `currentBalance` is 1500, then `balanceAfter` is 1300 and `currentBalance` is updated to 1300.

5. Given a user with `ledger.movements.create`, when they POST with `amount: 0` or a negative value, then the API returns 422.

6. Given a user with `ledger.movements.cancel`, when they POST `/ledger/movements/:id/cancel` with a valid reason, then the movement's `status` becomes CANCELLED, `currentBalance` on the account is recalculated to exclude the cancelled movement, and all subsequent active movements' `balanceAfter` values are updated accordingly.

7. Given a user attempts to cancel an already-cancelled movement, when they POST `/ledger/movements/:id/cancel`, then the API returns 409.

8. Given a user with `ledger.accounts.read`, when they GET `/ledger/accounts`, then the list includes all enabled accounts for their company with current balances, and no accounts from other companies.

9. Given a user with `ledger.movements.read`, when they GET `/ledger/accounts/:id/movements` with `dateFrom` and `dateTo`, then only movements with `occurredAt` in that range are returned, along with correct `openingBalance` and `closingBalance` in the summary.

10. Given a user with `ledger.reports.export`, when they GET `/ledger/accounts/:id/export/excel` with valid filters, then the response has `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and a downloadable `.xlsx` file containing the filtered movements.

11. Given a user with `ledger.reports.export`, when they GET `/ledger/accounts/:id/export/pdf`, then the response has `Content-Type: application/pdf` and a downloadable `.pdf` file with the account statement format described in Section 21.

12. Given a user with `ledger.accounts.update`, when they PUT `/ledger/accounts/:id` on an account that has movements, and the body includes `currency: "USD"`, then the API returns 422 with the message about locked fields.

13. Given a user with `ledger.accounts.delete`, when they PATCH `/ledger/accounts/:id/enabled` with `{ enabled: false }`, then the account is soft-disabled and excluded from the default `GET /ledger/accounts` response.

14. Given the `atlas.ledger` module is installed and the user has `ledger.access`, when the user navigates to `/app/m/atlas.ledger`, then the dashboard screen is displayed with summary cards.

15. Given the `pnpm db:seed` command is run, then all 10 ledger permission keys are present in the `Permission` table.

---

## 26. Verification plan

The following commands and checks will be run during the verification stage after implementation:

```bash
# Build checks
node --check apps/api/src/services/ledger-service.js
node --check apps/api/src/index.js
node --check packages/validators/src/index.js
node --check packages/sdk/src/index.js
pnpm --filter ./apps/desktop build:web

# Database
pnpm db:generate    # Prisma client regenerates cleanly with LedgerAccount, LedgerMovement
pnpm db:migrate     # Forward migration applies without errors
pnpm db:seed        # 10 ledger permission keys seeded

# Permission catalog check
node -e "const c = require('./apps/api/src/permission-catalog.js'); const keys = ['ledger.access','ledger.accounts.read','ledger.accounts.create','ledger.accounts.update','ledger.accounts.delete','ledger.movements.read','ledger.movements.create','ledger.movements.cancel','ledger.reports.read','ledger.reports.export']; keys.forEach(k => { if (!c[k]) throw new Error('Missing: ' + k); }); console.log('OK');"

# API smoke tests (manual, running dev server)
# 1. POST /ledger/accounts → 201, currentBalance = initialBalance
# 2. POST /ledger/accounts/:id/movements (INCOME 500) → balanceAfter = initialBalance + 500
# 3. POST /ledger/accounts/:id/movements (EXPENSE 200) → balanceAfter reduced by 200
# 4. POST /ledger/movements/:id/cancel → movement CANCELLED, balance recalculated
# 5. GET /ledger/accounts/:id/movements?dateFrom=... → filtered result with summary
# 6. GET /ledger/accounts/:id/export/excel → downloads .xlsx file
# 7. GET /ledger/accounts/:id/export/pdf → downloads .pdf file
# 8. Attempt POST /ledger/accounts without permission → 403
# 9. Attempt cancel already-cancelled movement → 409
# 10. Attempt PUT account with currency change after movements → 422

# File size check (all source files must be under 1000 lines)
wc -l apps/desktop/src/modules/atlas.ledger/screens/*.jsx apps/desktop/src/modules/atlas.ledger/components/*.jsx apps/api/src/services/ledger-service.js
```

---

## 27. Rollback plan

The feature introduces two new Prisma models (`LedgerAccount`, `LedgerMovement`) and two new enums. It does not modify any existing table columns.

To rollback:
1. Disable the `atlas.ledger` module via the module catalog UI (or directly via `PATCH /modules/atlas.ledger/disable`). This immediately hides the module from navigation and prevents endpoint access via the module-level `ledger.access` check.
2. If a database rollback is needed: create a new forward migration that drops the `LedgerMovement` table, then the `LedgerAccount` table, then the two enums. Do not edit the original migration. Migration folder example: `20260509_rollback_atlas_ledger`.
3. Remove the `ledgerMap` export from `packages/maps/src/feature-modules.js`.
4. Remove the `ledger-service.js` API service file.
5. Remove the frontend module folder `apps/desktop/src/modules/atlas.ledger/`.
6. Remove the `atlas.ledger` SDK domain methods.
7. Remove the validator schemas.

No existing tables or data are touched by the rollback since the two new tables are standalone.

The `exceljs` and `pdfkit` dependencies remain in `apps/api/package.json` but cause no harm if unused. They can be removed separately.

---

## 28. Future enhancements

1. **Recurring movements**: Schedule a movement to repeat daily/weekly/monthly, generated automatically by the worker.
2. **Multi-currency support**: Per-movement exchange rate to convert non-MXN movements into a base currency for consolidated reporting.
3. **Balance snapshots**: Periodic materialized balance snapshots to make historical reporting faster for accounts with very large movement histories.
4. **Import from Excel**: Upload a structured Excel template to bulk-import movements for account initialization.
5. **Contact linkage**: Optional relation from `LedgerMovement.contactId` to `Contact` when `atlas.contacts` is installed — populate the "Nombre" field from a contact picker.
6. **Account categories / grouping**: Organize accounts into logical groups (e.g., "Cuentas bancarias", "Cajas chicas") for better organization on the accounts list.
7. **Period closing**: Mark a date range as "closed" to prevent further edits or cancellations within that period, protecting finalized historical records.
8. **Background export for large datasets**: For movement counts exceeding 10,000, use the worker to generate the export and notify the user with a download link via the `Notification` model.
9. **Movement attachment**: Link a `FileAsset` to a movement as supporting documentation (e.g., attach a receipt or bank confirmation PDF).
10. **Dashboard global balance (multi-currency)**: Display per-currency total balances on the dashboard, not just MXN.

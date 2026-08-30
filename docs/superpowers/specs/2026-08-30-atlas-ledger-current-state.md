# atlas.ledger — Current-state reference (Libro de cuentas)

Date: 2026-08-30
Status: Descriptive (reflects shipped code, not a change proposal)
Supersedes as the module reference: `docs/superpowers/specs/2026-05-09-atlas-ledger-design.md`
(that spec described v1; the module has since diverged — see history below)

---

## 1. What the module is today

An account-centric auxiliary ledger. Each user creates named bank accounts, records
movements against them in a spreadsheet-style register, sees per-account summary charts,
and can share individual accounts or organize them into collaborative groups.

It is a **core module** (`core: true`, `uninstallable: false`), key `atlas.ledger`,
version `0.1.3`, depends only on `atlas.core`.

### History / divergence from the 2026-05-09 spec

| v1 spec | Shipped |
|---|---|
| Prisma models `LedgerAccount` / `LedgerMovement` | Atlas ORM tables `ledger_account` / `ledger_transaction` (+ `ledger_transaction_type`, `ledger_category`, `ledger_group`, `ledger_group_member`, `ledger_account_member`) |
| `direction INCOME/EXPENSE` + `sequenceNumber` + cancel-with-reason | `deposito` / `retiro` columns, soft-delete via `enabled` toggle (no cancellation reason), `consecutive` computed at read time |
| Global screens `/ledger` dashboard, `/movements`, `/reports` | None — everything is under an account or a group |
| Export only | Export **and** CSV import |
| — | Added: categories (system + personal), movement types, groups, per-account collaborators, offline SQLite read cache (Tier 2.5) |

Later specs that drove the divergence:
`2026-06-05-ledger-collaboration-groups-design.md`,
`2026-06-07-offline-phase5c-ledger-hooks.md`,
`2026-06-20-ledger-categories-user-scope-design.md`.

---

## 2. Screens & routes

| Route | Screen | Nav item |
|---|---|---|
| `/app/m/atlas.ledger/accounts` | `AccountsScreen` — tabs: Mis cuentas / Compartidas conmigo / Grupos | Cuentas |
| `/app/m/atlas.ledger/accounts/:id` | `AccountScreen` — tabs: Registro / Resumen / Acceso | (navigated) |
| `/app/m/atlas.ledger/accounts/:id/import` | `ImportWizard` — CSV only, 3 steps | (navigated) |
| `/app/m/atlas.ledger/groups` | `GroupsScreen` | Grupos |
| `/app/m/atlas.ledger/groups/:id` | `GroupScreen` — tabs: Cuentas / Miembros | (navigated) |
| `/app/m/atlas.ledger/categories` | `CategoriesScreen` — system + personal | Categorias |
| `/app/m/atlas.ledger/types` | `TypesScreen` (`AtlasCrudView`) | Tipos |
| `/app/m/atlas.ledger/memberships` | `MembershipsScreen` — leave groups / shared accounts | Mis membresias |

`Registro` uses `SpreadsheetRegister` (inline-editable grid on desktop, card list +
bottom-sheet form on mobile). It loads the most recent `200` movements and offers
"Cargar movimientos anteriores" to page further back; running balance is always the
true all-time balance for each row.

`Resumen` uses `AccountSummary` (Recharts: balance-over-time area, income/expense donut,
by-category bars). Theme-aware.

---

## 3. Data & access model

- Every row carries `company_id`; every query filters by the caller's active company.
- `ledger_account.owner_id` is `NOT NULL` (backfilled 2026-08-24). No public fallback.
- Effective access to an account = **owner** OR active `ledger_account_member` OR active
  `ledger_group_member` of the account's group. Write access additionally requires
  member `role = 'editor'` or group `role in ('editor','admin')`.
- Sharing an account or adding a group member grants access immediately
  (`status = 'active'`); there is no accept/decline step. `reject` endpoints and a
  `pending` status exist in code but are currently unused. UI copy for accounts says
  "Compartir", not "Invitar".
- `getAccount` returns `can_write` and `is_owner` booleans so the UI can gate actions
  without a second request.
- Categories: system categories (`owner_id IS NULL`) are visible to everyone; personal
  categories only to their owner. A collaborator on a shared account never sees another
  user's personal category name — `listTransactions` and the summary null it out.
- Moving an account into a group deletes its direct `ledger_account_member` rows
  (group membership becomes the single source of truth).

---

## 4. Permissions (`groupKey: "ledger"`)

| Key | Guards |
|---|---|
| `ledger.accounts.read` / `.create` / `.update` / `.delete` | account CRUD + enable toggle |
| `ledger.transactions.read` / `.create` / `.update` / `.delete` | movement CRUD (+ per-account `canRead`/`canWrite`) |
| `ledger.export` | `GET /ledger/accounts/:id/export/{xlsx,csv,pdf}` |
| `ledger.import` | import preview + commit |
| `ledger.categories.read` | list categories (needed by the register dropdown) — accepted anywhere `ledger.categories.manage` is |
| `ledger.categories.manage` | create/update/disable categories, "Categorias" nav |
| `ledger.types.read` | list types (register dropdown) — accepted anywhere `.manage` is |
| `ledger.types.manage` | type CRUD, "Tipos" nav |
| `ledger.groups.read` / `.write` | group read / create+update+delete, "Grupos" & "Mis membresias" nav |
| `ledger.members.write` | add/remove account & group members (service also checks owner / group-admin) |

Admin roles (`atlas.admin`, `system.admin`) receive every permission via seed.

---

## 5. Reports / export

Server-side generation (`apps/api/src/routes/ledger/export-service.js`), streamed as a
file download, never persisted.

- **PDF** (A4 landscape): branded header + footer via
  `apps/api/src/services/pdf-branding-service.js` — company name, logo (from
  `BrandingConfig.logoFileId`), RFC and address come from the `company` /
  `branding_config` rows. "Hecho con Atlas ERP" appears only as a discreet footer
  watermark. Handles the empty-period case with a placeholder row.
- **XLSX**: `workbook.creator` = company name; a `Resumen` sheet lists Empresa, RFC,
  Cuenta, Banco, Moneda, Periodo, Generado, totals, saldo final.
- **CSV**: raw rows, UTF-8 BOM.

Import: CSV only (client parses, server re-validates with `validateImportRows`, commit
runs inside a single `prisma.$transaction` — all-or-nothing).

---

## 6. Offline (Tier 2.5)

In Tauri builds, when offline, the account list, account detail, register and summary
read from the local SQLite cache. All writes, sharing, groups, import and export are
online-only and the UI says so.

---

## 7. Known gaps / not done

- No accept/decline flow for shares and group invites (immediate-grant only).
- Import is CSV-only (no XLSX upload endpoint).
- No UI to view or restore soft-deleted movements / disabled personal categories.
- `moveAccountToGroup` / `moveAccountFromGroup` in `collaboration-service.js` are kept
  for unit tests but no route calls them — `PATCH /ledger/accounts/:id/group` is served
  by `accounts-routes.js` (`setAccountGroup`).

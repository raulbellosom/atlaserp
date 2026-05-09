# atlas.ledger — Cuentas y Movimientos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the atlas.ledger module — a simple auxiliary account ledger with movements, running balance, PDF/Excel export, and RBAC.

**Spec:** docs/superpowers/specs/2026-05-09-atlas-ledger-design.md

**Architecture:** Two new Prisma models (LedgerAccount, LedgerMovement), a new API service split into ledger-service.js (CRUD + balance) and ledger-export-service.js (PDF/Excel), routes mounted via apps/api/src/routes/ledger.js, a new SDK domain, and 5 frontend screens under apps/desktop/src/modules/atlas.ledger/.

**Tech Stack:** Prisma 6, Hono, Zod, React + TanStack Query, pdfkit (PDF), exceljs (Excel)

---

## File Structure Map

### New files
- `prisma/migrations/20260509000000_atlas_ledger/migration.sql`
- `apps/api/src/services/ledger-service.js`
- `apps/api/src/services/ledger-export-service.js`
- `apps/api/src/routes/ledger.js`
- `apps/desktop/src/modules/atlas.ledger/screens/LedgerScreen.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/LedgerAccounts.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/LedgerAccountDetail.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/LedgerMovements.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/LedgerReports.jsx`
- `apps/desktop/src/modules/atlas.ledger/components/AccountSheet.jsx`
- `apps/desktop/src/modules/atlas.ledger/components/MovementSheet.jsx`
- `apps/desktop/src/modules/atlas.ledger/components/MovementCancelModal.jsx`
- `apps/desktop/src/modules/atlas.ledger/components/LedgerFiltersBar.jsx`

### Modified files
- `prisma/schema.prisma` — add enums + models
- `packages/validators/src/index.js` — add 5 ledger schemas
- `packages/maps/src/feature-modules.js` — add ledgerMap
- `apps/api/src/permission-catalog.js` — add ledger group + entries
- `apps/api/src/index.js` — import and mount /ledger router
- `packages/sdk/src/index.js` — add ledger domain + requestBlob helper
- `apps/desktop/src/app/ModuleOutlet.jsx` — add atlas.ledger screen mappings
- `docs/superpowers/README.md` — add plan link

---

## Tasks

### Task 1: Prisma schema
- [ ] Add `LedgerMovementDirection` and `LedgerMovementStatus` enums to schema.prisma
- [ ] Add `LedgerAccount` model
- [ ] Add `LedgerMovement` model
- [ ] Add relations to Company

### Task 2: DB migration
- [ ] `pnpm db:generate`
- [ ] `pnpm db:migrate`

### Task 3: Validators
- [ ] Add createLedgerAccountSchema, updateLedgerAccountSchema, createLedgerMovementSchema, cancelLedgerMovementSchema, ledgerMovementQuerySchema to packages/validators/src/index.js

### Task 4: Permission catalog
- [ ] Add "ledger" to GROUPS and MODULE_LABELS
- [ ] Add "accounts", "movements", "reports" to FEATURE_LABELS
- [ ] Add "cancel", "export" to ACTION_LABELS
- [ ] Add all 10 ledger permission entries to PERMISSION_CATALOG

### Task 5: Module manifest
- [ ] Add ledgerMap to feature-modules.js and export in featureModules array

### Task 6: Ledger service (CRUD)
- [ ] Create ledger-service.js with listAccounts, createAccount, getAccount, updateAccount, setAccountEnabled, listAccountMovements, createMovement, cancelMovement, listAllMovements, getSummary, getReportSummary

### Task 7: Export service
- [ ] `cd apps/api && pnpm add exceljs pdfkit`
- [ ] Create ledger-export-service.js with exportAccountExcel, exportAccountPdf, exportMovementsExcel, exportMovementsPdf

### Task 8: API routes
- [ ] Create apps/api/src/routes/ledger.js with all 14 ledger endpoints
- [ ] Import and mount in index.js: `app.route('/ledger', ledgerRouter)`

### Task 9: SDK
- [ ] Add requestBlob helper to SDK
- [ ] Add ledger domain with all 14 methods

### Task 10: Seed
- [ ] `pnpm db:seed`

### Task 11: Frontend components
- [ ] AccountSheet.jsx
- [ ] MovementSheet.jsx
- [ ] MovementCancelModal.jsx
- [ ] LedgerFiltersBar.jsx

### Task 12: Frontend screens
- [ ] LedgerScreen.jsx (orchestrator + dashboard)
- [ ] LedgerAccounts.jsx
- [ ] LedgerAccountDetail.jsx
- [ ] LedgerMovements.jsx
- [ ] LedgerReports.jsx

### Task 13: ModuleOutlet
- [ ] Add all atlas.ledger screen mappings including /ledger/accounts/:id dynamic route

### Task 14: Build verification
- [ ] `node --check apps/api/src/services/ledger-service.js`
- [ ] `node --check apps/api/src/services/ledger-export-service.js`
- [ ] `node --check apps/api/src/routes/ledger.js`
- [ ] `node --check apps/api/src/index.js`
- [ ] `node --check packages/validators/src/index.js`
- [ ] `node --check packages/sdk/src/index.js`
- [ ] `pnpm --filter ./apps/desktop build:web`

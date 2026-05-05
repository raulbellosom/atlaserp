# Phase 8.4-A - Finance Expansion (AR/AP Core)

Date: 2026-05-04

## Goal

Deliver production-ready Accounts Receivable (AR) and Accounts Payable (AP) core workflows inside `atlas.finance`, with automatic accounting integration, while keeping complexity controlled.

This phase extends existing 8.1/8.2/8.3 finance foundations and keeps Atlas architecture boundaries:
Desktop -> `@atlas/sdk` -> API -> Zod validation -> Prisma -> Supabase PostgreSQL.

## Scope

### In scope

1. Unified AR/AP subledger model (single engine, direction-driven behavior).
2. Document types:
   - invoices
   - credit notes
   - debit notes
   - advances
   - payments
3. Open-balance lifecycle per document (`OPEN`, `PARTIAL`, `PAID`, `VOID`).
4. FIFO-first application proposal with manual editable allocation before confirm.
5. Automatic accounting entries (`FinanceJournalEntry`) for issuance and application events.
6. Separate advance control accounts:
   - customer advances (liability)
   - supplier advances (asset)
7. Aging view for AR/AP buckets.
8. Full real-data UI flows (no placeholders, no fake data).

### Out of scope (deferred)

1. Line-level taxes.
2. Approval workflow (`draft -> approved`) and multi-step authorizations.
3. Mixed-currency application across different document currencies.
4. Bank statement ingestion/reconciliation automation.
5. Statutory report package.

## Functional Decisions (validated)

1. Delivery level: advanced core including advances and editable application.
2. Accounting integration: automatic posting from AR/AP events is required now.
3. Advances: dedicated accounts per direction are required.
4. Allocation strategy: FIFO default proposal + user editable adjustments.
5. Currency policy: single currency per document.
6. Tax policy: financial-control only, no detailed tax lines in this phase.
7. Approval policy: no formal approval stage in 8.4-A.

## Domain Model Strategy

Use a unified document engine under finance domain:

### `FinanceDocument`

Required fields:

1. `companyId`
2. `direction` (`AR` | `AP`)
3. `docType` (`INVOICE` | `CREDIT_NOTE` | `DEBIT_NOTE` | `ADVANCE` | `PAYMENT`)
4. `status` (`OPEN` | `PARTIAL` | `PAID` | `VOID`)
5. `contactId`
6. `currency`
7. `issueDate`
8. `dueDate` (nullable for non-due docs like some advances)
9. `reference` (nullable)
10. `notesMarkdown` (nullable)
11. `totalAmount`
12. `openAmount`
13. `enabled`
14. `metadata` (optional operational extension)

Indexes:

1. `companyId + direction + status`
2. `companyId + issueDate`
3. `companyId + dueDate`
4. `contactId`

### `FinanceDocumentApplication`

Tracks how source documents apply against target open documents.

Required fields:

1. `companyId`
2. `sourceDocumentId`
3. `targetDocumentId`
4. `appliedAmount`
5. `appliedAt`
6. `enabled`
7. `metadata`

Rules:

1. Source/target must share same `companyId`.
2. Source/target must share same `currency`.
3. `appliedAmount > 0`.
4. Source available balance and target open balance cannot be exceeded.

### `FinanceDocumentAccountingLink`

Provides traceability between subledger events and posted journal entries.

Required fields:

1. `companyId`
2. `documentId`
3. `journalEntryId`
4. `eventType` (`ISSUE` | `APPLY` | `VOID` | `ADJUST`)
5. `createdAt`

## Accounting Posting Rules

All postings are generated through finance service and persisted as standard journal entries.

1. AR invoice:
   - Dr Accounts Receivable
   - Cr Revenue (configured counterpart)
2. AP invoice:
   - Dr Expense/Purchase (configured counterpart)
   - Cr Accounts Payable
3. Customer advance receipt:
   - Dr Cash/Bank
   - Cr Customer Advances (liability)
4. Supplier advance payment:
   - Dr Supplier Advances (asset)
   - Cr Cash/Bank
5. Credit/debit notes:
   - Reverse or increment related principal balance by direction/type.
6. Applications:
   - Reclassify against AR/AP/advance balances without re-recognizing revenue/expense.

## API Contracts

All responses follow Atlas conventions:

- success: `{ data: ... }`
- error: `{ error: string }`

### Endpoints

1. `GET /finance/documents`
   - filters: `direction`, `status`, `contactId`, `from`, `to`, `dueFrom`, `dueTo`, `search`, pagination
2. `POST /finance/documents`
3. `GET /finance/documents/:id`
4. `PATCH /finance/documents/:id`
5. `PATCH /finance/documents/:id/enabled`
6. `POST /finance/documents/:id/apply-preview`
7. `POST /finance/documents/:id/apply`
8. `GET /finance/aging?direction=AR|AP&asOf=YYYY-MM-DD`
9. `GET /finance/documents/:id/journal-links`

Authorization:

1. Auth required for all endpoints.
2. Read routes require `finance.read`.
3. Mutations require `finance.create` and/or `finance.update`.
4. Company ownership enforced in service layer.

## SDK Contracts

Extend `atlas.finance` with:

1. `listDocuments(token, params)`
2. `createDocument(payload, token)`
3. `getDocument(id, token)`
4. `updateDocument(id, payload, token)`
5. `setDocumentEnabled(id, enabled, token)`
6. `previewApplication(id, payload, token)`
7. `applyDocument(id, payload, token)`
8. `getAging(token, params)`
9. `getDocumentJournalLinks(id, token)`

## Desktop UX/UI

Finance navigation extensions:

1. `/app/m/atlas.finance/finance/ar`
2. `/app/m/atlas.finance/finance/ap`
3. `/app/m/atlas.finance/finance/aging`
4. `/app/m/atlas.finance/finance/applications`

Primary workflows:

1. Document create/edit with standardized Atlas form components.
2. Apply flow:
   - open source document (payment/advance/note)
   - generate FIFO preview
   - allow editable per-target allocation
   - confirm and post accounting entry
3. Document detail:
   - totals/open amounts
   - applied lines
   - posted journal links
4. Aging page:
   - bucket totals (`0-30`, `31-60`, `61-90`, `90+`)
   - drilldown to contributing documents

Design constraints:

1. No placeholders.
2. Reuse Atlas UI custom components (`SelectField`, `CurrencyField`, `ActionMenu`, `DynamicTable`, `DynamicForm`, etc.).
3. Spanish UI copy.
4. Loading and pending states on all asynchronous actions.

## Validation and Business Rules

1. Currency consistency:
   - application only between same-currency docs in 8.4-A.
2. Balance guards:
   - no over-application.
   - no negative open balances.
3. Lifecycle guards:
   - `VOID` documents cannot receive new applications.
4. Direction compatibility:
   - AR sources only against AR targets.
   - AP sources only against AP targets.
5. Contact ownership:
   - contact must belong to active company context when required.

## Error Handling

Required explicit error scenarios (Spanish messages):

1. Invalid direction/type combination.
2. Missing required counterpart account mapping.
3. Currency mismatch between source and targets.
4. Over-application attempt.
5. Document not open/eligible.
6. Cross-company access.

## Acceptance Criteria

1. End-to-end AR/AP document lifecycle works with real data.
2. FIFO preview is generated and editable before confirm.
3. Confirmed application updates source/target `openAmount` and statuses correctly.
4. Every posting event creates a traceable `FinanceJournalEntry` link.
5. Aging totals match open balances by bucket.
6. Existing finance dashboards, account flows, entries, and FX behavior remain stable.

## Verification Plan (for implementation phase)

1. Schema/migration checks:
   - `pnpm.cmd db:generate`
   - `pnpm.cmd db:migrate`
2. Compile checks:
   - `node --check apps/api/src/services/finance-service.js`
   - `node --check apps/api/src/index.js`
   - `node --check packages/sdk/src/index.js`
3. Desktop build:
   - `pnpm.cmd --filter ./apps/desktop build:web`
4. Functional smoke:
   - AR invoice create -> payment apply -> status transition.
   - AP invoice create -> advance apply -> status transition.
   - Journal links exist for issuance and application events.
   - Aging buckets reconcile with open documents.

## Assumptions

1. Existing finance core (8.1/8.2/8.3) remains source-of-truth foundation.
2. Contacts module may be available; AR/AP documents are still valid without advanced contact enrichments.
3. No legacy data migration is required for this phase.
4. This phase prioritizes operational completeness over tax/statutory depth.

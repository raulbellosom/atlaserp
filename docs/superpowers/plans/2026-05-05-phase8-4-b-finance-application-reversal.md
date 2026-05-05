# Phase 8.4-B - Finance Application Reversal + FX Cross-Application

Date: 2026-05-05

Spec: `docs/superpowers/specs/2026-05-05-phase8-4-b-finance-application-reversal-design.md`

## Objective

Implement reversible document applications with cross-currency traceability in `atlas.finance`, preserving accounting links and company-scoped safety rules.

## Scope

1. Extend `FinanceDocumentApplication` with status + reversal metadata + FX amounts.
2. Support cross-currency apply preview/apply using historical manual FX rates.
3. Add `POST /finance/applications/:id/reverse` endpoint.
4. Expose SDK contract for reverse action and status filtering.
5. Update Finance desktop applications view with status, FX columns, and reverse action.

## Execution Steps

1. **Data model + migration**
- Add enum `FinanceApplicationStatus` (`APPLIED`, `REVERSED`).
- Add `REVERSE` to `FinanceDocumentEventType`.
- Add fields: `effectiveFxRate`, `sourceAmount`, `targetAmount`, `reversedAt`, `reversedById`, `reversalReason`, `status`.

2. **API service logic**
- Implement FX resolver by date (direct/inverse) using `FinanceFxRate`.
- Update `apply-preview` and `apply` to support mixed source/target currencies.
- Persist dual amounts (`sourceAmount` and `targetAmount`) + effective rate.
- Implement transactional reversal with balance restoration and duplicate guard (`409` on already reversed).
- Emit accounting link event `REVERSE`.

3. **Routing + validators + SDK**
- Add reverse schema in validators.
- Extend applications list query with `status`.
- Add reverse route in API index.
- Add `atlas.finance.reverseApplication(id, payload, token)` in SDK.

4. **Desktop UX (applications section)**
- Add status filter (`Todas`, `Aplicadas`, `Revertidas`).
- Show status badge + source/target amount + FX rate in history table.
- Add `Anular` action with reason capture and loading state.
- Update CSV export with status/FX/reversal metadata columns.

## Verification

1. `pnpm.cmd prisma migrate dev` (applied migration `20260505054852_phase8_4_b_application_reversal_fx`).
2. `pnpm.cmd db:generate`.
3. `node --check apps/api/src/services/finance-documents-service.js`.
4. `node --check apps/api/src/services/finance-posting-service.js`.
5. `node --check apps/api/src/index.js`.
6. `node --check packages/validators/src/index.js`.
7. `node --check packages/sdk/src/index.js`.
8. `pnpm.cmd --filter ./apps/desktop build:web`.

## Follow-up Manual QA

1. Apply same-currency document, then reverse, and confirm source/target open amounts restore exactly.
2. Apply cross-currency document with manual FX and verify source/target amount trace.
3. Attempt second reversal on same application and verify `409`.
4. Confirm journal links include `REVERSE` event.

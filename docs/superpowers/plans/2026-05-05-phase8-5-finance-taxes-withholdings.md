# Phase 8.5 - Finance Taxes and Withholdings Plan

Date: 2026-05-05

Spec: `docs/superpowers/specs/2026-05-05-phase8-5-finance-taxes-withholdings-design.md`

## Objective

Deliver a complete first iteration of taxes/withholdings in Finance, integrated into document capture and module navigation.

## Execution Steps

1. **Schema and migration**
- Add `FinanceTaxKind` enum.
- Add `FinanceTaxRate` table.
- Add `FinanceDocumentTaxLine` table.
- Wire relations from `Company` and `FinanceDocument`.
- Generate forward migration `phase8_5_finance_taxes_withholdings`.

2. **Validators + SDK**
- Add tax-rate create/enabled/list schemas.
- Extend `financeDocumentCreateSchema` with optional tax payload (`subtotalAmount`, `taxLines[]`).
- Add SDK endpoints for tax catalog.

3. **API services and routes**
- Implement tax catalog service methods in `finance-service`.
- Add routes:
  - `GET /finance/tax-rates`
  - `POST /finance/tax-rates`
  - `PATCH /finance/tax-rates/:id/enabled`
- Extend finance document creation to persist tax lines + tax summary metadata.

4. **Desktop Finance UX**
- Add `Impuestos` sidebar route and module outlet route.
- Implement taxes section in `FinanceScreen`:
  - register tax
  - list taxes
  - enable/disable action
- Extend document sheet:
  - subtotal field
  - tax selector
  - live tax summary + suggested total

5. **Verification**
- `node --check` for touched API/SDK/validator files.
- `pnpm.cmd --filter ./apps/desktop build:web`.
- Apply migration and `db:generate` when DB tunnel is reachable.

## Manual QA Checklist

1. Create 2+ tax rates (transfer + withholding).
2. Create AR document with subtotal + selected taxes and validate totals preview.
3. Create AP document with direction-specific taxes.
4. Validate tax lines persist in DB and return from document endpoints.
5. Verify tax enable/disable updates instantly in UI and prevents invalid selection.

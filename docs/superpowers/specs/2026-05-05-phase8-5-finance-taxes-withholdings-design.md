# Phase 8.5 - Finance Taxes and Withholdings Design

Date: 2026-05-05

## Goal

Add practical tax/withholding support to `atlas.finance` without overcomplicating the accounting flow:

1. Company-scoped tax catalog (transferred taxes and withholdings).
2. Tax attachment on finance documents (AR/AP).
3. Persisted tax trace lines per document for auditability.
4. Desktop taxes management and document capture UX.

## Scope

### In scope

1. New tax domain models:
- `FinanceTaxRate`
- `FinanceDocumentTaxLine`
- enum `FinanceTaxKind` (`TRANSFER`, `WITHHOLDING`)
2. Tax catalog API endpoints:
- `GET /finance/tax-rates`
- `POST /finance/tax-rates`
- `PATCH /finance/tax-rates/:id/enabled`
3. Document creation extension:
- optional `subtotalAmount`
- optional `taxLines[]` with selected `taxRateId`
- persisted tax summary in document metadata
4. Desktop finance updates:
- new sidebar route `Finanzas > Impuestos`
- tax catalog CRUD-lite UI (create + enable/disable)
- tax selection block in document modal with subtotal/summary

### Out of scope

1. Line-level taxes on journal entry rows.
2. Fiscal XML/CFDI logic.
3. Jurisdiction engines, exemptions, or automatic external tax sync.
4. Tax closing and statutory declarations.

## Data Model

### `FinanceTaxRate`

- `companyId`, `key`, `name`
- `kind`: `TRANSFER | WITHHOLDING`
- `rate` (percentage)
- `direction`: nullable `AR | AP` (null means usable in both)
- `enabled`, timestamps

### `FinanceDocumentTaxLine`

- `companyId`, `documentId`, optional `taxRateId`
- snapshot fields: `taxKey`, `taxName`, `kind`, `rate`, `baseAmount`, `taxAmount`, `currency`
- `enabled`, timestamps

## Business Rules

1. Tax rates are company-scoped and soft-disableable.
2. Document tax lines can only reference enabled rates owned by same company.
3. Direction compatibility:
- if tax has `direction`, document must match.
4. Tax amounts are persisted as snapshots to keep historical trace even if catalog changes later.
5. Document total remains explicit user-facing amount; subtotal and tax summary are complementary trace fields.

## API / SDK Contracts

### API

1. `GET /finance/tax-rates`
- filters: `kind`, `direction`, `enabled`, `q`, `limit`
2. `POST /finance/tax-rates`
- upsert by (`companyId`, `key`)
3. `PATCH /finance/tax-rates/:id/enabled`

### SDK (`@atlas/sdk`)

1. `atlas.finance.listTaxRates(token, options)`
2. `atlas.finance.createTaxRate(payload, token)`
3. `atlas.finance.setTaxRateEnabled(id, enabled, token)`

## UX Notes

1. Taxes section in Finance sidebar keeps behavior consistent with current module patterns.
2. Document modal now supports:
- subtotal capture
- tax checklist by direction
- live summary (transferred, withholdings, suggested total)
3. UI copy stays in Spanish.

## Verification Strategy

1. Syntax/build checks for API, validators, SDK, and desktop build.
2. Manual QA:
- create tax rates
- create AR/AP documents with selected taxes
- verify tax lines persisted and returned
3. DB migration apply when tunnel is active.

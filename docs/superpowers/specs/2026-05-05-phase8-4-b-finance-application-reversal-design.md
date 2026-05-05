# Phase 8.4-B - Finance Application Reversal + FX Cross-Application

Date: 2026-05-05

## Goal

Extend `atlas.finance` AR/AP operations with:

1. Safe reversal (anulacion) of document applications.
2. Cross-currency application support with explicit FX trace.
3. Stronger auditability for application lifecycle events.

This phase builds on Phase 8.4-A and keeps Atlas boundaries:
Desktop -> `@atlas/sdk` -> API -> validators -> Prisma -> Supabase PostgreSQL.

## Scope

### In scope

1. Reverse existing application rows with transactional balance restoration.
2. Store reversal reason/note and actor metadata.
3. Add FX-aware apply flows when source and target document currencies differ.
4. Persist conversion trace and effective rate on application rows.
5. Expose application timeline/history with status (`APPLIED`, `REVERSED`).
6. Desktop controls for:
   - reverse application
   - view reversal reason
   - show effective FX info per application

### Out of scope

1. External FX provider integration.
2. Partial reversal approval workflow.
3. Automatic reallocation after reversal.
4. Tax and fiscal recalculation.

## Domain Changes

## `FinanceDocumentApplication` extensions

Add fields:

1. `status` (`APPLIED` | `REVERSED`) default `APPLIED`.
2. `effectiveFxRate` (nullable decimal).
3. `sourceAmount` (nullable decimal, amount consumed in source currency).
4. `targetAmount` (nullable decimal, amount applied in target currency).
5. `reversedAt` (nullable datetime).
6. `reversedById` (nullable `UserProfile.id`).
7. `reversalReason` (nullable text).

Rules:

1. Reversed rows remain immutable (no delete).
2. Reversal must restore source/target `openAmount` atomically.
3. Reversal cannot over-restore (guard against duplicate reversal).

## FX Cross-Application Rules

1. Same-currency behavior remains unchanged.
2. For different currencies:
   - resolve historical FX using `FinanceFxRate` by apply date.
   - save both sides (`sourceAmount`, `targetAmount`) and `effectiveFxRate`.
3. Rounding policy:
   - deterministic to 2 decimals for document amounts.
   - track residual cent differences in metadata (`fxRoundingDelta`) when needed.
4. Reversal must reuse stored FX values, never recompute with newer rates.

## API Contracts

### New/updated endpoints

1. `POST /finance/applications/:id/reverse`
   - body: `{ reason?: string }`
   - effect: marks application reversed, restores balances, writes accounting link event.
2. `GET /finance/applications`
   - include `status`, `effectiveFxRate`, `sourceAmount`, `targetAmount`, reversal metadata.
3. `POST /finance/documents/:id/apply-preview`
   - allow optional `targetCurrency`/cross-currency preview shape.
4. `POST /finance/documents/:id/apply`
   - accept and persist cross-currency allocation payload.

Error contracts (Spanish):

1. `409` when application already reversed.
2. `400` when no FX rate exists for cross-currency apply date.
3. `400` when allocation totals exceed balances after conversion.

## Accounting Traceability

1. Add `REVERSE` event type in document accounting links.
2. Reversal creates trace row linking affected documents and journal entry.
3. History endpoint shows apply and reverse events in timeline order.

## Desktop UX

Applications screen additions:

1. Status badges (`Aplicada`, `Revertida`).
2. Action menu item `Anular aplicacion` (only on `APPLIED` rows).
3. Confirmation dialog requiring reason (optional but encouraged).
4. FX columns:
   - source amount
   - target amount
   - effective rate.
5. Timeline detail panel with reversal metadata.

## Validation and Safety

1. Reversal operation is single transaction:
   - lock/select application
   - verify `status=APPLIED`
   - restore open amounts
   - set status + reversal fields
   - write accounting link event.
2. Idempotency guard:
   - second reversal attempt must fail with `409`.
3. Company ownership enforcement on all routes.

## Acceptance Criteria

1. Reversing an application restores balances exactly.
2. Reversed rows are visible in history with reason and actor.
3. Cross-currency applications store FX trace and are reversible without drift.
4. Desktop reflects status and blocks invalid actions.
5. Existing 8.4-A same-currency behavior remains stable.

## Verification Plan

1. `pnpm.cmd db:generate`
2. `pnpm.cmd db:migrate`
3. `node --check apps/api/src/services/finance-documents-service.js`
4. `node --check apps/api/src/index.js`
5. `node --check packages/sdk/src/index.js`
6. `pnpm.cmd --filter ./apps/desktop build:web`
7. Manual smoke:
   - apply -> reverse -> verify open balances
   - cross-currency apply -> reverse -> verify exact restoration
   - duplicate reverse attempt -> `409`.

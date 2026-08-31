# atlas.pfm — Investment / yield wallets (Plan 2)

Date: 2026-08-31
Status: Approved (design)
Module: `atlas.pfm`
Depends on: Plan 1 (`docs/superpowers/specs/2026-08-31-pfm-credit-cards-and-balance-adjustment-design.md`) — the balance-adjustment mechanism is the drift-correction tool here.

## Problem

`atlas.pfm` has no account type for savings/investment accounts that earn a return. The user wants a wallet that models an expected annual rate and grows on its own (simulated), so the balance tracks what the account *should* be worth; when reality diverges (e.g. the fund now pays 13% instead of 15%), "Ajustar saldo" reconciles the difference.

## Decisions (from brainstorming)

- **New wallet kind `INVESTMENT`.** Counts toward net worth but not toward "disponible para gastar"; shown as its own dashboard figure ("Inversiones").
- **Simulated growth: daily, compound.** Yield per day = `balance_that_day × (expectedRate / 365)`. Compounds because already-booked yield movements are part of the balance on later days.
- **One yield movement per day**, `direction = INCOME`, flagged `isYield`. In the wallet detail list, consecutive daily yield rows in the same calendar month collapse into one expandable group row.
- **Yield counts as income** — it flows into "Ingresos del mes" / "Neto del mes" / trend like any other INCOME movement.
- **Rate is a single editable field** (`expectedRate`). Daily accrual uses whatever rate is current when the worker runs; days already booked are not retro-adjusted; "Ajustar saldo" closes any gap.
- Accrual is driven by a **worker tick** (same pattern as `runPfmRecurringTick`), idempotent via a per-wallet `lastAccruedOn` cursor.

## Data model

`prisma/schema.prisma`:

- `enum PfmWalletKind` — add `INVESTMENT`.
- `model PfmWallet` — add:
  - `expectedRate  Decimal?  @db.Decimal(6, 4)  @map("expected_rate")` — annual rate as a fraction (`0.1500` = 15%).
  - `lastAccruedOn  DateTime?  @db.Date  @map("last_accrued_on")` — cursor: yield has been booked through this date (inclusive).
- `model PfmMovement` — add:
  - `isYield  Boolean  @default(false)  @map("is_yield")`.

Migrations (two directories — Postgres cannot `ALTER TYPE ... ADD VALUE` and then use the value in the same transaction, and Prisma wraps a migration file in one txn):

1. `20260831070000_pfm_wallet_kind_investment/migration.sql`:
   `ALTER TYPE "pfm_wallet_kind" ADD VALUE IF NOT EXISTS 'INVESTMENT';`
2. `20260831070100_pfm_investment_fields/migration.sql`:
   ```sql
   ALTER TABLE "pfm_wallet" ADD COLUMN "expected_rate" DECIMAL(6,4);
   ALTER TABLE "pfm_wallet" ADD COLUMN "last_accrued_on" DATE;
   ALTER TABLE "pfm_movement" ADD COLUMN "is_yield" BOOLEAN NOT NULL DEFAULT false;
   ```

## API

### Validators — `apps/api/src/routes/pfm/validators.js`

- `createWalletSchema`: `kind` enum gains `"INVESTMENT"`; add `expectedRate: z.number().min(0).max(1).optional().nullable()`.
- `updateWalletSchema` picks up `expectedRate` through its existing `.partial()`.

### `wallets-service.js`

- `createWallet`: when `kind === "INVESTMENT"`, persist `expectedRate` (`data.expectedRate ?? null`) and set `lastAccruedOn = todayUtcDate` (accrual starts the next day — no retroactive burst). `openingBalance` is the principal, used as-is (no sign flip). For non-investment kinds, `expectedRate` / `lastAccruedOn` stay null.
- `updateWallet`: whitelist `expectedRate` and `lastAccruedOn` in the patch key list (alongside the credit fields already there). In practice only `expectedRate` is user-editable; `lastAccruedOn` is written by the accrual service.
- `normalizeWalletRow`: surface `expectedRate` (number or null) and `lastAccruedOn` (ISO date string or null).
- `getWallet`: for `kind === "INVESTMENT"`, attach `accruedThisMonth` — `SUM(amount)` of `is_yield = true`, `enabled`, `status = 'POSTED'` movements for that wallet with `occurred_on` in the current month. One extra lightweight query, mirroring how `creditCycle` is attached for credit wallets.

### `investments-service.js` — new

`apps/api/src/routes/pfm/investments-service.js` → `createInvestmentsService({ prisma })`.

`accrueYieldDue({ now = new Date(), maxBackfillDays = 60 } = {})`:

1. Load candidate wallets:
   ```sql
   SELECT id, company_id, owner_id, opening_balance, expected_rate, last_accrued_on
   FROM pfm_wallet
   WHERE kind = 'INVESTMENT' AND enabled = true
     AND expected_rate IS NOT NULL AND expected_rate > 0
     AND (last_accrued_on IS NULL OR last_accrued_on < $today::date)
   ```
   `$today` = `now` truncated to a UTC date.
2. For each wallet:
   - `startDay` = `last_accrued_on ? last_accrued_on + 1 day : today - 1 day`. Clamp so the loop covers at most `maxBackfillDays` days ending at `today - 1` (yesterday). (Yesterday is the last fully-elapsed day.)
   - Preload the wallet's `POSTED enabled` movements `{ direction, amount, occurredOn }` once.
   - Walk day `D` from `startDay` to `yesterday` inclusive:
     - `balanceOnD` = `opening_balance + Σ(signed amount)` over movements with `occurredOn <= D`, where signed = `amount × (direction === 'INCOME' ? 1 : -1)`.
     - `dailyRate = expected_rate / 365`.
     - `yieldAmt = round(balanceOnD × dailyRate, 2)`.
     - If `yieldAmt > 0`: `INSERT INTO pfm_movement` (`company_id`, `owner_id`, `wallet_id`, `category_id = NULL`, `direction = 'INCOME'`, `amount = yieldAmt`, `occurred_on = D`, `note = 'Rendimiento'`, `merchant = NULL`, `status = 'POSTED'`, `is_yield = true`). Push a synthetic `{ direction: 'INCOME', amount: yieldAmt, occurredOn: D }` into the in-memory movement list so subsequent days compound on it.
   - `UPDATE pfm_wallet SET last_accrued_on = yesterday WHERE id = ...` (even if no positive yield was booked — the cursor still advances).
3. Return `{ processed, created }` (wallets scanned, movements inserted). Errors on one wallet are caught, logged, and do not abort the batch (mirror `materializeDueRules`).

Idempotency: the `last_accrued_on` cursor guarantees each day is accrued at most once. A crash mid-wallet leaves that wallet's cursor unadvanced; the next run re-walks from `startDay` — but the day loop only inserts for days `> last_accrued_on`, so a partially-processed wallet could double-insert the days it already did before the crash. To bound that, the per-wallet update of `last_accrued_on` and the day inserts run in a single `prisma.$transaction`.

### `pfm/index.js`

Instantiate `const investments = createInvestmentsService({ prisma });` and add it to `app.pfmServices` so the worker can reach it (like `recurring`, `summary`, `budgets`).

### Worker — `apps/worker/src/index.js`

Add `runPfmYieldTick()` mirroring `runPfmRecurringTick`: calls `pfmInvestmentsService.accrueYieldDue({ now: new Date() })`, logs when `created > 0`, handles connection errors via `reconnect()`. Run once at startup, then `setInterval(runPfmYieldTick, PFM_YIELD_INTERVAL_MS)` with `PFM_YIELD_INTERVAL_MS` = 1 hour (the cursor makes it act at most once/day per wallet). Wire `pfmInvestmentsService` from wherever the worker builds `pfmRecurringService` (same module/service factory import site).

### `summary-service.js`

Replace `investments: 0` with a real aggregate. Extend the per-kind `FILTER` in the balance query:

```sql
COALESCE(SUM(bal) FILTER (WHERE kind = 'INVESTMENT'), 0) AS investments
```

and return `investments: toPlainNumber(bal.investments)`. `spendable` (CASH+DEBIT) and `creditDebt` unchanged. Yield movements are `is_yield = true` / `is_adjustment = false`, so they already count in `monthIncome` and `trend` — no other query changes.

## Frontend

### `lib/format.js`

- `WALLET_KIND_LABEL` — add `INVESTMENT: "Inversión"`.
- `formatRatePct(rate)` — `rate` is a fraction; returns e.g. `"15%"` (strip trailing `.0`), or `""` for null/NaN.
- `groupMovements(movements)` — pure. Walks the list in order; a maximal run of consecutive `isYield` movements that share the same `YYYY-MM` (from `occurredOn`) becomes one `{ type: "yield-group", key, month, total, count, items }`; every other movement becomes `{ type: "movement", item }`. A non-yield movement (or a yield movement from a different month) ends the current run.

### `WalletFormSheet.jsx`

- Schema + `EMPTY`: add `expectedRate: ""` (string in the form).
- `kind` options already come from `WALLET_KIND_LABEL` (so `"Inversión"` appears automatically).
- When `kind === "INVESTMENT"`: show a "Tasa anual esperada (%)" `TextField` (percent input) and keep "Saldo inicial" (principal). Hide the credit block. On submit for INVESTMENT send `{ ...base, openingBalance, expectedRate: pct === "" ? null : Number(pct) / 100 }`.
- Edit prefill: `expectedRate: wallet.expectedRate != null ? String(wallet.expectedRate * 100) : ""`.

### `WalletsScreen.jsx`

For `w.kind === "INVESTMENT"`: render the normal balance number plus a muted line `Rendimiento esperado: {formatRatePct(w.expectedRate)} anual` (only when `expectedRate != null`).

### `WalletDetailScreen.jsx` + `InvestmentPanel.jsx` (new)

- New `components/InvestmentPanel.jsx`: given `wallet`, shows a `Card` with the expected rate and `Rendimiento este mes: +{formatMoney(wallet.accruedThisMonth)}`. Rendered when `wallet.kind === "INVESTMENT"` (like `CreditCyclePanel` for credit).
- Movement list: pass `movements` through `groupMovements`; render `{ type: "movement" }` with `MovementRow` (unchanged) and `{ type: "yield-group" }` with a new local `YieldGroupRow` — a row showing `Rendimiento · {formatMonthLabel(month)}` + `+{formatMoney(total)}` + `{count} días`, expandable on click to a nested list of `MovementRow`s for `items`.

### `AdjustBalanceSheet.jsx`

When `wallet.kind === "INVESTMENT"`, change the note-field placeholder to `"Ajuste de rendimiento / corrección"` and the delta line prefix to make clear the difference is unbooked yield or a correction. No behavioural change (the endpoint already books an adjustment).

### Dashboard

`OverviewScreen.jsx` — the "Inversiones" `StatCard` already reads `summary.investments` (Plan 1B). No change; it now shows a real number.

## Testing (`node --test`)

- `investments-service`:
  - rate `0.365` (daily `0.001`), balance `1000`, `last_accrued_on` = 3 days before today → inserts 3 movements; day 2 accrues on `1000 + day1_yield` (compounding); `last_accrued_on` advanced to yesterday.
  - `last_accrued_on = today` → no inserts, `processed` counts the wallet, `created = 0`.
  - `expected_rate` null or `0` → wallet not selected.
  - gap of 400 days → at most `maxBackfillDays` (60) movements.
  - non-INVESTMENT wallets are never touched.
- `summary-service`: `investments` sums INVESTMENT balances (extend the ordered-`responses` stub in the existing first test to include `investments` and assert it; the current test asserts `res.investments === 0`, update it).
- `wallets-service`: `createWallet` for `INVESTMENT` persists `expectedRate` and sets `lastAccruedOn` to today's date.
- `lib/format` `groupMovements`: consecutive same-month yield rows collapse; a yield row from a different month starts a new group; a non-yield row between two yield rows breaks the group; a list with no yield rows is unchanged (all `{ type: "movement" }`).

## Migration & manifest

- Two migration dirs as above; `pnpm db:migrate` + `pnpm db:generate`.
- `atlas.pfm` manifest `0.3.0` → `0.4.0` (`apps/api/src/manifests/official/core-modules.js`).

## Out of scope

- Rate history / effective-dated rates (single mutable field only).
- Per-account compounding frequency choice (fixed: daily / 365).
- Withholding tax on yield.
- Back-dating the accrual start before wallet creation.
- Any automatic "your projected vs real diverged by X%" alert.
- Ledger-mirror interaction with investment wallets.

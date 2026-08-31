# atlas.pfm — Credit cards v2 + balance adjustment (Plan 1)

Date: 2026-08-31
Status: Approved (design)
Module: `atlas.pfm` (Finanzas personales)
Follow-up: Plan 2 — "Cuentas de rendimiento" (investment wallet kind + expected-rate accrual), depends on the adjustment mechanism defined here.

## Problem

1. **Credit-card data is not captured at creation.** `WalletFormSheet` only asks name/kind/currency/opening balance/reference. Credit limit, statement day and payment-due day are set afterwards in a separate `CreditCardSheet`. There is no "current used balance" input at all.
2. **No utilization view.** A credit wallet's `currentBalance` goes negative as it is used. The list card shows that negative number. There is no "saldo ocupado" (positive debt), no "disponible", no utilization %.
3. **No way to reconcile a balance.** When a real-world balance drifts from the movement-derived balance (bank interest, fees, a missed transaction, a yield account returning 13% instead of 15%), the only lever is editing the wallet's opening balance, which rewrites history and does not distinguish a correction from real activity.

## Decisions (from brainstorming)

- **Adjustment = delta movement.** A "Ajustar saldo" action on any wallet: the user types the real balance, the system books one movement for the difference, tagged as an adjustment. Balance stays `opening_balance + Σ(movements)`.
- **Adjustments are reconciliation lines.** They appear in the wallet's movement history and move the balance, but do NOT count as month income/expense, in category breakdowns, or in the trend chart.
- **Credit-card fields move into the create form** (shown when kind = CREDIT): credit limit, statement day, payment-due day, current used balance. The separate `CreditCardSheet` is removed; later edits happen in `WalletFormSheet`.
- **Credit card is shown as debt.** Primary number = saldo ocupado (positive). Below it: a utilization bar with fixed thresholds (green < 50 %, amber 50–80 %, red > 80 %) and "Disponible: $X · NN %".
- **Dashboard totals split** into "Disponible" (cash + debit), "Inversiones" (0 until Plan 2), "Deuda tarjetas" (Σ used across credit cards), plus a small "Patrimonio neto" line (= existing `totalBalance`).
- No new wallet kind in this plan.

## Data model

New column on `PfmMovement`:

```
isAdjustment  Boolean  @default(false)  @map("is_adjustment")
```

Additive migration only. Optional index `@@index([walletId, isAdjustment])` is out of scope (low row counts).

An adjustment movement:

| field | value |
|---|---|
| `isAdjustment` | `true` |
| `direction` | `INCOME` if delta > 0, `EXPENSE` if delta < 0 |
| `amount` | `abs(delta)` (positive `Decimal`) |
| `categoryId` | `null` |
| `status` | `POSTED` |
| `occurredOn` | provided date, else today (UTC) |
| `note` | optional user text |
| `merchant` | `null` |

Credit-card wallet fields (`creditLimit`, `statementDay`, `paymentDueDay`) already exist on `PfmWallet` — no schema change. "Current used balance" at creation is stored as `openingBalance = -(openingUsed ?? 0)`.

## API

### Wallets — `apps/api/src/routes/pfm/wallets-service.js`, `validators.js`, `wallets-routes.js`

- `createWalletSchema` gains optional `creditLimit` (positive, nullable), `statementDay` (int 1–31, nullable), `paymentDueDay` (int 1–31, nullable), `openingUsed` (number ≥ 0, nullable). These reuse the shapes currently in `creditCardSchema`.
- `createWallet` service: when `data.kind === "CREDIT"`, persist `creditLimit`/`statementDay`/`paymentDueDay` and set `openingBalance = -(data.openingUsed ?? 0)`; ignore any `openingBalance` in the payload. For non-credit kinds, behaviour is unchanged and the credit fields are ignored.
- `updateWalletSchema` (currently `createWalletSchema.partial()` minus `ledgerAccountId`): now also carries the credit fields via the `.partial()`. `updateWallet` already whitelists `creditLimit`/`statementDay`/`paymentDueDay` — keep. Do NOT accept `openingUsed` on update (that is what "Ajustar saldo" is for).
- **Remove** the dedicated credit-card route (`PATCH /wallets/:id/credit-card`), `creditCardSchema`, and any handler wiring for it.

### Balance adjustment — new

- Route: `POST /wallets/:id/adjust`, body validated by `adjustBalanceSchema`:

```js
export const adjustBalanceSchema = z.object({
  targetBalance: z.number().max(9_999_999_999),
  note: z.string().max(500).optional().nullable(),
  occurredOn: isoDateSchema.optional(),
});
```

- Lives in `movements-service.js` as `adjustWalletBalance({ companyId, actorId, walletId, data })`:
  1. `assertWritable` (owner or EDITOR — reuse existing `wallets.canWriteWallet`).
  2. Load wallet; compute `current = openingBalance + Σ(amount · (direction === 'INCOME' ? 1 : -1))` over `enabled && status = 'POSTED'` movements (same expression already used across the module).
  3. `internalTarget = wallet.kind === 'CREDIT' ? -data.targetBalance : data.targetBalance`.
  4. `delta = internalTarget - current` rounded to 2 decimals. If `delta === 0` → `PfmServiceError("El saldo ya coincide con el registrado.", 400)`.
  5. Create movement: `isAdjustment: true`, `direction: delta > 0 ? 'INCOME' : 'EXPENSE'`, `amount: Math.abs(delta)`, `occurredOn: data.occurredOn ?? todayUtc`, `note: data.note ?? null`, `status: 'POSTED'`, `categoryId: null`.
  6. Return the updated wallet via `wallets.getWallet(...)`.

### Summary — `apps/api/src/routes/pfm/summary-service.js`

`getOverview` return object gains:

- `spendable` — Σ balance over wallets where `kind IN ('CASH','DEBIT')`.
- `creditDebt` — Σ `GREATEST(0, -balance)` over wallets where `kind = 'CREDIT'`.
- `investments` — `0` (constant for now; Plan 2 replaces with Σ over the investment kind).

`totalBalance` stays as-is (Σ over all wallets = spendable + investments − creditDebt, already consistent).

Add `AND m.is_adjustment = false` to the `totalsRows` (month expense/income/prev), `byCategoryRows`, and `trendRows` queries. The balance CTEs (`balanceRows`, and the new spendable/creditDebt aggregates) keep counting adjustments.

Implementation note: `spendable` and `creditDebt` can be derived in one query by adding `w.kind` to the per-wallet balance CTE and aggregating with `FILTER`.

## Frontend

### `WalletFormSheet.jsx`

- Extend the zod schema and `EMPTY` with `creditLimit`, `statementDay`, `paymentDueDay`, `openingUsed` (all optional).
- When the watched `kind === "CREDIT"`: render a credit section (Límite de crédito, Día de corte, Día límite de pago, and — create mode only — "Saldo ocupado actual"); hide the generic "Saldo inicial" field.
- Submit: for CREDIT create, send `{ name, kind, currency, color, reference, creditLimit, statementDay, paymentDueDay, openingUsed }` (no `openingBalance`). For CREDIT edit, send the credit fields but not `openingUsed`. Non-credit unchanged.
- Prefill on edit from `wallet.creditLimit` / `wallet.statementDay` / `wallet.paymentDueDay`.

### Remove `CreditCardSheet.jsx`

Delete the file, the `useUpdateWalletCredit` hook, and its route. `CreditCyclePanel`'s "Configurar" / "Ajustes" button now calls a prop that opens `WalletFormSheet` in edit mode (wire through `WalletDetailScreen`).

### Credit-card display

- Pure helper `creditUtilizationTone(ratio)` in `apps/desktop/src/modules/atlas.pfm/lib/format.js`: returns `"danger"` if `ratio > 0.8`, `"warning"` if `ratio >= 0.5`, else `"success"`. `null`/non-finite → `"success"`.
- Small component `CreditUsageBlock` (pfm-local, `components/`) given a `wallet`: computes `ocupado = Math.max(0, -wallet.currentBalance)`, `limite = wallet.creditLimit`, `disponible = limite != null ? limite - ocupado : null`, `util = limite ? ocupado / limite : null`. Renders `formatMoney(ocupado)` as the headline + `<ProgressMeter value={ocupado} max={limite} tone={creditUtilizationTone(util)} />` + "Disponible: $X · NN %". If `limite == null`, render just the headline + a muted "Configura el límite de crédito".
- `WalletsScreen` list card: for `w.kind === "CREDIT"` render `<CreditUsageBlock wallet={w} />` instead of the plain `formatMoney(w.currentBalance)` line.
- `computeCreditCycle` (in `wallets-service.js`) adds `utilization: creditLimit != null && creditLimit > 0 ? totalOwed / creditLimit : null` to its return; `CreditCyclePanel` shows the bar when `creditLimit` is set.

### "Ajustar saldo"

- New `AdjustBalanceSheet.jsx` (`components/`): `Dialog` with one numeric field ("Saldo real"; for `wallet.kind === "CREDIT"` label it "Saldo ocupado real"), an optional note, and a date defaulting to today. Live preview line: "Se registrará un ajuste de +$X" / "-$X" computed from the typed value vs `wallet.currentBalance` (mirroring the server delta rule, including the credit sign flip). Submit disabled when delta rounds to 0.
- Hook `useAdjustWalletBalance()` in `use-pfm-queries.js`: `POST /pfm/wallets/:id/adjust`, on success invalidate `["pfm"]` and the wallet key.
- `WalletDetailScreen`: an "Ajustar saldo" button near the balance opens the sheet.
- `MovementRow.jsx`: when `movement.isAdjustment`, show an "Ajuste" `Badge`, a distinct icon (`SlidersHorizontal`), and no category chip.
- `movements-service.js` `normalizeMovement` and the movement list query must surface `isAdjustment` (`is_adjustment`) in the DTO.

### Dashboard — `OverviewScreen.jsx`

Replace the single "Saldo total" `StatCard` with three: "Disponible" (`summary.spendable`), "Inversiones" (`summary.investments`), "Deuda tarjetas" (`summary.creditDebt`, red/negative styling). Add a small "Patrimonio neto: $X" line under them using `summary.totalBalance`.

## Testing (`node --test`)

- `movements-service` / `adjustWalletBalance`:
  - non-credit: delta = target − current, positive delta → INCOME adjustment, negative → EXPENSE.
  - credit: target is "saldo ocupado"; internalTarget = −target; a larger used balance than current debt → EXPENSE adjustment (balance more negative).
  - delta 0 → 400.
  - `isAdjustment` is `true` on the created row.
- `summary-service`:
  - adjustment movements excluded from `monthExpense` / `monthIncome` / `byCategory` / `trend`.
  - `spendable` sums only CASH + DEBIT; `creditDebt` sums `max(0, -balance)` over CREDIT; `investments === 0`.
  - (Follow the existing `summary-service.test.js` harness — extract pure aggregation helpers if the current test uses a Prisma stub.)
- `computeCreditCycle`: `utilization` = totalOwed / creditLimit; `null` when no limit.
- `format.js`: `creditUtilizationTone` thresholds (0.49 → success, 0.5 → warning, 0.81 → danger, `null` → success).

## Migration & manifest

- `prisma/migrations/<timestamp>_pfm_movement_is_adjustment/migration.sql`:
  `ALTER TABLE "pfm_movement" ADD COLUMN "is_adjustment" BOOLEAN NOT NULL DEFAULT false;`
- Add the field to `prisma/schema.prisma` `model PfmMovement`.
- `pnpm db:migrate` then `pnpm db:generate`.
- Bump `atlas.pfm` manifest version `0.2.0` → `0.3.0`.

## Out of scope (this plan)

- The `INVERSION` / investment wallet kind, expected-rate field, and yield accrual job (Plan 2).
- Configurable per-card utilization alert thresholds (fixed thresholds only).
- Adding "Ajustar saldo" to the wallet list card (detail screen only).
- Any change to how credit-card purchases count as month expenses / category spend (unchanged — a purchase is still an EXPENSE movement).
- Ledger-mirror wallet interaction with adjustments.

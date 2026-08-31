# atlas.pfm Plan 2B — UI: investment wallet form, rate display, yield grouping

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create an "Inversión" wallet with an expected annual rate, show that rate on the wallet card and a per-month "rendimiento" figure on the detail, and collapse the daily yield movements into an expandable monthly group in the movement list.

**Architecture:** React + Vite desktop app, `apps/desktop/src/modules/atlas.pfm/`. Pure helpers in `lib/format.js` are `node --test`-covered; components verified by `npx vite build` + manual QA. Spec: `docs/superpowers/specs/2026-08-31-pfm-investment-wallets-design.md`.

**Depends on:** Plan 2A (`kind = "INVESTMENT"`, `wallet.expectedRate`, `wallet.accruedThisMonth`, `movement.isYield`, `summary.investments`).

---

## File Structure

| File | Change | Task |
|---|---|---|
| `apps/desktop/src/modules/atlas.pfm/lib/format.js` | `WALLET_KIND_LABEL` + `INVESTMENT`; `formatRatePct`; `groupMovements` | 1 |
| `apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js` | tests for the new helpers | 1 |
| `apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx` | "Tasa anual esperada (%)" field for INVESTMENT | 2 |
| `apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx` | expected-rate line on the card | 3 |
| `apps/desktop/src/modules/atlas.pfm/components/InvestmentPanel.jsx` | create — rate + rendimiento del mes | 4 |
| `apps/desktop/src/modules/atlas.pfm/components/YieldGroupRow.jsx` | create — expandable monthly yield group | 5 |
| `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx` | render `InvestmentPanel`; group movements | 4, 5 |
| `apps/desktop/src/modules/atlas.pfm/components/AdjustBalanceSheet.jsx` | INVESTMENT copy tweak | 6 |

---

## Task 1: `format.js` helpers + tests

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/lib/format.js`
- Test: `apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js`

- [ ] **Step 1: Write the failing tests**

In `apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js`, extend the import and add tests:

```js
import {
  formatMoney,
  formatMonthLabel,
  percentDelta,
  creditUtilizationTone,
  creditUsage,
  formatRatePct,
  groupMovements,
} from "../lib/format.js";
```

```js
  it("formatRatePct renders a fraction as a percent, trimming .0", () => {
    assert.equal(formatRatePct(0.15), "15%");
    assert.equal(formatRatePct(0.1325), "13.25%");
    assert.equal(formatRatePct(null), "");
    assert.equal(formatRatePct(Number.NaN), "");
  });

  it("groupMovements collapses consecutive same-month yield rows", () => {
    const rows = [
      { id: "a", isYield: false, occurredOn: "2026-08-20" },
      { id: "b", isYield: true, occurredOn: "2026-08-19", amount: 1 },
      { id: "c", isYield: true, occurredOn: "2026-08-18", amount: 2 },
      { id: "d", isYield: false, occurredOn: "2026-08-17" },
    ];
    const out = groupMovements(rows);
    assert.equal(out.length, 3);
    assert.equal(out[0].type, "movement");
    assert.equal(out[1].type, "yield-group");
    assert.equal(out[1].month, "2026-08");
    assert.equal(out[1].count, 2);
    assert.equal(out[1].total, 3);
    assert.equal(out[1].items.length, 2);
    assert.equal(out[2].type, "movement");
  });

  it("groupMovements starts a new group when the month changes and breaks on a non-yield row", () => {
    const rows = [
      { id: "a", isYield: true, occurredOn: "2026-08-02", amount: 1 },
      { id: "b", isYield: true, occurredOn: "2026-07-31", amount: 1 },
      { id: "c", isYield: false, occurredOn: "2026-07-30" },
      { id: "d", isYield: true, occurredOn: "2026-07-29", amount: 1 },
    ];
    const out = groupMovements(rows);
    assert.deepEqual(out.map((o) => o.type), ["yield-group", "yield-group", "movement", "yield-group"]);
    assert.equal(out[0].month, "2026-08");
    assert.equal(out[1].month, "2026-07");
  });

  it("groupMovements leaves a yield-free list untouched", () => {
    const rows = [
      { id: "a", isYield: false, occurredOn: "2026-08-20" },
      { id: "b", isYield: false, occurredOn: "2026-08-19" },
    ];
    const out = groupMovements(rows);
    assert.deepEqual(out.map((o) => o.type), ["movement", "movement"]);
    assert.equal(out[0].item.id, "a");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js`
Expected: FAIL — `formatRatePct` / `groupMovements` are not exported.

- [ ] **Step 3: Implement**

In `apps/desktop/src/modules/atlas.pfm/lib/format.js`:

Change the `WALLET_KIND_LABEL` line to:

```js
export const WALLET_KIND_LABEL = {
  CASH: "Efectivo",
  DEBIT: "Debito",
  CREDIT: "Credito",
  INVESTMENT: "Inversión",
};
```

Append:

```js
// A stored rate is a fraction (0.15). Render as a percent, dropping a trailing ".0".
export function formatRatePct(rate) {
  const r = Number(rate);
  if (!Number.isFinite(r)) return "";
  const pct = Math.round(r * 10000) / 100;
  return `${pct}%`;
}

// Collapses maximal runs of consecutive isYield movements that share a YYYY-MM
// into one { type: "yield-group", key, month, total, count, items } entry.
// Every other movement becomes { type: "movement", item }.
export function groupMovements(movements) {
  const out = [];
  let run = null;
  const flush = () => {
    if (run) {
      out.push({
        type: "yield-group",
        key: `yield-${run.month}-${run.items[0].id}`,
        month: run.month,
        total: run.items.reduce((s, m) => s + Number(m.amount ?? 0), 0),
        count: run.items.length,
        items: run.items,
      });
      run = null;
    }
  };
  for (const m of movements ?? []) {
    const month = String(m.occurredOn ?? "").slice(0, 7);
    if (m.isYield && month) {
      if (run && run.month === month) run.items.push(m);
      else {
        flush();
        run = { month, items: [m] };
      }
    } else {
      flush();
      out.push({ type: "movement", item: m });
    }
  }
  flush();
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/lib/format.js apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js
git commit -m "feat(pfm-ui): formatRatePct + groupMovements helpers; INVESTMENT label"
```

---

## Task 2: "Tasa anual esperada" field in `WalletFormSheet`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx`

- [ ] **Step 1: Add the field**

In `apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx`:

1. In the zod `schema`, add:

```js
  expectedRate: z.coerce.number().min(0).max(100).optional().nullable(),
```

2. In `EMPTY`, add `expectedRate: "",`.

3. In the `reset(...)` for edit mode, add:

```js
            expectedRate: wallet.expectedRate != null ? String(wallet.expectedRate * 100) : "",
```

4. Add `const isInvestment = kind === "INVESTMENT";` next to `const isCredit = kind === "CREDIT";`.

5. In `onSubmit`, add an `INVESTMENT` branch before the final `else` (non-credit) branch — restructure the body as:

```js
    if (values.kind === "CREDIT") {
      const creditFields = {
        creditLimit: numOrNull(values.creditLimit),
        statementDay: numOrNull(values.statementDay),
        paymentDueDay: numOrNull(values.paymentDueDay),
      };
      if (isEdit) {
        await updateMut.mutateAsync({ id: wallet.id, ...base, ...creditFields });
      } else {
        await createMut.mutateAsync({
          ...base,
          ...creditFields,
          openingUsed: numOrNull(values.openingUsed) ?? 0,
        });
      }
    } else if (values.kind === "INVESTMENT") {
      const rateNum = numOrNull(values.expectedRate);
      const payload = {
        ...base,
        openingBalance: Number(values.openingBalance) || 0,
        expectedRate: rateNum == null ? null : rateNum / 100,
      };
      if (isEdit) {
        await updateMut.mutateAsync({ id: wallet.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
    } else {
      const payload = { ...base, openingBalance: Number(values.openingBalance) || 0 };
      if (isEdit) {
        await updateMut.mutateAsync({ id: wallet.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
    }
```

6. In the JSX, change the "Saldo inicial" guard so it also shows for INVESTMENT (it already shows for non-credit, and INVESTMENT is non-credit, so it already renders — no change), and add an investment block after the credit block:

```jsx
          {isInvestment && (
            <TextField
              label="Tasa anual esperada (%)"
              type="number"
              step="0.01"
              inputMode="decimal"
              hint="Rendimiento anual estimado; se acumula dia a dia"
              error={errors.expectedRate?.message}
              {...register("expectedRate")}
            />
          )}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx
git commit -m "feat(pfm-ui): expected annual rate field for investment wallets"
```

---

## Task 3: expected-rate line on the wallet list card

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx`

- [ ] **Step 1: Wire it in**

In `apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx`:

1. Extend the `format` import to include `formatRatePct`:

```js
import { formatMoney, WALLET_KIND_LABEL, formatRatePct } from "../lib/format";
```

2. In the branch that renders the non-credit balance `<p>`, wrap it so INVESTMENT also shows a rate line. Replace:

```jsx
            {w.kind === "CREDIT" ? (
              <div className="relative">
                <CreditUsageBlock wallet={w} />
              </div>
            ) : (
              <p className="relative mt-3 text-2xl font-bold tracking-tight tabular-nums text-[hsl(var(--foreground))]">
                {formatMoney(w.currentBalance, w.currency)}
              </p>
            )}
```

with:

```jsx
            {w.kind === "CREDIT" ? (
              <div className="relative">
                <CreditUsageBlock wallet={w} />
              </div>
            ) : (
              <div className="relative">
                <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-[hsl(var(--foreground))]">
                  {formatMoney(w.currentBalance, w.currency)}
                </p>
                {w.kind === "INVESTMENT" && w.expectedRate != null && (
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    Rendimiento esperado: {formatRatePct(w.expectedRate)} anual
                  </p>
                )}
              </div>
            )}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx
git commit -m "feat(pfm-ui): show expected rate on investment wallet cards"
```

---

## Task 4: `InvestmentPanel` on the wallet detail

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/InvestmentPanel.jsx`
- Modify: `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx`

- [ ] **Step 1: Create the panel**

Create `apps/desktop/src/modules/atlas.pfm/components/InvestmentPanel.jsx`:

```jsx
// apps/desktop/src/modules/atlas.pfm/components/InvestmentPanel.jsx
import { Card, Button } from "@atlas/ui";
import { TrendingUp, Settings2 } from "lucide-react";
import { formatMoney, formatRatePct } from "../lib/format";

export function InvestmentPanel({ wallet, onEdit }) {
  if (!wallet || wallet.kind !== "INVESTMENT") return null;
  const accrued = Number(wallet.accruedThisMonth ?? 0);
  return (
    <Card variant="solid" className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Cuenta de rendimiento</p>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Ajustes
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-center">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Tasa esperada
          </dt>
          <dd className="mt-0.5 text-base font-bold text-[hsl(var(--foreground))]">
            {wallet.expectedRate != null ? `${formatRatePct(wallet.expectedRate)} anual` : "Sin configurar"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Rendimiento este mes
          </dt>
          <dd className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400">
            +{formatMoney(accrued, wallet.currency)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
```

- [ ] **Step 2: Render it in `WalletDetailScreen`**

In `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx`:

Add the import next to `CreditCyclePanel`:

```jsx
import { InvestmentPanel } from "../components/InvestmentPanel";
```

After the `{wallet.kind === "CREDIT" && ( <CreditCyclePanel ... /> )}` block, add:

```jsx
      {wallet.kind === "INVESTMENT" && (
        <InvestmentPanel wallet={wallet} onEdit={() => setEditOpen(true)} />
      )}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/InvestmentPanel.jsx apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx
git commit -m "feat(pfm-ui): InvestmentPanel (rate + rendimiento del mes)"
```

---

## Task 5: group daily yield rows in the movement list

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/YieldGroupRow.jsx`
- Modify: `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx`

- [ ] **Step 1: Create `YieldGroupRow`**

Create `apps/desktop/src/modules/atlas.pfm/components/YieldGroupRow.jsx`:

```jsx
// apps/desktop/src/modules/atlas.pfm/components/YieldGroupRow.jsx
import { useState } from "react";
import { TrendingUp, ChevronRight } from "lucide-react";
import { formatMoney, formatMonthLabel } from "../lib/format";
import { MovementRow } from "./MovementRow";

export function YieldGroupRow({ group, currency }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-2 text-left"
      >
        <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
            Rendimiento · {formatMonthLabel(group.month)}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{group.count} días</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          +{formatMoney(group.total, currency)}
        </span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="ml-7 border-l border-[hsl(var(--border))] pl-3">
          {group.items.map((m) => (
            <MovementRow key={m.id} movement={m} currency={currency} onEdit={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Use it in the list**

In `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx`:

Extend the `format` import to include `groupMovements`:

```jsx
import {
  formatMoney,
  currentMonthKey,
  shiftMonth,
  formatMonthLabel,
  groupMovements,
} from "../lib/format";
```

Add the `YieldGroupRow` import:

```jsx
import { YieldGroupRow } from "../components/YieldGroupRow";
```

Replace the `{movements.map((m) => ( <MovementRow ... /> ))}` block with:

```jsx
        {groupMovements(movements).map((entry) =>
          entry.type === "yield-group" ? (
            <YieldGroupRow key={entry.key} group={entry} currency={wallet.currency} />
          ) : (
            <MovementRow
              key={`${entry.item.source ?? "native"}-${entry.item.id}`}
              movement={entry.item}
              currency={wallet.currency}
              onEdit={(mv) => {
                setEditingMovement(mv);
                setAddOpen(true);
              }}
              onConfirm={(mv) => setConfirmTarget(mv)}
              onSkip={(mv) => skipMut.mutate({ movementId: mv.id, walletId: wallet.id })}
            />
          ),
        )}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/YieldGroupRow.jsx apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx
git commit -m "feat(pfm-ui): collapse daily yield movements into a monthly group"
```

---

## Task 6: `AdjustBalanceSheet` copy for investment wallets

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/components/AdjustBalanceSheet.jsx`

- [ ] **Step 1: Adjust the labels**

In `apps/desktop/src/modules/atlas.pfm/components/AdjustBalanceSheet.jsx`:

Add near the top of the component body (after `const isCredit = ...`):

```js
  const isInvestment = wallet?.kind === "INVESTMENT";
```

Change the note `TextField` placeholder:

```jsx
          <TextField
            label="Nota (opcional)"
            placeholder={
              isInvestment
                ? "Ajuste de rendimiento / corrección"
                : "Rendimiento, corrección de banco..."
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
```

Change the "Saldo real" label for investment wallets:

```jsx
          <TextField
            label={
              isCredit ? "Saldo ocupado real" : isInvestment ? "Saldo real de la cuenta" : "Saldo real"
            }
            type="number"
            step="0.01"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/AdjustBalanceSheet.jsx
git commit -m "feat(pfm-ui): investment-aware copy in AdjustBalanceSheet"
```

---

## Task 7: Verification

**Files:** none

- [ ] **Step 1: pfm unit tests**

Run:
```bash
node --test apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js
```
Expected: `# fail 0`.

- [ ] **Step 2: Web build**

Run:
```bash
cd apps/desktop && npx vite build
```
Expected: `✓ built` with no "Could not resolve" / syntax errors. Return to repo root afterwards.

- [ ] **Step 3: Manual QA — start the app**

Run `pnpm dev`, open `http://localhost:5173`, go to Finanzas personales. (The worker yield tick runs hourly; for QA, either wait, restart the worker, or temporarily set a past `last_accrued_on` on a test wallet via Prisma Studio.)

- [ ] **Step 4: Checks at 1440px and 390px (screenshot both)**

- [ ] Nueva cartera → tipo "Inversión": aparece "Tasa anual esperada (%)" y "Saldo inicial"; no aparece el bloque de crédito. Crear con 10000 / 15%.
- [ ] Lista de carteras: la cuenta muestra el saldo y "Rendimiento esperado: 15% anual".
- [ ] Dashboard: la tarjeta "Inversiones" muestra 10,000 (ya no 0); "Patrimonio neto" lo incluye; "Disponible" NO lo incluye.
- [ ] Detalle de la cuenta: `InvestmentPanel` con la tasa y "Rendimiento este mes: +$X".
- [ ] Tras correr el worker (o forzar `last_accrued_on` atrás): en el historial los rendimientos diarios aparecen como una fila "Rendimiento · <mes> · N días · +$X" que se expande al tocar; el resto de movimientos sin cambios.
- [ ] "Ajustar saldo" en la cuenta: label "Saldo real de la cuenta", nota con placeholder de rendimiento; registrar un ajuste y ver que sí mueve el saldo y aparece con badge "Ajuste".
- [ ] Editar la cuenta (lápiz / panel "Ajustes") reabre el formulario con la tasa precargada.
- [ ] Sin scroll horizontal a 390px en Carteras, detalle y Resumen.

- [ ] **Step 5: Commit any QA fixups**

```bash
git add -A && git commit -m "test(pfm-ui): plan 2b QA fixups"
```

---

## Self-Review

**Spec coverage:**
- `WALLET_KIND_LABEL` + `INVESTMENT` ("Inversión") → Task 1.
- `formatRatePct` → Task 1; used in `WalletFormSheet` prefill (Task 2), `WalletsScreen` (Task 3), `InvestmentPanel` (Task 4).
- `groupMovements` pure helper (same-month collapse, month-break, non-yield break, yield-free untouched) → Task 1.
- "Tasa anual esperada (%)" field, percent→fraction on submit, prefill `× 100` → Task 2.
- Expected-rate line on the wallet card → Task 3.
- `InvestmentPanel` (rate + `accruedThisMonth`) on the detail → Task 4.
- Daily yield rows collapsed into an expandable `YieldGroupRow`; other rows unchanged → Task 5.
- `AdjustBalanceSheet` investment-aware copy → Task 6.
- Dashboard "Inversiones" card already reads `summary.investments` (Plan 1B) — no code change, verified in Task 7 QA.
- QA at 390 + 1440 → Task 7.

**Placeholder scan:** none. Every step is a full file or a precise edit with its anchor shown. `YieldGroupRow` passes `onEdit={() => {}}` to nested `MovementRow`s deliberately — yield movements are system-generated and not user-editable; `MovementRow`'s edit button still renders but is inert here (acceptable; a follow-up could hide it when `movement.isYield`).

**Type consistency:**
- `groupMovements` output entries: `{ type: "movement", item }` and `{ type: "yield-group", key, month, total, count, items }` — consumed exactly that way in `WalletDetailScreen` (Task 5) and `YieldGroupRow` (`group.month` / `group.count` / `group.total` / `group.items`).
- `wallet.expectedRate` is a fraction throughout: stored fraction → `formatRatePct` expects fraction → form multiplies by 100 for display, divides by 100 on submit.
- `wallet.accruedThisMonth` (number) from Plan 2A Task 5 → read in `InvestmentPanel` (Task 4).
- `movement.isYield` (bool) from Plan 2A Task 3 → drives `groupMovements` (Task 1).
- `formatMonthLabel` already exists in `format.js` and takes `"YYYY-MM"` → `group.month` is `occurredOn.slice(0, 7)`.

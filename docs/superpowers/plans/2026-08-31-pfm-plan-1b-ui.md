# atlas.pfm Plan 1B — UI: credit-card creation form, utilization view, "Ajustar saldo", dashboard totals

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture credit-card fields (limit, cut day, due day, current used balance) in the wallet create form; show credit cards as debt with a utilization bar; add an "Ajustar saldo" reconciliation sheet on the wallet detail; split the dashboard total into Disponible / Inversiones / Deuda tarjetas; delete the now-redundant `CreditCardSheet`.

**Architecture:** React + Vite desktop app, `apps/desktop/src/modules/atlas.pfm/`. TanStack Query hooks in `hooks/use-pfm-queries.js`, `@atlas/ui` components (`ProgressMeter`, `Dialog`, `TextField`, `Badge`, `StatCard`). Pure helpers in `lib/format.js` are `node --test`-covered; components are verified by `npx vite build` + manual QA (the repo has no component renderer under `node --test`). Spec: `docs/superpowers/specs/2026-08-31-pfm-credit-cards-and-balance-adjustment-design.md`.

**Tech Stack:** React 18, react-hook-form + zod, TanStack Query, lucide-react, Tailwind, Node built-in test runner.

**Depends on:** Plan 1A (endpoints `POST /pfm/wallets/:id/adjust`, wallet-create credit fields, summary `spendable`/`creditDebt`/`investments`, movement `isAdjustment`, `creditCycle.utilization`, SDK `adjustWalletBalance`, removed SDK `updateWalletCredit`).

---

## File Structure

| File | Change | Task |
|---|---|---|
| `apps/desktop/src/modules/atlas.pfm/lib/format.js` | add `creditUtilizationTone`, `creditUsage` | 1 |
| `apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js` | tone + usage tests | 1 |
| `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js` | add `useAdjustWalletBalance`; remove `useUpdateWalletCredit` | 2 |
| `apps/desktop/src/modules/atlas.pfm/components/CreditUsageBlock.jsx` | create — headline + `ProgressMeter` + disponible | 3 |
| `apps/desktop/src/modules/atlas.pfm/components/AdjustBalanceSheet.jsx` | create — reconciliation dialog | 4 |
| `apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx` | credit fields shown when kind = CREDIT | 5 |
| `apps/desktop/src/modules/atlas.pfm/components/CreditCardSheet.jsx` | delete | 6 |
| `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx` | drop `CreditCardSheet`; edit via `WalletFormSheet`; add "Ajustar saldo" | 6 |
| `apps/desktop/src/modules/atlas.pfm/components/CreditCyclePanel.jsx` | utilization bar; `onEdit` opens the wallet form | 7 |
| `apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx` | `CreditUsageBlock` for CREDIT cards | 8 |
| `apps/desktop/src/modules/atlas.pfm/components/MovementRow.jsx` | "Ajuste" badge + icon | 9 |
| `apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx` | Disponible / Inversiones / Deuda + Patrimonio neto | 10 |

---

## Task 1: `format.js` helpers + tests

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/lib/format.js`
- Test: `apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js` (match its existing `import`/runner style — it currently imports from `../lib/format.js`):

```js
import { creditUtilizationTone, creditUsage } from "../lib/format.js";

test("creditUtilizationTone thresholds", () => {
  assert.equal(creditUtilizationTone(0.49), "success");
  assert.equal(creditUtilizationTone(0.5), "warning");
  assert.equal(creditUtilizationTone(0.8), "warning");
  assert.equal(creditUtilizationTone(0.81), "danger");
  assert.equal(creditUtilizationTone(null), "success");
  assert.equal(creditUtilizationTone(Number.NaN), "success");
});

test("creditUsage derives ocupado/disponible/util from a credit wallet", () => {
  assert.deepEqual(creditUsage({ currentBalance: -12000, creditLimit: 50000 }), {
    ocupado: 12000,
    limite: 50000,
    disponible: 38000,
    util: 0.24,
  });
});

test("creditUsage clamps negative debt to zero and handles no limit", () => {
  assert.deepEqual(creditUsage({ currentBalance: 500, creditLimit: null }), {
    ocupado: 0,
    limite: null,
    disponible: null,
    util: null,
  });
});
```

(If `format.test.js` does not exist, create it with the header
`import { test } from "node:test"; import assert from "node:assert/strict";` before the blocks above.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js`
Expected: FAIL — `creditUtilizationTone` / `creditUsage` are not exported.

- [ ] **Step 3: Implement**

Append to `apps/desktop/src/modules/atlas.pfm/lib/format.js`:

```js
// Fixed utilization thresholds for credit cards: green < 50%, amber 50-80%, red > 80%.
export function creditUtilizationTone(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r)) return "success";
  if (r > 0.8) return "danger";
  if (r >= 0.5) return "warning";
  return "success";
}

// Derives the credit-card debt view from a wallet DTO.
// `currentBalance` is negative while the card owes money.
export function creditUsage(wallet) {
  const ocupado = Math.max(0, -Number(wallet?.currentBalance ?? 0));
  const limite =
    wallet?.creditLimit == null || !Number.isFinite(Number(wallet.creditLimit))
      ? null
      : Number(wallet.creditLimit);
  const disponible = limite == null ? null : Math.round((limite - ocupado) * 100) / 100;
  const util = limite && limite > 0 ? Math.round((ocupado / limite) * 100) / 100 : null;
  return { ocupado, limite, disponible, util };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/lib/format.js apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js
git commit -m "feat(pfm-ui): creditUtilizationTone + creditUsage helpers"
```

---

## Task 2: query hooks — add `useAdjustWalletBalance`, remove `useUpdateWalletCredit`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js`

- [ ] **Step 1: Replace `useUpdateWalletCredit`**

In `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js`, replace the whole `useUpdateWalletCredit` function (currently near line 368) with:

```js
export function useAdjustWalletBalance() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pfm.adjustWalletBalance(id, data, token),
    onSuccess: (_r, v) => invalidate(v.id),
  });
}
```

- [ ] **Step 2: Verify no other reference to the removed hook**

Run:
```bash
grep -rn "useUpdateWalletCredit" apps/desktop/src
```
Expected: no matches after Task 6 (at this point only `CreditCardSheet.jsx` / `WalletDetailScreen.jsx` might still import it — those are handled in Task 6; if the grep shows only those two files it is fine to proceed).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js
git commit -m "feat(pfm-ui): useAdjustWalletBalance hook (replaces useUpdateWalletCredit)"
```

---

## Task 3: `CreditUsageBlock` component

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/CreditUsageBlock.jsx`

- [ ] **Step 1: Write the component**

Create `apps/desktop/src/modules/atlas.pfm/components/CreditUsageBlock.jsx`:

```jsx
// apps/desktop/src/modules/atlas.pfm/components/CreditUsageBlock.jsx
import { ProgressMeter } from "@atlas/ui";
import { formatMoney, creditUsage, creditUtilizationTone } from "../lib/format";

// Debt-oriented view of a credit-card wallet: "Ocupado" headline + utilization bar.
export function CreditUsageBlock({ wallet, compact = false }) {
  const { ocupado, limite, disponible, util } = creditUsage(wallet);
  const pct = util == null ? null : Math.round(util * 100);

  return (
    <div className={compact ? "" : "mt-3"}>
      <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        Ocupado
      </p>
      <p className="text-2xl font-bold tracking-tight tabular-nums text-[hsl(var(--foreground))]">
        {formatMoney(ocupado, wallet.currency)}
      </p>
      {limite == null ? (
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Configura el límite de crédito
        </p>
      ) : (
        <>
          <ProgressMeter
            className="mt-2"
            value={ocupado}
            max={limite}
            tone={creditUtilizationTone(util)}
          />
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
            Disponible: {formatMoney(disponible, wallet.currency)}
            {pct != null ? ` · ${pct}%` : ""}
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Static check via build (done in Task 10) — for now, spot-check import path**

Run:
```bash
grep -n "ProgressMeter" packages/ui/src/index.js
```
Expected: a line exporting `ProgressMeter` (confirms the `@atlas/ui` import resolves).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/CreditUsageBlock.jsx
git commit -m "feat(pfm-ui): CreditUsageBlock (ocupado headline + utilization bar)"
```

---

## Task 4: `AdjustBalanceSheet` component

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/AdjustBalanceSheet.jsx`

- [ ] **Step 1: Write the component**

Create `apps/desktop/src/modules/atlas.pfm/components/AdjustBalanceSheet.jsx`:

```jsx
// apps/desktop/src/modules/atlas.pfm/components/AdjustBalanceSheet.jsx
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  TextField,
} from "@atlas/ui";
import { useAdjustWalletBalance } from "../hooks/use-pfm-queries";
import { formatMoney, todayIso, creditUsage } from "../lib/format";

// Reconcile a wallet's balance to a real-world figure. Books one adjustment
// movement for the difference (server side).
export function AdjustBalanceSheet({ open, onOpenChange, wallet }) {
  const mut = useAdjustWalletBalance();
  const isCredit = wallet?.kind === "CREDIT";
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !wallet) return;
    setError(null);
    setNote("");
    setDate(todayIso());
    setTarget(
      isCredit
        ? String(creditUsage(wallet).ocupado)
        : String(Number(wallet.currentBalance ?? 0)),
    );
  }, [open, wallet, isCredit]);

  if (!wallet) return null;

  const current = Number(wallet.currentBalance ?? 0);
  const parsed = Number(target);
  const internalTarget = isCredit ? -parsed : parsed;
  const delta = Number.isFinite(parsed)
    ? Math.round((internalTarget - current) * 100) / 100
    : 0;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(parsed)) {
      setError("Escribe un monto válido.");
      return;
    }
    if (delta === 0) {
      setError("El saldo ya coincide con el registrado.");
      return;
    }
    try {
      await mut.mutateAsync({
        id: wallet.id,
        targetBalance: parsed,
        note: note.trim() || null,
        occurredOn: date,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err?.message ?? "No se pudo ajustar el saldo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Ajustar saldo</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <TextField
            label={isCredit ? "Saldo ocupado real" : "Saldo real"}
            type="number"
            step="0.01"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <TextField
            label="Fecha"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <TextField
            label="Nota (opcional)"
            placeholder="Rendimiento, corrección de banco..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {delta === 0
              ? "Sin cambios: el saldo ya coincide."
              : `Se registrará un ajuste de ${delta > 0 ? "+" : "-"}${formatMoney(Math.abs(delta), wallet.currency)}.`}
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mut.isPending || delta === 0}>
              Registrar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/AdjustBalanceSheet.jsx
git commit -m "feat(pfm-ui): AdjustBalanceSheet reconciliation dialog"
```

---

## Task 5: credit fields in `WalletFormSheet`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx` with:

```jsx
// apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx
import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  TextField,
  SelectField,
  SwatchField,
} from "@atlas/ui";
import { useCreateWallet, useUpdateWallet } from "../hooks/use-pfm-queries";
import { WALLET_KIND_LABEL } from "../lib/format";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(120),
  kind: z.enum(["CASH", "DEBIT", "CREDIT"]),
  currency: z.enum(["MXN", "USD"]),
  openingBalance: z.coerce.number().default(0),
  color: z.string().max(32).optional().nullable(),
  reference: z.string().max(40).optional().nullable(),
  creditLimit: z.coerce.number().optional().nullable(),
  statementDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  paymentDueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  openingUsed: z.coerce.number().min(0).optional().nullable(),
});

const KIND_OPTIONS = Object.entries(WALLET_KIND_LABEL).map(([value, label]) => ({ value, label }));
const CURRENCY_OPTIONS = [
  { value: "MXN", label: "Pesos (MXN)" },
  { value: "USD", label: "Dolares (USD)" },
];

const EMPTY = {
  name: "",
  kind: "CASH",
  currency: "MXN",
  openingBalance: 0,
  color: "#0ea5e9",
  reference: "",
  creditLimit: "",
  statementDay: "",
  paymentDueDay: "",
  openingUsed: "",
};

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function WalletFormSheet({ open, onOpenChange, wallet }) {
  const isEdit = Boolean(wallet);
  const createMut = useCreateWallet();
  const updateMut = useUpdateWallet();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const kind = useWatch({ control, name: "kind" });
  const isCredit = kind === "CREDIT";

  useEffect(() => {
    if (!open) return;
    reset(
      wallet
        ? {
            name: wallet.name,
            kind: wallet.kind,
            currency: wallet.currency,
            openingBalance: wallet.openingBalance ?? 0,
            color: wallet.color ?? "#0ea5e9",
            reference: wallet.reference ?? "",
            creditLimit: wallet.creditLimit ?? "",
            statementDay: wallet.statementDay ?? "",
            paymentDueDay: wallet.paymentDueDay ?? "",
            openingUsed: "",
          }
        : EMPTY,
    );
  }, [open, wallet, reset]);

  async function onSubmit(values) {
    const base = {
      name: values.name,
      kind: values.kind,
      currency: values.currency,
      color: values.color ?? null,
      reference: values.reference?.trim() || null,
    };
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
    } else {
      const payload = { ...base, openingBalance: Number(values.openingBalance) || 0 };
      if (isEdit) {
        await updateMut.mutateAsync({ id: wallet.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cartera" : "Nueva cartera"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextField
            label="Nombre"
            placeholder="Efectivo, BBVA debito..."
            error={errors.name?.message}
            {...register("name")}
          />
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <SelectField
                label="Tipo"
                options={KIND_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <SelectField
                label="Moneda"
                options={CURRENCY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          {!isCredit && (
            <TextField
              label="Saldo inicial"
              type="number"
              step="0.01"
              error={errors.openingBalance?.message}
              {...register("openingBalance")}
            />
          )}

          {isCredit && (
            <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Tarjeta de credito
              </p>
              <TextField
                label="Limite de credito"
                type="number"
                step="0.01"
                inputMode="decimal"
                error={errors.creditLimit?.message}
                {...register("creditLimit")}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Dia de corte"
                  type="number"
                  min="1"
                  max="31"
                  error={errors.statementDay?.message}
                  {...register("statementDay")}
                />
                <TextField
                  label="Dia limite de pago"
                  type="number"
                  min="1"
                  max="31"
                  error={errors.paymentDueDay?.message}
                  {...register("paymentDueDay")}
                />
              </div>
              {!isEdit && (
                <TextField
                  label="Saldo ocupado actual"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  hint="Cuanto debes hoy en esta tarjeta"
                  error={errors.openingUsed?.message}
                  {...register("openingUsed")}
                />
              )}
            </div>
          )}

          <TextField
            label="Referencia (opcional)"
            placeholder="4821 o un apodo"
            hint="Ultimos digitos de la tarjeta o una nota para reconocerla"
            error={errors.reference?.message}
            {...register("reference")}
          />
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <SwatchField label="Color" value={field.value} onChange={field.onChange} />
            )}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx
git commit -m "feat(pfm-ui): credit-card fields in the wallet create form"
```

---

## Task 6: delete `CreditCardSheet`, rewire `WalletDetailScreen`

**Files:**
- Delete: `apps/desktop/src/modules/atlas.pfm/components/CreditCardSheet.jsx`
- Modify: `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx`

- [ ] **Step 1: Rewire `WalletDetailScreen.jsx`**

Apply these edits to `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx`:

1. Imports — replace the `CreditCardSheet` import line with the new components, and add `SlidersHorizontal` to the lucide import:

```jsx
import { Plus, ArrowLeft, SlidersHorizontal } from "lucide-react";
```
```jsx
import { CreditCyclePanel } from "../components/CreditCyclePanel";
import { WalletFormSheet } from "../components/WalletFormSheet";
import { AdjustBalanceSheet } from "../components/AdjustBalanceSheet";
```
(remove `import { CreditCardSheet } from "../components/CreditCardSheet";`)

2. State — replace `const [creditSheetOpen, setCreditSheetOpen] = useState(false);` with:

```jsx
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
```

3. `PageHeader` actions — add an "Ajustar saldo" button before the "Carteras" button:

```jsx
        actions={
          <div className="flex gap-2">
            {wallet.canWrite !== false && (
              <Button variant="outline" onClick={() => setAdjustOpen(true)}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Ajustar saldo
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate("/app/m/atlas.pfm/wallets")}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Carteras
            </Button>
          </div>
        }
```

4. Credit panel — change the `onEdit` target:

```jsx
      {wallet.kind === "CREDIT" && (
        <CreditCyclePanel wallet={wallet} onEdit={() => setEditOpen(true)} />
      )}
```

5. Sheets — replace the `<CreditCardSheet .../>` element with:

```jsx
      <WalletFormSheet open={editOpen} onOpenChange={setEditOpen} wallet={wallet} />
      <AdjustBalanceSheet open={adjustOpen} onOpenChange={setAdjustOpen} wallet={wallet} />
```

- [ ] **Step 2: Delete the file**

```bash
git rm apps/desktop/src/modules/atlas.pfm/components/CreditCardSheet.jsx
```

- [ ] **Step 3: Verify no dangling references**

Run:
```bash
grep -rn "CreditCardSheet\|useUpdateWalletCredit\|updateWalletCredit" apps/desktop/src
```
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx
git commit -m "refactor(pfm-ui): remove CreditCardSheet; edit credit card via WalletFormSheet; add Ajustar saldo"
```

---

## Task 7: utilization bar in `CreditCyclePanel`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/components/CreditCyclePanel.jsx`

- [ ] **Step 1: Add the bar**

In `apps/desktop/src/modules/atlas.pfm/components/CreditCyclePanel.jsx`:

1. Extend imports:

```jsx
import { Card, Button, ProgressMeter } from "@atlas/ui";
import { CreditCard, Settings2 } from "lucide-react";
import { formatMoney, creditUtilizationTone } from "../lib/format";
```

2. After the closing `</dl>` and before the `<p className="mt-3 ...">Corte dia ...` line, insert:

```jsx
      {c.creditLimit != null && (
        <ProgressMeter
          className="mt-3"
          value={c.totalOwed}
          max={c.creditLimit}
          tone={creditUtilizationTone(c.utilization)}
          valueLabel={c.utilization != null ? `${Math.round(c.utilization * 100)}%` : undefined}
          label="Ocupacion"
        />
      )}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/CreditCyclePanel.jsx
git commit -m "feat(pfm-ui): utilization bar in CreditCyclePanel"
```

---

## Task 8: `CreditUsageBlock` on the wallet list card

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx`

- [ ] **Step 1: Wire it in**

In `apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx`:

1. Add the import:

```jsx
import { CreditUsageBlock } from "../components/CreditUsageBlock";
```

2. Replace the balance line

```jsx
            <p className="relative mt-3 text-2xl font-bold tracking-tight tabular-nums text-[hsl(var(--foreground))]">
              {formatMoney(w.currentBalance, w.currency)}
            </p>
```

with:

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

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx
git commit -m "feat(pfm-ui): credit cards show ocupado + utilization in the wallet list"
```

---

## Task 9: "Ajuste" badge in `MovementRow`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/components/MovementRow.jsx`

- [ ] **Step 1: Add the badge**

In `apps/desktop/src/modules/atlas.pfm/components/MovementRow.jsx`:

1. Import the icon:

```jsx
import { Check, SkipForward, Pencil, SlidersHorizontal } from "lucide-react";
```

2. In the metadata line (the `<p className="flex flex-wrap items-center gap-1.5 ...">`), add as the first child inside it, before `<span>{movement.occurredOn}</span>`:

```jsx
          {movement.isAdjustment && (
            <Badge variant="outline">
              <SlidersHorizontal className="mr-1 h-3 w-3" /> Ajuste
            </Badge>
          )}
```

3. In the title line, fall back to `"Ajuste de saldo"` for adjustments:

```jsx
        <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
          {movement.merchant || movement.note || (movement.isAdjustment ? "Ajuste de saldo" : "Movimiento")}
        </p>
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/components/MovementRow.jsx
git commit -m "feat(pfm-ui): flag adjustment movements in the list"
```

---

## Task 10: dashboard totals in `OverviewScreen`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx`

- [ ] **Step 1: Replace the stat grid**

In `apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx`, replace the stat-card grid block:

```jsx
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Saldo total" value={formatMoney(summary.totalBalance)} icon={Wallet} />
            <StatCard
              label="Ingresos del mes"
              value={formatMoney(summary.monthIncome)}
              icon={TrendingUp}
            />
            <StatCard
              label="Gastos del mes"
              value={formatMoney(summary.monthExpense)}
              icon={TrendingDown}
              trend={delta == null ? undefined : -delta}
            />
            <StatCard
              label="Neto del mes"
              value={`${net < 0 ? "-" : "+"}${formatMoney(Math.abs(net))}`}
              icon={Scale}
            />
          </div>
```

with:

```jsx
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Disponible" value={formatMoney(summary.spendable)} icon={Wallet} />
            <StatCard
              label="Inversiones"
              value={formatMoney(summary.investments)}
              icon={TrendingUp}
            />
            <StatCard
              label="Deuda tarjetas"
              value={summary.creditDebt ? `-${formatMoney(summary.creditDebt)}` : formatMoney(0)}
              icon={CreditCard}
            />
            <StatCard
              label="Ingresos del mes"
              value={formatMoney(summary.monthIncome)}
              icon={TrendingUp}
            />
            <StatCard
              label="Gastos del mes"
              value={formatMoney(summary.monthExpense)}
              icon={TrendingDown}
              trend={delta == null ? undefined : -delta}
            />
            <StatCard
              label="Neto del mes"
              value={`${net < 0 ? "-" : "+"}${formatMoney(Math.abs(net))}`}
              icon={Scale}
            />
          </div>
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
            Patrimonio neto: {formatMoney(summary.totalBalance)}
          </p>
```

- [ ] **Step 2: Ensure `CreditCard` is imported**

In the lucide-react import at the top of `OverviewScreen.jsx`, add `CreditCard` to the named imports (alongside `Wallet`, `TrendingUp`, `TrendingDown`, `Scale`).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx
git commit -m "feat(pfm-ui): split dashboard total into disponible / inversiones / deuda"
```

---

## Task 11: Verification

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
Expected: `✓ built` with no "Could not resolve" / syntax errors. (Return to repo root afterwards.)

- [ ] **Step 3: Manual QA — start the app**

Run `pnpm dev`, open `http://localhost:5173`, go to Finanzas personales.

- [ ] **Step 4: Checks at 1440px and 390px (screenshot both)**

- [ ] New cartera → tipo "Crédito": límite, día de corte, día de pago, "Saldo ocupado actual" appear; "Saldo inicial" hides. Create with limit 50000 / used 12000.
- [ ] Wallet list: the credit card shows "Ocupado $12,000.00", a bar, "Disponible: $38,000.00 · 24%". Bar is green (<50%). Raise usage past 50% / 80% (add expense movements) and confirm amber / red.
- [ ] Wallet detail (credit): `CreditCyclePanel` shows the "Ocupacion" bar with the % label.
- [ ] "Ajustar saldo" button on a cash wallet → type a higher number → preview "Se registrará un ajuste de +$X" → submit → balance updates, a movement with the "Ajuste" badge appears, and it is NOT added to "Gastos/Ingresos del mes" on the dashboard.
- [ ] "Ajustar saldo" on the credit card → field labelled "Saldo ocupado real", prefilled with current ocupado.
- [ ] Dashboard: "Disponible", "Inversiones" ($0.00), "Deuda tarjetas" (negative, red-ish), and "Patrimonio neto" line. No "Saldo total" card remains.
- [ ] Editing a credit wallet (pencil / CreditCyclePanel "Ajustes") opens `WalletFormSheet` with límite/corte/pago prefilled and no "Saldo ocupado actual" field.
- [ ] No horizontal body scroll at 390px on Carteras, detalle, and Resumen.

- [ ] **Step 5: Commit any QA fixups**

```bash
git add -A && git commit -m "test(pfm-ui): plan 1b QA fixups"
```

---

## Self-Review

**Spec coverage:**
- Credit fields in the create form, hidden "Saldo inicial", "Saldo ocupado actual" create-only → Task 5.
- `CreditCardSheet` removed; edits via `WalletFormSheet` → Task 6; `CreditCyclePanel.onEdit` rewired → Tasks 6, 7.
- `creditUtilizationTone` fixed thresholds + `creditUsage` derivation → Task 1.
- Credit card shown as debt: "Ocupado" headline + `ProgressMeter` + "Disponible · NN%" → Tasks 3, 8; detail bar → Task 7.
- "Ajustar saldo": `AdjustBalanceSheet` with live delta preview + credit sign flip, `useAdjustWalletBalance` → Tasks 2, 4; entry point on `WalletDetailScreen` → Task 6.
- Adjustment movements flagged in the list → Task 9.
- Dashboard split into Disponible / Inversiones / Deuda tarjetas + Patrimonio neto line → Task 10.
- `useUpdateWalletCredit` removed → Task 2 (+ grep guards in Tasks 2, 6).

**Placeholder scan:** none — every code step is a full block or a precise textual edit with the surrounding anchor shown.

**Type consistency:**
- `creditUsage(wallet)` returns `{ ocupado, limite, disponible, util }` — consumed identically in `CreditUsageBlock` (Task 3) and `AdjustBalanceSheet` (Task 4).
- `useAdjustWalletBalance().mutateAsync({ id, targetBalance, note, occurredOn })` (Task 4) matches the hook's `mutationFn: ({ id, ...data }) => atlas.pfm.adjustWalletBalance(id, data, token)` (Task 2) and Plan 1A's `adjustBalanceSchema` (`targetBalance` / `note` / `occurredOn`).
- `summary.spendable` / `summary.investments` / `summary.creditDebt` / `summary.totalBalance` (Task 10) match Plan 1A Task 8's return object.
- `movement.isAdjustment` (Task 9) matches Plan 1A Task 2's DTO field.
- `wallet.creditLimit` / `wallet.statementDay` / `wallet.paymentDueDay` (Task 5 prefill) already on the wallet DTO via `normalizeWalletRow`.
- `c.utilization` (Task 7) matches Plan 1A Task 7's `computeCreditCycle` addition.

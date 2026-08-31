# atlas.pfm — Phase 1 — Plan B (Desktop UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `atlas.pfm` desktop screens for Phase 1 — Carteras (grid + create/edit + deactivate + members), Wallet detail (movement list, native + ledger-mirror, quick-add sheet, confirm/skip), and a basic Resumen (stat cards, category donut, 6-month trend).

**Architecture:** A standard Atlas desktop module under `apps/desktop/src/modules/atlas.pfm/`. TanStack Query hooks call the SDK `atlas.pfm.*` group (added in Plans A1/A2) via the shared `atlas` proxy. Screens are `@atlas/ui`-only (no native form elements, no browser dialogs), mobile-first, each starting with `PageHeader`. Screens are registered in `apps/desktop/src/app/ModuleOutlet.jsx` (`SCREEN_MAP` + `resolveScreen`). No offline/SQLite path in Phase 1 (out of scope per spec §12).

**Tech Stack:** React 18, Vite, TanStack Query v5, React Hook Form + Zod, `@atlas/ui`, Recharts 3, lucide-react, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-31-atlas-pfm-design.md` (section 9). **Prereq:** Plans A1 + A2 merged; API running against a DB with the pfm migration + seed applied.

**QA gate (per spec §9, §11 and memory `feedback_responsive_qa`):** before marking this plan complete, screenshot every screen at **390px** and **1440px** and run the 14-aspect UI checklist (`docs/ai-context/ui-screen-audit-checklist.md`). Use the `browser-qa` skill / Playwright MCP.

---

## File Structure

- `apps/desktop/src/modules/atlas.pfm/lib/format.js` — currency/number formatting helpers (create).
- `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js` — all TanStack hooks (create).
- `apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx` — create/edit wallet (create).
- `apps/desktop/src/modules/atlas.pfm/components/QuickAddMovementSheet.jsx` — global quick-add (create).
- `apps/desktop/src/modules/atlas.pfm/components/WalletMembersDialog.jsx` — manage collaborators (create).
- `apps/desktop/src/modules/atlas.pfm/components/MovementRow.jsx` — one movement (list + card) (create).
- `apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx` — grid (create).
- `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx` — balance + movements + FAB (create).
- `apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx` — Resumen (create).
- `apps/desktop/src/modules/atlas.pfm/components/CategoryDonut.jsx` — Recharts donut, theme tokens (create).
- `apps/desktop/src/modules/atlas.pfm/components/SpendTrendBar.jsx` — Recharts 6-month bars (create).
- `apps/desktop/src/app/ModuleOutlet.jsx` — register screens (modify).
- `apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js` — unit test for helpers (create).

---

## Task 1: Formatting helpers (test first)

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/lib/format.js`
- Test: `apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, formatMonthLabel, percentDelta } from "../lib/format.js";

describe("pfm format helpers", () => {
  it("formatMoney renders MXN with 2 decimals and a currency symbol", () => {
    assert.equal(formatMoney(1234.5, "MXN"), "$1,234.50");
    assert.equal(formatMoney(-89, "MXN"), "-$89.00");
    assert.equal(formatMoney(null, "MXN"), "$0.00");
  });

  it("formatMonthLabel turns 2026-08 into a short Spanish label", () => {
    assert.equal(formatMonthLabel("2026-08"), "ago 2026");
  });

  it("percentDelta returns a rounded signed percentage or null when base is 0", () => {
    assert.equal(percentDelta(150, 100), 50);
    assert.equal(percentDelta(80, 100), -20);
    assert.equal(percentDelta(100, 0), null);
  });
});
```

- [ ] **Step 2:** Run `node --test apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js` — expect FAIL (module missing).

- [ ] **Step 3: Write `lib/format.js`**

```js
// apps/desktop/src/modules/atlas.pfm/lib/format.js

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatMoney(value, currency = "MXN") {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0;
  const abs = Math.abs(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = currency === "USD" ? "US$" : "$";
  return `${n < 0 ? "-" : ""}${symbol}${abs}`;
}

export function formatMonthLabel(month) {
  const [y, m] = String(month ?? "").split("-");
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return String(month ?? "");
  return `${MONTHS_ES[idx]} ${y}`;
}

export function percentDelta(current, base) {
  const b = Number(base);
  if (!Number.isFinite(b) || b === 0) return null;
  return Math.round(((Number(current) - b) / b) * 100);
}

export function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export const WALLET_KIND_LABEL = { CASH: "Efectivo", DEBIT: "Debito", CREDIT: "Credito" };
```

- [ ] **Step 4:** Run `node --test apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js` — expect PASS (3 tests).
- [ ] **Step 5:** Commit: `git add apps/desktop/src/modules/atlas.pfm/lib/format.js apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js && git commit -m "feat(pfm-ui): formatting helpers"`

---

## Task 2: Query hooks

**Files:** Create `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js`

- [ ] **Step 1: Write the hooks module**

```js
// apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

const keys = {
  wallets: ["pfm", "wallets"],
  wallet: (id) => ["pfm", "wallet", id],
  members: (id) => ["pfm", "wallet", id, "members"],
  movements: (id, query) => ["pfm", "wallet", id, "movements", query],
  categories: (kind) => ["pfm", "categories", kind ?? "all"],
  summary: (month) => ["pfm", "summary", month],
};

export function useWallets() {
  const token = useToken();
  return useQuery({
    queryKey: keys.wallets,
    queryFn: () => atlas.pfm.listWallets(token),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
    select: (res) => res.data ?? [],
  });
}

export function useWallet(walletId) {
  const token = useToken();
  return useQuery({
    queryKey: keys.wallet(walletId),
    queryFn: () => atlas.pfm.getWallet(walletId, token),
    enabled: Boolean(token && walletId),
    select: (res) => res.data ?? null,
  });
}

export function useWalletMovements(walletId, query) {
  const token = useToken();
  return useQuery({
    queryKey: keys.movements(walletId, query),
    queryFn: () => atlas.pfm.listWalletMovements(walletId, token, query),
    enabled: Boolean(token && walletId),
    placeholderData: keepPreviousData,
    select: (res) => res.data ?? [],
  });
}

export function usePfmCategories(kind) {
  const token = useToken();
  return useQuery({
    queryKey: keys.categories(kind),
    queryFn: () => atlas.pfm.listCategories(token, kind ? { kind } : {}),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data ?? [],
  });
}

export function usePfmSummary(month) {
  const token = useToken();
  return useQuery({
    queryKey: keys.summary(month),
    queryFn: () => atlas.pfm.getSummary(token, { month }),
    enabled: Boolean(token && month),
    placeholderData: keepPreviousData,
    select: (res) => res.data ?? null,
  });
}

export function useWalletMembers(walletId, enabled = true) {
  const token = useToken();
  return useQuery({
    queryKey: keys.members(walletId),
    queryFn: () => atlas.pfm.listWalletMembers(walletId, token),
    enabled: Boolean(token && walletId && enabled),
    select: (res) => res.data ?? [],
  });
}

function useInvalidatePfm() {
  const qc = useQueryClient();
  return (walletId) => {
    qc.invalidateQueries({ queryKey: ["pfm"] });
    if (walletId) qc.invalidateQueries({ queryKey: keys.wallet(walletId) });
  };
}

export function useCreateWallet() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: (data) => atlas.pfm.createWallet(data, token),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateWallet() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pfm.updateWallet(id, data, token),
    onSuccess: (_r, v) => invalidate(v.id),
  });
}

export function useSetWalletEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, enabled }) => atlas.pfm.setWalletEnabled(id, enabled, token),
    onSuccess: () => invalidate(),
  });
}

export function useCreateMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, ...data }) => atlas.pfm.createWalletMovement(walletId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useUpdateMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId, ...data }) => atlas.pfm.updateMovement(movementId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useSetMovementEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId, enabled }) => atlas.pfm.setMovementEnabled(movementId, enabled, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useConfirmMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId, amount }) => atlas.pfm.confirmMovement(movementId, amount, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useSkipMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId }) => atlas.pfm.skipMovement(movementId, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useEnrichLedgerMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, ltxId, ...data }) => atlas.pfm.enrichLedgerMovement(walletId, ltxId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useUpsertWalletMember() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, ...data }) => atlas.pfm.upsertWalletMember(walletId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useRemoveWalletMember() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, userId }) => atlas.pfm.removeWalletMember(walletId, userId, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}
```

- [ ] **Step 2:** Run `node --check apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js` — expect no output.
- [ ] **Step 3:** Commit: `git add apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js && git commit -m "feat(pfm-ui): TanStack Query hooks"`

---

## Task 3: `WalletFormSheet.jsx` (create/edit wallet)

**Files:** Create `apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx`

- [ ] **Step 1: Write the component**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
  Button, TextField, SelectField,
} from "@atlas/ui";
import { useCreateWallet, useUpdateWallet, useWallets } from "../hooks/use-pfm-queries";
import { WALLET_KIND_LABEL } from "../lib/format";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(120),
  kind: z.enum(["CASH", "DEBIT", "CREDIT"]),
  currency: z.enum(["MXN", "USD"]),
  openingBalance: z.coerce.number().default(0),
  color: z.string().max(32).optional().nullable(),
  ledgerAccountId: z.string().uuid().optional().nullable(),
});

const KIND_OPTIONS = Object.entries(WALLET_KIND_LABEL).map(([value, label]) => ({ value, label }));
const CURRENCY_OPTIONS = [
  { value: "MXN", label: "Pesos (MXN)" },
  { value: "USD", label: "Dolares (USD)" },
];

export function WalletFormSheet({ open, onOpenChange, wallet }) {
  const isEdit = Boolean(wallet);
  const createMut = useCreateWallet();
  const updateMut = useUpdateWallet();

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", kind: "CASH", currency: "MXN", openingBalance: 0, color: "#0ea5e9", ledgerAccountId: null,
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        wallet
          ? {
              name: wallet.name, kind: wallet.kind, currency: wallet.currency,
              openingBalance: wallet.openingBalance ?? 0, color: wallet.color ?? "#0ea5e9",
              ledgerAccountId: wallet.ledgerAccountId ?? null,
            }
          : { name: "", kind: "CASH", currency: "MXN", openingBalance: 0, color: "#0ea5e9", ledgerAccountId: null },
      );
    }
  }, [open, wallet, reset]);

  async function onSubmit(values) {
    if (isEdit) {
      await updateMut.mutateAsync({ id: wallet.id, ...values });
    } else {
      await createMut.mutateAsync(values);
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="sm:max-w-lg sm:mx-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar cartera" : "Nueva cartera"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextField label="Nombre" placeholder="Efectivo, BBVA debito..." error={errors.name?.message} {...register("name")} />
          <Controller
            control={control} name="kind"
            render={({ field }) => (
              <SelectField label="Tipo" options={KIND_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={control} name="currency"
            render={({ field }) => (
              <SelectField label="Moneda" options={CURRENCY_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
          <TextField
            label="Saldo inicial" type="number" step="0.01"
            error={errors.openingBalance?.message} {...register("openingBalance")}
          />
          <TextField label="Color" type="color" {...register("color")} />
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isEdit ? "Guardar" : "Crear"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

Note: `ledgerAccountId` linking UI (pick an `atlas.ledger` account) is added in Task 8 once the ledger account picker is confirmed available; for now the field is carried in the form defaults only and not user-editable.

- [ ] **Step 2:** Run `node --check apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx` — expect no output.
- [ ] **Step 3:** Commit: `git add apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx && git commit -m "feat(pfm-ui): wallet create/edit sheet"`

---

## Task 4: `MovementRow.jsx` + `QuickAddMovementSheet.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/MovementRow.jsx`
- Create: `apps/desktop/src/modules/atlas.pfm/components/QuickAddMovementSheet.jsx`

- [ ] **Step 1: Write `MovementRow.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/MovementRow.jsx
import { Badge, Button } from "@atlas/ui";
import { Check, SkipForward, Pencil } from "lucide-react";
import { formatMoney } from "../lib/format";

export function MovementRow({ movement, currency, onEdit, onConfirm, onSkip }) {
  const isExpense = movement.direction === "EXPENSE";
  const amountText = `${isExpense ? "-" : "+"}${formatMoney(movement.amount, currency)}`;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
          {movement.merchant || movement.note || "Movimiento"}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {movement.occurredOn}
          {movement.source === "ledger" && <Badge variant="outline" className="ml-2">Libro de cuentas</Badge>}
          {movement.status === "PENDING" && <Badge variant="warning" className="ml-2">Pendiente</Badge>}
          {movement.status === "SKIPPED" && <Badge variant="outline" className="ml-2">Omitido</Badge>}
        </p>
      </div>
      <span className={isExpense ? "text-sm font-semibold text-red-500" : "text-sm font-semibold text-emerald-600 dark:text-emerald-400"}>
        {amountText}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {movement.status === "PENDING" && (
          <>
            <Button size="icon" variant="ghost" aria-label="Confirmar" onClick={() => onConfirm(movement)}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Omitir" onClick={() => onSkip(movement)}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => onEdit(movement)}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `QuickAddMovementSheet.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/QuickAddMovementSheet.jsx
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
  Button, TextField, SelectField, CreatableComboboxField, DateField,
} from "@atlas/ui";
import {
  useWallets, usePfmCategories, useCreateMovement, useUpdateMovement,
  useEnrichLedgerMovement,
} from "../hooks/use-pfm-queries";
import { todayIso } from "../lib/format";

const schema = z.object({
  direction: z.enum(["EXPENSE", "INCOME"]),
  amount: z.coerce.number().positive("Ingresa un monto mayor a cero"),
  walletId: z.string().uuid("Elige una cartera"),
  categoryId: z.string().uuid().optional().nullable(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().max(160).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export function QuickAddMovementSheet({ open, onOpenChange, defaultWalletId, editingMovement }) {
  const isEdit = Boolean(editingMovement);
  const isLedgerRow = editingMovement?.source === "ledger";
  const { data: wallets = [] } = useWallets();
  const [direction, setDirection] = useState("EXPENSE");
  const { data: categories = [] } = usePfmCategories(direction);
  const createMut = useCreateMovement();
  const updateMut = useUpdateMovement();
  const enrichMut = useEnrichLedgerMovement();

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: "EXPENSE", amount: undefined, walletId: defaultWalletId ?? "",
      categoryId: null, occurredOn: todayIso(), merchant: "", note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingMovement) {
      reset({
        direction: editingMovement.direction,
        amount: editingMovement.amount,
        walletId: editingMovement.walletId ?? defaultWalletId ?? "",
        categoryId: editingMovement.categoryId ?? null,
        occurredOn: editingMovement.occurredOn ?? todayIso(),
        merchant: editingMovement.merchant ?? "",
        note: editingMovement.note ?? "",
      });
      setDirection(editingMovement.direction);
    } else {
      reset({
        direction: "EXPENSE", amount: undefined, walletId: defaultWalletId ?? "",
        categoryId: null, occurredOn: todayIso(), merchant: "", note: "",
      });
      setDirection("EXPENSE");
    }
  }, [open, editingMovement, defaultWalletId, reset]);

  const walletOptions = wallets.map((w) => ({ value: w.id, label: `${w.name} (${w.currency})` }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  async function onSubmit(values) {
    if (isEdit && isLedgerRow) {
      await enrichMut.mutateAsync({
        walletId: values.walletId, ltxId: editingMovement.id,
        categoryId: values.categoryId ?? null, note: values.note ?? null,
      });
    } else if (isEdit) {
      await updateMut.mutateAsync({ movementId: editingMovement.id, walletId: values.walletId, ...values });
    } else {
      await createMut.mutateAsync({ ...values, status: "POSTED" });
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="sm:max-w-lg sm:mx-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar movimiento" : "Nuevo movimiento"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* big amount field */}
          <TextField
            label="Monto" type="number" step="0.01" inputMode="decimal" autoFocus
            className="[&_input]:text-2xl [&_input]:font-bold"
            error={errors.amount?.message} disabled={isLedgerRow}
            {...register("amount")}
          />
          <Controller
            control={control} name="direction"
            render={({ field }) => (
              <SelectField
                label="Tipo"
                options={[{ value: "EXPENSE", label: "Gasto" }, { value: "INCOME", label: "Ingreso" }]}
                value={field.value}
                onChange={(v) => { field.onChange(v); setDirection(v); setValue("categoryId", null); }}
                disabled={isLedgerRow}
              />
            )}
          />
          <Controller
            control={control} name="walletId"
            render={({ field }) => (
              <SelectField label="Cartera" options={walletOptions} value={field.value} onChange={field.onChange} error={errors.walletId?.message} disabled={isLedgerRow} />
            )}
          />
          <Controller
            control={control} name="categoryId"
            render={({ field }) => (
              <CreatableComboboxField
                label="Categoria"
                placeholder="Buscar o crear..."
                options={categoryOptions}
                value={field.value ?? ""}
                onChange={field.onChange}
                onCreate={undefined}
              />
            )}
          />
          <Controller
            control={control} name="occurredOn"
            render={({ field }) => (
              <DateField label="Fecha" value={field.value} onChange={field.onChange} disabled={isLedgerRow} />
            )}
          />
          <TextField label="Comercio" {...register("merchant")} disabled={isLedgerRow} />
          <TextField label="Nota" {...register("note")} />
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isEdit ? "Guardar" : "Registrar"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

Note: the inline "+ Crear «X»" category-create wiring (`onCreate`) is deferred to Task 8 (needs `atlas.pfm.createCategory` mutation + optimistic select). For now `CreatableComboboxField` is used in select-only mode.

- [ ] **Step 3:** `node --check` both files — expect no output.
- [ ] **Step 4:** Commit: `git add apps/desktop/src/modules/atlas.pfm/components/MovementRow.jsx apps/desktop/src/modules/atlas.pfm/components/QuickAddMovementSheet.jsx && git commit -m "feat(pfm-ui): movement row + quick-add sheet"`

---

## Task 5: `WalletsScreen.jsx` + `WalletMembersDialog.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.pfm/components/WalletMembersDialog.jsx`

- [ ] **Step 1: Write `WalletMembersDialog.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/WalletMembersDialog.jsx
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, TextField, SelectField, Badge, EmptyState, ConfirmDialog,
} from "@atlas/ui";
import { Trash2 } from "lucide-react";
import { useWalletMembers, useUpsertWalletMember, useRemoveWalletMember } from "../hooks/use-pfm-queries";

const ROLE_OPTIONS = [
  { value: "VIEWER", label: "Puede ver" },
  { value: "EDITOR", label: "Puede editar" },
];

export function WalletMembersDialog({ open, onOpenChange, wallet }) {
  const { data: members = [] } = useWalletMembers(wallet?.id, open);
  const upsert = useUpsertWalletMember();
  const remove = useRemoveWalletMember();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [removeTarget, setRemoveTarget] = useState(null);

  if (!wallet) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Colaboradores de {wallet.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {members.length === 0 ? (
            <EmptyState title="Sin colaboradores" description="Comparte esta cartera agregando a alguien de tu empresa." />
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{m.userId}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{m.role === "EDITOR" ? "Editor" : "Lector"}</Badge>
                    <Button size="icon" variant="ghost" aria-label="Quitar" onClick={() => setRemoveTarget(m)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <TextField label="ID de usuario" value={userId} onChange={(e) => setUserId(e.target.value)} className="flex-1" />
            <SelectField label="Rol" options={ROLE_OPTIONS} value={role} onChange={setRole} />
            <Button
              type="button"
              disabled={!userId || upsert.isPending}
              onClick={async () => { await upsert.mutateAsync({ walletId: wallet.id, userId, role }); setUserId(""); }}
            >
              Agregar
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title="Quitar colaborador"
        description="Esta persona dejara de ver esta cartera."
        confirmLabel="Quitar"
        onConfirm={async () => { await remove.mutateAsync({ walletId: wallet.id, userId: removeTarget.userId }); setRemoveTarget(null); }}
      />
    </Dialog>
  );
}
```

Note: replacing the raw "ID de usuario" `TextField` with a proper company-member picker (`ContactPicker`-style) is a Task 8 refinement.

- [ ] **Step 2: Write `WalletsScreen.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PageHeader, Button, Card, Badge, EmptyState, ErrorState, LoadingState, ConfirmDialog,
} from "@atlas/ui";
import { Plus, Users, Pencil, EyeOff, Wallet } from "lucide-react";
import { useWallets, useSetWalletEnabled } from "../hooks/use-pfm-queries";
import { WalletFormSheet } from "../components/WalletFormSheet";
import { WalletMembersDialog } from "../components/WalletMembersDialog";
import { formatMoney, WALLET_KIND_LABEL } from "../lib/format";

export default function WalletsScreen() {
  const navigate = useNavigate();
  const { data: wallets = [], isLoading, isError, refetch } = useWallets();
  const setEnabled = useSetWalletEnabled();

  const [formOpen, setFormOpen] = useState(false);
  const [editWallet, setEditWallet] = useState(null);
  const [membersWallet, setMembersWallet] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="Carteras"
        description="Efectivo, debito y credito"
        actions={
          <Button onClick={() => { setEditWallet(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Nueva cartera
          </Button>
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState title="No se pudieron cargar las carteras" onRetry={refetch} />}
      {!isLoading && !isError && wallets.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="Aun no tienes carteras"
          description="Crea tu primera cartera para empezar a registrar ingresos y gastos."
          action={<Button onClick={() => setFormOpen(true)}>Nueva cartera</Button>}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {wallets.map((w) => (
          <Card
            key={w.id}
            variant="solid"
            className="cursor-pointer p-5 transition-shadow hover:shadow-md"
            onClick={() => navigate(`/app/m/atlas.pfm/wallets/${w.id}`)}
          >
            <div className="flex items-start justify-between">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: w.color || "#0ea5e9" }}
              >
                <Wallet className="h-4 w-4" />
              </span>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {w.isOwner && (
                  <>
                    <Button size="icon" variant="ghost" aria-label="Colaboradores" onClick={() => setMembersWallet(w)}>
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => { setEditWallet(w); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Desactivar" onClick={() => setDeactivateTarget(w)}>
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-3 truncate text-sm font-semibold text-[hsl(var(--foreground))]">{w.name}</p>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              {WALLET_KIND_LABEL[w.kind]}
              {w.ledgerAccountId && <Badge variant="outline" className="ml-2">Libro de cuentas</Badge>}
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
              {formatMoney(w.currentBalance, w.currency)}
            </p>
          </Card>
        ))}
      </div>

      <WalletFormSheet open={formOpen} onOpenChange={setFormOpen} wallet={editWallet} />
      <WalletMembersDialog open={Boolean(membersWallet)} onOpenChange={(v) => !v && setMembersWallet(null)} wallet={membersWallet} />
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(v) => !v && setDeactivateTarget(null)}
        title="Desactivar cartera"
        description={`"${deactivateTarget?.name ?? ""}" dejara de aparecer. Sus movimientos se conservan.`}
        confirmLabel="Desactivar"
        onConfirm={async () => { await setEnabled.mutateAsync({ id: deactivateTarget.id, enabled: false }); setDeactivateTarget(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 3:** `node --check` both files — expect no output.
- [ ] **Step 4:** Commit: `git add apps/desktop/src/modules/atlas.pfm/screens/WalletsScreen.jsx apps/desktop/src/modules/atlas.pfm/components/WalletMembersDialog.jsx && git commit -m "feat(pfm-ui): wallets grid + members dialog"`

---

## Task 6: `WalletDetailScreen.jsx`

**Files:** Create `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx`

- [ ] **Step 1: Write the screen**

```jsx
// apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx
import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  PageHeader, Button, Card, EmptyState, ErrorState, LoadingState, SelectField, SearchInput, ConfirmDialog,
} from "@atlas/ui";
import { Plus, ArrowLeft } from "lucide-react";
import {
  useWallet, useWalletMovements, useConfirmMovement, useSkipMovement, useSetMovementEnabled,
} from "../hooks/use-pfm-queries";
import { usePfmCategories } from "../hooks/use-pfm-queries";
import { MovementRow } from "../components/MovementRow";
import { QuickAddMovementSheet } from "../components/QuickAddMovementSheet";
import { formatMoney, currentMonthKey, shiftMonth, formatMonthLabel } from "../lib/format";

export default function WalletDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonthKey());
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const { data: wallet, isLoading, isError, refetch } = useWallet(id);
  const query = useMemo(
    () => ({ month, ...(search ? { search } : {}), ...(categoryId ? { categoryId } : {}), limit: 100 }),
    [month, search, categoryId],
  );
  const { data: movements = [], isLoading: movLoading } = useWalletMovements(id, query);
  const { data: categories = [] } = usePfmCategories();
  const confirmMut = useConfirmMovement();
  const skipMut = useSkipMovement();
  const disableMut = useSetMovementEnabled();

  const [addOpen, setAddOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  if (isLoading) return <div className="p-6"><LoadingState /></div>;
  if (isError || !wallet) return <div className="p-6"><ErrorState title="Cartera no encontrada" onRetry={refetch} /></div>;

  const monthOptions = [0, -1, -2, -3, -4, -5].map((d) => {
    const key = shiftMonth(currentMonthKey(), d);
    return { value: key, label: formatMonthLabel(key) };
  });
  const categoryOptions = [{ value: "", label: "Todas las categorias" }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={wallet.name}
        description={formatMoney(wallet.currentBalance, wallet.currency)}
        actions={
          <Button variant="ghost" onClick={() => navigate("/app/m/atlas.pfm/wallets")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Carteras
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <SelectField label="Mes" options={monthOptions} value={month} onChange={setMonth} />
        <SelectField label="Categoria" options={categoryOptions} value={categoryId} onChange={setCategoryId} />
        <SearchInput placeholder="Buscar comercio o nota" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[180px]" />
      </div>

      <Card variant="solid" className="divide-y divide-[hsl(var(--border))] px-4">
        {movLoading && <div className="py-6"><LoadingState /></div>}
        {!movLoading && movements.length === 0 && (
          <EmptyState title="Sin movimientos" description="Aun no hay movimientos para este filtro." />
        )}
        {movements.map((m) => (
          <MovementRow
            key={`${m.source ?? "native"}-${m.id}`}
            movement={m}
            currency={wallet.currency}
            onEdit={(mv) => { setEditingMovement(mv); setAddOpen(true); }}
            onConfirm={(mv) => setConfirmTarget(mv)}
            onSkip={(mv) => skipMut.mutate({ movementId: mv.id, walletId: wallet.id })}
          />
        ))}
      </Card>

      {!wallet.ledgerAccountId && wallet.canWrite !== false && (
        <button
          type="button"
          onClick={() => { setEditingMovement(null); setAddOpen(true); }}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-(--brand-primary) text-white shadow-lg"
          aria-label="Nuevo movimiento"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <QuickAddMovementSheet
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setEditingMovement(null); }}
        defaultWalletId={wallet.id}
        editingMovement={editingMovement}
      />

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(v) => !v && setConfirmTarget(null)}
        title="Confirmar movimiento"
        description={`Se aplicara ${formatMoney(confirmTarget?.amount, wallet.currency)} al saldo.`}
        confirmLabel="Confirmar"
        onConfirm={async () => { await confirmMut.mutateAsync({ movementId: confirmTarget.id, walletId: wallet.id }); setConfirmTarget(null); }}
      />
    </div>
  );
}
```

Note: editing the confirm amount inline (variable charges) is a Task 8 refinement — Phase 1 confirms at the forecast amount, and the user can edit the movement afterward.

- [ ] **Step 2:** `node --check apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx` — expect no output.
- [ ] **Step 3:** Commit: `git add apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx && git commit -m "feat(pfm-ui): wallet detail with movement list and quick-add FAB"`

---

## Task 7: `OverviewScreen.jsx` + charts

**Files:**
- Create: `apps/desktop/src/modules/atlas.pfm/components/CategoryDonut.jsx`
- Create: `apps/desktop/src/modules/atlas.pfm/components/SpendTrendBar.jsx`
- Create: `apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx`

- [ ] **Step 1: Write `CategoryDonut.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/CategoryDonut.jsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { EmptyState } from "@atlas/ui";
import { formatMoney } from "../lib/format";

export function CategoryDonut({ data, currency }) {
  if (!data || data.length === 0) {
    return <EmptyState title="Sin gastos este mes" description="Registra movimientos para ver el desglose." />;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2}>
            {data.map((entry) => (
              <Cell key={entry.categoryId ?? entry.name} fill={entry.color || "hsl(var(--muted-foreground))"} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatMoney(value, currency), name]}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--popover-foreground))",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write `SpendTrendBar.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/SpendTrendBar.jsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { formatMoney, formatMonthLabel } from "../lib/format";

export function SpendTrendBar({ data, currency }) {
  const rows = (data ?? []).map((d) => ({ ...d, label: formatMonthLabel(d.month) }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            formatter={(value, name) => [formatMoney(value, currency), name === "expense" ? "Gasto" : "Ingreso"]}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Write `OverviewScreen.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx
import { useState } from "react";
import { PageHeader, StatCard, Card, SelectField, LoadingState, ErrorState } from "@atlas/ui";
import { Wallet, TrendingDown, TrendingUp } from "lucide-react";
import { usePfmSummary } from "../hooks/use-pfm-queries";
import { CategoryDonut } from "../components/CategoryDonut";
import { SpendTrendBar } from "../components/SpendTrendBar";
import { formatMoney, currentMonthKey, shiftMonth, formatMonthLabel, percentDelta } from "../lib/format";

export default function OverviewScreen() {
  const [month, setMonth] = useState(currentMonthKey());
  const { data: summary, isLoading, isError, refetch } = usePfmSummary(month);

  const monthOptions = [0, -1, -2, -3, -4, -5].map((d) => {
    const key = shiftMonth(currentMonthKey(), d);
    return { value: key, label: formatMonthLabel(key) };
  });

  const delta = summary ? percentDelta(summary.monthExpense, summary.prevMonthExpense) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="Resumen"
        description="Tus finanzas del mes"
        actions={<SelectField options={monthOptions} value={month} onChange={setMonth} />}
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState title="No se pudo cargar el resumen" onRetry={refetch} />}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Saldo total" value={formatMoney(summary.totalBalance)} icon={Wallet} />
            <StatCard label="Ingresos del mes" value={formatMoney(summary.monthIncome)} icon={TrendingUp} />
            <StatCard label="Gastos del mes" value={formatMoney(summary.monthExpense)} icon={TrendingDown} trend={delta == null ? undefined : -delta} />
            <StatCard label="Mes anterior" value={formatMoney(summary.prevMonthExpense)} icon={TrendingDown} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card variant="solid" className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">Gasto por categoria</h3>
              <CategoryDonut data={summary.byCategory} currency="MXN" />
              <ul className="mt-3 space-y-1">
                {summary.byCategory.map((c) => (
                  <li key={c.categoryId ?? c.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                    <span className="font-medium">{formatMoney(c.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card variant="solid" className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">Tendencia (6 meses)</h3>
              <SpendTrendBar data={summary.trend} currency="MXN" />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
```

Note: the "Proximos cargos" block (spec §9) needs `PfmMovement PENDING` rows across wallets + recurring rules — that data comes with **Phase 2**. Phase 1 Overview omits it.

- [ ] **Step 4:** `node --check` all three files — expect no output.
- [ ] **Step 5:** Commit: `git add apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx apps/desktop/src/modules/atlas.pfm/components/CategoryDonut.jsx apps/desktop/src/modules/atlas.pfm/components/SpendTrendBar.jsx && git commit -m "feat(pfm-ui): overview screen with category donut and spend trend"`

---

## Task 8: Register screens in `ModuleOutlet.jsx`

**Files:** Modify `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1: Add to `SCREEN_MAP`**

In `apps/desktop/src/app/ModuleOutlet.jsx`, after the `atlas.ledger:*` entries block (near line 121), add:

```js
  "atlas.pfm:/overview": lazy(
    () => import("../modules/atlas.pfm/screens/OverviewScreen.jsx"),
  ),
  "atlas.pfm:/wallets": lazy(
    () => import("../modules/atlas.pfm/screens/WalletsScreen.jsx"),
  ),
  "atlas.pfm:/wallets/:id": lazy(
    () => import("../modules/atlas.pfm/screens/WalletDetailScreen.jsx"),
  ),
```

- [ ] **Step 2: Add a `resolveScreen` branch**

In the `resolveScreen(moduleKey, subPath)` function, after the `if (moduleKey === "atlas.ledger") { ... }` block (near line 491), add:

```js
  if (moduleKey === "atlas.pfm") {
    if (subPath === "/" || subPath === "/overview") return SCREEN_MAP["atlas.pfm:/overview"] ?? null;
    if (subPath === "/wallets" || subPath === "/wallets/new") return SCREEN_MAP["atlas.pfm:/wallets"] ?? null;
    if (subPath.startsWith("/wallets/")) return SCREEN_MAP["atlas.pfm:/wallets/:id"] ?? null;
  }
```

- [ ] **Step 3:** `node --check apps/desktop/src/app/ModuleOutlet.jsx` — expect no output.
- [ ] **Step 4:** Commit: `git add apps/desktop/src/app/ModuleOutlet.jsx && git commit -m "feat(pfm-ui): register pfm screens in ModuleOutlet"`

---

## Task 9: Build, lint, and responsive QA

- [ ] **Step 1:** Run `node --test apps/desktop/src/modules/atlas.pfm/__tests__/` — expect PASS (format helpers).
- [ ] **Step 2:** Run `pnpm lint` — no new errors under `apps/desktop/src/modules/atlas.pfm/**` or `apps/desktop/src/app/ModuleOutlet.jsx`.
- [ ] **Step 3:** Run `pnpm build` — success (Vite build resolves all lazy imports).
- [ ] **Step 4:** Start the app (`pnpm dev`), sign in, seed at least one wallet + a few movements.
- [ ] **Step 5:** With the `browser-qa` skill / Playwright MCP, capture screenshots of **Resumen**, **Carteras**, and **Wallet detail** (with the quick-add sheet open) at **390px** and **1440px**. Verify against `docs/ai-context/ui-screen-audit-checklist.md` (14 aspects): PageHeader present, EmptyState/ErrorState wired, no native selects/inputs, bottom sheet not full-bleed on desktop (`sm:max-w-lg sm:mx-auto`), dark-mode donut/bars use `hsl(var(--*))`, FAB not overlapping content, focus-visible rings, no horizontal body scroll.
- [ ] **Step 6:** Fix any issues found; re-screenshot. Commit: `git add -A && git commit -m "fix(pfm-ui): responsive + a11y fixes from 390/1440 QA"`

---

## Task 10: Deferred refinements (tracked, not blocking Phase 1)

Record these in `docs/superpowers/plans/2026-08-30-module-audit-backlog.md` under a new `atlas.pfm` heading (append; do not restructure the file):

- Ledger-account picker in `WalletFormSheet` (link a wallet to an `atlas.ledger` account).
- Inline "+ Crear «X»" category creation from `QuickAddMovementSheet` (`onCreate` -> `atlas.pfm.createCategory` + optimistic select).
- Company-member picker in `WalletMembersDialog` (replace the raw user-id `TextField`; reuse the `ContactPicker` pattern).
- Editable confirm amount for variable pending charges (Phase 2 makes this material).
- Resolve member `userId` to a display name in `WalletMembersDialog` and `MovementRow`.

- [ ] **Step 1:** Append the section, commit: `git add docs/superpowers/plans/2026-08-30-module-audit-backlog.md && git commit -m "docs(pfm): track phase 1 UI deferred refinements"`

---

## Self-Review

- **Spec coverage (§9):** Resumen (stat cards, category donut with `hsl(var(--*))`, 6-month trend, month selector) → Task 7. Carteras (card grid, kind, balance, ledger badge, owner-only actions) → Task 5. Wallet detail (balance, month/category/text filters, native + ledger-mirror movement list, FAB, `< sm` card list via the same `MovementRow`) → Task 6. Quick-add sheet (large amount, Gasto/Ingreso, `CreatableComboboxField` category, wallet, `DateField`, note, single scroll, `sm:max-w-lg sm:mx-auto` so it is not full-bleed on desktop) → Task 4. Sharing UI (members dialog, VIEWER/EDITOR, `ConfirmDialog` for removal) → Task 5. SDK `atlas.pfm.*` consumed via hooks → Task 2. `ConfirmDialog` for every destructive action; no `window.confirm` → Tasks 5, 6. Screen registration → Task 8. "Proximos cargos" block explicitly deferred to Phase 2 (needs recurring data).
- **Placeholder scan:** none — every component has full JSX; deferred items are explicitly listed in Task 10, not left as inline TODOs.
- **Type consistency:** hook names (`useWallets`, `useWallet`, `useWalletMovements`, `usePfmCategories`, `usePfmSummary`, `useCreateMovement`, `useConfirmMovement`, `useSkipMovement`, `useEnrichLedgerMovement`, `useUpsertWalletMember`, `useRemoveWalletMember`) are defined once in Task 2 and imported unchanged in Tasks 3–7. Movement shape (`{ id, walletId, direction, amount, occurredOn, status, source, merchant, note, categoryId }`) matches Plan A2's `normalizeMovement` / `normalizeLedgerRow` output. Summary shape (`{ totalBalance, monthExpense, monthIncome, prevMonthExpense, byCategory:[{categoryId,name,color,total}], trend:[{month,expense,income}] }`) matches Plan A2's `getOverview`. Route paths (`/app/m/atlas.pfm/overview|wallets|wallets/:id`) match the manifest navigation in Plan A1 Task 3.

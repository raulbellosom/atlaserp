# atlas.pfm — Phase 2 — Plan B (Desktop UI: Recurrencias + Proximos cargos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **Recurrencias** screen (list rules, create/edit rule sheet, enable/disable) and a **Proximos cargos** block on the **Resumen** screen (next PENDING movements with an inline Confirmar / Omitir action).

**Architecture:** Continues Phase 1 UI. New hooks in `use-pfm-queries.js` over the SDK `atlas.pfm` recurring + upcoming methods (Plan A). New `RecurringRuleSheet` component and `RecurringScreen`. The Resumen block reuses the existing `MovementRow` for consistency. Registered in `ModuleOutlet.jsx` (`atlas.pfm:/recurring`). `@atlas/ui` only; `ConfirmDialog` for enable/disable and confirm-movement.

**Tech Stack:** React 18, TanStack Query v5, React Hook Form + Zod, `@atlas/ui`, lucide-react, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-31-atlas-pfm-design.md` (section 9 — Recurrencias, "Proximos cargos"). **Prereq:** Phase 2 Plan A merged; API running against a DB with the phase-2 migration.

**QA gate:** screenshot Recurrencias + Resumen (with the block populated) at **390px** and **1440px**; 14-aspect checklist. (Carried on the Phase 1 PFM-5 backlog item if the Playwright bridge is still unavailable.)

---

## File Structure

- `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js` — add `useRecurringRules`, `useUpcoming`, `useCreateRecurringRule`, `useUpdateRecurringRule`, `useSetRecurringRuleEnabled` (modify).
- `apps/desktop/src/modules/atlas.pfm/components/RecurringRuleSheet.jsx` — create/edit rule (create).
- `apps/desktop/src/modules/atlas.pfm/components/UpcomingChargesCard.jsx` — the Resumen block (create).
- `apps/desktop/src/modules/atlas.pfm/screens/RecurringScreen.jsx` — list screen (create).
- `apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx` — mount `UpcomingChargesCard` (modify).
- `apps/desktop/src/app/ModuleOutlet.jsx` — register `atlas.pfm:/recurring` (modify).

---

## Task 1: Hooks

**Files:** `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js` (modify)

- [ ] **Step 1: Add query hooks** (near `usePfmSummary`):

```js
export function useRecurringRules() {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "recurring"],
    queryFn: () => atlas.pfm.listRecurringRules(token),
    enabled: Boolean(token),
    select: (res) => res.data ?? [],
  });
}

export function useUpcoming(days = 14) {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "upcoming", days],
    queryFn: () => atlas.pfm.listUpcoming(token, { days }),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
    select: (res) => res.data ?? [],
  });
}
```

- [ ] **Step 2: Add mutation hooks** (near `useCreateWallet`):

```js
export function useCreateRecurringRule() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: (data) => atlas.pfm.createRecurringRule(data, token),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateRecurringRule() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pfm.updateRecurringRule(id, data, token),
    onSuccess: () => invalidate(),
  });
}

export function useSetRecurringRuleEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, enabled }) => atlas.pfm.setRecurringRuleEnabled(id, enabled, token),
    onSuccess: () => invalidate(),
  });
}
```

`useInvalidatePfm` already invalidates the whole `["pfm"]` tree, so `["pfm","recurring"]` and `["pfm","upcoming",*]` are covered.

- [ ] **Step 3** — `node --check apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js`.
- [ ] **Step 4** — `git add apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js && git commit -m "feat(pfm-ui): recurring + upcoming hooks"`

---

## Task 2: `RecurringRuleSheet.jsx`

**Files:** `apps/desktop/src/modules/atlas.pfm/components/RecurringRuleSheet.jsx` (create)

- [ ] **Step 1: Write the component**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/RecurringRuleSheet.jsx
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Button,
  TextField,
  SelectField,
  ComboboxField,
  DateField,
  CheckboxField,
} from "@atlas/ui";
import {
  useWallets,
  usePfmCategories,
  useCreateRecurringRule,
  useUpdateRecurringRule,
} from "../hooks/use-pfm-queries";
import { todayIso } from "../lib/format";

const FREQ_OPTIONS = [
  { value: "MONTHLY", label: "Cada mes" },
  { value: "WEEKLY", label: "Cada semana" },
  { value: "YEARLY", label: "Cada ano" },
  { value: "DAILY", label: "Cada dia" },
];

const schema = z
  .object({
    walletId: z.string().uuid("Elige una cartera"),
    label: z.string().min(1, "Ponle un nombre").max(120),
    direction: z.enum(["EXPENSE", "INCOME"]),
    amountMode: z.enum(["FIXED", "VARIABLE"]),
    amount: z.coerce.number().positive().optional(),
    freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    interval: z.coerce.number().int().min(1).max(60),
    byMonthDay: z.coerce.number().int().min(1).max(31).optional(),
    autoPost: z.boolean(),
    startOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
    endOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  })
  .refine((v) => v.amountMode !== "FIXED" || (v.amount ?? 0) > 0, {
    message: "Un cargo de monto fijo requiere un monto.",
    path: ["amount"],
  });

function toDefaults(rule, defaultWalletId) {
  if (!rule) {
    return {
      walletId: defaultWalletId ?? "",
      label: "",
      direction: "EXPENSE",
      amountMode: "FIXED",
      amount: "",
      freq: "MONTHLY",
      interval: 1,
      byMonthDay: new Date().getUTCDate(),
      autoPost: false,
      startOn: todayIso(),
      endOn: "",
    };
  }
  return {
    walletId: rule.walletId,
    label: rule.label,
    direction: rule.direction,
    amountMode: rule.amountMode,
    amount: rule.amount ?? "",
    freq: rule.rrule?.freq ?? "MONTHLY",
    interval: rule.rrule?.interval ?? 1,
    byMonthDay: rule.rrule?.byMonthDay ?? new Date().getUTCDate(),
    autoPost: Boolean(rule.autoPost),
    startOn: String(rule.nextRunAt ?? todayIso()).slice(0, 10),
    endOn: rule.endOn ? String(rule.endOn).slice(0, 10) : "",
  };
}

export function RecurringRuleSheet({ open, onOpenChange, rule, defaultWalletId }) {
  const isEdit = Boolean(rule);
  const { data: wallets = [] } = useWallets();
  const [direction, setDirection] = useState("EXPENSE");
  const { data: categories = [] } = usePfmCategories(direction);
  const createMut = useCreateRecurringRule();
  const updateMut = useUpdateRecurringRule();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: toDefaults(null, defaultWalletId) });

  const amountMode = watch("amountMode");
  const freq = watch("freq");

  useEffect(() => {
    if (!open) return;
    const d = toDefaults(rule, defaultWalletId);
    reset(d);
    setDirection(d.direction);
  }, [open, rule, defaultWalletId, reset]);

  // VARIABLE can never auto-post.
  useEffect(() => {
    if (amountMode === "VARIABLE") setValue("autoPost", false);
  }, [amountMode, setValue]);

  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? null);
  useEffect(() => {
    if (open) setCategoryId(rule?.categoryId ?? null);
  }, [open, rule]);

  const walletOptions = wallets.map((w) => ({ value: w.id, label: `${w.name} (${w.currency})` }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  async function onSubmit(v) {
    const payload = {
      walletId: v.walletId,
      label: v.label,
      categoryId: categoryId || null,
      direction: v.direction,
      amountMode: v.amountMode,
      amount: v.amountMode === "FIXED" ? Number(v.amount) : v.amount ? Number(v.amount) : null,
      rrule: {
        freq: v.freq,
        interval: Number(v.interval) || 1,
        ...(v.freq === "MONTHLY" ? { byMonthDay: Number(v.byMonthDay) || 1 } : {}),
      },
      autoPost: v.amountMode === "FIXED" ? Boolean(v.autoPost) : false,
      startOn: v.startOn,
      endOn: v.endOn || null,
    };
    if (isEdit) {
      await updateMut.mutateAsync({
        id: rule.id,
        label: payload.label,
        categoryId: payload.categoryId,
        amount: payload.amount,
        rrule: payload.rrule,
        autoPost: payload.autoPost,
        endOn: payload.endOn,
      });
    } else {
      await createMut.mutateAsync(payload);
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar cargo recurrente" : "Nuevo cargo recurrente"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextField label="Nombre" placeholder="Netflix, Renta, Luz..." error={errors.label?.message} {...register("label")} />
          <Controller
            control={control}
            name="walletId"
            render={({ field }) => (
              <SelectField
                label="Cartera"
                options={walletOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.walletId?.message}
                disabled={isEdit}
              />
            )}
          />
          <Controller
            control={control}
            name="direction"
            render={({ field }) => (
              <SelectField
                label="Tipo"
                options={[
                  { value: "EXPENSE", label: "Gasto" },
                  { value: "INCOME", label: "Ingreso" },
                ]}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  setDirection(v);
                  setCategoryId(null);
                }}
                disabled={isEdit}
              />
            )}
          />
          <ComboboxField
            label="Categoria"
            placeholder="Buscar..."
            options={categoryOptions}
            value={categoryId ?? ""}
            onChange={setCategoryId}
          />
          <Controller
            control={control}
            name="amountMode"
            render={({ field }) => (
              <SelectField
                label="Monto"
                options={[
                  { value: "FIXED", label: "Fijo" },
                  { value: "VARIABLE", label: "Variable (lo confirmo cada vez)" },
                ]}
                value={field.value}
                onChange={field.onChange}
                disabled={isEdit}
              />
            )}
          />
          {amountMode === "FIXED" && (
            <TextField
              label="Cantidad"
              type="number"
              step="0.01"
              inputMode="decimal"
              error={errors.amount?.message}
              {...register("amount")}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={control}
              name="freq"
              render={({ field }) => (
                <SelectField
                  label="Frecuencia"
                  options={FREQ_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <TextField label="Cada" type="number" min="1" {...register("interval")} />
          </div>
          {freq === "MONTHLY" && (
            <TextField label="Dia del mes" type="number" min="1" max="31" {...register("byMonthDay")} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={control}
              name="startOn"
              render={({ field }) => (
                <DateField
                  label="Empieza"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  error={errors.startOn?.message}
                  disabled={isEdit}
                />
              )}
            />
            <Controller
              control={control}
              name="endOn"
              render={({ field }) => (
                <DateField
                  label="Termina (opcional)"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              )}
            />
          </div>
          {amountMode === "FIXED" && (
            <Controller
              control={control}
              name="autoPost"
              render={({ field }) => (
                <CheckboxField
                  label="Registrar automaticamente (sin confirmar)"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          )}
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2** — verify `CheckboxField` is exported from `@atlas/ui` (`grep -n "CheckboxField" packages/ui/src/index.js`). If it is not, use `Checkbox` with a wrapping `<label>` instead (still `@atlas/ui`, never a native `<input type=checkbox>`). Adjust the import + the `autoPost` control accordingly.
- [ ] **Step 3** — `git add apps/desktop/src/modules/atlas.pfm/components/RecurringRuleSheet.jsx && git commit -m "feat(pfm-ui): recurring-rule create/edit sheet"`

---

## Task 3: `RecurringScreen.jsx`

**Files:** `apps/desktop/src/modules/atlas.pfm/screens/RecurringScreen.jsx` (create)

- [ ] **Step 1: Write the screen**

```jsx
// apps/desktop/src/modules/atlas.pfm/screens/RecurringScreen.jsx
import { useState } from "react";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  ConfirmDialog,
} from "@atlas/ui";
import { Plus, Repeat, Pencil, Power } from "lucide-react";
import { useRecurringRules, useSetRecurringRuleEnabled } from "../hooks/use-pfm-queries";
import { RecurringRuleSheet } from "../components/RecurringRuleSheet";
import { formatMoney, formatMonthLabel } from "../lib/format";

const FREQ_LABEL = { DAILY: "dia", WEEKLY: "semana", MONTHLY: "mes", YEARLY: "ano" };

function cadence(rule) {
  const n = rule.rrule?.interval ?? 1;
  const unit = FREQ_LABEL[rule.rrule?.freq] ?? "mes";
  return n === 1 ? `Cada ${unit}` : `Cada ${n} ${unit}s`;
}

export default function RecurringScreen() {
  const { data: rules = [], isLoading, isError, refetch } = useRecurringRules();
  const setEnabled = useSetRecurringRuleEnabled();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Cargos recurrentes"
        description="Suscripciones y pagos fijos"
        actions={
          <Button
            onClick={() => {
              setEditRule(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo
          </Button>
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState title="No se pudieron cargar los cargos recurrentes" onRetry={refetch} />}
      {!isLoading && !isError && rules.length === 0 && (
        <EmptyState
          icon={Repeat}
          title="Sin cargos recurrentes"
          description="Agrega tus suscripciones y pagos fijos para verlos en el calendario y en Proximos cargos."
          action={{ label: "Nuevo cargo recurrente", onClick: () => setSheetOpen(true) }}
        />
      )}

      <div className="space-y-3">
        {rules.map((r) => (
          <Card key={r.id} variant="solid" className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{r.label}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <span>{cadence(r)}</span>
                <span>proximo {String(r.nextRunAt).slice(0, 10)}</span>
                {r.autoPost ? (
                  <Badge variant="secondary">Automatico</Badge>
                ) : (
                  <Badge variant="outline">Requiere confirmar</Badge>
                )}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[hsl(var(--foreground))]">
              {r.amountMode === "FIXED" ? formatMoney(r.amount) : "Variable"}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Editar"
                onClick={() => {
                  setEditRule(r);
                  setSheetOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Desactivar"
                onClick={() => setDisableTarget(r)}
              >
                <Power className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <RecurringRuleSheet open={sheetOpen} onOpenChange={setSheetOpen} rule={editRule} />
      <ConfirmDialog
        open={Boolean(disableTarget)}
        onOpenChange={(v) => !v && setDisableTarget(null)}
        title="Desactivar cargo recurrente"
        description={`"${disableTarget?.label ?? ""}" dejara de generar movimientos y se quitara del calendario.`}
        confirmLabel="Desactivar"
        onConfirm={async () => {
          await setEnabled.mutateAsync({ id: disableTarget.id, enabled: false });
          setDisableTarget(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2** — `git add apps/desktop/src/modules/atlas.pfm/screens/RecurringScreen.jsx && git commit -m "feat(pfm-ui): recurring rules screen"`

---

## Task 4: `UpcomingChargesCard.jsx` + mount on Resumen

**Files:** `apps/desktop/src/modules/atlas.pfm/components/UpcomingChargesCard.jsx` (create), `apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx` (modify)

- [ ] **Step 1: Write `UpcomingChargesCard.jsx`**

```jsx
// apps/desktop/src/modules/atlas.pfm/components/UpcomingChargesCard.jsx
import { useState } from "react";
import { Card, Button, Badge, EmptyState, ConfirmDialog } from "@atlas/ui";
import { Check, SkipForward } from "lucide-react";
import { useUpcoming, useConfirmMovement, useSkipMovement } from "../hooks/use-pfm-queries";
import { formatMoney } from "../lib/format";

export function UpcomingChargesCard() {
  const { data: items = [], isLoading } = useUpcoming(14);
  const confirmMut = useConfirmMovement();
  const skipMut = useSkipMovement();
  const [confirmTarget, setConfirmTarget] = useState(null);

  return (
    <Card variant="solid" className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">
        Proximos cargos (14 dias)
      </h3>
      {!isLoading && items.length === 0 && (
        <EmptyState
          variant="compact"
          title="Nada pendiente por ahora"
        />
      )}
      <ul className="divide-y divide-[hsl(var(--border))]">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                {it.merchant || it.categoryName || "Cargo"}
              </p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <span>{it.occurredOn}</span>
                <span>{it.walletName}</span>
                {it.fromRule && <Badge variant="outline">Recurrente</Badge>}
              </p>
            </div>
            <span
              className={
                it.direction === "EXPENSE"
                  ? "shrink-0 text-sm font-semibold text-red-500"
                  : "shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
              }
            >
              {it.direction === "EXPENSE" ? "-" : "+"}
              {formatMoney(it.amount, it.currency)}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Confirmar"
                onClick={() => setConfirmTarget(it)}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Omitir"
                onClick={() => skipMut.mutate({ movementId: it.id, walletId: it.walletId })}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(v) => !v && setConfirmTarget(null)}
        title="Confirmar cargo"
        description={`Se aplicara ${formatMoney(confirmTarget?.amount, confirmTarget?.currency)} a ${confirmTarget?.walletName ?? ""}.`}
        confirmLabel="Confirmar"
        onConfirm={async () => {
          await confirmMut.mutateAsync({
            movementId: confirmTarget.id,
            walletId: confirmTarget.walletId,
          });
          setConfirmTarget(null);
        }}
      />
    </Card>
  );
}
```

- [ ] **Step 2: Mount it on `OverviewScreen.jsx`** — import it and render it full-width above the two-column chart grid:

```jsx
import { UpcomingChargesCard } from "../components/UpcomingChargesCard";
```

Inside `{summary && ( <> ... </> )}`, right after the stat-card grid `</div>` and before `<div className="mt-6 grid gap-4 lg:grid-cols-2">`:

```jsx
          <div className="mt-6">
            <UpcomingChargesCard />
          </div>
```

- [ ] **Step 3** — `git add apps/desktop/src/modules/atlas.pfm/components/UpcomingChargesCard.jsx apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx && git commit -m "feat(pfm-ui): Proximos cargos block on Resumen"`

---

## Task 5: Register the screen

**Files:** `apps/desktop/src/app/ModuleOutlet.jsx` (modify)

- [ ] **Step 1: Add to `SCREEN_MAP`** (with the other `atlas.pfm:*` entries):

```js
  "atlas.pfm:/recurring": lazy(
    () => import("../modules/atlas.pfm/screens/RecurringScreen.jsx"),
  ),
```

- [ ] **Step 2: Add to the `resolveScreen` `atlas.pfm` branch** (before `return null;`):

```js
    if (subPath === "/recurring") return SCREEN_MAP["atlas.pfm:/recurring"] ?? null;
```

- [ ] **Step 3** — `git add apps/desktop/src/app/ModuleOutlet.jsx && git commit -m "feat(pfm-ui): register recurring screen"`

---

## Task 6: Build + QA

- [ ] **Step 1** — `node --test "apps/desktop/src/modules/atlas.pfm/__tests__/*.test.js"` → still PASS (format helpers, unchanged).
- [ ] **Step 2** — `pnpm --filter @atlas/desktop build:web` → success (new lazy imports resolve).
- [ ] **Step 3** — `pnpm build` → success.
- [ ] **Step 4 (QA)** — start `pnpm dev`, sign in, create a recurring rule (VARIABLE monthly, day = tomorrow), verify a PENDING row appears under the wallet and in Resumen "Proximos cargos"; Confirmar it and watch the balance move; check the "Finanzas personales" calendar in `atlas.calendar` shows the recurring event. Screenshot Recurrencias + Resumen at **390px** and **1440px**; 14-aspect checklist. Fix issues; re-shoot. Commit fixes.

---

## Self-Review

- **Spec coverage (§9):** Recurrencias list (next charge, amount or "Variable", wallet, "Automatico"/"Requiere confirmar" badge) → Task 3. Create/edit form (`CreatableComboboxField`/`ComboboxField` category, `SelectField` frequency, `DateField` start/end, "Registrar automatico" toggle disabled when amount is variable) → Task 2. "Proximos cargos" block on Resumen (next 7-14 days, PENDING movements + rules, each with **Confirmar**) → Task 4, reusing the confirm flow. `ConfirmDialog` for disable + confirm; no native dialogs. Screen registered → Task 5.
- **Placeholder scan:** none — full JSX throughout. Task 2 Step 2 has a genuine conditional (`CheckboxField` vs `Checkbox`) with the concrete fallback spelled out, not a TODO.
- **Type consistency:** hook names (`useRecurringRules`, `useUpcoming`, `useCreateRecurringRule`, `useUpdateRecurringRule`, `useSetRecurringRuleEnabled`) defined in Task 1, used in Tasks 2-4. Rule shape (`{ id, walletId, label, direction, amountMode, amount, rrule:{freq,interval,byMonthDay}, autoPost, nextRunAt, endOn, categoryId }`) matches Plan A's `normalizeRule`. Upcoming item shape (`{ id, walletId, walletName, currency, direction, amount, occurredOn, merchant, categoryName, categoryColor, fromRule }`) matches Plan A's `getUpcoming`. `useConfirmMovement`/`useSkipMovement` are the Phase 1 hooks, unchanged. Route path `/app/m/atlas.pfm/recurring` matches the manifest nav from Phase 1 Plan A1.

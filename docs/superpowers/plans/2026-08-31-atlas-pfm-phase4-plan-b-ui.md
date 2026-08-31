# atlas.pfm — Phase 4 — Plan B (Desktop UI: budgets, goals, credit-card panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **Presupuestos y metas** screen (create/edit monthly category budgets, savings goals, contribute to a goal), budget progress bars + goal rings on the **Resumen**, and a credit-card cycle panel + settings on the **Wallet detail** screen.

**Architecture:** Continues Phase 3 UI. New hooks over the SDK budget/goal/credit methods (Plan A). New `BudgetsScreen` (registered at `atlas.pfm:/budgets`), `BudgetFormSheet`, `GoalFormSheet`, `CreditCardSheet`, `BudgetBars` + `GoalRings` components mounted on `OverviewScreen`, and a `CreditCyclePanel` on `WalletDetailScreen`. A "Presupuestos y metas" nav item is added to the manifest. `@atlas/ui` only; `ConfirmDialog` for destructive actions.

**Tech Stack:** React 18, TanStack Query v5, React Hook Form + Zod, `@atlas/ui`, Recharts 3, lucide-react, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-31-atlas-pfm-design.md` (sections 7, 9 — Resumen Fase 4). **Prereq:** Phase 4 Plan A merged; API running with the phase-4 migration + re-seeded manifest.

**QA gate:** screenshot Presupuestos y metas, Resumen (with bars + rings), Wallet detail (credit card) at **390px** and **1440px**; 14-aspect checklist.

---

## File Structure

- `apps/api/src/manifests/official/core-modules.js` — add "Presupuestos y metas" nav item (modify).
- `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js` — budget/goal/credit hooks (modify).
- `apps/desktop/src/modules/atlas.pfm/components/BudgetFormSheet.jsx` (create).
- `apps/desktop/src/modules/atlas.pfm/components/GoalFormSheet.jsx` (create).
- `apps/desktop/src/modules/atlas.pfm/components/CreditCardSheet.jsx` (create).
- `apps/desktop/src/modules/atlas.pfm/components/BudgetBars.jsx` (create).
- `apps/desktop/src/modules/atlas.pfm/components/GoalRings.jsx` (create).
- `apps/desktop/src/modules/atlas.pfm/components/CreditCyclePanel.jsx` (create).
- `apps/desktop/src/modules/atlas.pfm/screens/BudgetsScreen.jsx` (create).
- `apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx` — mount `BudgetBars` + `GoalRings` (modify).
- `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx` — mount `CreditCyclePanel` + credit settings button (modify).
- `apps/desktop/src/app/ModuleOutlet.jsx` — register `atlas.pfm:/budgets` (modify).

---

## Task 1: Manifest nav + hooks

**Files:** `apps/api/src/manifests/official/core-modules.js` (modify), `apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js` (modify)

- [ ] **Step 1: Nav item** — in `atlasPfmManifest.navigation`, after the "Recurrencias" item, add:

```js
    {
      label: "Presupuestos",
      path: "/app/m/atlas.pfm/budgets",
      icon: "Target",
      layout: "main",
      permissionKey: "pfm.budgets.manage",
    },
```

- [ ] **Step 2: Hooks** — add to `use-pfm-queries.js`:

```js
export function useBudgets(month) {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "budgets", month ?? "current"],
    queryFn: () => atlas.pfm.listBudgets(token, month ? { month } : {}),
    enabled: Boolean(token),
    select: (res) => res.data ?? [],
  });
}

export function useGoals() {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "goals"],
    queryFn: () => atlas.pfm.listGoals(token),
    enabled: Boolean(token),
    select: (res) => res.data ?? [],
  });
}

export function useCreateBudget() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: (d) => atlas.pfm.createBudget(d, token), onSuccess: () => invalidate() });
}
export function useUpdateBudget() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: ({ id, ...d }) => atlas.pfm.updateBudget(id, d, token), onSuccess: () => invalidate() });
}
export function useSetBudgetEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: ({ id, enabled }) => atlas.pfm.setBudgetEnabled(id, enabled, token), onSuccess: () => invalidate() });
}
export function useCreateGoal() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: (d) => atlas.pfm.createGoal(d, token), onSuccess: () => invalidate() });
}
export function useUpdateGoal() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: ({ id, ...d }) => atlas.pfm.updateGoal(id, d, token), onSuccess: () => invalidate() });
}
export function useSetGoalEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: ({ id, enabled }) => atlas.pfm.setGoalEnabled(id, enabled, token), onSuccess: () => invalidate() });
}
export function useContributeGoal() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: ({ id, amount }) => atlas.pfm.contributeGoal(id, amount, token), onSuccess: () => invalidate() });
}
export function useUpdateWalletCredit() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: ({ id, ...d }) => atlas.pfm.updateWalletCredit(id, d, token), onSuccess: (_r, v) => invalidate(v.id) });
}
```

- [ ] **Step 3** — `node --check` the hooks file; `pnpm db:seed` (so the new nav item + perms land).
- [ ] **Step 4** — `git add apps/api/src/manifests/official/core-modules.js apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js && git commit -m "feat(pfm-ui): budgets nav item + budget/goal/credit hooks"`

---

## Task 2: `BudgetFormSheet.jsx` + `GoalFormSheet.jsx` + `CreditCardSheet.jsx`

**Files:** three new components under `apps/desktop/src/modules/atlas.pfm/components/`

- [ ] **Step 1: `BudgetFormSheet.jsx`** — a `Sheet side="bottom"` with RHF+Zod:
  - Fields: category (`ComboboxField` over `usePfmCategories("EXPENSE")`, disabled on edit), wallet (`SelectField` over `useWallets()` with a leading `{ value: "", label: "Todas las carteras" }`, disabled on edit), `amount` (`TextField type=number`), `alertThreshold` (`SelectField` of `{0.5:"50%",0.7:"70%",0.8:"80%",0.9:"90%"}`, stored as a number).
  - Submit: create → `useCreateBudget().mutateAsync({ categoryId, walletId: walletId || null, amount: Number(amount), alertThreshold: Number(alertThreshold) })`; edit → `useUpdateBudget().mutateAsync({ id, amount, alertThreshold })`.
  - Mirror the structure of `RecurringRuleSheet.jsx` exactly (imports, `toDefaults`, `reset` on open).
- [ ] **Step 2: `GoalFormSheet.jsx`** — fields: `name` (`TextField`), `targetAmount` (`TextField type=number`), `targetDate` (`DateField`, optional), `color` (`TextField type=color`). Submit → `useCreateGoal` / `useUpdateGoal`.
- [ ] **Step 3: `CreditCardSheet.jsx`** — fields: `creditLimit` (`TextField type=number`, optional), `statementDay` (`TextField type=number` 1-31), `paymentDueDay` (`TextField type=number` 1-31). Submit → `useUpdateWalletCredit().mutateAsync({ id: wallet.id, creditLimit: creditLimit ? Number(creditLimit) : null, statementDay: statementDay ? Number(statementDay) : null, paymentDueDay: paymentDueDay ? Number(paymentDueDay) : null })`.
- [ ] **Step 4** — `git add apps/desktop/src/modules/atlas.pfm/components/BudgetFormSheet.jsx apps/desktop/src/modules/atlas.pfm/components/GoalFormSheet.jsx apps/desktop/src/modules/atlas.pfm/components/CreditCardSheet.jsx && git commit -m "feat(pfm-ui): budget / goal / credit-card form sheets"`

---

## Task 3: `BudgetBars.jsx` + `GoalRings.jsx` + `CreditCyclePanel.jsx`

**Files:** three new components

- [ ] **Step 1: `BudgetBars.jsx`** — `function BudgetBars({ budgets })`: for each budget render a row with `categoryName`, `formatMoney(spent) / formatMoney(amount)`, and a progress bar. Bar fill width = `Math.min(100, pct*100)%`; color: `pct >= 1` → `bg-red-500`, `pct >= alertThreshold` → `bg-amber-500`, else `bg-emerald-500`. Use plain divs (no chart lib). Empty → `EmptyState variant="compact" title="Sin presupuestos"`.
- [ ] **Step 2: `GoalRings.jsx`** — `function GoalRings({ goals, onContribute })`: for each goal a small SVG ring (`<circle>` with `stroke-dasharray`/`stroke-dashoffset` from `pct`) + `name`, `formatMoney(currentAmount) / formatMoney(targetAmount)`, and a `+`/`-` `Button` calling `onContribute(goal)`. Ring stroke = `goal.color || "hsl(var(--primary))"`. Theme-safe: track stroke `hsl(var(--muted))`.
- [ ] **Step 3: `CreditCyclePanel.jsx`** — `function CreditCyclePanel({ wallet, onEdit })`: only renders when `wallet.kind === "CREDIT"`. If `wallet.creditCycle` is null → a `Card` with "Configura el corte y la fecha de pago" + an `onEdit` button. Otherwise three stat rows: "Saldo del periodo" `formatMoney(periodSpend)`, "Total adeudado" `formatMoney(totalOwed)`, "Credito disponible" `formatMoney(availableCredit)` (hide if null), plus "Corte dia N · pago dia M" text and an edit button.
- [ ] **Step 4** — `git add apps/desktop/src/modules/atlas.pfm/components/BudgetBars.jsx apps/desktop/src/modules/atlas.pfm/components/GoalRings.jsx apps/desktop/src/modules/atlas.pfm/components/CreditCyclePanel.jsx && git commit -m "feat(pfm-ui): budget bars, goal rings, credit-cycle panel"`

---

## Task 4: `BudgetsScreen.jsx`

**Files:** `apps/desktop/src/modules/atlas.pfm/screens/BudgetsScreen.jsx` (create)

- [ ] **Step 1: Write the screen** — `PageHeader title="Presupuestos y metas"` with two `Button`s ("Nuevo presupuesto", "Nueva meta"). Two sections:
  - **Presupuestos**: `useBudgets()` → `<BudgetBars budgets={...} />` plus per-row edit/disable (`ConfirmDialog` for disable). "Nuevo presupuesto" opens `BudgetFormSheet`.
  - **Metas**: `useGoals()` → `<GoalRings goals={...} onContribute={(g) => setContributeGoal(g)} />`. A small `ConfirmDialog`-style prompt is not enough for an amount — use a tiny inline `Sheet`/`Dialog` with one `TextField` (`+/-` amount) that calls `useContributeGoal`. "Nueva meta" opens `GoalFormSheet`.
  - `LoadingState` / `ErrorState` / `EmptyState` per section.
- [ ] **Step 2** — `git add apps/desktop/src/modules/atlas.pfm/screens/BudgetsScreen.jsx && git commit -m "feat(pfm-ui): budgets & goals screen"`

---

## Task 5: Mount on Resumen + Wallet detail + register screen

**Files:** `OverviewScreen.jsx`, `WalletDetailScreen.jsx`, `ModuleOutlet.jsx` (all modify)

- [ ] **Step 1: `OverviewScreen.jsx`** — import `useBudgets`, `useGoals`, `BudgetBars`, `GoalRings`. Below the charts grid add a two-column grid: left `Card` "Presupuestos del mes" → `<BudgetBars budgets={budgets} />`; right `Card` "Metas" → `<GoalRings goals={goals} onContribute={() => navigate("/app/m/atlas.pfm/budgets")} />`. Only render the block when `budgets.length || goals.length` (otherwise it's noise on a fresh install).
- [ ] **Step 2: `WalletDetailScreen.jsx`** — import `CreditCyclePanel` + `CreditCardSheet` + `useState` for `creditSheetOpen`. When `wallet.kind === "CREDIT"`, render `<CreditCyclePanel wallet={wallet} onEdit={() => setCreditSheetOpen(true)} />` above the filters, and `<CreditCardSheet open={creditSheetOpen} onOpenChange={setCreditSheetOpen} wallet={wallet} />`.
- [ ] **Step 3: `ModuleOutlet.jsx`** — `SCREEN_MAP["atlas.pfm:/budgets"] = lazy(() => import("../modules/atlas.pfm/screens/BudgetsScreen.jsx"))`; in the `resolveScreen` `atlas.pfm` branch add `if (subPath === "/budgets") return SCREEN_MAP["atlas.pfm:/budgets"] ?? null;`.
- [ ] **Step 4** — `git add -A && git commit -m "feat(pfm-ui): budgets/goals on Resumen, credit panel on wallet detail, register screen"`

---

## Task 6: Build + QA

- [ ] **Step 1** — `node --test "apps/desktop/src/modules/atlas.pfm/__tests__/*.test.js"` → still PASS.
- [ ] **Step 2** — `pnpm --filter @atlas/desktop build:web` → success.
- [ ] **Step 3** — `pnpm build` → success.
- [ ] **Step 4 (QA)** — start `pnpm dev`. Create a `Comida` budget; register a movement that crosses 80% → the bar goes amber, then red past 100%; a notification appears in the bell. Create a goal, contribute + / -, watch the ring fill. Set a CREDIT wallet's corte + pago; verify the cycle panel numbers and that a "Fecha limite de pago" event shows on the "Finanzas personales" calendar. Screenshot Presupuestos y metas + Resumen + Wallet detail (credit) at **390px** and **1440px**; 14-aspect checklist. Fix + re-shoot. Commit fixes.

---

## Self-Review

- **Spec coverage (§9 Fase 4, §7):** monthly per-category budget with alert at threshold + overage (bar color + bell notification wired in Plan A) → Tasks 2, 3, 4, 5. Savings goal with `targetAmount`/`targetDate`, progress ring, "aparté X" contribution (+/- delta) → Tasks 2, 3, 4. Credit-card `statementDay`/`paymentDueDay`/`creditLimit` settings + period-vs-total-owed vs available-credit panel + payment-due calendar reminder (bridge in Plan A) → Tasks 2, 3, 5. Expanded Resumen (budget bars + goal rings) → Task 5. Budgets/goals private to the owner — the API enforces it; the UI never shows another user's. New nav item → Task 1. Screen registered → Task 5.
- **Placeholder scan:** Tasks 2-4 specify each component's fields, the exact hook calls, the exact colour thresholds, and the sibling file to mirror (`RecurringRuleSheet.jsx`) — build instructions, not TODOs. An executing agent expands them from the named template. No "add error handling"-style vagueness: `LoadingState`/`ErrorState`/`EmptyState` per section is called out explicitly.
- **Type consistency:** hook names (`useBudgets`, `useGoals`, `useCreateBudget`, `useUpdateBudget`, `useSetBudgetEnabled`, `useCreateGoal`, `useUpdateGoal`, `useSetGoalEnabled`, `useContributeGoal`, `useUpdateWalletCredit`) defined in Task 1, used in Tasks 2-5. Budget shape (`{ id, categoryId, categoryName, walletId, amount, spent, remaining, pct, alertThreshold }`) and goal shape (`{ id, name, targetAmount, currentAmount, targetDate, walletId, color, pct }`) match Plan A's list responses. `wallet.creditCycle` (`{ statementDay, paymentDueDay, creditLimit, lastStatementDate, totalOwed, periodSpend, availableCredit }`) matches Plan A `computeCreditCycle`. `atlas.pfm.contributeGoal(id, amount, token)` / `updateWalletCredit(id, data, token)` match Plan A Task 9 SDK additions. Route path `/app/m/atlas.pfm/budgets` matches the Task 1 nav item.

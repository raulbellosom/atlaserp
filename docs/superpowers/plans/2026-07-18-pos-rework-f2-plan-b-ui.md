# POS Rework F2 — Plan B (UI): Comandero Móvil

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-18-pos-rework-f2-comandero-design.md` (sections 8, 9, 23, 25)
**Depends on:** Plan A (`2026-07-18-pos-rework-f2-plan-a-api.md`) — modifier routes/SDK live.

**Goal:** A waiter on a phone runs the full comanda flow: floor → mesa → comensales → productos con modificadores/notas por asiento → cocina → cuenta/cobro. Admins manage modifiers from a new Administración tab.

**Architecture:** `ComanderoScreen` stops being a re-export and renders the existing tables floor in "comandero mode" (table tap → `/pos/comandero/mesa/:tableId`). New `ComandaScreen` orchestrates existing hooks (`usePosOrder*`) plus new modifier hooks. New components stay under 300 lines each: `SeatChips`, `ModifierSheet`, `ComandaLineList`, `PosModifiersTab`. `PaymentDialog`/`SplitBillDialog` are reused untouched.

**Tech Stack:** React + react-router, TanStack Query, `@atlas/ui` only (no native inputs), Tailwind mobile-first.

**Conventions:** Work on `main`. Commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. UI Spanish.

**Facts discovered 2026-07-18 (use, don't re-derive):**
- `PosTablesScreen.jsx` navigates via `navigateToOrder(table)` → `/pos/terminal?order=<id>` (lines ~258-266; creates the order first for available tables via `useCreatePosOrder`).
- Hooks already exist in `usePosOrder.js`: `usePosOrder(id)`, `useCreatePosOrder`, `useAddPosOrderLine`, `useUpdatePosOrderLine`, `useDeletePosOrderLine`, `useAddPosGuest`, `useSendToKitchen`, `useAddPosPayment`, `useOrderSeatTotals`, `useCancelPosOrder`.
- Product data comes from `usePosCatalog.js`; product grid visual = `components/ProductGrid.jsx` (128 lines).
- `LineEditSheet.jsx` (198 lines) edits qty/note; has no seat selector yet.
- Auth pattern: `useAuth()` from `apps/desktop/src/auth/AuthProvider.jsx`; permission = `userProfile?.isAdmin || (userProfile?.permissions ?? []).includes(key)`.
- Dynamic route params: check how `ModuleOutlet.jsx` resolves param routes (e.g. `atlas.files` detail) and register `/pos/comandero/mesa/:tableId` the same way.
- Dev outlet "El Pitillal" has `allowTableCharge = true` and payment method "Efectivo · CASH".

---

## File Structure Map

- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosModifiers.js`
- Create: `apps/desktop/src/modules/atlas.pos/components/PosModifiersTab.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx` (mount new tab)
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx` (optional `comanderoMode` prop)
- Modify: `apps/desktop/src/modules/atlas.pos/screens/ComanderoScreen.jsx` (real screen)
- Create: `apps/desktop/src/modules/atlas.pos/screens/ComandaScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/SeatChips.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/ModifierSheet.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/ComandaLineList.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/components/LineEditSheet.jsx` (seat select)
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx` (param route)

---

### Task 1: Modifier hooks

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosModifiers.js`

- [ ] **Step 1:** Create the hooks file following `usePosOrder.js` conventions (`useToken`, `atlas.pos.*`, query invalidation):

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { atlas } from '../../../lib/atlas'          // match the exact import used by usePosOrder.js
import { useToken } from '../../../auth/AuthProvider' // match the exact hook used by usePosOrder.js
import { toast } from '../../../lib/toast'           // match sibling usage

export function useProductModifierGroups(productId, { includeDisabled = false } = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['pos', 'modifiers', 'product', productId, includeDisabled],
    queryFn: () => atlas.pos.listProductModifierGroups(productId, includeDisabled ? { includeDisabled: true } : {}, token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token) && Boolean(productId),
  })
}

export function useModifierGroupsByProducts(productIds = []) {
  const token = useToken()
  const key = [...productIds].sort().join(',')
  return useQuery({
    queryKey: ['pos', 'modifiers', 'bulk', key],
    queryFn: () => atlas.pos.listModifierGroups({ productIds: key }, token),
    select: (res) => res?.data ?? res,
    enabled: Boolean(token) && productIds.length > 0,
    staleTime: 60 * 1000,
  })
}

function useInvalidateModifiers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['pos', 'modifiers'] })
}

export function useCreateModifierGroup() {
  const token = useToken()
  const invalidate = useInvalidateModifiers()
  return useMutation({
    mutationFn: ({ productId, data }) => atlas.pos.createModifierGroup(productId, data, token),
    onSuccess: () => { invalidate(); toast.success('Grupo creado') },
    onError: (err) => toast.error(err?.message ?? 'Error al crear el grupo'),
  })
}

export function useUpdateModifierGroup() {
  const token = useToken()
  const invalidate = useInvalidateModifiers()
  return useMutation({
    mutationFn: ({ id, data }) => atlas.pos.updateModifierGroup(id, data, token),
    onSuccess: () => { invalidate(); toast.success('Grupo actualizado') },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar el grupo'),
  })
}

export function useCreateModifierOption() {
  const token = useToken()
  const invalidate = useInvalidateModifiers()
  return useMutation({
    mutationFn: ({ groupId, data }) => atlas.pos.createModifierOption(groupId, data, token),
    onSuccess: () => { invalidate(); toast.success('Opción creada') },
    onError: (err) => toast.error(err?.message ?? 'Error al crear la opción'),
  })
}

export function useUpdateModifierOption() {
  const token = useToken()
  const invalidate = useInvalidateModifiers()
  return useMutation({
    mutationFn: ({ id, data }) => atlas.pos.updateModifierOption(id, data, token),
    onSuccess: () => { invalidate(); toast.success('Opción actualizada') },
    onError: (err) => toast.error(err?.message ?? 'Error al actualizar la opción'),
  })
}
```

Fix the three import paths to whatever `usePosOrder.js` actually uses (read it first). Note the SDK signature `listProductModifierGroups(productId, query, token)`.

- [ ] **Step 2:** `node --check` is not applicable to JSX-less hooks but run the build later; commit:

```bash
git add apps/desktop/src/modules/atlas.pos/hooks/usePosModifiers.js
git commit -m "feat(pos): add modifier catalog hooks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Administración → Modificadores tab

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/PosModifiersTab.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx`

- [ ] **Step 1: Component.** Self-contained tab (~250 lines target): left = product picker (reuse the POS products query from `usePosCatalog.js` — read it for the hook name; searchable list with `Input`), right = the selected product's groups (`useProductModifierGroups(productId, { includeDisabled: true })`) each rendered as a `Card` with name, badges (`requerido`, `mín/máx`, `Activa/Inactiva`), inline options list (name + `+$delta` + enabled switch) and actions. Dialogs (manage open state with `useState`; `@atlas/ui` `Dialog` + `TextField`/`SwitchField`/`Input`):
  - "Nuevo grupo": name, minSelect, maxSelect, required switch → `useCreateModifierGroup`.
  - "Editar grupo": same fields + enabled switch → `useUpdateModifierGroup`.
  - "Nueva opción": name, priceDelta → `useCreateModifierOption`.
  - Option row inline toggle → `useUpdateModifierOption({ enabled })`; warn with `toast` when disabling the last enabled option of a `required` group (spec edge case 2): "El grupo requerido quedará sin opciones y se omitirá en validación."
  - Empty states with `EmptyState` ("Selecciona un producto", "Este producto no tiene grupos").
- [ ] **Step 2: Mount.** In `PosSettingsScreen.jsx` add tab "Modificadores" after "Métodos de pago", rendering `<PosModifiersTab />`. Keep the screen under 1000 lines (it is 818; the tab itself lives in the component file).
- [ ] **Step 3:** `pnpm.cmd --filter @atlas/desktop build:web` clean; commit:

```bash
git add apps/desktop/src/modules/atlas.pos/components/PosModifiersTab.jsx apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx
git commit -m "feat(pos): manage product modifier groups from Administracion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Comandero floor mode + route

**Files:**
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/ComanderoScreen.jsx`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1:** `PosTablesScreen` accepts an optional prop: `export default function PosTablesScreen({ comanderoMode = false })`. In `navigateToOrder(table)` (~line 258): when `comanderoMode`, ALWAYS `navigate(\`/app/m/atlas.pos/pos/comandero/mesa/${table.id}\`)` and return (no order creation here — ComandaScreen owns that). Everything else (mis-mesas, reservations, claim panel) stays shared. Do not change default behavior when the prop is absent (spec acceptance 7).
- [ ] **Step 2:** `ComanderoScreen.jsx` replaces its re-export:

```jsx
import PosTablesScreen from "./PosTablesScreen.jsx";

// Comandero post: the shared floor in comandero mode — table taps open the mobile comanda editor.
export default function ComanderoScreen() {
  return <PosTablesScreen comanderoMode />;
}
```

- [ ] **Step 3:** Register the param route in `ModuleOutlet.jsx`. First read how existing dynamic paths resolve (search `:` patterns / `resolveScreen`); register `atlas.pos:/pos/comandero/mesa/:tableId` → lazy `ComandaScreen.jsx` (create a placeholder screen file now: `export default function ComandaScreen(){ return null }` so the build passes; Task 4 fills it). If exact-match `SCREEN_MAP` doesn't support params, follow the same mechanism `atlas.files` uses for `/files/:id`.
- [ ] **Step 4:** Build clean; commit:

```bash
git add apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx apps/desktop/src/modules/atlas.pos/screens/ComanderoScreen.jsx apps/desktop/src/modules/atlas.pos/screens/ComandaScreen.jsx apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(pos): route comandero floor taps to the comanda editor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: ComandaScreen + SeatChips + ComandaLineList

**Files:**
- Create/fill: `apps/desktop/src/modules/atlas.pos/screens/ComandaScreen.jsx` (orchestrator, ≤300 lines)
- Create: `apps/desktop/src/modules/atlas.pos/components/SeatChips.jsx`
- Create: `apps/desktop/src/modules/atlas.pos/components/ComandaLineList.jsx`

- [ ] **Step 1: `SeatChips.jsx`:**

```jsx
import { Plus } from "lucide-react";
import { Button } from "@atlas/ui";

// Horizontal seat selector. guests: [{id,label}], activeSeatId: uuid|null (null = Compartido)
export default function SeatChips({ guests = [], activeSeatId, onSelect, onAddGuest, addingGuest }) {
  const chip = (selected) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
      selected
        ? "border-transparent bg-foreground text-background"
        : "border-border bg-background text-foreground hover:bg-muted"
    }`;
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 [-webkit-overflow-scrolling:touch]">
      <button type="button" className={chip(activeSeatId === null)} onClick={() => onSelect(null)}>
        Compartido
      </button>
      {guests.map((g) => (
        <button key={g.id} type="button" className={chip(activeSeatId === g.id)} onClick={() => onSelect(g.id)}>
          {g.label}
        </button>
      ))}
      <Button variant="outline" size="sm" className="shrink-0 rounded-full px-2.5" onClick={onAddGuest} disabled={addingGuest} title="Agregar comensal">
        <Plus size={14} />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: `ComandaLineList.jsx`:** groups lines by `guestSeatId` (sections: each guest label, then "Compartido" for null) using the hydrated order (`order.guests`, `order.lines` — each line now has `modifiers` and `note` from Plan A). Each line row: name + qty ×, modifier names (`text-xs text-muted-foreground`, one per line prefixed "· "), note in italics, line total, and a tap → `onEditLine(line)`. Status chip per line if the line has a kitchen status field (check the hydrated line shape; if none, omit). Empty state: `EmptyState` "Agrega productos para comenzar". Keep ≤200 lines.
- [ ] **Step 3: `ComandaScreen.jsx`** (orchestrator). Structure (read `PosTerminalScreen.jsx` first and mirror its data patterns):

1. `const { tableId } = useParams()`; load floor/table context minimally: `usePosOrders({ tableId, status: "OPEN" })` if the API supports `tableId` filter — CHECK `listOrders` query params in `pos-routes.js`/service; if unsupported, load the table's active order the same way `PosTablesScreen.navigateToOrder` finds `existingOrder` (reuse that lookup via floor detail hook `usePosFloorDetail`).
2. If no open order: render table header + `SeatChips` disabled + product grid; first product add (or "Iniciar comanda" button) calls `useCreatePosOrder` with `{ outletId, tableId, fulfillmentType: "DINE_IN" }` mirroring the exact payload `PosTablesScreen` uses today (copy it), then proceeds. F1 auto-claims the table on creation.
3. State: `activeSeatId` (default null), `modifierSheetProduct` (product|null), `editingLine` (line|null), `payOpen`.
4. Product grid: reuse `ProductGrid` with the same props the terminal passes (read them); on product tap → if bulk modifiers map (`useModifierGroupsByProducts(productIds)`) has groups for it → `setModifierSheetProduct(product)`; else `useAddPosOrderLine().mutate({ orderId, data: { productId, quantity: 1, guestSeatId: activeSeatId } })`.
5. `onAddGuest`: `useAddPosGuest().mutate({ orderId, data: { label: \`Persona ${order.guests.length + 1}\` } })` (auto-creates the order first if needed).
6. Bottom bar (sticky, `pb-[env(safe-area-inset-bottom)]`): total from hydrated order; buttons: "Enviar a cocina" (`useSendToKitchen`, disabled when no pending lines), and "Cobrar" (opens `PaymentDialog` exactly as the terminal does, minus any session context) only when the outlet allows table charge — read the outlet flag from the floor/outlet data already available (`usePosFloorDetail` outlet or a `usePosOutlets` hook — check what exists in `usePosSettings.js`); otherwise show "Pedir cuenta" (existing request-bill action in the terminal — reuse the same mutation, find it in `PosTerminalScreen`).
7. Read-only mode: when `!["DRAFT","OPEN","SENT"].includes(order.status)` — check real editable statuses in `assertEditableOrder` (`service-helpers.js` or order service) and mirror them — render a status banner and disable all mutations.
8. `LineEditSheet` opens for `editingLine` (Task 5 extends it with seats); deletion via `useDeletePosOrderLine` behind `ConfirmDialog`.

- [ ] **Step 4:** Build clean; manual smoke (dev server, phone viewport in devtools): floor → mesa → chips render. Commit:

```bash
git add apps/desktop/src/modules/atlas.pos/screens/ComandaScreen.jsx apps/desktop/src/modules/atlas.pos/components/SeatChips.jsx apps/desktop/src/modules/atlas.pos/components/ComandaLineList.jsx
git commit -m "feat(pos): add mobile comanda editor with seat chips and grouped lines

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: ModifierSheet + LineEditSheet seat select

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/ModifierSheet.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/components/LineEditSheet.jsx`

- [ ] **Step 1: `ModifierSheet.jsx`** (bottom sheet; ≤250 lines). Props: `{ open, onOpenChange, product, groups, guests, activeSeatId, onSubmit, submitting }`. Internals:
  - Local state: `selected` (Map groupId → Set of optionIds), `quantity` (min 1), `note`, `seatId` (init from `activeSeatId`).
  - Per group: title + helper "(elige mín X, máx Y)"; `maxSelect === 1` → single-select behavior (tapping an option replaces the group's selection; tapping again clears it when not required); else multi-select capped at `maxSelect` (ignore extra taps + subtle toast).
  - Option row: name left, `+$X.XX` right when `priceDelta > 0`, selected style `border-foreground bg-muted`.
  - Price preview: `base + Σ selected deltas` × quantity, live.
  - Seat select: `SelectField` with "Compartido" + guests.
  - Note: `TextareaField` max 500.
  - Footer: "Agregar $<total>" `Button` disabled while any `required` group with enabled options has fewer than `max(1, minSelect)` selections, or `submitting`.
  - `onSubmit({ modifiers: [{ optionId }...], quantity, note, guestSeatId: seatId })`.
- [ ] **Step 2:** Wire in `ComandaScreen`: `onSubmit` → `useAddPosOrderLine().mutate({ orderId, data: { productId: product.id, quantity, note, guestSeatId, modifiers } })`, close on success.
- [ ] **Step 3: `LineEditSheet.jsx`:** add a seat `SelectField` ("Compartido" + guests, current value from `line.guestSeatId`) whose change is included in the existing update payload (`guestSeatId`) — the backend already accepts it in `updateOrderLineSchema`. Accept a new optional `guests` prop; when absent (terminal usage), hide the field so the terminal remains unchanged.
- [ ] **Step 4:** Build clean; commit:

```bash
git add apps/desktop/src/modules/atlas.pos/components/ModifierSheet.jsx apps/desktop/src/modules/atlas.pos/components/LineEditSheet.jsx apps/desktop/src/modules/atlas.pos/screens/ComandaScreen.jsx
git commit -m "feat(pos): modifier selection sheet and per-seat line editing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Playwright QA (mobile) + TASKS.md

- [ ] **Step 1:** With `pnpm dev` running and the QA harness pattern from the stabilization session (persistent context + qa-creds), at viewport **390×844**:

1. Admin (desktop viewport is fine): Administración → Modificadores → on "Gordita de chicharron" create group "Salsa" (min 1, max 2, requerido) with options "Verde" (+$0) and "Extra queso" (+$10). Screenshot.
2. Mobile: `/pos/comandero` → floor renders → tap Mesa 1 (available) → comanda editor opens.
3. Add "Persona 2" via chips; select it; tap "Gordita de chicharron" → ModifierSheet opens; verify "Agregar" is disabled until a Salsa option is chosen; pick "Extra queso"; note "aparte la salsa"; Agregar.
4. Verify the line renders under "Persona 2" with "· Extra queso" and the note, and the sticky total = $35.00 (25 + 10).
5. "Enviar a cocina" → toast success (station default fallback from F1 config may 400 if the product still lacks a station AND the outlet has no default station — if so, set the outlet's "Estación de cocina por defecto" in Administración first, then retry; record what was needed).
6. "Cobrar" → "Dividir cuenta" → two cards (Persona 2 = $35.00; any unassigned lines under "Sin asignar") — pay all seats with Efectivo → order closes, table → Sucia on the floor.
7. Legacy check: `/pos/tables` tap still goes to the terminal.

Record pass/fail + screenshots per step. Delete qa-creds and the browser profile afterwards.

- [ ] **Step 2:** Update `docs/TASKS.md` atlas.pos section:

```markdown
- [x] F2-B Comandero móvil: floor en modo comandero, editor de comandas (asientos, modificadores, notas), tab Modificadores en Administración, cobro en mesa vía corte de mesero
```

(check the two pending seat-UI items from the stabilization list as resolved by this phase, updating their text), plus a `Verified:` line with real evidence. Commit:

```bash
git add docs/TASKS.md
git commit -m "docs(tasks): record POS rework F2-B completion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

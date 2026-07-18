# POS Rework F1 — Plan B (UI): Role-Post Navigation Skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-17-pos-role-based-rework-design.md` (sections 8, 9, 16)
**Depends on:** Plan A (`2026-07-17-pos-rework-f1-plan-a-api.md`) — permissions seeded, outlet flags in DB.

**Goal:** The module opens by work post (Caja, Comandero, Cocina, Órdenes, Administración) with permission-based landing; existing screens are mounted under the new routes as F1 placeholders (real Caja/Comandero UX arrive in F2/F3), and Administración can edit the new outlet flags.

**Architecture:** Navigation replacement in the manifest + thin wrapper screens re-exporting current screens + a landing redirect by permission priority. No behavioral rewrite of the wrapped screens in this phase.

**Tech Stack:** React + react-router, `@atlas/ui`, manifest navigation resolution, TanStack Query.

**Conventions:** Work directly on `main`. Commits end with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer. UI text in Spanish.

---

## File Structure Map

- Modify: `apps/api/src/manifests/official/core-modules.js` (posMap `navigation` — 5 entries)
- Create: `apps/desktop/src/modules/atlas.pos/screens/CajaScreen.jsx` (wrapper)
- Create: `apps/desktop/src/modules/atlas.pos/screens/ComanderoScreen.jsx` (wrapper)
- Create: `apps/desktop/src/modules/atlas.pos/screens/CocinaScreen.jsx` (wrapper)
- Create: `apps/desktop/src/modules/atlas.pos/screens/PosAdminScreen.jsx` (wrapper + flags)
- Create: `apps/desktop/src/modules/atlas.pos/screens/PosHomeRedirect.jsx` (permission landing)
- Create: `apps/desktop/src/modules/atlas.pos/components/OutletFlagsFields.jsx`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx` (new route keys; legacy keys kept)
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx` (mount OutletFlagsFields in the outlet form)

---

### Task 1: Manifest navigation by posts

**Files:**
- Modify: `apps/api/src/manifests/official/core-modules.js`

- [ ] **Step 1: Replace the 7-entry `navigation` array of posMap with:**

```js
  navigation: [
    {
      label: "Caja",
      path: "/app/m/atlas.pos/pos/caja",
      icon: "BadgeDollarSign",
      layout: "main",
      permissionKey: "pos.caja.read",
    },
    {
      label: "Comandero",
      path: "/app/m/atlas.pos/pos/comandero",
      icon: "Armchair",
      layout: "main",
      permissionKey: "pos.comandas.read",
    },
    {
      label: "Cocina",
      path: "/app/m/atlas.pos/pos/cocina",
      icon: "ChefHat",
      layout: "main",
      permissionKey: "pos.cocina.read",
    },
    {
      label: "Ordenes",
      path: "/app/m/atlas.pos/pos/orders",
      icon: "ReceiptText",
      layout: "main",
      permissionKey: "pos.orders.read",
    },
    {
      label: "Administracion",
      path: "/app/m/atlas.pos/pos/admin",
      icon: "Settings",
      layout: "main",
      permissionKey: "pos.admin.read",
    },
  ],
```

- [ ] **Step 2: Reseed so navigation updates**

```bash
pnpm.cmd db:seed
node --test apps/api/src/manifests/official/__tests__/atlas-pos-contract.test.js
```

The contract test asserts the OLD paths (`/pos/terminal`, `/pos/tables`, `/pos/stations`, `/pos/settings`) — update those assertions to the five new paths above. Expected: pass after update.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/manifests/official/core-modules.js apps/api/src/manifests/official/__tests__/atlas-pos-contract.test.js
git commit -m "feat(pos): replace terminal-centric navigation with role posts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Wrapper screens + landing redirect

**Files:**
- Create: 5 screens listed in the File Structure Map

- [ ] **Step 1: Create the four wrappers.** Each is a thin re-export so F2/F3/F4 can replace internals without touching routing:

`CajaScreen.jsx`:
```jsx
// F1 placeholder: Caja post mounts the existing terminal experience.
// F3 replaces this with the dedicated Caja/Mostrador UX.
export { default } from "./PosTerminalScreen.jsx";
```

`ComanderoScreen.jsx`:
```jsx
// F1 placeholder: Comandero post mounts the tables floor.
// F2 replaces this with the mobile comanda editor.
export { default } from "./PosTablesScreen.jsx";
```

`CocinaScreen.jsx`:
```jsx
// F1 placeholder: Cocina post mounts the stations board.
// F4 replaces this with the KDS.
export { default } from "./PosStationsScreen.jsx";
```

`PosAdminScreen.jsx`:
```jsx
// F1: Administracion post mounts the existing settings screen (incl. outlet flags).
export { default } from "./PosSettingsScreen.jsx";
```

- [ ] **Step 2: Create `PosHomeRedirect.jsx`** — landing by permission priority (Caja → Comandero → Cocina → Órdenes → Admin). Check how other screens read permissions (`useAuth()` exposes the profile; find the exact permission-check helper used by `Topbar`/navigation gating — likely `hasPermission` from the auth context or `userProfile.permissions.includes(...)` — and reuse it verbatim):

```jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext"; // adjust to the real path used by sibling screens

const POSTS = [
  { perm: "pos.caja.read", to: "/app/m/atlas.pos/pos/caja" },
  { perm: "pos.comandas.read", to: "/app/m/atlas.pos/pos/comandero" },
  { perm: "pos.cocina.read", to: "/app/m/atlas.pos/pos/cocina" },
  { perm: "pos.orders.read", to: "/app/m/atlas.pos/pos/orders" },
  { perm: "pos.admin.read", to: "/app/m/atlas.pos/pos/admin" },
];

export default function PosHomeRedirect() {
  const { hasPermission } = useAuth();
  const target = POSTS.find((p) => hasPermission(p.perm));
  return <Navigate to={target?.to ?? "/app/m/atlas.pos/pos/orders"} replace />;
}
```

- [ ] **Step 3: Register routes in `ModuleOutlet.jsx`** (keep ALL existing `atlas.pos:` keys so old links keep working; change only `atlas.pos:/` and add the new ones):

```js
  "atlas.pos:/": lazy(() => import("../modules/atlas.pos/screens/PosHomeRedirect.jsx")),
  "atlas.pos:/pos/caja": lazy(() => import("../modules/atlas.pos/screens/CajaScreen.jsx")),
  "atlas.pos:/pos/comandero": lazy(() => import("../modules/atlas.pos/screens/ComanderoScreen.jsx")),
  "atlas.pos:/pos/cocina": lazy(() => import("../modules/atlas.pos/screens/CocinaScreen.jsx")),
  "atlas.pos:/pos/admin": lazy(() => import("../modules/atlas.pos/screens/PosAdminScreen.jsx")),
```

- [ ] **Step 4: Build check**

```bash
pnpm.cmd --filter @atlas/desktop build:web
```

Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/screens/CajaScreen.jsx apps/desktop/src/modules/atlas.pos/screens/ComanderoScreen.jsx apps/desktop/src/modules/atlas.pos/screens/CocinaScreen.jsx apps/desktop/src/modules/atlas.pos/screens/PosAdminScreen.jsx apps/desktop/src/modules/atlas.pos/screens/PosHomeRedirect.jsx apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(pos): mount role-post routes with wrapper screens and permission landing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Outlet flags editor in Administración

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/components/OutletFlagsFields.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx` (outlet create/edit form in the "Sucursales y terminales" tab)

- [ ] **Step 1: Create the reusable fields component** (controlled, parent owns state):

```jsx
import { CheckboxField, SelectField } from "@atlas/ui";

export default function OutletFlagsFields({ value, onChange, stations = [] }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <CheckboxField
        label="Permitir cobro en mesa"
        description="Los meseros pueden cobrar desde su dispositivo; el efectivo se concilia con un corte de mesero."
        checked={Boolean(value.allowTableCharge)}
        onChange={(checked) => set({ allowTableCharge: checked })}
      />
      <SelectField
        label="Estación de cocina por defecto"
        placeholder="Sin estación por defecto"
        value={value.defaultStationId ?? ""}
        onChange={(v) => set({ defaultStationId: v || null })}
        options={[
          { value: "", label: "Sin estación por defecto" },
          ...stations.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <CheckboxField
        label="Pantalla de cocina (KDS)"
        checked={Boolean(value.kitchenKdsEnabled)}
        onChange={(checked) => set({ kitchenKdsEnabled: checked })}
      />
      <CheckboxField
        label="Impresión de comandas"
        checked={Boolean(value.kitchenPrintEnabled)}
        onChange={(checked) => set({ kitchenPrintEnabled: checked })}
      />
    </div>
  );
}
```

Adjust `CheckboxField`/`SelectField` prop names to the real `@atlas/ui` signatures (check `packages/ui/src/components/FormFields.jsx` — e.g. it may use `onCheckedChange` or `onValueChange`); do not switch to native inputs.

- [ ] **Step 2: Mount it** inside the outlet edit dialog/form of `PosSettingsScreen.jsx` ("Sucursales y terminales" tab): locate the outlet form state object, spread the four flags into its initial value from the loaded outlet, render `<OutletFlagsFields value={form} onChange={setForm} stations={stationsForOutlet} />` under the existing fields, and include the four keys in the `atlas.pos.updateOutlet` payload (SDK method exists; Plan A extended `updateOutletSchema` to accept them). Load stations with the existing stations query already used by the Estaciones tab.

- [ ] **Step 3: Manual check** — `pnpm dev`, open Administración → Sucursales, edit an outlet: toggle "Permitir cobro en mesa", save, reload, confirm persistence (network PATCH 200 and value retained).

- [ ] **Step 4: Build + commit**

```bash
pnpm.cmd --filter @atlas/desktop build:web
git add apps/desktop/src/modules/atlas.pos/components/OutletFlagsFields.jsx apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx
git commit -m "feat(pos): edit outlet behavior flags from Administracion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Browser QA + docs

- [ ] **Step 1: QA with `pnpm dev`** (Playwright harness from the stabilization session or manual):

1. Open `/app/m/atlas.pos` as admin → lands on Caja (highest post permission held).
2. Sidebar shows exactly: Caja, Comandero, Cocina, Ordenes, Administracion.
3. `/pos/terminal`, `/pos/tables`, `/pos/sessions`, `/pos/settings`, `/pos/floor-planner`, `/pos/stations` legacy URLs still render their screens.
4. Comandero opens the floor with no terminal/session gate.
5. Outlet flag toggled in QA step (Task 3) persists.

- [ ] **Step 2: Update `docs/TASKS.md`** atlas.pos section:

```markdown
- [x] F1-B Role-post navigation: Caja/Comandero/Cocina/Ordenes/Administracion routes, permission landing, outlet flags UI
```

plus a `Verified:` line with the real commands/QA notes. Commit:

```bash
git add docs/TASKS.md
git commit -m "docs(tasks): record POS rework F1-B completion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

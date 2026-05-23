# Custom Module UI v2 — Sidebar Submenus and Tab Bar Redesign

Date: 2026-05-23
Status: Draft
Author: Claude (claude-sonnet-4-6)
Spec file: docs/superpowers/specs/2026-05-23-custom-modules-ui-v2-navigation-design.md
Plan file: docs/superpowers/plans/2026-05-23-custom-modules-ui-v2-navigation.md

---

## 1. Feature title

Custom Module UI v2 — Sidebar Submenus and Tab Bar Redesign

## 2. Status

Draft

## 3. Context

Atlas ERP custom modules (AME3) render their views through `BlueprintCrudScreen` and `ModuleSidebar`. The only deployed custom module is `custom.fleet`, which exposes four navigation groups:

- **Vehículos** — single CRUD view
- **Reportes** — four sub-views (Mantenimiento, Servicio, Reparación, Otro) rendered via an in-page pill-tab bar
- **Choferes** — single CRUD view
- **Catálogos** — four sub-views (Tipos de vehículo, Marcas, Modelos, Tipos de mantenimiento) rendered via an in-page pill-tab bar

The current in-page tab mechanism works (routes, logic, grouping) but the UI quality is poor and the UX pattern is inconsistent with professional ERP desktop apps. This spec defines the v2 navigation architecture for all current and future AME3 custom modules, establishing `custom.fleet` as the reference implementation.

## 4. Problem

Four specific defects in the current navigation UI:

1. **Wrong tab placement**: In `BlueprintCrudScreen`, the tab bar renders BEFORE the `PageHeader` (title, description, action button). The user sees floating pills → then the page title → then the table. This is visually inverted. The natural reading order for an ERP screen is: title → sub-navigation → content.

2. **Wrong tab visual style**: Tabs use `rounded-full` pill buttons — the same visual language as filter chips. Pill tabs are appropriate for filtering within a single dataset, not for switching between distinct top-level sections. Professional ERP navigation tabs use an underline indicator or a bordered tab bar.

3. **No sidebar affordance for grouped sections**: The sidebar shows `Reportes` and `Catálogos` as plain flat nav items identical to `Vehículos`. There is no visual signal that these sections contain sub-views. Users discover the tabs only after clicking the parent item — a discoverability failure.

4. **Sidebar does not support nested items**: The `ModuleSidebar` component only renders a flat list. The navigation contract in module manifests has no `children` field. This forces sub-views to rely on in-page tabs even when sidebar nesting would be more appropriate.

## 5. Goals

1. `ModuleSidebar` renders collapsible nested navigation groups when a nav item declares `children` in its manifest.
2. The AME3 module manifest navigation contract is extended with an optional `children` field (array of child nav items, identical shape to parent items minus `children`).
3. For nav items with `children`, the sidebar renders the parent as an expandable group header — automatically expanded when any child path is active, collapsed otherwise. Clicking the group header toggles expansion.
4. In-page tab bars in `BlueprintCrudScreen` are replaced by a redesigned **underline tab bar** that renders BELOW the `PageHeader` title row, not above it.
5. When a nav item has `children` in the manifest, the in-page tab bar is NOT rendered for that section — the sidebar IS the navigation, eliminating duplication.
6. The `custom.fleet` manifest is updated to use `children` for `Reportes` and `Catálogos`, making the fleet module the canonical reference for future AME3 modules.
7. In collapsed sidebar mode, parent items with children show a tooltip popout menu with child items on hover.
8. The redesigned tab bar is visually consistent with the flat design system (underline, module accent color, no shadows/gradients).

## 6. Non-goals

1. No Prisma schema or migration changes.
2. No API endpoint changes.
3. No changes to the blueprint, ORM, or AME3 core runtime (module-engine package).
4. No redesign of the AppShell global sidebar (the one that shows all modules — this spec covers only the ModuleSidebar that appears within a module's own context).
5. No new permissions or RBAC changes.
6. No dark mode redesign (dark mode will inherit automatically from Tailwind CSS variables).
7. No legacy module screens (contacts, finance, HR, files) — those are out of scope.
8. No responsive mobile breakpoint redesign beyond ensuring the sidebar submenu works on the existing mobile drawer pattern.
9. No animation changes beyond what is necessary for the expand/collapse behavior.
10. No removal of the tab bar fallback for AME3 modules that do NOT use sidebar children.

## 7. User stories

- As a Fleet operator, I want the sidebar to show me the sub-sections of Reportes and Catálogos without having to click first, so I can navigate directly without an extra step.
- As a Fleet operator, I want the tab area on a page to appear after the page title, not before it, so the visual hierarchy makes sense.
- As a Fleet operator, I want navigation tabs to look like ERP navigation (underline style) rather than filter pills, so the interface feels professional.
- As an AME3 module developer, I want to declare `children` in my module manifest to get sidebar submenus automatically, without writing custom navigation components.
- As a mobile user, I want the sidebar submenu groups to work in the mobile drawer without blocking my view of the nav items.

## 8. UX requirements

### 8.1 Sidebar submenu behavior

- A nav item with `children` renders as a **group header**: icon + label + `ChevronDown` / `ChevronRight` indicator on the right.
- The group header is NOT a navigation link (clicking it only toggles expand/collapse, does not navigate).
- If any child path matches `currentPath`, the group auto-expands on mount and stays expanded while that path is active.
- If no child path matches, the group is collapsed by default.
- Child items render indented (8px left padding beyond the parent's icon column), without their own icons (or with a 4px dot indicator), at 32px height (vs parent 36px).
- Active child uses the same border-left + background-tint pattern as the current active item style, but inherits the module color.
- In **collapsed sidebar** (desktop `lg:w-14`): group headers show only their icon. On hover, a popout flyout menu appears to the right of the sidebar, listing child items as click targets. The flyout dismisses on mouse leave.
- In **mobile drawer** (full-width overlay): groups behave identically to expanded desktop mode; the chevron toggle works normally.

### 8.2 Tab bar redesign

- Tab bar renders AFTER the `PageHeader` block and BEFORE the `AtlasCrudView` block.
- Tab style: horizontal list of text labels with a `2px` colored bottom border on the active tab (using module color). Inactive tabs: `text-muted-foreground`, no border. Hover: `text-foreground`.
- Tab bar is separated from the page content below by a `1px border-bottom` full-width divider on the container, then `16px` gap before the table.
- Tab bar does NOT have a background fill — it is transparent against the page background.
- Tab bar container: `flex gap-0`, tabs use `px-4 py-2.5` with `text-sm font-medium`, no `rounded-full`, no border on individual tabs.
- Transition on active state: 150ms ease for color change. No animated indicator sliding (static bottom border per tab, no underline animation).
- When `groupedTabs` is null (no tabs), this section renders nothing — no empty space.

### 8.3 Tab suppression

- `BlueprintCrudScreen` checks whether the current nav item has `children` in the active module's navigation manifest.
- If `children` exist for the matching nav item AND the current path matches a child path, the in-page tab bar is NOT rendered (the sidebar handles navigation).
- The `resolveGroupedTabs` logic and all existing PAGE grouping infrastructure remains intact as a fallback for modules that do not use sidebar children.

### 8.4 Visual design tokens

Consistent with the design system established for Atlas ERP:
- Active tab border: `module.color` (the per-module accent color, e.g., fleet uses its configured color)
- Inactive tab text: `hsl(var(--muted-foreground))`
- Hover tab text: `hsl(var(--foreground))`
- Tab bar bottom border divider: `hsl(var(--border))`
- Submenu child active background: `${module.color}14` (same as current nav item active tint)
- Submenu child active border-left: `2px solid ${module.color}`
- Submenu group header hover: `hsl(var(--muted))`
- Chevron icon: 14px, `text-muted-foreground`, rotates 180deg when open

### 8.5 Loading and empty states

- Submenu groups show no additional loading state — they render from the manifest (already available synchronously in `ModuleSidebar`).
- If a group has `children: []` (empty array), it renders as a plain nav item (fallthrough to current flat behavior).
- If a group header is collapsed and the user navigates to a child path via deep link or back button, the group auto-expands.

## 9. Routes/screens

No new routes are introduced. The existing routes remain identical.

| Route | Screen | Module | Change |
|---|---|---|---|
| /app/m/custom.fleet/reports/maintenance | BlueprintCrudScreen | custom.fleet | Tab bar suppressed (sidebar submenu handles nav) |
| /app/m/custom.fleet/reports/service | BlueprintCrudScreen | custom.fleet | Tab bar suppressed |
| /app/m/custom.fleet/reports/repair | BlueprintCrudScreen | custom.fleet | Tab bar suppressed |
| /app/m/custom.fleet/reports/other | BlueprintCrudScreen | custom.fleet | Tab bar suppressed |
| /app/m/custom.fleet/catalogs/vehicle-types | BlueprintCrudScreen | custom.fleet | Tab bar suppressed |
| /app/m/custom.fleet/catalogs/vehicle-brands | BlueprintCrudScreen | custom.fleet | Tab bar suppressed |
| /app/m/custom.fleet/catalogs/vehicle-models | BlueprintCrudScreen | custom.fleet | Tab bar suppressed |
| /app/m/custom.fleet/catalogs/maintenance-types | BlueprintCrudScreen | custom.fleet | Tab bar suppressed |

## 10. Data model

N/A — this feature involves no data models or database changes.

## 11. Prisma impact

New models: N/A
Modified models: N/A
New migration required: No
Migration safety notes: N/A

## 12. API contract

N/A — this feature involves no new or modified API endpoints.

## 13. SDK contract

N/A — this feature involves no new SDK methods.

## 14. Validator contract

N/A — this feature involves no new Zod schemas.

## 15. Module manifest impact

The AME3 custom module navigation contract (`navigation` array in `defineAtlasModule`) is extended:

### Extended nav item shape

```js
{
  label: "Reportes",            // required — Spanish UI label
  path: "/reports",             // required — base path (used for active matching on parent)
  icon: "ClipboardList",        // required — Lucide icon name
  layout: "main",               // required
  permissionKey: "fleet.reports.read",  // required
  children: [                   // optional — if present, renders as sidebar submenu group
    {
      label: "Mantenimiento",
      path: "/reports/maintenance",     // relative to module root
      permissionKey: "fleet.reports.read",
    },
    {
      label: "Servicio",
      path: "/reports/service",
      permissionKey: "fleet.reports.read",
    },
    // ...
  ]
}
```

Child nav items have: `label`, `path`, `permissionKey`. They do NOT have `icon`, `layout`, or `children` (no deeper nesting — max 2 levels).

### custom.fleet manifest changes

Navigation updated to:

```js
navigation: [
  {
    label: "Vehiculos",
    path: "/app/m/custom.fleet/vehicles",
    icon: "Truck",
    layout: "main",
    permissionKey: "fleet.vehicles.read",
  },
  {
    label: "Reportes",
    path: "/app/m/custom.fleet/reports",
    icon: "ClipboardList",
    layout: "main",
    permissionKey: "fleet.reports.read",
    children: [
      { label: "Mantenimiento", path: "/app/m/custom.fleet/reports/maintenance", permissionKey: "fleet.reports.read" },
      { label: "Servicio",      path: "/app/m/custom.fleet/reports/service",      permissionKey: "fleet.reports.read" },
      { label: "Reparacion",    path: "/app/m/custom.fleet/reports/repair",       permissionKey: "fleet.reports.read" },
      { label: "Otro",          path: "/app/m/custom.fleet/reports/other",        permissionKey: "fleet.reports.read" },
    ],
  },
  {
    label: "Choferes",
    path: "/app/m/custom.fleet/drivers",
    icon: "UserCheck",
    layout: "main",
    permissionKey: "fleet.drivers.read",
  },
  {
    label: "Catalogos",
    path: "/app/m/custom.fleet/catalogs",
    icon: "BookOpen",
    layout: "main",
    permissionKey: "fleet.catalogs.read",
    children: [
      { label: "Tipos de vehiculo",    path: "/app/m/custom.fleet/catalogs/vehicle-types",      permissionKey: "fleet.catalogs.read" },
      { label: "Marcas",               path: "/app/m/custom.fleet/catalogs/vehicle-brands",     permissionKey: "fleet.catalogs.read" },
      { label: "Modelos",              path: "/app/m/custom.fleet/catalogs/vehicle-models",     permissionKey: "fleet.catalogs.read" },
      { label: "Tipos de mantenimiento", path: "/app/m/custom.fleet/catalogs/maintenance-types", permissionKey: "fleet.catalogs.read" },
    ],
  },
]
```

## 16. Navigation impact

No new navigation items. The `custom.fleet` manifest is restructured (same items, new `children` field). No `packages/maps/` changes required (this is an AME3 module in `modules/custom/`).

## 17. Blueprint impact

N/A — no blueprint changes required.

## 18. RBAC/permissions

No new permissions. All child nav items reuse the parent's `permissionKey`. The sidebar must respect `permissionKey` on child items — if the user lacks that permission, the child item is hidden (same logic as current flat items).

| Permission key | Behavior |
|---|---|
| fleet.reports.read | Gates all four report child items |
| fleet.catalogs.read | Gates all four catalog child items |

## 19. Multi-company behavior

N/A — this feature is UI-only with no data queries.

## 20. Files/storage impact

N/A

## 21. Export/import requirements

N/A

## 22. Audit log requirements

N/A — navigation interactions are not audited.

## 23. Edge cases

1. **Deep link to child path when group is collapsed**: When user arrives at `/reports/maintenance` via URL (not sidebar click), the `Reportes` group must auto-expand to show `Mantenimiento` as active. This is handled by the mount-time path matching logic in the sidebar.

2. **Collapsed sidebar hover popout dismissed before click**: The flyout for collapsed sidebar must remain visible long enough to allow the user to move the mouse from the sidebar icon to the flyout items. Use a 150ms close delay (mouseLeave timeout) to prevent premature dismissal.

3. **Tab bar fallback for modules without children**: Modules that do NOT declare `children` continue to use the existing `resolveGroupedTabs` logic. The tab bar still renders — but now below the PageHeader. Backwards compatibility is preserved.

4. **navigating to parent group path (e.g., `/reports`)**: The fleet manifest's `Reportes` group header path is `/app/m/custom.fleet/reports`. If a user navigates there directly, `BlueprintCrudScreen` will attempt to render it. The sidebar should auto-redirect to the first child. This is the existing `groupedTabs.shouldRedirect` logic — it continues to function as before.

5. **Sidebar collapsed state + active child**: When the sidebar is collapsed and a child route is active, the parent group icon must show the active color treatment (the module color border-left + tint) even though child labels are hidden.

6. **Empty children array**: If `children: []` is declared, the nav item falls through to flat rendering (no chevron, no expand behavior).

7. **Child paths that do not match any blueprint**: If a child path has no corresponding blueprint, `BlueprintCrudScreen` shows the existing "Vista no encontrada" empty state. The sidebar still renders the child item.

8. **Permission filtering on children**: If all children of a group are hidden due to permissions, the group header itself must be hidden.

## 24. Risks

1. **Risk**: `ModuleSidebar` is consumed in `packages/ui` and rendered by `apps/desktop`. Adding popout flyout behavior requires JavaScript state that may conflict with SSR or Tauri contexts. **Mitigation**: The popout is pure client-side hover state, no SSR concern. Tauri uses the same Vite/React bundle as the web preview.

2. **Risk**: The sidebar popout flyout for collapsed mode adds complexity (positioning, z-index, mouse tracking). If it proves fragile, it can be deferred — collapsed mode with children can fall back to a tooltip that lists child names without being clickable. **Mitigation**: Mark the flyout as Phase 2 of this feature (see Section 28). Phase 1 delivers only the expanded-mode sidebar submenu.

3. **Risk**: Removing the in-page tab bar for fleet's report and catalog sections could confuse users who have already learned the current UI. **Mitigation**: The sidebar sub-items are always visible (auto-expanded when active) and provide the same navigation targets. The transition is unambiguous.

4. **Risk**: `BlueprintCrudScreen` is already 830+ lines (approaching the 1000-line soft limit). Adding tab suppression logic may push it closer to the limit. **Mitigation**: The suppression logic is a single `useMemo` derived from existing manifest data — fewer than 15 lines. No refactor needed for this feature.

## 25. Acceptance criteria

1. Given the `custom.fleet` module manifest with `children` on `Reportes`, when the user opens the Fleet module sidebar, then `Reportes` renders as a group header with a chevron icon.
2. Given the Fleet sidebar with `Reportes` group collapsed, when the user is on `/reports/maintenance`, then `Reportes` auto-expands and `Mantenimiento` shows as the active child item.
3. Given the Fleet sidebar with `Reportes` group expanded, when the user clicks `Servicio`, then navigation occurs to `/reports/service` and `Servicio` shows as active.
4. Given the user is on `/reports/maintenance`, when the `BlueprintCrudScreen` renders, then NO in-page tab bar (pill or underline) is rendered.
5. Given an AME3 module WITHOUT `children` in its nav items, when the user navigates to a route with `groupedTabs`, then the tab bar renders BELOW the PageHeader using the underline style.
6. Given the redesigned underline tab bar renders, when the active tab is visible, then the active tab has a `2px` colored bottom border using the module color, and no `rounded-full` or filled background.
7. Given the collapsed sidebar (desktop), when the user hovers over a group header icon with children, then a flyout popout appears listing the child items as navigation links. *(Phase 2 — see Section 28)*
8. Given all four catalog child paths in the fleet manifest, when the user has `fleet.catalogs.read`, then all four child items are visible in the `Catálogos` group.
9. Given a user WITHOUT `fleet.catalogs.read`, when the sidebar renders, then the `Catálogos` group header is hidden.
10. Given `pnpm build` runs after all changes, then no TypeScript/JSX errors are produced.

## 26. Verification plan

- `pnpm build` — builds clean, no errors
- `pnpm lint` — no lint errors
- Manual: open Fleet module in browser at `http://localhost:5173`, confirm:
  - `Reportes` shows chevron in sidebar
  - Clicking `Reportes` group header expands children
  - Clicking a child navigates correctly and shows active state
  - No in-page tab bar on `/reports/maintenance`
  - No in-page tab bar on `/catalogs/vehicle-types`
  - `Catálogos` sidebar group works identically to Reportes
- Manual: navigate directly to `/app/m/custom.fleet/reports/service` via URL bar — confirm group auto-expands
- Manual: collapse the sidebar — confirm active child path still shows module color on parent icon

## 27. Rollback plan

All changes are frontend-only (no migrations, no API). Rollback = revert the Git commit(s). No data impact. Module disable path: not applicable (this is a UI change, not a module feature).

If the fleet manifest `children` changes cause issues, the manifest can be reverted to the flat structure in under 5 minutes — the sidebar and screen components degrade gracefully (empty `children` → flat nav item behavior).

## 28. Future enhancements

1. **Collapsed sidebar flyout popout** (deferred from Phase 1): When the sidebar is in `lg:w-14` collapsed mode and the user hovers over a group header icon, show a floating flyout to the right listing child items. This requires z-index management and mouse-tracking.
2. **3-level navigation**: Allow `children` items to have their own `children` for 3-level deep hierarchies. Not needed for fleet; reserved for complex future modules.
3. **Animated underline indicator**: Implement a sliding animated indicator under the active tab that moves between tabs. Requires CSS `transform: translateX` on a pseudo-element overlay.
4. **Tab scrolling for many tabs**: If a module has 8+ tabs, the tab bar should scroll horizontally with fade masks at edges.
5. **Extend to AppShell global sidebar**: Apply the same submenu pattern to the global module navigation (the outer AppShell sidebar that lists all installed modules), not just the per-module ModuleSidebar.

# Custom Module UI v2 — Sidebar Submenus and Tab Bar Redesign — Implementation Plan

Date: 2026-05-23
Spec: docs/superpowers/specs/2026-05-23-custom-modules-ui-v2-navigation-design.md
Status: Draft

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until spec and plan are approved. Mark each task `[x]` only after validation commands pass.

## Goal

Replace the current in-page pill-tab navigation for grouped AME3 module views with a sidebar submenu system. Extend the `ModuleSidebar` component to render collapsible nested nav groups. Update `BlueprintCrudScreen` to suppress in-page tabs when sidebar children handle navigation, and reposition+redesign the tab bar (underline style, after PageHeader) as a fallback for modules that still use it. Update `custom.fleet` manifest to use children for Reportes and Catálogos as the canonical reference.

## Architecture summary

Three layers of change:

1. **`packages/ui` — ModuleSidebar**: Add submenu rendering. Nav items with `children` render as expand/collapse group headers. Active child detection on mount drives auto-expand. Uses `useState` for per-group open state, initialized from `currentPath` matching.

2. **`apps/desktop` — BlueprintCrudScreen**: (a) Detect if the active nav item has `children` using a `useMemo` derived from the module navigation manifest. (b) If yes, suppress the tab bar. (c) Reorder the render: `PageHeader` first, then tab bar (if any), then `AtlasCrudView`. (d) Redesign tab bar from pill buttons to underline style.

3. **`modules/custom/custom.fleet` — module manifest**: Add `children` to `Reportes` and `Catálogos` nav items. The four existing page definitions for reports and catalogs require no changes — routes and blueprints are unaffected.

No API, Prisma, SDK, or validator changes required.

---

## File Structure Map

### Create

_(none)_

### Modify

- `packages/ui/src/components/ModuleSidebar.jsx` — add submenu/children rendering
- `apps/desktop/src/shell/BlueprintCrudScreen.jsx` — tab suppression + reposition + redesign
- `modules/custom/custom.fleet/module.manifest.js` — add children to Reportes and Catálogos nav items

---

## Task 1 — Extend ModuleSidebar with submenu/children support

**Files:**
- Modify: `packages/ui/src/components/ModuleSidebar.jsx`

**Changes:**

Add support for nav items with a `children` array. Group headers are non-navigable collapse toggles. Child items render indented below. Auto-expand on mount when any child path matches `currentPath`.

**Detailed implementation:**

```
1. Add ChevronDown to the lucide-react import block.

2. After building `navItems` (line 113), derive `initialOpenGroups`:
   - For each navItem that has children.length > 0, check if any child.fullPath
     matches currentPath (starts-with check). If yes, mark that group as initially open.
   - Shape: Set<string> of navItem.fullPath values that should be open.

3. Add `const [openGroups, setOpenGroups] = useState(initialOpenGroups)`.

4. When rendering navItems, branch on whether `item.children?.length > 0`:
   a. NO children → current flat button (no change).
   b. HAS children → render group header + collapsible children.

5. Group header element:
   - Same base className as current nav button (h-9, rounded-lg, px-2.5, gap-2.5, text-sm).
   - Active detection: isGroupActive = some child fullPath matches activeFullPath.
   - Active style: same border-left + background tint using module.color (same as current item active).
   - Right side: ChevronDown (14px) that rotates 0deg when closed, 180deg when open.
     transition: rotate 200ms ease.
   - Clicking calls: setOpenGroups(prev => new Set with group toggled).
   - cursor-pointer.

6. Children render (inside a div that transitions height):
   - Use: max-h-0 overflow-hidden → max-h-96 when open. transition: max-height 200ms ease.
   - OR simpler: conditional render with {isOpen && <div>...</div>} (no animation, simpler).
   - Each child item:
     - pl-[calc(0.625rem+15px+0.625rem+8px)] = left-pad to align with icon column of parent
       (px-2.5 = 10px, icon = 15px, gap-2.5 = 10px, indent = 8px → total: 43px left padding)
     - h-8 (32px, smaller than parent 36px)
     - text-sm (same size, slightly lighter weight: font-normal vs parent font-medium)
     - No icon — just a label with a 4px wide dot marker (optional) or pure label
     - Active: same border-left + tint using module.color
     - Hover: bg-[hsl(var(--muted))]
     - onClick: onNavigate(child.fullPath)
     - Active detection: child.fullPath === activeFullPath OR currentPath.startsWith(child.fullPath + "/")

7. Collapsed sidebar (lg:w-14) behavior for groups:
   - Group header shows only the icon (same as current flat items — label fades out).
   - Chevron is hidden when collapsed (included in the fade-out block).
   - Children are hidden when collapsed (the children container collapses too).
   - Tooltip on the group header icon (title attr) shows the group label, same as current items.
   - NOTE: Flyout popout is deferred to Phase 2 (spec section 28). Phase 1 = icon only with title tooltip.

8. Build `childNavItems` the same way `navItems` are built:
   - fullPath = item.path (children already have absolute paths in the fleet manifest).
   - Filter by permissionKey if a permission check utility is available
     (current sidebar does not permission-filter items — keep consistent, no change).
```

**Validation:**
```
pnpm build
pnpm lint
```
Manual: open Fleet in browser, confirm Reportes group expands/collapses, active child highlights.

---

## Task 2 — Redesign and reposition tab bar in BlueprintCrudScreen

**Files:**
- Modify: `apps/desktop/src/shell/BlueprintCrudScreen.jsx`

**Changes:**

Two sub-changes: (a) move tab bar below PageHeader, (b) replace pill style with underline style, (c) add sidebar-children suppression.

**Detailed implementation:**

```
Sub-change A — Tab suppression detection (add near the groupedTabs useMemo, ~line 550):

  const navItemHasChildren = useMemo(() => {
    if (!module?.navigation || !routeInfo?.collectionPath) return false;
    const moduleRoot = getModuleRootPath(moduleKey);
    return module.navigation.some((navItem) => {
      if (!navItem.children?.length) return false;
      // Check if current path matches any child of this group
      return navItem.children.some((child) => {
        const childFull = child.path;
        const norm = normalizePath(pathname);
        return norm === normalizePath(childFull) || norm.startsWith(normalizePath(childFull) + "/");
      });
    });
  }, [module, moduleKey, routeInfo, pathname]);

  // Suppress in-page tabs when sidebar handles navigation
  const showTabBar = groupedTabs?.tabs?.length > 0 && !navItemHasChildren;

Sub-change B — Reorder render (lines ~753-790):

  Current order:
    1. Tab bar (pill buttons) ← WRONG POSITION
    2. PageHeader
    3. AtlasCrudView

  New order:
    1. PageHeader (unchanged)
    2. Tab bar (underline style, only if showTabBar)
    3. AtlasCrudView

Sub-change C — Redesign tab bar markup (replace the entire groupedTabs conditional block):

  Replace:
    <div className="flex flex-wrap items-center gap-2">
      {groupedTabs.tabs.map(...rounded-full pill...)}
    </div>

  With:
    {showTabBar ? (
      <div className="border-b border-[hsl(var(--border))]">
        <div className="flex items-end gap-0 -mb-px">
          {groupedTabs.tabs.map((tab) => {
            const isActive = tab.path === groupedTabs.activePath;
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`
                  px-4 py-2.5 text-sm font-medium transition-colors duration-150
                  border-b-2 whitespace-nowrap cursor-pointer
                  ${isActive
                    ? "text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] border-b-transparent hover:text-[hsl(var(--foreground))]"
                  }
                `}
                style={isActive ? { borderBottomColor: module?.color ?? "hsl(var(--primary))" } : {}}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    ) : null}

Note: The outer div has border-b (full-width divider), inner div uses -mb-px trick so active tab's
border-bottom overlaps the divider cleanly (standard CSS underline tab pattern).
```

**Validation:**
```
pnpm build
pnpm lint
```
Manual:
- On a fleet reports page: no tab bar rendered (suppressed by sidebar children).
- On a route that STILL uses tabs (e.g., a hypothetical module without children): tab bar renders below PageHeader with underline style.

---

## Task 3 — Update custom.fleet manifest to use sidebar children

**Files:**
- Modify: `modules/custom/custom.fleet/module.manifest.js`

**Changes:**

Add `children` arrays to the `Reportes` and `Catalogos` navigation entries. Remove any tab-enabling `tabLabel`/`tabOrder` metadata from page definitions IF they are now exclusively navigated via sidebar (optional cleanup — the existing page definitions are unaffected if kept).

**Detailed implementation:**

In the `navigation` array of `defineAtlasModule`, update:

```js
// BEFORE
{
  label: "Reportes",
  path: "/app/m/custom.fleet/reports",
  icon: "ClipboardList",
  layout: "main",
  permissionKey: "fleet.reports.read",
},

// AFTER
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
```

```js
// BEFORE
{
  label: "Catalogos",
  path: "/app/m/custom.fleet/catalogs",
  icon: "BookOpen",
  layout: "main",
  permissionKey: "fleet.catalogs.read",
},

// AFTER
{
  label: "Catalogos",
  path: "/app/m/custom.fleet/catalogs",
  icon: "BookOpen",
  layout: "main",
  permissionKey: "fleet.catalogs.read",
  children: [
    { label: "Tipos de vehiculo",       path: "/app/m/custom.fleet/catalogs/vehicle-types",       permissionKey: "fleet.catalogs.read" },
    { label: "Marcas",                  path: "/app/m/custom.fleet/catalogs/vehicle-brands",      permissionKey: "fleet.catalogs.read" },
    { label: "Modelos",                 path: "/app/m/custom.fleet/catalogs/vehicle-models",      permissionKey: "fleet.catalogs.read" },
    { label: "Tipos de mantenimiento",  path: "/app/m/custom.fleet/catalogs/maintenance-types",   permissionKey: "fleet.catalogs.read" },
  ],
},
```

Also verify: the `Catalogos` sidebar nav item currently points to `/app/m/custom.fleet/catalogs/vehicle-types` as its path. Update it to `/app/m/custom.fleet/catalogs` (the group root), since child navigation now handles the first sub-item. The `BlueprintCrudScreen` `shouldRedirect` logic will handle redirect to first child if user hits the base path.

**Validation:**
```
pnpm build
```
Manual: reload Fleet module, confirm sidebar renders Reportes with 4 children, Catalogos with 4 children.

---

## Task 4 — End-to-end verification

**No file changes — verification only.**

Checklist:
- [ ] `pnpm build` — clean, zero errors
- [ ] `pnpm lint` — zero warnings on modified files
- [ ] Open `http://localhost:5173`, navigate to Fleet module
- [ ] Sidebar: `Reportes` renders as a group header with ChevronDown icon
- [ ] Sidebar: clicking `Reportes` expands to show 4 child items
- [ ] Sidebar: clicking `Mantenimiento` navigates to `/reports/maintenance`, child item shows active (border-left + tint)
- [ ] Sidebar: `Catálogos` group works identically (4 children)
- [ ] `BlueprintCrudScreen` on `/reports/maintenance`: NO tab bar rendered
- [ ] `BlueprintCrudScreen` on `/catalogs/vehicle-types`: NO tab bar rendered
- [ ] Direct URL navigation to `/app/m/custom.fleet/reports/service`: `Reportes` auto-expands, `Servicio` shows active
- [ ] Collapse sidebar (desktop): Reportes icon shows with title tooltip, no children visible
- [ ] Mobile drawer: open sidebar, Reportes expands/collapses correctly
- [ ] `Vehiculos` and `Choferes` (flat items, no children): unchanged behavior
- [ ] Tab bar fallback (if testable): if any module WITHOUT children uses groupedTabs, tab bar renders below PageHeader in underline style

---

## Implementation order

Tasks must be executed in order (each builds on the previous):

1. Task 1 — ModuleSidebar (standalone component, no dependencies)
2. Task 2 — BlueprintCrudScreen (depends on knowing sidebar handles nav)
3. Task 3 — Fleet manifest (activates the system end-to-end)
4. Task 4 — Verification

---

## Line budget notes

- `BlueprintCrudScreen.jsx` is currently ~830 lines (soft limit 1000, hard limit 1500). This plan adds ~30 lines net (reorder + replace tab markup + suppression logic). No risk of hitting the limit.
- `ModuleSidebar.jsx` is currently 256 lines. The submenu additions will add ~60–80 lines. Final size ~320–340 lines — well within limits.

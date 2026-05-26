# Custom View Components — Design Spec

## Overview

This feature adds support for AME3 module developers to bring their own full-page React components as views, bypassing `AtlasCrudView` entirely. It introduces:

1. **`kind: 'CUSTOM'`** — a new blueprint kind that maps a route to a developer-supplied React component.
2. **`ImmersiveShell`** — a full-viewport wrapper that provides hover-triggered nav overlay (desktop) and a floating hamburger (mobile) so the custom component gets a fully clean canvas.
3. **Public views** — CUSTOM views optionally declare `public: true`, mounting at `/p/` routes with no auth guard and no nav chrome.

This does not change how TABLE/FORM/DETAIL/PAGE blueprints work — it is purely additive.

---

## Scope

- **Audience:** module developer (code level). End users interact with the rendered component; they configure nothing.
- **Route namespace:** private views at `/app/m/<moduleKey>/...`, public views at `/p/...`.
- **No layout inheritance:** the custom component controls its own internal layout. `ImmersiveShell` provides only the nav chrome overlay.
- **API public endpoints:** public views may pair with unauthenticated API routes declared by the module in its `api/index.js`. Detailed design of a public API endpoint pattern is deferred to the first module that requires it.

---

## 1. Developer API

### Private CUSTOM view (`/app/m/...`)

```js
// views/fleet-dashboard.js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'custom.fleet:FleetDashboard',
  kind: 'CUSTOM',
  schema: {
    component: 'custom.fleet:FleetDashboardScreen',
    path: '/app/m/custom.fleet/dashboard',
    title: 'Dashboard de Flota',
    permissionKey: 'fleet.access',   // optional — permission gate on this view
    public: false,                   // default
  },
})
```

The view is added to `module.manifest.js` `views` array as usual:
```js
views: ['./views/fleet-dashboard.js', ...]
```

The component is registered in `components/index.js` (existing registry pattern):
```js
registry.register('custom.fleet:FleetDashboardScreen', FleetDashboardScreen)
```

### Public CUSTOM view (`/p/...`)

```js
export default defineView({
  key: 'custom.mymodule:CustomerPortal',
  kind: 'CUSTOM',
  schema: {
    component: 'custom.mymodule:CustomerPortalScreen',
    path: '/p/portal',
    title: 'Portal de cliente',
    public: true,
    // no permissionKey — public views are unauthenticated
  },
})
```

### Props injected into the custom component

Private views receive:
```js
{
  companyId:    string,        // from userContext memberships[0].companyId
  permissions:  Set<string>,   // user's resolved permissions
  navigate:     function,      // react-router useNavigate()
  moduleKey:    string,        // 'custom.fleet'
  token:        string,        // JWT access token for fetch calls
}
```

Public views receive:
```js
{
  navigate:   function,   // react-router useNavigate()
  moduleKey:  string,
}
```

---

## 2. Blueprint Kind `CUSTOM`

`BLUEPRINT_KINDS.CUSTOM` already exists in `packages/module-engine/src/constants.js`. The `defineView` validator already allows `CUSTOM` in `VALID_KINDS` and skips kind-specific schema validation for it (only TABLE/FORM/DETAIL have schema sub-field rules). No changes needed to `constants.js`.

### Changes to `packages/module-engine/src/define-view.js`

Add CUSTOM-specific schema validation to `validateKindSchema`:

```js
if (kind === 'CUSTOM') {
  const component = schema?.component
  if (!component || typeof component !== 'string' || !/^[a-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(component.trim())) {
    errors.push('CUSTOM views must declare schema.component as a namespaced registry key (e.g. "my.module:MyComponent")')
  }
  const path = schema?.path
  if (!path || typeof path !== 'string' || !path.startsWith('/')) {
    errors.push('CUSTOM views must declare schema.path starting with /')
  }
}
```

This validates early at discovery time so module developers get clear error messages.

---

## 3. Blueprint Pipeline (unchanged for CUSTOM)

The discovery service (`module-discovery-service.js`) already pushes views through the regular `validateView` → `views.push({ ...declaration, type: declaration.kind })` path for non-page declarations. A CUSTOM view with a `schema` object is not detected as a page by `looksLikePageDeclaration` (which checks for missing `schema`). No changes needed to the discovery service.

The `GET /blueprints` API endpoint stores and returns CUSTOM blueprints the same way as any other kind:
```json
{
  "key": "custom.fleet:FleetDashboard",
  "kind": "CUSTOM",
  "moduleKey": "custom.fleet",
  "schema": {
    "component": "custom.fleet:FleetDashboardScreen",
    "path": "/app/m/custom.fleet/dashboard",
    "title": "Dashboard de Flota",
    "permissionKey": "fleet.access",
    "public": false
  },
  "source": "atlas-view"
}
```

---

## 4. Frontend Rendering — Private Views

### `BlueprintCrudScreen.jsx` — CUSTOM branch

`BlueprintCrudScreen` is the entry point for all custom module routes. Before the existing TABLE/FORM/DETAIL logic, it adds an early-exit for CUSTOM blueprints:

```js
// After moduleRows and blueprintsQuery are resolved, before selectBlueprints():
const customBlueprint = useMemo(() => {
  const normalizedPathname = normalizePath(location.pathname)
  return moduleRows.find(
    (row) => getBlueprintKind(row) === 'CUSTOM' &&
             normalizePath(row?.schema?.path) === normalizedPathname
  ) ?? null
}, [moduleRows, location.pathname])
```

If `customBlueprint` is found:
1. Resolve component from `componentRegistry.resolve(customBlueprint.schema.component)`
2. If component not found → render the existing "Componentes de módulo no disponibles" warning card
3. If found → render `<ImmersiveShell module={module}><CustomComponent {...injectedProps} /></ImmersiveShell>`

The existing `selectBlueprints` / `AtlasCrudView` path is only reached when `customBlueprint` is null.

### Permission gate

If `customBlueprint.schema.permissionKey` is set, `BlueprintCrudScreen` attempts a best-effort frontend check. Because the frontend does not currently maintain a resolved permissions Set, the check is implemented as a lightweight `GET /identity/me/permissions` call (or equivalent already cached in the session context). If the user lacks the permission, show the existing "Acceso restringido" state. The API enforces permissions authoritatively — this is a UX gate only. Implementers may defer this check to Phase 2 and rely on the custom component's own API calls returning 403.

---

## 5. `ImmersiveShell` — New Component

**File:** `apps/desktop/src/shell/ImmersiveShell.jsx`

The component renders the custom component full-viewport and provides the nav overlay.

### DOM structure

```
<div class="relative w-full h-dvh overflow-hidden">
  <div class="absolute inset-0 overflow-auto">         ← custom component
    {children}
  </div>

  {/* Desktop only — animated overlay */}
  <div class="hidden lg:block fixed inset-y-0 left-0 z-50 ...">  ← slide-in sidebar
    <ModuleSidebar ... />
  </div>
  <div class="hidden lg:block fixed top-0 left-60 right-0 z-50 ..."> ← slide-in navbar
    <Topbar ... />
  </div>

  {/* Mobile only — always-visible hamburger */}
  <button class="lg:hidden fixed bottom-4 left-4 z-50 ...">
    ☰
  </button>
</div>
```

### Trigger behavior (desktop)

- `window.addEventListener('mousemove', handler)` — when `e.clientX <= 80 && e.clientY <= 80`, set `overlayVisible = true`.
- `overlayRef.onMouseLeave` → schedule hide after 400 ms delay.
- `overlayRef.onMouseEnter` → cancel scheduled hide (cursor moved back in).
- Click outside overlay → close immediately.
- The overlay uses `position: fixed` and `backdrop-filter: blur(8px)` so it renders over the custom content without shifting layout.

### Animation

Sidebar: `transform: translateX(-100%)` → `translateX(0)` via CSS `transition-transform duration-200`.
Navbar: `transform: translateY(-100%)` → `translateY(0)` via CSS `transition-transform duration-200`.
Both use Tailwind's `transition-transform` utility.

### What ImmersiveShell reuses

`ImmersiveShell` imports and renders the same `ModuleSidebar` and `Topbar` components that `AtlasApp.jsx` uses — no duplicate nav logic. Module data comes via `useRuntimeModules()` (already used in `BlueprintCrudScreen`).

### Mobile

A `<button>` fixed at `bottom-4 left-4` (`lg:hidden`) toggles `overlayVisible`. When open, the full sidebar slides in as a drawer from the left (same component, different CSS class).

---

## 6. Public Views

### Router changes — `apps/desktop/src/main.jsx`

Add a new route group for `/p/` **outside** the `AppAccessGuard`:

```jsx
<Routes>
  <Route path="/"      element={<InitGuard />} />
  <Route path="/setup" element={<SetupRouteGuard />} />
  <Route path="/login" element={<LoginRouteGuard />} />

  {/* NEW — no auth guard */}
  <Route path="/p/*" element={<PublicShell />}>
    <Route path="*" element={<PublicModuleOutlet />} />
  </Route>

  <Route element={<AppAccessGuard />}>
    <Route path="/app" element={<AtlasApp />}>
      {/* existing routes unchanged */}
    </Route>
  </Route>

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

### `PublicShell.jsx` — New Component

**File:** `apps/desktop/src/shell/PublicShell.jsx`

Bare wrapper — no AppSidebar, no Topbar, no ImmersiveShell:

```jsx
import { Outlet } from 'react-router-dom'

export function PublicShell() {
  return (
    <div className="min-h-dvh bg-background">
      <Outlet />
    </div>
  )
}
```

### `PublicModuleOutlet.jsx` — New Component

**File:** `apps/desktop/src/shell/PublicModuleOutlet.jsx`

- Calls `GET /public/blueprints` (unauthenticated) to get public blueprints only.
- Matches current `location.pathname` against `schema.path` of CUSTOM blueprints with `schema.public === true`.
- Resolves component via `componentRegistry.resolve(blueprint.schema.component)`.
- Renders the component with `{ navigate, moduleKey }` props (no auth props).

### `GET /public/blueprints` — New API endpoint

**File:** `apps/api/src/index.js`

New endpoint, no `authMiddleware`:

```js
app.get('/public/blueprints', async (c) => {
  const views = await prisma.atlasView.findMany({
    where: {
      type: 'CUSTOM',
      enabled: true,
    },
  })
  // Filter to public: true only (schema.public === true)
  const publicViews = views.filter(v => v.schema?.public === true)
  return c.json({ data: publicViews.map(v => ({
    key: v.key,
    kind: v.type,
    moduleKey: v.moduleKey,
    schema: v.schema,
    source: 'atlas-view',
  })) })
})
```

This endpoint exposes only views explicitly marked `public: true`. No company-scoped data leaks because the schema contains only routing/component metadata — no records.

### Component registry for public views

`PublicModuleOutlet` calls `componentRegistry.setActiveModules(publicModuleKeys)` using the module keys extracted from the public blueprints response. This ensures the registry dynamically imports only the relevant component files.

---

## 7. Files Modified / Created

### New
```
apps/desktop/src/shell/ImmersiveShell.jsx
apps/desktop/src/shell/PublicShell.jsx
apps/desktop/src/shell/PublicModuleOutlet.jsx
```

### Modified
```
packages/module-engine/src/define-view.js           — CUSTOM schema validation
apps/desktop/src/shell/BlueprintCrudScreen.jsx       — CUSTOM branch + ImmersiveShell
apps/desktop/src/main.jsx                            — /p/* route group
apps/api/src/index.js                                — GET /public/blueprints
```

### Not touched
```
packages/module-engine/src/constants.js              — BLUEPRINT_KINDS.CUSTOM already present
apps/desktop/src/app/ModuleOutlet.jsx                — no changes needed
apps/desktop/src/app/AtlasApp.jsx                    — no changes needed
packages/module-engine/src/component-registry.js    — no changes needed
```

---

## 8. Testing

1. `node --check` on all modified files — no syntax errors.
2. `node --test packages/module-engine/src/__tests__/` — existing tests pass; add test for CUSTOM kind validation in `define-view.js`.
3. `pnpm build` — no compilation errors.
4. Browser QA — private CUSTOM view:
   - Navigate to `/app/m/<moduleKey>/dashboard` → custom component renders full-viewport.
   - Move cursor to top-left corner → sidebar + navbar slide in as overlay.
   - Move cursor away → overlay dismisses after 400 ms.
   - On viewport < 1024 px → hamburger button visible at bottom-left; tap opens sidebar drawer.
5. Browser QA — public view:
   - Navigate to `/p/portal` without a session → component renders, no login redirect.
   - `GET /public/blueprints` returns only `public: true` blueprints.
6. Permission gate — user without `permissionKey` permission → "Acceso restringido" state shown instead of custom component.
7. Missing component — `schema.component` key not in registry → "Componentes de módulo no disponibles" warning card.

---

## 9. Out of Scope

- Visual editor / no-code builder for CUSTOM views (future).
- Public API endpoint design pattern (deferred to first module needing it).
- SSR / pre-rendering for public views (Vite SPA only).
- `atlas.calendar` — deferred as a future core module.

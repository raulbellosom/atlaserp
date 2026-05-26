# Custom View Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `kind: 'CUSTOM'` blueprint support so AME3 module developers can mount their own full-page React components, with an immersive hover-overlay nav for private views and a bare canvas for public `/p/` routes.

**Architecture:** A new CUSTOM blueprint kind is detected in `BlueprintCrudScreen` before the existing TABLE/FORM/DETAIL path; matching views render inside `ImmersiveShell` (hover-triggered nav overlay). Public CUSTOM views (`schema.public: true`) are served at `/p/*` routes outside `AppAccessGuard` via `PublicShell` + `PublicModuleOutlet`, which fetch a new unauthenticated `GET /public/blueprints` endpoint.

**Tech Stack:** React 18, React Router DOM, TanStack Query, Tailwind CSS, `@atlas/ui` (`ModuleSidebar`, `BrandFooter`), Hono (API), Node.js built-in test runner (`node:test`)

---

## File Map

| File | Action |
|---|---|
| `packages/module-engine/src/define-view.js` | Modify — add CUSTOM schema validation |
| `packages/module-engine/src/__tests__/define-view.test.js` | Modify — add CUSTOM test cases |
| `apps/desktop/src/shell/ImmersiveShell.jsx` | **Create** — hover overlay nav wrapper |
| `apps/desktop/src/shell/BlueprintCrudScreen.jsx` | Modify — CUSTOM branch before TABLE/FORM/DETAIL logic |
| `apps/api/src/index.js` | Modify — add `GET /public/blueprints` (no auth) |
| `apps/desktop/src/shell/PublicShell.jsx` | **Create** — bare Outlet wrapper, no auth/nav |
| `apps/desktop/src/shell/PublicModuleOutlet.jsx` | **Create** — resolves public CUSTOM blueprint → component |
| `apps/desktop/src/main.jsx` | Modify — add `/p/*` route outside AppAccessGuard |

---

## Task 1: CUSTOM validation in `define-view.js`

**Context:** `packages/module-engine/src/define-view.js` already accepts `kind: 'CUSTOM'` (it's in `BLUEPRINT_KINDS`) but adds no kind-specific validation. We need to validate that CUSTOM views declare `schema.component` (namespaced registry key) and `schema.path`. The existing `validateKindSchema` function is the right place — it already has `if (kind === 'TABLE')`, `if (kind === 'FORM')`, `if (kind === 'DETAIL')` blocks with no fallthrough.

**Files:**
- Modify: `packages/module-engine/src/define-view.js:22-64`
- Modify: `packages/module-engine/src/__tests__/define-view.test.js`

- [ ] **Step 1: Write failing tests**

Add at the end of `packages/module-engine/src/__tests__/define-view.test.js`:

```js
test('validateView accepts CUSTOM with valid component key and path', () => {
  const result = validateView({
    key: 'custom.fleet:FleetDashboard',
    kind: 'CUSTOM',
    schema: {
      component: 'custom.fleet:FleetDashboardScreen',
      path: '/app/m/custom.fleet/dashboard',
    },
  })
  assert.equal(result.valid, true)
  assert.deepEqual(result.errors, [])
})

test('validateView rejects CUSTOM when schema.component is missing', () => {
  const result = validateView({
    key: 'custom.fleet:FleetDashboard',
    kind: 'CUSTOM',
    schema: { path: '/app/m/custom.fleet/dashboard' },
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((e) => e.includes('schema.component')))
})

test('validateView rejects CUSTOM when schema.component has no namespace prefix', () => {
  const result = validateView({
    key: 'custom.fleet:FleetDashboard',
    kind: 'CUSTOM',
    schema: {
      component: 'FleetDashboardScreen',
      path: '/app/m/custom.fleet/dashboard',
    },
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((e) => e.includes('schema.component')))
})

test('validateView rejects CUSTOM when schema.path is missing', () => {
  const result = validateView({
    key: 'custom.fleet:FleetDashboard',
    kind: 'CUSTOM',
    schema: { component: 'custom.fleet:FleetDashboardScreen' },
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((e) => e.includes('schema.path')))
})

test('validateView rejects CUSTOM when schema.path does not start with /', () => {
  const result = validateView({
    key: 'custom.fleet:FleetDashboard',
    kind: 'CUSTOM',
    schema: {
      component: 'custom.fleet:FleetDashboardScreen',
      path: 'app/m/custom.fleet/dashboard',
    },
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((e) => e.includes('schema.path')))
})

test('defineView with CUSTOM kind does not throw when valid', () => {
  assert.doesNotThrow(() =>
    defineView({
      key: 'custom.fleet:FleetDashboard',
      kind: 'CUSTOM',
      schema: {
        component: 'custom.fleet:FleetDashboardScreen',
        path: '/app/m/custom.fleet/dashboard',
      },
    })
  )
})
```

Also add `defineView` to the import at the top of the test file (it currently only imports `validateView`):
```js
import { validateView, defineView } from '../define-view.js'
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
node --test packages/module-engine/src/__tests__/define-view.test.js
```

Expected: The 6 new tests fail. Existing tests still pass.

- [ ] **Step 3: Add CUSTOM validation to `validateKindSchema`**

In `packages/module-engine/src/define-view.js`, add after the `if (kind === 'DETAIL')` block (around line 63):

```js
  if (kind === 'CUSTOM') {
    const component = schema?.component
    const NAMESPACED_KEY = /^[a-z0-9_.-]+:[A-Za-z0-9_.-]+$/
    if (!component || typeof component !== 'string' || !NAMESPACED_KEY.test(component.trim())) {
      errors.push(
        'CUSTOM views must declare schema.component as a namespaced registry key (e.g. "my.module:MyComponent")'
      )
    }
    const viewPath = schema?.path
    if (!viewPath || typeof viewPath !== 'string' || !viewPath.startsWith('/')) {
      errors.push('CUSTOM views must declare schema.path starting with /')
    }
  }
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
node --test packages/module-engine/src/__tests__/define-view.test.js
```

Expected: All tests pass (existing + 6 new).

- [ ] **Step 5: Commit**

```bash
git add packages/module-engine/src/define-view.js packages/module-engine/src/__tests__/define-view.test.js
git commit -m "feat(module-engine): add CUSTOM view kind schema validation"
```

---

## Task 2: `ImmersiveShell` component

**Context:** `ImmersiveShell` wraps a custom React component full-viewport. On desktop (≥1024 px), moving the cursor within 80 px of the top-left corner triggers a slide-in overlay showing the module sidebar and topbar. The overlay dismisses 400 ms after the cursor leaves it. On mobile (<1024 px), a floating hamburger button (fixed, bottom-left) toggles the same overlay as a drawer with a backdrop.

`ModuleSidebar` is imported from `@atlas/ui`. `Topbar` is imported from `../components/Topbar`. Module data comes from `useRuntimeModules()` hook (same as `BlueprintCrudScreen`). The sidebar is always collapsed=false in the overlay (no collapse control inside the immersive shell).

There is no meaningful Node.js unit test for this interactive component — verification is via `pnpm build` (no TS/syntax errors) and browser QA.

**Files:**
- Create: `apps/desktop/src/shell/ImmersiveShell.jsx`

- [ ] **Step 1: Create `ImmersiveShell.jsx`**

```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ModuleSidebar } from '@atlas/ui'
import { Topbar } from '../components/Topbar'
import { useRuntimeModules } from '../app/useRuntimeModules'

const TRIGGER_PX = 80
const HIDE_DELAY_MS = 400

export function ImmersiveShell({ children, moduleKey }) {
  const [overlayVisible, setOverlayVisible] = useState(false)
  const hideTimer = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { moduleMap } = useRuntimeModules()
  const module = moduleMap.get(moduleKey) ?? null

  const showOverlay = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setOverlayVisible(true)
  }, [])

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setOverlayVisible(false), HIDE_DELAY_MS)
  }, [])

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  useEffect(() => {
    function onMouseMove(e) {
      if (e.clientX <= TRIGGER_PX && e.clientY <= TRIGGER_PX) showOverlay()
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [showOverlay])

  // Dismiss overlay on navigation (same pattern as AtlasApp mobile drawer)
  useEffect(() => {
    setOverlayVisible(false)
  }, [location.pathname])

  function handleNavigate(path) {
    navigate(path)
    setOverlayVisible(false)
  }

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      {/* Custom component — fills full viewport */}
      <div className="absolute inset-0 overflow-auto">
        {children}
      </div>

      {/* Desktop overlay sidebar — slide in from left */}
      {overlayVisible && (
        <div
          className="hidden lg:flex fixed inset-y-0 left-0 z-50 flex-col"
          style={{ animation: 'immersive-slide-in 0.2s ease-out' }}
          onMouseLeave={scheduleHide}
          onMouseEnter={cancelHide}
        >
          <ModuleSidebar
            module={module}
            currentPath={location.pathname}
            onNavigate={handleNavigate}
            collapsed={false}
            onCollapse={() => {}}
            mobileOpen={false}
            onMobileClose={() => {}}
          />
        </div>
      )}

      {/* Desktop overlay topbar — slide in from top */}
      {overlayVisible && (
        <div
          className="hidden lg:block fixed top-0 right-0 z-50"
          style={{ left: '15rem', animation: 'immersive-slide-down 0.2s ease-out' }}
          onMouseLeave={scheduleHide}
          onMouseEnter={cancelHide}
        >
          <Topbar networkBusy={false} />
        </div>
      )}

      {/* Mobile: floating hamburger — always visible */}
      <button
        type="button"
        onClick={() => setOverlayVisible((v) => !v)}
        className="lg:hidden fixed bottom-4 left-4 z-50 h-11 w-11 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center shadow-lg"
        aria-label="Abrir menú"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <rect y="2" width="18" height="2" rx="1" />
          <rect y="8" width="18" height="2" rx="1" />
          <rect y="14" width="18" height="2" rx="1" />
        </svg>
      </button>

      {/* Mobile: backdrop */}
      {overlayVisible && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOverlayVisible(false)}
        />
      )}

      {/* Mobile: full sidebar drawer */}
      {overlayVisible && (
        <div className="lg:hidden fixed inset-y-0 left-0 z-50">
          <ModuleSidebar
            module={module}
            currentPath={location.pathname}
            onNavigate={handleNavigate}
            collapsed={false}
            onCollapse={() => {}}
            mobileOpen={true}
            onMobileClose={() => setOverlayVisible(false)}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add slide-in keyframes to `apps/desktop/src/styles.css`**

Add at the end of `apps/desktop/src/styles.css`:

```css
@keyframes immersive-slide-in {
  from { transform: translateX(-100%); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}

@keyframes immersive-slide-down {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}
```

- [ ] **Step 3: Verify syntax (build check)**

```bash
node --check apps/desktop/src/shell/ImmersiveShell.jsx
```

Expected: exits 0 (no syntax errors). JSX is valid JS for the checker.

Actually `node --check` does not parse JSX. Run lint instead:

```bash
pnpm lint --filter @atlas/desktop 2>&1 | head -30
```

Expected: no errors from `ImmersiveShell.jsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/shell/ImmersiveShell.jsx apps/desktop/src/styles.css
git commit -m "feat(shell): add ImmersiveShell hover-overlay nav wrapper"
```

---

## Task 3: CUSTOM branch in `BlueprintCrudScreen`

**Context:** `BlueprintCrudScreen` (`apps/desktop/src/shell/BlueprintCrudScreen.jsx`) is the entry point for all custom module routes. We add a CUSTOM detection branch that runs after blueprints are loaded but before the existing `selectBlueprints` / `AtlasCrudView` path. If a CUSTOM blueprint matches the current pathname, it renders `ImmersiveShell` with the resolved component. The component key is validated against `componentRegistry`; if missing, the existing amber warning card is shown.

`getBlueprintKind` and `normalizePath` are already defined as module-scoped functions in `BlueprintCrudScreen.jsx` — reuse them directly.

**Files:**
- Modify: `apps/desktop/src/shell/BlueprintCrudScreen.jsx`

- [ ] **Step 1: Add `ImmersiveShell` import**

At the top of `BlueprintCrudScreen.jsx`, after the existing imports, add:

```js
import { ImmersiveShell } from './ImmersiveShell.jsx'
```

- [ ] **Step 2: Add `customBlueprint` memo**

Inside `BlueprintCrudScreen()`, after the `moduleRows` useMemo (around line 538) and before `routeInfo`, add:

```js
const customBlueprint = useMemo(() => {
  const normalizedPathname = normalizePath(location.pathname)
  return (
    moduleRows.find(
      (row) =>
        getBlueprintKind(row) === 'CUSTOM' &&
        normalizePath(row?.schema?.path) === normalizedPathname
    ) ?? null
  )
}, [moduleRows, location.pathname])
```

- [ ] **Step 3: Add CUSTOM early-return branch**

In the render section, after the `blueprintsQuery.isError` early return (around line 783) and before `if (groupedTabs?.shouldRedirect ...)`, add:

```jsx
  if (customBlueprint) {
    const componentKey = customBlueprint?.schema?.component
    const CustomComponent = componentKey ? componentRegistry.resolve(componentKey) : null

    if (!CustomComponent) {
      return (
        <div className="p-6">
          <Card className="border-amber-400/40 bg-amber-50/60">
            <CardHeader>
              <CardTitle>Componente de módulo no disponible (requiere rebuild)</CardTitle>
              <p className="text-sm text-muted-foreground">
                El componente{' '}
                <code className="font-mono text-xs bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded">
                  {componentKey ?? 'desconocido'}
                </code>{' '}
                no está en el bundle actual. Reinstala o reconstruye la app para incluirlo.
              </p>
            </CardHeader>
          </Card>
        </div>
      )
    }

    return (
      <ImmersiveShell moduleKey={moduleKey}>
        <CustomComponent
          token={token}
          navigate={navigate}
          moduleKey={moduleKey}
        />
      </ImmersiveShell>
    )
  }
```

- [ ] **Step 4: Verify lint**

```bash
pnpm lint --filter @atlas/desktop 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/shell/BlueprintCrudScreen.jsx
git commit -m "feat(shell): add CUSTOM blueprint branch to BlueprintCrudScreen"
```

---

## Task 4: `GET /public/blueprints` API endpoint

**Context:** `apps/api/src/index.js` is large (3583 lines). The new endpoint is added before the `app.get('/contacts', ...)` block (around line 2663). No auth middleware — this endpoint is intentionally public. It reads `AtlasView` rows with `type: 'CUSTOM'` and filters to those where `schema.public === true`. No company-scoped data is exposed — the schema contains only routing/component metadata.

**Files:**
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Add endpoint**

Find the line `app.get(` just after the blueprints endpoint closing (search for `return c.json({ data: [...mergedByKey.values()] });` followed by `});`). Add the new endpoint immediately after that closing `});`:

```js
app.get('/public/blueprints', async (c) => {
  try {
    const views = await prisma.atlasView.findMany({
      where: { type: 'CUSTOM', enabled: true },
    })
    const publicViews = views.filter((v) => v.schema?.public === true)
    return c.json({
      data: publicViews.map((v) => ({
        key: v.key,
        kind: v.type,
        moduleKey: v.moduleKey,
        schema: v.schema,
        source: 'atlas-view',
      })),
    })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[public/blueprints]', err?.message)
    }
    return c.json({ error: 'No se pudieron cargar las vistas públicas.' }, 500)
  }
})
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/api/src/index.js
```

Expected: exits 0.

- [ ] **Step 3: Smoke test with curl (API must be running)**

If the dev API is running (`pnpm dev:api`), test:

```bash
curl -s http://localhost:4010/public/blueprints | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d))"
```

Expected: `{ data: [] }` (no public views registered yet — that's correct).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(api): add GET /public/blueprints unauthenticated endpoint"
```

---

## Task 5: `PublicShell` and `PublicModuleOutlet`

**Context:** `PublicShell` is a bare `<Outlet />` wrapper — no auth guard, no AppSidebar, no Topbar. `PublicModuleOutlet` fetches `GET /public/blueprints` via TanStack Query (no token needed), matches the current pathname to a blueprint's `schema.path`, calls `componentRegistry.setActiveModules()` so the component registry dynamically imports the right module's components, then renders the resolved component.

`normalizePath` is a local utility (same logic as in `BlueprintCrudScreen` — cannot be imported since it's not exported; redeclare it in `PublicModuleOutlet`).

**Files:**
- Create: `apps/desktop/src/shell/PublicShell.jsx`
- Create: `apps/desktop/src/shell/PublicModuleOutlet.jsx`

- [ ] **Step 1: Create `PublicShell.jsx`**

```jsx
import { Outlet } from 'react-router-dom'

export function PublicShell() {
  return (
    <div className="min-h-dvh bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 2: Create `PublicModuleOutlet.jsx`**

```jsx
import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { EmptyState, ErrorState, Skeleton } from '@atlas/ui'
import { Package } from 'lucide-react'
import { componentRegistry } from '../lib/moduleComponentRegistry'

const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

function normalizePath(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (text === '/') return '/'
  const withSlash = text.startsWith('/') ? text : `/${text}`
  return withSlash.replace(/\/+$/, '')
}

export function PublicModuleOutlet() {
  const location = useLocation()
  const navigate = useNavigate()

  const blueprintsQuery = useQuery({
    queryKey: ['public-blueprints'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/public/blueprints`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const rows = useMemo(
    () => (Array.isArray(blueprintsQuery.data?.data) ? blueprintsQuery.data.data : []),
    [blueprintsQuery.data]
  )

  // Activate module component registries for all public modules
  useEffect(() => {
    if (!rows.length) return
    const moduleKeys = [...new Set(rows.map((r) => r.moduleKey).filter(Boolean))]
    componentRegistry.setActiveModules(moduleKeys)
  }, [rows])

  const matchedBlueprint = useMemo(() => {
    const normalizedPathname = normalizePath(location.pathname)
    return rows.find((row) => normalizePath(row?.schema?.path) === normalizedPathname) ?? null
  }, [rows, location.pathname])

  if (blueprintsQuery.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-4 w-64" />
      </div>
    )
  }

  if (blueprintsQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="No se pudo cargar la vista"
          description="Verifica tu conexión e intenta de nuevo."
          onRetry={() => blueprintsQuery.refetch()}
        />
      </div>
    )
  }

  if (!matchedBlueprint) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Vista pública no encontrada"
          description="Esta ruta no tiene una vista pública configurada."
        />
      </div>
    )
  }

  const componentKey = matchedBlueprint?.schema?.component
  const CustomComponent = componentKey ? componentRegistry.resolve(componentKey) : null

  if (!CustomComponent) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Componente no disponible"
          description={`El componente "${componentKey ?? 'desconocido'}" no está en el bundle actual.`}
        />
      </div>
    )
  }

  return (
    <CustomComponent
      navigate={navigate}
      moduleKey={matchedBlueprint.moduleKey}
    />
  )
}
```

- [ ] **Step 3: Verify lint**

```bash
pnpm lint --filter @atlas/desktop 2>&1 | head -30
```

Expected: no errors from new files.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/shell/PublicShell.jsx apps/desktop/src/shell/PublicModuleOutlet.jsx
git commit -m "feat(shell): add PublicShell and PublicModuleOutlet for /p/* routes"
```

---

## Task 6: Router — wire `/p/*` routes in `main.jsx`

**Context:** `apps/desktop/src/main.jsx` defines the React Router `<Routes>` tree. The `/p/*` route must be outside `AppAccessGuard` (no auth check) and must sit above the catch-all `<Route path="*" ...>`. `PublicShell` is the layout; `PublicModuleOutlet` resolves the specific component.

**Files:**
- Modify: `apps/desktop/src/main.jsx`

- [ ] **Step 1: Add imports**

In `apps/desktop/src/main.jsx`, add after the existing shell/screen imports:

```js
import { PublicShell } from './shell/PublicShell.jsx'
import { PublicModuleOutlet } from './shell/PublicModuleOutlet.jsx'
```

- [ ] **Step 2: Add `/p/*` route**

In the `<Routes>` block, after the `<Route element={<AppAccessGuard />}>` closing `</Route>` and before `<Route path="*" element={<Navigate to="/" replace />} />`, add:

```jsx
<Route path="/p" element={<PublicShell />}>
  <Route path="*" element={<PublicModuleOutlet />} />
</Route>
```

The full Routes block after the change looks like:

```jsx
<Routes>
  <Route path="/" element={<InitGuard />} />
  <Route path="/setup" element={<SetupRouteGuard />} />
  <Route path="/login" element={<LoginRouteGuard />} />
  <Route element={<AppAccessGuard />}>
    <Route path="/app" element={<AtlasApp />}>
      <Route index element={<Navigate to="home" replace />} />
      <Route path="home" element={<HomeScreen />} />
      <Route path="m/:moduleKey/*" element={<ModuleOutlet />} />
      <Route path="profile" element={<ProfileScreen />} />
    </Route>
  </Route>
  <Route path="/p" element={<PublicShell />}>
    <Route path="*" element={<PublicModuleOutlet />} />
  </Route>
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

- [ ] **Step 3: Full build**

```bash
pnpm build 2>&1 | tail -20
```

Expected: build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main.jsx
git commit -m "feat(router): add /p/* public route group for CUSTOM public views"
```

---

## Verification Checklist

After all tasks are complete, verify the following:

- [ ] `node --test packages/module-engine/src/__tests__/define-view.test.js` — all tests pass (including 6 new CUSTOM tests)
- [ ] `pnpm build` — no compilation errors
- [ ] `curl http://localhost:4010/public/blueprints` — returns `{ data: [] }` (200)
- [ ] Register a CUSTOM view in `custom.fleet` manifest with `kind: 'CUSTOM'` and a registered component — navigate to its path → custom component renders full-viewport
- [ ] Move cursor to top-left corner → sidebar + navbar overlay appears; move away → disappears after 400 ms
- [ ] On viewport < 1024 px → hamburger button visible at `bottom-4 left-4`; tap → sidebar drawer opens; tap backdrop → closes
- [ ] Register a CUSTOM view with `public: true` and `path: '/p/test'` — navigate to `/p/test` without a session → component renders (no login redirect)
- [ ] Navigate to `/p/nonexistent` → "Vista pública no encontrada" empty state shown

---

## Usage Example (for module developer)

Once implemented, a module developer adds a custom view like this:

```js
// modules/custom/custom.fleet/views/fleet-dashboard.js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'custom.fleet:FleetDashboard',
  kind: 'CUSTOM',
  schema: {
    component: 'custom.fleet:FleetDashboardScreen',
    path: '/app/m/custom.fleet/dashboard',
    title: 'Dashboard de Flota',
    public: false,
  },
})
```

```js
// modules/custom/custom.fleet/components/index.js  (existing file)
// Add alongside existing registrations:
registry.register('custom.fleet:FleetDashboardScreen', FleetDashboardScreen)
```

```jsx
// modules/custom/custom.fleet/components/FleetDashboardScreen.jsx
export default function FleetDashboardScreen({ token, navigate, moduleKey }) {
  // Full page — own layout, own fetch, own styles
  return <div>...</div>
}
```

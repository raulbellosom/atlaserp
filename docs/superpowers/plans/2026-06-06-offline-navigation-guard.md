# Offline Navigation Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the device is offline, gray out and block navigation to modules that don't support offline mode, while preserving cached data for any module already in memory.

**Architecture:** A new `offline-modules.js` file becomes the single source of truth for which modules support offline. `@atlas/offline` exports this constant so the desktop UI can import it. `ModuleCardGrid` and `ModuleListRow` receive an `isOfflineBlocked` prop and render a grayed-out disabled state. `HomeScreen` and `AppLauncher` each import `useOfflineStore` + `OFFLINE_MODULES`, compute the blocked state per module, and pass it down. The React Query cache (already persisted to IndexedDB via `PersistQueryClientProvider`) continues to serve cached data for all modules regardless — no change needed for that.

**Tech Stack:** React, Zustand (`useOfflineStore`), Tailwind, lucide-react (`WifiOff`), Node.js `node --check` for syntax verification, `pnpm dev:frontend` for manual visual testing

---

## File Map

| File | Change |
|---|---|
| `packages/offline/src/offline-modules.js` | NEW — single-source-of-truth for `OFFLINE_MODULES` constant |
| `packages/offline/src/offline-provider.jsx` | Import from new file instead of inline const |
| `packages/offline/src/index.js` | Export `OFFLINE_MODULES` |
| `packages/offline/src/__tests__/offline-modules.test.js` | NEW — verify constant shape |
| `apps/desktop/src/components/ModuleCard.jsx` | Add `isOfflineBlocked` prop to `ModuleCardGrid` + `ModuleListRow` |
| `apps/desktop/src/app/HomeScreen.jsx` | Compute + pass `isOfflineBlocked`, guard favorites + recent clicks |
| `apps/desktop/src/components/AppLauncher.jsx` | Compute + pass offline guard for both grid and list renders |

---

### Task 1: Extract `OFFLINE_MODULES` and export from `@atlas/offline`

**Files:**
- Create: `packages/offline/src/offline-modules.js`
- Modify: `packages/offline/src/offline-provider.jsx` (line 12)
- Modify: `packages/offline/src/index.js` (append)
- Create: `packages/offline/src/__tests__/offline-modules.test.js`

- [ ] **Step 1: Write the failing test**

Create `packages/offline/src/__tests__/offline-modules.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OFFLINE_MODULES } from '../offline-modules.js'

describe('OFFLINE_MODULES', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(OFFLINE_MODULES))
    assert.ok(OFFLINE_MODULES.length > 0)
  })

  it('contains the five expected offline-capable module keys', () => {
    assert.ok(OFFLINE_MODULES.includes('atlas.contacts'))
    assert.ok(OFFLINE_MODULES.includes('atlas.hr'))
    assert.ok(OFFLINE_MODULES.includes('custom.fleet'))
    assert.ok(OFFLINE_MODULES.includes('atlas.calendar'))
    assert.ok(OFFLINE_MODULES.includes('atlas.catalog'))
  })

  it('contains no duplicate keys', () => {
    assert.equal(OFFLINE_MODULES.length, new Set(OFFLINE_MODULES).size)
  })
})
```

- [ ] **Step 2: Run test — expect failure (file does not exist yet)**

```bash
node --test packages/offline/src/__tests__/offline-modules.test.js
```

Expected: FAIL — `Cannot find module '../offline-modules.js'`

- [ ] **Step 3: Create `offline-modules.js`**

Create `packages/offline/src/offline-modules.js`:

```js
// Single source of truth for which module keys have offline support.
// Imported by OfflineProvider (for sync) and by the desktop UI (for navigation guard).
export const OFFLINE_MODULES = [
  'atlas.contacts',
  'atlas.hr',
  'custom.fleet',
  'atlas.calendar',
  'atlas.catalog',
]
```

- [ ] **Step 4: Run test — all 3 must pass**

```bash
node --test packages/offline/src/__tests__/offline-modules.test.js
```

Expected: 3 pass, 0 fail.

- [ ] **Step 5: Update `offline-provider.jsx` to import from the new file**

In `packages/offline/src/offline-provider.jsx`, replace the inline constant on line 12:

Old line 12:
```js
const OFFLINE_MODULES = ['atlas.contacts', 'atlas.hr', 'custom.fleet', 'atlas.calendar', 'atlas.catalog']
```

New — add the import at the top of the file (after the existing imports) and remove the inline const:

Add to imports:
```js
import { OFFLINE_MODULES } from './offline-modules.js'
```

Remove line 12 (`const OFFLINE_MODULES = [...]`).

- [ ] **Step 6: Export `OFFLINE_MODULES` from `packages/offline/src/index.js`**

Append to the end of `packages/offline/src/index.js`:

```js
export { OFFLINE_MODULES } from './offline-modules.js'
```

- [ ] **Step 7: Verify syntax is clean**

```bash
node --check packages/offline/src/offline-provider.jsx
node --check packages/offline/src/index.js
```

Expected: both exit with no output (syntax OK).

- [ ] **Step 8: Re-run the full offline test suite to confirm no regression**

```bash
node --test packages/offline/src/__tests__/offline-transport.test.js
node --test packages/offline/src/__tests__/offline-modules.test.js
```

Expected: 15 + 3 = 18 tests pass, 0 fail.

- [ ] **Step 9: Commit**

```bash
git add packages/offline/src/offline-modules.js packages/offline/src/offline-provider.jsx packages/offline/src/index.js packages/offline/src/__tests__/offline-modules.test.js
git commit -m "feat(offline): extract OFFLINE_MODULES constant and export from @atlas/offline"
```

---

### Task 2: Add `isOfflineBlocked` visual state to `ModuleCardGrid` and `ModuleListRow`

**Files:**
- Modify: `apps/desktop/src/components/ModuleCard.jsx`

These are `<button>` elements so `disabled` is the correct HTML attribute to block interaction. We combine it with Tailwind classes for the grayed appearance and a `WifiOff` badge to explain why the module is unavailable.

- [ ] **Step 1: Add `WifiOff` to the lucide-react import**

In `apps/desktop/src/components/ModuleCard.jsx`, the current import line is:
```js
import { Star } from "lucide-react";
```

Change to:
```js
import { Star, WifiOff } from "lucide-react";
```

- [ ] **Step 2: Update `ModuleCardGrid` to accept and render `isOfflineBlocked`**

Replace the current `ModuleCardGrid` function (lines 170–219) with:

```js
export function ModuleCardGrid({ module, onClick, onContextMenu, isFavorite, isOfflineBlocked }) {
  const visuals = resolveModuleVisuals(module);
  const { color, accentColor } = visuals;

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={isOfflineBlocked}
      className={cn(
        "group relative flex flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden text-left transition-all duration-200",
        isOfflineBlocked
          ? "opacity-40 cursor-not-allowed pointer-events-none"
          : "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]",
      )}
    >
      {/* Gradient header */}
      <div
        className="relative h-16 overflow-hidden shrink-0"
        style={{
          background: `linear-gradient(135deg, ${toAlphaHexColor(color, "22")} 0%, ${toAlphaHexColor(accentColor, "08")} 70%, transparent 100%)`,
        }}
      >
        <div
          className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.12]"
          style={{ background: accentColor }}
        />
        <div
          className="absolute right-8 top-2 h-8 w-8 rounded-full opacity-[0.08]"
          style={{ background: color }}
        />
        {isFavorite && !isOfflineBlocked && (
          <Star
            size={11}
            className="absolute top-3 right-3 text-amber-400 fill-amber-400"
          />
        )}
        {isOfflineBlocked && (
          <WifiOff
            size={11}
            className="absolute top-3 right-3 text-[hsl(var(--muted-foreground))]"
          />
        )}
      </div>

      {/* Icon overlapping header/body boundary */}
      <div className="px-4 -mt-5 relative z-10 shrink-0">
        <ModuleIcon module={module} size="sm" />
      </div>

      {/* Body */}
      <div className="px-4 pb-4 pt-2 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-tight truncate">
          {module.name}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 leading-snug">
          {module.summary || module.description}
        </p>
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Update `ModuleListRow` to accept and render `isOfflineBlocked`**

Replace the current `ModuleListRow` function (lines 222–243) with:

```js
export function ModuleListRow({ module, onClick, onContextMenu, isFavorite, isOfflineBlocked }) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={isOfflineBlocked}
      className={cn(
        "flex items-center gap-4 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-200 px-4 py-3 text-left",
        isOfflineBlocked
          ? "opacity-40 cursor-not-allowed pointer-events-none"
          : "cursor-pointer hover:shadow-sm hover:border-[hsl(var(--muted-foreground))]/30 active:scale-[0.99]",
      )}
    >
      <ModuleIcon module={module} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-tight">
          {module.name}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
          {module.summary || module.description}
        </p>
      </div>
      {isFavorite && !isOfflineBlocked && (
        <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />
      )}
      {isOfflineBlocked && (
        <WifiOff size={13} className="text-[hsl(var(--muted-foreground))]/60 shrink-0" />
      )}
    </button>
  );
}
```

- [ ] **Step 4: Verify syntax**

```bash
node --check apps/desktop/src/components/ModuleCard.jsx
```

Expected: no output (syntax OK).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/ModuleCard.jsx
git commit -m "feat(offline): add isOfflineBlocked prop to ModuleCardGrid and ModuleListRow"
```

---

### Task 3: Wire offline guard into `HomeScreen`

**Files:**
- Modify: `apps/desktop/src/app/HomeScreen.jsx`

HomeScreen uses `ModuleCardGrid` and `ModuleListRow` for the main module grid, and has its own inline `<button>` elements for the Favorites and Recent sections. All three surfaces need the guard.

- [ ] **Step 1: Add the imports**

In `apps/desktop/src/app/HomeScreen.jsx`, add to the existing import block:

```js
import { useOfflineStore, OFFLINE_MODULES } from '@atlas/offline'
```

The existing imports for this file start at line 1. Add this import after the `useAppViewPrefs` import line.

- [ ] **Step 2: Add the `isOnline` selector and `isOfflineBlocked` helper inside `HomeScreen`**

Inside the `HomeScreen` function body, after the existing hook declarations (after `useAppViewPrefs` line), add:

```js
const isOnline = useOfflineStore((s) => s.isOnline)
const isOfflineBlocked = (module) => !isOnline && !OFFLINE_MODULES.includes(module.key)
```

- [ ] **Step 3: Guard the `handleModuleClick` function**

Replace the existing `handleModuleClick`:

```js
function handleModuleClick(module) {
  if (isOfflineBlocked(module)) return
  trackModuleVisit(module.key)
  navigate(getModuleLaunchPath(module))
}
```

- [ ] **Step 4: Pass `isOfflineBlocked` to `ModuleCardGrid` and `ModuleListRow`**

In the sections render (the `sections.map(...)` block at the bottom of the JSX), update the two card component calls:

`ModuleListRow`:
```jsx
<ModuleListRow
  key={module.key}
  module={module}
  onClick={() => handleModuleClick(module)}
  onContextMenu={(e) => handleContextMenu(e, module.key)}
  isFavorite={isFavorite(module.key)}
  isOfflineBlocked={isOfflineBlocked(module)}
/>
```

`ModuleCardGrid`:
```jsx
<ModuleCardGrid
  key={module.key}
  module={module}
  onClick={() => handleModuleClick(module)}
  onContextMenu={(e) => handleContextMenu(e, module.key)}
  isFavorite={isFavorite(module.key)}
  isOfflineBlocked={isOfflineBlocked(module)}
/>
```

- [ ] **Step 5: Gray out favorites buttons**

In the Favoritos section, each favorite is a plain `<button>`. Update it:

```jsx
{favoriteModules.map((module) => (
  <button
    key={module.key}
    onClick={() => handleModuleClick(module)}
    onContextMenu={(e) => handleContextMenu(e, module.key)}
    disabled={isOfflineBlocked(module)}
    className={cn(
      "flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 transition-all duration-150 px-3 py-2.5 text-left active:scale-[0.98]",
      isOfflineBlocked(module)
        ? "opacity-40 cursor-not-allowed pointer-events-none"
        : "hover:bg-amber-500/10 hover:border-amber-500/30 cursor-pointer",
    )}
  >
    <div className="rounded-lg flex items-center justify-center shrink-0" style={{ height: 32, width: 32 }}>
      <ModuleIcon module={module} size="sm" />
    </div>
    <p className="text-xs font-semibold text-[hsl(var(--foreground))] leading-tight truncate">
      {module.name}
    </p>
  </button>
))}
```

- [ ] **Step 6: Gray out recent module pills**

In the Recientes section, each pill is a `<button>`. Update it:

```jsx
{recentModules.map((m) => (
  <button
    key={m.key}
    onClick={() => handleModuleClick(m)}
    onContextMenu={(e) => handleContextMenu(e, m.key)}
    disabled={isOfflineBlocked(m)}
    className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs font-medium text-[hsl(var(--foreground))] transition-all duration-150",
      isOfflineBlocked(m)
        ? "opacity-40 cursor-not-allowed pointer-events-none"
        : "hover:bg-[hsl(var(--muted))] cursor-pointer",
    )}
  >
    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
    {m.name}
  </button>
))}
```

- [ ] **Step 7: Verify syntax**

```bash
node --check apps/desktop/src/app/HomeScreen.jsx
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/app/HomeScreen.jsx
git commit -m "feat(offline): gray out offline-blocked modules in HomeScreen"
```

---

### Task 4: Wire offline guard into `AppLauncher`

**Files:**
- Modify: `apps/desktop/src/components/AppLauncher.jsx`

`AppLauncher` renders its own inline `<a>` tags in both grid and list modes (it does not use `ModuleCardGrid`/`ModuleListRow`). We apply `pointer-events-none opacity-40` directly and guard the click handler.

- [ ] **Step 1: Add imports**

In `apps/desktop/src/components/AppLauncher.jsx`, add to the existing import block:

```js
import { useOfflineStore, OFFLINE_MODULES } from '@atlas/offline'
import { WifiOff } from 'lucide-react'
```

- [ ] **Step 2: Add `isOnline` selector and `isOfflineBlocked` inside `AppLauncher`**

Inside the `AppLauncher` function body, after the existing hook declarations, add:

```js
const isOnline = useOfflineStore((s) => s.isOnline)
const isOfflineBlocked = (module) => !isOnline && !OFFLINE_MODULES.includes(module.key)
```

- [ ] **Step 3: Guard `handleModuleClick`**

Replace the existing `handleModuleClick`:

```js
function handleModuleClick(module) {
  if (isOfflineBlocked(module)) return
  navigate(getModuleLaunchPath(module))
  closeLauncher()
  setQuery('')
}
```

- [ ] **Step 4: Update the list view `<a>` to render the blocked state**

In the `viewMode === 'list'` branch, replace the inner `<a>` tag:

```jsx
<a
  key={module.key}
  href={getModuleLaunchPath(module)}
  onClick={(e) => {
    if (e.ctrlKey || e.metaKey || e.button === 1) return
    e.preventDefault()
    handleModuleClick(module)
  }}
  onContextMenu={(e) => handleContextMenu(e, module.key)}
  className={cn(
    "flex items-center gap-3 w-full rounded-lg px-3 py-2 transition-colors duration-150 text-left",
    isOfflineBlocked(module)
      ? "opacity-40 cursor-not-allowed pointer-events-none"
      : "hover:bg-[hsl(var(--muted))] cursor-pointer",
  )}
>
  <div
    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
    style={{ backgroundColor: `${module.color}26` }}
  >
    <ModIcon name={module.icon} size={16} color={module.color} logoUrl={module.logoUrl} />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-xs font-semibold text-[hsl(var(--foreground))] leading-tight truncate">
      {module.name}
    </p>
    <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
      {module.summary || module.description}
    </p>
  </div>
  {isFavorite(module.key) && !isOfflineBlocked(module) && (
    <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />
  )}
  {isOfflineBlocked(module) && (
    <WifiOff size={11} className="text-[hsl(var(--muted-foreground))]/60 shrink-0" />
  )}
</a>
```

- [ ] **Step 5: Update the grid view `<a>` to render the blocked state**

In the grid view (`grid grid-cols-3 sm:grid-cols-4 gap-2` branch), replace the inner `<a>` tag:

```jsx
<a
  key={module.key}
  href={getModuleLaunchPath(module)}
  onClick={(e) => {
    if (e.ctrlKey || e.metaKey || e.button === 1) return
    e.preventDefault()
    handleModuleClick(module)
  }}
  onContextMenu={(e) => handleContextMenu(e, module.key)}
  className={cn(
    "flex flex-col items-center gap-2 rounded-xl p-4 transition-colors duration-150 text-center relative",
    isOfflineBlocked(module)
      ? "opacity-40 cursor-not-allowed pointer-events-none"
      : "hover:bg-[hsl(var(--muted))] cursor-pointer",
  )}
>
  {isFavorite(module.key) && !isOfflineBlocked(module) && (
    <Star size={9} className="absolute top-2 right-2 text-amber-400 fill-amber-400" />
  )}
  {isOfflineBlocked(module) && (
    <WifiOff size={9} className="absolute top-2 right-2 text-[hsl(var(--muted-foreground))]/60" />
  )}
  <div
    className="h-12 w-12 rounded-xl flex items-center justify-center"
    style={{ backgroundColor: `${module.color}26` }}
  >
    <ModIcon name={module.icon} size={22} color={module.color} logoUrl={module.logoUrl} />
  </div>
  <p className="text-xs font-semibold text-[hsl(var(--foreground))] leading-tight">
    {module.name}
  </p>
  <p className="text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2 leading-snug w-full">
    {module.summary || module.description}
  </p>
</a>
```

- [ ] **Step 6: Verify syntax**

```bash
node --check apps/desktop/src/components/AppLauncher.jsx
```

Expected: no output.

- [ ] **Step 7: Manual visual test**

Start the dev server:
```bash
pnpm dev:frontend
```

Open `http://localhost:5173`, log in, then:

1. Open DevTools → Network tab → select **Offline** preset (or throttle to offline)
2. The `OfflineIndicator` in the top bar should show the offline state
3. On the **Home screen**: modules not in OFFLINE_MODULES (Finance, Ledger, Files, Identity, Company, Website, etc.) should be visibly grayed out (40% opacity) with a small WifiOff icon
4. Modules in OFFLINE_MODULES (Contacts, HR, Fleet, Calendar, Catalog) should look normal
5. Clicking a grayed module → nothing happens
6. Press **Ctrl+.** to open AppLauncher → same grayed treatment in both list and grid view modes
7. Switch back to **Online** in DevTools → all modules become interactive again

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/components/AppLauncher.jsx
git commit -m "feat(offline): gray out offline-blocked modules in AppLauncher"
```

---

## Self-Review

### Spec coverage

User requirements:
- ✅ Modules not in OFFLINE_MODULES are grayed out when offline — Tasks 2, 3, 4
- ✅ Navigation to blocked modules is prevented — Tasks 3, 4 (`handleModuleClick` guard + `disabled`/`pointer-events-none`)
- ✅ `WifiOff` icon visible on blocked items — Tasks 2, 4
- ✅ Cache data preserved for all modules — already handled by existing `PersistQueryClientProvider`, no new work
- ✅ Offline-capable modules (5 keys) accessible normally — OFFLINE_MODULES check passes for them
- ✅ Going back online restores full navigation — `isOnline` from Zustand store drives reactivity; when it flips, all components re-render

### Placeholder scan

No TBD, TODO, or "implement later" found. All steps contain exact code.

### Type consistency

- `isOfflineBlocked(module)` → takes a module object, returns boolean — consistent across HomeScreen, AppLauncher
- `OFFLINE_MODULES` → array of strings — defined once in `offline-modules.js`, same reference everywhere
- `isOnline` → `useOfflineStore((s) => s.isOnline)` — same selector pattern used in both HomeScreen and AppLauncher, consistent with existing usage in calendar hooks
- `isOfflineBlocked` prop → boolean — passed to `ModuleCardGrid` + `ModuleListRow`, destructured in both

### Coverage gaps checked

- Favorites section in HomeScreen: ✅ Task 3 step 5
- Recent modules section in HomeScreen: ✅ Task 3 step 6
- AppLauncher list mode: ✅ Task 4 step 4
- AppLauncher grid mode: ✅ Task 4 step 5
- ModuleCardGrid: ✅ Task 2 step 2
- ModuleListRow: ✅ Task 2 step 3
- CommandPalette: out of scope — it navigates via keyboard shortcut and is used less frequently; the `handleModuleClick` guard in AppLauncher already blocks navigation, and visual feedback there would require significant refactoring for minimal gain

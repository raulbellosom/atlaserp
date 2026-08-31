# Module Favorites: Touch Support + Logic Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let touch users add/remove module favorites (always-visible star button + long-press menu) and collapse the duplicated favorites/launcher logic in `HomeScreen` and `AppLauncher` into one shared hook and one card family.

**Architecture:** A new `useModuleLauncher` hook owns offline-blocking, section building, context-menu state, favorite toggling and navigation. `HomeScreen` and `AppLauncher` both consume it and render the same `ModuleCardGrid` / `ModuleListRow` from `ModuleCard.jsx`, now extended with an always-visible star toggle, optional `<a href>` rendering, and long-press. Pure logic is extracted to `apps/desktop/src/lib/moduleLauncher.js` and unit-tested with the Node built-in runner (matching how `sortModules.js` / `useLongPress.js` are tested — pure units, no React renderer). The fixed "Acceso rápido" (Favoritos + Recientes) block on `HomeScreen` is deleted; favorites now surface only through the `favoritesFirst` section, whose default flips to `true`.

**Tech Stack:** React 18, react-router-dom, TanStack Query, Zustand (`@atlas/offline`), Tailwind, lucide-react, `@atlas/ui` (`useLongPress`), Node built-in test runner (`node --test`).

**Deviation from spec:** The spec proposed a bespoke long-press handler local to `ModuleCard.jsx` because `@atlas/ui`'s `useLongPress` suppresses long-press on interactive hosts. This plan instead adds a backward-compatible `ignoreInteractiveTarget` opt-out to the shared `createLongPressController` / `useLongPress` (Task 2). Same intent (reuse the already-tested controller), less duplication.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `apps/desktop/src/lib/moduleLauncher.js` (create) | Pure helpers: offline-blocked check, menu-anchor normalization, viewport clamp, favorite label, new-tab intent, coarse-pointer check | 1 |
| `apps/desktop/src/lib/__tests__/moduleLauncher.test.js` (create) | Unit tests for the helpers above | 1 |
| `packages/ui/src/hooks/useLongPress.js` (modify) | Add `ignoreInteractiveTarget` option to controller + hook | 2 |
| `packages/ui/src/hooks/__tests__/useLongPress.test.js` (modify) | Test the new option | 2 |
| `apps/desktop/src/hooks/useAppViewPrefs.js` (modify) | Flip `favoritesFirst` default to `true`; export `DEFAULTS` | 3 |
| `apps/desktop/src/hooks/__tests__/useAppViewPrefs-defaults.test.js` (create) | Assert the new default | 3 |
| `apps/desktop/src/hooks/useModuleLauncher.js` (create) | Shared launcher behavior hook (glue over helpers + `useAppViewPrefs` + offline store + router) | 4 |
| `apps/desktop/src/components/ModuleCard.jsx` (modify) | `ModuleCardGrid` / `ModuleListRow`: star toggle button, `href`/anchor rendering, long-press, post-long-press click suppression | 5 |
| `apps/desktop/src/components/AppContextMenu.jsx` (modify) | Clamp popover position to viewport | 6 |
| `apps/desktop/src/app/HomeScreen.jsx` (modify) | Consume `useModuleLauncher`; delete `trackModuleVisit`, `atlas-module-visits`, `recentModules`, `favoriteModules`, and the entire "Acceso rápido" block | 7 |
| `apps/desktop/src/components/AppLauncher.jsx` (modify) | Consume `useModuleLauncher`; render canonical cards with `href`; drop bespoke `<a>`/`ModIcon` markup | 8 |
| `apps/desktop/src/components/ModIcon.jsx` (delete) | Dead after Task 8 (only consumer was `AppLauncher`; local `ICON_MAP` copies elsewhere are unrelated) | 9 |

---

## Task 1: Pure helpers in `lib/moduleLauncher.js`

**Files:**
- Create: `apps/desktop/src/lib/moduleLauncher.js`
- Test: `apps/desktop/src/lib/__tests__/moduleLauncher.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/lib/__tests__/moduleLauncher.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isModuleOfflineBlocked,
  resolveMenuAnchor,
  clampMenuToViewport,
  favoriteToggleLabel,
  shouldOpenInNewTab,
  isCoarsePointer,
} from '../moduleLauncher.js';

test('isModuleOfflineBlocked: blocked only when offline and not an offline module', () => {
  const offline = ['atlas.ledger'];
  assert.equal(isModuleOfflineBlocked(false, { key: 'atlas.hr' }, offline), true);
  assert.equal(isModuleOfflineBlocked(false, { key: 'atlas.ledger' }, offline), false);
  assert.equal(isModuleOfflineBlocked(true, { key: 'atlas.hr' }, offline), false);
});

test('resolveMenuAnchor: reads a mouse event and calls preventDefault', () => {
  let prevented = 0;
  const anchor = resolveMenuAnchor({ clientX: 40, clientY: 90, preventDefault: () => { prevented++; } });
  assert.deepEqual(anchor, { x: 40, y: 90 });
  assert.equal(prevented, 1);
});

test('resolveMenuAnchor: reads a plain coords object', () => {
  assert.deepEqual(resolveMenuAnchor({ x: 5, y: 6 }), { x: 5, y: 6 });
});

test('resolveMenuAnchor: returns null for missing/invalid input', () => {
  assert.equal(resolveMenuAnchor(null), null);
  assert.equal(resolveMenuAnchor({}), null);
  assert.equal(resolveMenuAnchor({ x: 'a', y: 2 }), null);
});

test('clampMenuToViewport: keeps the menu fully on screen', () => {
  const r = clampMenuToViewport({ x: 990, y: 780 }, { width: 200, height: 120 }, { width: 1000, height: 800 });
  assert.deepEqual(r, { left: 792, top: 672 });
});

test('clampMenuToViewport: does not push past the top-left margin', () => {
  const r = clampMenuToViewport({ x: 0, y: 0 }, { width: 200, height: 120 }, { width: 1000, height: 800 });
  assert.deepEqual(r, { left: 8, top: 8 });
});

test('favoriteToggleLabel', () => {
  assert.equal(favoriteToggleLabel(true), 'Quitar de favoritos');
  assert.equal(favoriteToggleLabel(false), 'Agregar a favoritos');
});

test('shouldOpenInNewTab: modifier keys / middle click', () => {
  assert.equal(shouldOpenInNewTab({ ctrlKey: true }), true);
  assert.equal(shouldOpenInNewTab({ metaKey: true }), true);
  assert.equal(shouldOpenInNewTab({ button: 1 }), true);
  assert.equal(shouldOpenInNewTab({ button: 0 }), false);
  assert.equal(shouldOpenInNewTab(null), false);
});

test('isCoarsePointer: false when matchMedia is unavailable', () => {
  const had = 'window' in globalThis;
  const prev = globalThis.window;
  globalThis.window = {};
  assert.equal(isCoarsePointer(), false);
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  assert.equal(isCoarsePointer(), true);
  if (had) globalThis.window = prev; else delete globalThis.window;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/desktop/src/lib/__tests__/moduleLauncher.test.js`
Expected: FAIL — `Cannot find module '../moduleLauncher.js'`.

- [ ] **Step 3: Write the implementation**

Create `apps/desktop/src/lib/moduleLauncher.js`:

```js
// Pure helpers shared by useModuleLauncher, ModuleCard and AppContextMenu.
// No React / DOM dependencies so they can be unit-tested with `node --test`.

const MENU_MARGIN = 8;

export function isModuleOfflineBlocked(isOnline, module, offlineModules) {
  return !isOnline && !offlineModules.includes(module.key);
}

// Accepts a mouse/pointer event ({clientX,clientY}) or a plain {x,y} object.
// Calls preventDefault() when given an event. Returns {x,y} or null.
export function resolveMenuAnchor(input) {
  if (!input) return null;
  if (typeof input.preventDefault === 'function') input.preventDefault();
  const x = Number.isFinite(input.clientX) ? input.clientX : input.x;
  const y = Number.isFinite(input.clientY) ? input.clientY : input.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

// Given a desired top-left anchor, the menu size and the viewport size,
// return {left, top} that keeps the menu fully visible with a small margin.
export function clampMenuToViewport(anchor, size, viewport, margin = MENU_MARGIN) {
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const maxTop = Math.max(margin, viewport.height - size.height - margin);
  return {
    left: Math.min(Math.max(margin, anchor.x), maxLeft),
    top: Math.min(Math.max(margin, anchor.y), maxTop),
  };
}

export function favoriteToggleLabel(isFavorite) {
  return isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos';
}

export function shouldOpenInNewTab(e) {
  return Boolean(e && (e.ctrlKey || e.metaKey || e.button === 1));
}

export function isCoarsePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/desktop/src/lib/__tests__/moduleLauncher.test.js`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/moduleLauncher.js apps/desktop/src/lib/__tests__/moduleLauncher.test.js
git commit -m "feat(launcher): pure helpers for module launcher favorites logic"
```

---

## Task 2: `ignoreInteractiveTarget` option on `useLongPress`

**Files:**
- Modify: `packages/ui/src/hooks/useLongPress.js`
- Test: `packages/ui/src/hooks/__tests__/useLongPress.test.js`

- [ ] **Step 1: Add the failing test**

Append inside the `describe("createLongPressController", ...)` block in `packages/ui/src/hooks/__tests__/useLongPress.test.js`:

```js
  it("fires on an interactive target when ignoreInteractiveTarget is set", () => {
    let fired = 0;
    let fn = null;
    const ctrl = createLongPressController({
      delay: 450,
      moveTolerance: 10,
      ignoreInteractiveTarget: true,
      onLongPress: () => { fired++; },
      schedule: (f) => { fn = f; return 1; },
      cancelScheduled: () => { fn = null; },
      vibrate: () => {},
    });
    ctrl.onPointerDown(evt(0, 0, "BUTTON"));
    assert.equal(ctrl.pending, true);
    fn();
    assert.equal(fired, 1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/ui/src/hooks/__tests__/useLongPress.test.js`
Expected: FAIL — `ctrl.pending` is `false` (guard still rejects the `BUTTON` target).

- [ ] **Step 3: Implement the option**

In `packages/ui/src/hooks/useLongPress.js`:

Change the `createLongPressController` signature to add `ignoreInteractiveTarget = false`:

```js
export function createLongPressController({
  delay = 450,
  moveTolerance = 10,
  ignoreInteractiveTarget = false,
  onLongPress,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancelScheduled = (id) => clearTimeout(id),
  vibrate = (ms) => { try { navigator?.vibrate?.(ms); } catch { /* unsupported */ } },
} = {}) {
```

In the returned `onPointerDown`, change the guard line:

```js
    onPointerDown(e) {
      if (!ignoreInteractiveTarget && isInteractiveTarget(e?.target)) return;
      start = { x: e.clientX, y: e.clientY };
```

Change the `useLongPress` signature and pass-through + deps:

```js
export function useLongPress({ onLongPress, delay = 450, moveTolerance = 10, disabled = false, ignoreInteractiveTarget = false } = {}) {
  const cb = useRef(onLongPress);
  cb.current = onLongPress;

  return useMemo(() => {
    if (disabled) return {};
    const ctrl = createLongPressController({
      delay,
      moveTolerance,
      ignoreInteractiveTarget,
      onLongPress: (e) => cb.current?.(e),
    });
    return {
      onPointerDown: (e) => ctrl.onPointerDown(e),
      onPointerMove: (e) => ctrl.onPointerMove(e),
      onPointerUp: () => ctrl.onPointerUp(),
      onPointerCancel: () => ctrl.onPointerCancel(),
    };
  }, [delay, moveTolerance, disabled, ignoreInteractiveTarget]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/ui/src/hooks/__tests__/useLongPress.test.js`
Expected: PASS — all tests green, including the new one.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/hooks/useLongPress.js packages/ui/src/hooks/__tests__/useLongPress.test.js
git commit -m "feat(ui): useLongPress ignoreInteractiveTarget opt-out"
```

---

## Task 3: Flip `favoritesFirst` default to `true`

**Files:**
- Modify: `apps/desktop/src/hooks/useAppViewPrefs.js:6-13`
- Test: `apps/desktop/src/hooks/__tests__/useAppViewPrefs-defaults.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/hooks/__tests__/useAppViewPrefs-defaults.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../useAppViewPrefs.js';

test('favoritesFirst defaults to true so favorites surface without a toggle', () => {
  assert.equal(DEFAULTS.favoritesFirst, true);
});

test('other view defaults are unchanged', () => {
  assert.equal(DEFAULTS.sortMode, 'az');
  assert.equal(DEFAULTS.viewMode, 'cards');
  assert.deepEqual(DEFAULTS.favorites, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/desktop/src/hooks/__tests__/useAppViewPrefs-defaults.test.js`
Expected: FAIL — `DEFAULTS` is not exported (`undefined`), first assertion throws.

- [ ] **Step 3: Implement**

In `apps/desktop/src/hooks/useAppViewPrefs.js`, change the `DEFAULTS` declaration to be exported and flip the flag:

```js
export const DEFAULTS = {
  sortMode: "az",
  viewMode: "cards",
  favoritesFirst: true,
  favorites: [],
};
```

Leave the rest of the file unchanged (the `const DEFAULTS = { ... }` becomes `export const DEFAULTS = { ... }`; `favoritesFirst: false` becomes `favoritesFirst: true`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/desktop/src/hooks/__tests__/useAppViewPrefs-defaults.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/hooks/useAppViewPrefs.js apps/desktop/src/hooks/__tests__/useAppViewPrefs-defaults.test.js
git commit -m "feat(launcher): favoritesFirst on by default"
```

---

## Task 4: `useModuleLauncher` hook

**Files:**
- Create: `apps/desktop/src/hooks/useModuleLauncher.js`

No dedicated unit test: this is thin glue over `useAppViewPrefs` (react-query), `useOfflineStore` (zustand) and `useNavigate` (router), none of which the repo mounts in `node --test`. Its logic lives in the Task 1 helpers, which are tested. It is exercised end-to-end by the manual QA in Task 10.

- [ ] **Step 1: Write the hook**

Create `apps/desktop/src/hooks/useModuleLauncher.js`:

```js
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOfflineStore, OFFLINE_MODULES } from "@atlas/offline";
import { getModuleLaunchPath, getSortedDisplay } from "../lib/runtimeModules";
import { isModuleOfflineBlocked, resolveMenuAnchor } from "../lib/moduleLauncher";
import { useAppViewPrefs } from "./useAppViewPrefs";

// Shared launcher behavior for HomeScreen and AppLauncher:
// section building, offline-blocking, context-menu state, favorite toggle, navigation.
export function useModuleLauncher(modules) {
  const navigate = useNavigate();
  const {
    sortMode,
    viewMode,
    favorites,
    favoritesFirst,
    isFavorite,
    toggleFavorite,
  } = useAppViewPrefs();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const [contextMenu, setContextMenu] = useState(null);

  const isOfflineBlocked = useCallback(
    (module) => isModuleOfflineBlocked(isOnline, module, OFFLINE_MODULES),
    [isOnline],
  );

  const sections = useMemo(
    () => getSortedDisplay(modules, { sortMode, favorites, favoritesFirst }),
    [modules, sortMode, favorites, favoritesFirst],
  );

  // input: a mouse/pointer event OR a plain {x,y} object (from long-press).
  const openMenu = useCallback((input, moduleKey) => {
    const anchor = resolveMenuAnchor(input);
    if (!anchor) return;
    setContextMenu({ x: anchor.x, y: anchor.y, moduleKey });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const launch = useCallback(
    (module, opts = {}) => {
      if (isModuleOfflineBlocked(isOnline, module, OFFLINE_MODULES)) return;
      navigate(getModuleLaunchPath(module));
      opts.onDone?.();
    },
    [isOnline, navigate],
  );

  return {
    sections,
    viewMode,
    isOfflineBlocked,
    contextMenu,
    openMenu,
    closeMenu,
    isFavorite,
    toggleFavorite,
    launch,
  };
}
```

- [ ] **Step 2: Static check**

Run: `node --check apps/desktop/src/hooks/useModuleLauncher.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/hooks/useModuleLauncher.js
git commit -m "feat(launcher): useModuleLauncher shared hook"
```

---

## Task 5: `ModuleCard` — star toggle, anchor rendering, long-press

**Files:**
- Modify: `apps/desktop/src/components/ModuleCard.jsx`

This task has no new unit test (the repo does not render components under `node --test`); correctness relies on the Task 1 helpers (`favoriteToggleLabel`, `shouldOpenInNewTab`, `isCoarsePointer`) and the Task 10 manual QA. Keep the two exported components below 1000 lines total for the file (currently 325 lines — fine).

- [ ] **Step 1: Add imports**

At the top of `apps/desktop/src/components/ModuleCard.jsx`, after the existing lucide import block, add:

```js
import { useLongPress } from "@atlas/ui";
import { useRef } from "react";
import {
  favoriteToggleLabel,
  shouldOpenInNewTab,
  isCoarsePointer,
} from "../lib/moduleLauncher";
```

(`cn` is already imported from `@atlas/ui`; leave that line as-is. If `@atlas/ui` already appears in one import, merge `useLongPress` into it instead of adding a second line.)

- [ ] **Step 2: Add a shared `FavoriteStarButton` sub-component**

Add this above `ModuleCardGrid` in `ModuleCard.jsx`:

```js
// ---- FavoriteStarButton: always-visible star toggle used on cards/rows ----
function FavoriteStarButton({ moduleKey, isFavorite, onToggleFavorite, className }) {
  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={favoriteToggleLabel(isFavorite)}
      title={favoriteToggleLabel(isFavorite)}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite(moduleKey);
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-amber-400 cursor-pointer",
        className,
      )}
    >
      <Star
        size={14}
        className={isFavorite ? "text-amber-400 fill-amber-400" : ""}
      />
    </button>
  );
}
```

- [ ] **Step 3: Add a long-press + click-suppression helper hook**

Add above `ModuleCardGrid` in `ModuleCard.jsx`:

```js
// Wires long-press -> onLongPress({x,y}, key) on coarse pointers only, and
// returns a `suppressClick` ref + guard so the post-long-press click does not
// also navigate.
function useCardLongPress(moduleKey, onLongPress) {
  const suppressClick = useRef(false);
  const handlers = useLongPress({
    disabled: !onLongPress || !isCoarsePointer(),
    ignoreInteractiveTarget: true,
    onLongPress: (e) => {
      suppressClick.current = true;
      onLongPress?.({ x: e.clientX, y: e.clientY }, moduleKey);
    },
  });
  const wrapped = {
    ...handlers,
    onPointerDown: (e) => {
      suppressClick.current = false;
      handlers.onPointerDown?.(e);
    },
  };
  const guardClick = (e, run) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      return;
    }
    run();
  };
  return { longPressHandlers: wrapped, guardClick };
}
```

- [ ] **Step 4: Rewrite `ModuleCardGrid`**

Replace the whole `export function ModuleCardGrid({...}) { ... }` in `ModuleCard.jsx` with:

```js
// ---- ModuleCardGrid: grid card for navigation (HomeScreen, AppLauncher) ----
export function ModuleCardGrid({
  module,
  onClick,
  onContextMenu,
  onToggleFavorite,
  onLongPress,
  href,
  isFavorite,
  isOfflineBlocked,
}) {
  const visuals = resolveModuleVisuals(module);
  const { color, accentColor } = visuals;
  const { longPressHandlers, guardClick } = useCardLongPress(module.key, onLongPress);

  const rootClass = cn(
    "group relative flex flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden text-left transition-all duration-200",
    isOfflineBlocked
      ? "opacity-40 cursor-not-allowed pointer-events-none"
      : "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]",
  );

  const inner = (
    <>
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
        {isOfflineBlocked ? (
          <WifiOff
            size={11}
            className="absolute top-3 right-3 text-[hsl(var(--muted-foreground))]"
          />
        ) : (
          <FavoriteStarButton
            moduleKey={module.key}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            className="absolute top-1.5 right-1.5 z-20"
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
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        onContextMenu={onContextMenu}
        {...longPressHandlers}
        onClick={(e) => {
          if (shouldOpenInNewTab(e)) return;
          e.preventDefault();
          guardClick(e, () => onClick?.());
        }}
        aria-disabled={isOfflineBlocked || undefined}
        className={rootClass}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      onContextMenu={onContextMenu}
      {...longPressHandlers}
      onClick={(e) => guardClick(e, () => onClick?.())}
      disabled={isOfflineBlocked}
      className={rootClass}
    >
      {inner}
    </button>
  );
}
```

- [ ] **Step 5: Rewrite `ModuleListRow`**

Replace the whole `export function ModuleListRow({...}) { ... }` in `ModuleCard.jsx` with:

```js
// ---- ModuleListRow: list row for navigation (HomeScreen, AppLauncher) ----
export function ModuleListRow({
  module,
  onClick,
  onContextMenu,
  onToggleFavorite,
  onLongPress,
  href,
  isFavorite,
  isOfflineBlocked,
}) {
  const { longPressHandlers, guardClick } = useCardLongPress(module.key, onLongPress);

  const rootClass = cn(
    "flex items-center gap-4 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-200 px-4 py-3 text-left",
    isOfflineBlocked
      ? "opacity-40 cursor-not-allowed pointer-events-none"
      : "cursor-pointer hover:shadow-sm hover:border-[hsl(var(--muted-foreground))]/30 active:scale-[0.99]",
  );

  const inner = (
    <>
      <ModuleIcon module={module} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-tight">
          {module.name}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
          {module.summary || module.description}
        </p>
      </div>
      {isOfflineBlocked ? (
        <WifiOff
          size={13}
          className="text-[hsl(var(--muted-foreground))] shrink-0"
        />
      ) : (
        <FavoriteStarButton
          moduleKey={module.key}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          className="shrink-0 -mr-1"
        />
      )}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        onContextMenu={onContextMenu}
        {...longPressHandlers}
        onClick={(e) => {
          if (shouldOpenInNewTab(e)) return;
          e.preventDefault();
          guardClick(e, () => onClick?.());
        }}
        aria-disabled={isOfflineBlocked || undefined}
        className={rootClass}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      onContextMenu={onContextMenu}
      {...longPressHandlers}
      onClick={(e) => guardClick(e, () => onClick?.())}
      disabled={isOfflineBlocked}
      className={rootClass}
    >
      {inner}
    </button>
  );
}
```

- [ ] **Step 6: Static check + lint**

Run: `node --check apps/desktop/src/components/ModuleCard.jsx`
Expected: no output.

Run: `pnpm lint --filter @atlas/desktop` (or `pnpm lint` if no filter is configured)
Expected: no errors for `ModuleCard.jsx`.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/components/ModuleCard.jsx
git commit -m "feat(launcher): star toggle + long-press + anchor rendering on module cards"
```

---

## Task 6: Clamp `AppContextMenu` to the viewport

**Files:**
- Modify: `apps/desktop/src/components/AppContextMenu.jsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `apps/desktop/src/components/AppContextMenu.jsx` with:

```js
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Star, StarOff } from 'lucide-react';
import { useAppViewPrefs } from '../hooks/useAppViewPrefs';
import { clampMenuToViewport } from '../lib/moduleLauncher';

export function AppContextMenu({ x, y, moduleKey, onClose }) {
  const { isFavorite, toggleFavorite } = useAppViewPrefs();
  const ref = useRef(null);
  const fav = isFavorite(moduleKey);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    setPos(
      clampMenuToViewport(
        { x, y },
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [x, y]);

  useEffect(() => {
    function handleDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[300] bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg py-1 min-w-[190px]"
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        onClick={() => {
          toggleFavorite(moduleKey);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer text-left"
      >
        {fav ? (
          <StarOff size={14} className="text-amber-400 shrink-0" />
        ) : (
          <Star size={14} className="shrink-0" />
        )}
        {fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Static check**

Run: `node --check apps/desktop/src/components/AppContextMenu.jsx`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/AppContextMenu.jsx
git commit -m "fix(launcher): keep context menu inside the viewport"
```

---

## Task 7: `HomeScreen` — consume the hook, delete the quick-access block

**Files:**
- Modify: `apps/desktop/src/app/HomeScreen.jsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `apps/desktop/src/app/HomeScreen.jsx` with:

```jsx
import { WifiOff } from "lucide-react";
import { Skeleton, Separator } from "@atlas/ui";
import { useAuth } from "../auth/AuthProvider";
import { useRuntimeModules } from "./useRuntimeModules";
import { useModuleLauncher } from "../hooks/useModuleLauncher";
import { AppViewControls } from "../components/AppViewControls";
import { AppContextMenu } from "../components/AppContextMenu";
import { ModuleCardGrid, ModuleListRow } from "../components/ModuleCard";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getSpanishDate() {
  try {
    const str = new Date().toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    return new Date().toLocaleDateString();
  }
}

export function HomeScreen() {
  const { userProfile } = useAuth();
  const {
    availableModules,
    isLoading: modulesLoading,
    isError: modulesError,
  } = useRuntimeModules();
  const {
    sections,
    viewMode,
    isOfflineBlocked,
    contextMenu,
    openMenu,
    closeMenu,
    isFavorite,
    toggleFavorite,
    launch,
  } = useModuleLauncher(availableModules);

  const firstName = userProfile?.firstName ?? userProfile?.displayName ?? "tú";

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:px-6 space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">
            {getSpanishDate()}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            {getGreeting()}, {firstName}.
          </h1>
        </div>
        {modulesError && (
          <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1 shrink-0">
            <WifiOff size={11} />
            Sin conexión al servidor
          </div>
        )}
      </div>

      {/* Aplicaciones */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))] shrink-0">
            Aplicaciones
          </h2>
          <Separator className="flex-1 min-w-8" />
          <AppViewControls />
        </div>

        <div className="space-y-8">
          {modulesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            sections.map((section, si) => (
              <div key={section.label ?? `section-${si}`}>
                {section.label && (
                  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
                    {section.label}
                  </p>
                )}
                {viewMode === "list" ? (
                  <div className="flex flex-col gap-1.5">
                    {section.modules.map((module) => (
                      <ModuleListRow
                        key={module.key}
                        module={module}
                        onClick={() => launch(module)}
                        onContextMenu={(e) => openMenu(e, module.key)}
                        onLongPress={openMenu}
                        onToggleFavorite={toggleFavorite}
                        isFavorite={isFavorite(module.key)}
                        isOfflineBlocked={isOfflineBlocked(module)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {section.modules.map((module) => (
                      <ModuleCardGrid
                        key={module.key}
                        module={module}
                        onClick={() => launch(module)}
                        onContextMenu={(e) => openMenu(e, module.key)}
                        onLongPress={openMenu}
                        onToggleFavorite={toggleFavorite}
                        isFavorite={isFavorite(module.key)}
                        isOfflineBlocked={isOfflineBlocked(module)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {!modulesLoading && availableModules.length === 0 && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No hay aplicaciones disponibles.
            </p>
          )}
        </div>
      </div>

      {contextMenu && (
        <AppContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          moduleKey={contextMenu.moduleKey}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
```

Note: `onLongPress={openMenu}` works because `ModuleCard` calls `onLongPress({x, y}, module.key)` and `openMenu(input, moduleKey)` accepts a `{x,y}` object as `input`.

- [ ] **Step 2: Static check + lint**

Run: `node --check apps/desktop/src/app/HomeScreen.jsx`
Expected: no output.

Run: `pnpm lint` (or the desktop-filtered lint)
Expected: no errors for `HomeScreen.jsx` — in particular no unused-import warnings (`useState`, `useMemo`, `useCallback`, `Star`, `Zap`, `cn`, `useOfflineStore`, `OFFLINE_MODULES`, `getModuleLaunchPath`, `getSortedDisplay`, `useAppViewPrefs`, `ModuleIcon` are all gone).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/app/HomeScreen.jsx
git commit -m "refactor(home): use useModuleLauncher, drop Acceso rapido block"
```

---

## Task 8: `AppLauncher` — consume the hook, use canonical cards

**Files:**
- Modify: `apps/desktop/src/components/AppLauncher.jsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `apps/desktop/src/components/AppLauncher.jsx` with:

```jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Home } from 'lucide-react';
import { useLauncherStore } from '../stores/launcher';
import { getModuleLaunchPath } from '../lib/runtimeModules';
import { useRuntimeModules } from '../app/useRuntimeModules';
import { useModuleLauncher } from '../hooks/useModuleLauncher';
import { AppViewControls } from './AppViewControls';
import { AppContextMenu } from './AppContextMenu';
import { ModuleCardGrid, ModuleListRow } from './ModuleCard';

export function AppLauncher() {
  const { isOpen, closeLauncher, toggleLauncher } = useLauncherStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { availableModules } = useRuntimeModules();
  const {
    sections,
    viewMode,
    isOfflineBlocked,
    contextMenu,
    openMenu,
    closeMenu,
    isFavorite,
    toggleFavorite,
    launch,
  } = useModuleLauncher(availableModules);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return availableModules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.summary ?? '').toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q),
    );
  }, [query, availableModules]);

  const displaySections = filtered
    ? [{ label: null, modules: filtered }]
    : sections;

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        if (contextMenu) { closeMenu(); return; }
        closeLauncher();
        setQuery('');
      }
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        toggleLauncher();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [closeLauncher, toggleLauncher, contextMenu, closeMenu]);

  function handleLaunch(module) {
    launch(module, {
      onDone: () => {
        closeLauncher();
        setQuery('');
      },
    });
  }

  function handleGoHome() {
    navigate('/app/home');
    closeLauncher();
    setQuery('');
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-100 flex items-start justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { closeLauncher(); setQuery(''); }}
          />

          <motion.div
            className="relative glass-strong rounded-2xl w-full max-w-2xl mx-4 mt-[10dvh] max-h-[80dvh] flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Search header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
              <Search size={15} className="text-[hsl(var(--muted-foreground))] shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar aplicación..."
                className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
              />
              <button
                onClick={handleGoHome}
                className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer text-xs font-medium"
              >
                <Home size={13} />
                Inicio
              </button>
              <button
                onClick={() => { closeLauncher(); setQuery(''); }}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Controls bar (hidden during search) */}
            {!query.trim() && (
              <AppViewControls className="px-4 py-2 border-b border-[hsl(var(--border))] shrink-0" />
            )}

            {/* Module list */}
            <div className="overflow-y-auto overscroll-contain touch-pan-y flex-1 px-4 py-4 space-y-5">
              {displaySections.every((s) => s.modules.length === 0) ? (
                <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">
                  {query.trim() ? `Sin resultados para "${query}"` : 'No hay aplicaciones disponibles.'}
                </p>
              ) : (
                displaySections.map((section, si) => (
                  <div key={section.label ?? `section-${si}`}>
                    {section.label && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
                        {section.label}
                      </p>
                    )}
                    {viewMode === 'list' ? (
                      <div className="flex flex-col gap-1.5">
                        {section.modules.map((module) => (
                          <ModuleListRow
                            key={module.key}
                            module={module}
                            href={getModuleLaunchPath(module)}
                            onClick={() => handleLaunch(module)}
                            onContextMenu={(e) => openMenu(e, module.key)}
                            onLongPress={openMenu}
                            onToggleFavorite={toggleFavorite}
                            isFavorite={isFavorite(module.key)}
                            isOfflineBlocked={isOfflineBlocked(module)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {section.modules.map((module) => (
                          <ModuleCardGrid
                            key={module.key}
                            module={module}
                            href={getModuleLaunchPath(module)}
                            onClick={() => handleLaunch(module)}
                            onContextMenu={(e) => openMenu(e, module.key)}
                            onLongPress={openMenu}
                            onToggleFavorite={toggleFavorite}
                            isFavorite={isFavorite(module.key)}
                            isOfflineBlocked={isOfflineBlocked(module)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {contextMenu && (
            <AppContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              moduleKey={contextMenu.moduleKey}
              onClose={closeMenu}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

Notes:
- `navigate` (from `useNavigate()`) is still used by `handleGoHome`; `launch` handles module navigation.
- During search, `filtered` is a plain array and `displaySections` is a single unlabeled section, so `favoritesFirst` grouping never applies to search results (matches current behavior).
- The grid is `grid-cols-2 sm:grid-cols-3` (was `grid-cols-3 sm:grid-cols-4`) because `ModuleCardGrid` is taller than the old compact launcher tile.

- [ ] **Step 2: Static check + lint**

Run: `node --check apps/desktop/src/components/AppLauncher.jsx`
Expected: no output.

Run: `pnpm lint`
Expected: no errors for `AppLauncher.jsx`; no unused imports (`ModIcon`, `Star`, `WifiOff`, `useCallback`, `getSortedDisplay`, `useAppViewPrefs`, `useOfflineStore`, `OFFLINE_MODULES` are all gone).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/AppLauncher.jsx
git commit -m "refactor(launcher): use useModuleLauncher + canonical module cards"
```

---

## Task 9: Delete the dead `ModIcon.jsx`

**Files:**
- Delete: `apps/desktop/src/components/ModIcon.jsx`

- [ ] **Step 1: Verify no remaining consumers**

Run:
```bash
grep -rn "components/ModIcon\|from './ModIcon'\|from \"./ModIcon\"\|\bModIcon\b" apps/desktop/src packages modules --include=*.js --include=*.jsx
```
Expected: no matches (the `ICON_MAP` consts in `CommandPalette.jsx`, `AtlasDetail.jsx`, `ModuleSidebar.jsx` are their own local declarations and do NOT import from `ModIcon.jsx`; confirm none of those lines contain `ModIcon`).

If any match references `ModIcon.jsx`, STOP and leave the file; note the consumer in the commit message of Task 8 instead.

- [ ] **Step 2: Delete the file**

```bash
git rm apps/desktop/src/components/ModIcon.jsx
```

- [ ] **Step 3: Build check**

Run: `pnpm --filter @atlas/desktop build` (or `pnpm build`)
Expected: build succeeds — no "Could not resolve './ModIcon'".

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(launcher): remove dead ModIcon component"
```

---

## Task 10: Full verification + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run the full desktop test suite**

Run:
```bash
node --test apps/desktop/src/lib/__tests__/ apps/desktop/src/hooks/__tests__/ packages/ui/src/hooks/__tests__/
```
Expected: all tests pass, including `moduleLauncher.test.js`, `useAppViewPrefs-defaults.test.js`, `useLongPress.test.js`, `sortModules.test.js`.

- [ ] **Step 2: Lint + build**

Run: `pnpm lint`
Expected: no new errors.

Run: `pnpm build`
Expected: success.

- [ ] **Step 3: Manual QA — start the app**

Run: `pnpm dev` and open `http://localhost:5173`.

- [ ] **Step 4: Desktop viewport (1440px) checks**

Screenshot HomeScreen (cards) and HomeScreen (list, toggle via `AppViewControls`):
- [ ] No "Acceso rápido" / "Favoritos" / "Recientes" block — only header + "Aplicaciones".
- [ ] Every card/row shows a star button; filled amber for favorites, outline otherwise.
- [ ] Clicking the star toggles favorite and does NOT navigate; the module jumps in/out of the "Favoritos" section (favoritesFirst defaults on).
- [ ] Right-click a card still opens `AppContextMenu` with the correct "Agregar/Quitar de favoritos" label.
- [ ] Open `AppLauncher` (Ctrl+.) — cards render via the canonical card component, star toggle works, search still filters, favorites section hidden while searching.
- [ ] Ctrl/Cmd/middle-click a launcher card opens the module in a new tab.

- [ ] **Step 5: Mobile viewport (390px) checks (touch emulation on)**

Screenshot HomeScreen (cards + list) and AppLauncher (cards + list):
- [ ] Star button is visible and ≥ ~32px hit target; tapping toggles favorite without navigating.
- [ ] Long-press (~0.5s) on a card opens `AppContextMenu` near the touch point, fully on screen even near the right/bottom edge; the follow-up tap does NOT also navigate.
- [ ] Normal tap navigates to the module.
- [ ] No horizontal scroll on the body at 390px.

- [ ] **Step 6: Update memory / TASKS if applicable**

If `docs/TASKS.md` tracks launcher/home polish items, tick the relevant line with `Verified: 2026-08-31 (favorites touch + unification)`.

- [ ] **Step 7: Final commit (if QA required tweaks)**

```bash
git add -A
git commit -m "test(launcher): verify favorites touch + unification QA"
```

---

## Self-Review

**Spec coverage:**
- Touch star button (always visible, all viewports) → Task 5 (`FavoriteStarButton`).
- Long-press opens menu → Task 2 (`ignoreInteractiveTarget`) + Task 5 (`useCardLongPress`).
- Shared behavior hook (`isOfflineBlocked`, `sections`, menu state, favorite toggle, launch) → Task 4.
- Single card family (AppLauncher drops bespoke markup + `ModIcon`) → Task 8, Task 9.
- Single favorites surface: remove "Acceso rápido", keep `favoritesFirst` → Task 7; default flip → Task 3.
- Remove Recientes + `trackModuleVisit` + `atlas-module-visits` → Task 7.
- `AppContextMenu` viewport clamp → Task 6.
- `<a href>` open-in-new-tab preserved → Task 5 (`shouldOpenInNewTab`) + Task 8 (`href` prop).
- Tests: helpers unit-tested → Task 1; `useLongPress` option → Task 2; default flip → Task 3. `useModuleLauncher` and `ModuleCard` covered by helper tests + manual QA (repo has no component renderer under `node --test`) — matches existing convention.
- QA at 390 + 1440 → Task 10.

**Placeholder scan:** none. Task 8 contains an explicit "STOP — this indirection is wrong" correction with the corrected import block and body spelled out in full, so an out-of-order reader still has complete code.

**Type consistency:**
- `openMenu(input, moduleKey)` — `input` is an event or `{x,y}`; `resolveMenuAnchor` handles both. `ModuleCard` calls `onLongPress({x,y}, key)`; screens pass `onLongPress={openMenu}`. Consistent.
- `launch(module, { onDone })` — used in Task 4 def, Task 7 (`launch(module)`), Task 8 (`launch(module, { onDone })`). Consistent.
- `useModuleLauncher` return keys (`sections, viewMode, isOfflineBlocked, contextMenu, openMenu, closeMenu, isFavorite, toggleFavorite, launch`) — same destructuring in Tasks 7 and 8.
- `FavoriteStarButton` props (`moduleKey, isFavorite, onToggleFavorite, className`) — same in grid and list usage.
- `clampMenuToViewport(anchor, size, viewport, margin?)` — Task 1 def matches Task 6 call `clampMenuToViewport({x,y}, {width,height}, {width,height})`.

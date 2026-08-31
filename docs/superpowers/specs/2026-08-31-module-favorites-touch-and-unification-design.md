# Module favorites: touch support + logic unification

Date: 2026-08-31
Status: Approved (design)
Area: `apps/desktop` — app launcher / home screen

## Problem

1. **No way to favorite/unfavorite on touch.** Adding or removing a module
   favorite is only reachable through the right-click context menu
   (`onContextMenu`). Touch devices have no right-click, so mobile users cannot
   manage favorites at all.
2. **Favorites logic is duplicated.** Three separate duplications exist:
   - `HomeScreen.jsx` and `AppLauncher.jsx` each re-implement `isOfflineBlocked`,
     `handleContextMenu`, context-menu state, the `getSortedDisplay` `sections`
     memo, and the favorite toggle wiring.
   - Two card families render the same concept: `ModuleCard.jsx`
     (`ModuleCardGrid` / `ModuleListRow`, used by `HomeScreen`) versus
     `AppLauncher`'s own inline `<a>` markup with `ModIcon`.
   - Two "Favoritos" surfaces: the fixed "Acceso rápido › Favoritos" block in
     `HomeScreen` **and** the `favoritesFirst` toggle in `AppViewControls` that
     produces a separate "Favoritos" section via `getSortedDisplay`.

## Decisions (from brainstorming)

- **Touch affordance:** always-visible star toggle button on every card/row
  **plus** long-press to open the context menu (option D).
- **Star visibility:** always visible on all viewports (mobile and desktop). The
  current passive star badge merges into this interactive button.
- **Unification scope:** full — shared hook, single card family, single favorites
  surface.
- **Favorites surface that stays:** only the `favoritesFirst` toggle / section.
  The fixed "Acceso rápido" block is removed.
- **Recientes:** removed entirely along with the rest of the "Acceso rápido"
  block. `HomeScreen` keeps only its header + "Aplicaciones".

## Approach

Shared behavior hook + one canonical presentational card family. Each screen
keeps its own grid wrapper and column counts; only behavior and card rendering
are centralized. Rejected: a single `<ModuleGrid>` component (too rigid for
`AppLauncher`'s search layout and 3/4-column grid).

## Components and changes

### 1. `useModuleLauncher({ modules })` — new hook

Location: `apps/desktop/src/hooks/useModuleLauncher.js`

Centralizes what `HomeScreen` and `AppLauncher` currently duplicate:

- `isOfflineBlocked(module)` — from `useOfflineStore` + `OFFLINE_MODULES`.
- `sections` — `getSortedDisplay(modules, { sortMode, favorites, favoritesFirst })`
  with values read from `useAppViewPrefs()`.
- Context-menu state: `contextMenu` (`{ x, y, moduleKey } | null`),
  `openMenu(coords, moduleKey)`, `closeMenu()`. `openMenu` accepts either a
  mouse/pointer event or an explicit `{ x, y }` (long-press supplies coords).
- `toggleFavorite(key)` / `isFavorite(key)` — re-exposed from `useAppViewPrefs`.
- `launch(module, { onDone } = {})` — guards `isOfflineBlocked`, then
  `navigate(getModuleLaunchPath(module))`, then calls optional `onDone`
  (`AppLauncher` passes a callback that closes the launcher and clears its
  query).

Returns: `{ sections, isOfflineBlocked, contextMenu, openMenu, closeMenu,
toggleFavorite, isFavorite, launch }`.

Consumers still call `useAppViewPrefs` directly for `viewMode` (view rendering
choice stays in the screen).

### 2. `ModuleCard.jsx` — extend `ModuleCardGrid` and `ModuleListRow`

New props on both: `onToggleFavorite(key)`, `onLongPress(coords, key)`,
`href` (optional).

- **Element:** render as `<a href={href}>` when `href` is provided, else
  `<button>` (current behavior). The `<a>` path guards
  `e.ctrlKey || e.metaKey || e.button === 1` and lets the browser open a new tab;
  otherwise `preventDefault` and call `onClick`. This preserves `AppLauncher`'s
  open-in-new-tab behavior.
- **Star toggle button:** always rendered (replaces the passive star badge in the
  same visual slot — top-right on grid, trailing on list).
  - Nested `<button type="button">` with `onClick` that calls
    `e.preventDefault()` + `e.stopPropagation()` then `onToggleFavorite(module.key)`.
  - Filled amber `Star` when favorite, outline `Star` when not.
  - `aria-pressed={isFavorite}`, `aria-label` = `"Quitar de favoritos"` /
    `"Agregar a favoritos"`.
  - Hit target ≥ 32×32 px (padding around the 11–13px icon) for touch.
  - When `isOfflineBlocked`: star hidden, `WifiOff` shown instead (current
    behavior).
- **Long-press:** a small purpose-built handler in `ModuleCard.jsx` (not the
  shared `@atlas/ui` `useLongPress`, whose interactive-target guard suppresses
  long-press on `<button>`/`<a>` hosts). Behavior: on `pointerdown` start a
  ~450ms timer; cancel on `pointermove` beyond ~10px, `pointerup`, or
  `pointercancel`; on fire call `navigator.vibrate?.(10)` and
  `onLongPress({ x, y }, module.key)`. Only arms when
  `window.matchMedia('(pointer: coarse)').matches` so mouse users are
  unaffected. The star button's own `pointerdown` stops propagation so
  long-pressing the star does not open the menu.

`ModuleIcon` is unchanged.

### 3. `AppContextMenu.jsx`

- Clamp the popover position to the viewport: after mount, measure the menu and
  shift `top` / `left` so it stays fully on screen (long-press near a screen edge
  on mobile must not overflow).
- Remains a popover (no `Sheet`). It is now the secondary path; the star button
  is primary.
- No dependency or API changes; still uses `useAppViewPrefs` internally.

### 4. `HomeScreen.jsx`

- Delete `trackModuleVisit`, all `atlas-module-visits` reads/writes,
  `recentModules`, `favoriteModules`, and the entire "Acceso rápido" block
  (Favoritos + Recientes JSX).
- Consume `useModuleLauncher({ modules: availableModules })`.
- Render `sections` with the extended `ModuleCardGrid` / `ModuleListRow`, passing
  `onClick={() => launch(module)}`, `onContextMenu={(e) => openMenu(e, module.key)}`,
  `onToggleFavorite={toggleFavorite}`, `onLongPress={openMenu}`,
  `isFavorite={isFavorite(module.key)}`, `isOfflineBlocked={isOfflineBlocked(module)}`.
- Keep the loading skeleton, empty state, `AppViewControls`, and the
  `<AppContextMenu>` render (driven by `contextMenu` / `closeMenu`).

### 5. `AppLauncher.jsx`

- Replace the bespoke `<a>` grid and list markup with `ModuleCardGrid` /
  `ModuleListRow`, passing `href={getModuleLaunchPath(module)}` and
  `onClick={() => launch(module, { onDone: () => { closeLauncher(); setQuery(''); } })}`.
- Consume `useModuleLauncher({ modules: filtered })`. Keep the local search
  `filtered` memo and the search-vs-sections branch; keep its own grid column
  counts (`grid-cols-3 sm:grid-cols-4` for cards) as the wrapper around the
  presentational cards.
- Remove the `ModIcon` import. After this change `ModIcon` has no remaining
  consumers — verify with a repo-wide search and delete `ModIcon.jsx` (~900
  lines) if confirmed unused; otherwise leave it and note the remaining
  consumer.
- Keep the Escape / Ctrl+. key handling and the `<AppContextMenu>` render.

### 6. `useAppViewPrefs.js`

- Change `DEFAULTS.favoritesFirst` from `false` to `true`. Favorites now only
  surface through this section, so it should be on by default. Users with a saved
  `app.view` preference keep their stored value (`{ ...DEFAULTS, ...data.value }`).

## Data flow

```
useAppViewPrefs (react-query pref "app.view")
  -> useModuleLauncher (sections, offline, menu state, favorite toggle, launch)
       -> HomeScreen / AppLauncher (own grid wrapper + viewMode)
            -> ModuleCardGrid / ModuleListRow (star button, long-press, nav)
                 -> onToggleFavorite -> useAppViewPrefs.toggleFavorite (debounced pref save)
                 -> onLongPress / onContextMenu -> openMenu -> AppContextMenu
```

Favorite state remains a single source of truth: the `favorites` array in the
`app.view` user preference, mutated only through `useAppViewPrefs.toggleFavorite`.

## Error / edge handling

- Offline-blocked module: card disabled, star hidden, `WifiOff` shown; `launch`
  and `openMenu` early-return.
- Long-press only arms on coarse pointers; on fine pointers the card behaves
  exactly as today.
- Star `pointerdown` stops propagation so it never triggers card long-press or
  navigation.
- `AppContextMenu` clamps to viewport; if measurement fails it falls back to the
  raw coords (current behavior).
- Empty `favorites` with `favoritesFirst: true`: `getSortedDisplay` already
  skips the Favoritos section when there are no favorite modules.

## Testing

`node --test` (Node built-in runner), colocated `__tests__`:

- `useModuleLauncher`:
  - `isOfflineBlocked` true when offline and key not in `OFFLINE_MODULES`,
    false otherwise.
  - `sections` delegates to `getSortedDisplay` with prefs.
  - `openMenu` accepts both an event (`clientX/clientY`) and `{ x, y }`;
    `closeMenu` clears.
  - `launch` early-returns for offline-blocked; calls `navigate` + `onDone`
    otherwise.
- `ModuleCard` (grid + list):
  - star reflects `isFavorite`; click calls `onToggleFavorite(key)` and does
    **not** call `onClick`;
  - `isOfflineBlocked` hides the star and shows `WifiOff`;
  - renders `<a href>` when `href` is passed, `<button>` when not.
- `sortModules.test.js`: unchanged, must still pass.

## QA (manual, per responsive-QA policy)

Screenshots at **390px and 1440px**:

- HomeScreen — cards view and list view.
- AppLauncher — cards view and list view.

Checks:

- Star toggle works with pointer and with touch emulation; favorite persists
  across reload (pref mutation fired).
- Long-press on a card (touch emulation) opens the context menu on screen, not
  clipped, including near a screen edge.
- Tapping the star never navigates.
- `favoritesFirst` on by default groups favorites into a "Favoritos" section;
  toggling it off ungroups.
- No "Acceso rápido" / "Recientes" block remains on HomeScreen.

## Out of scope

- Adding a favorites/recents block to `AppLauncher`.
- Reworking `AppContextMenu` into a bottom sheet.
- Any change to `getSortedDisplay` / `sortModules.js` logic.
- Server-side preference schema changes.

# SyncStatusPopover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Topbar's three loose sync/offline status widgets with a single icon button that opens a `Popover` showing full site status.

**Architecture:** New shared component `SyncStatusPopover` in `@atlas/ui` built on the existing Radix `Popover` primitive. It renders one `h-9 w-9` icon-button trigger (icon chosen by online/syncing/synced state, amber dot badge when there are pending changes) and a `w-72` popover panel with status label, last-sync time, pending-count line, and error line. `Topbar.jsx` swaps `SyncStatusBar` + `OfflineIndicator` + the inline `networkBusy` pill for this one component. No data-layer or API changes.

**Tech Stack:** React, `@radix-ui/react-popover` (via `@atlas/ui` `Popover`), `lucide-react` icons, Tailwind, Zustand (`useOfflineStore` from `@atlas/offline`, read in `Topbar.jsx`).

---

## File structure

| File | Responsibility |
|---|---|
| `packages/ui/src/components/SyncStatusPopover.jsx` | New. Self-contained: trigger button + popover panel + `formatRelativeTime` helper. |
| `packages/ui/src/index.js` | Add `SyncStatusPopover` export. |
| `packages/ui/src/components/SyncStatusBar.jsx` | Add deprecation comment. Still exported (referenced by devkit export manifest). |
| `packages/ui/src/components/OfflineIndicator.jsx` | Add deprecation comment. Still exported. |
| `apps/desktop/src/components/Topbar.jsx` | Swap the three widgets for `<SyncStatusPopover>`; add `syncError` from store. |
| `docs/ai-context/ame3-runtime-capabilities.md` | Document the new component. |

---

## Task 1: Create `SyncStatusPopover` component

**Files:**
- Create: `packages/ui/src/components/SyncStatusPopover.jsx`

- [ ] **Step 1: Write the component file**

Create `packages/ui/src/components/SyncStatusPopover.jsx` with exactly this content:

```jsx
import { RefreshCw, CheckCircle, WifiOff } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './Popover.jsx'
import { Button } from './Button.jsx'

function formatRelativeTime(isoString) {
  if (!isoString) return null
  const diffMs = Date.now() - new Date(isoString).getTime()
  if (diffMs < 3_600_000) return `hace ${Math.floor(diffMs / 60_000)} min`
  return `hace ${Math.floor(diffMs / 3_600_000)} h`
}

/**
 * Single-icon site status control for the Topbar. Collapses online/offline,
 * sync-engine activity, react-query network activity, and pending-mutation
 * count into one button; the detail opens in a popover.
 *
 * Replaces the older `SyncStatusBar` + `OfflineIndicator` + inline "Sincronizando..." pill.
 */
export function SyncStatusPopover({
  isOnline = true,
  isSyncing = false,
  lastSyncAt = null,
  pendingCount = 0,
  syncError = null,
  networkBusy = false,
  onSyncNow,
}) {
  const busy = isSyncing || networkBusy
  const hasPending = pendingCount > 0

  let StatusIcon
  let iconClass
  let statusLabel
  if (!isOnline) {
    StatusIcon = WifiOff
    iconClass = 'text-amber-500 dark:text-amber-400'
    statusLabel = 'Sin conexion'
  } else if (busy) {
    StatusIcon = RefreshCw
    iconClass = 'text-[hsl(var(--primary))]'
    statusLabel = 'Sincronizando...'
  } else {
    StatusIcon = CheckCircle
    iconClass = 'text-green-500 dark:text-green-400'
    statusLabel = 'En linea'
  }

  const triggerLabel =
    hasPending && isOnline
      ? `Estado: ${pendingCount} ${pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'}`
      : `Estado: ${statusLabel.toLowerCase()}`

  const relTime = formatRelativeTime(lastSyncAt)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={triggerLabel}
          aria-label={triggerLabel}
          className="relative h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors duration-150 outline-none"
        >
          <StatusIcon
            size={16}
            className={busy && isOnline ? `${iconClass} animate-spin` : iconClass}
          />
          {hasPending && (
            <span
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400 pointer-events-none shadow-[0_0_6px_rgba(245,158,11,0.6)]"
              aria-hidden="true"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center gap-2">
          <StatusIcon size={16} className={iconClass} />
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {statusLabel}
          </span>
        </div>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          Ultima sincronizacion: {relTime ?? '—'}
        </p>
        {hasPending && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            {pendingCount} {pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'}
          </p>
        )}
        {syncError && (
          <p className="mt-1 text-xs text-[hsl(var(--destructive))] break-words">
            {syncError}
          </p>
        )}
        {onSyncNow && isOnline && !isSyncing && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={onSyncNow}
          >
            Sincronizar ahora
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --check packages/ui/src/components/SyncStatusPopover.jsx`
Expected: no output, exit 0. (JSX in a `.jsx` file: if `node --check` rejects JSX syntax, skip this step — the `pnpm lint` in Task 5 is the real gate.)

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/SyncStatusPopover.jsx
git commit -m "feat(ui): add SyncStatusPopover — one-icon site status control"
```

---

## Task 2: Export `SyncStatusPopover` from `@atlas/ui`

**Files:**
- Modify: `packages/ui/src/index.js` (near line 236-237, the `OfflineIndicator` / `SyncStatusBar` exports)

- [ ] **Step 1: Add the export**

Find these two lines in `packages/ui/src/index.js`:

```js
export { OfflineIndicator } from "./components/OfflineIndicator.jsx";
export { SyncStatusBar } from "./components/SyncStatusBar.jsx";
```

Add immediately after them:

```js
export { SyncStatusPopover } from "./components/SyncStatusPopover.jsx";
```

- [ ] **Step 2: Verify the export resolves**

Run: `node -e "import('./packages/ui/src/index.js').then(m => console.log(typeof m.SyncStatusPopover)).catch(e => { console.error(e.message); process.exit(1) })"`
Expected: prints `function`.
If the import fails because of JSX/transform in a bare `node` context (it may — `@atlas/ui` is consumed through Vite), skip this step; Task 5 `pnpm lint` and Task 6 manual run are the gates.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/index.js
git commit -m "feat(ui): export SyncStatusPopover"
```

---

## Task 3: Deprecate `SyncStatusBar` and `OfflineIndicator`

**Files:**
- Modify: `packages/ui/src/components/SyncStatusBar.jsx:1` (top of file)
- Modify: `packages/ui/src/components/OfflineIndicator.jsx:1` (top of file)

- [ ] **Step 1: Add deprecation comment to `SyncStatusBar.jsx`**

Insert as the very first line of `packages/ui/src/components/SyncStatusBar.jsx`, before the existing `import` line:

```js
// DEPRECATED: superseded by SyncStatusPopover. Kept only for the devkit export manifest; no app consumers.
```

- [ ] **Step 2: Add deprecation comment to `OfflineIndicator.jsx`**

Insert as the very first line of `packages/ui/src/components/OfflineIndicator.jsx`, before the existing `import` line:

```js
// DEPRECATED: superseded by SyncStatusPopover. Kept only for the devkit export manifest; no app consumers.
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/SyncStatusBar.jsx packages/ui/src/components/OfflineIndicator.jsx
git commit -m "chore(ui): mark SyncStatusBar and OfflineIndicator deprecated"
```

---

## Task 4: Swap the widgets in `Topbar.jsx`

**Files:**
- Modify: `apps/desktop/src/components/Topbar.jsx:9` (import)
- Modify: `apps/desktop/src/components/Topbar.jsx:33` (add `syncError` selector)
- Modify: `apps/desktop/src/components/Topbar.jsx:135-146` (replace the three widgets)

- [ ] **Step 1: Update the `@atlas/ui` import**

Change line 9 from:

```js
import { ActivityBellTrigger, OfflineIndicator, SyncStatusBar } from "@atlas/ui";
```

to:

```js
import { ActivityBellTrigger, SyncStatusPopover } from "@atlas/ui";
```

- [ ] **Step 2: Add the `syncError` store selector**

After line 33 (`const lastSyncAt   = useOfflineStore((s) => s.lastSyncAt);`) add:

```js
  const syncError    = useOfflineStore((s) => s.syncError);
```

- [ ] **Step 3: Replace the three status widgets**

Replace this block (currently lines ~135-146):

```jsx
          <SyncStatusBar
            isOnline={isOnline}
            isSyncing={isSyncing}
            lastSyncAt={lastSyncAt}
          />
          <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />
          {networkBusy && (
            <div className="hidden md:flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="h-1.5 w-1.5 rounded-full bg-(--brand-primary) animate-pulse" />
              Sincronizando...
            </div>
          )}
```

with:

```jsx
          <SyncStatusPopover
            isOnline={isOnline}
            isSyncing={isSyncing}
            lastSyncAt={lastSyncAt}
            pendingCount={pendingCount}
            syncError={syncError}
            networkBusy={networkBusy}
          />
```

- [ ] **Step 4: Syntax-check**

Run: `node --check apps/desktop/src/components/Topbar.jsx`
Expected: exit 0 (or skip if `node --check` rejects JSX — Task 5 lint is the gate).

- [ ] **Step 5: Confirm no other file still imports the removed names**

Run: `git grep -n "SyncStatusBar\|OfflineIndicator" -- apps/ packages/ | grep -v "packages/ui/src/components/\|packages/ui/src/index.js"`
Expected: no output (nothing outside the `@atlas/ui` source files references them).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/Topbar.jsx
git commit -m "feat(desktop): use SyncStatusPopover in Topbar, drop the loose sync/offline text"
```

---

## Task 5: Lint

**Files:** none

- [ ] **Step 1: Lint the two packages touched**

Run: `pnpm lint`
Expected: completes with no errors. If lint is scoped per-workspace and slow, at minimum run the desktop + ui lint: `pnpm --filter @atlas/ui --filter @atlas/desktop lint` (use whatever package names `pnpm lint` uses; check `package.json` `name` fields if unsure).

- [ ] **Step 2: Fix any lint errors introduced by the new/changed files**

Only address errors in `SyncStatusPopover.jsx`, `index.js`, `Topbar.jsx`, `SyncStatusBar.jsx`, `OfflineIndicator.jsx`. Pre-existing unrelated warnings are out of scope.

- [ ] **Step 3: Commit (only if fixes were made)**

```bash
git add -A
git commit -m "chore(ui): lint fixes for SyncStatusPopover"
```

---

## Task 6: Document the component

**Files:**
- Modify: `docs/ai-context/ame3-runtime-capabilities.md` (the "Overlays and feedback" table, after the `Popover` row at line ~411; or "Molecules and organisms" table — pick the one that matches how the file groups Topbar-level widgets; "Overlays and feedback" is the closer fit)

- [ ] **Step 1: Add a table row**

In `docs/ai-context/ame3-runtime-capabilities.md`, in the "Overlays and feedback" table, add after the `Popover` row:

```md
| `SyncStatusPopover` | One-icon Topbar site status (online/offline/syncing/pending) with a popover detail panel |
```

- [ ] **Step 2: Commit**

```bash
git add docs/ai-context/ame3-runtime-capabilities.md
git commit -m "docs: document SyncStatusPopover in runtime capabilities"
```

---

## Task 7: Manual verification (Vite web preview)

**Files:** none

- [ ] **Step 1: Start the web preview**

Run: `pnpm dev:frontend`
Open `http://localhost:5173`, sign in, land on any screen with the Topbar.

- [ ] **Step 2: Default state**

Expected: a single green `CheckCircle` icon in the Topbar right cluster, aligned on the same baseline as the theme toggle and the bells. No loose "Sincronizando..." / "Sync hace X min" / "Sin conexion" text anywhere in the bar. Click the icon: popover opens, header reads `En linea`, shows `Ultima sincronizacion: hace X min` (or `—`).

- [ ] **Step 3: Busy state**

In DevTools console: `window.__zustandOfflineSet?.({ isSyncing: true })` is not available — instead trigger real network activity by navigating between data-heavy screens, or temporarily set `isSyncing`/`networkBusy` via React DevTools on the `Topbar` props. Expected: icon becomes a spinning `RefreshCw` in primary color; popover header reads `Sincronizando...`.

- [ ] **Step 4: Pending state**

Using React DevTools, set the `SyncStatusPopover` `pendingCount` prop to `3`. Expected: amber dot badge appears on the top-right of the icon; popover shows `3 cambios pendientes` in amber. Set to `1`: text reads `1 cambio pendiente`.

- [ ] **Step 5: Offline state**

Set `isOnline` prop to `false` (React DevTools) or use DevTools Network "Offline" and wait for the detector. Expected: icon becomes amber `WifiOff`; popover header reads `Sin conexion`.

- [ ] **Step 6: Error state**

Set `syncError` prop to `"Fallo la conexion con el servidor"`. Expected: destructive-colored line with that text appears in the popover, wrapping if long.

- [ ] **Step 7: Keyboard + dismiss**

Tab to the icon button, press `Enter` — popover opens. Press `Esc` — it closes and focus returns to the button. Click outside — it closes.

- [ ] **Step 8: Responsive QA (mandatory per repo rule)**

Screenshot the Topbar at **390px** and at **1440px** viewport width. Expected at both: the icon button does not overflow, does not push the `CompanySwitcher` or bells off-screen, and the popover stays within the viewport (Radix `collisionPadding` handles this). No layout shift when the icon swaps between states.

- [ ] **Step 9: Record verification**

Note the date and what was checked in the plan / PR description. Stop the preview server if you started it just for this.

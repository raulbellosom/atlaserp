# Sync Status Popover — Design

Date: 2026-08-27
Status: Approved (brainstorming)
Area: `apps/desktop` Topbar, `packages/ui`

## Problem

The Topbar right section currently exposes site/sync status through three separate
widgets, each with loose inline text:

- `SyncStatusBar` (`@atlas/ui`) — icon plus auto-hiding text: `Sincronizando...`,
  `Sync hace X min`, and an unused `Actualizar` link.
- `OfflineIndicator` (`@atlas/ui`) — a pill reading `Sin conexion — N cambios
  pendientes`, only rendered while offline. Its `onClick` is not wired in the Topbar.
- The `networkBusy` pill rendered inline in `Topbar.jsx` — `Sincronizando...` with a
  pulsing dot, driven by react-query `isFetching`/`isMutating` from `AtlasApp.jsx`.

This is visually noisy, the labels compete for horizontal space with the
`CompanySwitcher`, and the same concept ("is the app synced?") is split across three
components.

## Goal

Collapse sync + offline + pending-changes status into a **single icon button** in the
Topbar. No loose status text in the bar. Clicking the icon opens a `Popover` with the
full detail.

## Non-goals

- The `CompanySwitcher` is out of scope and stays as it is.
- No manual sync trigger is wired in this change (`runSync` is not exposed from the
  offline provider). The new component accepts an optional `onSyncNow` prop so a
  future change can wire it without a redesign.
- No pending-mutations list / retry / discard UI. `PendingMutationsPanel` stays
  unused.
- No data-layer or API changes. Presentation only.

## Approach

New shared component `SyncStatusPopover` in `@atlas/ui` that replaces `SyncStatusBar`,
`OfflineIndicator`, and the inline `networkBusy` pill in the Topbar. Uses the existing
`Popover` / `PopoverTrigger` / `PopoverContent` primitives from `@atlas/ui`.

Rejected alternatives:

- **Wrap the existing `SyncStatusBar` in a Popover.** Leaves `OfflineIndicator` and
  the `networkBusy` pill as separate text widgets; does not fully remove loose text.
- **Use `DropdownMenu` instead of `Popover`.** The panel content is informational, not
  a list of actions, so `Popover` is the better fit.

## Component: `SyncStatusPopover`

Location: `packages/ui/src/components/SyncStatusPopover.jsx`
Export: add to `packages/ui/src/index.js`
Docs: add a row in `docs/ai-context/ame3-runtime-capabilities.md` under the components
inventory.

### Props

| Prop          | Type      | Default | Meaning |
|---------------|-----------|---------|---------|
| `isOnline`    | boolean   | `true`  | From `useOfflineStore(s => s.isOnline)` |
| `isSyncing`   | boolean   | `false` | Offline sync engine running — `useOfflineStore(s => s.isSyncing)` |
| `lastSyncAt`  | string\|null | `null` | ISO timestamp — `useOfflineStore(s => s.lastSyncAt)` |
| `pendingCount`| number    | `0`     | Queued mutations — `useOfflineStore(s => s.pendingCount)` |
| `syncError`   | string\|null | `null` | Last sync error message — `useOfflineStore(s => s.syncError)` |
| `networkBusy` | boolean   | `false` | react-query fetching/mutating — passed from `AtlasApp.jsx` via Topbar |
| `onSyncNow`   | function  | `undefined` | Optional. When provided, renders a "Sincronizar ahora" button in the panel footer. |

### Trigger button

A single `PopoverTrigger` rendering a `button` sized `h-9 w-9`, matching the sibling
Topbar icon buttons (theme toggle, activity bell, notification bell). Icon by
priority:

1. `!isOnline` → `WifiOff`, amber (`text-amber-500 dark:text-amber-400`)
2. `isSyncing || networkBusy` → `RefreshCw` with `animate-spin`, primary
   (`text-[hsl(var(--primary))]`)
3. otherwise → `CheckCircle`, green (`text-green-500 dark:text-green-400`)

When `pendingCount > 0`, an amber dot badge is overlaid on the top-right of the icon
(absolute-positioned `span`, ~`h-2 w-2 rounded-full`), so "there are unsynced changes"
is glanceable without opening the popover.

The button `aria-label` and `title` reflect the current state, e.g.
`Estado: sincronizado`, `Estado: sin conexion`, `Estado: sincronizando`,
`Estado: N cambios pendientes` (pending count takes precedence in the label when
`> 0` and online).

### Popover content

`PopoverContent` with `align="end"`, width ~`w-72`, standard `@atlas/ui` popover
styling (inherits from the primitive). Contents top to bottom:

- **Header row:** status icon (same icon as the trigger, without the badge) plus a
  bold label:
  - `!isOnline` → `Sin conexion`
  - `isSyncing || networkBusy` → `Sincronizando...`
  - otherwise → `En linea`
- **Last sync line:** `Ultima sincronizacion: hace X min`. Reuses the existing
  `formatRelativeTime` helper (move it from `SyncStatusBar.jsx` into the new file, or
  duplicate the ~6 lines — implementer's call). When `lastSyncAt` is null, show
  `Ultima sincronizacion: —`.
- **Pending line:** only when `pendingCount > 0`. Text
  `N cambio pendiente` / `N cambios pendientes` (singular/plural), amber.
- **Error line:** only when `syncError` is truthy. The message text in destructive
  color (`text-[hsl(var(--destructive))]`), `text-xs`, wrapped.
- **Footer button:** only when `onSyncNow` is provided AND `isOnline` AND
  `!isSyncing`. A `Button` (`variant="outline"` or `"secondary"`, `size="sm"`,
  full width) labelled `Sincronizar ahora` that calls `onSyncNow`.

All text in Spanish, no emojis, per repo conventions.

## Topbar changes (`apps/desktop/src/components/Topbar.jsx`)

- Remove `OfflineIndicator` and `SyncStatusBar` from the `@atlas/ui` import; add
  `SyncStatusPopover`.
- Add `const syncError = useOfflineStore((s) => s.syncError);`.
- In the right section, replace the current three-piece block:

  ```jsx
  <SyncStatusBar isOnline={isOnline} isSyncing={isSyncing} lastSyncAt={lastSyncAt} />
  <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />
  {networkBusy && ( /* Sincronizando... pill */ )}
  ```

  with a single:

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

- `onSyncNow` is not passed in this change.
- `networkBusy` prop threading from `AtlasApp.jsx` into `Topbar` is unchanged.

## Deprecation of old components

`SyncStatusBar.jsx` and `OfflineIndicator.jsx` are referenced by
`infra/installer/devkit-export/capabilities.runtime.json` (a generated capability
manifest), so they stay in the repo and stay exported from
`packages/ui/src/index.js`. Add a one-line deprecation comment at the top of each
pointing to `SyncStatusPopover`. They will have no consumers in the app after this
change. Removing them and regenerating the devkit export is a separate follow-up.

## Testing / verification

- `pnpm lint` clean.
- Manual, Vite web preview (`pnpm dev:frontend`), both viewports per the responsive QA
  rule (390px and 1440px):
  - Online, synced, no pending → green check icon, popover shows `En linea` +
    last-sync line.
  - `networkBusy` true (trigger a fetch) → spinner icon; popover header
    `Sincronizando...`.
  - Simulate `pendingCount > 0` in the store → amber dot badge on the icon; popover
    shows the pending line.
  - Simulate `isOnline = false` → `WifiOff` amber icon; popover header
    `Sin conexion`.
  - Simulate `syncError` string → destructive error line in the popover.
  - Popover closes on outside click and on `Esc`; trigger is keyboard-focusable and
    opens on `Enter`/`Space`.
  - Icon button aligns on the Topbar baseline with the theme toggle and bells; no
    layout shift when the icon/state changes.

## Files touched

- `packages/ui/src/components/SyncStatusPopover.jsx` (new)
- `packages/ui/src/index.js` (export)
- `packages/ui/src/components/SyncStatusBar.jsx` (deprecation comment)
- `packages/ui/src/components/OfflineIndicator.jsx` (deprecation comment)
- `apps/desktop/src/components/Topbar.jsx` (swap widgets)
- `docs/ai-context/ame3-runtime-capabilities.md` (document new component)

# Offline Phase 1B — App Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Plan 1A (`2026-06-06-offline-phase-1a-package.md`) must be fully complete and all tests passing before starting this plan.

**Goal:** Wire the `@atlas/offline` package into the Atlas ERP desktop app: persist React Query cache to IndexedDB, store the JWT in SessionVault on login/logout, show an `OfflineIndicator` in the Topbar, and wrap the app with `OfflineProvider`. No offline writes — this plan is read-only cache only.

**Architecture:** Three integration points in the app shell: `main.jsx` (QueryClient persistence), `AuthProvider.jsx` (SessionVault writes), `AtlasApp.jsx` (OfflineProvider wrapper). One new UI component `OfflineIndicator` in `@atlas/ui`, mounted in `Topbar.jsx`. Zero changes to any screen component.

**Tech Stack:** `@atlas/offline` (Plan 1A), `@tanstack/react-query-persist-client` 5.x, `@atlas/ui`, Tailwind CSS, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-06-06-offline-architecture-design.md` — sections 10, 12 (Phase 1).

---

## File Map

```
apps/desktop/package.json                      MODIFY — add @atlas/offline, @tanstack/react-query-persist-client
apps/desktop/src/main.jsx                      MODIFY — PersistQueryClientProvider wrapping
apps/desktop/src/app/AtlasApp.jsx              MODIFY — OfflineProvider wrapping
apps/desktop/src/auth/AuthProvider.jsx         MODIFY — SessionVault writes on session events
apps/desktop/src/components/Topbar.jsx         MODIFY — add OfflineIndicator
packages/ui/src/components/OfflineIndicator.jsx  NEW
packages/ui/src/index.js                       MODIFY — export OfflineIndicator
```

---

## Task 1: Add dependencies to desktop app

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1.1: Add `@atlas/offline` and `@tanstack/react-query-persist-client` to desktop dependencies**

In `apps/desktop/package.json`, add to the `dependencies` object:

```json
"@atlas/offline": "workspace:*",
"@tanstack/react-query-persist-client": "^5.101.0"
```

The full `dependencies` block should now include both entries alongside the existing ones.

- [ ] **Step 1.2: Install**

```bash
pnpm install
```

Expected: Resolves without errors. `@atlas/offline` and `@tanstack/react-query-persist-client` appear in `apps/desktop/node_modules`.

- [ ] **Step 1.3: Verify @atlas/offline is resolvable**

```bash
cd apps/desktop && node --input-type=module <<'EOF'
import { AtlasOfflineDatabase } from '@atlas/offline'
console.log('ok:', typeof AtlasOfflineDatabase)
EOF
```

Expected: `ok: function`

- [ ] **Step 1.4: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "feat(offline): add @atlas/offline and react-query-persist-client to desktop"
```

---

## Task 2: `OfflineIndicator` component in `@atlas/ui`

**Files:**
- Create: `packages/ui/src/components/OfflineIndicator.jsx`
- Modify: `packages/ui/src/index.js`

- [ ] **Step 2.1: Create `packages/ui/src/components/OfflineIndicator.jsx`**

The component shows nothing when online. When offline it shows a pill with a count of pending mutations. Uses the `useOfflineStore` from `@atlas/offline` as a peer.

```jsx
import { WifiOff } from 'lucide-react'

export function OfflineIndicator({ pendingCount = 0, isOnline = true, onClick }) {
  if (isOnline) return null

  return (
    <button
      onClick={onClick}
      className="hidden md:flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--border))] transition-colors duration-150 cursor-pointer"
      title="Sin conexion — ver cambios pendientes"
    >
      <WifiOff size={12} className="shrink-0 text-amber-500 dark:text-amber-400" />
      <span>
        {pendingCount > 0
          ? `Sin conexion — ${pendingCount} ${pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'}`
          : 'Sin conexion'}
      </span>
    </button>
  )
}
```

- [ ] **Step 2.2: Export from `packages/ui/src/index.js`**

Add this line to `packages/ui/src/index.js` after the existing exports:

```javascript
export { OfflineIndicator } from './components/OfflineIndicator.jsx'
```

- [ ] **Step 2.3: Verify the component exports correctly**

```bash
cd packages/ui && node --input-type=module <<'EOF'
import { OfflineIndicator } from './src/index.js'
console.log('ok:', typeof OfflineIndicator)
EOF
```

Expected: `ok: function`

- [ ] **Step 2.4: Commit**

```bash
git add packages/ui/src/components/OfflineIndicator.jsx packages/ui/src/index.js
git commit -m "feat(offline): add OfflineIndicator component to @atlas/ui"
```

---

## Task 3: Add `OfflineIndicator` to `Topbar`

**Files:**
- Modify: `apps/desktop/src/components/Topbar.jsx`

The indicator goes in the right section of the Topbar, before the `CompanySwitcher`, so it is always visible when offline. It reads state from `useOfflineStore`.

- [ ] **Step 3.1: Add imports to `Topbar.jsx`**

At the top of `apps/desktop/src/components/Topbar.jsx`, add after the existing imports:

```javascript
import { OfflineIndicator } from '@atlas/ui'
import { useOfflineStore } from '@atlas/offline'
```

- [ ] **Step 3.2: Read the offline store in the Topbar component**

Inside the `Topbar` function body, after the existing `const token = session?.access_token` line, add:

```javascript
const isOnline = useOfflineStore((s) => s.isOnline)
const pendingCount = useOfflineStore((s) => s.pendingCount)
```

- [ ] **Step 3.3: Mount `OfflineIndicator` in the right section**

In the right section of the Topbar JSX, locate this block:

```jsx
{/* Right section — pushed to the right */}
<div className="ml-auto flex items-center gap-1 shrink-0">
  {networkBusy && (
```

Add `OfflineIndicator` as the **first child** inside that div, before the `{networkBusy && ...}` block:

```jsx
{/* Right section — pushed to the right */}
<div className="ml-auto flex items-center gap-1 shrink-0">
  <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />
  {networkBusy && (
```

- [ ] **Step 3.4: Commit**

```bash
git add apps/desktop/src/components/Topbar.jsx
git commit -m "feat(offline): mount OfflineIndicator in Topbar right section"
```

---

## Task 4: Wrap app with `OfflineProvider`

**Files:**
- Modify: `apps/desktop/src/app/AtlasApp.jsx`

`OfflineProvider` must wrap the authenticated app shell so it initialises the Dexie database and OnlineDetector once when the user is logged in.

- [ ] **Step 4.1: Add import to `AtlasApp.jsx`**

At the top of `apps/desktop/src/app/AtlasApp.jsx`, add after existing imports:

```javascript
import { OfflineProvider } from '@atlas/offline'
import { atlas } from '../lib/atlas'
```

Note: `atlas` is likely already imported. Check — if it is, skip that line.

- [ ] **Step 4.2: Read `apiBaseUrl` from the atlas client**

The API base URL is available via `import.meta.env.VITE_ATLAS_API_URL`. Add after the existing store hooks at the top of the `AtlasApp` function body:

```javascript
const apiBaseUrl = import.meta.env.VITE_ATLAS_API_URL ?? ''
```

- [ ] **Step 4.3: Wrap the return JSX with `OfflineProvider`**

The current top-level return in `AtlasApp` is:

```jsx
return (
  <ModuleBundleLoader>
    <div className="h-dvh overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
```

Wrap it so `OfflineProvider` is the outermost element:

```jsx
return (
  <OfflineProvider apiBaseUrl={apiBaseUrl}>
    <ModuleBundleLoader>
      <div className="h-dvh overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
```

And close the `OfflineProvider` at the matching end of the return block (after `</ModuleBundleLoader>`):

```jsx
    </ModuleBundleLoader>
  </OfflineProvider>
)
```

- [ ] **Step 4.4: Commit**

```bash
git add apps/desktop/src/app/AtlasApp.jsx
git commit -m "feat(offline): wrap AtlasApp with OfflineProvider"
```

---

## Task 5: Persist React Query cache with `PersistQueryClientProvider`

**Files:**
- Modify: `apps/desktop/src/main.jsx`

Replace `QueryClientProvider` with `PersistQueryClientProvider` so the React Query cache survives page reloads and app restarts by storing to IndexedDB.

- [ ] **Step 5.1: Add imports to `main.jsx`**

At the top of `apps/desktop/src/main.jsx`, replace:

```javascript
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
```

With:

```javascript
import {
  QueryClient,
  useQuery,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AtlasOfflineDatabase, createDexiePersister } from "@atlas/offline";
```

- [ ] **Step 5.2: Create the persister alongside the QueryClient**

After the existing `const queryClient = new QueryClient({...})` block, add:

```javascript
const _offlineDb = new AtlasOfflineDatabase()
const _persister = createDexiePersister(_offlineDb)
```

- [ ] **Step 5.3: Replace `QueryClientProvider` with `PersistQueryClientProvider` in the `App` JSX**

Locate in `App()`:

```jsx
return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
```

Replace with:

```jsx
return (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: _persister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: import.meta.env.VITE_APP_VERSION ?? '1',
    }}
  >
    <TooltipProvider>
```

And close the matching tag — replace `</QueryClientProvider>` with `</PersistQueryClientProvider>`.

- [ ] **Step 5.4: Commit**

```bash
git add apps/desktop/src/main.jsx
git commit -m "feat(offline): persist React Query cache to IndexedDB via PersistQueryClientProvider"
```

---

## Task 6: Store JWT in `SessionVault` via `AuthProvider`

**Files:**
- Modify: `apps/desktop/src/auth/AuthProvider.jsx`

On every successful session event, write the JWT + user profile to `SessionVault`. On sign-out, clear it. On initial load while offline, fall back to the vault if Supabase cannot reach its servers.

- [ ] **Step 6.1: Add imports to `AuthProvider.jsx`**

At the top of `apps/desktop/src/auth/AuthProvider.jsx`, add:

```javascript
import { AtlasOfflineDatabase, SessionVault } from '@atlas/offline'

const _vaultDb = new AtlasOfflineDatabase()
const _sessionVault = new SessionVault(_vaultDb)
```

Note: these are module-level singletons — the database is shared with the persister created in `main.jsx`. Both use the default database name `'atlas-offline'` so Dexie opens the same IndexedDB. This is intentional.

- [ ] **Step 6.2: Write to vault on successful session load**

In `apps/desktop/src/auth/AuthProvider.jsx`, inside `hydrateSession()`, locate the existing block:

```javascript
        if (currentSession) {
          atlas.auth.me(currentSession.access_token)
            .then(profile => {
              if (!mounted) return
              setUserProfile(profile)
              profileLoadedForAuthUserId = currentSession?.user?.id ?? null
            })
            .catch(async (error) => {
              if (shouldForceLogout(error)) {
                await forceLogout()
              }
            })
        } else {
          setUserProfile(null)
        }
```

Replace it with:

```javascript
        if (currentSession) {
          // Write token to vault immediately for offline grace period
          _sessionVault.store({
            accessToken: currentSession.access_token,
            refreshToken: currentSession.refresh_token,
            expiresAt: new Date(currentSession.expires_at * 1000).toISOString(),
            userProfile: null,
            companyId: null,
            apiBaseUrl: import.meta.env.VITE_ATLAS_API_URL ?? '',
          }).catch(() => {})

          atlas.auth.me(currentSession.access_token)
            .then(profile => {
              if (!mounted) return
              setUserProfile(profile)
              profileLoadedForAuthUserId = currentSession?.user?.id ?? null
              // Enrich vault with user profile once loaded
              _sessionVault.update({
                userProfile: profile,
                companyId: profile?.companyId ?? null,
              }).catch(() => {})
            })
            .catch(async (error) => {
              if (shouldForceLogout(error)) {
                await forceLogout()
              }
            })
        } else {
          setUserProfile(null)
        }
```

- [ ] **Step 6.3: Write to vault on `onAuthStateChange` events**

In `apps/desktop/src/auth/AuthProvider.jsx`, inside the `onAuthStateChange` callback, locate:

```javascript
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setSession(session)
      setLoading(false)
      if (session) {
        const eventName = String(event ?? '').toUpperCase()
        const authUserId = session?.user?.id ?? null
```

After the `setLoading(false)` line and the `if (session) {` open brace, add the vault write before the existing `const eventName` line:

```javascript
      if (session) {
        // Persist to vault for offline grace period
        _sessionVault.store({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: new Date(session.expires_at * 1000).toISOString(),
          userProfile: null,
          companyId: null,
          apiBaseUrl: import.meta.env.VITE_ATLAS_API_URL ?? '',
        }).catch(() => {})

        const eventName = String(event ?? '').toUpperCase()
        const authUserId = session?.user?.id ?? null
        // ... rest of existing profile loading logic unchanged
```

- [ ] **Step 6.4: Clear vault on sign-out**

The existing `forceLogout()` function calls `await supabase.auth.signOut()`. Add a vault clear before/after:

```javascript
async function forceLogout() {
  try {
    await supabase.auth.signOut()
  } catch {}
  _sessionVault.clear().catch(() => {})  // ADD THIS LINE
  if (!mounted) return
  setSession(null)
  setUserProfile(null)
  profileLoadedForAuthUserId = null
}
```

- [ ] **Step 6.5: Commit**

```bash
git add apps/desktop/src/auth/AuthProvider.jsx
git commit -m "feat(offline): write JWT to SessionVault on session events"
```

---

## Task 7: Smoke test in the running app

- [ ] **Step 7.1: Start the dev server**

```bash
pnpm dev:frontend
```

Expected: Vite starts on `http://localhost:5173` with no build errors. Open browser console — no red errors on load.

- [ ] **Step 7.2: Verify React Query cache persists**

1. Log in and navigate to Contacts or any module that loads data.
2. Open DevTools → Application → IndexedDB → `atlas-offline` database.
3. Confirm the `_query_cache` table has a row with `id = 'persisted'`.
4. Hard-refresh the page (Ctrl+Shift+R).
5. Confirm the module data appears immediately before any network requests complete (cache hydration).

- [ ] **Step 7.3: Verify SessionVault writes on login**

1. While logged in, open DevTools → Application → IndexedDB → `atlas-offline` → `session_vault`.
2. Confirm a row with `id = 'current'` exists containing `accessToken` and `storedAt`.

- [ ] **Step 7.4: Verify OfflineIndicator appears when offline**

1. Open DevTools → Network tab → check "Offline".
2. Confirm the `OfflineIndicator` pill appears in the Topbar with "Sin conexion".
3. Uncheck "Offline" — confirm the pill disappears.

- [ ] **Step 7.5: Final commit**

```bash
git add -A
git commit -m "feat(offline): Phase 1 complete — read cache, SessionVault, OfflineIndicator"
```

---

## Phase 1 done. What's next

**Phase 1 delivers:**
- App shell renders immediately from IndexedDB cache on every load
- User stays logged in offline indefinitely (SessionVault)
- `OfflineIndicator` shows in Topbar when network is unavailable
- Zero changes to any existing screen component
- Zero new API endpoints — entirely frontend

**Phase 2** adds the pull sync engine (`/sync/pull` endpoint) and SDK `readLocal()` transport so Tier 1 modules (contacts, HR, fleet, catalog) serve data from Dexie when offline.

Plans:
- `2026-06-06-offline-phase-2a-backend-pull.md` — Prisma migration + `/sync/pull` endpoint
- `2026-06-06-offline-phase-2b-frontend-read-cache.md` — SDK transport + module offline declarations + SyncEngine.pull()

# Multi-Tenant Plan 2 — Frontend Tenant Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `CompanySwitcher` a real tenant switch instead of a dead `localStorage` write — introduce `ActiveCompanyContext`, wire it to the SDK's `getActiveCompanyId` hook built in Plan 1, gate the authenticated shell on tenant resolution, clear cached data on switch, and re-subscribe company-scoped realtime channels to the newly active company.

**Architecture:** A new `ActiveCompanyProvider` (React Context, not Zustand — this state is tied to `AuthProvider`'s session lifecycle and to React Query's `QueryClient`, both already Context-based here) owns the single `GET /memberships/me` query and the "which company is active" decision. It mounts between `AuthProvider` and `RealtimeProvider` in the route tree, gates rendering of the authenticated shell until the active company is resolved (mirroring the existing `brandReady` gate pattern in `AppEntry.jsx`), and on every switch calls `queryClient.clear()` — chosen over a hand-maintained list of "company-scoped query key prefixes" (see Task 4's note) because it gives a hard, maintenance-free guarantee against ever flashing a previous company's cached data, which is the one non-negotiable requirement here. `CompanySwitcher` becomes a thin view over the context; `RealtimeProvider`'s two company-scoped channels (`company:{id}:presence`, `company:{id}:events`) switch from reading `userProfile.companyId` (which nothing currently keeps in sync with a manual switch) to reading `activeCompanyId` from the new context.

**Tech Stack:** React 18, `@tanstack/react-query`, React Router, the `@atlas/sdk` `getActiveCompanyId` hook and `apps/desktop/src/lib/atlas.js` `setActiveCompanyId`/`getActiveCompanyId` pair built in Plan 1 Task 8.

**Depends on:** Plan 1 (`docs/superpowers/plans/2026-09-10-multi-tenant-plan-1-backend-foundation.md`) must be implemented first — this plan wires the frontend into the backend/SDK mechanism Plan 1 built and does not duplicate it.

**Deferred to later plans:** rewriting every module screen's React Query keys to the `[domain, "company", companyId, ...]` convention (spec §7.1) — `queryClient.clear()` on switch already gives full correctness today without it, so that conversion becomes a pure future-proofing exercise better done module-by-module as each module goes through Plan 4's `memberships[0]` sweep, not rushed here as a `company.*`-only sample; full Supabase Realtime channel authorization hardening (`private: true` + RLS, spec §10, Plan 4) — this plan only fixes *which* company's already-existing channels get joined, not the channel-join authorization gap itself.

---

## File Structure

- **Modify:** `apps/desktop/src/lib/__tests__/atlas.test.js` — proves Plan 1's `setActiveCompanyId` actually reaches outgoing requests.
- **Create:** `apps/desktop/src/company/pickActiveCompany.js` — pure helper (no React) that decides which company id to activate given the membership list and whatever was persisted.
- **Create:** `apps/desktop/src/company/__tests__/pickActiveCompany.test.js`
- **Create:** `apps/desktop/src/company/ActiveCompanyProvider.jsx` — the context, provider, `useActiveCompany` hook, and `ActiveCompanyGate` component.
- **Modify:** `apps/desktop/src/app/AppEntry.jsx` — mount `ActiveCompanyProvider` + `ActiveCompanyGate` around the authenticated route.
- **Modify:** `apps/desktop/src/components/CompanySwitcher.jsx` — becomes a view over `useActiveCompany()`.
- **Modify:** `apps/desktop/src/components/Topbar.jsx` — drop the now-unused `token` prop on `<CompanySwitcher />`.
- **Modify:** `apps/desktop/src/providers/RealtimeProvider.jsx` — read `activeCompanyId` from `useActiveCompany()` instead of `userProfile.companyId`.

---

### Task 1: Prove the SDK wiring end-to-end at the module level

**Files:**
- Modify: `apps/desktop/src/lib/__tests__/atlas.test.js`

- [ ] **Step 1: Write the failing test**

Add to the existing file (do not remove the existing `initAtlasClient binds...` test):

```javascript
// apps/desktop/src/lib/__tests__/atlas.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAtlasClient, initAtlasClient, setActiveCompanyId, getActiveCompanyId } from '../atlas.js'

test('initAtlasClient binds SDK requests to the runtime URL', async () => {
  const originalFetch = globalThis.fetch
  const requests = []

  globalThis.fetch = async (url) => {
    requests.push(url)
    return {
      ok: true,
      json: async () => ({ status: 'ok' }),
    }
  }

  try {
    initAtlasClient('https://demo.atlaserp.com')
    await getAtlasClient().health()
    assert.equal(requests[0], 'https://demo.atlaserp.com/health')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('setActiveCompanyId makes subsequent SDK requests carry X-Atlas-Company-Id', async () => {
  const originalFetch = globalThis.fetch
  const seenHeaders = []

  globalThis.fetch = async (_url, options = {}) => {
    seenHeaders.push(options.headers ?? {})
    return { ok: true, json: async () => ({}) }
  }

  try {
    initAtlasClient('https://demo.atlaserp.com')
    assert.equal(getActiveCompanyId(), null)

    setActiveCompanyId('company-a')
    await getAtlasClient().profile.me('tok')
    assert.equal(seenHeaders[0]['X-Atlas-Company-Id'], 'company-a')

    setActiveCompanyId('company-b')
    await getAtlasClient().profile.me('tok')
    assert.equal(seenHeaders[1]['X-Atlas-Company-Id'], 'company-b')

    setActiveCompanyId(null)
    await getAtlasClient().profile.me('tok')
    assert.equal('X-Atlas-Company-Id' in seenHeaders[2], false)
  } finally {
    globalThis.fetch = originalFetch
    setActiveCompanyId(null)
  }
})
```

- [ ] **Step 2: Run to verify the new test fails**

Run: `node --test apps/desktop/src/lib/__tests__/atlas.test.js`
Expected: FAIL on the second test if Plan 1 Task 8 was not applied first (`setActiveCompanyId is not a function`), otherwise PASS immediately if Plan 1 is already merged — either way, confirm the assertions are exercising real behavior by temporarily commenting out the `if (companyId) merged["X-Atlas-Company-Id"] = companyId` line in `packages/sdk/src/index.js` and re-running to see it fail, then restore it.

- [ ] **Step 3: No implementation needed here** — this step only exists if Plan 1 has not actually been applied to the branch this plan runs against. If Plan 1 is already in place (it is a hard prerequisite, stated above), this test passes immediately with zero new production code.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test apps/desktop/src/lib/__tests__/atlas.test.js`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/__tests__/atlas.test.js
git commit -m "test(desktop): cover setActiveCompanyId reaching outgoing SDK requests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure "which company should be active" resolution helper

**Files:**
- Create: `apps/desktop/src/company/pickActiveCompany.js`
- Test: `apps/desktop/src/company/__tests__/pickActiveCompany.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// apps/desktop/src/company/__tests__/pickActiveCompany.test.js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pickActiveCompany } from '../pickActiveCompany.js'

describe('pickActiveCompany', () => {
  it('returns null when the user has no companies', () => {
    assert.equal(pickActiveCompany({ companies: [], storedId: null }), null)
  })

  it('picks the only company when there is exactly one, ignoring any stale stored id', () => {
    const companies = [{ id: 'A' }]
    assert.equal(pickActiveCompany({ companies, storedId: 'ghost' }), 'A')
  })

  it('keeps the stored id when it still names a company the user belongs to', () => {
    const companies = [{ id: 'A' }, { id: 'B' }]
    assert.equal(pickActiveCompany({ companies, storedId: 'B' }), 'B')
  })

  it('never returns a stored id that is not in the current companies list', () => {
    const companies = [{ id: 'A' }, { id: 'B' }]
    assert.equal(pickActiveCompany({ companies, storedId: 'ghost' }), 'A')
  })

  it('falls back to the first company when nothing valid is stored', () => {
    const companies = [{ id: 'A' }, { id: 'B' }]
    assert.equal(pickActiveCompany({ companies, storedId: null }), 'A')
  })

  it('compares ids as strings, so a numeric-looking id still matches', () => {
    const companies = [{ id: 7 }, { id: 8 }]
    assert.equal(pickActiveCompany({ companies, storedId: '8' }), '8')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test apps/desktop/src/company/__tests__/pickActiveCompany.test.js`
Expected: FAIL — `Cannot find module '../pickActiveCompany.js'`

- [ ] **Step 3: Implement**

```javascript
// apps/desktop/src/company/pickActiveCompany.js
// Decides which company should be active given the user's current
// memberships and whatever id was previously persisted. Kept pure/no-React
// so it is unit-testable without a DOM or a QueryClient.
// Spec: docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §6.1

export function pickActiveCompany({ companies, storedId }) {
  const list = Array.isArray(companies) ? companies : []
  if (list.length === 0) return null

  if (storedId != null) {
    const match = list.find((c) => String(c.id) === String(storedId))
    if (match) return String(match.id)
  }

  return String(list[0].id)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test apps/desktop/src/company/__tests__/pickActiveCompany.test.js`
Expected: PASS, all 6 cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/company/pickActiveCompany.js apps/desktop/src/company/__tests__/pickActiveCompany.test.js
git commit -m "feat(desktop): add pure pickActiveCompany resolution helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `ActiveCompanyProvider`, `useActiveCompany`, `ActiveCompanyGate`

**Files:**
- Create: `apps/desktop/src/company/ActiveCompanyProvider.jsx`

- [ ] **Step 1: Implement**

```jsx
// apps/desktop/src/company/ActiveCompanyProvider.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { atlas, setActiveCompanyId as setSdkActiveCompanyId } from '../lib/atlas'
import { pickActiveCompany } from './pickActiveCompany.js'
import { AppLoader } from '../components/AppLoader'

const STORAGE_KEY = 'atlas-active-company'

function readStoredCompanyId() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredCompanyId(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, String(id))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

const ActiveCompanyContext = createContext(null)

export function ActiveCompanyProvider({ children }) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const [activeCompanyId, setActiveCompanyIdState] = useState(null)
  // Ref, not just state: getActiveCompanyId (passed to the SDK, see
  // apps/desktop/src/lib/atlas.js) must read the CURRENT value even from
  // code paths that fire between renders — state alone would risk a stale
  // closure. Kept in sync with activeCompanyId on every change below.
  const activeCompanyIdRef = useRef(null)

  const { data, isLoading: membershipsLoading } = useQuery({
    queryKey: ['memberships-me', token],
    queryFn: () => atlas.memberships.me(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  })

  const memberships = Array.isArray(data) ? data : (data?.data ?? [])
  const companies = useMemo(
    () => memberships.map((m) => m.company ?? m).filter((c) => c && c.name),
    [memberships],
  )

  const applyActiveCompany = useCallback((id) => {
    activeCompanyIdRef.current = id
    setActiveCompanyIdState(id)
    setSdkActiveCompanyId(id)
  }, [])

  // Resolve on load / whenever the membership list changes (a membership was
  // added/removed elsewhere). Never silently reuses a persisted id that no
  // longer names a company this user belongs to — pickActiveCompany enforces
  // that by only ever returning an id present in `companies`.
  useEffect(() => {
    if (membershipsLoading) return
    const next = pickActiveCompany({ companies, storedId: readStoredCompanyId() })
    if (next !== activeCompanyIdRef.current) {
      applyActiveCompany(next)
    }
  }, [membershipsLoading, companies, applyActiveCompany])

  const setActiveCompany = useCallback((companyId) => {
    const id = String(companyId)
    if (!companies.some((c) => String(c.id) === id)) return
    if (id === activeCompanyIdRef.current) return
    applyActiveCompany(id)
    writeStoredCompanyId(id)
    // Deliberately clear the WHOLE cache rather than maintaining a hand-picked
    // list of "company-scoped" query keys: switching companies is a rare,
    // deliberate action, so a few extra refetches of user-scoped queries is a
    // fully acceptable cost for a guarantee that we never flash a previous
    // company's cached data. See
    // docs/superpowers/plans/2026-09-10-multi-tenant-plan-2-frontend-integration.md
    queryClient.clear()
  }, [companies, applyActiveCompany, queryClient])

  const getActiveCompanyId = useCallback(() => activeCompanyIdRef.current, [])

  const isLoading = membershipsLoading || (companies.length > 0 && activeCompanyId == null)

  const value = useMemo(() => ({
    activeCompanyId,
    activeCompany: companies.find((c) => String(c.id) === String(activeCompanyId)) ?? null,
    companies,
    isLoading,
    setActiveCompany,
    getActiveCompanyId,
  }), [activeCompanyId, companies, isLoading, setActiveCompany, getActiveCompanyId])

  return (
    <ActiveCompanyContext.Provider value={value}>
      {children}
    </ActiveCompanyContext.Provider>
  )
}

export function useActiveCompany() {
  const ctx = useContext(ActiveCompanyContext)
  if (!ctx) throw new Error('useActiveCompany must be used inside ActiveCompanyProvider')
  return ctx
}

// Blocks rendering of the authenticated shell until the active company is
// resolved — mirrors the existing brandReady gate in AppEntry.jsx. Prevents
// module screens from firing tenant-scoped queries with no
// X-Atlas-Company-Id header during the brief window before resolution.
export function ActiveCompanyGate({ children }) {
  const { isLoading } = useActiveCompany()
  if (isLoading) return <AppLoader />
  return children
}
```

- [ ] **Step 2: Syntax-check**

Run: `node --check apps/desktop/src/company/ActiveCompanyProvider.jsx`
Expected: `node --check` cannot parse JSX directly — instead run the project's normal build-time check: `pnpm --filter @atlas/desktop exec vite build --mode development 2>&1 | head -50` is too slow for a single-file check, so instead confirm via ESLint, which does parse JSX: `pnpm lint` (run once at the end of this plan, see Verification) plus a visual review that every import path resolves (`../auth/AuthProvider`, `../lib/atlas`, `./pickActiveCompany.js`, `../components/AppLoader` — all confirmed to exist at those relative paths from `apps/desktop/src/company/`).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/company/ActiveCompanyProvider.jsx
git commit -m "feat(desktop): add ActiveCompanyProvider — real tenant selection state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Mount the provider and gate around the authenticated route

**Files:**
- Modify: `apps/desktop/src/app/AppEntry.jsx:13-17,137`

- [ ] **Step 1: Import the provider/gate**

Add alongside the existing provider imports at the top of `apps/desktop/src/app/AppEntry.jsx` (near line 13-17):

```javascript
import { AuthProvider } from "../auth/AuthProvider";
import { ActiveCompanyProvider, ActiveCompanyGate } from "../company/ActiveCompanyProvider";
import { RealtimeProvider } from "../providers/RealtimeProvider";
import { OfficeProvider } from "../providers/OfficeProvider";
import { CallsProvider } from "../modules/atlas.chat/calls/CallsProvider";
```

- [ ] **Step 2: Wrap the authenticated route element**

Replace `apps/desktop/src/app/AppEntry.jsx:137`:

```jsx
                <Route path="/app" element={<RealtimeProvider><CallsProvider><AtlasApp /></CallsProvider></RealtimeProvider>}>
```

with:

```jsx
                <Route
                  path="/app"
                  element={
                    <ActiveCompanyProvider>
                      <ActiveCompanyGate>
                        <RealtimeProvider>
                          <CallsProvider>
                            <AtlasApp />
                          </CallsProvider>
                        </RealtimeProvider>
                      </ActiveCompanyGate>
                    </ActiveCompanyProvider>
                  }
                >
```

`ActiveCompanyProvider` is scoped to only the authenticated `/app` subtree (not the whole app, which also serves public website/storefront/guest-call routes that have no notion of an ERP "active company") — it sits directly inside `AppRouteGuard mode="access"` (which already guarantees a `session` exists by the time this route renders, so `useAuth().session` is never null inside the provider), and directly outside `RealtimeProvider`, matching the spec's placement requirement (provider must be readable by `RealtimeProvider`, see Task 6).

- [ ] **Step 3: Syntax-check**

Run: `pnpm lint` (full ESLint pass — the fastest way to confirm this JSX file still parses and imports resolve; a narrower single-file check isn't available for `.jsx` in this repo's toolchain).
Expected: no new errors on `apps/desktop/src/app/AppEntry.jsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/app/AppEntry.jsx
git commit -m "feat(desktop): mount ActiveCompanyProvider around the authenticated route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `CompanySwitcher` becomes a real tenant switch

**Files:**
- Modify: `apps/desktop/src/components/CompanySwitcher.jsx`

- [ ] **Step 1: Replace the file**

```jsx
// apps/desktop/src/components/CompanySwitcher.jsx
import { Building2, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@atlas/ui";
import { useActiveCompany } from "../company/ActiveCompanyProvider";

function CompanyLogo({ company, size = 20 }) {
  const initials = (company?.name ?? "E")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (company?.logoUrl) {
    return (
      <img
        src={company.logoUrl}
        alt={company.name}
        style={{ width: size, height: size }}
        className="rounded object-cover shrink-0"
      />
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        backgroundColor: company?.primaryColor ?? "hsl(var(--border))",
      }}
      className="rounded flex items-center justify-center font-bold text-white shrink-0 leading-none select-none"
    >
      {initials}
    </span>
  );
}

export function CompanySwitcher() {
  const { companies, activeCompany, isLoading, setActiveCompany } = useActiveCompany();

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))] select-none animate-pulse">
        <span className="w-5 h-5 rounded bg-[hsl(var(--border))] shrink-0" />
        <span className="w-16 h-2.5 rounded bg-[hsl(var(--border))]" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium select-none text-[hsl(var(--muted-foreground))] grayscale hover:grayscale-0 hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all duration-150">
        <Building2 size={16} className="shrink-0" />
        <span className="max-w-30 truncate">Mi empresa</span>
      </div>
    );
  }

  if (companies.length === 1) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[hsl(var(--muted))] text-xs font-medium text-[hsl(var(--foreground))] select-none">
        <CompanyLogo company={activeCompany} size={20} />
        <span className="max-w-30 truncate">
          {activeCompany?.name ?? "Mi empresa"}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] text-xs font-medium text-[hsl(var(--foreground))] transition-colors duration-150 cursor-pointer outline-none">
          <CompanyLogo company={activeCompany} size={20} />
          <span className="max-w-30 truncate">
            {activeCompany?.name ?? "Empresa"}
          </span>
          <ChevronDown
            size={12}
            className="text-[hsl(var(--muted-foreground))] shrink-0"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Cambiar empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => setActiveCompany(company.id)}
            className="gap-2 cursor-pointer"
          >
            <CompanyLogo company={company} size={18} />
            <span className="flex-1 truncate">{company.name}</span>
            {String(company.id) === String(activeCompany?.id) && (
              <Check size={13} className="shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Same visual behavior as before (loading skeleton, zero/one/many-company states unchanged) — the only functional change is that `onClick` now calls the real `setActiveCompany(company.id)` from the context instead of writing to `localStorage` with no other effect, and the data source is the shared `ActiveCompanyProvider` query instead of a second, independent `useQuery(["memberships-me", token])` (avoids two separate in-flight requests for the same data).

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/components/CompanySwitcher.jsx
git commit -m "fix(desktop): CompanySwitcher now actually switches the active tenant

Previously onClick only wrote to localStorage — nothing read that value
back, so picking a company in the UI had zero effect on API requests.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `Topbar` drops the now-unused `token` prop

**Files:**
- Modify: `apps/desktop/src/components/Topbar.jsx:151`

- [ ] **Step 1: Update the call site**

Replace `apps/desktop/src/components/Topbar.jsx:151`:

```jsx
              <CompanySwitcher token={token} />
```

with:

```jsx
              <CompanySwitcher />
```

The `token` local variable (`apps/desktop/src/components/Topbar.jsx:29`) stays — it is still used by other components in this file (`NotificationBell` and others per the existing imports); only this one call site changes.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/components/Topbar.jsx
git commit -m "chore(desktop): drop unused token prop from CompanySwitcher call site

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `RealtimeProvider` follows the active company, not a stale profile field

**Files:**
- Modify: `apps/desktop/src/providers/RealtimeProvider.jsx:1-16,153-211`

- [ ] **Step 1: Import the hook**

Modify `apps/desktop/src/providers/RealtimeProvider.jsx:1-11`:

```javascript
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useActiveCompany } from '../company/ActiveCompanyProvider'
import { getSupabaseClient } from '../lib/supabase'
import { isTauriRuntime, showSystemNotification } from '../lib/systemNotifications'
import { toast } from 'sonner'
import { playCallSound } from '../modules/atlas.chat/calls/callSounds'
import { useChatFloatStore } from '../modules/atlas.chat/store/chatFloatStore'
import { notificationKey, claimNotification } from '../lib/notificationDedup'
import { getStoredWebPushSubscriptionId } from '../lib/webPush'
```

- [ ] **Step 2: Read `activeCompanyId` from the new context**

Modify `apps/desktop/src/providers/RealtimeProvider.jsx:15-16`:

```javascript
export function RealtimeProvider({ children }) {
  const { userProfile, session } = useAuth()
  const { activeCompanyId } = useActiveCompany()
  const queryClient = useQueryClient()
```

- [ ] **Step 3: Switch the two company-scoped effects to `activeCompanyId`**

Replace the "Company presence channel" effect (`apps/desktop/src/providers/RealtimeProvider.jsx:154-195`):

```javascript
  // Company presence channel — tracks who is online across the whole company
  useEffect(() => {
    if (!userProfile?.id || !activeCompanyId) return
    const client = getSupabaseClient()

    const channel = client
      .channel(`company:${activeCompanyId}:presence`, {
        config: { presence: { key: userProfile.id } },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const next = {}
        Object.entries(state).forEach(([, presences]) => {
          const p = presences?.[0]
          if (p?.userId) next[p.userId] = p
        })
        setOnlineUsers(next)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const now = new Date()
        setLastSeenMap((prev) => {
          const next = { ...prev }
          leftPresences.forEach((p) => { if (p?.userId) next[p.userId] = now })
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: userProfile.id,
            displayName: userProfile.displayName ?? userProfile.email ?? userProfile.id,
            // Without this, every "online now" widget (FloatingChatHub's pill
            // strip included) falls back to initials for everyone, even users
            // who do have a real photo elsewhere in the app — the presence
            // payload is the only source those widgets read from.
            avatarUrl: userProfile.avatarUrl ?? null,
            status: 'online',
          })
        }
      })

    return () => { client.removeChannel(channel) }
  }, [userProfile?.id, activeCompanyId, userProfile?.displayName, userProfile?.email, userProfile?.avatarUrl])
```

Replace the "Company events channel" effect (`apps/desktop/src/providers/RealtimeProvider.jsx:197-211`):

```javascript
  // Company events channel — receives broadcast events for POS, Calendar, and other company-wide modules
  useEffect(() => {
    if (!userProfile?.id || !activeCompanyId) return
    const client = getSupabaseClient()
    const channel = client
      .channel(`company:${activeCompanyId}:events`)
      .on('broadcast', { event: 'pos.order.updated' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pos'] })
      })
      .on('broadcast', { event: 'calendar.event.updated' }, () => {
        queryClient.invalidateQueries({ queryKey: ['calendar'] })
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [userProfile?.id, activeCompanyId, queryClient])
```

Both effects already return a cleanup (`client.removeChannel(channel)`) that runs whenever a dependency changes — since `activeCompanyId` is now a dependency, switching companies unsubscribes the old company's presence/events channels and subscribes the new one's automatically, with no extra code needed for that part. The `user:${userProfile.id}:events` channel (`RealtimeProvider.jsx:37-151`) and the `pg-notifications-${userProfile.id}` channel (`RealtimeProvider.jsx:213-227`) are per-user, not per-company, and are intentionally left unchanged.

- [ ] **Step 4: Syntax-check**

Run: `pnpm lint`
Expected: no new errors on `apps/desktop/src/providers/RealtimeProvider.jsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/providers/RealtimeProvider.jsx
git commit -m "fix(desktop): company presence/events channels follow the active company

Previously read userProfile.companyId, which is set once at login from
/user/me and never updated by a manual company switch — presence and
POS/Calendar broadcast channels stayed pinned to whichever company was
active at login.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verification

- [ ] **Full new/changed unit test suites**

Run: `node --test apps/desktop/src/lib/__tests__/atlas.test.js apps/desktop/src/company/__tests__/pickActiveCompany.test.js`
Expected: PASS, 0 failures.

- [ ] **Full desktop test suite (regression check)**

Run: `node --test apps/desktop/src/`
Expected: PASS, same pass/fail counts as on `main` before this plan.

- [ ] **Lint**

Run: `pnpm lint`
Expected: no new errors on any file this plan touches.

- [ ] **Manual browser QA (required — this plan touches app-shell routing and realtime subscriptions, which have no automated coverage in this repo; see CLAUDE.md's UI-change verification rule)**

Start the dev server: `pnpm dev` (API + Vite web preview + worker). In the browser at `http://localhost:5173`:
1. Log in with a single-company test account — confirm the shell loads with no visible change (`CompanySwitcher` still renders the static single-company label, no dropdown).
2. Using a test account with 2+ memberships (create one via the existing setup/seed flow if none exists), confirm `CompanySwitcher` now renders as a dropdown; open it and switch companies.
3. Confirm: no flash of the previous company's data in any currently-open screen; `company-profile`/`company-branding` screens (`atlas.company` module) show the newly active company's name/logo immediately after switching; the browser Network tab shows subsequent API requests carrying an `X-Atlas-Company-Id` header matching the newly selected company.
4. Confirm switching does not require re-login and does not clear the Supabase auth session.
5. This is a known gap this plan does not close automatically: report the manual QA result back rather than assuming pass, per this project's verification standard — there is no Playwright/browser automation wired into this session to do it unattended.

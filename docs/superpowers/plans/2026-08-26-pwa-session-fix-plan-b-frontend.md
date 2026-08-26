# PWA session fix — Plan B (Frontend) — Implementation Plan

Date: 2026-08-26
Spec: docs/superpowers/specs/2026-08-26-pwa-multi-window-session-recovery-design.md
Status: Complete

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal

Stop `forceLogout()` from calling `signOut()` (which revokes the session server-side and wipes the `localStorage` shared by every open module window) when another window has already refreshed the shared session — and proactively revalidate a window's session when it regains focus after being backgrounded, instead of waiting for a request to fail first. Corresponds to Goals 2-3 and Acceptance Criteria 3 and 5 of the spec.

## Architecture summary

Both changes are localized to `apps/desktop/src/auth/AuthProvider.jsx`. `forceLogout()` gains a fresh `supabase.auth.getSession()` re-check before committing to `signOut()` — if another window already wrote a still-valid session into the shared storage, adopt it instead of signing out. A new `visibilitychange` listener triggers a background `refreshSession()` when the window regains focus and the current session is at or near expiry, closing the gap where the very first action after returning to a long-backgrounded window would otherwise hit a 401 first.

**Read `AuthProvider.jsx` in full before starting** (already read once during spec verification — 173 lines, small file, re-read it directly rather than trusting this plan's line-number references, which may drift as Task 1 of Plan A lands first).

---

## File Structure Map

### Modify

- `apps/desktop/src/auth/AuthProvider.jsx` — `forceLogout()` re-check, new focus-revalidation effect.

### Create

- `apps/desktop/src/auth/__tests__/session-freshness.test.js` — unit test for the pure helper extracted below (this module has no existing frontend test convention per CLAUDE.md's own note elsewhere in this session's work — `node --test` on a pure, framework-free helper function is the same pattern already used for backend services, applied here to the one piece of this change that's cleanly testable without a React/DOM harness).

---

## Task 1 — Defensive re-check before `signOut()` in `forceLogout()`

**Files:**
- Modify: `apps/desktop/src/auth/AuthProvider.jsx`

- [x] **Step 1: Read the current `forceLogout()` in full (required)**

Confirm its exact current shape before editing — it currently calls `supabase.auth.refreshSession()`, and only on error proceeds straight to `signOut()`. The fix inserts one more check between those two steps.

- [x] **Step 2: Extract a pure freshness-check helper (testable without a DOM)**

Nota: se creó como archivo separado `apps/desktop/src/auth/sessionFreshness.js` (no inline en `AuthProvider.jsx`) para evitar el problema de import de `.jsx` en `node --test` señalado en la nota de la Step 1 del Task 2 — se aplicó la contingencia descrita ahí directamente, sin pasar primero por el intento inline.

Add near the top of `AuthProvider.jsx`, outside the component (module scope, no dependencies on React state):

```javascript
// A session is "fresh enough to adopt" if its expires_at is still in the
// future by at least a small margin — mirrors the backend's own JWT_CLOCK_SKEW_LEEWAY_SECS
// leeway (Plan A) so both sides agree on what counts as "not actually expired."
// Exported so it can be unit-tested without mounting AuthProvider/a DOM.
export const SESSION_FRESHNESS_LEEWAY_SECS = 10;

export function isSessionFresh(session, nowMs = Date.now()) {
  if (!session?.expires_at) return false;
  const expiresAtMs = session.expires_at * 1000;
  return expiresAtMs > nowMs + SESSION_FRESHNESS_LEEWAY_SECS * 1000;
}
```

- [x] **Step 3: Use it in `forceLogout()`**

Replace the current body (read it first — this shows the intended end state, not necessarily matching current line-for-line spacing):

```javascript
    async function forceLogout() {
      // Before signing out permanently, try to refresh the session.
      // A 401 from the API can be transient (network blip, token rotation race).
      // Only sign out if the refresh token itself is also dead.
      const { error: refreshError } = await supabase.auth.refreshSession().catch(() => ({
        error: new Error('refresh_unavailable'),
      }))
      if (!refreshError) {
        // Refresh succeeded — TOKEN_REFRESHED fires, session is alive.
        return
      }

      // This window's own refresh attempt failed — but that can happen even
      // when the SESSION ITSELF is fine, if another module window already
      // consumed/rotated the same refresh token moments earlier (Supabase
      // refresh tokens are single-use). Re-read the session fresh from the
      // shared storage (not a cached value) before concluding it's actually
      // dead — the other window's successful refresh already wrote a new,
      // valid session there.
      const { data: freshData } = await supabase.auth.getSession().catch(() => ({ data: null }))
      const freshSession = freshData?.session ?? null
      if (isSessionFresh(freshSession)) {
        if (!mounted) return
        setSession(freshSession)
        return
      }

      try {
        await supabase.auth.signOut()
      } catch {}
      _sessionVault.clear().catch(() => {})
      if (!mounted) return
      setSession(null)
      setUserProfile(null)
      profileLoadedForAuthUserId = null
    }
```

Note `setUserProfile`/`profileLoadedForAuthUserId` are deliberately NOT touched in the "adopted a fresh session" branch — the existing `onAuthStateChange` handler (already in this file) or the next natural profile-load path will pick up the newly-adopted session; forcing a profile reload here would be redundant with logic that already exists elsewhere in this same file for the `TOKEN_REFRESHED` case.

- [x] **Step 4: Build check**

Run: `pnpm --filter @atlas/desktop exec vite build` — build OK (5.00s, sin errores; solo warnings preexistentes de chunk size no relacionados).

- [x] **Step 5: Commit** (se comitea junto con Task 2 y 3 al final del plan, ver commit final).

---

## Task 2 — Unit test for `isSessionFresh`

**Files:**
- Create: `apps/desktop/src/auth/__tests__/session-freshness.test.js`

- [x] **Step 1: Write the test** (importando desde `../sessionFreshness.js`, no desde `../AuthProvider.jsx` — ver nota del Task 1)

```javascript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSessionFresh, SESSION_FRESHNESS_LEEWAY_SECS } from "../AuthProvider.jsx";

describe("isSessionFresh", () => {
  it("returns true for a session expiring well in the future", () => {
    const nowMs = 1_000_000_000_000;
    const session = { expires_at: Math.floor(nowMs / 1000) + 3600 };
    assert.equal(isSessionFresh(session, nowMs), true);
  });

  it("returns false for a session that already expired", () => {
    const nowMs = 1_000_000_000_000;
    const session = { expires_at: Math.floor(nowMs / 1000) - 60 };
    assert.equal(isSessionFresh(session, nowMs), false);
  });

  it("returns false for a session expiring within the leeway window (not fresh enough to trust)", () => {
    const nowMs = 1_000_000_000_000;
    const session = { expires_at: Math.floor(nowMs / 1000) + Math.floor(SESSION_FRESHNESS_LEEWAY_SECS / 2) };
    assert.equal(isSessionFresh(session, nowMs), false);
  });

  it("returns false for null/undefined session", () => {
    assert.equal(isSessionFresh(null), false);
    assert.equal(isSessionFresh(undefined), false);
  });

  it("returns false for a session with no expires_at", () => {
    assert.equal(isSessionFresh({}), false);
  });
});
```

**Verify before trusting this**: confirm `node --test` can actually import a `.jsx` file directly in this project's current Node/ESM setup — CLAUDE.md notes elsewhere in this project's history that `node --check` does NOT work on `.jsx` files in this repo's environment; confirm whether `node --test` (which actually executes the module, not just parses it) behaves differently, or whether `isSessionFresh`/`SESSION_FRESHNESS_LEEWAY_SECS` need to be moved into a separate `.js` (non-JSX) helper module that `AuthProvider.jsx` imports from, so the test file can import plain `.js` without needing JSX transform support. If `node --test` fails to import the `.jsx` file with a syntax error, do the extraction (create `apps/desktop/src/auth/sessionFreshness.js` with both exports, have `AuthProvider.jsx` import from it) rather than fighting the test runner — this is a small, mechanical adjustment, not a design change.

- [x] **Step 2: Run and confirm** — 5/5 pass (`node --test apps/desktop/src/auth/__tests__/session-freshness.test.js`); también verificado junto con el resto de `apps/desktop/src/auth/__tests__/*.test.js` (7/7 pass, incluye `auth-return-path.test.js` preexistente sin regresión).

- [x] **Step 3: Commit** (se comitea al final del plan, junto con Task 1 y 3).

---

## Task 3 — Proactive revalidation on window focus

**Files:**
- Modify: `apps/desktop/src/auth/AuthProvider.jsx`

- [x] **Step 1: Add a `visibilitychange` effect**

Add a second `useEffect` in `AuthProvider` (separate from the existing large mount effect — this one only needs `session` as a dependency, keeping it independently readable rather than folding into the already-large existing effect):

```javascript
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (!session) return
      if (isSessionFresh(session)) return
      // Window regained focus and the session we last knew about is at/near
      // expiry — refresh proactively instead of waiting for the next API
      // call to fail first (spec Goal 3 / acceptance criterion 5).
      supabase.auth.refreshSession().catch(() => {})
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [session])
```

Note this deliberately does NOT call `forceLogout()` on failure — a failed proactive refresh here isn't evidence of a dead session (the same in-flight-elsewhere race Task 1 handles could apply here too), it just means the next real API call will go through its normal `shouldForceLogout`/`forceLogout` path if it turns out the session really is dead. This effect's only job is to get ahead of the common case (a valid-but-expiring session in a long-backgrounded window) proactively, not to duplicate the existing dead-session detection logic.

- [x] **Step 2: Build check** — `pnpm --filter @atlas/desktop exec vite build` OK.

- [x] **Step 3: Self-review**

(a) Confirmado: `addEventListener('visibilitychange', ...)` solo dispara en el evento, no al montar — no hay llamada espuria a `refreshSession()` en la carga inicial aunque la sesión ya esté cerca de vencer en ese momento.
(b) Riesgo aceptado y documentado, sin fix adicional: si un 401 real ocurre justo cuando la ventana recupera foco, tanto este efecto como `forceLogout()` pueden llamar a `supabase.auth.refreshSession()` casi al mismo tiempo. `supabase-js` serializa sus propios refreshes vía `navigator.locks` internamente en entornos de browser, así que no debería producir una doble rotación de refresh token desde la misma ventana — pero no se verificó el código interno de la librería instalada (`@supabase/supabase-js@^2.105.1`) línea por línea. Riesgo bajo, no bloqueante para este fix.

- [x] **Step 4: Commit** (se comitea junto con Task 1 y 2 en un solo commit — ver abajo).

---

## Rollback Notes

Each task is an independent, small, revertable commit to a single file (`AuthProvider.jsx`) plus one new test file — no persistent state, no schema, no migration. `git revert` any subset of the 3 commits independently if needed.

---

## Verification Gate

Before marking this plan complete:

- [x] `node --test apps/desktop/src/auth/__tests__/session-freshness.test.js` passes (5/5; 7/7 counting the pre-existing `auth-return-path.test.js` in the same directory).
- [x] `pnpm --filter @atlas/desktop exec vite build` — no errors, on every task.
- [ ] Manual (if a session is available): open two module windows, force one to hit a 401 while the other has a live session, confirm the first window recovers instead of both signing out. Background a window past its access-token expiry, refocus it, confirm no login prompt on the first subsequent action. **Pendiente** — requiere un entorno con Supabase configurado y dos ventanas reales; no se ejecutó en esta sesión.

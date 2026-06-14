# Atlas Storefront SDK — AI Context Reference

This document covers the public-facing integration layer of Atlas ERP: the `atlas-sdk.js` browser SDK, the `window.ATLAS_CONFIG` injection system, the `atlas.website` dist-upload feature, and embedded auth patterns for external apps.

## Overview

Atlas ERP exposes a thin browser SDK (`/atlas-sdk.js`) so any external website can detect Atlas
ERP sessions and show the ERP navigation badge. For building full storefront frontends, use the
npm package `@raulbellosom/atlas-sdk` (`packages/storefront-sdk/`).

**Both systems now use the same Supabase session** stored in `sb-<project>-auth-token` in
localStorage. A user who logs in via the npm SDK is automatically recognized by the injected
`atlas-sdk.js` beacon, and vice-versa.

The npm package exposes:
- `createStorefrontClient({ baseUrl, company, supabaseUrl, supabaseAnonKey })` — main factory (requires all four)
- `sdk.auth` — login, register, logout, refresh, me, getSession, onAuthStateChange (Supabase-backed)
- `sdk.files`, `sdk.catalog`, `sdk.discovery`, `sdk.realtime`, `sdk.request`
- `@raulbellosom/atlas-sdk/react` — React hooks: `StorefrontProvider`, `useAuth`, `useSession`, `useFileUpload`, `useProducts`, `useCompanyConfig`, etc.

---

## `window.ATLAS_CONFIG`

The API injects a `<script>` block into every HTML response served by `atlas.website` (both the CMS and uploaded dist builds). The injected config looks like:

```js
window.ATLAS_CONFIG = {
  supabaseUrl:     "https://supabase.example.com",   // Supabase REST base
  supabaseAnonKey: "<anon-key>",                      // public anon key
  apiUrl:          "https://erp.example.com",         // Atlas API root
  storageKey:      "sb-<project>-auth-token",        // localStorage key for the session
  companySlug:     "my-company",
  siteName:        "My Site",
  stripe: {                                           // optional, present if Stripe is configured
    publicKey: "pk_..."
  }
}
```

`injectAtlasConfig` runs server-side before HTML is sent. It writes into `<head>` as a raw JSON string, not as HTML attributes.

---

## Unified session

The npm SDK uses `@supabase/supabase-js` internally. After login, the session is stored in
the same `sb-<project>-auth-token` localStorage key as Atlas ERP. This means:

1. A storefront user who logs in via the npm SDK is automatically seen by the `atlas-sdk.js`
   beacon script — the `erp-badge-check` endpoint is called and the ERP badge appears if the
   user has `platform.erp.access`.
2. An ERP user (admin, employee) can log in on the storefront site and be redirected to Atlas ERP
   without a second login.

The `window.AtlasERP` object (from the IIFE `atlas-sdk.js`) and `sdk.auth` (from the npm package)
share the same session. They are NOT separate auth systems.

### `user.hasErpAccess`

The `user` object returned by `sdk.auth.login()`, `sdk.auth.me()`, and `sdk.auth.getSession()`
includes a `hasErpAccess: boolean` field. It is `true` when the user's role has the
`platform.erp.access` permission. Use this field — not `user.role` — to decide whether to
redirect a user to Atlas ERP after login:

```js
const { user } = await sdk.auth.login({ email, password })
if (user?.hasErpAccess) {
  window.location.href = window.ATLAS_CONFIG?.apiUrl ?? '/'
}
```

Never hardcode role keys (e.g. `storefront_client`, `storefront_vendor`) to make this decision —
role keys can be renamed or new roles added. `hasErpAccess` is set server-side from the
`platform.erp.access` permission and is the authoritative signal.

---

## `window.AtlasERP`

Once `/atlas-sdk.js` loads, it reads `window.ATLAS_CONFIG` synchronously and exposes:

```js
window.AtlasERP = {
  auth: {
    getSession()              // → Promise<session | null>
    getToken()                // → string | null (sync, returns current access token)
    signIn({ email, password }) // → Promise<{ user, session }>
    signOut()                 // → Promise<void>
    onAuthStateChange(cb)     // → unsubscribe fn; cb(event, session)
  },
  renderLogin(selector, options) // mounts login form into selector
}
```

### `auth.getSession()`
Returns the current session from `localStorage` (key = `window.ATLAS_CONFIG.storageKey`). Auto-refreshes via Supabase if the token is within 10 s of expiry.

### `auth.onAuthStateChange(callback)`
Fires on sign-in, sign-out, and cross-tab storage events. Returns an unsubscribe function.

### `renderLogin(selector, options)`

Mounts a self-contained login form (vanilla DOM + scoped CSS with `_ae-` prefix) inside `selector` (string selector or DOM element). Does NOT use shadow DOM.

```js
window.AtlasERP.renderLogin('#login-container', {
  redirectTo: '/dashboard',          // optional: navigate on success
  onSuccess: (session) => { ... },   // optional: callback on successful sign-in
  logo: '/logo.png',                 // optional: logo URL shown above the form
  primaryColor: '#7c3aed',           // optional: CTA button background
})
```

---

## npm SDK auth patterns

Use `@raulbellosom/atlas-sdk` for full storefront frontends (React, Vite, Astro, etc.).

### Instantiate the client

Always read config from `window.ATLAS_CONFIG` at runtime; fall back to env vars for local dev. Both are provided automatically when the site is served by Atlas Website.

```js
import { createStorefrontClient } from '@raulbellosom/atlas-sdk'

const cfg = (typeof window !== 'undefined' && window.ATLAS_CONFIG) ?? {}

export const sdk = createStorefrontClient({
  baseUrl:         cfg.apiUrl         ?? import.meta.env.VITE_ERP_URL,
  company:         cfg.company         ?? import.meta.env.VITE_ERP_COMPANY,
  supabaseUrl:     cfg.supabaseUrl     ?? import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: cfg.supabaseAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY,
})
```

Create the client once (module-level singleton). Never recreate it on every render.

### Login

```js
import { StorefrontError } from '@raulbellosom/atlas-sdk'

async function handleLogin(email, password) {
  try {
    const { user } = await sdk.auth.login({ email, password })

    // ERP users (admin, employee) have platform.erp.access — redirect them out
    if (user.hasErpAccess) {
      window.location.href = window.ATLAS_CONFIG?.apiUrl ?? '/'
      return
    }

    // Storefront users continue into the storefront app
    navigateTo('/dashboard')
  } catch (err) {
    if (err instanceof StorefrontError && err.code === 'UNAUTHORIZED') {
      showError('Correo o contraseña incorrectos')
    } else {
      showError('Error al iniciar sesion')
    }
  }
}
```

`user.hasErpAccess` is `true` when the role has the `platform.erp.access` permission. Never check `user.role` against a hardcoded list — role keys can change.

### Get current user on page load

The session is restored automatically from Supabase's localStorage key on SDK init. Call `getSession()` synchronously right away; it returns the cached session without a network call.

```js
// Sync — no await needed, returns current in-memory session
const session = sdk.auth.getSession()
if (session) {
  renderApp(session.user)
} else {
  renderLoginPage()
}
```

For a fresh profile fetch (e.g., after a role change), call `me()`:

```js
// Async — makes a GET /me request to verify the session server-side
const profile = await sdk.auth.me()
renderApp(profile)
```

### React: subscribe to auth state changes

```jsx
import { useEffect, useState } from 'react'

function useStorefrontSession() {
  const [session, setSession] = useState(() => sdk.auth.getSession())

  useEffect(() => {
    const unsub = sdk.auth.onAuthStateChange((next) => setSession(next))
    return unsub
  }, [])

  return session
}
```

`onAuthStateChange` fires on login, logout, token refresh, and cross-tab session changes.

### Registration

```js
async function handleRegister({ email, password, name, role = 'storefront_client' }) {
  try {
    await sdk.auth.register({ email, password, name, role })
    // registration does NOT start a session — log in separately
    const { user } = await sdk.auth.login({ email, password })
    navigateTo('/dashboard')
  } catch (err) {
    if (err instanceof StorefrontError) {
      if (err.code === 'VALIDATION_ERROR') showError('Datos invalidos')
      else if (err.status === 409) showError('Este correo ya esta registrado')
      else showError(err.message)
    }
  }
}
```

### Logout

```js
await sdk.auth.logout()
// Supabase fires SIGNED_OUT automatically — the SDK clears its session
// and calls onAuthStateChange(null). No manual localStorage cleanup needed.
navigateTo('/login')
```

### Protected route guard

```js
function requireAuth() {
  const session = sdk.auth.getSession()
  if (!session) {
    window.location.replace('/login')
    return null
  }
  return session
}
```

---

## `window.AtlasERP` usage patterns (IIFE beacon)

The IIFE `atlas-sdk.js` beacon is injected automatically on Atlas Website pages. Use it when you only need session detection or the built-in login widget — not for building full storefront apps.

### Plain HTML
```html
<script>/* window.ATLAS_CONFIG already injected by Atlas */</script>
<script src="/atlas-sdk.js"></script>
<div id="login-container"></div>
<script>
  window.AtlasERP.auth.getSession().then(function(session) {
    if (!session) {
      window.AtlasERP.renderLogin('#login-container', { redirectTo: '/app' })
    }
  })
</script>
```

### React / Next.js
```jsx
import { useEffect, useRef } from 'react'

function LoginPage() {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) {
      window.AtlasERP.renderLogin(ref.current, {
        onSuccess: (session) => router.push('/dashboard'),
      })
    }
  }, [])
  return <div ref={ref} />
}
```

In Next.js add the script before interactive:
```jsx
<Script src="/atlas-sdk.js" strategy="beforeInteractive" />
```

### Session-gated fetch
```js
const token = window.AtlasERP.auth.getToken()
fetch('/api/my-endpoint', {
  headers: { Authorization: `Bearer ${token}` }
})
```

### Reading config directly (no SDK)
```js
const { supabaseUrl, supabaseAnonKey, storageKey } = window.ATLAS_CONFIG
const raw = JSON.parse(localStorage.getItem(storageKey) || '{}')
const token = raw?.access_token
```

---

## `atlas.website` Dist Upload

`atlas.website` allows uploading an external built site (e.g., a Vite/Next.js output) as a ZIP and serving it at the site's public URL.

### How it works

1. User builds the external site locally (`vite build`, `next build`, etc.).
2. User uploads the ZIP from the ERP admin panel (Settings → Dist upload) or via API: `POST /website/:siteId/dist/upload` (multipart form, field name `dist`).
3. The API extracts the ZIP, stores files in `atlas-files` Supabase Storage under the site's namespace, and rewrites `localhost`/`127.0.0.1`/`host.docker.internal` origins in HTML to the live site origin (`rewriteDistHtml`).
4. `window.ATLAS_CONFIG` is injected into every HTML file during extraction (`injectAtlasConfig`).
5. The Atlas API serves requests at the site's domain: static assets from storage, HTML with config injected, 404 → `index.html` fallback for SPA routing.

### SDK in the dist
Because the API injects `window.ATLAS_CONFIG` at serve time (not build time), the external site only needs to add:
```html
<script src="/atlas-sdk.js"></script>
```
The SDK resolves the Supabase URL and anon key from `window.ATLAS_CONFIG` at runtime.

### Storefront roles seeded at install
`pnpm db:seed` creates two system roles for storefront users:
- `storefront_client` — end-user registered from an external app
- `storefront_vendor` — vendor registered from an external app

`InstanceConfig` key `storefront.registrable_roles` controls which roles are allowed for self-registration.

---

## SDK source

The SDK source is at `apps/api/src/public/atlas-sdk.js` (pre-built IIFE, ~280 lines). It is not compiled from a separate source file at runtime — edit the file directly and it is served as-is.

The endpoint that serves it:
```js
app.use('/atlas-sdk.js', serveStatic({ path: './src/public/atlas-sdk.js' }))
```

---

## Integration guide location

An integration guide with copy-paste examples is rendered inside the ERP admin panel at `atlas.website` → Settings → Dist upload panel → "Guia de integracion" tab.

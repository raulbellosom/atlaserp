# Atlas Storefront SDK — AI Context Reference

This document covers the public-facing integration layer of Atlas ERP: the `atlas-sdk.js` browser SDK, the `window.ATLAS_CONFIG` injection system, the `atlas.website` dist-upload feature, and embedded auth patterns for external apps.

## Overview

Atlas ERP exposes a thin browser SDK (`/atlas-sdk.js`) so any external website — React, Astro, Vue, Next.js, or plain HTML — can:

1. Authenticate end-users (storefront clients/vendors) through the ERP's Supabase Auth.
2. Render a ready-made login form without writing backend code.
3. Read session state and react to auth changes.

The SDK is served directly from the API at `GET /atlas-sdk.js`. It is a self-contained IIFE; no npm install required.

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

## Usage patterns

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

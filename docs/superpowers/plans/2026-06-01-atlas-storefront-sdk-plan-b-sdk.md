# Atlas Storefront SDK — Plan B: SDK Package

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/storefront-sdk` — a stateful, SSR-compatible JavaScript client published as `@atlas/storefront-sdk` that wraps the storefront API endpoints added in Plan A.

**Architecture:** A single factory function `createStorefrontClient({ baseUrl, company, onSessionChange?, initialSession? })` returns a frozen object with namespaces (`auth`, `files`, `catalog`, `discovery`, `realtime`, `request`). Session is stored in closure memory. All HTTP goes through a single internal `_request()` function that injects auth and company headers automatically. `StorefrontError` is the single error class thrown by every method.

**Tech Stack:** Plain JavaScript (ES modules), `@supabase/supabase-js` (real-time only), Node.js built-in test runner, global `fetch`.

**Prerequisite:** Plan A must be complete and the storefront API must be deployed before running integration smoke tests in this plan.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `packages/storefront-sdk/package.json` | Package metadata, exports, dependencies |
| Create | `packages/storefront-sdk/src/storefront-error.js` | `StorefrontError` class |
| Create | `packages/storefront-sdk/src/core/request.js` | fetch wrapper, maps HTTP errors to StorefrontError |
| Create | `packages/storefront-sdk/src/core/session.js` | In-memory session store with listener callbacks |
| Create | `packages/storefront-sdk/src/auth.js` | `sdk.auth` namespace factory |
| Create | `packages/storefront-sdk/src/files.js` | `sdk.files` namespace factory |
| Create | `packages/storefront-sdk/src/catalog.js` | `sdk.catalog` namespace factory |
| Create | `packages/storefront-sdk/src/discovery.js` | `sdk.discovery` namespace factory |
| Create | `packages/storefront-sdk/src/realtime.js` | `sdk.realtime` namespace factory |
| Create | `packages/storefront-sdk/src/index.js` | `createStorefrontClient` — wires all namespaces |
| Create | `packages/storefront-sdk/src/__tests__/storefront-error.test.js` | |
| Create | `packages/storefront-sdk/src/__tests__/session.test.js` | |
| Create | `packages/storefront-sdk/src/__tests__/request.test.js` | |
| Create | `packages/storefront-sdk/src/__tests__/auth.test.js` | |
| Create | `packages/storefront-sdk/src/__tests__/files.test.js` | |
| Create | `packages/storefront-sdk/src/__tests__/catalog.test.js` | |
| Create | `packages/storefront-sdk/src/__tests__/discovery.test.js` | |
| Modify | `pnpm-workspace.yaml` | Ensure `packages/storefront-sdk` is included |

---

### Task 1: Package scaffold and StorefrontError

**Files:**
- Create: `packages/storefront-sdk/package.json`
- Create: `packages/storefront-sdk/src/storefront-error.js`
- Create: `packages/storefront-sdk/src/__tests__/storefront-error.test.js`

- [ ] **Step 1: Write failing test**

Create `packages/storefront-sdk/src/__tests__/storefront-error.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { StorefrontError } from '../storefront-error.js'

describe('StorefrontError', () => {
  it('is an instance of Error', () => {
    const err = new StorefrontError('test', 'NOT_FOUND', 404)
    assert.ok(err instanceof Error)
    assert.ok(err instanceof StorefrontError)
  })

  it('exposes message, code, and status', () => {
    const err = new StorefrontError('Recurso no encontrado', 'NOT_FOUND', 404)
    assert.equal(err.message, 'Recurso no encontrado')
    assert.equal(err.code, 'NOT_FOUND')
    assert.equal(err.status, 404)
  })

  it('defaults code to UNKNOWN and status to 500', () => {
    const err = new StorefrontError('algo fallo')
    assert.equal(err.code, 'UNKNOWN')
    assert.equal(err.status, 500)
  })

  it('stores extra details when provided', () => {
    const details = { field: 'email', message: 'Invalid' }
    const err = new StorefrontError('error', 'VALIDATION_ERROR', 422, details)
    assert.deepEqual(err.details, details)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test packages/storefront-sdk/src/__tests__/storefront-error.test.js
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Create package.json**

Create `packages/storefront-sdk/package.json`:

```json
{
  "name": "@atlas/storefront-sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js"
  },
  "files": ["src"],
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0"
  }
}
```

- [ ] **Step 4: Create StorefrontError**

Create `packages/storefront-sdk/src/storefront-error.js`:

```js
export class StorefrontError extends Error {
  constructor(message, code = 'UNKNOWN', status = 500, details = null) {
    super(message)
    this.name = 'StorefrontError'
    this.code = code
    this.status = status
    this.details = details
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
node --test packages/storefront-sdk/src/__tests__/storefront-error.test.js
```

Expected: All PASS.

- [ ] **Step 6: Verify pnpm workspace includes the package**

Open `pnpm-workspace.yaml`. Verify it contains `packages/*` or `packages/storefront-sdk`. If not present, add `- 'packages/storefront-sdk'` to the packages list.

```bash
cat pnpm-workspace.yaml
```

- [ ] **Step 7: Commit**

```bash
git add packages/storefront-sdk/
git commit -m "feat(storefront-sdk): scaffold package with StorefrontError class"
```

---

### Task 2: Request core

**Files:**
- Create: `packages/storefront-sdk/src/core/request.js`
- Create: `packages/storefront-sdk/src/__tests__/request.test.js`

- [ ] **Step 1: Write failing tests**

Create `packages/storefront-sdk/src/__tests__/request.test.js`:

```js
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequestCore } from '../core/request.js'
import { StorefrontError } from '../storefront-error.js'

// Mock fetch helper
function mockFetch(status, body) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
}

describe('createRequestCore', () => {
  it('returns parsed JSON on 2xx', async () => {
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'test',
      getSession: () => null,
      fetchFn: mockFetch(200, { data: { id: '1' } }),
    })
    const result = await req('GET', '/test')
    assert.deepEqual(result, { data: { id: '1' } })
  })

  it('throws StorefrontError with code UNAUTHORIZED on 401', async () => {
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'test',
      getSession: () => null,
      fetchFn: mockFetch(401, { error: 'No autorizado' }),
    })
    await assert.rejects(
      () => req('GET', '/protected'),
      (err) => {
        assert.ok(err instanceof StorefrontError)
        assert.equal(err.code, 'UNAUTHORIZED')
        assert.equal(err.status, 401)
        return true
      }
    )
  })

  it('throws StorefrontError with code NOT_FOUND on 404', async () => {
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'test',
      getSession: () => null,
      fetchFn: mockFetch(404, { error: 'No encontrado' }),
    })
    await assert.rejects(
      () => req('GET', '/missing'),
      (err) => {
        assert.equal(err.code, 'NOT_FOUND')
        return true
      }
    )
  })

  it('injects Authorization header when session exists', async () => {
    let capturedHeaders = {}
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'test',
      getSession: () => ({ token: 'my-jwt' }),
      fetchFn: async (url, opts) => {
        capturedHeaders = opts.headers ?? {}
        return { ok: true, status: 200, json: async () => ({ data: 'ok' }), text: async () => '' }
      },
    })
    await req('GET', '/me')
    assert.equal(capturedHeaders['Authorization'], 'Bearer my-jwt')
  })

  it('injects X-Atlas-Company header on every request', async () => {
    let capturedHeaders = {}
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'myco',
      getSession: () => null,
      fetchFn: async (url, opts) => {
        capturedHeaders = opts.headers ?? {}
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
      },
    })
    await req('GET', '/anything')
    assert.equal(capturedHeaders['X-Atlas-Company'], 'myco')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test packages/storefront-sdk/src/__tests__/request.test.js
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Create the request core**

Create `packages/storefront-sdk/src/core/request.js`:

```js
import { StorefrontError } from '../storefront-error.js'

const STATUS_TO_CODE = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  422: 'VALIDATION_ERROR',
}

export function createRequestCore({ baseUrl, company, getSession, fetchFn = fetch }) {
  return async function _request(method, path, body = null, options = {}) {
    const session = getSession()
    const headers = {
      'X-Atlas-Company': company,
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers ?? {}),
    }

    const isFormData = body instanceof FormData
    if (body && !isFormData) {
      headers['Content-Type'] = 'application/json'
    }

    let response
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      })
    } catch {
      throw new StorefrontError('No se pudo conectar con el servidor', 'NETWORK_ERROR', 0)
    }

    if (response.ok) {
      const text = await response.text()
      if (!text) return null
      try { return JSON.parse(text) } catch { return text }
    }

    let errorMessage = `Error ${response.status}`
    let details = null
    try {
      const parsed = await response.json()
      errorMessage = parsed?.error ?? errorMessage
      details = parsed?.details ?? null
    } catch {}

    const code = STATUS_TO_CODE[response.status] ?? 'UNKNOWN'
    throw new StorefrontError(errorMessage, code, response.status, details)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test packages/storefront-sdk/src/__tests__/request.test.js
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storefront-sdk/src/core/request.js packages/storefront-sdk/src/__tests__/request.test.js
git commit -m "feat(storefront-sdk): add request core with header injection and StorefrontError mapping"
```

---

### Task 3: Session management

**Files:**
- Create: `packages/storefront-sdk/src/core/session.js`
- Create: `packages/storefront-sdk/src/__tests__/session.test.js`

- [ ] **Step 1: Write failing tests**

Create `packages/storefront-sdk/src/__tests__/session.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createSessionStore } from '../core/session.js'

describe('createSessionStore', () => {
  it('starts with null session', () => {
    const store = createSessionStore()
    assert.equal(store.get(), null)
  })

  it('stores and retrieves a session', () => {
    const store = createSessionStore()
    const session = { user: { id: '1' }, token: 'abc' }
    store.set(session)
    assert.deepEqual(store.get(), session)
  })

  it('fires onSessionChange callback when session changes', () => {
    let received = undefined
    const store = createSessionStore({ onSessionChange: (s) => { received = s } })
    const session = { user: { id: '1' }, token: 'abc' }
    store.set(session)
    assert.deepEqual(received, session)
  })

  it('fires onSessionChange with null on clear', () => {
    let received = 'not-called'
    const store = createSessionStore({ onSessionChange: (s) => { received = s } })
    store.set({ user: {}, token: 'x' })
    store.clear()
    assert.equal(received, null)
    assert.equal(store.get(), null)
  })

  it('initializes with initialSession if provided', () => {
    const initial = { user: { id: '2' }, token: 'xyz' }
    const store = createSessionStore({ initialSession: initial })
    assert.deepEqual(store.get(), initial)
  })

  it('subscribes and unsubscribes listeners', () => {
    const calls = []
    const store = createSessionStore()
    const unsub = store.subscribe((s) => calls.push(s))
    store.set({ token: 'a' })
    store.set({ token: 'b' })
    unsub()
    store.set({ token: 'c' })
    assert.equal(calls.length, 2)
    assert.equal(calls[0].token, 'a')
    assert.equal(calls[1].token, 'b')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test packages/storefront-sdk/src/__tests__/session.test.js
```

Expected: FAIL.

- [ ] **Step 3: Create the session store**

Create `packages/storefront-sdk/src/core/session.js`:

```js
export function createSessionStore({ initialSession = null, onSessionChange = null } = {}) {
  let _session = initialSession ?? null
  const _listeners = new Set()

  function _notify(session) {
    if (typeof onSessionChange === 'function') onSessionChange(session)
    for (const listener of _listeners) listener(session)
  }

  return {
    get() { return _session },
    set(session) { _session = session; _notify(session) },
    clear() { _session = null; _notify(null) },
    subscribe(fn) {
      _listeners.add(fn)
      return () => _listeners.delete(fn)
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test packages/storefront-sdk/src/__tests__/session.test.js
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storefront-sdk/src/core/session.js packages/storefront-sdk/src/__tests__/session.test.js
git commit -m "feat(storefront-sdk): add session store with listener and callback support"
```

---

### Task 4: sdk.auth namespace

**Files:**
- Create: `packages/storefront-sdk/src/auth.js`
- Create: `packages/storefront-sdk/src/__tests__/auth.test.js`

- [ ] **Step 1: Write failing tests**

Create `packages/storefront-sdk/src/__tests__/auth.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createAuthNamespace } from '../auth.js'
import { createSessionStore } from '../core/session.js'

function makeRequest(responses) {
  const calls = []
  let i = 0
  const fn = async (method, path, body) => {
    calls.push({ method, path, body })
    return responses[i++]
  }
  fn.calls = calls
  return fn
}

describe('sdk.auth.login', () => {
  it('stores session after successful login', async () => {
    const session = createSessionStore()
    const req = makeRequest([{ data: { user: { id: '1', email: 'a@b.com', role: 'storefront_client' }, token: 'tok', refreshToken: 'ref', expiresAt: 9999 } }])
    const auth = createAuthNamespace({ request: req, session })
    const result = await auth.login({ email: 'a@b.com', password: 'pass' })
    assert.equal(result.token, 'tok')
    assert.deepEqual(session.get(), { user: result.user, token: 'tok', refreshToken: 'ref', expiresAt: 9999 })
  })
})

describe('sdk.auth.logout', () => {
  it('clears session after logout', async () => {
    const session = createSessionStore({ initialSession: { user: {}, token: 'tok', refreshToken: 'ref' } })
    const req = makeRequest([{ data: { success: true } }])
    const auth = createAuthNamespace({ request: req, session })
    await auth.logout()
    assert.equal(session.get(), null)
    assert.equal(req.calls[0].path, '/public/storefront/auth/logout')
  })
})

describe('sdk.auth.getSession', () => {
  it('returns current session', () => {
    const s = { user: { id: '1' }, token: 'abc', refreshToken: 'def' }
    const session = createSessionStore({ initialSession: s })
    const auth = createAuthNamespace({ request: async () => {}, session })
    assert.deepEqual(auth.getSession(), s)
  })

  it('returns null when not logged in', () => {
    const session = createSessionStore()
    const auth = createAuthNamespace({ request: async () => {}, session })
    assert.equal(auth.getSession(), null)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test packages/storefront-sdk/src/__tests__/auth.test.js
```

Expected: FAIL.

- [ ] **Step 3: Create auth namespace**

Create `packages/storefront-sdk/src/auth.js`:

```js
export function createAuthNamespace({ request, session }) {
  async function register({ email, password, name, role = 'storefront_client' }) {
    const res = await request('POST', '/public/storefront/auth/register', { email, password, name, role })
    return res.data
  }

  async function login({ email, password }) {
    const res = await request('POST', '/public/storefront/auth/login', { email, password })
    const { user, token, refreshToken, expiresAt } = res.data
    session.set({ user, token, refreshToken, expiresAt })
    return res.data
  }

  async function refresh() {
    const current = session.get()
    if (!current?.refreshToken) throw new Error('No hay sesión activa para refrescar')
    const res = await request('POST', '/public/storefront/auth/refresh', { refreshToken: current.refreshToken })
    const { token, refreshToken, expiresAt } = res.data
    session.set({ ...current, token, refreshToken, expiresAt })
    return res.data
  }

  async function me() {
    const res = await request('GET', '/public/storefront/auth/me')
    return res.data
  }

  async function logout() {
    await request('POST', '/public/storefront/auth/logout')
    session.clear()
  }

  function getSession() {
    return session.get()
  }

  function onAuthStateChange(fn) {
    return session.subscribe(fn)
  }

  return { register, login, refresh, me, logout, getSession, onAuthStateChange }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test packages/storefront-sdk/src/__tests__/auth.test.js
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storefront-sdk/src/auth.js packages/storefront-sdk/src/__tests__/auth.test.js
git commit -m "feat(storefront-sdk): add auth namespace (register, login, logout, me, refresh, session)"
```

---

### Task 5: sdk.files, sdk.catalog, sdk.discovery namespaces

**Files:**
- Create: `packages/storefront-sdk/src/files.js`
- Create: `packages/storefront-sdk/src/catalog.js`
- Create: `packages/storefront-sdk/src/discovery.js`
- Create: `packages/storefront-sdk/src/__tests__/files.test.js`
- Create: `packages/storefront-sdk/src/__tests__/catalog.test.js`
- Create: `packages/storefront-sdk/src/__tests__/discovery.test.js`

- [ ] **Step 1: Write failing tests**

Create `packages/storefront-sdk/src/__tests__/files.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createFilesNamespace } from '../files.js'

function makeRequest(response) {
  const calls = []
  const fn = async (method, path, body) => { calls.push({ method, path, body }); return response }
  fn.calls = calls
  return fn
}

describe('sdk.files.upload', () => {
  it('sends FormData POST to /public/storefront/files/upload', async () => {
    const req = makeRequest({ data: { id: '1', url: 'https://cdn.test/f.jpg', originalName: 'f.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 } })
    const files = createFilesNamespace({ request: req })
    const blob = new Blob(['data'], { type: 'image/jpeg' })
    const file = Object.assign(blob, { name: 'f.jpg' })
    const result = await files.upload(file, { visibility: 'PUBLIC' })
    assert.equal(result.id, '1')
    assert.equal(req.calls[0].method, 'POST')
    assert.equal(req.calls[0].path, '/public/storefront/files/upload')
    assert.ok(req.calls[0].body instanceof FormData)
  })
})

describe('sdk.files.getUrl', () => {
  it('calls GET /public/storefront/files/:id/url', async () => {
    const req = makeRequest({ data: { url: 'https://cdn.test/f.jpg', type: 'public' } })
    const files = createFilesNamespace({ request: req })
    const result = await files.getUrl('abc-123')
    assert.equal(result.url, 'https://cdn.test/f.jpg')
    assert.equal(req.calls[0].path, '/public/storefront/files/abc-123/url')
  })
})
```

Create `packages/storefront-sdk/src/__tests__/catalog.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createCatalogNamespace } from '../catalog.js'

function makeRequest(response) {
  const calls = []
  const fn = async (method, path) => { calls.push({ method, path }); return response }
  fn.calls = calls
  return fn
}

describe('sdk.catalog.products', () => {
  it('calls GET /public/catalog/products', async () => {
    const req = makeRequest({ data: [], total: 0 })
    const catalog = createCatalogNamespace({ request: req })
    await catalog.products()
    assert.ok(req.calls[0].path.startsWith('/public/catalog/products'))
  })

  it('appends query params when provided', async () => {
    const req = makeRequest({ data: [], total: 0 })
    const catalog = createCatalogNamespace({ request: req })
    await catalog.products({ q: 'rock', limit: 10 })
    assert.ok(req.calls[0].path.includes('q=rock'))
    assert.ok(req.calls[0].path.includes('limit=10'))
  })
})

describe('sdk.catalog.getProduct', () => {
  it('calls GET /public/catalog/products/:id', async () => {
    const req = makeRequest({ data: { id: 'p1', name: 'Prod' } })
    const catalog = createCatalogNamespace({ request: req })
    const result = await catalog.getProduct('p1')
    assert.equal(result.id, 'p1')
    assert.equal(req.calls[0].path, '/public/catalog/products/p1')
  })
})
```

Create `packages/storefront-sdk/src/__tests__/discovery.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createDiscoveryNamespace } from '../discovery.js'

function makeRequest(response) {
  return async () => response
}

describe('sdk.discovery.blueprints', () => {
  it('returns the data array from /public/blueprints', async () => {
    const bps = [{ key: 'catalog.product.entity', kind: 'ENTITY' }]
    const req = makeRequest({ data: bps })
    const discovery = createDiscoveryNamespace({ request: req })
    const result = await discovery.blueprints()
    assert.deepEqual(result, bps)
  })
})

describe('sdk.discovery.hasModule', () => {
  it('returns true when module key is present in blueprints', async () => {
    const bps = [{ key: 'catalog.product.entity', kind: 'ENTITY', module: { key: 'atlas.catalog' } }]
    const req = makeRequest({ data: bps })
    const discovery = createDiscoveryNamespace({ request: req })
    const result = await discovery.hasModule('atlas.catalog')
    assert.equal(result, true)
  })

  it('returns false when module key is not present', async () => {
    const req = makeRequest({ data: [] })
    const discovery = createDiscoveryNamespace({ request: req })
    const result = await discovery.hasModule('custom.reservations')
    assert.equal(result, false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test packages/storefront-sdk/src/__tests__/files.test.js packages/storefront-sdk/src/__tests__/catalog.test.js packages/storefront-sdk/src/__tests__/discovery.test.js
```

Expected: All FAIL.

- [ ] **Step 3: Create files namespace**

Create `packages/storefront-sdk/src/files.js`:

```js
export function createFilesNamespace({ request }) {
  async function upload(file, options = {}) {
    const { visibility = 'PUBLIC', entityType = null, entityId = null } = options
    const formData = new FormData()
    formData.append('file', file)
    formData.append('visibility', visibility)
    if (entityType) formData.append('entityType', entityType)
    if (entityId) formData.append('entityId', entityId)
    const res = await request('POST', '/public/storefront/files/upload', formData)
    return res.data
  }

  async function getUrl(id) {
    const res = await request('GET', `/public/storefront/files/${encodeURIComponent(id)}/url`)
    return res.data
  }

  async function getSignedUrl(id) {
    const res = await request('GET', `/public/storefront/files/${encodeURIComponent(id)}/url`)
    return res.data
  }

  async function deleteFile(id) {
    const res = await request('DELETE', `/public/storefront/files/${encodeURIComponent(id)}`)
    return res.data
  }

  return { upload, getUrl, getSignedUrl, delete: deleteFile }
}
```

- [ ] **Step 4: Create catalog namespace**

Create `packages/storefront-sdk/src/catalog.js`:

```js
function toQueryString(params) {
  if (!params) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function createCatalogNamespace({ request }) {
  async function products(options = {}) {
    const res = await request('GET', `/public/catalog/products${toQueryString(options)}`)
    return res
  }

  async function getProduct(id) {
    const res = await request('GET', `/public/catalog/products/${encodeURIComponent(id)}`)
    return res.data
  }

  async function categories(options = {}) {
    const res = await request('GET', `/public/catalog/categories${toQueryString(options)}`)
    return res
  }

  return { products, getProduct, categories }
}
```

- [ ] **Step 5: Create discovery namespace**

Create `packages/storefront-sdk/src/discovery.js`:

```js
export function createDiscoveryNamespace({ request }) {
  async function blueprints() {
    const res = await request('GET', '/public/blueprints')
    return res.data
  }

  async function hasModule(moduleKey) {
    const bps = await blueprints()
    return bps.some(bp => bp.module?.key === moduleKey)
  }

  return { blueprints, hasModule }
}
```

- [ ] **Step 6: Run all tests to verify they pass**

```bash
node --test packages/storefront-sdk/src/__tests__/files.test.js packages/storefront-sdk/src/__tests__/catalog.test.js packages/storefront-sdk/src/__tests__/discovery.test.js
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/storefront-sdk/src/files.js packages/storefront-sdk/src/catalog.js packages/storefront-sdk/src/discovery.js packages/storefront-sdk/src/__tests__/
git commit -m "feat(storefront-sdk): add files, catalog, and discovery namespaces"
```

---

### Task 6: sdk.realtime namespace

**Files:**
- Create: `packages/storefront-sdk/src/realtime.js`

- [ ] **Step 1: Create realtime namespace**

Create `packages/storefront-sdk/src/realtime.js`:

```js
export function createRealtimeNamespace({ request }) {
  let _supabase = null
  let _channel = null
  const _handlers = new Map() // event -> Set<handler>
  let _configPromise = null

  async function _ensureConnected() {
    if (_supabase && _channel) return

    if (!_configPromise) {
      _configPromise = request('GET', '/public/storefront/realtime-config')
        .then(res => res.data)
    }
    const { supabaseUrl, supabaseAnonKey, companyId } = await _configPromise

    // Lazy import to avoid loading Supabase in environments that don't use realtime
    const { createClient } = await import('@supabase/supabase-js')
    _supabase = createClient(supabaseUrl, supabaseAnonKey)

    _channel = _supabase
      .channel(`storefront:company:${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const eventKey = `${payload.table}.${payload.eventType?.toLowerCase()}`
        const handlers = _handlers.get(eventKey) ?? new Set()
        for (const handler of handlers) handler(payload.new ?? payload.old)
      })
      .subscribe()
  }

  function on(event, handler) {
    if (!_handlers.has(event)) _handlers.set(event, new Set())
    _handlers.get(event).add(handler)
    _ensureConnected().catch(console.error)
  }

  function off(event, handler) {
    _handlers.get(event)?.delete(handler)
  }

  async function dispose() {
    if (_channel) await _supabase.removeChannel(_channel)
    _channel = null
    _supabase = null
    _configPromise = null
    _handlers.clear()
  }

  return { on, off, dispose }
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check packages/storefront-sdk/src/realtime.js && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add packages/storefront-sdk/src/realtime.js
git commit -m "feat(storefront-sdk): add realtime namespace with lazy Supabase connection"
```

---

### Task 7: createStorefrontClient — wire everything together

**Files:**
- Create: `packages/storefront-sdk/src/index.js`

- [ ] **Step 1: Create the main entry point**

Create `packages/storefront-sdk/src/index.js`:

```js
import { StorefrontError } from './storefront-error.js'
import { createRequestCore } from './core/request.js'
import { createSessionStore } from './core/session.js'
import { createAuthNamespace } from './auth.js'
import { createFilesNamespace } from './files.js'
import { createCatalogNamespace } from './catalog.js'
import { createDiscoveryNamespace } from './discovery.js'
import { createRealtimeNamespace } from './realtime.js'

export { StorefrontError }

export function createStorefrontClient({ baseUrl, company, onSessionChange, initialSession }) {
  if (!baseUrl) throw new Error('createStorefrontClient: baseUrl es requerido')
  if (!company) throw new Error('createStorefrontClient: company es requerido')

  const session = createSessionStore({ initialSession, onSessionChange })

  const _request = createRequestCore({
    baseUrl,
    company,
    getSession: () => session.get(),
  })

  async function request(method, path, body = null, options = {}) {
    return _request(method, path, body, options)
  }

  const auth = createAuthNamespace({ request: _request, session })
  const files = createFilesNamespace({ request: _request })
  const catalog = createCatalogNamespace({ request: _request })
  const discovery = createDiscoveryNamespace({ request: _request })
  const realtime = createRealtimeNamespace({ request: _request })

  return Object.freeze({ auth, files, catalog, discovery, realtime, request })
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check packages/storefront-sdk/src/index.js && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Run the full test suite**

```bash
node --test packages/storefront-sdk/src/__tests__/
```

Expected: All tests PASS (storefront-error, session, request, auth, files, catalog, discovery).

- [ ] **Step 4: Smoke test end-to-end (requires Plan A API running)**

Create a temporary test file `packages/storefront-sdk/smoke-test.mjs`:

```js
import { createStorefrontClient } from './src/index.js'

const sdk = createStorefrontClient({
  baseUrl: 'http://localhost:4010',
  company: 'YOUR_COMPANY_SLUG',
})

// Test 1: discovery
const bps = await sdk.discovery.blueprints()
console.log('Blueprints:', bps.length, 'items')

// Test 2: catalog
const products = await sdk.catalog.products({ limit: 3 })
console.log('Products:', products)

// Test 3: auth register (use a unique email each run)
const user = await sdk.auth.register({
  email: `sdk-test-${Date.now()}@example.com`,
  password: 'password123',
  name: 'SDK Test User',
})
console.log('Registered:', user)

console.log('All smoke tests passed.')
```

Run it with the API started (`pnpm dev:api` in another terminal):

```bash
node packages/storefront-sdk/smoke-test.mjs
```

Expected output:
```
Blueprints: 14 items
Products: { data: [...], total: 0 }
Registered: { id: '...', displayName: 'SDK Test User', email: '...', role: 'storefront_client' }
All smoke tests passed.
```

Delete the smoke test file after verification:

```bash
rm packages/storefront-sdk/smoke-test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add packages/storefront-sdk/src/index.js
git commit -m "feat(storefront-sdk): wire createStorefrontClient with all namespaces"
```

---

### Task 8: npm publish setup

**Files:**
- Modify: `packages/storefront-sdk/package.json`

- [ ] **Step 1: Update package.json with publish config**

Replace `packages/storefront-sdk/package.json` with:

```json
{
  "name": "@atlas/storefront-sdk",
  "version": "0.1.0",
  "type": "module",
  "description": "Generic JavaScript client for AtlasERP storefront APIs",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js"
  },
  "files": [
    "src"
  ],
  "keywords": ["atlas", "erp", "storefront", "sdk"],
  "license": "MIT",
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0"
  },
  "peerDependencies": {},
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm install
```

Expected: installs `@supabase/supabase-js` in `packages/storefront-sdk`.

- [ ] **Step 3: Run full test suite one final time**

```bash
node --test packages/storefront-sdk/src/__tests__/
```

Expected: All PASS.

- [ ] **Step 4: Final commit**

```bash
git add packages/storefront-sdk/package.json pnpm-lock.yaml
git commit -m "feat(storefront-sdk): Plan B complete — @atlas/storefront-sdk ready for npm publish"
```

# Google Calendar Phase 1-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Calendar instance configuration, per-user OAuth connection, and Google calendar discovery to `atlas.calendar` without implementing event sync yet.

**Architecture:** Extend the existing `atlas.calendar` backend with a small Google integration layer under `apps/api/src/routes/calendar/google/`, persist one encrypted Google connection per Atlas user in Prisma, and expose status/connect/discovery endpoints through the existing calendar router. Use server-side OAuth with raw `fetch` plus Node `crypto` instead of adding a heavyweight Google SDK, then add a thin React Query-powered UI in the existing calendar sidebar for connect/discover flows.

**Tech Stack:** Node.js ESM, Hono, Prisma, `node:test`, Node `crypto`, React, React Query, `@atlas/ui`, Docker `.env` configuration.

---

## Scope guard for this plan

This plan intentionally stops before:

- creating `GoogleCalendarSource` records
- creating Atlas calendars from Google calendars
- importing events
- incremental sync jobs
- detached event logic

Those belong to Phase 3 and Phase 4.

## File map

**Backend**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260607123000_google_calendar_connection/migration.sql`
- Create: `apps/api/src/routes/calendar/google/google-config.js`
- Create: `apps/api/src/routes/calendar/google/google-token-crypto.js`
- Create: `apps/api/src/routes/calendar/google/google-connection-service.js`
- Create: `apps/api/src/routes/calendar/google/google-oauth-service.js`
- Create: `apps/api/src/routes/calendar/google/google-calendar-discovery-service.js`
- Modify: `apps/api/src/routes/calendar/calendar-routes.js`
- Modify: `apps/api/package.json`

**Backend tests**

- Create: `apps/api/src/routes/calendar/__tests__/calendar-google-config.test.js`
- Create: `apps/api/src/routes/calendar/__tests__/calendar-google-connection-service.test.js`
- Create: `apps/api/src/routes/calendar/__tests__/calendar-google-oauth-service.test.js`
- Create: `apps/api/src/routes/calendar/__tests__/calendar-google-routes.test.js`

**SDK + frontend**

- Modify: `packages/sdk/src/index.js`
- Modify: `packages/sdk/src/__tests__/sdk-calendar.test.js`
- Create: `apps/desktop/src/modules/atlas.calendar/hooks/useGoogleCalendarData.js`
- Create: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarConnectionCard.jsx`
- Create: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`

**Docs**

- Modify: `docs/superpowers/specs/2026-06-07-google-calendar-sync-design.md`
- Create: `docs/integrations/google-calendar-setup.md`

### Task 1: Add instance config and token crypto primitives

**Files:**
- Create: `apps/api/src/routes/calendar/google/google-config.js`
- Create: `apps/api/src/routes/calendar/google/google-token-crypto.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-config.test.js`

- [ ] **Step 1: Write the failing config/crypto tests**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveGoogleCalendarConfig } from '../google/google-config.js'
import { createGoogleTokenCrypto } from '../google/google-token-crypto.js'

describe('google-config', () => {
  it('returns configured=false when required env vars are missing', () => {
    const result = resolveGoogleCalendarConfig({})
    assert.equal(result.configured, false)
    assert.equal(result.missing.includes('GOOGLE_OAUTH_CLIENT_ID'), true)
  })

  it('returns normalized values when env vars are present', () => {
    const result = resolveGoogleCalendarConfig({
      GOOGLE_OAUTH_CLIENT_ID: 'client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
      GOOGLE_OAUTH_REDIRECT_URI: ' https://atlas.example.com/calendar/google/connect/callback ',
      GOOGLE_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    })
    assert.equal(result.configured, true)
    assert.equal(result.redirectUri, 'https://atlas.example.com/calendar/google/connect/callback')
    assert.deepEqual(result.scopes, [
      'openid',
      'email',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    ])
  })
})

describe('google-token-crypto', () => {
  it('round-trips a refresh token', () => {
    const cryptoBox = createGoogleTokenCrypto({
      key: Buffer.alloc(32, 9).toString('base64'),
    })
    const encrypted = cryptoBox.encrypt('refresh-token-123')
    const decrypted = cryptoBox.decrypt(encrypted)
    assert.equal(decrypted, 'refresh-token-123')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-config.test.js`

Expected: FAIL with module-not-found errors for `google-config.js` and `google-token-crypto.js`.

- [ ] **Step 3: Write minimal config and crypto implementations**

```js
// apps/api/src/routes/calendar/google/google-config.js
const REQUIRED_ENV_KEYS = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GOOGLE_OAUTH_ENCRYPTION_KEY',
]

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
]

export function resolveGoogleCalendarConfig(env = process.env) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !String(env[key] ?? '').trim())
  if (missing.length > 0) return { configured: false, missing, scopes: GOOGLE_SCOPES }
  return {
    configured: true,
    missing: [],
    clientId: String(env.GOOGLE_OAUTH_CLIENT_ID).trim(),
    clientSecret: String(env.GOOGLE_OAUTH_CLIENT_SECRET).trim(),
    redirectUri: String(env.GOOGLE_OAUTH_REDIRECT_URI).trim(),
    encryptionKey: String(env.GOOGLE_OAUTH_ENCRYPTION_KEY).trim(),
    scopes: GOOGLE_SCOPES,
  }
}
```

```js
// apps/api/src/routes/calendar/google/google-token-crypto.js
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function createGoogleTokenCrypto({ key }) {
  const decodedKey = Buffer.from(String(key), 'base64')
  if (decodedKey.length !== 32) {
    throw new Error('GOOGLE_OAUTH_ENCRYPTION_KEY must decode to 32 bytes.')
  }

  return {
    encrypt(value) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', decodedKey, iv)
      const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()
      return Buffer.concat([iv, tag, encrypted]).toString('base64')
    },
    decrypt(payload) {
      const raw = Buffer.from(String(payload), 'base64')
      const iv = raw.subarray(0, 12)
      const tag = raw.subarray(12, 28)
      const data = raw.subarray(28)
      const decipher = createDecipheriv('aes-256-gcm', decodedKey, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-config.test.js`

Expected: PASS with `2 suites, 3 tests`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/calendar/google/google-config.js apps/api/src/routes/calendar/google/google-token-crypto.js apps/api/src/routes/calendar/__tests__/calendar-google-config.test.js
git commit -m "feat: add google calendar config primitives"
```

### Task 2: Persist one encrypted Google connection per Atlas user

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260607123000_google_calendar_connection/migration.sql`
- Create: `apps/api/src/routes/calendar/google/google-connection-service.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-connection-service.test.js`

- [ ] **Step 1: Write the failing connection service test**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarConnectionService } from '../google/google-connection-service.js'

function makePrisma(overrides = {}) {
  return {
    googleCalendarConnection: {
      findUnique: async () => null,
      upsert: async ({ create, update }) => ({ id: 'gconn-1', ...create, ...update }),
      update: async ({ data }) => ({ id: 'gconn-1', ...data }),
      ...(overrides.googleCalendarConnection ?? {}),
    },
  }
}

describe('google-connection-service', () => {
  it('upserts a single encrypted connection per user', async () => {
    const svc = createGoogleCalendarConnectionService({
      prisma: makePrisma(),
      tokenCrypto: {
        encrypt: (value) => `enc:${value}`,
        decrypt: (value) => value.replace(/^enc:/, ''),
      },
    })

    const connection = await svc.saveConnection({
      userId: 'user-1',
      googleSubject: 'sub-123',
      googleEmail: 'raul@example.com',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      tokenExpiresAt: new Date('2026-06-07T10:00:00.000Z'),
      scopes: ['openid', 'email'],
    })

    assert.equal(connection.userId, 'user-1')
    assert.equal(connection.googleEmail, 'raul@example.com')
    assert.equal(connection.refreshTokenEncrypted, 'enc:refresh-1')
  })

  it('marks a connection as revoked on disconnect', async () => {
    let payload = null
    const prisma = makePrisma({
      googleCalendarConnection: {
        update: async ({ data }) => { payload = data; return { id: 'gconn-1', ...data } },
      },
    })
    const svc = createGoogleCalendarConnectionService({
      prisma,
      tokenCrypto: { encrypt: (value) => value, decrypt: (value) => value },
    })

    await svc.disconnect('user-1')
    assert.equal(payload.status, 'REVOKED')
    assert.equal(payload.revokedAt instanceof Date, true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-connection-service.test.js`

Expected: FAIL with module-not-found for `google-connection-service.js`.

- [ ] **Step 3: Add the Prisma model and migration**

```prisma
model GoogleCalendarConnection {
  id                    String   @id @default(uuid(7)) @db.Uuid
  userId                String   @unique @db.Uuid @map("user_id")
  googleSubject         String   @map("google_subject")
  googleEmail           String   @map("google_email")
  accessTokenEncrypted  String   @map("access_token_encrypted")
  refreshTokenEncrypted String   @map("refresh_token_encrypted")
  tokenExpiresAt        DateTime @map("token_expires_at")
  scopes                Json
  status                String   @default("ACTIVE")
  connectedAt           DateTime @default(now()) @map("connected_at")
  lastSyncAt            DateTime? @map("last_sync_at")
  revokedAt             DateTime? @map("revoked_at")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status])
  @@map("google_calendar_connection")
}
```

```sql
CREATE TABLE "google_calendar_connection" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "user_id" UUID NOT NULL UNIQUE REFERENCES "user_profile"("id") ON DELETE CASCADE,
  "google_subject" TEXT NOT NULL,
  "google_email" TEXT NOT NULL,
  "access_token_encrypted" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT NOT NULL,
  "token_expires_at" TIMESTAMPTZ NOT NULL,
  "scopes" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "connected_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_sync_at" TIMESTAMPTZ NULL,
  "revoked_at" TIMESTAMPTZ NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "google_calendar_connection_status_idx"
  ON "google_calendar_connection" ("status");
```

- [ ] **Step 4: Implement the connection service**

```js
// apps/api/src/routes/calendar/google/google-connection-service.js
export function createGoogleCalendarConnectionService({ prisma, tokenCrypto }) {
  async function getConnectionByUserId(userId) {
    return prisma.googleCalendarConnection.findUnique({ where: { userId } })
  }

  async function saveConnection(input) {
    const accessTokenEncrypted = tokenCrypto.encrypt(input.accessToken)
    const refreshTokenEncrypted = tokenCrypto.encrypt(input.refreshToken)
    return prisma.googleCalendarConnection.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        googleSubject: input.googleSubject,
        googleEmail: input.googleEmail,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        scopes: input.scopes,
        status: 'ACTIVE',
        revokedAt: null,
      },
      update: {
        googleSubject: input.googleSubject,
        googleEmail: input.googleEmail,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        scopes: input.scopes,
        status: 'ACTIVE',
        revokedAt: null,
      },
    })
  }

  async function disconnect(userId) {
    return prisma.googleCalendarConnection.update({
      where: { userId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    })
  }

  return { getConnectionByUserId, saveConnection, disconnect }
}
```

- [ ] **Step 5: Run the targeted test and Prisma validation**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-connection-service.test.js && pnpm prisma validate`

Expected: PASS for tests and `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260607123000_google_calendar_connection/migration.sql apps/api/src/routes/calendar/google/google-connection-service.js apps/api/src/routes/calendar/__tests__/calendar-google-connection-service.test.js
git commit -m "feat: persist google calendar user connections"
```

### Task 3: Implement OAuth URL generation, callback exchange, and calendar discovery

**Files:**
- Create: `apps/api/src/routes/calendar/google/google-oauth-service.js`
- Create: `apps/api/src/routes/calendar/google/google-calendar-discovery-service.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-oauth-service.test.js`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Write the failing OAuth/discovery tests**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleOAuthService } from '../google/google-oauth-service.js'

describe('google-oauth-service', () => {
  it('builds an auth URL with offline access and consent', () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
      },
      fetchImpl: async () => { throw new Error('not used') },
    })

    const url = svc.buildAuthorizationUrl({ state: 'state-123' })
    assert.equal(url.includes('access_type=offline'), true)
    assert.equal(url.includes('prompt=consent'), true)
    assert.equal(url.includes('state=state-123'), true)
  })

  it('exchanges code for tokens and account identity', async () => {
    const fetchCalls = []
    const fetchImpl = async (url) => {
      fetchCalls.push(url)
      if (String(url).includes('/token')) {
        return {
          ok: true,
          json: async () => ({
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            expires_in: 3600,
            id_token: 'header.payload.signature',
            scope: 'openid email https://www.googleapis.com/auth/calendar.readonly',
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          sub: 'sub-123',
          email: 'raul@example.com',
        }),
      }
    }

    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
      },
      fetchImpl,
    })

    const result = await svc.exchangeCodeForTokens({ code: 'code-123' })
    assert.equal(result.googleSubject, 'sub-123')
    assert.equal(result.googleEmail, 'raul@example.com')
    assert.equal(result.refreshToken, 'refresh-1')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-oauth-service.test.js`

Expected: FAIL with module-not-found for `google-oauth-service.js`.

- [ ] **Step 3: Implement raw-fetch OAuth and calendar discovery**

```js
// apps/api/src/routes/calendar/google/google-oauth-service.js
export function createGoogleOAuthService({ config, fetchImpl = fetch }) {
  function buildAuthorizationUrl({ state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      scope: config.scopes.join(' '),
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  async function exchangeCodeForTokens({ code }) {
    const tokenResponse = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokenJson = await tokenResponse.json()
    const userInfoResponse = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const userInfo = await userInfoResponse.json()
    return {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      tokenExpiresAt: new Date(Date.now() + Number(tokenJson.expires_in ?? 0) * 1000),
      scopes: String(tokenJson.scope ?? '').split(' ').filter(Boolean),
      googleSubject: userInfo.sub,
      googleEmail: userInfo.email,
    }
  }

  return { buildAuthorizationUrl, exchangeCodeForTokens }
}
```

```js
// apps/api/src/routes/calendar/google/google-calendar-discovery-service.js
export function createGoogleCalendarDiscoveryService({ fetchImpl = fetch }) {
  async function listCalendars({ accessToken }) {
    const response = await fetchImpl('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const payload = await response.json()
    return Array.isArray(payload.items)
      ? payload.items.map((item) => ({
          id: item.id,
          summary: item.summary,
          primary: Boolean(item.primary),
          timeZone: item.timeZone ?? null,
          backgroundColor: item.backgroundColor ?? null,
        }))
      : []
  }

  return { listCalendars }
}
```

- [ ] **Step 4: Add the dependency only if you choose not to stay on raw fetch**

```json
{
  "dependencies": {
    "googleapis": "^150.0.1"
  }
}
```

If raw `fetch` is kept, skip the dependency change and keep `apps/api/package.json` untouched.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-oauth-service.test.js`

Expected: PASS with `2 tests`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/calendar/google/google-oauth-service.js apps/api/src/routes/calendar/google/google-calendar-discovery-service.js apps/api/src/routes/calendar/__tests__/calendar-google-oauth-service.test.js apps/api/package.json
git commit -m "feat: add google oauth and calendar discovery services"
```

### Task 4: Expose status, connect, callback, and calendar discovery endpoints

**Files:**
- Modify: `apps/api/src/routes/calendar/calendar-routes.js`
- Modify: `packages/sdk/src/index.js`
- Modify: `packages/sdk/src/__tests__/sdk-calendar.test.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-routes.test.js`

- [ ] **Step 1: Write the failing route and SDK tests**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('atlas SDK — google calendar endpoints', () => {
  it('getGoogleStatus GETs /calendar/google/status', async () => {
    let call = null
    globalThis.fetch = async (url, opts) => {
      call = { url, opts }
      return { ok: true, json: async () => ({ ok: true }), text: async () => 'ok' }
    }
    const { createAtlasClient } = await import('../index.js')
    await createAtlasClient({ baseUrl: 'http://api' }).calendar.getGoogleStatus('tok')
    assert.equal(call.url, 'http://api/calendar/google/status')
  })
})
```

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('calendar google routes', () => {
  it('returns configured=false when instance env is incomplete', async () => {
    // Build a tiny Hono app from createCalendarRouter with test doubles and hit /calendar/google/status
    assert.equal(true, false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-routes.test.js && pnpm exec node --test packages/sdk/src/__tests__/sdk-calendar.test.js`

Expected: FAIL because the endpoints and SDK methods do not exist yet.

- [ ] **Step 3: Add routes to the existing calendar router**

```js
app.get('/calendar/google/status', requirePermission('calendar.calendars.read'), async (c) => {
  const userId = getUserId(c)
  const config = resolveGoogleCalendarConfig(process.env)
  const connection = config.configured
    ? await googleConnectionSvc.getConnectionByUserId(userId)
    : null
  return c.json({
    configured: config.configured,
    missing: config.missing ?? [],
    redirectUri: config.configured ? config.redirectUri : null,
    connection: connection
      ? {
          googleEmail: connection.googleEmail,
          status: connection.status,
          connectedAt: connection.connectedAt,
        }
      : null,
  })
})

app.post('/calendar/google/connect/start', requirePermission('calendar.calendars.read'), async (c) => {
  const userId = getUserId(c)
  const authUrl = googleOAuthSvc.buildAuthorizationUrl({ state: userId })
  return c.json({ authUrl })
})

app.get('/calendar/google/connect/callback', requirePermission('calendar.calendars.read'), async (c) => {
  const userId = getUserId(c)
  const code = c.req.query('code')
  if (!code) return c.json({ error: 'code es requerido.' }, 400)
  const tokenPayload = await googleOAuthSvc.exchangeCodeForTokens({ code })
  const connection = await googleConnectionSvc.saveConnection({ userId, ...tokenPayload })
  return c.json({
    ok: true,
    connection: {
      googleEmail: connection.googleEmail,
      status: connection.status,
    },
  })
})

app.get('/calendar/google/calendars', requirePermission('calendar.calendars.read'), async (c) => {
  const userId = getUserId(c)
  const connection = await googleConnectionSvc.getConnectionByUserId(userId)
  if (!connection || connection.status !== 'ACTIVE') {
    return c.json({ error: 'No hay una cuenta Google conectada.' }, 409)
  }
  const accessToken = googleTokenCrypto.decrypt(connection.accessTokenEncrypted)
  const calendars = await googleDiscoverySvc.listCalendars({ accessToken })
  return c.json({ items: calendars })
})
```

- [ ] **Step 4: Extend the SDK**

```js
getGoogleStatus: (token) =>
  request('/calendar/google/status', { headers: withAuthHeaders(token) }),
startGoogleConnect: (token) =>
  request('/calendar/google/connect/start', {
    method: 'POST',
    headers: withAuthHeaders(token),
  }),
finishGoogleConnect: (query, token) =>
  request(`/calendar/google/connect/callback${toQueryString(query)}`, {
    headers: withAuthHeaders(token),
  }),
listGoogleCalendars: (token) =>
  request('/calendar/google/calendars', { headers: withAuthHeaders(token) }),
```

- [ ] **Step 5: Run the targeted tests**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-routes.test.js && pnpm exec node --test packages/sdk/src/__tests__/sdk-calendar.test.js`

Expected: PASS for the new Google status/connect/list calendar assertions.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/calendar/calendar-routes.js apps/api/src/routes/calendar/__tests__/calendar-google-routes.test.js packages/sdk/src/index.js packages/sdk/src/__tests__/sdk-calendar.test.js
git commit -m "feat: expose google calendar connection endpoints"
```

### Task 5: Add the sidebar UX for connect and calendar discovery

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/hooks/useGoogleCalendarData.js`
- Create: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarConnectionCard.jsx`
- Create: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`

- [ ] **Step 1: Add React Query hooks for Google connection status**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useGoogleCalendarStatus() {
  const token = useToken()
  return useQuery({
    queryKey: ['calendar', 'google', 'status'],
    queryFn: () => atlas.calendar.getGoogleStatus(token),
    enabled: Boolean(token),
  })
}

export function useStartGoogleCalendarConnect() {
  const token = useToken()
  return useMutation({
    mutationFn: () => atlas.calendar.startGoogleConnect(token),
  })
}

export function useGoogleCalendarList(enabled = true) {
  const token = useToken()
  return useQuery({
    queryKey: ['calendar', 'google', 'calendars'],
    queryFn: () => atlas.calendar.listGoogleCalendars(token),
    enabled: Boolean(token && enabled),
  })
}
```

- [ ] **Step 2: Add the connection card component**

```jsx
import { Button, EmptyState, ErrorState } from '@atlas/ui'
import { useGoogleCalendarStatus, useStartGoogleCalendarConnect } from '../hooks/useGoogleCalendarData'

export default function GoogleCalendarConnectionCard({ onSelectCalendars }) {
  const { data, isLoading, isError } = useGoogleCalendarStatus()
  const startConnect = useStartGoogleCalendarConnect()

  if (isLoading) return <div className="text-xs text-[hsl(var(--muted-foreground))]">Cargando Google…</div>
  if (isError) return <ErrorState title="No se pudo consultar Google Calendar" />
  if (!data?.configured) return <EmptyState title="Google Calendar no configurado" description="Faltan variables de entorno en la instancia." />

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-3 space-y-2">
      <div className="text-xs font-semibold">Google Calendar</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        {data.connection ? `Conectado como ${data.connection.googleEmail}` : 'Sin cuenta conectada'}
      </div>
      {!data.connection ? (
        <Button
          size="sm"
          onClick={async () => {
            const result = await startConnect.mutateAsync()
            window.location.href = result.authUrl
          }}
        >
          Conectar Google
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={onSelectCalendars}>
          Elegir calendarios
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add the picker dialog and wire it into the left sidebar**

```jsx
// apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, EmptyState } from '@atlas/ui'
import { useGoogleCalendarList } from '../hooks/useGoogleCalendarData'

export default function GoogleCalendarCalendarPickerDialog({ open, onClose }) {
  const { data, isLoading } = useGoogleCalendarList(open)
  const items = data?.items ?? []

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seleccionar calendarios de Google</DialogTitle>
        </DialogHeader>
        {isLoading ? <div className="text-sm">Cargando calendarios…</div> : null}
        {!isLoading && items.length === 0 ? <EmptyState title="No hay calendarios disponibles" /> : null}
        {!isLoading && items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded border p-2 text-sm">
                <div className="font-medium">{item.summary}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{item.timeZone ?? 'Sin zona horaria'}</div>
              </div>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
```

```jsx
// inside CalendarLeftSidebar.jsx
import GoogleCalendarConnectionCard from './GoogleCalendarConnectionCard'
import GoogleCalendarCalendarPickerDialog from './GoogleCalendarCalendarPickerDialog'

const [googlePickerOpen, setGooglePickerOpen] = useState(false)

<section>
  <GoogleCalendarConnectionCard onSelectCalendars={() => setGooglePickerOpen(true)} />
</section>

<GoogleCalendarCalendarPickerDialog
  open={googlePickerOpen}
  onClose={() => setGooglePickerOpen(false)}
/>
```

- [ ] **Step 4: Run a manual smoke check**

Run: `pnpm dev`

Expected:
- sidebar shows `Google Calendar`
- when env vars are missing, UI shows `Google Calendar no configurado`
- when env vars exist and no connection exists, `Conectar Google` is visible

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/hooks/useGoogleCalendarData.js apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarConnectionCard.jsx apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx
git commit -m "feat: add google calendar connection ui"
```

### Task 6: Document instance setup and local verification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-07-google-calendar-sync-design.md`
- Create: `docs/integrations/google-calendar-setup.md`

- [ ] **Step 1: Write the setup guide**

```md
# Google Calendar Setup

## Variables de entorno

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_ENCRYPTION_KEY`

## Desarrollo local

Agregar estas variables a `.env` y registrar en Google Cloud una redirect URI como:

`http://localhost:4010/calendar/google/connect/callback`

## Produccion

Registrar la URI publica real de la instancia, por ejemplo:

`https://atlas.midominio.com/calendar/google/connect/callback`
```

- [ ] **Step 2: Add exact verification commands**

```bash
pnpm prisma validate
pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-config.test.js
pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-connection-service.test.js
pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-oauth-service.test.js
pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-routes.test.js
pnpm exec node --test packages/sdk/src/__tests__/sdk-calendar.test.js
```

Expected:
- all tests PASS
- Prisma schema validates
- manual sidebar smoke test works with and without env vars

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-06-07-google-calendar-sync-design.md docs/integrations/google-calendar-setup.md
git commit -m "docs: add google calendar setup guide"
```

## Self-review notes

- Spec coverage:
  - instance `.env` configuration: Task 1, Task 6
  - one Google account per user: Task 2
  - OAuth connect flow: Task 3, Task 4
  - user calendar discovery: Task 3, Task 4, Task 5
  - portable Docker/self-hosted setup: Task 6
- Intentional deferrals:
  - source persistence and calendar creation from Google
  - event import
  - sync tokens and background jobs
  - detached-event rules
- Scope correction applied:
  - `openid` and `email` are kept in scope because Phase 2 needs a stable `sub` and email for the connected Google account.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createCalendarRouter } from '../calendar-routes.js'

const CONFIGURED_GOOGLE_ENV = {
  GOOGLE_OAUTH_CLIENT_ID: 'client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://atlas.example.com/app/google/calendar/callback',
  GOOGLE_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
}

function makeRequirePermission(calls = [], userId = 'user-1') {
  return (permission) => async (c, next) => {
    calls.push(permission)
    const authorization = c.req.header('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return c.json({ error: 'No autorizado. Debes iniciar sesion.' }, 401)
    }

    c.set('userContext', {
      profile: {
        id: userId,
      },
    })

    await next()
  }
}

function createTestApp({
  config = {
    configured: true,
    missing: [],
    clientId: CONFIGURED_GOOGLE_ENV.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: CONFIGURED_GOOGLE_ENV.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: CONFIGURED_GOOGLE_ENV.GOOGLE_OAUTH_REDIRECT_URI,
    encryptionKey: CONFIGURED_GOOGLE_ENV.GOOGLE_OAUTH_ENCRYPTION_KEY,
    scopes: ['openid', 'email'],
  },
  connection = null,
  savedConnection = null,
  tokenPayload = null,
  discoveredCalendars = [],
  sources = [],
} = {}) {
  const permissionCalls = []
  const oauthCalls = []
  const saveCalls = []
  const decryptCalls = []
  const discoveryCalls = []
  const sourceCalls = []
  const disconnectCalls = []

  const app = createCalendarRouter({
    prisma: {},
    requirePermission: makeRequirePermission(permissionCalls),
    google: {
      resolveConfig: () => config,
      connectionService: {
        getConnectionByUserId: async () => connection,
        saveConnection: async (input) => {
          saveCalls.push(input)
          return savedConnection ?? {
            userId: input.userId,
            googleEmail: input.googleEmail,
            status: 'ACTIVE',
            connectedAt: new Date('2026-06-07T12:00:00.000Z'),
          }
        },
        disconnect: async (userId) => {
          disconnectCalls.push(userId)
          return { ok: true }
        },
      },
      oauthService: {
        createAuthorizationState: ({ userId }) => {
          oauthCalls.push({ type: 'state', userId })
          return `signed-state:${userId}`
        },
        verifyAuthorizationState: ({ state, userId }) => {
          oauthCalls.push({ type: 'verify', state, userId })
          if (state !== `signed-state:${userId}`) {
            const error = new Error('Invalid OAuth state.')
            error.status = 401
            throw error
          }
          return { userId }
        },
        buildAuthorizationUrl: ({ state }) => {
          oauthCalls.push({ type: 'start', state })
          return `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}`
        },
        exchangeCodeForTokens: async ({ code }) => {
          oauthCalls.push({ type: 'callback', code })
          return tokenPayload ?? {
            accessToken: 'access-1',
            refreshToken: 'refresh-1',
            tokenExpiresAt: new Date('2026-06-07T13:00:00.000Z'),
            scopes: ['openid', 'email'],
            googleSubject: 'sub-123',
            googleEmail: 'raul@example.com',
          }
        },
      },
      tokenCrypto: {
        decrypt: (value) => {
          decryptCalls.push(value)
          return `decrypted:${value}`
        },
      },
      discoveryService: {
        listCalendars: async ({ accessToken }) => {
          discoveryCalls.push(accessToken)
          return discoveredCalendars
        },
      },
      sourceService: {
        listSourcesForConnection: async (connectionId) => {
          sourceCalls.push({ type: 'list', connectionId })
          return sources
        },
        saveSelectedSources: async (input) => {
          sourceCalls.push({ type: 'save', input })
          return { items: sources }
        },
        disableSourcesForConnection: async (connectionId) => {
          sourceCalls.push({ type: 'disable', connectionId })
          return { count: 1 }
        },
      },
    },
  })

  return {
    app,
    permissionCalls,
    oauthCalls,
    saveCalls,
    decryptCalls,
    discoveryCalls,
    sourceCalls,
    disconnectCalls,
  }
}

describe('calendar google routes', () => {
  it('returns configured=false when instance env is incomplete', async () => {
    const { app, permissionCalls } = createTestApp({
      config: {
        configured: false,
        missing: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
        scopes: ['openid', 'email'],
      },
    })

    const response = await app.request('http://localhost/calendar/google/status', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      configured: false,
      missing: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
      redirectUri: null,
      connection: null,
    })
    assert.deepEqual(permissionCalls, ['calendar.calendars.read'])
  })

  it('returns config status and current user connection details', async () => {
    const connection = {
      userId: 'user-1',
      googleEmail: 'raul@example.com',
      status: 'ACTIVE',
      connectedAt: '2026-06-07T12:00:00.000Z',
    }
    const { app } = createTestApp({
      connection,
    })

    const response = await app.request('http://localhost/calendar/google/status', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      configured: true,
      missing: [],
      redirectUri: 'https://atlas.example.com/app/google/calendar/callback',
      connection: {
        googleEmail: 'raul@example.com',
        status: 'ACTIVE',
        connectedAt: '2026-06-07T12:00:00.000Z',
      },
    })
  })

  it('returns an auth URL for the authenticated user', async () => {
    const { app, oauthCalls, permissionCalls } = createTestApp()

    const response = await app.request('http://localhost/calendar/google/connect/start', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state%3Auser-1',
    })
    assert.deepEqual(oauthCalls, [
      { type: 'state', userId: 'user-1' },
      { type: 'start', state: 'signed-state:user-1' },
    ])
    assert.deepEqual(permissionCalls, ['calendar.calendars.read'])
  })

  it('requires code on the authenticated callback endpoint', async () => {
    const { app } = createTestApp()

    const response = await app.request('http://localhost/calendar/google/connect/callback', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.deepEqual(payload, {
      error: 'code es requerido.',
    })
  })

  it('requires state on the authenticated callback endpoint', async () => {
    const { app } = createTestApp()

    const response = await app.request('http://localhost/calendar/google/connect/callback?code=code-123', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.deepEqual(payload, {
      error: 'state es requerido.',
    })
  })

  it('exchanges code and persists the user connection', async () => {
    const { app, oauthCalls, saveCalls, permissionCalls } = createTestApp({
      tokenPayload: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        tokenExpiresAt: new Date('2026-06-07T13:00:00.000Z'),
        scopes: ['openid', 'email'],
        googleSubject: 'sub-123',
        googleEmail: 'raul@example.com',
      },
      savedConnection: {
        userId: 'user-1',
        googleEmail: 'raul@example.com',
        status: 'ACTIVE',
      },
    })

    const response = await app.request('http://localhost/calendar/google/connect/callback?code=code-123&state=signed-state%3Auser-1', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(oauthCalls, [
      { type: 'verify', state: 'signed-state:user-1', userId: 'user-1' },
      { type: 'callback', code: 'code-123' },
    ])
    assert.equal(saveCalls.length, 1)
    assert.equal(saveCalls[0].userId, 'user-1')
    assert.equal(saveCalls[0].accessToken, 'access-1')
    assert.deepEqual(permissionCalls, ['calendar.calendars.read'])
    assert.deepEqual(payload, {
      ok: true,
      connection: {
        googleEmail: 'raul@example.com',
        status: 'ACTIVE',
      },
    })
  })

  it('preserves semantic OAuth error status on callback failures', async () => {
    const { app } = createTestApp({
      tokenPayload: null,
    })

    const oauthError = new Error('Google OAuth token exchange failed. invalid_grant')
    oauthError.status = 401

    const failingApp = createCalendarRouter({
      prisma: {},
      requirePermission: makeRequirePermission([]),
      google: {
        resolveConfig: () => ({
          configured: true,
          missing: [],
          clientId: CONFIGURED_GOOGLE_ENV.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: CONFIGURED_GOOGLE_ENV.GOOGLE_OAUTH_CLIENT_SECRET,
          redirectUri: CONFIGURED_GOOGLE_ENV.GOOGLE_OAUTH_REDIRECT_URI,
          encryptionKey: CONFIGURED_GOOGLE_ENV.GOOGLE_OAUTH_ENCRYPTION_KEY,
          scopes: ['openid', 'email'],
        }),
        connectionService: {
          getConnectionByUserId: async () => null,
          saveConnection: async () => {
            throw new Error('not used')
          },
        },
        oauthService: {
          buildAuthorizationUrl: () => 'unused',
          verifyAuthorizationState: () => ({ userId: 'user-1' }),
          exchangeCodeForTokens: async () => {
            throw oauthError
          },
        },
        tokenCrypto: {
          decrypt: (value) => value,
        },
        discoveryService: {
          listCalendars: async () => [],
        },
      },
    })

    const response = await failingApp.request('http://localhost/calendar/google/connect/callback?code=bad-code&state=signed-state%3Auser-1', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.deepEqual(payload, {
      error: 'Google OAuth token exchange failed. invalid_grant',
    })
  })

  it('requires an active connection to list Google calendars', async () => {
    const { app } = createTestApp({
      connection: null,
    })

    const response = await app.request('http://localhost/calendar/google/calendars', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 409)
    assert.deepEqual(payload, {
      error: 'No hay una cuenta Google conectada.',
    })
  })

  it('decrypts the stored access token before calendar discovery', async () => {
    const { app, decryptCalls, discoveryCalls, permissionCalls } = createTestApp({
      connection: {
        userId: 'user-1',
        status: 'ACTIVE',
        accessTokenEncrypted: 'enc-token',
        tokenExpiresAt: '2099-06-08T12:00:00.000Z',
      },
      discoveredCalendars: [
        {
          id: 'primary',
          summary: 'Principal',
          primary: true,
          timeZone: 'America/Mexico_City',
          backgroundColor: '#1a73e8',
        },
      ],
    })

    const response = await app.request('http://localhost/calendar/google/calendars', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(decryptCalls, ['enc-token'])
    assert.deepEqual(discoveryCalls, ['decrypted:enc-token'])
    assert.deepEqual(permissionCalls, ['calendar.calendars.read'])
    assert.deepEqual(payload, {
      items: [
        {
          id: 'primary',
          summary: 'Principal',
          primary: true,
          timeZone: 'America/Mexico_City',
          backgroundColor: '#1a73e8',
        },
      ],
    })
  })

  it('returns an actionable error when the stored access token is expired', async () => {
    const { app, decryptCalls, discoveryCalls } = createTestApp({
      connection: {
        userId: 'user-1',
        status: 'ACTIVE',
        accessTokenEncrypted: 'enc-token',
        tokenExpiresAt: '2000-06-06T12:00:00.000Z',
      },
    })

    const response = await app.request('http://localhost/calendar/google/calendars', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 409)
    assert.deepEqual(payload, {
      error: 'La conexion de Google Calendar expiro. Reconecta la cuenta para continuar.',
    })
    assert.deepEqual(decryptCalls, [])
    assert.deepEqual(discoveryCalls, [])
  })

  it('lists persisted Google sources for the active connection', async () => {
    const { app, sourceCalls, permissionCalls } = createTestApp({
      connection: {
        id: 'gconn-1',
        userId: 'user-1',
        status: 'ACTIVE',
      },
      sources: [
        {
          id: 'gsrc-1',
          googleCalendarId: 'primary',
          atlasCalendarId: 'cal-1',
          googleCalendarName: 'Principal',
          syncStatus: 'PENDING_INITIAL_SYNC',
          enabled: true,
        },
      ],
    })

    const response = await app.request('http://localhost/calendar/google/sources', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(permissionCalls, ['calendar.calendars.read'])
    assert.deepEqual(sourceCalls, [
      { type: 'list', connectionId: 'gconn-1' },
    ])
    assert.deepEqual(payload, {
      items: [
        {
          id: 'gsrc-1',
          googleCalendarId: 'primary',
          atlasCalendarId: 'cal-1',
          googleCalendarName: 'Principal',
          syncStatus: 'PENDING_INITIAL_SYNC',
          enabled: true,
        },
      ],
    })
  })

  it('requires an active connection to list Google sources', async () => {
    const { app, sourceCalls } = createTestApp({
      connection: null,
    })

    const response = await app.request('http://localhost/calendar/google/sources', {
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 409)
    assert.deepEqual(payload, {
      error: 'No hay una cuenta Google conectada.',
    })
    assert.deepEqual(sourceCalls, [])
  })

  it('persists the selected Google calendars as sources', async () => {
    const selectedCalendars = [
      {
        id: 'primary',
        summary: 'Principal',
        timeZone: 'America/Mexico_City',
      },
    ]
    const { app, sourceCalls, permissionCalls } = createTestApp({
      connection: {
        id: 'gconn-1',
        userId: 'user-1',
        status: 'ACTIVE',
      },
      sources: [
        {
          id: 'gsrc-1',
          googleCalendarId: 'primary',
          atlasCalendarId: 'cal-1',
          googleCalendarName: 'Principal',
          syncStatus: 'PENDING_INITIAL_SYNC',
          enabled: true,
        },
      ],
    })

    const response = await app.request('http://localhost/calendar/google/sources', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        calendars: selectedCalendars,
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 201)
    assert.deepEqual(permissionCalls, ['calendar.calendars.create'])
    assert.deepEqual(sourceCalls, [
      {
        type: 'save',
        input: {
          connectionId: 'gconn-1',
          ownerId: 'user-1',
          calendars: selectedCalendars,
        },
      },
    ])
    assert.deepEqual(payload, {
      items: [
        {
          id: 'gsrc-1',
          googleCalendarId: 'primary',
          atlasCalendarId: 'cal-1',
          googleCalendarName: 'Principal',
          syncStatus: 'PENDING_INITIAL_SYNC',
          enabled: true,
        },
      ],
    })
  })

  it('triggers initial import for newly selected sources after saving them', async () => {
    const importCalls = []
    const app = createCalendarRouter({
      prisma: {},
      requirePermission: makeRequirePermission([]),
      google: {
        resolveConfig: () => ({
          configured: true,
          missing: [],
          clientId: 'client-id',
          clientSecret: 'client-secret',
          redirectUri: 'https://atlas.example.com/app/google/calendar/callback',
          encryptionKey: Buffer.alloc(32, 7).toString('base64'),
          scopes: ['openid', 'email'],
        }),
        connectionService: {
          getConnectionByUserId: async () => ({
            id: 'gconn-1',
            status: 'ACTIVE',
            accessTokenEncrypted: 'enc-token',
            tokenExpiresAt: '2099-06-08T12:00:00.000Z',
          }),
        },
        tokenCrypto: { decrypt: () => 'tok' },
        sourceService: {
          saveSelectedSources: async () => ({
            items: [{ id: 'gsrc-1' }],
            importTargets: [{ id: 'gsrc-1', googleCalendarId: 'primary', atlasCalendarId: 'cal-1' }],
          }),
        },
        initialImportService: {
          importSource: async (input) => {
            importCalls.push(input)
          },
        },
      },
    })

    await app.request('http://localhost/calendar/google/sources', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ calendars: [{ id: 'primary', summary: 'Principal' }] }),
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(importCalls.length, 1)
    assert.equal(importCalls[0].source.id, 'gsrc-1')
    assert.equal(importCalls[0].accessToken, 'tok')
  })

  it('disconnects Google and disables persisted sources', async () => {
    const { app, sourceCalls, disconnectCalls, permissionCalls } = createTestApp({
      connection: {
        id: 'gconn-1',
        userId: 'user-1',
        status: 'ACTIVE',
      },
    })

    const response = await app.request('http://localhost/calendar/google/disconnect', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(permissionCalls, ['calendar.calendars.read'])
    assert.deepEqual(sourceCalls, [
      { type: 'disable', connectionId: 'gconn-1' },
    ])
    assert.deepEqual(disconnectCalls, ['user-1'])
    assert.deepEqual(payload, { ok: true })
  })

  it('disconnect returns ok when there is no active Google connection', async () => {
    const { app, sourceCalls, disconnectCalls } = createTestApp({
      connection: null,
    })

    const response = await app.request('http://localhost/calendar/google/disconnect', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(sourceCalls, [])
    assert.deepEqual(disconnectCalls, [])
    assert.deepEqual(payload, { ok: true })
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleOAuthService } from '../google/google-oauth-service.js'
import { createGoogleCalendarDiscoveryService } from '../google/google-calendar-discovery-service.js'

function createJsonResponse({ ok = true, status = 200, payload, error } = {}) {
  return {
    ok,
    status,
    json: async () => {
      if (error) {
        throw error
      }

      return payload
    },
  }
}

describe('google-oauth-service', () => {
  it('builds an auth URL with offline access and consent', () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
      },
      fetchImpl: async () => {
        throw new Error('not used')
      },
    })

    const url = new URL(svc.buildAuthorizationUrl({ state: 'state-123' }))

    assert.equal(url.origin, 'https://accounts.google.com')
    assert.equal(url.pathname, '/o/oauth2/v2/auth')
    assert.equal(url.searchParams.get('client_id'), 'client-id')
    assert.equal(url.searchParams.get('redirect_uri'), 'https://atlas.example.com/api/calendar/google/connect/callback')
    assert.equal(url.searchParams.get('response_type'), 'code')
    assert.equal(url.searchParams.get('access_type'), 'offline')
    assert.equal(url.searchParams.get('include_granted_scopes'), 'true')
    assert.equal(url.searchParams.get('prompt'), 'consent')
    assert.equal(url.searchParams.get('state'), 'state-123')
    assert.equal(
      url.searchParams.get('scope'),
      'openid email https://www.googleapis.com/auth/calendar.readonly'
    )
  })

  it('creates and verifies a signed authorization state for the same user', () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        encryptionKey: Buffer.alloc(32, 7).toString('base64'),
        scopes: ['openid', 'email'],
      },
      fetchImpl: async () => {
        throw new Error('not used')
      },
    })

    const state = svc.createAuthorizationState({
      userId: 'user-1',
      now: new Date('2026-06-08T12:00:00.000Z'),
    })

    const result = svc.verifyAuthorizationState({
      state,
      userId: 'user-1',
      now: new Date('2026-06-08T12:05:00.000Z'),
    })

    assert.equal(result.userId, 'user-1')
  })

  it('rejects a signed authorization state for a different user', () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        encryptionKey: Buffer.alloc(32, 7).toString('base64'),
        scopes: ['openid', 'email'],
      },
      fetchImpl: async () => {
        throw new Error('not used')
      },
    })

    const state = svc.createAuthorizationState({
      userId: 'user-1',
      now: new Date('2026-06-08T12:00:00.000Z'),
    })

    assert.throws(
      () =>
        svc.verifyAuthorizationState({
          state,
          userId: 'user-2',
          now: new Date('2026-06-08T12:05:00.000Z'),
        }),
      /invalid oauth state/i
    )
  })

  it('exchanges code for tokens and account identity', async () => {
    const fetchCalls = []
    const fetchImpl = async (url, options = {}) => {
      fetchCalls.push({ url, options })

      if (String(url).includes('/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            expires_in: 3600,
            scope: 'openid email https://www.googleapis.com/auth/calendar.readonly',
          }),
        }
      }

      return {
        ok: true,
        status: 200,
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

    const startedAt = Date.now()
    const result = await svc.exchangeCodeForTokens({ code: 'code-123' })
    const endedAt = Date.now()

    assert.equal(fetchCalls.length, 2)
    assert.equal(fetchCalls[0].url, 'https://oauth2.googleapis.com/token')
    assert.equal(fetchCalls[0].options.method, 'POST')
    assert.equal(
      fetchCalls[0].options.headers['Content-Type'],
      'application/x-www-form-urlencoded'
    )
    assert.equal(fetchCalls[0].options.body.get('code'), 'code-123')
    assert.equal(fetchCalls[0].options.body.get('client_id'), 'client-id')
    assert.equal(fetchCalls[0].options.body.get('client_secret'), 'client-secret')
    assert.equal(
      fetchCalls[0].options.body.get('redirect_uri'),
      'https://atlas.example.com/api/calendar/google/connect/callback'
    )
    assert.equal(fetchCalls[0].options.body.get('grant_type'), 'authorization_code')
    assert.equal(fetchCalls[1].url, 'https://openidconnect.googleapis.com/v1/userinfo')
    assert.equal(fetchCalls[1].options.headers.Authorization, 'Bearer access-1')

    assert.equal(result.accessToken, 'access-1')
    assert.equal(result.refreshToken, 'refresh-1')
    assert.deepEqual(result.scopes, [
      'openid',
      'email',
      'https://www.googleapis.com/auth/calendar.readonly',
    ])
    assert.equal(result.googleSubject, 'sub-123')
    assert.equal(result.googleEmail, 'raul@example.com')
    assert.equal(result.tokenExpiresAt instanceof Date, true)
    assert.equal(result.tokenExpiresAt.getTime() >= startedAt + 3_590_000, true)
    assert.equal(result.tokenExpiresAt.getTime() <= endedAt + 3_610_000, true)
  })

  it('rejects a non-ok token response', async () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email'],
      },
      fetchImpl: async () => createJsonResponse({
        ok: false,
        status: 400,
        payload: { error: 'invalid_grant' },
      }),
    })

    await assert.rejects(
      () => svc.exchangeCodeForTokens({ code: 'bad-code' }),
      /token exchange failed/i
    )
  })

  it('rejects invalid json from the token endpoint', async () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email'],
      },
      fetchImpl: async () => createJsonResponse({
        ok: true,
        status: 200,
        error: new Error('invalid json'),
      }),
    })

    await assert.rejects(
      () => svc.exchangeCodeForTokens({ code: 'bad-json' }),
      /token exchange failed/i
    )
  })

  it('rejects a missing refresh token during the connect flow', async () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email'],
      },
      fetchImpl: async (url) => {
        if (String(url).includes('/token')) {
          return createJsonResponse({
            payload: {
              access_token: 'access-1',
              expires_in: 3600,
              scope: 'openid email',
            },
          })
        }

        return createJsonResponse({
          payload: {
            sub: 'sub-123',
            email: 'raul@example.com',
          },
        })
      },
    })

    await assert.rejects(
      () => svc.exchangeCodeForTokens({ code: 'missing-refresh' }),
      /missing refresh token/i
    )
  })

  it('rejects an invalid expires_in from the token payload', async () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email'],
      },
      fetchImpl: async (url) => {
        if (String(url).includes('/token')) {
          return createJsonResponse({
            payload: {
              access_token: 'access-1',
              refresh_token: 'refresh-1',
              expires_in: 'tomorrow',
              scope: 'openid email',
            },
          })
        }

        return createJsonResponse({
          payload: {
            sub: 'sub-123',
            email: 'raul@example.com',
          },
        })
      },
    })

    await assert.rejects(
      () => svc.exchangeCodeForTokens({ code: 'bad-expiry' }),
      /invalid expires_in/i
    )
  })

  it('rejects a non-ok userinfo response', async () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email'],
      },
      fetchImpl: async (url) => {
        if (String(url).includes('/token')) {
          return createJsonResponse({
            payload: {
              access_token: 'access-1',
              refresh_token: 'refresh-1',
              expires_in: 3600,
              scope: 'openid email',
            },
          })
        }

        return createJsonResponse({
          ok: false,
          status: 401,
          payload: {
            error: 'invalid_token',
          },
        })
      },
    })

    await assert.rejects(
      () => svc.exchangeCodeForTokens({ code: 'userinfo-non-ok' }),
      /identity lookup failed/i
    )
  })

  it('rejects userinfo without a stable openid identity', async () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email'],
      },
      fetchImpl: async (url) => {
        if (String(url).includes('/token')) {
          return createJsonResponse({
            payload: {
              access_token: 'access-1',
              refresh_token: 'refresh-1',
              expires_in: 3600,
              scope: 'openid email',
            },
          })
        }

        return createJsonResponse({
          payload: {
            email: 'raul@example.com',
          },
        })
      },
    })

    await assert.rejects(
      () => svc.exchangeCodeForTokens({ code: 'missing-sub' }),
      /missing openid\/email identity/i
    )
  })

  it('rejects userinfo without an email', async () => {
    const svc = createGoogleOAuthService({
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/api/calendar/google/connect/callback',
        scopes: ['openid', 'email'],
      },
      fetchImpl: async (url) => {
        if (String(url).includes('/token')) {
          return createJsonResponse({
            payload: {
              access_token: 'access-1',
              refresh_token: 'refresh-1',
              expires_in: 3600,
              scope: 'openid email',
            },
          })
        }

        return createJsonResponse({
          payload: {
            sub: 'sub-123',
          },
        })
      },
    })

    await assert.rejects(
      () => svc.exchangeCodeForTokens({ code: 'missing-email' }),
      /missing openid\/email identity/i
    )
  })
})

describe('google-calendar-discovery-service', () => {
  it('can be created without passing options', async () => {
    const originalFetch = globalThis.fetch
    const fetchCalls = []

    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options })
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
        }),
      }
    }

    try {
      const discoverySvc = createGoogleCalendarDiscoveryService()
      const result = await discoverySvc.listCalendars({ accessToken: 'access-1' })

      assert.deepEqual(result, [])
      assert.equal(fetchCalls.length, 1)
      assert.equal(fetchCalls[0].url, 'https://www.googleapis.com/calendar/v3/users/me/calendarList')
      assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer access-1')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('lists normalized Google calendars for the connected account', async () => {
    const fetchCalls = []
    const discoverySvc = createGoogleCalendarDiscoveryService({
      fetchImpl: async (url, options = {}) => {
        fetchCalls.push({ url, options })
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'primary',
                summary: 'Principal',
                primary: true,
                timeZone: 'America/Mexico_City',
                backgroundColor: '#1a73e8',
              },
              {
                id: 'team@example.com',
                summary: 'Equipo',
              },
            ],
          }),
        }
      },
    })

    const result = await discoverySvc.listCalendars({ accessToken: 'access-1' })

    assert.equal(fetchCalls.length, 1)
    assert.equal(fetchCalls[0].url, 'https://www.googleapis.com/calendar/v3/users/me/calendarList')
    assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer access-1')
    assert.deepEqual(result, [
      {
        id: 'primary',
        summary: 'Principal',
        primary: true,
        timeZone: 'America/Mexico_City',
        backgroundColor: '#1a73e8',
      },
      {
        id: 'team@example.com',
        summary: 'Equipo',
        primary: false,
        timeZone: null,
        backgroundColor: null,
      },
    ])
  })

  it('rejects a non-ok discovery response', async () => {
    const discoverySvc = createGoogleCalendarDiscoveryService({
      fetchImpl: async () => createJsonResponse({
        ok: false,
        status: 403,
        payload: {
          error: {
            message: 'insufficient permissions',
          },
        },
      }),
    })

    await assert.rejects(
      () => discoverySvc.listCalendars({ accessToken: 'access-1' }),
      /calendar discovery failed/i
    )
  })
})

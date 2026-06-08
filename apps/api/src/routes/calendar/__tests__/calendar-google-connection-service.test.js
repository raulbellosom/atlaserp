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
    assert.equal(connection.status, 'ACTIVE')
    assert.equal(connection.refreshTokenEncrypted, 'enc:refresh-1')
  })

  it('preserves the existing refresh token when a later save omits it', async () => {
    const svc = createGoogleCalendarConnectionService({
      prisma: makePrisma({
        googleCalendarConnection: {
          findUnique: async () => ({
            id: 'gconn-1',
            userId: 'user-1',
            refreshTokenEncrypted: 'enc:refresh-existing',
          }),
        },
      }),
      tokenCrypto: {
        encrypt: (value) => `enc:${value}`,
        decrypt: (value) => value.replace(/^enc:/, ''),
      },
    })

    const connection = await svc.saveConnection({
      userId: 'user-1',
      googleSubject: 'sub-123',
      googleEmail: 'raul@example.com',
      accessToken: 'access-2',
      tokenExpiresAt: new Date('2026-06-07T11:00:00.000Z'),
      scopes: ['openid', 'email'],
    })

    assert.equal(connection.accessTokenEncrypted, 'enc:access-2')
    assert.equal(connection.refreshTokenEncrypted, 'enc:refresh-existing')
    assert.equal(connection.status, 'ACTIVE')
  })

  it('requires a refresh token when saving a first connection', async () => {
    const svc = createGoogleCalendarConnectionService({
      prisma: makePrisma(),
      tokenCrypto: { encrypt: (value) => value, decrypt: (value) => value },
    })

    await assert.rejects(
      () => svc.saveConnection({
        userId: 'user-1',
        googleSubject: 'sub-123',
        googleEmail: 'raul@example.com',
        accessToken: 'access-1',
        tokenExpiresAt: new Date('2026-06-07T10:00:00.000Z'),
        scopes: ['openid', 'email'],
      }),
      /refresh token/i
    )
  })

  it('clears stored credentials and marks a connection as revoked on disconnect', async () => {
    let payload = null
    const prisma = makePrisma({
      googleCalendarConnection: {
        update: async ({ data }) => {
          payload = data
          return { id: 'gconn-1', ...data }
        },
      },
    })
    const svc = createGoogleCalendarConnectionService({
      prisma,
      tokenCrypto: { encrypt: (value) => value, decrypt: (value) => value },
    })

    await svc.disconnect('user-1')

    assert.equal(payload.status, 'REVOKED')
    assert.equal(payload.accessTokenEncrypted, null)
    assert.equal(payload.refreshTokenEncrypted, null)
    assert.equal(payload.revokedAt instanceof Date, true)
  })
})

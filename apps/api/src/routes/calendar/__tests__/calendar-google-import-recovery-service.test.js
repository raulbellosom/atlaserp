import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarImportRecoveryService } from '../google/google-calendar-import-recovery-service.js'

function makeStaleSource(overrides = {}) {
  return {
    id: 'gsrc-1',
    connectionId: 'gconn-1',
    googleCalendarId: 'primary',
    atlasCalendarId: 'cal-1',
    syncStatus: 'SYNCING',
    enabled: true,
    updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('google-calendar-import-recovery-service', () => {
  it('does nothing when there are no stale sources', async () => {
    const svc = createGoogleCalendarImportRecoveryService({
      prisma: {
        googleCalendarSource: { findMany: async () => [] },
        googleCalendarConnection: { findUnique: async () => null },
      },
      connectionService: {},
      oauthService: {},
      tokenCrypto: {},
      initialImportService: {
        importSource: async () => { throw new Error('should not be called') },
        markSourceError: async () => { throw new Error('should not be called') },
      },
    })

    const result = await svc.recoverStaleImports()
    assert.deepEqual(result, { recovered: 0, failed: 0 })
  })

  it('re-runs the import for a stale source with an active, usable connection', async () => {
    const importCalls = []
    const svc = createGoogleCalendarImportRecoveryService({
      prisma: {
        googleCalendarSource: {
          findMany: async () => [makeStaleSource()],
        },
        googleCalendarConnection: {
          findUnique: async () => ({
            id: 'gconn-1',
            userId: 'user-1',
            status: 'ACTIVE',
            accessTokenEncrypted: 'enc:access-1',
            tokenExpiresAt: '2099-01-01T00:00:00.000Z',
          }),
        },
      },
      connectionService: {},
      oauthService: {},
      tokenCrypto: { decrypt: (value) => value.replace(/^enc:/, '') },
      initialImportService: {
        importSource: async (input) => {
          importCalls.push(input)
        },
        markSourceError: async () => { throw new Error('should not be called') },
      },
    })

    const result = await svc.recoverStaleImports()

    assert.equal(importCalls.length, 1)
    assert.equal(importCalls[0].source.id, 'gsrc-1')
    assert.equal(importCalls[0].accessToken, 'access-1')
    assert.deepEqual(result, { recovered: 1, failed: 0 })
  })

  it('refreshes the token when the stored access token expired', async () => {
    const refreshCalls = []
    const updateCalls = []
    const importCalls = []
    const svc = createGoogleCalendarImportRecoveryService({
      prisma: {
        googleCalendarSource: {
          findMany: async () => [makeStaleSource()],
        },
        googleCalendarConnection: {
          findUnique: async () => ({
            id: 'gconn-1',
            userId: 'user-1',
            status: 'ACTIVE',
            accessTokenEncrypted: 'enc:access-1',
            refreshTokenEncrypted: 'enc:refresh-1',
            tokenExpiresAt: '2000-01-01T00:00:00.000Z',
          }),
        },
      },
      connectionService: {
        updateAccessToken: async (userId, data) => {
          updateCalls.push({ userId, data })
          return {}
        },
      },
      oauthService: {
        refreshAccessToken: async (input) => {
          refreshCalls.push(input)
          return { accessToken: 'access-2', tokenExpiresAt: new Date('2099-01-01T00:00:00.000Z') }
        },
      },
      tokenCrypto: { decrypt: (value) => value.replace(/^enc:/, '') },
      initialImportService: {
        importSource: async (input) => {
          importCalls.push(input)
        },
        markSourceError: async () => { throw new Error('should not be called') },
      },
    })

    const result = await svc.recoverStaleImports()

    assert.equal(refreshCalls.length, 1)
    assert.equal(refreshCalls[0].refreshToken, 'refresh-1')
    assert.equal(updateCalls.length, 1)
    assert.equal(importCalls[0].accessToken, 'access-2')
    assert.deepEqual(result, { recovered: 1, failed: 0 })
  })

  it('marks stale sources as ERROR when the connection is gone or unusable', async () => {
    const errorCalls = []
    const svc = createGoogleCalendarImportRecoveryService({
      prisma: {
        googleCalendarSource: {
          findMany: async () => [makeStaleSource({ id: 'gsrc-2' })],
        },
        googleCalendarConnection: {
          findUnique: async () => null,
        },
      },
      connectionService: {},
      oauthService: {},
      tokenCrypto: {},
      initialImportService: {
        importSource: async () => { throw new Error('should not be called') },
        markSourceError: async (sourceId, error) => {
          errorCalls.push({ sourceId, message: error?.message })
        },
      },
    })

    const result = await svc.recoverStaleImports()

    assert.equal(errorCalls.length, 1)
    assert.equal(errorCalls[0].sourceId, 'gsrc-2')
    assert.deepEqual(result, { recovered: 0, failed: 1 })
  })

  it('marks stale sources as ERROR when the refresh token was revoked', async () => {
    const errorCalls = []
    const disconnectCalls = []
    const svc = createGoogleCalendarImportRecoveryService({
      prisma: {
        googleCalendarSource: {
          findMany: async () => [makeStaleSource()],
        },
        googleCalendarConnection: {
          findUnique: async () => ({
            id: 'gconn-1',
            userId: 'user-1',
            status: 'ACTIVE',
            accessTokenEncrypted: 'enc:access-1',
            refreshTokenEncrypted: 'enc:refresh-1',
            tokenExpiresAt: '2000-01-01T00:00:00.000Z',
          }),
        },
      },
      connectionService: {
        disconnect: async (userId) => {
          disconnectCalls.push(userId)
        },
      },
      oauthService: {
        refreshAccessToken: async () => {
          throw new Error('invalid_grant')
        },
      },
      tokenCrypto: { decrypt: (value) => value.replace(/^enc:/, '') },
      initialImportService: {
        importSource: async () => { throw new Error('should not be called') },
        markSourceError: async (sourceId, error) => {
          errorCalls.push({ sourceId, message: error?.message })
        },
      },
    })

    const result = await svc.recoverStaleImports()

    assert.deepEqual(disconnectCalls, ['user-1'])
    assert.equal(errorCalls.length, 1)
    assert.deepEqual(result, { recovered: 0, failed: 1 })
  })
})

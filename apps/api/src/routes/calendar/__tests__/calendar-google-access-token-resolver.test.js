import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleAccessTokenResolver, hasUsableAccessToken } from '../google/google-access-token-resolver.js'

function makeTokenCrypto() {
  return {
    encrypt: (value) => `enc:${value}`,
    decrypt: (value) => String(value).replace(/^enc:/, ''),
  }
}

describe('hasUsableAccessToken', () => {
  it('is false without an access token', () => {
    assert.equal(hasUsableAccessToken(null), false)
    assert.equal(hasUsableAccessToken({}), false)
  })

  it('is false when the token already expired', () => {
    assert.equal(
      hasUsableAccessToken({
        accessTokenEncrypted: 'enc-token',
        tokenExpiresAt: '2000-01-01T00:00:00.000Z',
      }),
      false,
    )
  })

  it('is true when the token is still valid', () => {
    assert.equal(
      hasUsableAccessToken({
        accessTokenEncrypted: 'enc-token',
        tokenExpiresAt: '2099-01-01T00:00:00.000Z',
      }),
      true,
    )
  })
})

describe('google-access-token-resolver', () => {
  it('decrypts the current token without refreshing when still valid', async () => {
    const oauthCalls = []
    const resolver = createGoogleAccessTokenResolver({
      tokenCrypto: makeTokenCrypto(),
      oauthService: {
        refreshAccessToken: async (input) => {
          oauthCalls.push(input)
          throw new Error('should not be called')
        },
      },
      connectionService: {
        updateAccessToken: async () => {
          throw new Error('should not be called')
        },
        disconnect: async () => {
          throw new Error('should not be called')
        },
      },
    })

    const connection = {
      accessTokenEncrypted: 'enc:access-1',
      tokenExpiresAt: '2099-01-01T00:00:00.000Z',
    }

    const result = await resolver.resolveAccessToken('user-1', connection)

    assert.equal(result.accessToken, 'access-1')
    assert.equal(oauthCalls.length, 0)
  })

  it('refreshes and persists a new access token when expired', async () => {
    const refreshCalls = []
    const updateCalls = []
    const resolver = createGoogleAccessTokenResolver({
      tokenCrypto: makeTokenCrypto(),
      oauthService: {
        refreshAccessToken: async (input) => {
          refreshCalls.push(input)
          return {
            accessToken: 'access-2',
            tokenExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
          }
        },
      },
      connectionService: {
        updateAccessToken: async (userId, data) => {
          updateCalls.push({ userId, data })
          return {
            accessTokenEncrypted: `enc:${data.accessToken}`,
            tokenExpiresAt: data.tokenExpiresAt,
          }
        },
      },
    })

    const connection = {
      accessTokenEncrypted: 'enc:access-1',
      refreshTokenEncrypted: 'enc:refresh-1',
      tokenExpiresAt: '2000-01-01T00:00:00.000Z',
    }

    const result = await resolver.resolveAccessToken('user-1', connection)

    assert.equal(refreshCalls.length, 1)
    assert.equal(refreshCalls[0].refreshToken, 'refresh-1')
    assert.equal(updateCalls.length, 1)
    assert.equal(updateCalls[0].userId, 'user-1')
    assert.equal(updateCalls[0].data.accessToken, 'access-2')
    assert.equal(result.accessToken, 'access-2')
  })

  it('throws a reconnect error and has no refresh token to try', async () => {
    const resolver = createGoogleAccessTokenResolver({
      tokenCrypto: makeTokenCrypto(),
      oauthService: {
        refreshAccessToken: async () => {
          throw new Error('should not be called')
        },
      },
      connectionService: {
        disconnect: async () => {
          throw new Error('should not be called')
        },
      },
    })

    const connection = {
      accessTokenEncrypted: 'enc:access-1',
      tokenExpiresAt: '2000-01-01T00:00:00.000Z',
    }

    await assert.rejects(
      () => resolver.resolveAccessToken('user-1', connection),
      /reconecta la cuenta/i,
    )
  })

  it('disconnects the connection and throws a reconnect error when the refresh call fails', async () => {
    const disconnectCalls = []
    const resolver = createGoogleAccessTokenResolver({
      tokenCrypto: makeTokenCrypto(),
      oauthService: {
        refreshAccessToken: async () => {
          throw new Error('invalid_grant')
        },
      },
      connectionService: {
        disconnect: async (userId) => {
          disconnectCalls.push(userId)
        },
      },
    })

    const connection = {
      accessTokenEncrypted: 'enc:access-1',
      refreshTokenEncrypted: 'enc:refresh-1',
      tokenExpiresAt: '2000-01-01T00:00:00.000Z',
    }

    await assert.rejects(
      () => resolver.resolveAccessToken('user-1', connection),
      /reconecta la cuenta/i,
    )
    assert.deepEqual(disconnectCalls, ['user-1'])
  })

  it('rejects when the connection has no access token at all', async () => {
    const resolver = createGoogleAccessTokenResolver({
      tokenCrypto: makeTokenCrypto(),
      oauthService: {},
      connectionService: {},
    })

    await assert.rejects(
      () => resolver.resolveAccessToken('user-1', {}),
      /no hay una cuenta google conectada/i,
    )
  })
})

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

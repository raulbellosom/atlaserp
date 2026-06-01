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

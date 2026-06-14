import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createAuthNamespace } from '../auth.js'
import { createSupabaseSessionAdapter } from '../core/session.js'

function makeSupabase({ signInData = null, signInError = null, signOutError = null } = {}) {
  let _session = null
  const _listeners = []

  return {
    auth: {
      signInWithPassword: async () => {
        if (signInError) return { data: {}, error: signInError }
        _session = signInData?.session ?? null
        for (const cb of _listeners) cb('SIGNED_IN', _session)
        return { data: signInData ?? {}, error: null }
      },
      signOut: async () => {
        _session = null
        for (const cb of _listeners) cb('SIGNED_OUT', null)
        return { error: signOutError ?? null }
      },
      onAuthStateChange: (cb) => {
        _listeners.push(cb)
        if (_session) cb('INITIAL_SESSION', _session)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      refreshSession: async ({ refresh_token }) => {
        if (refresh_token === 'valid-ref') {
          const sess = { access_token: 'new-tok', refresh_token: 'new-ref', expires_at: 9999 }
          _session = sess
          for (const cb of _listeners) cb('TOKEN_REFRESHED', sess)
          return { data: { session: sess }, error: null }
        }
        return { data: {}, error: new Error('refresh failed') }
      },
    }
  }
}

function makeRequest(responses = []) {
  let i = 0
  const calls = []
  const fn = async (method, path, body) => {
    calls.push({ method, path, body })
    return responses[i++]
  }
  fn.calls = calls
  return fn
}

describe('sdk.auth.login', () => {
  it('calls Supabase signInWithPassword and fetches /me for profile', async () => {
    const supabase = makeSupabase({
      signInData: { session: { access_token: 'tok', refresh_token: 'ref', expires_at: 9999 } }
    })
    const session = createSupabaseSessionAdapter({ supabase })
    const req = makeRequest([
      { data: { id: '1', email: 'a@b.com', role: 'storefront_client', displayName: 'Ana' } }
    ])
    const auth = createAuthNamespace({ supabase, request: req, session })

    const result = await auth.login({ email: 'a@b.com', password: 'pass' })

    assert.equal(result.token, 'tok')
    assert.equal(result.user?.role, 'storefront_client')
    assert.equal(req.calls[0].path, '/public/storefront/auth/me')
    assert.equal(req.calls[0].method, 'GET')
  })

  it('throws UNAUTHORIZED when Supabase rejects credentials', async () => {
    const supabase = makeSupabase({ signInError: new Error('Invalid login') })
    const session = createSupabaseSessionAdapter({ supabase })
    const req = makeRequest([])
    const auth = createAuthNamespace({ supabase, request: req, session })

    await assert.rejects(
      () => auth.login({ email: 'bad@b.com', password: 'wrong' }),
      (err) => err.code === 'UNAUTHORIZED'
    )
    assert.equal(req.calls.length, 0)
  })

  it('returns session with null user when /me returns nothing', async () => {
    const supabase = makeSupabase({
      signInData: { session: { access_token: 'tok', refresh_token: 'ref', expires_at: 9999 } }
    })
    const session = createSupabaseSessionAdapter({ supabase })
    const req = makeRequest([null])
    const auth = createAuthNamespace({ supabase, request: req, session })

    const result = await auth.login({ email: 'a@b.com', password: 'pass' })
    assert.equal(result.token, 'tok')
    assert.equal(result.user, null)
  })
})

describe('sdk.auth.logout', () => {
  it('calls supabase.auth.signOut and session clears via SIGNED_OUT event', async () => {
    const supabase = makeSupabase({
      signInData: { session: { access_token: 'tok', refresh_token: 'ref', expires_at: 9999 } }
    })
    const session = createSupabaseSessionAdapter({ supabase })
    const req = makeRequest([
      { data: { id: '1', role: 'storefront_client' } }
    ])
    const auth = createAuthNamespace({ supabase, request: req, session })
    await auth.login({ email: 'a@b.com', password: 'pass' })
    assert.ok(session.get() !== null)

    await auth.logout()
    assert.equal(session.get(), null)
  })
})

describe('sdk.auth.refresh', () => {
  it('refreshes token via Supabase and returns new tokens', async () => {
    const supabase = makeSupabase({
      signInData: { session: { access_token: 'tok', refresh_token: 'valid-ref', expires_at: 1 } }
    })
    const session = createSupabaseSessionAdapter({ supabase })
    const req = makeRequest([{ data: { id: '1', role: 'storefront_client' } }])
    const auth = createAuthNamespace({ supabase, request: req, session })
    await auth.login({ email: 'a@b.com', password: 'pass' })

    const result = await auth.refresh()
    assert.equal(result.token, 'new-tok')
    assert.equal(result.refreshToken, 'new-ref')
  })

  it('throws and clears session when refresh token is invalid', async () => {
    const supabase = makeSupabase({
      signInData: { session: { access_token: 'tok', refresh_token: 'bad-ref', expires_at: 1 } }
    })
    const session = createSupabaseSessionAdapter({ supabase })
    const req = makeRequest([{ data: { id: '1', role: 'storefront_client' } }])
    const auth = createAuthNamespace({ supabase, request: req, session })
    await auth.login({ email: 'a@b.com', password: 'pass' })

    await assert.rejects(() => auth.refresh(), (err) => err.code === 'UNAUTHORIZED')
    assert.equal(session.get(), null)
  })
})

describe('sdk.auth.getSession', () => {
  it('returns null when not logged in', () => {
    const supabase = makeSupabase()
    const session = createSupabaseSessionAdapter({ supabase })
    const auth = createAuthNamespace({ supabase, request: async () => {}, session })
    assert.equal(auth.getSession(), null)
  })
})

describe('sdk.auth.register', () => {
  it('calls POST /public/storefront/auth/register', async () => {
    const supabase = makeSupabase()
    const session = createSupabaseSessionAdapter({ supabase })
    const req = makeRequest([{ data: { id: '2', email: 'new@b.com', role: 'storefront_client' } }])
    const auth = createAuthNamespace({ supabase, request: req, session })

    const result = await auth.register({ email: 'new@b.com', password: 'pass', name: 'Test' })
    assert.equal(result.role, 'storefront_client')
    assert.equal(req.calls[0].method, 'POST')
    assert.equal(req.calls[0].path, '/public/storefront/auth/register')
  })
})

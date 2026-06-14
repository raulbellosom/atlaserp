import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createSupabaseSessionAdapter } from '../core/session.js'

function makeSupabase({ initialSession = null } = {}) {
  let _session = initialSession
  const _listeners = []

  return {
    auth: {
      onAuthStateChange: (cb) => {
        _listeners.push(cb)
        // Fire INITIAL_SESSION synchronously (mirrors @supabase/supabase-js v2 behavior)
        if (_session) cb('INITIAL_SESSION', _session)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      // Helper for tests to simulate session changes
      _fireChange(event, session) {
        _session = session
        for (const cb of _listeners) cb(event, session)
      },
    }
  }
}

describe('createSupabaseSessionAdapter', () => {
  it('starts null when Supabase has no session', () => {
    const supabase = makeSupabase()
    const adapter = createSupabaseSessionAdapter({ supabase })
    assert.equal(adapter.get(), null)
  })

  it('maps INITIAL_SESSION to SDK session format', () => {
    const supabase = makeSupabase({
      initialSession: { access_token: 'tok', refresh_token: 'ref', expires_at: 9999 }
    })
    const adapter = createSupabaseSessionAdapter({ supabase })
    const s = adapter.get()
    assert.equal(s.token, 'tok')
    assert.equal(s.refreshToken, 'ref')
    assert.equal(s.expiresAt, 9999)
    assert.equal(s.user, null)
  })

  it('updates cache on SIGNED_IN event', () => {
    const supabase = makeSupabase()
    const adapter = createSupabaseSessionAdapter({ supabase })
    supabase.auth._fireChange('SIGNED_IN', { access_token: 'new', refresh_token: 'r', expires_at: 1 })
    assert.equal(adapter.get()?.token, 'new')
  })

  it('clears cache on SIGNED_OUT event', () => {
    const supabase = makeSupabase({
      initialSession: { access_token: 'tok', refresh_token: 'ref', expires_at: 1 }
    })
    const adapter = createSupabaseSessionAdapter({ supabase })
    supabase.auth._fireChange('SIGNED_OUT', null)
    assert.equal(adapter.get(), null)
  })

  it('setUser enriches the cached session with user profile', () => {
    const supabase = makeSupabase({
      initialSession: { access_token: 'tok', refresh_token: 'ref', expires_at: 1 }
    })
    const adapter = createSupabaseSessionAdapter({ supabase })
    adapter.setUser({ id: '1', role: 'storefront_client' })
    assert.equal(adapter.get()?.user?.role, 'storefront_client')
  })

  it('setUser is a no-op when there is no session', () => {
    const supabase = makeSupabase()
    const adapter = createSupabaseSessionAdapter({ supabase })
    assert.doesNotThrow(() => adapter.setUser({ id: '1' }))
    assert.equal(adapter.get(), null)
  })

  it('fires onSessionChange when session changes', () => {
    const received = []
    const supabase = makeSupabase()
    createSupabaseSessionAdapter({ supabase, onSessionChange: (s) => received.push(s) })
    supabase.auth._fireChange('SIGNED_IN', { access_token: 'x', refresh_token: 'r', expires_at: 1 })
    assert.equal(received.length, 1)
    assert.equal(received[0]?.token, 'x')
  })

  it('subscribe and unsubscribe work correctly', () => {
    const calls = []
    const supabase = makeSupabase()
    const adapter = createSupabaseSessionAdapter({ supabase })
    const unsub = adapter.subscribe((s) => calls.push(s))
    supabase.auth._fireChange('SIGNED_IN', { access_token: 'a', refresh_token: 'r', expires_at: 1 })
    unsub()
    supabase.auth._fireChange('SIGNED_IN', { access_token: 'b', refresh_token: 'r', expires_at: 1 })
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.token, 'a')
  })

  it('clear() sets session to null and notifies', () => {
    const supabase = makeSupabase({
      initialSession: { access_token: 'tok', refresh_token: 'ref', expires_at: 1 }
    })
    const received = []
    const adapter = createSupabaseSessionAdapter({ supabase, onSessionChange: (s) => received.push(s) })
    adapter.clear()
    assert.equal(adapter.get(), null)
    assert.equal(received[received.length - 1], null)
  })
})

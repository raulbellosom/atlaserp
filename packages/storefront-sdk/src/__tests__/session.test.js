import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createSessionStore } from '../core/session.js'

describe('createSessionStore', () => {
  it('starts with null session', () => {
    const store = createSessionStore()
    assert.equal(store.get(), null)
  })

  it('stores and retrieves a session', () => {
    const store = createSessionStore()
    const session = { user: { id: '1' }, token: 'abc' }
    store.set(session)
    assert.deepEqual(store.get(), session)
  })

  it('fires onSessionChange callback when session changes', () => {
    let received = undefined
    const store = createSessionStore({ onSessionChange: (s) => { received = s } })
    const session = { user: { id: '1' }, token: 'abc' }
    store.set(session)
    assert.deepEqual(received, session)
  })

  it('fires onSessionChange with null on clear', () => {
    let received = 'not-called'
    const store = createSessionStore({ onSessionChange: (s) => { received = s } })
    store.set({ user: {}, token: 'x' })
    store.clear()
    assert.equal(received, null)
    assert.equal(store.get(), null)
  })

  it('initializes with initialSession if provided', () => {
    const initial = { user: { id: '2' }, token: 'xyz' }
    const store = createSessionStore({ initialSession: initial })
    assert.deepEqual(store.get(), initial)
  })

  it('subscribes and unsubscribes listeners', () => {
    const calls = []
    const store = createSessionStore()
    const unsub = store.subscribe((s) => calls.push(s))
    store.set({ token: 'a' })
    store.set({ token: 'b' })
    unsub()
    store.set({ token: 'c' })
    assert.equal(calls.length, 2)
    assert.equal(calls[0].token, 'a')
    assert.equal(calls[1].token, 'b')
  })
})

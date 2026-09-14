import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OFFLINE_MODULES } from '../offline-modules.js'

describe('OFFLINE_MODULES', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(OFFLINE_MODULES))
    assert.ok(OFFLINE_MODULES.length > 0)
  })

  it('contains the expected offline-capable module keys, including runly.ledger', () => {
    assert.ok(OFFLINE_MODULES.includes('runly.contacts'))
    assert.ok(OFFLINE_MODULES.includes('runly.hr'))
    assert.ok(OFFLINE_MODULES.includes('custom.fleet'))
    assert.ok(OFFLINE_MODULES.includes('runly.calendar'))
    assert.ok(OFFLINE_MODULES.includes('runly.catalog'))
    assert.ok(OFFLINE_MODULES.includes('runly.ledger'))
  })

  it('contains no duplicate keys', () => {
    assert.equal(OFFLINE_MODULES.length, new Set(OFFLINE_MODULES).size)
  })
})

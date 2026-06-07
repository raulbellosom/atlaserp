import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OFFLINE_MODULES } from '../offline-modules.js'

describe('OFFLINE_MODULES', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(OFFLINE_MODULES))
    assert.ok(OFFLINE_MODULES.length > 0)
  })

  it('contains the five expected offline-capable module keys', () => {
    assert.ok(OFFLINE_MODULES.includes('atlas.contacts'))
    assert.ok(OFFLINE_MODULES.includes('atlas.hr'))
    assert.ok(OFFLINE_MODULES.includes('custom.fleet'))
    assert.ok(OFFLINE_MODULES.includes('atlas.calendar'))
    assert.ok(OFFLINE_MODULES.includes('atlas.catalog'))
  })

  it('contains no duplicate keys', () => {
    assert.equal(OFFLINE_MODULES.length, new Set(OFFLINE_MODULES).size)
  })
})

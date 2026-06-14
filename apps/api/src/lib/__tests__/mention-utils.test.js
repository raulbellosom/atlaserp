import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMentionIds } from '../mention-utils.js'

describe('parseMentionIds', () => {
  it('extracts UUIDs from mention tokens', () => {
    const body = 'Hello @[01900000-0000-7000-8000-000000000001:Ana Lopez] how are you?'
    const ids = parseMentionIds(body)
    assert.deepEqual(ids, ['01900000-0000-7000-8000-000000000001'])
  })

  it('deduplicates repeated mentions of the same user', () => {
    const body = '@[01900000-0000-7000-8000-000000000001:Ana] and @[01900000-0000-7000-8000-000000000001:Ana] again'
    const ids = parseMentionIds(body)
    assert.deepEqual(ids, ['01900000-0000-7000-8000-000000000001'])
  })

  it('extracts multiple different users', () => {
    const body = '@[01900000-0000-7000-8000-000000000001:Ana] @[01900000-0000-7000-8000-000000000002:Bob]'
    const ids = parseMentionIds(body)
    assert.deepEqual(ids, ['01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000002'])
  })

  it('returns empty array for null or empty body', () => {
    assert.deepEqual(parseMentionIds(null), [])
    assert.deepEqual(parseMentionIds(''), [])
    assert.deepEqual(parseMentionIds('no mentions here'), [])
  })
})

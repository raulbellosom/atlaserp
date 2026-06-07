import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeServerUrl } from '../serverStore.js'

test('normalizeServerUrl trims the value and removes trailing slash', () => {
  assert.equal(
    normalizeServerUrl(' https://mi-empresa.com/// '),
    'https://mi-empresa.com',
  )
})

test('normalizeServerUrl rejects protocols other than http and https', () => {
  assert.equal(normalizeServerUrl('ftp://mi-empresa.com'), null)
})

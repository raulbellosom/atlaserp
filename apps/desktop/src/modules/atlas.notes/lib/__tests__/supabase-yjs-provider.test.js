import test from 'node:test'
import assert from 'node:assert/strict'
import { extractServerYState } from '../SupabaseYjsProvider.js'

// Regression: GET /notes/:id/ydoc returns { data: { state, version } }. The
// provider used to read `res.state`, always got undefined, and mounted the
// collaborative editor against an empty Y.Doc — the note reloaded blank while
// the sidebar preview (legacy notes.content column) still showed text.
test('extractServerYState: unwraps the Hono { data: { state } } envelope', () => {
  assert.equal(
    extractServerYState({ data: { state: 'AQID', version: 3 } }),
    'AQID',
  )
})

test('extractServerYState: accepts a bare { state } shape', () => {
  assert.equal(extractServerYState({ state: 'AQID' }), 'AQID')
})

test('extractServerYState: null when the note has no persisted state', () => {
  assert.equal(extractServerYState({ data: { state: null } }), null)
  assert.equal(extractServerYState({ state: null }), null)
  assert.equal(extractServerYState({ data: {} }), null)
})

test('extractServerYState: null for empty string / missing / non-object input', () => {
  assert.equal(extractServerYState({ data: { state: '' } }), null)
  assert.equal(extractServerYState({}), null)
  assert.equal(extractServerYState(null), null)
  assert.equal(extractServerYState(undefined), null)
})

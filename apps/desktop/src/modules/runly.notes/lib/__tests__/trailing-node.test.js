import test from 'node:test'
import assert from 'node:assert/strict'
import { needsTrailingNode } from '../extensions/TrailingNode.js'

test('needsTrailingNode: true when last node is not in notAfter', () => {
  assert.equal(needsTrailingNode('image', ['paragraph']), true)
})

test('needsTrailingNode: false when last node is a paragraph', () => {
  assert.equal(needsTrailingNode('paragraph', ['paragraph']), false)
})

test('needsTrailingNode: respects a multi-entry notAfter list', () => {
  assert.equal(needsTrailingNode('heading', ['paragraph', 'heading']), false)
  assert.equal(needsTrailingNode('codeBlock', ['paragraph', 'heading']), true)
})

test('needsTrailingNode: true when there is no last node', () => {
  assert.equal(needsTrailingNode(undefined, ['paragraph']), true)
  assert.equal(needsTrailingNode(null, ['paragraph']), true)
})

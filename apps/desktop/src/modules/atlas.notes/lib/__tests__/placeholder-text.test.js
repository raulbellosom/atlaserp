import test from 'node:test'
import assert from 'node:assert/strict'
import { bodyPlaceholderText } from '../placeholderText.js'

test('first node gets the title placeholder', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: true, nodeTypeName: 'paragraph', isEmpty: true, docChildCount: 1 }),
    'Sin título',
  )
})

test('heading gets the heading placeholder', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: false, nodeTypeName: 'heading', isEmpty: true, docChildCount: 5 }),
    'Título…',
  )
})

test('empty body paragraph in an otherwise-empty note gets the start hint', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: false, nodeTypeName: 'paragraph', isEmpty: true, docChildCount: 2 }),
    'Empieza a escribir, o pulsa «/» para comandos',
  )
})

test('empty body paragraph in a note with content gets no placeholder', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: false, nodeTypeName: 'paragraph', isEmpty: true, docChildCount: 6 }),
    '',
  )
})

test('non-empty paragraph gets no placeholder', () => {
  assert.equal(
    bodyPlaceholderText({ isFirst: false, nodeTypeName: 'paragraph', isEmpty: false, docChildCount: 2 }),
    '',
  )
})

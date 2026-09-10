import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffElements, versionMap, throttle } from '../canvasSync.js'

const E = (id, version) => ({ id, version, type: 'rectangle' })

test('versionMap: id -> version', () => {
  const m = versionMap([E('a', 1), E('b', 3)])
  assert.equal(m.get('a'), 1)
  assert.equal(m.get('b'), 3)
})

test('diffElements: first pass reports everything changed', () => {
  const { changed, nextMap } = diffElements(new Map(), [E('a', 1), E('b', 1)])
  assert.deepEqual(changed.map((e) => e.id), ['a', 'b'])
  assert.equal(nextMap.get('a'), 1)
})

test('diffElements: unchanged versions -> no changes', () => {
  const prev = versionMap([E('a', 2), E('b', 2)])
  const { changed } = diffElements(prev, [E('a', 2), E('b', 2)])
  assert.deepEqual(changed, [])
})

test('diffElements: only elements whose version increased are reported', () => {
  const prev = versionMap([E('a', 2), E('b', 2)])
  const { changed, nextMap } = diffElements(prev, [E('a', 2), E('b', 5), E('c', 1)])
  assert.deepEqual(changed.map((e) => e.id).sort(), ['b', 'c'])
  assert.equal(nextMap.get('b'), 5)
})

test('diffElements: a deleted element (isDeleted, higher version) is reported', () => {
  const prev = versionMap([E('a', 2)])
  const { changed } = diffElements(prev, [{ id: 'a', version: 3, isDeleted: true, type: 'rectangle' }])
  assert.deepEqual(changed.map((e) => e.id), ['a'])
})

test('diffElements: ignores elements without an id', () => {
  const { changed } = diffElements(new Map(), [{ version: 1, type: 'rectangle' }, null, E('ok', 1)])
  assert.deepEqual(changed.map((e) => e.id), ['ok'])
})

test('throttle: leading call fires immediately, burst collapses to one trailing call', async () => {
  let calls = 0
  let lastArg
  const fn = throttle((x) => { calls += 1; lastArg = x }, 30)
  fn(1) // leading
  fn(2)
  fn(3) // trailing wins
  assert.equal(calls, 1)
  assert.equal(lastArg, 1)
  await new Promise((r) => setTimeout(r, 60))
  assert.equal(calls, 2)
  assert.equal(lastArg, 3)
})

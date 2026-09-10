import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultLayer,
  ensureLayers,
  assignLayer,
  deriveScene,
  mergeVisibleBack,
  setLayerOpacity,
  setLayerLocked,
  moveElementsToLayer,
  bumpVersion,
  groupElementsByLayer,
  elementLabel,
  setElementHidden,
  setElementLocked,
  deleteElement,
  reorderLayer,
  mergeDown,
  duplicateLayer,
} from '../canvasLayers.js'

const L = (id, over = {}) => ({
  id, name: id, visible: true, locked: false, opacity: 1, order: 0, color: '#111', ...over,
})
const E = (id, layerId, over = {}) => ({
  id,
  type: 'rectangle',
  opacity: 100,
  isDeleted: false,
  customData: { layerId },
  ...over,
})

test('defaultLayer: sensible defaults, unique id', () => {
  const a = defaultLayer()
  const b = defaultLayer()
  assert.equal(a.visible, true)
  assert.equal(a.opacity, 1)
  assert.notEqual(a.id, b.id)
})

test('ensureLayers: empty -> one default layer', () => {
  const out = ensureLayers([])
  assert.equal(out.length, 1)
  assert.equal(out[0].name, 'Capa 1')
})

test('ensureLayers: keeps existing (when every layer already has a colour)', () => {
  const layers = [L('a', { order: 0 }), L('b', { order: 1 })]
  assert.equal(ensureLayers(layers), layers)
})

test('ensureLayers: backfills a colour on legacy layers without one', () => {
  const out = ensureLayers([{ id: 'a', name: 'A', visible: true, locked: false, opacity: 1, order: 0 }])
  assert.equal(typeof out[0].color, 'string')
})

test('defaultLayer: gets a palette colour by order', () => {
  assert.equal(typeof defaultLayer('X', 0).color, 'string')
  assert.notEqual(defaultLayer('X', 0).color, defaultLayer('X', 1).color)
})

test('assignLayer: element without layerId gets the active layer', () => {
  const el = { id: 'e1', type: 'rectangle' }
  const out = assignLayer(el, 'active-1')
  assert.equal(out.customData.layerId, 'active-1')
})

test('assignLayer: element with a layerId is untouched', () => {
  const el = E('e1', 'keep-me')
  const out = assignLayer(el, 'active-1')
  assert.equal(out.customData.layerId, 'keep-me')
})

test('deriveScene: hidden layer elements are omitted', () => {
  const layers = [L('vis', { order: 0 }), L('hid', { order: 1, visible: false })]
  const els = [E('a', 'vis'), E('b', 'hid')]
  const out = deriveScene(els, layers)
  assert.deepEqual(out.map((e) => e.id), ['a'])
})

test('deriveScene: returns the same element object references (no clone)', () => {
  const layers = [L('x', { order: 0, locked: true, opacity: 0.5 })]
  const el = E('a', 'x', { opacity: 80, locked: false })
  const out = deriveScene([el], layers)
  assert.equal(out[0], el) // identity preserved — no lock/opacity mutation at derive time
})

test('deriveScene: z-order = layer order then element order within layer', () => {
  const layers = [L('back', { order: 0 }), L('front', { order: 1 })]
  const els = [E('f1', 'front'), E('b1', 'back'), E('f2', 'front'), E('b2', 'back')]
  const out = deriveScene(els, layers)
  assert.deepEqual(out.map((e) => e.id), ['b1', 'b2', 'f1', 'f2'])
})

test('deriveScene: elements whose layer no longer exists fall back to the first layer', () => {
  const layers = [L('only', { order: 0 })]
  const out = deriveScene([E('a', 'ghost')], layers)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'a')
})

test('deriveScene: does not mutate the input elements', () => {
  const layers = [L('x', { order: 0, locked: true, opacity: 0.5 })]
  const el = E('a', 'x', { opacity: 80, locked: false })
  deriveScene([el], layers)
  assert.equal(el.locked, false)
  assert.equal(el.opacity, 80)
})

test('mergeVisibleBack: re-appends elements that live on hidden layers', () => {
  const layers = [L('vis', { order: 0 }), L('hid', { order: 1, visible: false })]
  const prevFull = [E('a', 'vis'), E('b', 'hid'), E('c', 'hid')]
  // Excalidraw only ever hands back the visible-layer elements
  const nextVisible = [E('a', 'vis', { x: 999 })]
  const merged = mergeVisibleBack(prevFull, nextVisible, layers)
  assert.deepEqual(merged.map((e) => e.id).sort(), ['a', 'b', 'c'])
  assert.equal(merged.find((e) => e.id === 'a').x, 999) // the edit is kept
})

test('mergeVisibleBack: no hidden layers -> returns nextVisible unchanged', () => {
  const layers = [L('a', { order: 0 })]
  const nextVisible = [E('x', 'a')]
  assert.equal(mergeVisibleBack([E('x', 'a')], nextVisible, layers), nextVisible)
})

test('deriveScene: individually hidden elements (customData.hidden) are omitted', () => {
  const layers = [L('x', { order: 0 })]
  const els = [E('a', 'x'), E('b', 'x', { customData: { layerId: 'x', hidden: true } })]
  assert.deepEqual(deriveScene(els, layers).map((e) => e.id), ['a'])
})

test('mergeVisibleBack: carries individually hidden elements forward', () => {
  const layers = [L('x', { order: 0 })]
  const prevFull = [E('a', 'x'), E('b', 'x', { customData: { layerId: 'x', hidden: true } })]
  const nextVisible = [E('a', 'x', { x: 5 })]
  const merged = mergeVisibleBack(prevFull, nextVisible, layers)
  assert.deepEqual(merged.map((e) => e.id).sort(), ['a', 'b'])
})

test('groupElementsByLayer: buckets non-deleted elements, unknown layer -> first', () => {
  const layers = [L('a', { order: 0 }), L('b', { order: 1 })]
  const els = [E('1', 'a'), E('2', 'b'), E('3', 'ghost'), E('4', 'a', { isDeleted: true })]
  const g = groupElementsByLayer(els, layers)
  assert.deepEqual(g.a.map((e) => e.id).sort(), ['1', '3'])
  assert.deepEqual(g.b.map((e) => e.id), ['2'])
})

test('elementLabel: friendly names', () => {
  assert.equal(elementLabel({ type: 'rectangle' }), 'Rectangulo')
  assert.equal(elementLabel({ type: 'freedraw' }), 'Trazo')
  assert.equal(elementLabel({ type: 'text', text: 'hola mundo' }), 'Texto: hola mundo')
  assert.equal(elementLabel({ type: 'text', text: '' }), 'Texto')
})

test('setElementHidden / setElementLocked / deleteElement: target one id + bump version', () => {
  const els = [E('a', 'x', { version: 1 }), E('b', 'x', { version: 1 })]
  assert.equal(setElementHidden(els, 'a', true)[0].customData.hidden, true)
  assert.equal(setElementHidden(els, 'a', true)[0].version, 2)
  assert.equal(setElementHidden(setElementHidden(els, 'a', true), 'a', false)[0].customData.hidden, undefined)
  assert.equal(setElementLocked(els, 'b', true)[1].locked, true)
  assert.equal(deleteElement(els, 'a')[0].isDeleted, true)
  assert.ok(!deleteElement(els, 'a')[1].isDeleted)
})

test('mergeVisibleBack: an element moved out of a hidden layer is not duplicated', () => {
  const layers = [L('vis', { order: 0 }), L('hid', { order: 1, visible: false })]
  const prevFull = [E('b', 'hid')]
  const nextVisible = [E('b', 'vis')] // user reassigned it via the panel
  const merged = mergeVisibleBack(prevFull, nextVisible, layers)
  assert.deepEqual(merged.map((e) => e.id), ['b'])
})

test('setLayerOpacity: dims elements and stashes baseOpacity; 100% restores', () => {
  const els = [E('a', 'x', { opacity: 80 }), E('b', 'y', { opacity: 100 })]
  const dim = setLayerOpacity(els, 'x', 0.5)
  assert.equal(dim[0].opacity, 40)
  assert.equal(dim[0].customData.baseOpacity, 80)
  assert.equal(dim[1].opacity, 100) // other layer untouched
  const dimmer = setLayerOpacity(dim, 'x', 0.25)
  assert.equal(dimmer[0].opacity, 20) // computed from baseOpacity, not the dimmed value
  const restored = setLayerOpacity(dimmer, 'x', 1)
  assert.equal(restored[0].opacity, 80)
  assert.equal(restored[0].customData.baseOpacity, undefined)
})

test('bumpVersion: increments version and stamps updated', () => {
  const out = bumpVersion({ id: 'a', version: 4 })
  assert.equal(out.version, 5)
  assert.equal(typeof out.versionNonce, 'number')
  assert.equal(typeof out.updated, 'number')
})

test('setLayerOpacity bumps the version of changed elements (so it syncs)', () => {
  const els = [E('a', 'x', { opacity: 100, version: 2 })]
  const out = setLayerOpacity(els, 'x', 0.5)
  assert.equal(out[0].version, 3)
})

test('moveElementsToLayer: reassigns layerId for the id set and bumps version', () => {
  const els = [E('a', 'x', { version: 1 }), E('b', 'x', { version: 1 }), E('c', 'y', { version: 1 })]
  const out = moveElementsToLayer(els, new Set(['a', 'c']), 'z')
  assert.equal(out.find((e) => e.id === 'a').customData.layerId, 'z')
  assert.equal(out.find((e) => e.id === 'a').version, 2)
  assert.equal(out.find((e) => e.id === 'b').customData.layerId, 'x') // untouched
  assert.equal(out.find((e) => e.id === 'b').version, 1)
  assert.equal(out.find((e) => e.id === 'c').customData.layerId, 'z')
})

test('setLayerLocked: locks all in layer; unlock only releases layer-locked', () => {
  const els = [
    E('a', 'x', { locked: false }),
    E('b', 'x', { locked: true, customData: { layerId: 'x', userLocked: true } }),
  ]
  const locked = setLayerLocked(els, 'x', true)
  assert.equal(locked[0].locked, true)
  assert.equal(locked[0].customData.lockedByLayer, true)
  const unlocked = setLayerLocked(locked, 'x', false)
  assert.equal(unlocked[0].locked, false) // was locked by the layer -> released
  assert.equal(unlocked[1].locked, true) // user-locked -> stays locked
})

test('reorderLayer: moving a layer changes derived z-order', () => {
  const layers = [L('a', { order: 0 }), L('b', { order: 1 }), L('c', { order: 2 })]
  const next = reorderLayer(layers, 'c', 0)
  const ordered = [...next].sort((x, y) => x.order - y.order).map((l) => l.id)
  assert.deepEqual(ordered, ['c', 'a', 'b'])
})

test('mergeDown: reassigns elements of a layer to the one below and drops the layer', () => {
  const layers = [L('low', { order: 0 }), L('high', { order: 1 })]
  const els = [E('a', 'low'), E('b', 'high')]
  const { layers: nl, elements: ne } = mergeDown(layers, els, 'high')
  assert.deepEqual(nl.map((l) => l.id), ['low'])
  assert.deepEqual(ne.map((e) => e.customData.layerId), ['low', 'low'])
})

test('mergeDown: the bottom layer cannot merge down (no-op)', () => {
  const layers = [L('low', { order: 0 }), L('high', { order: 1 })]
  const els = [E('a', 'low')]
  const out = mergeDown(layers, els, 'low')
  assert.deepEqual(out.layers.map((l) => l.id), ['low', 'high'])
})

test('duplicateLayer: clones the layer and its elements with fresh ids', () => {
  const layers = [L('src', { order: 0, name: 'Origen' })]
  const els = [E('a', 'src'), E('b', 'src')]
  const { layers: nl, elements: ne } = duplicateLayer(layers, els, 'src', () => `NEW-${Math.random()}`)
  assert.equal(nl.length, 2)
  const dup = nl.find((l) => l.id !== 'src')
  assert.equal(dup.name.includes('Origen'), true)
  const dupEls = ne.filter((e) => e.customData.layerId === dup.id)
  assert.equal(dupEls.length, 2)
  assert.equal(dupEls.every((e) => e.id !== 'a' && e.id !== 'b'), true)
})

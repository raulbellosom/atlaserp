import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cropToViewBox,
  clampCropRect,
  applyAspectRatio,
  elementFracToImageSpace,
} from '../imageCrop.js'

test('cropToViewBox: null -> full viewBox', () => {
  assert.equal(cropToViewBox(null), '0 0 1000 1000')
})

test('cropToViewBox: windows into the crop rect (x1000)', () => {
  assert.equal(cropToViewBox({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 }), '100 200 500 400')
})

test('clampCropRect: clamps size and keeps the window inside the image', () => {
  assert.deepEqual(
    clampCropRect({ x: -0.2, y: 0.5, w: 1.5, h: 0.3 }),
    { x: 0, y: 0.5, w: 1, h: 0.3 },
  )
  assert.deepEqual(
    clampCropRect({ x: 0.9, y: 0.9, w: 0.3, h: 0.3 }),
    { x: 0.7, y: 0.7, w: 0.3, h: 0.3 },
  )
})

test('clampCropRect: enforces a minimum window size', () => {
  const r = clampCropRect({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 })
  assert.ok(r.w >= 0.05 && r.h >= 0.05)
})

test('applyAspectRatio: null ratio just clamps', () => {
  assert.deepEqual(
    applyAspectRatio({ x: 0.1, y: 0.1, w: 0.6, h: 0.6 }, null),
    { x: 0.1, y: 0.1, w: 0.6, h: 0.6 },
  )
})

test('applyAspectRatio: derives height from width for a fraction-space ratio', () => {
  assert.deepEqual(
    applyAspectRatio({ x: 0.1, y: 0.1, w: 0.6, h: 0.6 }, 2),
    { x: 0.1, y: 0.1, w: 0.6, h: 0.3 },
  )
})

test('elementFracToImageSpace: identity when there is no crop', () => {
  assert.deepEqual(
    elementFracToImageSpace({ x: 0.5, y: 0.5 }, null),
    { x: 0.5, y: 0.5 },
  )
})

test('elementFracToImageSpace: maps a fraction of the window into image space', () => {
  assert.deepEqual(
    elementFracToImageSpace({ x: 0.5, y: 0.5 }, { x: 0.2, y: 0.2, w: 0.4, h: 0.4 }),
    { x: 0.4, y: 0.4 },
  )
})

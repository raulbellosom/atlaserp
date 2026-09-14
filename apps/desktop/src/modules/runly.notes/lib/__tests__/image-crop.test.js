import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cropToViewBox,
  clampCropRect,
  applyAspectRatio,
  elementFracToImageSpace,
  normalizeRotation,
  addRotation,
  effectiveNaturalSize,
  rotatePointCW,
  rotateCropRect,
  rotateAnnotations,
  fitRectForAspect,
  rectForZoomCenter,
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

// ── Rotation ───────────────────────────────────────────────────────────

test('normalizeRotation: snaps to the nearest 90 and wraps into [0,360)', () => {
  assert.equal(normalizeRotation(0), 0)
  assert.equal(normalizeRotation(90), 90)
  assert.equal(normalizeRotation(360), 0)
  assert.equal(normalizeRotation(-90), 270)
  assert.equal(normalizeRotation(450), 90)
})

test('addRotation: adds a delta and normalizes', () => {
  assert.equal(addRotation(0, 90), 90)
  assert.equal(addRotation(270, 90), 0)
  assert.equal(addRotation(null, 90), 90)
})

test('effectiveNaturalSize: swaps w/h for 90 and 270, not for 0 or 180', () => {
  const nat = { w: 2000, h: 1000 }
  assert.deepEqual(effectiveNaturalSize(nat, 0), { w: 2000, h: 1000 })
  assert.deepEqual(effectiveNaturalSize(nat, 90), { w: 1000, h: 2000 })
  assert.deepEqual(effectiveNaturalSize(nat, 180), { w: 2000, h: 1000 })
  assert.deepEqual(effectiveNaturalSize(nat, 270), { w: 1000, h: 2000 })
  assert.equal(effectiveNaturalSize(null, 90), null)
})

function assertPointClose(actual, expected) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-9, `x: ${actual.x} !~ ${expected.x}`)
  assert.ok(Math.abs(actual.y - expected.y) < 1e-9, `y: ${actual.y} !~ ${expected.y}`)
}

test('rotatePointCW: 90/180/270 formulas, 0 is identity', () => {
  const p = { x: 0.9, y: 0.1 }
  assertPointClose(rotatePointCW(p, 0), { x: 0.9, y: 0.1 })
  assertPointClose(rotatePointCW(p, 90), { x: 0.9, y: 0.9 })
  assertPointClose(rotatePointCW(p, 180), { x: 0.1, y: 0.9 })
  assertPointClose(rotatePointCW(p, 270), { x: 0.1, y: 0.1 })
})

test('rotatePointCW: four 90s return to the start', () => {
  let p = { x: 0.2, y: 0.7 }
  for (let i = 0; i < 4; i++) p = rotatePointCW(p, 90)
  assert.ok(Math.abs(p.x - 0.2) < 1e-9 && Math.abs(p.y - 0.7) < 1e-9)
})

test('rotateCropRect: null/0deg is a no-op; full-frame rect stays full-frame', () => {
  assert.equal(rotateCropRect(null, 90), null)
  const full = { x: 0, y: 0, w: 1, h: 1 }
  assert.deepEqual(rotateCropRect(full, 0), full)
  assert.deepEqual(rotateCropRect(full, 90), full)
})

test('rotateCropRect: 90deg swaps width and height of a sub-rect', () => {
  const rect = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }
  const rotated = rotateCropRect(rect, 90)
  assert.ok(Math.abs(rotated.w - 0.4) < 1e-9)
  assert.ok(Math.abs(rotated.h - 0.3) < 1e-9)
})

test('rotateAnnotations: 0deg is a no-op (same reference)', () => {
  const anns = [{ type: 'text', svgX: 0.1, svgY: 0.2 }]
  assert.equal(rotateAnnotations(anns, 0), anns)
})

test('rotateAnnotations: rotates path points, arrow/rect corners, and text position', () => {
  const anns = [
    { type: 'path', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    { type: 'arrow', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
    { type: 'text', svgX: 0.25, svgY: 0.75 },
  ]
  const rotated = rotateAnnotations(anns, 90)
  assert.deepEqual(rotated[0].points, [{ x: 1, y: 0 }, { x: 0, y: 1 }])
  assert.deepEqual(rotated[1].start, { x: 1, y: 0 })
  assert.deepEqual(rotated[1].end, { x: 1, y: 1 })
  assert.deepEqual(rotated[2].svgX, 0.25)
  assert.deepEqual(rotated[2].svgY, 0.25)
})

// ── Move-and-scale (fit / zoom) ───────────────────────────────────────

test('fitRectForAspect: no ratio -> the full image', () => {
  assert.deepEqual(fitRectForAspect(null), { x: 0, y: 0, w: 1, h: 1 })
})

test('fitRectForAspect: centers the largest rect at the given aspect', () => {
  // ratio 2 (wide) -> full width, derived (smaller) height, vertically centered
  assert.deepEqual(fitRectForAspect(2), { x: 0, y: 0.25, w: 1, h: 0.5 })
  // ratio 0.5 (tall) -> full height, derived (smaller) width, horizontally centered
  assert.deepEqual(fitRectForAspect(0.5), { x: 0.25, y: 0, w: 0.5, h: 1 })
})

test('rectForZoomCenter: zoom=1 reproduces the fit rect regardless of center', () => {
  const fit = fitRectForAspect(1)
  assert.deepEqual(rectForZoomCenter(fit, 1, { x: 0.9, y: 0.1 }), fit)
})

test('rectForZoomCenter: zooming in shrinks the rect and centers on the pan point', () => {
  const fit = { x: 0, y: 0, w: 1, h: 1 }
  const rect = rectForZoomCenter(fit, 2, { x: 0.5, y: 0.5 })
  assert.equal(rect.w, 0.5)
  assert.equal(rect.h, 0.5)
  assert.equal(rect.x, 0.25)
  assert.equal(rect.y, 0.25)
})

test('rectForZoomCenter: clamps so the window never leaves the unit square', () => {
  const fit = { x: 0, y: 0, w: 1, h: 1 }
  const rect = rectForZoomCenter(fit, 4, { x: 0.02, y: 0.98 })
  assert.ok(rect.x >= 0 && rect.x + rect.w <= 1 + 1e-9)
  assert.ok(rect.y >= 0 && rect.y + rect.h <= 1 + 1e-9)
})

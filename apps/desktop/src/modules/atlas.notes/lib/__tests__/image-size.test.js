import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampImageWidthPct,
  DEFAULT_IMAGE_WIDTH_PCT,
  MIN_IMAGE_WIDTH_PCT,
  MAX_IMAGE_WIDTH_PCT,
} from '../imageSize.js'

test('clampImageWidthPct: keeps an in-range value unchanged', () => {
  assert.equal(clampImageWidthPct(45), 45)
})

test('clampImageWidthPct: clamps below the minimum', () => {
  assert.equal(clampImageWidthPct(5), MIN_IMAGE_WIDTH_PCT)
})

test('clampImageWidthPct: clamps above the maximum', () => {
  assert.equal(clampImageWidthPct(150), MAX_IMAGE_WIDTH_PCT)
})

test('clampImageWidthPct: falls back to the default for non-finite input', () => {
  assert.equal(clampImageWidthPct(NaN), DEFAULT_IMAGE_WIDTH_PCT)
  assert.equal(clampImageWidthPct(undefined), DEFAULT_IMAGE_WIDTH_PCT)
})

// Sizing constants + helper for note body images. Width is stored as a
// percentage (0..100) of the note's content column, so it composes with the
// crop wrapper (which is itself percentage-based) with no extra math.

// New images are inserted at this scale instead of the full column width —
// most images don't need to dominate the note, and this leaves room to grow
// via the resize handle.
export const DEFAULT_IMAGE_WIDTH_PCT = 60
export const MIN_IMAGE_WIDTH_PCT = 20
export const MAX_IMAGE_WIDTH_PCT = 100

export function clampImageWidthPct(pct) {
  if (!Number.isFinite(pct)) return DEFAULT_IMAGE_WIDTH_PCT
  return Math.min(MAX_IMAGE_WIDTH_PCT, Math.max(MIN_IMAGE_WIDTH_PCT, pct))
}

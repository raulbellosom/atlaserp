// Sizing constants + helper for note body images. Width is stored as a
// percentage (0..100) of the note's content column, so it composes with the
// crop wrapper (which is itself percentage-based) with no extra math.

// New images are inserted at this scale instead of the full column width —
// most images don't need to dominate the note, and this leaves room to grow
// via the resize handle.
export const DEFAULT_IMAGE_WIDTH_PCT = 60
export const MIN_IMAGE_WIDTH_PCT = 20
export const MAX_IMAGE_WIDTH_PCT = 100

// A tall/portrait image (e.g. a phone screenshot) at DEFAULT_IMAGE_WIDTH_PCT
// can still render taller than the screen because width-based scaling alone
// doesn't account for aspect ratio. Cap the initial render height so the
// whole image is visible without much scrolling right after inserting it.
export const MAX_INITIAL_HEIGHT_PX = 480

export function clampImageWidthPct(pct) {
  if (!Number.isFinite(pct)) return DEFAULT_IMAGE_WIDTH_PCT
  return Math.min(MAX_IMAGE_WIDTH_PCT, Math.max(MIN_IMAGE_WIDTH_PCT, pct))
}

/**
 * Initial width (% of the content column) for a newly inserted image.
 * Starts from DEFAULT_IMAGE_WIDTH_PCT, then scales down further — but never
 * below MIN_IMAGE_WIDTH_PCT — if the image is tall/large enough that
 * DEFAULT_IMAGE_WIDTH_PCT would render taller than MAX_INITIAL_HEIGHT_PX.
 * Falls back to DEFAULT_IMAGE_WIDTH_PCT when any dimension is unknown.
 */
export function computeInitialImageWidthPct({ naturalWidth, naturalHeight, columnWidthPx }) {
  if (!naturalWidth || !naturalHeight || !columnWidthPx) return DEFAULT_IMAGE_WIDTH_PCT
  const aspect = naturalWidth / naturalHeight
  const widthForHeightCapPct = ((MAX_INITIAL_HEIGHT_PX * aspect) / columnWidthPx) * 100
  return clampImageWidthPct(Math.min(DEFAULT_IMAGE_WIDTH_PCT, widthForHeightCapPct))
}

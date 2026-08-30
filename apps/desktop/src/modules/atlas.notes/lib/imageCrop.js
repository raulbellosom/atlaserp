// Crop geometry helpers for note body images. All rects are
// { x, y, w, h } as fractions 0..1 of the ORIGINAL image.

const MIN_SIZE = 0.05

/** SVG viewBox string that windows annotation space into the crop rect. */
export function cropToViewBox(crop) {
  if (!crop) return '0 0 1000 1000'
  const { x, y, w, h } = crop
  return `${x * 1000} ${y * 1000} ${w * 1000} ${h * 1000}`
}

/** Clamp a rect to a valid window: min size, fully inside [0,1]x[0,1]. */
export function clampCropRect(rect) {
  const w = Math.min(1, Math.max(MIN_SIZE, rect.w))
  const h = Math.min(1, Math.max(MIN_SIZE, rect.h))
  const x = Math.min(1 - w, Math.max(0, rect.x))
  const y = Math.min(1 - h, Math.max(0, rect.y))
  return { x, y, w, h }
}

/**
 * Constrain a rect to an aspect ratio expressed in FRACTION space
 * (w_frac / h_frac). Keeps width, derives height. `ratio` null -> just clamp.
 * The caller converts a pixel ratio to fraction space via natural dimensions.
 */
export function applyAspectRatio(rect, ratio) {
  if (!ratio) return clampCropRect(rect)
  let w = rect.w
  let h = w / ratio
  if (h > 1) {
    h = 1
    w = h * ratio
  }
  return clampCropRect({ x: rect.x, y: rect.y, w, h })
}

/**
 * Map a fraction of the displayed (possibly cropped) image element into
 * original-image space, so every stored annotation coordinate is
 * crop-independent.
 */
export function elementFracToImageSpace(frac, crop) {
  if (!crop) return { x: frac.x, y: frac.y }
  return {
    x: crop.x + frac.x * crop.w,
    y: crop.y + frac.y * crop.h,
  }
}

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

// ── Rotation (90° steps) ────────────────────────────────────────────────
//
// `rotation` is always one of 0/90/180/270, clockwise. crop/annotation
// coordinates are always defined in the ROTATED image's own fraction space
// (its own [0,1]x[0,1], same as the unrotated case) — a 90°/270° rotation
// swaps which of the original image's pixel dimensions maps to "width" vs
// "height", but a fraction space is self-normalizing per axis regardless of
// the underlying pixel aspect, so a single point-rotation formula works for
// crop rects and every annotation shape without needing pixel dimensions.

/** Normalize any rotation delta to one of 0/90/180/270. */
export function normalizeRotation(deg) {
  return (((Math.round((deg ?? 0) / 90) * 90) % 360) + 360) % 360
}

/** Add a delta (e.g. +90 from a "Girar" click) to a current rotation. */
export function addRotation(current, deltaDeg) {
  return normalizeRotation((current ?? 0) + deltaDeg)
}

/** { w, h } of the image as displayed, accounting for a 90°/270° swap. */
export function effectiveNaturalSize(nat, rotation) {
  if (!nat) return nat
  const swapped = normalizeRotation(rotation) % 180 !== 0
  return swapped ? { w: nat.h, h: nat.w } : { w: nat.w, h: nat.h }
}

/** Rotate a single fraction-space point `{x,y}` clockwise by `deg`. */
export function rotatePointCW(p, deg) {
  switch (normalizeRotation(deg)) {
    case 90:
      return { x: 1 - p.y, y: p.x }
    case 180:
      return { x: 1 - p.x, y: 1 - p.y }
    case 270:
      return { x: p.y, y: 1 - p.x }
    default:
      return { x: p.x, y: p.y }
  }
}

/** Rotate a crop rect (or null) clockwise by `deg`. */
export function rotateCropRect(rect, deg) {
  const d = normalizeRotation(deg)
  if (!rect || d === 0) return rect
  const p1 = rotatePointCW({ x: rect.x, y: rect.y }, d)
  const p2 = rotatePointCW({ x: rect.x + rect.w, y: rect.y + rect.h }, d)
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    w: Math.abs(p2.x - p1.x),
    h: Math.abs(p2.y - p1.y),
  }
}

/**
 * Rotate a stored annotations array clockwise by `deg`. Every shape is
 * ultimately one or more fraction-space points, so this covers pen paths,
 * arrows, rects, and text labels uniformly.
 */
export function rotateAnnotations(annotations, deg) {
  const d = normalizeRotation(deg)
  if (d === 0) return annotations
  return annotations.map((ann) => {
    if (ann.type === 'path') {
      return { ...ann, points: (ann.points || []).map((p) => rotatePointCW(p, d)) }
    }
    if (ann.type === 'arrow' || ann.type === 'rect') {
      return { ...ann, start: rotatePointCW(ann.start, d), end: rotatePointCW(ann.end, d) }
    }
    if (ann.type === 'text') {
      const p = rotatePointCW({ x: ann.svgX, y: ann.svgY }, d)
      return { ...ann, svgX: p.x, svgY: p.y }
    }
    return ann
  })
}

// ── Move-and-scale crop (iOS-style: fixed viewfinder, pan/zoom the image) ─

/**
 * The zoom=1 baseline rect for a given viewfinder aspect (fraction-space
 * w/h): the largest centered rect at that aspect that fits inside the unit
 * square — i.e. the image covers the whole viewfinder with no gaps, as
 * zoomed-out as it can be. `ratio` null/falsy → the full image (no crop).
 */
export function fitRectForAspect(ratio) {
  if (!ratio) return { x: 0, y: 0, w: 1, h: 1 }
  let w = 1
  let h = 1 / ratio
  if (h > 1) {
    h = 1
    w = ratio
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

/**
 * Crop rect for a given zoom level (>=1) and pan center (fraction-space
 * point of the image currently at the viewfinder's center), holding the
 * `fitRect`'s aspect ratio fixed. Clamped to stay inside the unit square.
 */
export function rectForZoomCenter(fitRect, zoom, center) {
  const z = Math.max(1, zoom)
  const w = fitRect.w / z
  const h = fitRect.h / z
  const x = Math.min(1 - w, Math.max(0, center.x - w / 2))
  const y = Math.min(1 - h, Math.max(0, center.y - h / 2))
  return { x, y, w, h }
}

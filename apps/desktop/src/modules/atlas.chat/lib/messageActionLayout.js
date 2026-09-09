// apps/desktop/src/modules/atlas.chat/lib/messageActionLayout.js
//
// Pure positioning math for MessageActionSheet — extracted so the safe-area /
// flip / bubble-shift logic is unit-testable (the repo has no React-component
// test runner). The component measures the DOM, calls this, and renders.
//
// Touch: the pill sits above the pressed bubble and the action card below it;
// when that stack would collide with the notch or the home indicator the whole
// group is shifted vertically (shiftY, also applied to the bubble itself by
// ChatMessageBubble) so it lands inside the safe area. Mouse: anchor to the
// cursor point, never shift.
export function computeActionSheetLayout({
  vw,
  vh,
  rect,                 // pressed bubble DOMRect-ish { top, bottom, left, right }
  anchorPoint,          // { x, y } cursor point for mouse, else null
  pillSize,             // { width, height }
  panelSize,            // { width, height }
  coarse,               // touch?
  isOwn,                // hug the bubble's right edge on touch
  safeTop = 0,
  safeBottom = 0,
  gap = 8,
  margin = 8,
}) {
  const m = margin;
  const mTop = m + safeTop;
  const mBottom = m + safeBottom;
  const pw = panelSize.width;
  const ph = panelSize.height;
  const pillW = pillSize.width;
  const pillH = pillSize.height;

  // Anchor: cursor for mouse, bubble rect for touch (or a screen-center
  // fallback when neither is known).
  const anchor = (!coarse && anchorPoint)
    ? { top: anchorPoint.y, bottom: anchorPoint.y, left: anchorPoint.x, right: anchorPoint.x }
    : rect ?? { top: vh / 2 - 20, bottom: vh / 2 + 20, left: m, right: vw - m };

  // --- vertical shift (touch only, and only when the stack fits the safe area)
  let shiftY = 0;
  if (coarse && rect) {
    const bubbleH = Math.max(0, anchor.bottom - anchor.top);
    const stackH = pillH + gap + bubbleH + gap + ph;
    const safeH = vh - mTop - mBottom;
    if (stackH <= safeH) {
      const stackTopNow = anchor.top - pillH - gap;
      const clampedStackTop = Math.max(mTop, Math.min(stackTopNow, vh - mBottom - stackH));
      shiftY = Math.round(clampedStackTop - stackTopNow);
    }
  }

  const sRect = {
    top: anchor.top + shiftY,
    bottom: anchor.bottom + shiftY,
    left: anchor.left,
    right: anchor.right,
  };

  // --- horizontal
  const clampX = (x, w) => Math.max(m, Math.min(x, vw - w - m));
  const alignRight = coarse && isOwn;
  const panelLeft = alignRight ? clampX(sRect.right - pw, pw) : clampX(sRect.left, pw);
  const pillLeft = alignRight ? clampX(sRect.right - pillW, pillW) : clampX(sRect.left, pillW);

  // --- vertical placement around the (possibly shifted) bubble
  const belowTop = sRect.bottom + gap;
  const flip = belowTop + ph > vh - mBottom;
  const panelTop = flip
    ? Math.max(mTop + pillH + gap, sRect.top - gap - ph)
    : Math.min(belowTop, vh - ph - mBottom);
  const pillTop = flip
    ? Math.max(mTop, panelTop - gap - pillH)
    : Math.max(mTop, sRect.top - gap - pillH);

  return { panelLeft, panelTop, pillLeft, pillTop, shiftY, sRect };
}

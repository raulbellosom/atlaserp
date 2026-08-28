import { useMemo, useRef, useState } from "react";

const H_RATIO = 1.5;       // |dx| must exceed |dy| * H_RATIO to count as horizontal
const MAX_TRANSLATE = 96;  // rubber-band cap

// Pure, injectable controller. `direction` is "right" for received messages
// (drag right to reply) and "left" for own messages (drag left). `onTranslate`
// receives the signed px offset the caller should apply as translateX.
export function createSwipeController({ threshold = 64, direction = "right", onReply, onTranslate } = {}) {
  let start = null;
  let horizontal = false;
  let engaged = false;
  const sign = direction === "left" ? -1 : 1;

  function reset() {
    start = null;
    horizontal = false;
    engaged = false;
    onTranslate?.(0);
  }

  return {
    onPointerDown(e) {
      start = { x: e.clientX, y: e.clientY };
      horizontal = false;
      engaged = false;
      try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    },
    onPointerMove(e) {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!horizontal) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        horizontal = Math.abs(dx) > Math.abs(dy) * H_RATIO;
        if (!horizontal) { start = null; return; } // vertical intent -> yield to scroll
      }
      const projected = dx * sign;                 // positive when swiping the intended way
      if (projected <= 0) { onTranslate?.(0); return; }
      const clamped = Math.min(projected, MAX_TRANSLATE);
      engaged = projected >= threshold;
      onTranslate?.(clamped * sign);
    },
    onPointerUp() {
      const shouldFire = engaged;
      reset();
      if (shouldFire) onReply?.();
    },
    onPointerCancel() { reset(); },
  };
}

export function useSwipeToReply({ onReply, threshold = 64, direction = "right", disabled = false } = {}) {
  const [translateX, setTranslateX] = useState(0);
  const cb = useRef(onReply);
  cb.current = onReply;

  const handlers = useMemo(() => {
    if (disabled) return {};
    const ctrl = createSwipeController({
      threshold,
      direction,
      onReply: () => cb.current?.(),
      onTranslate: setTranslateX,
    });
    return {
      onPointerDown: (e) => ctrl.onPointerDown(e),
      onPointerMove: (e) => ctrl.onPointerMove(e),
      onPointerUp: () => ctrl.onPointerUp(),
      onPointerCancel: () => ctrl.onPointerCancel(),
    };
  }, [threshold, direction, disabled]);

  return { handlers, translateX };
}

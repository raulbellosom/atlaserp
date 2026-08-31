import { useMemo, useRef } from "react";

const INTERACTIVE = "a,button,img,video,input,textarea,select,label,[role=button]";

function isInteractiveTarget(target) {
  if (!target) return false;
  if (typeof target.closest === "function") return Boolean(target.closest(INTERACTIVE));
  const tag = String(target.tagName ?? "").toLowerCase();
  return ["a", "button", "img", "video", "input", "textarea", "select", "label"].includes(tag);
}

// Pure, injectable controller so the timing rules stay unit-testable without a
// renderer or a real DOM. `schedule` / `cancelScheduled` default to timers.
export function createLongPressController({
  delay = 450,
  moveTolerance = 10,
  ignoreInteractiveTarget = false,
  onLongPress,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancelScheduled = (id) => clearTimeout(id),
  vibrate = (ms) => { try { navigator?.vibrate?.(ms); } catch { /* unsupported */ } },
} = {}) {
  let timerId = null;
  let fireFn = null;
  let start = null;

  function clear() {
    if (timerId != null) cancelScheduled(timerId);
    timerId = null;
    fireFn = null;
    start = null;
  }

  return {
    // test helpers
    get pending() { return fireFn != null; },
    flush() { const fn = fireFn; if (fn) fn(); },

    onPointerDown(e) {
      if (!ignoreInteractiveTarget && isInteractiveTarget(e?.target)) return;
      start = { x: e.clientX, y: e.clientY };
      fireFn = () => {
        vibrate(10);
        onLongPress?.(e);
        clear();
      };
      timerId = schedule(fireFn, delay);
    },
    onPointerMove(e) {
      if (start == null) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > moveTolerance || dy > moveTolerance) clear();
    },
    onPointerUp() { clear(); },
    onPointerCancel() { clear(); },
  };
}

export function useLongPress({ onLongPress, delay = 450, moveTolerance = 10, disabled = false, ignoreInteractiveTarget = false } = {}) {
  const cb = useRef(onLongPress);
  cb.current = onLongPress;

  return useMemo(() => {
    if (disabled) return {};
    const ctrl = createLongPressController({
      delay,
      moveTolerance,
      ignoreInteractiveTarget,
      onLongPress: (e) => cb.current?.(e),
    });
    return {
      onPointerDown: (e) => ctrl.onPointerDown(e),
      onPointerMove: (e) => ctrl.onPointerMove(e),
      onPointerUp: () => ctrl.onPointerUp(),
      onPointerCancel: () => ctrl.onPointerCancel(),
    };
  }, [delay, moveTolerance, disabled, ignoreInteractiveTarget]);
}

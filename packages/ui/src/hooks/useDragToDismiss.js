import { useRef, useState } from "react";

/**
 * Shared pointer-based "drag down to dismiss" behavior for mobile
 * bottom-sheet-style overlays (Dialog's mobile sheet, Sheet's bottom side).
 * Dragging past `threshold` px triggers `onDismiss` via a hidden close ref click.
 */
export function useDragToDismiss({ threshold = 80 } = {}) {
  const closeRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(null);
  const isDragging = useRef(false);

  function handleDragPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    isDragging.current = true;
    setDragging(true);
  }

  function handleDragPointerMove(e) {
    if (!isDragging.current || dragStartY.current === null) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    setDragY(dy);
  }

  function handleDragPointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragging(false);
    if (dragY > threshold) {
      setDragY(0);
      closeRef.current?.click();
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  }

  return {
    closeRef,
    dragY,
    dragging,
    handleDragPointerDown,
    handleDragPointerMove,
    handleDragPointerUp,
  };
}

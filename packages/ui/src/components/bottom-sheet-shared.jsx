import * as DialogPrimitive from "@radix-ui/react-dialog";

// Canonical mobile bottom-sheet geometry shared by Dialog.jsx (its mobile
// variant) and Sheet.jsx (side="bottom"). Keeping this in one file means the
// handle spacing, corner radius, scroll behavior, and drag-to-dismiss feel
// can never drift apart between the two components again.
export const BOTTOM_SHEET_SURFACE_CLASS =
  "rounded-t-2xl p-6 max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y";

export function bottomSheetDragStyle({ dragY, dragging, style }) {
  return {
    paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
    transition: dragging
      ? "none"
      : "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
    ...style,
  };
}

export function BottomSheetHandle({
  closeRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  return (
    <>
      <div
        className="mx-auto -mt-1 mb-3 h-1.5 w-16 shrink-0 rounded-full bg-foreground/25 cursor-grab active:cursor-grabbing touch-none"
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {/* Hidden close button for programmatic swipe-to-dismiss. Both Dialog
          and Sheet are built on @radix-ui/react-dialog, so this Close works
          inside either one's Content tree. */}
      <DialogPrimitive.Close
        ref={closeRef}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );
}

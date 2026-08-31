import * as DialogPrimitive from "@radix-ui/react-dialog";

// Canonical mobile bottom-sheet geometry shared by Dialog.jsx (its mobile
// variant) and Sheet.jsx (side="bottom"). Keeping this in one file means the
// handle spacing, corner radius, scroll behavior, and drag-to-dismiss feel
// can never drift apart between the two components again.
//
// - `pt-9`             → reserves room under the drag handle, which is
//                        absolutely positioned against the sheet's own top
//                        edge (the sheet is already `position: fixed`, so it
//                        is the containing block) — the handle's placement no
//                        longer depends on whatever padding a consumer sets
//                        (some pass `p-0`).
// - `min-h-[50dvh]`    → the sheet always covers at least half the screen
//                        instead of hugging tiny content.
export const BOTTOM_SHEET_SURFACE_CLASS =
  "rounded-t-2xl px-6 pt-9 pb-6 min-h-[50dvh] max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y";

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
      {/* Generous, transparent grab zone pinned to the sheet's top edge —
          not the 6px pill alone, which was almost impossible to hit so the
          drag-to-dismiss gesture "did nothing". Centered and narrow so it
          never sits over the top-right close button. The visible pill is
          centered inside it, landing roughly level with that close button. */}
      <div
        className="absolute left-1/2 top-0 z-10 flex h-9 w-28 -translate-x-1/2 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="h-1.5 w-12 rounded-full bg-foreground/25" />
      </div>
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

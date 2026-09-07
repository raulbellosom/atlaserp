# Plan — AdvancedFileViewer touch/fit/filmstrip

Spec: `docs/superpowers/specs/2026-09-07-file-viewer-touch-and-filmstrip-design.md`
Single frontend component + one tiny tweak. No backend.

## Tasks

1. **Swipe tray glyph** — `ConversationRowActions.jsx`: third tray action
   `icon: MoreHorizontal` (import from lucide-react).

2. **AdvancedFileViewer — fit scale**
   - `naturalSize` state (from `<img onLoad>`), `containerSize` state (from a
     `ResizeObserver` on `imageContainerRef`, set up in a `useEffect`).
   - `fitScale` / `effectiveScale` memos (account for `rotation` 90/270 swap).
   - Image render: drop `object-contain` + `max-*`; natural-size `<img>` with
     the combined transform; container keeps `overflow-hidden` + centering.
   - Reset `naturalSize` on `file?.id` change (with the other resets).

3. **AdvancedFileViewer — gesture rewrite**
   - Remove `handlePointerDown/Move/End` touch handling; keep them for
     `pointerType !== "touch"` (mouse pan + wheel zoom).
   - New `useEffect` attaching non-passive `touchstart/move/end/cancel` to
     `imageContainerRef.current` (guarded on `kind === "image" && signedUrl`).
   - `pinchRef` / `panRef` snapshots; pinch anchored at the touch midpoint;
     pan clamped to `maxPan`. Double-tap toggle 1⇄2.
   - Delete the old `preventNativePinch` touchstart effect (superseded).
   - `gestureActive` now driven by the touch refs too (state:
     `dragging` / `pinching` kept for cursor + transition).

4. **AdvancedFileViewer — floating glass filmstrip**
   - Pull the `(files.length > 1)` filmstrip block out of the flex column into
     an absolutely-positioned `.glass` overlay in the content area
     (`bottom-3`, centered, `max-w-[calc(100%-1.5rem)]`, `overflow-x-auto`).
   - Render when `filmstripOpen && !gestureActive` (opacity/translate
     transition); collapsed → small `.glass` chevron-up pill.
   - Keep thumb refs / scroll-into-view / video-thumb window logic as-is.

## Verify

- `pnpm --filter @atlas/desktop exec vite build` green.
- `pnpm lint` green.
- Manual QA (device / touch emulation): pinch zoom smooth 0.25×–4× of fit,
  pan within bounds, double-tap, initial view fills the modal, filmstrip
  floats as glass and hides during gestures, `%` reads 100 at fit.
- Desktop regression: wheel zoom, mouse drag-pan, arrows/keyboard paging,
  rotate/flip/reset.

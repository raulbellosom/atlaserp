# AdvancedFileViewer — touch gestures, fit-scale & floating filmstrip

**Status:** approved 2026-09-07
Shared component: `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`
(used by atlas.files and, via `ChatAttachmentViewer.jsx`, by atlas.chat).

## Problems

1. **Pinch/pan barely works on touch.** The gesture layer uses Pointer Events
   with `setPointerCapture` per pointer. iOS WebKit fires `pointercancel`
   repeatedly during multitouch → `handlePointerEnd` flips to pan mode and the
   next `pointerdown` re-seeds `gestureRef.startDistance` to the *current*
   distance every frame, so `ratio` stays ≈ 1 ("1% per pinch"). `startZoom` is
   also captured by closure and drifts. On top of that, React routes
   `onTouchMove` through a passive root listener, so a handler `preventDefault`
   is a no-op — the browser keeps its own pan/zoom.
2. **Initial scale is a raw `zoom=1`** over `object-contain`. The toolbar shows
   "100%" but that number is meaningless (it's a multiplier of natural size,
   not of the fitted size). Want: 100% == "fills the visible area", zoom is a
   multiplier of that fit.
3. **Filmstrip is docked** with the same `surface-2/60` + `border-t` as the
   bottom toolbar directly below it → the two read as one cramped block, and
   it doesn't use the `.glass` design.
4. Minor: the conversation-list swipe tray's third button says "Más" with no
   icon; should be the `MoreHorizontal` (⋯) glyph.

## Approach

### Gesture layer (rewrite)

- **Touch** (`imageContainerRef`, image kind only): attach `touchstart` /
  `touchmove` / `touchend` / `touchcancel` via `addEventListener(…, { passive:
  false })` in a `useEffect` (same pattern the file already uses for `wheel`).
  Never through React props.
  - 2 touches → pinch. On entering 2-touch, snapshot
    `{ dist, zoom, pan, center }` **once** (guard on a `pinchActiveRef`).
    Each move: `nextZoom = clamp(snap.zoom * dist / snap.dist)`; keep the pinch
    centre anchored by adjusting pan by the centre delta and the zoom delta.
  - 1 touch → pan (only meaningful when `effectiveScale` overflows the
    container; otherwise ignored). Snapshot `{ point, pan }` on entering
    1-touch (including the drop from 2→1 touches). Each move:
    `pan = snap.pan + (point - snap.point)`, then clamp.
  - `touchend`: 2→1 re-snapshots pan; →0 clears both refs.
  - Double-tap (two `touchend`s < 280 ms, < 24 px apart) toggles `zoom` 1⇄2,
    anchored at the tap point (mirror `handleImageDoubleClick`).
  - `preventDefault()` on every `touchmove` with ≥1 touch inside the image.
- **Mouse/trackpad**: keep the existing pointer handlers but bail when
  `event.pointerType === "touch"`. Wheel-zoom stays.

### Fit scale

- New `naturalSize` state, set from `<img onLoad>` (`naturalWidth/Height`).
- New `containerSize` state from a `ResizeObserver` on `imageContainerRef`
  (handles modal resize / device rotation).
- `rotated = Math.abs(rotation % 180) === 90`; effective natural dims swap when
  rotated.
- `fitScale = min(containerW / natW, containerH / natH)` (no cap — shrinks big
  images, grows tiny ones, never exceeds the visible area).
- `effectiveScale = fitScale * zoom`. The `<img>` loses `object-contain` /
  `max-h-full max-w-full`; it renders at natural size inside the centered,
  `overflow-hidden` container with
  `transform: translate3d(pan) rotate() scaleX(flip) scaleY(flip) scale(effectiveScale)`.
- Toolbar `%` = `Math.round(zoom * 100)` (unchanged code, now meaningful).
  Reset-zoom sets `zoom = 1` → back to fit.
- Pan clamp: `maxPan{X,Y} = max(0, (natDim * effectiveScale - containerDim) / 2)`.
- Keep the `zoom <= 1 → pan {0,0}` effect.

### Floating glass filmstrip

- Move the filmstrip out of the flex column into an **absolutely positioned
  overlay** inside the content area:
  `absolute left-1/2 -translate-x-1/2 bottom-3 z-20 max-w-[calc(100%-1.5rem)]`,
  `glass rounded-2xl p-1.5`, inner `flex gap-2 overflow-x-auto`.
- Auto-hide while a gesture is active (`gestureActive`) with an opacity/translate
  transition; also respect the existing `filmstripOpen` manual toggle.
- Collapsed state: a small `glass` chevron-up pill at `bottom-3 left-1/2`.
- Thumbnails unchanged (12×12, ring on active, video first-frame trick).
- The bottom toolbar stays docked; the floating strip sitting `bottom-3` in the
  content area is clearly separated from it.

### Swipe tray label

`ConversationRowActions.jsx`: third tray action `icon: MoreHorizontal`, keep
label "Más".

## Out of scope

- PDF/video/audio gesture handling (unchanged).
- Desktop filmstrip behaviour is incidentally unified to the floating style;
  no separate desktop design.
- Momentum/inertia after pan.

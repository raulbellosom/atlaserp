# Chat message-action sheet — mobile fixes — Design

Date: 2026-09-09
Status: Approved
Module: `atlas.chat` (desktop, mobile/touch)

## Problem

Three defects in the mobile long-press message surface (`MessageActionSheet` +
`MessageReactionPicker`), reported from the #Bugs channel with on-device
screenshots:

1. **The full emoji picker is a mispositioned popover, not a modal.** Tapping
   `+` on the quick-reaction pill opens `MessageReactionPicker`, which is a
   Radix `Popover` anchored to the message bubble. On a phone it spills off the
   top of the viewport / renders behind the status bar. The composer already
   solved the identical problem for its own `+` button by opening the picker in
   a body-portaled modal on touch (`MessageComposer.jsx`), but the reaction
   picker never got that treatment.

2. **Tapping the non-blurred area does not dismiss the action sheet.** On
   touch, `MessageActionSheet`'s dismiss layer is four scrim rectangles drawn
   *around* the pressed bubble. The sharp "window" over the bubble itself has
   no dismiss handler, so tapping it does nothing (WhatsApp dismisses on a tap
   anywhere that isn't an action).

3. **Pill / action card land under the notch.** `MessageActionSheet`'s
   positioning math uses a flat `m = 8` margin against `window.innerWidth/
   innerHeight` and never accounts for `env(safe-area-inset-*)`. The
   quick-reaction pill can be placed at `top: 8`, behind the status
   bar/notch. It also never moves the bubble, so when the pill + bubble +
   card stack doesn't fit, parts end up off-screen instead of shifting into
   view the way WhatsApp does.

## Goals

- Full reaction picker opens as a **bottom sheet** on touch (WhatsApp-style),
  Popover unchanged on desktop.
- Tapping anywhere on the action-sheet overlay that isn't an action dismisses
  it — including the spotlighted bubble.
- Nothing in the action sheet is ever placed under the notch or the home
  indicator; when the stack doesn't fit around the bubble, the bubble itself
  shifts vertically so the whole group lands inside the safe area.

## Non-goals

- No change to desktop right-click behavior.
- No redesign of the quick-reaction set or the action list.
- Not touching the separate on-device bugs also visible in the screenshots
  (audio playback "0:0" / distorted, in-chat search "Sin resultados" with
  matches) — tracked separately.

---

## Fix 1 — Reaction picker as a bottom sheet on touch

`MessageReactionPicker.jsx`:

- Add `useCoarsePointer()`.
- When `coarse`: render `{children}` as-is (it is the bubble column — it must
  stay in the layout) plus a sibling `<Sheet open={open} onOpenChange={onOpenChange}>`
  with `<SheetContent side="bottom">`:
  - `<SheetHeader><SheetTitle>Reaccionar</SheetTitle></SheetHeader>`
  - `<EmojiPicker>` with `width="100%"`, `height="min(48vh, 400px)"`, the same
    props already used (`emojiStyle={EmojiStyle.NATIVE}`, `lazyLoadEmojis`,
    `skinTonesDisabled`, `theme="dark"`, `searchPlaceholder="Buscar emoji..."`,
    `autoFocusSearch={false}`), `onEmojiClick={(d) => { onPick(d.emoji); onOpenChange(false); }}`.
  - `SheetContent` default padding is `p-6`; override to `p-0` and pad the
    header/body so the picker reaches the sheet edges.
- When not `coarse`: the existing `Popover` / `PopoverAnchor` / `PopoverContent`
  branch, unchanged.

The `Sheet` (`@radix-ui/react-dialog` under the hood) portals to `<body>`,
carries its own overlay + drag-to-dismiss handle + safe-area padding, and
`useIsMobile` inside it already forces `side="bottom"` on phones.

## Fix 2 — Tap-anywhere dismiss

`MessageActionSheet.jsx`, the `coarse && r` branch of the dismiss layer: add a
fifth **transparent** (no `scrim` class) dismiss `<button type="button"
aria-label="Cerrar" onClick={close}>` positioned exactly over the bubble
window (`top: r.top`, `left: r.left`, `width: r.width`, `height: r.height`),
rendered before the pill and card in the DOM. The four scrim rectangles still
provide the blurred-around-a-hole visual; this button only makes the hole
dismiss on tap. The pill and card come later in the DOM and stop propagation
via their own `onClick` handlers, so their taps still run their actions.

## Fix 3 — Safe-area-aware positioning + bubble shift

### 3a. Expose safe-area insets to JS

`apps/desktop/src/styles.css`, on `:root`:

```css
--safe-top: env(safe-area-inset-top, 0px);
--safe-bottom: env(safe-area-inset-bottom, 0px);
```

In `MessageActionSheet.jsx`, read them once inside the `useLayoutEffect`:

```js
const rootStyle = getComputedStyle(document.documentElement);
const safeTop = parseFloat(rootStyle.getPropertyValue("--safe-top")) || 0;
const safeBottom = parseFloat(rootStyle.getPropertyValue("--safe-bottom")) || 0;
const mTop = 8 + safeTop;
const mBottom = 8 + safeBottom;
```

Replace every use of `m` as a top boundary with `mTop` and as a bottom boundary
with `mBottom` (horizontal stays `m = 8`). Specifically:
- `clampX` unchanged (horizontal).
- pill `top` clamp lower bound `m` → `mTop`.
- card `flip` test `belowTop + ph > vh - m` → `... > vh - mBottom`.
- card `panelTop` when not flipped: `Math.min(belowTop, vh - ph - m)` →
  `Math.min(belowTop, vh - ph - mBottom)`.
- card `panelTop` when flipped: `Math.max(m + pillH + gap, rect.top - gap - ph)`
  → `Math.max(mTop + pillH + gap, rect.top - gap - ph)`.
- pill `pillTop` clamps: `m` → `mTop`.

### 3b. Shift the bubble when the stack doesn't fit

After computing panel/pill sizes, before `setPos`:

```js
const bubbleH = Math.max(0, (rect.bottom ?? 0) - (rect.top ?? 0));
const stackH = pillH + gap + bubbleH + gap + ph;
const safeH = vh - mTop - mBottom;

let shiftY = 0;
if (coarse && anchorRect && stackH <= safeH) {
  // Desired top of the whole stack: keep it near where the bubble is, but
  // pulled fully inside [mTop, vh - mBottom].
  const stackTopIfCentered = rect.top - pillH - gap;              // current stack top
  const clampedStackTop = Math.max(mTop, Math.min(stackTopIfCentered, vh - mBottom - stackH));
  shiftY = Math.round(clampedStackTop - stackTopIfCentered);
}
// stackH > safeH (huge message + full menu): no shift, pill pins to mTop and
// card to vh - mBottom - ph via the clamps in 3a; the bubble may be partly
// covered — accepted edge case.

const sRect = { top: rect.top + shiftY, bottom: rect.bottom + shiftY, left: rect.left, right: rect.right };
```

Then compute `panelTop` / `pillTop` and the scrim rectangles from `sRect`
instead of `rect`. Store `shiftY` in the `pos` object and call a new prop
`onBubbleShift?.(shiftY)`. In the `if (!open)` branch call `onBubbleShift?.(0)`.

`useLayoutEffect` dep array gains nothing new (it already re-runs on
`open`/`anchorRect`/size changes).

### 3c. Apply the shift to the bubble

`ChatMessageBubble.jsx`:
- `const [bubbleShiftY, setBubbleShiftY] = useState(0);`
- Pass `onBubbleShift={setBubbleShiftY}` to both `<MessageActionSheet>` usages
  (own + received).
- On both per-message row `<div>`s (the `data-msg-id` wrappers, `isOwn` branch
  and received branch), add
  `style={{ transform: bubbleShiftY ? \`translateY(${bubbleShiftY}px)\` : undefined, willChange: bubbleShiftY ? "transform" : undefined }}`.
- No CSS transition — WhatsApp's shift is effectively instant and a lagging
  scrim would be visible. Snap both.

The row is a flex item in `ChatMessageList`'s column; a transient `translateY`
shifts it visually without reflowing siblings, and reverts to `undefined` when
the sheet closes.

## Data / control flow

```
long-press → actionSheet.open=true, anchorRect=bubble DOMRect
MessageActionSheet useLayoutEffect:
  measure pill+card → compute safe margins → compute shiftY
  → setPos({..., shiftY}) positions scrims/pill/card at rect+shiftY
  → onBubbleShift(shiftY) → ChatMessageBubble setState → row translateY(shiftY)
tap scrim OR bubble window OR Escape → onOpenChange(false)
  → useLayoutEffect !open branch → setPos(null) + onBubbleShift(0) → row reverts
tap "+" → close() + onOpenFullPicker() → reactionPickerOpen=true
  → MessageReactionPicker: coarse ? bottom Sheet : Popover
```

## Testing

Repo has no React-component test runner (`react-exports.test.js` is a known-red
stub), so behavior is verified by:

- Pure helper extraction: `computeActionSheetLayout({ vw, vh, rect, pillSize,
  panelSize, coarse, isOwn, anchorPoint, safeTop, safeBottom })` → `{ panelLeft,
  panelTop, pillLeft, pillTop, shiftY, sRect }`, moved into
  `apps/desktop/src/modules/atlas.chat/lib/messageActionLayout.js` and unit
  tested (`node --test`): pill never above `8 + safeTop`; card never below
  `vh - 8 - safeBottom`; with a bubble near the top and a tall stack, `shiftY`
  is positive and `sRect.top >= 8 + safeTop`; with a centered bubble that fits,
  `shiftY === 0`; desktop (`coarse:false`) path still anchors to `anchorPoint`
  and yields `shiftY === 0`.
- `MessageActionSheet` calls the helper; the JSX (scrims, portal, dismiss
  button) stays in the component.
- Manual device QA: 390px iOS Safari / Tauri — long-press top message, bottom
  message, own vs received; `+` opens bottom sheet; tap bubble dismisses.

## Files touched

| File | Change |
|---|---|
| `apps/desktop/src/styles.css` | `--safe-top` / `--safe-bottom` on `:root` |
| `apps/desktop/src/modules/atlas.chat/lib/messageActionLayout.js` | **new** — `computeActionSheetLayout` pure helper |
| `apps/desktop/src/modules/atlas.chat/lib/__tests__/messageActionLayout.test.js` | **new** |
| `apps/desktop/src/modules/atlas.chat/components/MessageActionSheet.jsx` | use helper, 5th dismiss button, `onBubbleShift` prop |
| `apps/desktop/src/modules/atlas.chat/components/MessageReactionPicker.jsx` | bottom `Sheet` on `coarse`, Popover on desktop |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | `bubbleShiftY` state, `onBubbleShift`, row `translateY` |

No API, no SDK, no migration.

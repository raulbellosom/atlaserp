# Chat Message-Action Sheet Mobile Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On touch, the full reaction picker opens as a bottom sheet, tapping the spotlighted bubble dismisses the action sheet, and the pill/card/bubble stack is kept inside the safe area — shifting the bubble when it doesn't fit.

**Architecture:** Positioning math for `MessageActionSheet` moves into a pure `computeActionSheetLayout` helper (unit-tested; repo has no component test runner). The component calls it, adds a transparent dismiss button over the bubble window, and reports a `shiftY` up to `ChatMessageBubble`, which applies `translateY` to the message row while the sheet is open. `MessageReactionPicker` gains a `coarse` branch that renders `@atlas/ui`'s bottom `Sheet` instead of the Radix `Popover`.

**Tech Stack:** React 19, `@atlas/ui` (`Sheet`, `useCoarsePointer`), `emoji-picker-react`, `env(safe-area-inset-*)`, Node built-in test runner.

Reference spec: `docs/superpowers/specs/2026-09-09-chat-message-action-sheet-mobile-fixes-design.md`

---

### Task 1: Expose safe-area insets as CSS vars

**Files:**
- Modify: `apps/desktop/src/styles.css` (the `:root` / `@layer base` block that already defines `--topbar-height` etc.)

- [ ] **Step 1: Add the vars**

Find the `:root { ... }` rule in `apps/desktop/src/styles.css` (near the `.safe-top` / `.safe-bottom` utilities around line 140). Add inside `:root` (create the rule at the top of the file's base layer if there is no bare `:root`):

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

- [ ] **Step 2: Verify it resolves**

Run: `grep -n "safe-top\|safe-bottom" apps/desktop/src/styles.css`
Expected: the two new `--safe-*` custom properties plus the existing `.safe-top` / `.safe-bottom` padding utilities.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/styles.css
git commit -m "feat(chat): expose --safe-top/--safe-bottom css vars for JS positioning"
```

---

### Task 2: `computeActionSheetLayout` pure helper + tests

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/lib/messageActionLayout.js`
- Test: `apps/desktop/src/modules/atlas.chat/lib/__tests__/messageActionLayout.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/modules/atlas.chat/lib/__tests__/messageActionLayout.test.js`:

```javascript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeActionSheetLayout } from "../messageActionLayout.js";

const base = {
  vw: 390,
  vh: 844,
  pillSize: { width: 220, height: 44 },
  panelSize: { width: 240, height: 300 },
  safeTop: 59,
  safeBottom: 34,
  gap: 8,
  margin: 8,
};

describe("computeActionSheetLayout — touch", () => {
  it("keeps the pill below the top safe inset for a message near the top", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: false,
      anchorPoint: null,
      rect: { top: 20, bottom: 70, left: 12, right: 300 },
    });
    assert.ok(out.pillTop >= base.margin + base.safeTop - 0.5, `pillTop ${out.pillTop}`);
    assert.ok(out.sRect.top >= base.margin + base.safeTop - 0.5, `sRect.top ${out.sRect.top}`);
    assert.ok(out.shiftY > 0, `expected downward shift, got ${out.shiftY}`);
  });

  it("keeps the card above the bottom safe inset for a message near the bottom", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: true,
      anchorPoint: null,
      rect: { top: 780, bottom: 830, left: 90, right: 378 },
    });
    assert.ok(out.panelTop + base.panelSize.height <= base.vh - base.margin - base.safeBottom + 0.5,
      `card bottom ${out.panelTop + base.panelSize.height} vs ${base.vh - base.margin - base.safeBottom}`);
    assert.ok(out.shiftY < 0, `expected upward shift, got ${out.shiftY}`);
  });

  it("does not shift a comfortably centered message that already fits", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: false,
      anchorPoint: null,
      rect: { top: 380, bottom: 430, left: 12, right: 300 },
    });
    assert.equal(out.shiftY, 0);
  });

  it("right-aligns the pill and panel for an own message", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: true,
      anchorPoint: null,
      rect: { top: 380, bottom: 430, left: 120, right: 378 },
    });
    // own → hug the right edge of the bubble
    assert.ok(out.panelLeft + base.panelSize.width <= 378 + 0.5);
  });
});

describe("computeActionSheetLayout — mouse", () => {
  it("anchors to the cursor point and never shifts", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: false,
      isOwn: true,
      anchorPoint: { x: 200, y: 400 },
      rect: { top: 380, bottom: 430, left: 120, right: 378 },
    });
    assert.equal(out.shiftY, 0);
    assert.ok(out.panelLeft >= base.margin);
    assert.ok(out.panelLeft <= base.vw - base.panelSize.width - base.margin);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/messageActionLayout.test.js`
Expected: FAIL — `Cannot find module '../messageActionLayout.js'`.

- [ ] **Step 3: Implement the helper**

Create `apps/desktop/src/modules/atlas.chat/lib/messageActionLayout.js`:

```javascript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/messageActionLayout.test.js`
Expected: PASS — all six cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/lib/messageActionLayout.js apps/desktop/src/modules/atlas.chat/lib/__tests__/messageActionLayout.test.js
git commit -m "feat(chat): computeActionSheetLayout — safe-area + bubble-shift positioning helper"
```

---

### Task 3: `MessageActionSheet` — use the helper, add tap-dismiss over the bubble, report shiftY

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageActionSheet.jsx`

- [ ] **Step 1: Import the helper and accept `onBubbleShift`**

Add to the imports:

```javascript
import { computeActionSheetLayout } from "../lib/messageActionLayout";
```

Add `onBubbleShift` to the destructured props (after `onOpenFullPicker`):

```javascript
  onOpenFullPicker,   // () => void
  onBubbleShift,      // (dy:number) => void — ChatMessageBubble translates the row
```

- [ ] **Step 2: Replace the positioning `useLayoutEffect` body**

Replace the entire `useLayoutEffect(() => { ... }, [...])` block with:

```javascript
  useLayoutEffect(() => {
    if (!open) { setPos(null); onBubbleShift?.(0); return; }
    const panel = panelRef.current;
    const pill = pillRef.current;
    if (!panel || !pill) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(rootStyle.getPropertyValue("--safe-top")) || 0;
    const safeBottom = parseFloat(rootStyle.getPropertyValue("--safe-bottom")) || 0;

    const pr = panel.getBoundingClientRect();
    const plr = pill.getBoundingClientRect();

    const layout = computeActionSheetLayout({
      vw: window.innerWidth,
      vh: window.innerHeight,
      rect: anchorRect ?? null,
      anchorPoint: (!coarse && anchorPoint) ? anchorPoint : null,
      pillSize: { width: plr.width, height: plr.height },
      panelSize: { width: pr.width, height: pr.height },
      coarse,
      isOwn,
      safeTop,
      safeBottom,
      gap: 8,
      margin: 8,
    });

    setPos({
      panelLeft: layout.panelLeft,
      panelTop: layout.panelTop,
      pillLeft: layout.pillLeft,
      pillTop: layout.pillTop,
      sRect: layout.sRect,
    });
    onBubbleShift?.(layout.shiftY);
  }, [open, anchorRect, anchorPoint, isOwn, coarse, attachmentActions.length, primary.length, danger.length, onBubbleShift]);
```

- [ ] **Step 3: Draw the scrims + dismiss button from the shifted rect**

In the returned JSX, the touch dismiss layer currently reads `const r = anchorRect;` and builds four scrim buttons from `r`. Change it to use the shifted rect and add a fifth transparent dismiss button over the window. Replace:

```javascript
  const r = anchorRect;
  const scrim = "bg-black/55 backdrop-blur-[3px]";
```

with:

```javascript
  const r = pos?.sRect ?? anchorRect;
  const scrim = "bg-black/55 backdrop-blur-[3px]";
```

Then, inside `{coarse && r ? ( <> ... </> ) : ( ... )}`, add as the **first** child of the fragment (before the four scrim buttons):

```javascript
          {/* Transparent catcher over the spotlighted bubble — WhatsApp
              dismisses on a tap anywhere that isn't an action. */}
          <button type="button" aria-label="Cerrar" onClick={close}
            className="absolute"
            style={{ top: r.top, left: r.left, width: Math.max(0, r.right - r.left), height: Math.max(0, r.bottom - r.top) }} />
```

- [ ] **Step 4: Guard the pill/card taps against the new catcher**

The pill and card are siblings rendered *after* the dismiss layer, so they already paint on top. Confirm their buttons call their handlers (they do) — no change needed. The container `<div data-msg-action-menu className="fixed inset-0 z-200">` already scopes everything.

- [ ] **Step 5: Syntax check**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/MessageActionSheet.jsx`
Expected: parses (JSX may make `node --check` complain; if so rely on Step 7 build).

- [ ] **Step 6: Lint**

Run: `npx eslint apps/desktop/src/modules/atlas.chat/components/MessageActionSheet.jsx`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageActionSheet.jsx
git commit -m "feat(chat): action sheet respects safe area, shifts the bubble, dismisses on bubble tap"
```

---

### Task 4: `ChatMessageBubble` — translate the row by `shiftY`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

- [ ] **Step 1: Add state**

Next to `const [reactionPickerOpen, setReactionPickerOpen] = useState(false);` (~line 265):

```javascript
  const [bubbleShiftY, setBubbleShiftY] = useState(0);
```

- [ ] **Step 2: Wire `onBubbleShift` into both `MessageActionSheet` usages**

Both `<MessageActionSheet ... />` (the `isOwn` branch ~line 589 and the received branch ~line 771) get one extra prop:

```javascript
          onBubbleShift={setBubbleShiftY}
```

- [ ] **Step 3: Apply the transform to both message-row `<div>`s**

The `isOwn` branch row `<div data-msg-id={message.id} ... className={[ "group/msg chat-msg-row relative flex justify-end ...` and the received branch's equivalent row `<div>` each get:

```javascript
        style={{
          transform: bubbleShiftY ? `translateY(${bubbleShiftY}px)` : undefined,
          willChange: bubbleShiftY ? "transform" : undefined,
        }}
```

(If a row already has a `style` prop, merge these keys into it.)

- [ ] **Step 4: Build the web app**

Run: `pnpm --filter @atlas/desktop build`
Expected: Vite build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "feat(chat): message row follows the action sheet's safe-area shift"
```

---

### Task 5: `MessageReactionPicker` — bottom sheet on touch

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageReactionPicker.jsx`

- [ ] **Step 1: Rewrite the component with a `coarse` branch**

Replace the whole file body of `MessageReactionPicker.jsx` with:

```javascript
import { Popover, PopoverAnchor, PopoverContent, Sheet, SheetContent, SheetHeader, SheetTitle, useCoarsePointer } from "@atlas/ui";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";

// The full emoji picker for choosing a reaction outside the quick set. On a
// coarse pointer (phone) it opens as a bottom Sheet — WhatsApp-style, and the
// same pattern MessageComposer.jsx already uses for its own "+" — because a
// body-portaled Popover anchored to a bubble mispositions on small viewports
// (spilled off the top / behind the status bar). On desktop it stays a Radix
// Popover anchored beside the bubble.
//
// Opened externally (from the "+" in MessageActionSheet's quick-reaction pill),
// so `children` is the bubble-column element the desktop popover anchors to and
// must always render in place. `onPick(emoji)` receives the plain character.
const PICKER_PROPS = {
  theme: "dark",
  emojiStyle: EmojiStyle.NATIVE,
  searchPlaceholder: "Buscar emoji...",
  lazyLoadEmojis: true,
  skinTonesDisabled: true,
  autoFocusSearch: false,
};

export function MessageReactionPicker({ open, onOpenChange, onPick, anchorAlign = "start", children }) {
  const coarse = useCoarsePointer();

  if (coarse) {
    return (
      <>
        {children}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="p-0 gap-0" style={{ zIndex: 10001 }}>
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle>Reaccionar</SheetTitle>
            </SheetHeader>
            <div className="px-2 pb-2">
              <EmojiPicker
                {...PICKER_PROPS}
                onEmojiClick={(d) => { onPick(d.emoji); onOpenChange(false); }}
                width="100%"
                height="min(48vh, 400px)"
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side={anchorAlign === "end" ? "left" : "right"}
        align="start"
        sideOffset={8}
        collisionPadding={8}
        className="w-auto p-0 overflow-hidden pointer-events-auto"
        style={{ zIndex: 10001 }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <EmojiPicker
          {...PICKER_PROPS}
          onEmojiClick={(emojiData) => { onPick(emojiData.emoji); onOpenChange(false); }}
          width="min(92vw, 300px)"
          height="min(60vh, 320px)"
        />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Confirm the `@atlas/ui` names exist**

Run: `grep -nE "\b(Sheet|SheetContent|SheetHeader|SheetTitle|useCoarsePointer)\b" packages/ui/src/index.js`
Expected: every imported name is exported.

- [ ] **Step 3: Build the web app**

Run: `pnpm --filter @atlas/desktop build`
Expected: Vite build completes with no errors.

- [ ] **Step 4: Lint**

Run: `npx eslint apps/desktop/src/modules/atlas.chat/components/MessageReactionPicker.jsx`
Expected: no errors.

- [ ] **Step 5: Run the chat lib tests**

Run: `node --test apps/desktop/src/modules/atlas.chat/lib/__tests__/*.test.js`
Expected: PASS — includes `messageActionLayout.test.js`.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageReactionPicker.jsx
git commit -m "feat(chat): reaction picker opens as a bottom sheet on touch"
```

---

## Self-Review

**Spec coverage:**
- Fix 1 (bottom sheet on touch, Popover on desktop) → Task 5. ✓
- Fix 2 (tap the bubble window dismisses) → Task 3 Step 3. ✓
- Fix 3a (safe-area vars + margins) → Task 1 + Task 2 helper (`mTop`/`mBottom`). ✓
- Fix 3b (compute `shiftY`, position from shifted rect) → Task 2 + Task 3 Step 2/3. ✓
- Fix 3c (bubble `translateY`) → Task 4. ✓
- Testing (pure helper: pill below top inset, card above bottom inset, no shift when it fits, own right-align, mouse anchors to point) → Task 2 Step 1. ✓

**Placeholder scan:** none — every step has the literal code or an exact command.

**Type consistency:**
- `computeActionSheetLayout({ vw, vh, rect, anchorPoint, pillSize:{width,height}, panelSize:{width,height}, coarse, isOwn, safeTop, safeBottom, gap, margin })` → `{ panelLeft, panelTop, pillLeft, pillTop, shiftY, sRect:{top,bottom,left,right} }` — identical in helper, tests, and the `MessageActionSheet` call site.
- `pos` object gains `sRect`, drops nothing; scrims read `pos?.sRect ?? anchorRect`.
- `onBubbleShift(dy:number)` — `MessageActionSheet` prop, called with `layout.shiftY` and `0`; `ChatMessageBubble` passes `setBubbleShiftY`.
- `MessageReactionPicker` public props unchanged (`open`, `onOpenChange`, `onPick`, `anchorAlign`, `children`).

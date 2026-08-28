# Chat Reply-to-Message + Mobile Gestures — Plan B (UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every chat message a reachable-on-touch action surface (long-press sheet, swipe-to-reply, double-tap react, desktop right-click) and a WhatsApp-style inline quoted reply that works in DMs, groups and channels across `ChatWindow`, `MiniChatWindow` and `ThreadPanel`.

**Architecture:** Two generic gesture hooks land in `@atlas/ui`. `ChatMessageBubble.jsx` is first slimmed by extracting attachment rendering to `MessageAttachments.jsx` (mandated by CLAUDE.md — the file is 1367 lines). A shared `useMessageActions` descriptor feeds both the existing desktop hover `MessageActions` and a new `MessageActionSheet` (bottom `Sheet` on mobile, `DropdownMenu` on desktop right-click). `MessageQuote.jsx` renders the quote inline (inside the bubble) and in compose (above the composer). `replyingTo` state is owned per conversation view. Jump-to-quote reuses the existing `scrollToMessage={{id,nonce}}` prop on `ChatMessageList`, extended with a flash highlight and load-older-until-found.

**Tech Stack:** React 18, Vite, Tailwind, `@atlas/ui` (Radix), `@tanstack/react-query`, `lucide-react`, `node --test`.

**Depends on:** Plan A merged. The frozen contract:
```jsonc
message.reply_to = null | { id, senderUserId, senderName, bodyPreview, kind, isDeleted }
// kind ∈ "text"|"image"|"video"|"audio"|"file"|"entity"|"deleted"
// send payload accepts optional replyToMessageId: uuid
// realtime "chat.message.new" payload now carries replyToMessageId
```

**Reference before starting:**
- `CLAUDE.md` — UI-first policy (never native `<select>`/dialogs; use `@atlas/ui`), no emojis in UI, all UI text in Spanish, 1000-line file limit, `feedback_responsive_qa` (screenshot 390px AND 1440px).
- `docs/ai-context/ame3-runtime-capabilities.md` — where new `@atlas/ui` exports get documented.
- `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` — `MessageActions` (~L770), own-branch render (~L1036), received-branch render (~L1203), attachment sub-components (L26–731).
- `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx` — `scrollToMessage` effect (~L162), `handleLoadMore` (~L254).
- `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx` — `forwardRef` signature (~L176), `handleSend` payload (~L451-492).
- `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` — `handleSend` (~L473), `<ChatMessageList>` (~L828), `<MessageComposer>` (~L867), `jumpTarget`/`setJumpTarget` (~L420).
- `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` — `useSendMessage` optimistic builder (~L168-232).
- `packages/ui/src/hooks/useDragToDismiss.js` + `useIsMobile.js` — the pointer-gesture + breakpoint precedents to mirror.
- `packages/ui/src/index.js` — export lists; `Sheet` at L155, `DropdownMenu` at L93, hook exports at L213.
- `apps/desktop/src/modules/atlas.chat/components/MessageReactionPicker.jsx` — the externally-opened Radix overlay pattern.

---

## Task 1: `useLongPress` hook in `@atlas/ui` (TDD)

**Files:**
- Create: `packages/ui/src/hooks/useLongPress.js`
- Create: `packages/ui/src/hooks/__tests__/useLongPress.test.js`
- Modify: `packages/ui/src/index.js`

- [ ] **Step 1: Write the failing test**

```js
// packages/ui/src/hooks/__tests__/useLongPress.test.js
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createLongPressController } from "../useLongPress.js";

// The hook is a thin React wrapper around this pure controller so the timing
// logic is testable without a DOM/renderer.
describe("createLongPressController", () => {
  it("fires onLongPress after the delay when the pointer does not move", () => {
    let fired = 0;
    const now = { t: 0 };
    const ctrl = createLongPressController({
      delay: 450, moveTolerance: 10,
      onLongPress: () => { fired++; },
      schedule: (fn, ms) => { ctrl._pending = { fn, at: now.t + ms }; return 1; },
      cancelScheduled: () => { ctrl._pending = null; },
    });
    ctrl.onPointerDown({ clientX: 0, clientY: 0, target: document.createElement("div") });
    now.t = 450; ctrl._pending?.fn();
    assert.equal(fired, 1);
  });

  it("cancels when the pointer moves beyond moveTolerance", () => {
    let fired = 0;
    const ctrl = createLongPressController({
      delay: 450, moveTolerance: 10,
      onLongPress: () => { fired++; },
      schedule: (fn) => { ctrl._pending = { fn }; return 1; },
      cancelScheduled: () => { ctrl._pending = null; },
    });
    ctrl.onPointerDown({ clientX: 0, clientY: 0, target: document.createElement("div") });
    ctrl.onPointerMove({ clientX: 40, clientY: 0 });
    assert.equal(ctrl._pending, null);
    ctrl._pending?.fn?.();
    assert.equal(fired, 0);
  });

  it("cancels on pointerup before the delay elapses", () => {
    let fired = 0;
    const ctrl = createLongPressController({
      delay: 450, moveTolerance: 10,
      onLongPress: () => { fired++; },
      schedule: (fn) => { ctrl._pending = { fn }; return 1; },
      cancelScheduled: () => { ctrl._pending = null; },
    });
    ctrl.onPointerDown({ clientX: 0, clientY: 0, target: document.createElement("div") });
    ctrl.onPointerUp();
    assert.equal(ctrl._pending, null);
  });

  it("does not start on an interactive target (a/button/img/video/input)", () => {
    const ctrl = createLongPressController({
      delay: 450, moveTolerance: 10, onLongPress: () => {},
      schedule: (fn) => { ctrl._pending = { fn }; return 1; },
      cancelScheduled: () => { ctrl._pending = null; },
    });
    const a = document.createElement("a");
    ctrl.onPointerDown({ clientX: 0, clientY: 0, target: a });
    assert.equal(ctrl._pending, null);
  });
});
```

Note: `node --test` has no DOM. Add `--experimental-test-module-mocks` is not needed; instead the test uses `document.createElement` which is absent in plain node. **Guard:** at the top of the test file add a minimal shim:
```js
if (typeof document === "undefined") {
  globalThis.document = { createElement: (tag) => ({ tagName: tag.toUpperCase(), closest(sel){ return sel.toLowerCase().includes(this.tagName.toLowerCase()) ? this : null; } }) };
}
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test packages/ui/src/hooks/__tests__/useLongPress.test.js`
Expected: FAIL — `Cannot find module '../useLongPress.js'`.

- [ ] **Step 3: Implement**

```js
// packages/ui/src/hooks/useLongPress.js
import { useMemo, useRef } from "react";

const INTERACTIVE = "a,button,img,video,input,textarea,select,label,[role=button]";

// Pure, injectable controller — the React hook below is a thin adapter so the
// timing rules stay unit-testable without a renderer.
export function createLongPressController({
  delay = 450,
  moveTolerance = 10,
  onLongPress,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancelScheduled = (id) => clearTimeout(id),
  vibrate = (ms) => { try { navigator?.vibrate?.(ms); } catch { /* unsupported */ } },
} = {}) {
  let timer = null;
  let start = null;

  function clear() {
    if (timer != null) cancelScheduled(timer);
    timer = null;
    start = null;
  }

  return {
    get _pending() { return timer == null ? null : this.__p; },
    set _pending(v) { this.__p = v; if (v == null) timer = null; },
    onPointerDown(e) {
      if (e?.target?.closest?.(INTERACTIVE)) return;
      start = { x: e.clientX, y: e.clientY };
      timer = schedule(() => {
        vibrate(10);
        onLongPress?.(e);
        clear();
      }, delay);
      this.__p = { fn: () => { vibrate(10); onLongPress?.(e); clear(); } };
    },
    onPointerMove(e) {
      if (start == null) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > moveTolerance || dy > moveTolerance) { clear(); this.__p = null; }
    },
    onPointerUp() { clear(); this.__p = null; },
    onPointerCancel() { clear(); this.__p = null; },
  };
}

export function useLongPress({ onLongPress, delay = 450, moveTolerance = 10, disabled = false } = {}) {
  const ref = useRef();
  ref.current = onLongPress;
  return useMemo(() => {
    if (disabled) return {};
    const ctrl = createLongPressController({
      delay, moveTolerance,
      onLongPress: (e) => ref.current?.(e),
    });
    return {
      onPointerDown: (e) => ctrl.onPointerDown(e),
      onPointerMove: (e) => ctrl.onPointerMove(e),
      onPointerUp: () => ctrl.onPointerUp(),
      onPointerCancel: () => ctrl.onPointerCancel(),
      onContextMenu: (e) => { /* native long-press on some mobile browsers raises contextmenu */ e.preventDefault(); },
    };
  }, [delay, moveTolerance, disabled]);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test packages/ui/src/hooks/__tests__/useLongPress.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Export from `@atlas/ui`**

In `packages/ui/src/index.js` near L213 (with the other hook exports):
```js
export { useLongPress } from "./hooks/useLongPress.js";
```

- [ ] **Step 6: Syntax check + commit**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check packages/ui/src/hooks/useLongPress.js && node --check packages/ui/src/index.js`
Expected: PASS.

```bash
git add packages/ui/src/hooks/useLongPress.js packages/ui/src/hooks/__tests__/useLongPress.test.js packages/ui/src/index.js
git commit -m "feat(ui): useLongPress gesture hook"
```

---

## Task 2: `useSwipeToReply` hook in `@atlas/ui` (TDD)

**Files:**
- Create: `packages/ui/src/hooks/useSwipeToReply.js`
- Create: `packages/ui/src/hooks/__tests__/useSwipeToReply.test.js`
- Modify: `packages/ui/src/index.js`

- [ ] **Step 1: Write the failing test**

```js
// packages/ui/src/hooks/__tests__/useSwipeToReply.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSwipeController } from "../useSwipeToReply.js";

function drag(ctrl, points) {
  ctrl.onPointerDown({ clientX: points[0][0], clientY: points[0][1], pointerId: 1, currentTarget: { setPointerCapture(){}, releasePointerCapture(){} } });
  for (const [x, y] of points.slice(1)) ctrl.onPointerMove({ clientX: x, clientY: y });
  ctrl.onPointerUp();
}

describe("createSwipeController", () => {
  it("fires onReply for a right swipe past threshold (direction=right)", () => {
    let fired = 0;
    const ctrl = createSwipeController({ threshold: 64, direction: "right", onReply: () => fired++, onTranslate: () => {} });
    drag(ctrl, [[0, 0], [30, 2], [80, 4]]);
    assert.equal(fired, 1);
  });

  it("does not fire for a right swipe that never reaches threshold", () => {
    let fired = 0;
    const ctrl = createSwipeController({ threshold: 64, direction: "right", onReply: () => fired++, onTranslate: () => {} });
    drag(ctrl, [[0, 0], [20, 0], [40, 0]]);
    assert.equal(fired, 0);
  });

  it("ignores a mostly-vertical drag (scroll intent)", () => {
    let fired = 0;
    const translates = [];
    const ctrl = createSwipeController({ threshold: 64, direction: "right", onReply: () => fired++, onTranslate: (v) => translates.push(v) });
    drag(ctrl, [[0, 0], [10, 40], [20, 120]]);
    assert.equal(fired, 0);
    assert.ok(translates.every((v) => v === 0), "no horizontal translate on vertical intent");
  });

  it("respects direction=left (own messages): right drag never fires", () => {
    let fired = 0;
    const ctrl = createSwipeController({ threshold: 64, direction: "left", onReply: () => fired++, onTranslate: () => {} });
    drag(ctrl, [[100, 0], [140, 0], [180, 0]]);
    assert.equal(fired, 0);
  });

  it("direction=left fires on a left drag past threshold", () => {
    let fired = 0;
    const ctrl = createSwipeController({ threshold: 64, direction: "left", onReply: () => fired++, onTranslate: () => {} });
    drag(ctrl, [[200, 0], [160, 0], [120, 0]]);
    assert.equal(fired, 1);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test packages/ui/src/hooks/__tests__/useSwipeToReply.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```js
// packages/ui/src/hooks/useSwipeToReply.js
import { useMemo, useRef, useState } from "react";

const H_RATIO = 1.5;      // |dx| must exceed |dy|*H_RATIO to count as horizontal
const MAX_TRANSLATE = 96;  // rubber-band cap

export function createSwipeController({ threshold = 64, direction = "right", onReply, onTranslate } = {}) {
  let start = null;
  let horizontal = false;
  let engaged = false;

  const sign = direction === "left" ? -1 : 1;

  function reset() {
    start = null; horizontal = false; engaged = false;
    onTranslate?.(0);
  }

  return {
    onPointerDown(e) {
      start = { x: e.clientX, y: e.clientY };
      horizontal = false; engaged = false;
      try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    },
    onPointerMove(e) {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!horizontal && Math.abs(dx) > 6) {
        horizontal = Math.abs(dx) > Math.abs(dy) * H_RATIO;
        if (!horizontal) { start = null; return; } // vertical -> yield to scroll
      }
      if (!horizontal) return;
      const projected = dx * sign;               // positive when swiping the intended way
      if (projected <= 0) { onTranslate?.(0); return; }
      const clamped = Math.min(projected, MAX_TRANSLATE);
      engaged = projected >= threshold;
      onTranslate?.(clamped * sign);
    },
    onPointerUp() {
      if (engaged) onReply?.();
      reset();
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
      threshold, direction,
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
```

- [ ] **Step 4: Run, verify pass**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test packages/ui/src/hooks/__tests__/useSwipeToReply.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Export**

`packages/ui/src/index.js`:
```js
export { useSwipeToReply } from "./hooks/useSwipeToReply.js";
```

- [ ] **Step 6: Syntax check + commit**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check packages/ui/src/hooks/useSwipeToReply.js`
```bash
git add packages/ui/src/hooks/useSwipeToReply.js packages/ui/src/hooks/__tests__/useSwipeToReply.test.js packages/ui/src/index.js
git commit -m "feat(ui): useSwipeToReply gesture hook"
```

---

## Task 3: Extract `MessageAttachments.jsx` from `ChatMessageBubble.jsx` (mandated refactor, no behavior change)

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

- [ ] **Step 1: Move the attachment block**

Cut from `ChatMessageBubble.jsx` lines ~23–731 these units and paste into the new file: `isVideoMime`, `isAudioMime`, `getFileTypeInfo`, `useAttachmentUrl`, `AttachmentTileActions`, `AttachmentReactionPills`, `ImageCard`, `VideoCard`, `AudioCard`, `AUDIO_SPEEDS`, `fmtAudioTime`, `seedBars`, `FileCard`, `ImageCoverCell`, `ImageGrid`, `AttachmentsBlock`.

New file header:
```js
// apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, Download, Play, Pause, Mic,
  FileText, FileType2, FileSpreadsheet, FileImage, FileVideo, FileAudio,
  FileArchive, FileCode, File, Trash2, Smile,
} from "lucide-react";
import { ConfirmDialog } from "@atlas/ui";
import { formatFileSize, isImageMime } from "../lib/chatUtils";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";
import { MessageReactionPicker } from "./MessageReactionPicker";
import { isSignedUrlUsable } from "../lib/signedUrl";

// ...pasted units...

export { AttachmentsBlock };
```

- [ ] **Step 2: Import it back into `ChatMessageBubble.jsx`**

Add:
```js
import { AttachmentsBlock } from "./MessageAttachments";
```
Remove now-unused imports from `ChatMessageBubble.jsx` (`Download`, `Play`, `Pause`, `Mic`, `FileType2`, `FileSpreadsheet`, `FileImage`, `FileVideo`, `FileAudio`, `FileArchive`, `FileCode`, `File`, `useQuery`, `atlas` if unused elsewhere, `isSignedUrlUsable`, `isImageMime` if unused). Keep `useState`, `useRef`, `useEffect`, `useMemo` (still used by the bubble) — verify with a grep after.

- [ ] **Step 3: Verify no dangling references**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx && node --check apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`
Expected: PASS.

Run: `cd d:/RacoonDevs/atlaserp-v2 && pnpm --filter @atlas/desktop lint 2>&1 | grep -i "no-unused\|is not defined\|ChatMessageBubble\|MessageAttachments" || echo "clean"`
Expected: `clean` (or only pre-existing warnings).

- [ ] **Step 4: Build the desktop app to catch bundler-level breakage**

Run: `cd d:/RacoonDevs/atlaserp-v2 && pnpm --filter @atlas/desktop build`
Expected: build succeeds.

- [ ] **Step 5: Line counts**

Run: `cd d:/RacoonDevs/atlaserp-v2 && wc -l apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx`
Expected: `ChatMessageBubble.jsx` ≈ 640–680; `MessageAttachments.jsx` ≈ 700.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "refactor(chat): extract attachment rendering into MessageAttachments.jsx"
```

---

## Task 4: `MessageQuote.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/MessageQuote.jsx`

- [ ] **Step 1: Implement**

```jsx
// apps/desktop/src/modules/atlas.chat/components/MessageQuote.jsx
import { X, Image, Video, Mic, FileText, Link2, CornerUpLeft } from "lucide-react";

const KIND_LABEL = {
  image: "Foto",
  video: "Video",
  audio: "Nota de voz",
  file: "Archivo",
  entity: "Referencia",
};
const KIND_ICON = { image: Image, video: Video, audio: Mic, file: FileText, entity: Link2 };

// The quoted-message chip. `variant="inline"` renders inside a bubble above the
// body (tap jumps to the original). `variant="compose"` renders above the
// composer with a cancel button. `reply` is the Plan A preview object.
export function MessageQuote({ reply, variant = "inline", isOwn = false, onJump, onCancel }) {
  if (!reply) return null;

  const accent = isOwn ? "rgba(255,255,255,0.6)" : "var(--brand-primary)";
  const Icon = KIND_ICON[reply.kind];
  const label = reply.isDeleted
    ? "Mensaje eliminado"
    : reply.bodyPreview || KIND_LABEL[reply.kind] || "Mensaje";

  const body = (
    <div
      className={[
        "flex flex-col gap-0.5 pl-2 pr-2 py-1 rounded-md min-w-0 text-left",
        isOwn ? "bg-white/10" : "bg-black/5 dark:bg-white/5",
      ].join(" ")}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <span className="text-[11px] font-semibold truncate" style={{ color: accent }}>
        {reply.senderName}
      </span>
      <span
        className={[
          "text-xs truncate flex items-center gap-1",
          reply.isDeleted ? "italic opacity-60" : "opacity-80",
        ].join(" ")}
      >
        {Icon && !reply.bodyPreview && <Icon className="h-3 w-3 shrink-0" />}
        {label}
      </span>
    </div>
  );

  if (variant === "compose") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(var(--border))]">
        <CornerUpLeft className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <div className="min-w-0 flex-1">{body}</div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar respuesta"
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={reply.isDeleted ? undefined : () => onJump?.(reply.id)}
      className={[
        "w-full mb-1 block",
        reply.isDeleted ? "cursor-default" : "cursor-pointer hover:opacity-90",
      ].join(" ")}
    >
      {body}
    </button>
  );
}
```

- [ ] **Step 2: Syntax check + commit**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/desktop/src/modules/atlas.chat/components/MessageQuote.jsx`
```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageQuote.jsx
git commit -m "feat(chat): MessageQuote chip (inline + compose variants)"
```

---

## Task 5: `useMessageActions` shared descriptor + refactor `MessageActions`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/lib/messageActions.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` (`MessageActions` uses the descriptor)

- [ ] **Step 1: Create the descriptor factory**

```jsx
// apps/desktop/src/modules/atlas.chat/lib/messageActions.jsx
import { Copy, Share2, CheckSquare, Pin, PinOff, Smile, MessageSquare, Trash2, EyeOff, CornerUpLeft } from "lucide-react";

// Single source of truth for the per-message action list. Consumed by the
// desktop hover menu (MessageActions in ChatMessageBubble) and the mobile /
// right-click MessageActionSheet. Each entry: { key, label, icon, onSelect,
// danger?, group } — `group` is "primary" | "danger" for separator placement.
export function buildMessageActions({
  hasBody, isOwn, canPin, isPinned, canReply,
  onReply, onCopy, onForward, onEnterSelection, onPin, onReact, onOpenThread,
  onDelete, onHideForMe,
}) {
  const items = [];
  if (onReply) items.push({ key: "reply", label: "Responder", icon: CornerUpLeft, onSelect: onReply, group: "primary" });
  if (hasBody && onCopy) items.push({ key: "copy", label: "Copiar", icon: Copy, onSelect: onCopy, group: "primary" });
  if (onForward) items.push({ key: "forward", label: "Reenviar", icon: Share2, onSelect: onForward, group: "primary" });
  if (onEnterSelection) items.push({ key: "select", label: "Seleccionar", icon: CheckSquare, onSelect: onEnterSelection, group: "primary" });
  if (canPin && onPin) items.push({ key: "pin", label: isPinned ? "Desfijar mensaje" : "Fijar mensaje", icon: isPinned ? PinOff : Pin, onSelect: onPin, group: "primary" });
  if (onReact) items.push({ key: "react", label: "Reaccionar", icon: Smile, onSelect: onReact, group: "primary" });
  if (canReply && onOpenThread) items.push({ key: "thread", label: "Responder en hilo", icon: MessageSquare, onSelect: onOpenThread, group: "primary" });
  if (isOwn && onDelete) items.push({ key: "delete", label: "Eliminar para todos", icon: Trash2, onSelect: onDelete, danger: true, group: "danger" });
  if (onHideForMe) items.push({ key: "hide", label: "Eliminar para mi", icon: EyeOff, onSelect: onHideForMe, group: "danger" });
  return items;
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
```

- [ ] **Step 2: Refactor `MessageActions` in `ChatMessageBubble.jsx` to render from the descriptor**

Replace the hand-written `DropdownMenuItem` list inside `MessageActions` with a `.map` over `buildMessageActions(...)`, preserving the current `onReact` `requestAnimationFrame` deferral for the `"react"` key and the `DropdownMenuSeparator` between `group: "primary"` and `group: "danger"`. Keep the hover-visible quick-react `<Smile>` button and the `MoreHorizontal` trigger exactly as they are. New prop on `MessageActions`: `onReply`.

```jsx
import { buildMessageActions } from "../lib/messageActions";
// inside MessageActions:
const actions = buildMessageActions({
  hasBody, isOwn, canPin, isPinned, canReply,
  onReply, onCopy, onForward, onEnterSelection, onPin,
  onReact, onOpenThread, onDelete, onHideForMe,
});
const primary = actions.filter((a) => a.group === "primary");
const danger = actions.filter((a) => a.group === "danger");
// render:
// {primary.map(a => <DropdownMenuItem key={a.key} onSelect={a.key === "react" ? () => requestAnimationFrame(a.onSelect) : a.onSelect}><a.icon className="h-3.5 w-3.5 mr-2" />{a.label}</DropdownMenuItem>)}
// {primary.length && danger.length ? <DropdownMenuSeparator/> : null}
// {danger.map(a => <DropdownMenuItem key={a.key} onSelect={a.onSelect} className={a.danger ? "text-red-500 focus:text-red-500" : undefined}><a.icon className="h-3.5 w-3.5 mr-2" />{a.label}</DropdownMenuItem>)}
```

- [ ] **Step 3: Thread `onReply` through from `ChatMessageList`**

`ChatMessageList.jsx` — add prop `onReplyToMessage`; in the bubble render (~L376) add:
```jsx
onReply={!isDeleted && !isPending && onReplyToMessage ? () => onReplyToMessage(item) : undefined}
```
`ChatMessageBubble` — add `onReply` to props and pass to both `<MessageActions onReply={onReply} ... />` call sites (~L1057 and ~L1349).

- [ ] **Step 4: Syntax check + build**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/desktop/src/modules/atlas.chat/lib/messageActions.jsx && node --check apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx && pnpm --filter @atlas/desktop build`
Expected: PASS + build OK. Desktop hover menu now shows "Responder" at the top; everything else unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/lib/messageActions.jsx apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx
git commit -m "feat(chat): shared message-action descriptor; add Responder to the menu"
```

---

## Task 6: `MessageActionSheet.jsx` (mobile bottom sheet + desktop right-click menu)

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/MessageActionSheet.jsx`

- [ ] **Step 1: Implement**

```jsx
// apps/desktop/src/modules/atlas.chat/components/MessageActionSheet.jsx
import { useState } from "react";
import {
  Sheet, SheetContent,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  useIsMobile,
} from "@atlas/ui";
import { Plus } from "lucide-react";
import { buildMessageActions, QUICK_REACTIONS } from "../lib/messageActions";
import { MessageReactionPicker } from "./MessageReactionPicker";

// Unified action surface. Mobile: bottom Sheet raised by long-press. Desktop:
// DropdownMenu at the cursor, raised by right-click. Both render the same
// quick-reaction row + buildMessageActions() list.
export function MessageActionSheet({
  open, onOpenChange, anchorPoint, // {x,y} for desktop right-click; null on mobile
  actionProps,                     // args for buildMessageActions (minus onReact)
  onQuickReact,                    // (emoji) => void
  onOpenFullPicker,                // () => void
}) {
  const isMobile = useIsMobile();
  const actions = buildMessageActions({ ...actionProps, onReact: undefined }); // react handled by the row
  const primary = actions.filter((a) => a.group === "primary");
  const danger = actions.filter((a) => a.group === "danger");

  const reactionRow = (
    <div className="flex items-center justify-between gap-1 px-2 py-2">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onQuickReact?.(emoji); onOpenChange(false); }}
          className="h-10 w-10 rounded-full flex items-center justify-center text-xl hover:bg-[hsl(var(--muted))] active:scale-90 transition"
        >
          {emoji}
        </button>
      ))}
      <button
        type="button"
        onClick={() => { onOpenChange(false); onOpenFullPicker?.(); }}
        aria-label="Mas emojis"
        className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );

  const actionList = (Item) => (
    <>
      {primary.map((a) => (
        <Item key={a.key} onSelect={() => { a.onSelect?.(); onOpenChange(false); }}>
          <a.icon className="h-4 w-4 mr-3" />{a.label}
        </Item>
      ))}
      {primary.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
      {danger.map((a) => (
        <Item key={a.key} onSelect={() => { a.onSelect?.(); onOpenChange(false); }}
          className={a.danger ? "text-red-500 focus:text-red-500" : undefined}>
          <a.icon className="h-4 w-4 mr-3" />{a.label}
        </Item>
      ))}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="chat-glass-theme p-0 pb-[env(safe-area-inset-bottom)] rounded-t-2xl">
          {reactionRow}
          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="py-1">
            {actionList(({ children, onSelect, className }) => (
              <button
                type="button"
                onClick={onSelect}
                className={["w-full flex items-center px-4 py-3 text-sm text-left hover:bg-[hsl(var(--muted))]", className].filter(Boolean).join(" ")}
              >
                {children}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop right-click: anchor a DropdownMenu at the cursor via a fixed 0-size trigger.
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <span style={{ position: "fixed", left: anchorPoint?.x ?? 0, top: anchorPoint?.y ?? 0, width: 0, height: 0 }} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" style={{ zIndex: 10000 }} onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center gap-0.5 px-1 py-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} type="button"
              onClick={() => { onQuickReact?.(emoji); onOpenChange(false); }}
              className="h-7 w-7 rounded flex items-center justify-center text-base hover:bg-[hsl(var(--muted))]">
              {emoji}
            </button>
          ))}
          <button type="button" aria-label="Mas emojis"
            onClick={() => { onOpenChange(false); onOpenFullPicker?.(); }}
            className="h-7 w-7 rounded flex items-center justify-center hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <DropdownMenuSeparator />
        {actionList(DropdownMenuItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Syntax check + commit**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/desktop/src/modules/atlas.chat/components/MessageActionSheet.jsx`
```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageActionSheet.jsx
git commit -m "feat(chat): MessageActionSheet — mobile bottom sheet + desktop right-click menu"
```

---

## Task 7: Wire gestures + quote + action sheet into `ChatMessageBubble.jsx`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/chat-theme.css` (flash keyframe)

- [ ] **Step 1: Add the flash keyframe**

Append to `apps/desktop/src/modules/atlas.chat/chat-theme.css`:
```css
@keyframes chat-msg-flash {
  0%   { background-color: hsl(var(--primary) / 0.18); }
  100% { background-color: transparent; }
}
.chat-msg-flash { animation: chat-msg-flash 1.2s ease-out; }
```

- [ ] **Step 2: Add imports + gesture wiring to the bubble**

In `ChatMessageBubble.jsx`:
```js
import { useLongPress, useSwipeToReply } from "@atlas/ui";
import { CornerUpLeft } from "lucide-react";
import { MessageQuote } from "./MessageQuote";
import { MessageActionSheet } from "./MessageActionSheet";
```

New props on `ChatMessageBubble`: `onReply`, and reuse existing handler props. Inside the component body (after existing `useState`s):
```js
const [actionSheet, setActionSheet] = useState({ open: false, point: null });
const gesturesDisabled = selectionMode || isDeleted || isPending;

const longPress = useLongPress({
  disabled: gesturesDisabled,
  onLongPress: () => setActionSheet({ open: true, point: null }),
});
const { handlers: swipeHandlers, translateX } = useSwipeToReply({
  disabled: gesturesDisabled || !onReply,
  direction: isOwn ? "left" : "right",
  onReply: () => onReply?.(message),
});

const lastTapRef = useRef(0);
function handleBubblePointerUp(e) {
  swipeHandlers.onPointerUp?.(e);
  // double-tap -> quick heart, only on the bubble background / text
  if (gesturesDisabled || !onToggleReaction) return;
  if (e.target.closest?.("a,button,img,video,input")) return;
  const now = Date.now();
  if (now - lastTapRef.current < 250) {
    onToggleReaction(message.id, "❤️");
    lastTapRef.current = 0;
  } else {
    lastTapRef.current = now;
  }
}

function handleContextMenu(e) {
  if (gesturesDisabled) return;
  e.preventDefault();
  setActionSheet({ open: true, point: { x: e.clientX, y: e.clientY } });
}
```

- [ ] **Step 3: Apply handlers + transform to the row wrapper (both branches)**

On the outer `<div className="group/msg ...">` in BOTH the `isOwn` branch (~L1038) and the received branch (~L1204), add:
```jsx
  onPointerDown={(e) => { longPress.onPointerDown?.(e); swipeHandlers.onPointerDown?.(e); }}
  onPointerMove={(e) => { longPress.onPointerMove?.(e); swipeHandlers.onPointerMove?.(e); }}
  onPointerUp={handleBubblePointerUp}
  onPointerCancel={(e) => { longPress.onPointerCancel?.(e); swipeHandlers.onPointerCancel?.(e); }}
  onContextMenu={handleContextMenu}
  style={{ transform: translateX ? `translateX(${translateX}px)` : undefined, transition: translateX ? "none" : "transform 0.18s ease-out" }}
```
Keep the existing `onClick`/`onKeyDown` selection handlers.

- [ ] **Step 4: Render the swipe reply hint icon**

Immediately inside each row `<div>`, before its first child:
```jsx
{translateX !== 0 && (
  <span
    className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-full bg-[hsl(var(--primary))] text-white transition-opacity"
    style={{ [isOwn ? "right" : "left"]: 8, opacity: Math.min(1, Math.abs(translateX) / 64) }}
  >
    <CornerUpLeft className="h-4 w-4" />
  </span>
)}
```
(Row `<div>` needs `relative` — it already lays out with `flex`; add `relative` to its className list in both branches.)

- [ ] **Step 5: Render the inline quote above the body (both branches)**

In each branch, immediately before the `{hasText && (` block that renders the text bubble:
```jsx
{message.reply_to && (
  <MessageQuote
    reply={message.reply_to}
    variant="inline"
    isOwn={isOwn}
    onJump={onJumpToMessage}
  />
)}
```
Add `onJumpToMessage` to `ChatMessageBubble` props.

- [ ] **Step 6: Render the action sheet once per bubble**

Before the final closing `</div>` of each branch (or once, after the `MessageReactionPicker` wrapper), add:
```jsx
<MessageActionSheet
  open={actionSheet.open}
  onOpenChange={(o) => setActionSheet((s) => ({ ...s, open: o }))}
  anchorPoint={actionSheet.point}
  actionProps={{
    hasBody, isOwn, canPin, isPinned, canReply,
    onReply: onReply ? () => onReply(message) : undefined,
    onCopy, onForward, onEnterSelection,
    onPin, onOpenThread, onDelete, onHideForMe,
  }}
  onQuickReact={(emoji) => onToggleReaction?.(message.id, emoji)}
  onOpenFullPicker={() => setReactionPickerOpen(true)}
/>
```

- [ ] **Step 7: Highlight "someone replied to me"**

Where the row `className` array computes `mentioned ? ... : ""`, add an OR condition:
```js
const repliedToMe = !isDeleted && message.reply_to?.senderUserId && message.reply_to.senderUserId === currentUserId;
// then in className: (mentioned || repliedToMe) ? "bg-[hsl(var(--primary)/0.05)] border-l-2 border-[hsl(var(--primary))] pl-2" : ""
```

- [ ] **Step 8: Build + syntax check**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx && pnpm --filter @atlas/desktop build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx apps/desktop/src/modules/atlas.chat/chat-theme.css
git commit -m "feat(chat): long-press/swipe/double-tap/right-click gestures + inline quote in message bubble"
```

---

## Task 8: `replyingTo` state + composer reply UI in `ChatWindow`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] **Step 1: `MessageComposer` accepts `replyingTo` + `onCancelReply`**

Add to the destructured props (~L177):
```js
    replyingTo = null,
    onCancelReply,
```
Add import:
```js
import { MessageQuote } from "./MessageQuote";
```
In `handleSend`'s `onSend({...})` payload (~L471), add:
```js
        replyToMessageId: replyingTo?.id ?? undefined,
```
After the successful send, in the `try` block after `setPendingEntityRefs([])` (~L488):
```js
      onCancelReply?.();
```
Render the compose quote — just inside the composer's outer wrapper, above the textarea row. Find the top-level returned element (~L560) and add as its first child:
```jsx
{replyingTo && (
  <MessageQuote variant="compose" reply={toPreview(replyingTo)} isOwn={false} onCancel={onCancelReply} />
)}
```
Add a small local helper near the top of the file:
```js
// A replyingTo may be a full message object (from a bubble) or an already-
// shaped preview. Normalise to the Plan A preview shape MessageQuote wants.
function toPreview(m) {
  if (!m) return null;
  if (m.kind && ("senderName" in m)) return m;           // already a preview
  const att = (m.attachments ?? [])[0];
  const hasRefs = Array.isArray(m.metadata?.entityRefs) && m.metadata.entityRefs.length > 0;
  const body = (m.body ?? "").trim();
  let kind = "text";
  if (!body && att?.mimeType?.startsWith("image/")) kind = "image";
  else if (!body && att?.mimeType?.startsWith("video/")) kind = "video";
  else if (!body && att?.mimeType?.startsWith("audio/")) kind = "audio";
  else if (!body && att) kind = "file";
  else if (!body && hasRefs) kind = "entity";
  return {
    id: m.id,
    senderUserId: m.sender_user_id ?? m.sender?.id ?? null,
    senderName: m.sender?.displayName ?? "Usuario",
    bodyPreview: body ? (body.length > 120 ? body.slice(0, 120) : body) : null,
    kind,
    isDeleted: Boolean(m.deleted_at),
  };
}
```
Also focus the input when `replyingTo` becomes set:
```js
useEffect(() => {
  if (replyingTo) mentionTaRef.current?.focus?.();
}, [replyingTo]);
```

- [ ] **Step 2: `ChatWindow` owns `replyingTo`**

Near the other `useState`s (~L420):
```js
const [replyingTo, setReplyingTo] = useState(null);
```
Clear it on conversation change — find the effect that resets per-conversation UI (near `setThreadPanelRootId(null)` ~L466) and add `setReplyingTo(null);`.

Pass to `<ChatMessageList>` (~L828):
```jsx
onReplyToMessage={(msg) => setReplyingTo(msg)}
onJumpToMessage={(id) => setJumpTarget({ id, nonce: Date.now() })}
```
Pass to `<MessageComposer>` (~L867):
```jsx
replyingTo={replyingTo}
onCancelReply={() => setReplyingTo(null)}
```

- [ ] **Step 3: Thread `onJumpToMessage` through `ChatMessageList` to bubbles**

`ChatMessageList.jsx` — add prop `onJumpToMessage`; pass to each `<ChatMessageBubble onJumpToMessage={onJumpToMessage} .../>`.

- [ ] **Step 4: Build + manual check**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx && node --check apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx && pnpm --filter @atlas/desktop build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx
git commit -m "feat(chat): reply-to compose state + quote UI in ChatWindow"
```

---

## Task 9: Same wiring in `MiniChatWindow` and `ThreadPanel`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx`

- [ ] **Step 1: `MiniChatWindow`**

Mirror Task 8 Step 2 exactly: add `const [replyingTo, setReplyingTo] = useState(null)`, clear on conversation change, pass `onReplyToMessage` + `onJumpToMessage` to its `<ChatMessageList>` (~L341) and `replyingTo` + `onCancelReply` to its `<MessageComposer>` (~L362). Jump target: MiniChatWindow uses a local jump state if present; if it has none, add `const [jumpTarget, setJumpTarget] = useState(null)` and `scrollToMessage={jumpTarget}` on its `<ChatMessageList>`.

- [ ] **Step 2: `ThreadPanel`**

`ThreadPanel.jsx` renders bubbles directly (not via `ChatMessageList`). Add:
```jsx
const [replyingTo, setReplyingTo] = useState(null);
```
Pass `onReply={() => setReplyingTo(reply)}` (and for the root bubble) to each `<ChatMessageBubble>`; pass `onJumpToMessage={undefined}` (no scroll container to jump within — a thread is short; leave quotes non-jumping here, they still render). On the `<MessageComposer>` (~L80) add `replyingTo={replyingTo}` and `onCancelReply={() => setReplyingTo(null)}`. In `handleSend` (~L19) the composer already includes `replyToMessageId` in its payload, and `useSendThreadReply` spreads `...data`, so no change needed there — verify `useSendThreadReply`'s `mutationFn` is `(data) => atlas.chat.sendMessage(conversationId, { ...data, threadRootId: rootMessageId }, token)` (it is, per `hooks/useThreadReplies.js:41`).

- [ ] **Step 3: Build**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx && node --check apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx && pnpm --filter @atlas/desktop build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx
git commit -m "feat(chat): reply-to parity in MiniChatWindow and ThreadPanel"
```

---

## Task 10: Jump-to-quote — flash + load-older-until-found in `ChatMessageList`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx`

- [ ] **Step 1: Upgrade the `scrollToMessage` effect**

Replace the effect at ~L162:
```jsx
  useEffect(() => {
    if (!scrollToMessage?.id || !listRef.current) return;
    let cancelled = false;
    let attempts = 0;

    function tryScroll() {
      if (cancelled) return;
      const el = listRef.current?.querySelector(`[data-msg-id="${scrollToMessage.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("chat-msg-flash");
        // reflow so the animation restarts if the same id is targeted twice
        void el.offsetWidth;
        el.classList.add("chat-msg-flash");
        setTimeout(() => el.classList.remove("chat-msg-flash"), 1400);
        return;
      }
      if (attempts >= 5 || !hasMore) {
        if (typeof onJumpFailed === "function") onJumpFailed();
        return;
      }
      attempts += 1;
      handleLoadMore();
      setTimeout(tryScroll, 600);
    }
    tryScroll();
    return () => { cancelled = true; };
  }, [scrollToMessage?.id, scrollToMessage?.nonce, hasMore, handleLoadMore]);
```
Add `onJumpFailed` to `ChatMessageList` props.

- [ ] **Step 2: Wire a toast on failure in `ChatWindow` / `MiniChatWindow`**

Pass `onJumpFailed={() => toast.error("No se pudo cargar el mensaje original.")}` where a `toast` helper already exists in that file (grep for existing `toast` import; if none, use the app's standard — check `apps/desktop/src/lib` for a toast util, else `console.warn` fallback and note it).

- [ ] **Step 3: Build + commit**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx && pnpm --filter @atlas/desktop build`
```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/MiniChatWindow.jsx
git commit -m "feat(chat): jump-to-quoted-message with flash + load-older fallback"
```

---

## Task 11: Optimistic `reply_to` in `useSendMessage`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js`

- [ ] **Step 1: Build the optimistic preview from the query cache**

In `useSendMessage` `onMutate` (~L176), before building `optimistic`:
```js
      let optimisticReplyTo = null;
      if (data.replyToMessageId) {
        const cache = queryClient.getQueryData(["chat-messages", conversationId]);
        const orig = (cache?.data ?? []).find((m) => m.id === data.replyToMessageId);
        if (orig) {
          const body = (orig.body ?? "").trim();
          optimisticReplyTo = {
            id: orig.id,
            senderUserId: orig.sender_user_id ?? orig.sender?.id ?? null,
            senderName: orig.sender?.displayName ?? "Usuario",
            bodyPreview: body ? (body.length > 120 ? body.slice(0, 120) : body) : null,
            kind: body ? "text" : (orig.attachments?.[0]?.mimeType?.startsWith("image/") ? "image"
                    : orig.attachments?.[0]?.mimeType?.startsWith("video/") ? "video"
                    : orig.attachments?.[0]?.mimeType?.startsWith("audio/") ? "audio"
                    : orig.attachments?.length ? "file"
                    : Array.isArray(orig.metadata?.entityRefs) && orig.metadata.entityRefs.length ? "entity" : "text"),
            isDeleted: Boolean(orig.deleted_at),
          };
        }
      }
```
Add `reply_to: optimisticReplyTo,` to the `optimistic` object (near `attachments: null,`).

- [ ] **Step 2: Syntax check + commit**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js`
```bash
git add apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js
git commit -m "feat(chat): optimistic reply_to preview on send"
```

---

## Task 12: `PinnedMessagesSheet` quote render + realtime `replyToMessageId`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx`
- Verify: realtime handling in `useChatMessages.js` / `RealtimeProvider.jsx`

- [ ] **Step 1: `PinnedMessagesSheet` — read-only quote**

If it renders `<ChatMessageBubble>`, pass `onReply={undefined}` and `onJumpToMessage={(id) => onJumpToConversationMessage(id)}` if such a jump callback exists there already (it has a "Ver en el chat" affordance — reuse its handler). Gestures are already inert without `onReply`/`onToggleReaction`. No new action surface here.

- [ ] **Step 2: Confirm realtime path refetches**

Grep `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` for the `chat.message.new` subscription. Confirm it invalidates/refetches `["chat-messages", conversationId]` on the event (it should already, for threads). The new `replyToMessageId` in the payload needs no special handling — the refetch pulls the resolved `reply_to` from Plan A's `listMessages`. Add a one-line comment noting this.

- [ ] **Step 3: Build + commit**

Run: `cd d:/RacoonDevs/atlaserp-v2 && pnpm --filter @atlas/desktop build`
```bash
git add apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js
git commit -m "feat(chat): render quotes in pinned sheet; note realtime reply-to refetch"
```

---

## Task 13: Docs + full verification + responsive QA

**Files:**
- Modify: `docs/ai-context/ame3-runtime-capabilities.md`
- Modify: `docs/TASKS.md`

- [ ] **Step 1: Document the new hooks**

In `docs/ai-context/ame3-runtime-capabilities.md`, in the `@atlas/ui` hooks table, add rows for `useLongPress` and `useSwipeToReply` with a one-line description and signature.

- [ ] **Step 2: TASKS.md note**

Under "atlas.chat — Realtime Chat", add a short "Reply-to-message + mobile gestures" entry pointing at this plan and Plan A, dated 2026-08-28.

- [ ] **Step 3: Full test + lint + build**

Run:
```bash
cd d:/RacoonDevs/atlaserp-v2 && \
node --test packages/ui/src/hooks/__tests__/ && \
node --test apps/api/src/routes/chat/__tests__/ && \
pnpm lint && \
pnpm --filter @atlas/desktop build
```
Expected: all green.

- [ ] **Step 4: Responsive + interaction QA (manual — `feedback_responsive_qa`)**

Run the app (`pnpm dev`), open `atlas.chat`. At **390px** and **1440px**, in `ChatWindow`, `MiniChatWindow`, and `ThreadPanel`, verify:
1. Long-press on a message opens the bottom sheet (mobile) — reactions row + full action list; haptic on a real device.
2. Right-click on a message (desktop) opens the same list at the cursor.
3. Swipe a received message right / an own message left past ~64px → composer shows the compose quote, input focused.
4. Double-tap a message toggles ❤️.
5. Tapping an inline quote scrolls to + flashes the original; tapping a quote whose original is far up loads older pages then lands on it; unresolvable → toast.
6. Vertical scroll is never captured by the swipe handler.
7. Deleted original → quote shows "Mensaje eliminado", not tappable.
8. Desktop hover menu still works and now lists "Responder".
9. Run the 14-aspect UI checklist (`docs/ai-context/ui-screen-audit-checklist.md`) on the three surfaces.

- [ ] **Step 5: Commit docs**

```bash
git add docs/ai-context/ame3-runtime-capabilities.md docs/TASKS.md
git commit -m "docs(chat): document gesture hooks + reply-to feature"
```

---

## Self-review notes (author)

- Spec §2 goals: quoted reply → Tasks 4,7,8,9,11; long-press sheet → Tasks 1,6,7; swipe → Tasks 2,7; double-tap → Task 7; right-click → Tasks 6,7. §4 surfaces: ChatWindow → Task 8; MiniChatWindow + ThreadPanel → Task 9; PinnedMessagesSheet read-only → Task 12; ExternalInboxScreen untouched (no task — correct). §7.1 mandated extraction → Task 3. §7.2 components → Tasks 4,6. §7.3 hooks in `@atlas/ui` → Tasks 1,2. §7.4 descriptor → Task 5. §7.5 state → Tasks 8,9. §7.6 jump → Task 10. §7.7 wiring + mention-style highlight → Task 7. §8 error handling: deleted original → Tasks 4,7 (render) + Plan A (send reject); jump fail toast → Task 10. §9 frontend tests → Tasks 1,2.
- Type consistency: the `reply_to` preview keys (`id`, `senderUserId`, `senderName`, `bodyPreview`, `kind`, `isDeleted`) are identical in `MessageQuote` (Task 4), `toPreview` (Task 8), the optimistic builder (Task 11), and Plan A. `buildMessageActions` arg names match between Task 5 (definition), Task 6 (`MessageActionSheet`), and Task 7 (bubble call site). `onReplyToMessage` (list prop) vs `onReply` (bubble prop) vs `replyingTo` (view state) — deliberate and consistent.
- Deferrable: Task 10's `onJumpFailed` toast depends on locating the app toast util; the step says fall back to `console.warn` and note it — bounded, not a silent gap.
- No `window.confirm/alert/prompt`; all destructive confirms still go through the existing `ConfirmDialog` in `MessageAttachments`/bubble. UI text Spanish, no emojis in chrome (the quick-reaction row emojis are content, not chrome).

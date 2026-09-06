# In-call chat — Plan B (UI): docked chat panel, mobile view switcher, call card

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dock the real `ChatWindow` inside the `atlas.calls` call room (right-docked collapsible panel on desktop, `video | screen | chat` view switcher on mobile) and render call lifecycle system messages as a compact call card.

**Architecture:** A new `CallChatPanel` hosts `ChatWindow` with a new `embedded="call"` variant that trims header chrome. `CallRoom` gains `useIsMobile(1024)`, a `mobileView` state driven by the pure `nextCallView` reducer, a `chatExpanded` state persisted to `localStorage`, and an unread counter derived from `useChatMessages`. `CallRoomLayout` renders the desktop dock/rail, the mobile `CallViewSwitcher`, and a "someone is sharing" banner. `CallLogCard` + the pure `getCallMeta` detector render the call system message (from Plan A) as a card.

**Tech Stack:** React 18, Vite, TanStack Query, Tailwind, lucide-react, `@atlas/ui`, `node:test` for pure helpers.

**Spec:** `docs/superpowers/specs/2026-09-06-chat-in-call-panel-design.md` §3.1–3.6.

**Depends on Plan A** for the call system-message contract: a `chat_messages`
row with `sender_type = 'system'`, `message_type = 'system'`, and
`metadata.call = { callId, kind, event: "started"|"ended", endReason, durationSec }`.
Plan B can be built and unit-tested without Plan A merged (the card just won't
appear until real rows exist).

---

## File structure

| File | Responsibility |
|---|---|
| `apps/desktop/src/modules/atlas.chat/calls/lib/callChat.js` | **new** — pure: `CALL_VIEWS`, `nextCallView(view, {hasScreenShare})`, `shouldShowScreenSegment(hasScreenShare)` |
| `apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callChat.test.js` | **new** — unit tests |
| `apps/desktop/src/modules/atlas.chat/components/callLogMeta.js` | **new** — pure: `getCallMeta(message)` → call payload or `null` (no JSX) |
| `apps/desktop/src/modules/atlas.chat/components/__tests__/callLogMeta.test.js` | **new** — unit tests |
| `apps/desktop/src/modules/atlas.chat/components/CallLogCard.jsx` | **new** — the call-card row + "Volver a llamar" |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | **modify** — import + 2-line early-return branch |
| `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` | **modify** — `embedded` / `onCollapse` props threaded into `ChatHeader`; header chrome conditionals |
| `apps/desktop/src/modules/atlas.chat/calls/CallChatPanel.jsx` | **new** — themed shell hosting `ChatWindow embedded="call"` |
| `apps/desktop/src/modules/atlas.chat/calls/CallViewSwitcher.jsx` | **new** — mobile segmented control (`Video / Pantalla / Chat`) |
| `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx` | **modify** — `isMobile`, `mobileView`, `chatExpanded` (+localStorage), unread counter, pass a `chat` prop to the layout |
| `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx` | **modify** — desktop dock/rail column, mobile switcher, chat-view branch, screen-share banner |

Nothing goes into `@atlas/ui` this cycle — the switcher and panel are
call-overlay-specific (same reasoning as the existing local `DraggablePip`).

---

## Task 1: Pure `callChat.js` view reducer

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/lib/callChat.js`
- Test: `apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callChat.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callChat.test.js`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextCallView, shouldShowScreenSegment, CALL_VIEWS } from "../callChat.js";

describe("nextCallView", () => {
  it("keeps a valid view when nothing forces a change", () => {
    assert.equal(nextCallView("video", { hasScreenShare: false }), "video");
    assert.equal(nextCallView("chat", { hasScreenShare: false }), "chat");
    assert.equal(nextCallView("chat", { hasScreenShare: true }), "chat");
    assert.equal(nextCallView("screen", { hasScreenShare: true }), "screen");
  });
  it("collapses screen -> video when the share ends", () => {
    assert.equal(nextCallView("screen", { hasScreenShare: false }), "video");
  });
  it("falls back to video for unknown views and missing options", () => {
    assert.equal(nextCallView("bogus", { hasScreenShare: true }), "video");
    assert.equal(nextCallView(undefined), "video");
    assert.equal(nextCallView("screen"), "video");
  });
});

describe("shouldShowScreenSegment", () => {
  it("mirrors screen-share liveness", () => {
    assert.equal(shouldShowScreenSegment(true), true);
    assert.equal(shouldShowScreenSegment(false), false);
    assert.equal(shouldShowScreenSegment(undefined), false);
  });
});

describe("CALL_VIEWS", () => {
  it("is the canonical ordered list", () => {
    assert.deepEqual(CALL_VIEWS, ["video", "screen", "chat"]);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `node --test apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callChat.test.js`
Expected: FAIL — `Cannot find module '../callChat.js'`.

- [ ] **Step 3: Implement**

Create `apps/desktop/src/modules/atlas.chat/calls/lib/callChat.js`:

```js
// Pure helpers for the in-call chat panel's mobile view state. No React, no
// DOM — see CallRoom.jsx for the stateful wiring.

export const CALL_VIEWS = ["video", "screen", "chat"];

// Given the user's chosen mobile view and whether a screen share is live,
// return the view that should actually render. "screen" collapses back to
// "video" the moment the share ends; anything unrecognised falls back to
// "video".
export function nextCallView(view, { hasScreenShare = false } = {}) {
  if (!CALL_VIEWS.includes(view)) return "video";
  if (view === "screen" && !hasScreenShare) return "video";
  return view;
}

// The "Pantalla" segment of the switcher only exists while a share is live.
export function shouldShowScreenSegment(hasScreenShare) {
  return Boolean(hasScreenShare);
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `node --test apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callChat.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/lib/callChat.js apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callChat.test.js
git commit -m "$(cat <<'EOF'
feat(calls): pure nextCallView reducer for the in-call chat panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pure `getCallMeta` message detector

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/callLogMeta.js`
- Test: `apps/desktop/src/modules/atlas.chat/components/__tests__/callLogMeta.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/modules/atlas.chat/components/__tests__/callLogMeta.test.js`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCallMeta } from "../callLogMeta.js";

describe("getCallMeta", () => {
  it("returns the call payload for a started system message", () => {
    const msg = {
      sender_type: "system",
      message_type: "system",
      metadata: { call: { callId: "c1", kind: "VIDEO", event: "started", endReason: null, durationSec: null } },
    };
    assert.deepEqual(getCallMeta(msg), {
      callId: "c1", kind: "VIDEO", event: "started", endReason: null, durationSec: null,
    });
  });
  it("returns the call payload for an ended system message", () => {
    const msg = {
      message_type: "system",
      metadata: { call: { callId: "c2", kind: "AUDIO", event: "ended", endReason: "ended", durationSec: 754 } },
    };
    assert.equal(getCallMeta(msg).durationSec, 754);
  });
  it("parses stringified metadata", () => {
    const msg = {
      sender_type: "system",
      metadata: JSON.stringify({ call: { kind: "AUDIO", event: "ended", endReason: "missed", durationSec: null } }),
    };
    assert.equal(getCallMeta(msg).endReason, "missed");
  });
  it("returns null for a normal user message", () => {
    assert.equal(getCallMeta({ sender_type: "user", message_type: "text", body: "hola" }), null);
  });
  it("returns null for a plain system message with no call payload", () => {
    assert.equal(getCallMeta({ sender_type: "system", message_type: "system", body: "creó el grupo" }), null);
  });
  it("returns null for junk metadata and missing input", () => {
    assert.equal(getCallMeta(null), null);
    assert.equal(getCallMeta({ sender_type: "system", metadata: "{not json" }), null);
    assert.equal(getCallMeta({ sender_type: "system", metadata: { call: { event: "weird" } } }), null);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `node --test apps/desktop/src/modules/atlas.chat/components/__tests__/callLogMeta.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/desktop/src/modules/atlas.chat/components/callLogMeta.js`:

```js
// Pure: decide whether a chat message row is an atlas.calls lifecycle card and
// return its { callId?, kind, event, endReason, durationSec } payload, else
// null. No JSX so it is unit-testable under `node --test`.

export function getCallMeta(message) {
  if (!message) return null;
  const isSystem = message.sender_type === "system" || message.message_type === "system";
  if (!isSystem) return null;

  let meta = message.metadata;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      return null;
    }
  }

  const call = meta && typeof meta === "object" ? meta.call : null;
  if (!call || (call.event !== "started" && call.event !== "ended")) return null;
  return call;
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `node --test apps/desktop/src/modules/atlas.chat/components/__tests__/callLogMeta.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/callLogMeta.js apps/desktop/src/modules/atlas.chat/components/__tests__/callLogMeta.test.js
git commit -m "$(cat <<'EOF'
feat(chat): pure getCallMeta detector for call lifecycle messages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `CallLogCard` component

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/CallLogCard.jsx`

- [ ] **Step 1: Implement the component**

Create `apps/desktop/src/modules/atlas.chat/components/CallLogCard.jsx`:

```jsx
import { Phone, PhoneMissed, Video } from "lucide-react";
import { Button } from "@atlas/ui";
import { useCalls } from "../calls/CallsProvider";
import { getCallMeta } from "./callLogMeta";

// Renders an atlas.calls lifecycle system message (see Plan A) as a compact,
// centered call-log row, WhatsApp style. Returns null for any message that is
// not a call card, so the caller can use it as a plain early-return branch.
export function CallLogCard({ message }) {
  const meta = getCallMeta(message);
  const { enabled, isStarting, activeCall, startCall } = useCalls();

  if (!meta) return null;

  const isVideo = meta.kind === "VIDEO";
  const isMissed = meta.endReason === "missed" || meta.endReason === "rejected";
  const Icon = isMissed ? PhoneMissed : isVideo ? Video : Phone;
  const conversationId = message.conversation_id ?? null;

  const canRecall =
    meta.event === "ended"
    && enabled
    && Boolean(conversationId)
    && !activeCall
    && !isStarting;

  return (
    <div className="flex justify-center my-2 px-4">
      <div className="flex items-center gap-2.5 rounded-2xl bg-[hsl(var(--muted))] px-3.5 py-2 text-xs">
        <span
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            isMissed
              ? "bg-red-500/15 text-red-500"
              : "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]",
          ].join(" ")}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium text-[hsl(var(--foreground))]">{message.body}</span>
        {canRecall && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => startCall({ conversationId, kind: isVideo ? "VIDEO" : "AUDIO" })}
          >
            Volver a llamar
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Compile check via the web build (fast fail on import errors is caught later; do a lint here)**

Run: `pnpm --filter @atlas/desktop lint -- apps/desktop/src/modules/atlas.chat/components/CallLogCard.jsx`
Expected: no errors. (If the workspace lint script does not accept a path arg, skip to Task 9's full lint.)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/CallLogCard.jsx
git commit -m "$(cat <<'EOF'
feat(chat): CallLogCard for call lifecycle messages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Render the card from `ChatMessageBubble`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`

- [ ] **Step 1: Add the import**

In `ChatMessageBubble.jsx`, in the import block near the top (after
`import { MessageQuote } from "./MessageQuote";` or any sibling-component
import), add:

```js
import { CallLogCard } from "./CallLogCard";
import { getCallMeta } from "./callLogMeta";
```

- [ ] **Step 2: Add the early-return branch**

Find the existing generic system-message branch:

```jsx
  if (message.sender_type === "system" || message.message_type === "system") {
    return (
      <div className="flex justify-center my-2 px-4">
        <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-3 py-1 rounded-full">
          {renderMentionText(message.body)}
        </span>
      </div>
    );
  }
```

Insert **immediately above it**:

```jsx
  if (getCallMeta(message)) {
    return <CallLogCard message={message} />;
  }
```

- [ ] **Step 3: Syntax check**

Run: `node --check apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`
Expected: exit 0. (Node parses JSX-free syntax only; if it errors on JSX, rely
on the Task 9 build instead — but this file is already JSX so `--check` will
report "Unexpected token <". In that case skip this step and trust Task 9.)

> Note: `--check` does not understand JSX. Treat Task 9's `build:web` as the
> real compile gate for every `.jsx` edit in this plan.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx
git commit -m "$(cat <<'EOF'
feat(chat): render CallLogCard for call system messages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `ChatWindow` `embedded="call"` variant

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] **Step 1: Add `ChevronRight` to the lucide import**

At the top of `ChatWindow.jsx`, the icon import currently reads:

```js
import {
  ArrowLeft, Users, FolderOpen, MessageSquare,
  MoreVertical, Trash2, X as XIcon, Search, Share2, CheckSquare,
  ChevronUp, ChevronDown, Archive, ArchiveRestore, Pin,
  Phone, Video,
} from "lucide-react";
```

Add `ChevronRight`:

```js
import {
  ArrowLeft, Users, FolderOpen, MessageSquare,
  MoreVertical, Trash2, X as XIcon, Search, Share2, CheckSquare,
  ChevronUp, ChevronDown, ChevronRight, Archive, ArchiveRestore, Pin,
  Phone, Video,
} from "lucide-react";
```

- [ ] **Step 2: Accept `embedded` in the `ChatHeader` signature**

`ChatHeader` is destructured across a few lines ending with:

```js
  callsEnabled, callPending, onStartAudioCall, onStartVideoCall,
}) {
```

Change to:

```js
  callsEnabled, callPending, onStartAudioCall, onStartVideoCall,
  embedded = null, onCollapse = null,
}) {
```

- [ ] **Step 3: Swap the back button for a collapse control when embedded**

In `ChatHeader`'s "Normal mode" return, find:

```jsx
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors md:hidden touch-manipulation shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
```

Replace with:

```jsx
        {embedded === "call" ? (
          <button
            type="button"
            onClick={onCollapse}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors touch-manipulation shrink-0"
            aria-label="Ocultar chat"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors md:hidden touch-manipulation shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
```

- [ ] **Step 4: Hide the in-header call buttons when embedded**

Find:

```jsx
        {callsEnabled && conversation?.type !== "external_support" && (
```

Change to:

```jsx
        {!embedded && callsEnabled && conversation?.type !== "external_support" && (
```

- [ ] **Step 5: Hide archive + delete-conversation when embedded**

Find, inside `<DropdownMenuContent align="end">`:

```jsx
            {onArchive && (
              <DropdownMenuItem onSelect={onArchive}>
                {isArchived
                  ? <><ArchiveRestore className="h-3.5 w-3.5 mr-2" />Desarchivar</>
                  : <><Archive className="h-3.5 w-3.5 mr-2" />Archivar</>
                }
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-red-500 focus:text-red-500">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Eliminar conversacion
            </DropdownMenuItem>
```

Change to:

```jsx
            {!embedded && onArchive && (
              <DropdownMenuItem onSelect={onArchive}>
                {isArchived
                  ? <><ArchiveRestore className="h-3.5 w-3.5 mr-2" />Desarchivar</>
                  : <><Archive className="h-3.5 w-3.5 mr-2" />Archivar</>
                }
              </DropdownMenuItem>
            )}
            {!embedded && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-red-500 focus:text-red-500">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Eliminar conversacion
                </DropdownMenuItem>
              </>
            )}
```

- [ ] **Step 6: Accept `embedded` / `onCollapse` on `ChatWindow` and pass them down**

Change the `ChatWindow` signature:

```js
export function ChatWindow({ conversation, onClose, initialFilesView = false, initialJumpMessageId = null }) {
```

to:

```js
export function ChatWindow({ conversation, onClose, initialFilesView = false, initialJumpMessageId = null, embedded = null, onCollapse = null }) {
```

Then in the JSX where `<ChatHeader ... />` is rendered (the main one, around
line 782), add these two props anywhere in its prop list:

```jsx
        embedded={embedded}
        onCollapse={onCollapse}
```

(There is a second `ChatHeader`-shaped prop cluster near line 936 for the
thread view — leave it; `embedded` there is harmless if you also pass it, but
it is not required. Only the main header needs it.)

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "$(cat <<'EOF'
feat(chat): ChatWindow embedded="call" variant (trimmed header chrome)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `CallChatPanel`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/CallChatPanel.jsx`

- [ ] **Step 1: Implement**

Create `apps/desktop/src/modules/atlas.chat/calls/CallChatPanel.jsx`:

```jsx
import { Loader2 } from "lucide-react";
import "../chat-theme.css";
import {
  ChatPreferencesProvider,
  useChatPreferences,
  chatPreferencesStyle,
} from "../hooks/useChatPreferences";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { ChatWindow } from "../components/ChatWindow";

function unwrap(response) {
  return response?.data ?? response;
}

// The in-call chat surface: the real ChatWindow bound to the call's
// conversation, with call-trimmed header chrome. Placement (desktop dock /
// mobile full-bleed) and show/hide are the caller's job — this component only
// owns theming + the conversation fetch.
export function CallChatPanel({ conversationId, onClose }) {
  return (
    <ChatPreferencesProvider>
      <CallChatPanelInner conversationId={conversationId} onClose={onClose} />
    </ChatPreferencesProvider>
  );
}

function CallChatPanelInner({ conversationId, onClose }) {
  const { prefs } = useChatPreferences();
  const { data, isLoading, isError } = useChatConversationDetail(conversationId);
  const conversation = unwrap(data);

  return (
    <div
      className="chat-glass-theme flex h-full w-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
      style={chatPreferencesStyle(prefs)}
    >
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isError || !conversation ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No se pudo cargar el chat de la llamada.
        </div>
      ) : (
        <ChatWindow conversation={conversation} embedded="call" onCollapse={onClose} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallChatPanel.jsx
git commit -m "$(cat <<'EOF'
feat(calls): CallChatPanel — hosts ChatWindow inside the call room

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `CallViewSwitcher`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/calls/CallViewSwitcher.jsx`

- [ ] **Step 1: Implement**

Create `apps/desktop/src/modules/atlas.chat/calls/CallViewSwitcher.jsx`:

```jsx
import { MessageSquare, MonitorUp, Video } from "lucide-react";

const TABS = [
  { key: "video", label: "Video", Icon: Video },
  { key: "screen", label: "Pantalla", Icon: MonitorUp },
  { key: "chat", label: "Chat", Icon: MessageSquare },
];

// Mobile-only segmented control for the call room. "Pantalla" only appears
// while a screen share is live. A dot on "Chat" flags unread messages while
// another view is active.
export function CallViewSwitcher({ view, onChange, hasScreenShare, chatUnread = 0 }) {
  const tabs = TABS.filter((tab) => tab.key !== "screen" || hasScreenShare);

  return (
    <div className="mx-auto my-2 flex w-fit items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur">
      {tabs.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={[
              "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-white text-slate-900" : "text-white/80 hover:text-white",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === "chat" && !active && chatUnread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-violet-400 ring-2 ring-slate-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallViewSwitcher.jsx
git commit -m "$(cat <<'EOF'
feat(calls): CallViewSwitcher — mobile video/screen/chat segmented control

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wire `CallRoom` + `CallRoomLayout`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx`

### 8a. `CallRoom.jsx`

- [ ] **Step 1: Imports + localStorage helpers**

At the top of `CallRoom.jsx`, alongside the existing imports, add:

```js
import { useIsMobile } from "@atlas/ui";
import { useChatMessages } from "../hooks/useChatMessages";
import { nextCallView } from "./lib/callChat";
import { CallChatPanel } from "./CallChatPanel";
```

Below the existing `const UNANSWERED_CALL_TIMEOUT_MS = 36_000;` line, add:

```js
const CHAT_PANEL_PREF_KEY = "atlas.calls.chatPanel.collapsed";

function readChatCollapsedPref() {
  try {
    return localStorage.getItem(CHAT_PANEL_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function writeChatCollapsedPref(collapsed) {
  try {
    localStorage.setItem(CHAT_PANEL_PREF_KEY, collapsed ? "1" : "0");
  } catch {
    /* private mode / storage disabled — non-fatal */
  }
}
```

- [ ] **Step 2: State + derived values inside `CallRoom`**

Immediately after the existing `const [hasRemoteJoined, setHasRemoteJoined] = useState(false);`
line, add:

```js
  const conversationId = session.call.conversationId;
  const isMobile = useIsMobile(1024);
  const [mobileView, setMobileView] = useState("video");
  const [chatExpanded, setChatExpanded] = useState(() => !readChatCollapsedPref());

  const { data: chatData } = useChatMessages(conversationId);
  const chatMsgCount = chatData?.data?.length ?? 0;
  const chatActive = isMobile ? mobileView === "chat" : chatExpanded;
  const chatSeenRef = useRef(0);
  const chatLoadedRef = useRef(false);
  const [chatUnread, setChatUnread] = useState(0);
```

(`useRef` is already imported via `react` at the top of this file? It imports
`useCallback, useEffect, useMemo, useState`. Add `useRef`:)

```js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 3: Unread + view-correction effects**

After the existing effects block (e.g. right after the `useEffect` that manages
the unanswered-call timeout, near line 160), add:

```js
  // Count chat messages that arrive while the panel is not the active view.
  useEffect(() => {
    if (!chatLoadedRef.current) {
      if (chatData) {
        chatLoadedRef.current = true;
        chatSeenRef.current = chatMsgCount;
      }
      return;
    }
    if (chatActive) {
      chatSeenRef.current = chatMsgCount;
      setChatUnread(0);
      return;
    }
    if (chatMsgCount > chatSeenRef.current) {
      setChatUnread((current) => current + (chatMsgCount - chatSeenRef.current));
      chatSeenRef.current = chatMsgCount;
    }
  }, [chatMsgCount, chatActive, chatData]);
```

- [ ] **Step 4: Screen-share-aware view correction**

`screenShareEntry` is derived further down in the component. Add this effect
**after** `screenShareEntry` is computed (just after the line
`const screenShareEntry = participants.find(...) ?? null;`):

```js
  useEffect(() => {
    const corrected = nextCallView(mobileView, { hasScreenShare: Boolean(screenShareEntry) });
    if (corrected !== mobileView) setMobileView(corrected);
  }, [mobileView, screenShareEntry]);
```

- [ ] **Step 5: Handlers + panel node**

Near the other `function handleX` helpers (e.g. after `handleLeave`), add:

```js
  const handleChatClose = useCallback(() => {
    if (isMobile) {
      setMobileView("video");
    } else {
      setChatExpanded(false);
      writeChatCollapsedPref(true);
    }
  }, [isMobile]);

  const handleToggleChatExpanded = useCallback((next) => {
    setChatExpanded(next);
    writeChatCollapsedPref(!next);
  }, []);

  const chatPanelNode =
    !isMobile || mobileView === "chat"
      ? <CallChatPanel conversationId={conversationId} onClose={handleChatClose} />
      : null;
```

- [ ] **Step 6: Pass a `chat` prop to `CallRoomLayout`**

In the `return <CallRoomLayout view={{...}} actions={{...}} />`, add a third
prop:

```jsx
      chat={{
        isMobile,
        mobileView,
        onMobileViewChange: setMobileView,
        chatExpanded,
        onToggleChatExpanded: handleToggleChatExpanded,
        chatUnread,
        hasScreenShare: Boolean(screenShareEntry),
        panel: chatPanelNode,
      }}
```

### 8b. `CallRoomLayout.jsx`

- [ ] **Step 7: Imports**

Add `MessageSquare` to the existing lucide import list, and import the
switcher:

```js
import {
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  PictureInPicture2,
  ScreenShareOff,
  SwitchCamera,
  Volume2,
} from "lucide-react";
import { Track } from "livekit-client";
import { playCallSound } from "./callSounds";
import { DraggablePip } from "./DraggablePip";
import { CallViewSwitcher } from "./CallViewSwitcher";
```

- [ ] **Step 8: Accept the `chat` prop**

Change the component signature:

```js
export function CallRoomLayout({ view, actions }) {
```

to:

```js
export function CallRoomLayout({ view, actions, chat }) {
```

And just under the `const { ... } = view;` destructure, add:

```js
  const {
    isMobile = false,
    mobileView = "video",
    onMobileViewChange = () => {},
    chatExpanded = true,
    onToggleChatExpanded = () => {},
    chatUnread = 0,
    hasScreenShare = false,
    panel: chatPanel = null,
  } = chat ?? {};

  const showChatColumn = !isMobile && chatExpanded;
  const showChatRail = !isMobile && !chatExpanded;
  const mobileChatOpen = isMobile && mobileView === "chat";
```

- [ ] **Step 9: Restructure the outer layout into a row (column + optional aside)**

The current top-level return is:

```jsx
  return (
    <div className="fixed inset-0 z-[10020] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
      <OutgoingCallTone active={outgoingToneActive} />
      <header ...> ... </header>

      <main className="relative min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        {screenShareEntry ? (
          ...
        ) : useFocusLayout ? (
          ...
        ) : (
          ...
        )}
        {remoteParticipants.map((participant) => (
          <RemoteAudio key={`audio-${participant.identity}`} participant={participant} />
        ))}
      </main>

      <footer ...> ... </footer>
    </div>
  );
```

Replace the outer `<div>` and its direct children with this structure — the
`<header>`, the three participant-layout branches, and the `<footer>` keep
their exact existing contents; only the wrappers around them change:

```jsx
  return (
    <div className="fixed inset-0 z-[10020] flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <OutgoingCallTone active={outgoingToneActive} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header /* ...unchanged... */>
          {/* ...unchanged header contents... */}
        </header>

        {isMobile && (
          <CallViewSwitcher
            view={mobileView}
            onChange={onMobileViewChange}
            hasScreenShare={hasScreenShare}
            chatUnread={chatUnread}
          />
        )}

        <main className="relative min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
          {mobileChatOpen ? (
            <div className="absolute inset-0 flex flex-col bg-[hsl(var(--background))]">
              {hasScreenShare && (
                <button
                  type="button"
                  onClick={() => onMobileViewChange("screen")}
                  className="flex items-center gap-2 bg-violet-600 px-4 py-2 text-left text-xs font-medium text-white"
                >
                  <MonitorUp className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">
                    {(screenShareEntry?.participant?.name) || "Alguien"} esta compartiendo pantalla
                  </span>
                  <span className="underline">Ver</span>
                </button>
              )}
              <div className="min-h-0 flex-1">{chatPanel}</div>
            </div>
          ) : (
            <>
              {screenShareEntry ? (
                /* ...unchanged screen-share branch... */
                null
              ) : useFocusLayout ? (
                /* ...unchanged focus branch... */
                null
              ) : (
                /* ...unchanged grid branch... */
                null
              )}
              {remoteParticipants.map((participant) => (
                <RemoteAudio key={`audio-${participant.identity}`} participant={participant} />
              ))}
            </>
          )}
        </main>

        <footer /* ...unchanged... */>
          {/* ...unchanged footer contents... */}
        </footer>
      </div>

      {showChatColumn && (
        <aside className="hidden w-[380px] shrink-0 border-l border-white/10 bg-[hsl(var(--background))] lg:block">
          {chatPanel}
        </aside>
      )}

      {showChatRail && (
        <aside className="hidden w-12 shrink-0 flex-col items-center border-l border-white/10 bg-slate-950 pt-3 lg:flex">
          <button
            type="button"
            onClick={() => onToggleChatExpanded(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 hover:text-white"
            title="Mostrar chat"
          >
            <MessageSquare className="h-5 w-5" />
            {chatUnread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white ring-2 ring-slate-950">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            )}
          </button>
        </aside>
      )}
    </div>
  );
```

**Important:** when applying this, keep the real contents of the three
participant-layout branches (`screenShareEntry ? (...) : useFocusLayout ? (...) : (...)`)
exactly as they are today — the `null` placeholders above are only shorthand
for "leave this branch untouched". The only real changes are:
(1) the outer `<div>` loses `flex-col` and gains a nested column `<div>`,
(2) the mobile switcher is rendered under the header,
(3) `<main>`'s body is wrapped in a `mobileChatOpen ? <chat> : <existing>` ternary,
(4) two `<aside>` blocks are appended after the column `<div>`.

- [ ] **Step 9b: Guard the desktop focus/PIP width**

No change needed — the focus and screen-share branches already use
`mx-auto h-full max-w-6xl`, and `<main>` stays `flex-1 min-w-0`, so the aside
simply takes 380px from the right. `DraggablePip` clamps to `<main>` (its
offset parent), which is now narrower — correct behaviour.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/calls/CallRoom.jsx apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx
git commit -m "$(cat <<'EOF'
feat(calls): dock in-call chat panel + mobile view switcher

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Full verification

- [ ] **Step 1: Run the two new pure test files**

Run:
```
node --test apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/callChat.test.js apps/desktop/src/modules/atlas.chat/components/__tests__/callLogMeta.test.js
```
Expected: PASS, 0 failures.

- [ ] **Step 2: Web build (the real compile gate for every `.jsx` edit)**

Run: `pnpm --filter @atlas/desktop build:web`
Expected: builds clean, no unresolved imports, no missing exports.
(If the script name differs, use the one in `apps/desktop/package.json` —
e.g. `pnpm --filter @atlas/desktop build`.)

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: clean. Fix any `no-restricted-syntax` (local-date) or unused-import
findings inline.

- [ ] **Step 4: Commit any lint fixups**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(calls): lint pass for the in-call chat panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Manual smoke (documented — no React test harness)**

Requires `LIVEKIT_*` configured and two browser sessions. Capture **390px and
1440px** screenshots per `docs/ai-context/ui-screen-audit-checklist.md`.

Desktop (1440px):
1. Start a call from a 1:1 conversation → call room opens with the chat panel
   **docked and open** on the right; the video area reflows to the left.
2. Type a message in the panel → it appears in the panel **and** in the normal
   `atlas.chat` screen for the other user.
3. Click the header `>` collapse control → panel becomes a 48px rail; reload
   the page (rejoin the call) → panel is **still collapsed**.
4. Send a message from the other user while collapsed → unread badge on the
   rail; click the rail button → panel re-opens, badge clears.
5. Share your screen → screen fills the video area, camera bubbles float via
   `DraggablePip`, panel unaffected.

Mobile (390px):
6. Start/join a call → `Video / Chat` switcher pill under the header (no
   `Pantalla` yet); chat **closed**, video full-screen.
7. Other user shares screen → `Pantalla` segment appears; tap it → full-scale
   share; stop the share → snaps back to `Video`, `Pantalla` segment gone.
8. Tap `Chat` → full-screen chat; hang-up button still visible in the footer.
9. While on `Chat`, other user starts a screen share → violet banner
   "… esta compartiendo pantalla — Ver" at the top of the chat; tap it →
   switches to `Pantalla`.
10. Receive a message while on `Video` → dot on the `Chat` segment; open
    `Chat` → dot clears.

Call card:
11. The call start/end posts a card ("Videollamada iniciada" /
    "Llamada finalizada · m:ss" / "Llamada perdida") visible in both the
    in-call panel and the normal chat; "Volver a llamar" starts a call and is
    hidden while a call is live.

---

## Self-review

- **Spec coverage:**
  - §3.1 component reuse — Task 6 (`CallChatPanel` → `ChatWindow`), providers
    already present under `CallsProvider`.
  - §3.2 `embedded="call"` chrome trim — Task 5.
  - §3.3 `CallChatPanel` theming + collapse — Tasks 6 + 8 (collapse state +
    localStorage live in `CallRoom`, control in `ChatHeader`).
  - §3.4 mobile `video|screen|chat` machine, switcher, `Pantalla` conditional,
    snap-back, banner, unread dot — Tasks 1, 7, 8.
  - §3.5 system messages — Plan A (contract consumed here).
  - §3.6 call card via `getCallMeta` + `CallLogCard`, "Volver a llamar" hidden
    while a call is live — Tasks 2, 3, 4.
  - §4 unread reset on active — Task 8 Step 3.
  - §5 localStorage try/catch, private-mode default expanded — Task 8 Step 1.
- **Placeholder scan:** the `null` shorthands in Task 8 Step 9 are explicitly
  called out as "leave the existing branch untouched", with a paragraph listing
  the four real changes. No TBD/TODO.
- **Type consistency:** `chat` prop shape is defined once in `CallRoom`
  (Task 8 Step 6) and destructured with matching keys + defaults in
  `CallRoomLayout` (Task 8 Step 8): `isMobile, mobileView, onMobileViewChange,
  chatExpanded, onToggleChatExpanded, chatUnread, hasScreenShare, panel`.
  `nextCallView(view, { hasScreenShare })` — same signature in the helper
  (Task 1), its test (Task 1), and its call site (Task 8 Step 4).
  `getCallMeta(message)` — helper (Task 2), test (Task 2), `CallLogCard`
  (Task 3), `ChatMessageBubble` (Task 4). `embedded` / `onCollapse` prop names
  identical across `ChatWindow`, `ChatHeader`, `CallChatPanel`.
- **Not touched:** LiveKit connect/token flow, call setup/ring/accept, the
  three participant-layout branches' internals, `@atlas/ui` (no new exports).

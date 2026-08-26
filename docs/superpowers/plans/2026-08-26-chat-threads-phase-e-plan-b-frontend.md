# Chat Threads Phase E — Plan B (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a member open a thread panel from any message, read/send replies there, and see a reply-count pill on the root message in the main timeline — without replies ever appearing inline.

**Architecture:** New `useThreadReplies`/`useSendThreadReply` hooks (deliberately NOT reusing `useSendMessage`'s optimistic-update logic — see Task 1's warning). New `ThreadPanel.jsx` (Sheet, same pattern as `PinnedMessagesSheet`), reusing `ChatMessageBubble` for the root + each reply. `ChatMessageBubble` gains a reply-count pill and a "Responder en hilo" action. `ChatWindow` owns the panel's open/root-id state, same ownership pattern as `showPinned`/`showDetails`.

**Tech Stack:** React, `@atlas/ui`, TanStack Query.

**Depends on:** Plan A (backend) — must be complete and merged first (this plan reads `message.thread_root_id`/`thread_reply_count`/`thread_last_reply_at`, calls `GET /chat/messages/:id/thread`, and sends with `threadRootId` — all defined in Plan A).

**Spec:** `docs/superpowers/specs/2026-08-26-chat-threads-phase-e-design.md`

**Casing reminder (same as Plan A)**: every `Message` object's own fields are snake_case in the real API response (`thread_root_id`, `thread_reply_count`, `thread_last_reply_at`, same as the pre-existing `deleted_at`/`created_at`/`sender_user_id`). Only the `threadRootId` field inside a `sendMessage` REQUEST body is camelCase. A prior task in this exact codebase (Phase D, commit `7aea017`) shipped a bug from confusing these two — read every snippet below as already correctly cased for its context.

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/modules/atlas.chat/hooks/useThreadReplies.js` | Create | `useThreadReplies(rootMessageId)` query + `useSendThreadReply(rootMessageId)` mutation |
| `apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx` | Create | Root message + reply list + scoped composer, in a `Sheet` |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | Modify | Reply-count pill, "Responder en hilo" action |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx` | Modify | Thread `onOpenThread` through to `ChatMessageBubble` |
| `apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx` | Modify | "Ver en el chat" passes `thread_root_id` so a pinned reply opens its thread instead of a doomed main-timeline scroll |
| `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` | Modify | Own thread-panel open/root-id state; branch `handleJumpToMessage` |

---

### Task 1: Hooks

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/hooks/useThreadReplies.js`

- [ ] **Step 1: Read `useChatMessages.js` and `usePinnedMessages.js` first (required)**

`useSendMessage` (in `useChatMessages.js`) optimistically injects a temp message directly into the `["chat-messages", conversationId]` cache in its `onMutate`. **Do not reuse `useSendMessage` for thread replies** — that cache key backs the MAIN timeline list; a thread reply optimistically pushed into it would flash inside the main timeline for a moment (visually wrong, contradicts spec Goal 2) before the next real fetch corrects it. This is exactly the kind of subtle, easy-to-miss mistake this plan is warning about — write a new, separate mutation targeting the thread's own cache key instead.

- [ ] **Step 2: Implement `useThreadReplies.js`**

```javascript
// apps/desktop/src/modules/atlas.chat/hooks/useThreadReplies.js
import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useRealtimeContext } from "../../../providers/RealtimeProvider";

export function useThreadReplies(rootMessageId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { on } = useRealtimeContext();

  const query = useQuery({
    queryKey: ["chat-thread", rootMessageId],
    queryFn: () => atlas.chat.getThread(rootMessageId, token),
    enabled: Boolean(token && rootMessageId),
    staleTime: 5_000,
  });

  // A reply broadcast carries threadRootId in its payload (Plan A, Task 2
  // Step 5b) — only invalidate this specific thread's query when it's the
  // one that changed, not on every chat.message.new in the conversation.
  useEffect(() => {
    if (!rootMessageId) return;
    return on("chat.message.new", (payload) => {
      if (payload.threadRootId === rootMessageId) {
        queryClient.invalidateQueries({ queryKey: ["chat-thread", rootMessageId] });
      }
    });
  }, [rootMessageId, on, queryClient]);

  return query;
}

export function useSendThreadReply(rootMessageId, conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => atlas.chat.sendMessage(conversationId, { ...data, threadRootId: rootMessageId }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-thread", rootMessageId] });
      // The root's thread_reply_count/thread_last_reply_at (rendered as the
      // main-timeline pill) live inside the main message-list cache — must
      // also invalidate it so the pill updates without waiting for the
      // realtime round-trip.
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
  });
}
```

**Verify before trusting the realtime snippet above**: confirm `useRealtimeContext()`'s `on(eventName, handler)` actually passes the raw broadcast payload object (with `threadRootId` as a direct property) to `handler` as shown — read one existing usage (e.g. `useChatMessages.js`'s own `on("chat.message.new", ({ conversationId: cid }) => {...})` call) to confirm the payload shape/destructuring convention matches, adjust if not.

- [ ] **Step 3: Add `getThread` confirmation**

Confirm `packages/sdk/src/domains/chat.js` already has `getThread` from Plan A, Task 4. If Plan A hasn't been merged/isn't present, stop and report BLOCKED — this plan cannot proceed without it.

- [ ] **Step 4: Build check and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/hooks/useThreadReplies.js
git commit -m "feat(chat): add thread replies query/mutation hooks"
```

---

### Task 2: `ThreadPanel`

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx`

- [ ] **Step 1: Read `PinnedMessagesSheet.jsx` in full first (required)**

`ThreadPanel` follows the identical `Sheet`/loading/empty-state pattern — read that file (58 lines) before writing this one so the structure genuinely matches rather than reinventing it.

- [ ] **Step 2: Implement**

```javascript
// apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, Skeleton } from "@atlas/ui";
import { MessageSquare } from "lucide-react";
import { useThreadReplies, useSendThreadReply } from "../hooks/useThreadReplies";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { MessageComposer } from "./MessageComposer";
import { useAuth } from "../../../auth/AuthProvider";

export function ThreadPanel({ open, onOpenChange, rootMessageId, conversationId, conversationType, members, onToggleReaction }) {
  const { userProfile } = useAuth();
  const currentUserId = userProfile?.id;
  const { data, isLoading } = useThreadReplies(open ? rootMessageId : null);
  const { mutateAsync: sendReply } = useSendThreadReply(rootMessageId, conversationId);

  const root = data?.data?.root;
  const replies = data?.data?.replies ?? [];

  const handleSend = async (payload) => {
    await sendReply(payload);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[hsl(var(--primary))]" />
            Hilo
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          {isLoading && (
            <div className="space-y-2 px-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          )}

          {!isLoading && root && (
            <>
              <ChatMessageBubble
                message={root}
                isOwn={root.sender_user_id === currentUserId}
                isFirst
                isLast
                currentUserId={currentUserId}
                members={members}
                conversationType={conversationType}
                onToggleReaction={onToggleReaction}
                isThreadReplyView
              />
              <div className="border-b border-[hsl(var(--border))] my-2 mx-2" />

              {!replies.length && (
                <p className="text-center text-xs text-[hsl(var(--muted-foreground))] py-6">
                  Se el primero en responder.
                </p>
              )}

              {replies.map((reply, i) => (
                <ChatMessageBubble
                  key={reply.id}
                  message={reply}
                  isOwn={reply.sender_user_id === currentUserId}
                  isFirst={i === 0 || replies[i - 1]?.sender_user_id !== reply.sender_user_id}
                  isLast={i === replies.length - 1 || replies[i + 1]?.sender_user_id !== reply.sender_user_id}
                  currentUserId={currentUserId}
                  members={members}
                  conversationType={conversationType}
                  onToggleReaction={onToggleReaction}
                  isThreadReplyView
                />
              ))}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-[hsl(var(--border))]">
          <MessageComposer
            onSend={handleSend}
            placeholder="Responder en el hilo..."
            compact
            conversationId={conversationId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Note the new `isThreadReplyView` prop passed to every `ChatMessageBubble` here — Task 3 below adds this prop to `ChatMessageBubble` specifically to suppress the "Responder en hilo" action menu item on messages already being viewed inside a thread panel (spec Section 8 — a thread's own root/replies never offer to start ANOTHER reply-in-thread from inside the panel).

**Verify before trusting this snippet**: `ChatMessageBubble`'s actual current prop list (post Phase D) — re-read it directly (it's ~999 lines, use targeted reads around its function signature and prop destructuring, not a full read) to confirm every prop passed above (`isOwn`, `isFirst`, `isLast`, `currentUserId`, `members`, `conversationType`, `onToggleReaction`) is spelled exactly as the component expects, and that omitting props this snippet doesn't pass (`onCopy`, `onDelete`, `onPin`, etc.) degrades gracefully (each of those is already optional/conditionally-rendered in `MessageActions`, per Phase D's own code — confirm this holds rather than assuming it).

- [ ] **Step 3: Build check and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx
git commit -m "feat(chat): add ThreadPanel component"
```

---

### Task 3: Wire into `ChatMessageBubble`/`ChatMessageList`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx`

This is the highest-risk task in this plan, for the exact reason Phase D's own equivalent task was — it touches the same `MessageActions`/bubble-branch structure that has already caused a real, reviewer-caught bug once this phase alone (Phase D's `hasBody`/`!isDeleted` gating mismatch) and a more severe one in Phase C (mention-chip rendering only reaching one of two render branches). Read `ChatMessageBubble.jsx` in full before editing — it's ~999 lines, right at the proactive-split threshold (spec Section 24 Risk 4 — do not let this task push it over 1000 without flagging it).

- [ ] **Step 1: Add `isThreadReplyView`, `onOpenThread` props and the "Responder en hilo" gating**

In `MessageActions`, add a new prop `canReply` (computed by the caller, same pattern as `canPin`) and a new item, placed after the "Fijar/Desfijar mensaje" item and before the separator:

```javascript
        {canReply && onOpenThread && (
          <DropdownMenuItem onSelect={onOpenThread}>
            <MessageSquare className="h-3.5 w-3.5 mr-2" />
            Responder en hilo
          </DropdownMenuItem>
        )}
```

Import `MessageSquare` from `lucide-react` alongside the existing `Pin, PinOff, Smile` imports (check first whether `MessageSquare` is already imported for something else in this file — if so, use `Reply` instead, per spec Section 8's explicit either/or).

Extend the separator-gating boolean (the one already extended once in Task 3 of Phase D's plan, currently `(hasBody && onCopy || onForward || onEnterSelection || (canPin && onPin) || onReact)`) to also include `|| (canReply && onOpenThread)`.

- [ ] **Step 2: Compute `canReply` in the main component**

Near where `canPin` is already computed (search for `const canPin =`):

```javascript
  const canReply =
    !isThreadReplyView &&
    (conversationType === "channel" || conversationType === "group") &&
    !message.thread_root_id;
```

(`!isThreadReplyView` suppresses the item inside `ThreadPanel` per Task 2's note; `!message.thread_root_id` suppresses it on a message that is ITSELF already a reply, even outside the panel, per spec Section 8 — though in practice a reply never renders outside `ThreadPanel` today since `listMessages` filters them out server-side, this guard is still correct defense-in-depth and costs nothing.)

- [ ] **Step 3: Add the reply-count pill**

In both the own-message and other-message render branches, immediately after the existing `<MessageReactions .../>` render (added in Phase D), add:

```javascript
          {!isDeleted && message.thread_reply_count > 0 && (
            <button
              type="button"
              onClick={() => onOpenThread?.()}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-[hsl(var(--primary))] hover:underline"
            >
              <MessageSquare className="h-3 w-3" />
              {message.thread_reply_count} {message.thread_reply_count === 1 ? "respuesta" : "respuestas"}
              {message.thread_last_reply_at && ` · ${formatMessageTime(message.thread_last_reply_at)}`}
            </button>
          )}
```

Both branches call the same `onOpenThread?.()` (no argument — the bubble already knows its own `message.id`, so wrap it at the prop-threading level in Step 4 below rather than passing an id up through this click handler).

- [ ] **Step 4: Thread `onOpenThread`/`isThreadReplyView` through `ChatMessageBubble`'s prop list and `ChatMessageList`**

`ChatMessageBubble`'s main function signature gains two new props: `isThreadReplyView = false` and `onOpenThreadForMessage` (a `(messageId) => void` callback from the parent — named differently from the bubble's own internal `onOpenThread?.()` call in Step 3, which is derived, not passed raw):

```javascript
export function ChatMessageBubble({
  message, isOwn, isFirst, isLast, currentUserId, members, conversationType,
  // ...all existing props, unchanged...
  isThreadReplyView = false,
  onOpenThreadForMessage,
  ...
}) {
  // ...
  const onOpenThread = onOpenThreadForMessage ? () => onOpenThreadForMessage(message.id) : undefined;
```

Read the actual current prop destructuring list first (it's long, ~15+ props already per Phase D) — insert these two alongside the existing `isPinned`/`onPin`/`onToggleReaction` props rather than guessing their exact position; order doesn't matter functionally but keep it readable (group with the other thread/Phase-D-era props).

In `ChatMessageList.jsx`, add `onOpenThread` to its own prop list and thread it to the single `<ChatMessageBubble>` call site as `onOpenThreadForMessage={onOpenThread}` (confirm — per Task 3 of Phase D's plan — that there is still only ONE `<ChatMessageBubble>` call site in this file, own/other split happens inside the bubble itself; re-verify this hasn't changed rather than trusting the prior phase's finding blindly).

- [ ] **Step 5: Build check**

Run: `pnpm --filter @atlas/desktop exec vite build`

- [ ] **Step 6: Self-review against the two known failure modes**

Explicitly trace, and state the answer to each in your report:
1. Does the reply-count pill render in BOTH the own-message and other-message branches (not just one)? (Phase C's exact failure mode.)
2. Is `canReply`'s gate condition (`channel`/`group` + not-a-reply + not-in-panel-view) consistent with what Plan A's backend actually allows (any member can reply in `channel`/`group`, no rank gating) — is there a state where the UI hides the option but the backend would have allowed it, or shows it where the backend would 404/reject? (Phase D's exact failure mode, twice.)

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx
git commit -m "feat(chat): add reply-count pill and Responder en hilo action"
```

---

### Task 4: Wire `ThreadPanel` into `ChatWindow`, fix the pinned-reply jump fallback

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx`

- [ ] **Step 1: Read the current `ChatWindow.jsx` state around `showPinned`/`jumpTarget`/`handleJumpToMessage` first (required)**

These already exist (added in Phase D, Task 4) at approximately lines 454-498 — read them directly, the exact line numbers may have shifted.

- [ ] **Step 2: Add thread-panel state**

Alongside the existing `const [showPinned, setShowPinned] = useState(false);`:

```javascript
  const [threadPanelRootId, setThreadPanelRootId] = useState(null);
```

(`null` = closed; a message id = open, showing that message's thread. No separate boolean needed — matches the existing `jumpTarget` pattern of using presence-of-value as the open flag, one line above it in this same file.)

Add it to the existing conversation-change reset effect (the one that already resets `showPinned`/`jumpTarget`):

```javascript
    setThreadPanelRootId(null);
```

- [ ] **Step 3: Branch `handleJumpToMessage` for a pinned thread reply**

Read the current implementation first. It currently takes only `messageId`. Extend it:

```javascript
  const handleJumpToMessage = useCallback((messageId, threadRootId) => {
    setShowPinned(false);
    if (threadRootId) {
      setThreadPanelRootId(threadRootId);
      return;
    }
    setFilesView(false);
    setJumpTarget({ id: messageId, nonce: Date.now() });
  }, []);
```

- [ ] **Step 4: Wire `onOpenThread` into `ChatMessageList`**

Find where `<ChatMessageList ... onPinMessage={...} onToggleReaction={...} .../>` is called (from Phase D's Task 3/4 work) and add:

```javascript
          onOpenThread={(messageId) => setThreadPanelRootId(messageId)}
```

- [ ] **Step 5: Render `ThreadPanel`**

Near the existing `<PinnedMessagesSheet ... />` render:

```javascript
      <ThreadPanel
        open={Boolean(threadPanelRootId)}
        onOpenChange={(open) => { if (!open) setThreadPanelRootId(null); }}
        rootMessageId={threadPanelRootId}
        conversationId={conversationId}
        conversationType={conversation?.type}
        members={detailMembers ?? conversation.members}
        onToggleReaction={(messageId, emoji) => toggleReactionMutate({ messageId, emoji })}
      />
```

Import `ThreadPanel` at the top of the file alongside the existing `PinnedMessagesSheet` import.

- [ ] **Step 6: Fix `PinnedMessagesSheet`'s "Ver en el chat" to pass `thread_root_id`**

Read `PinnedMessagesSheet.jsx`'s current "Ver en el chat" button (`onClick={() => onJumpToMessage?.(msg.id)}`) and change it to:

```javascript
                <Button size="sm" variant="outline" onClick={() => onJumpToMessage?.(msg.id, msg.thread_root_id)}>Ver en el chat</Button>
```

This is the fix for spec Section 24 Risk 3 — a pinned thread reply's `msg.thread_root_id` is populated by Plan A's `getMessageFull` change, so this now correctly routes to opening the thread instead of attempting an impossible main-timeline DOM scroll.

- [ ] **Step 7: Build check**

Run: `pnpm --filter @atlas/desktop exec vite build`

- [ ] **Step 8: Check `ChatWindow.jsx`'s line count**

If this task pushed it past 1000 lines, flag this explicitly in your report (do not silently let it balloon; do not attempt a speculative unrelated refactor to fix it either — out of scope for this task, matches Phase D Task 4's own documented boundary).

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx
git commit -m "feat(chat): wire ThreadPanel into ChatWindow, fix pinned-reply jump fallback"
```

---

## Self-Review Notes

- **Spec coverage**: Task 1-2 cover Section 8's `ThreadPanel` UX and the hooks layer. Task 3 covers the reply-count pill and "Responder en hilo" (Section 8, Section 24 Risk 4's file-size guard). Task 4 covers the header/panel-ownership wiring and Section 24 Risk 3's pinned-reply-jump fix.
- **Deviation from spec's illustrative wording, noted explicitly**: Section 8's UX requirement describes the pill as "hace Xm" (relative time). This plan uses `formatMessageTime` (day-bucketed absolute/near-absolute, e.g. "14:32"/"Ayer"/weekday) instead, matching how every other per-message timestamp already renders throughout this module (including `PinnedMessagesSheet`, Phase D) — introducing a second, different relative-time format (`formatLastSeen`'s "hace X min" style, currently local to `ChatWindow.jsx` and used only for presence, not messages) for this one pill would be a new, inconsistent pattern rather than reuse. If the implementer or reviewer disagrees with this substitution, it's a one-line change (swap `formatMessageTime` for an extracted relative-time helper) — flagged here rather than silently deviating from the spec's literal wording.
- **Known gap, out of scope for this plan (documented, not silently dropped)**: `FloatingChatHub.jsx`/`ExternalInboxScreen.jsx` are not wired for thread replies (no reply-count pill, no "Responder en hilo", no `ThreadPanel` reachable). `ExternalInboxScreen` is correctly excluded by spec Non-goal 3 (`external_support` has no threads). `FloatingChatHub` CAN render `channel`/`group` conversations, so it's a real, narrower version of the exact gap Phase D's own review caught for reactions in that same file — noted here as a conscious scope cut (the mini-widget already lacks Search/Pinned-messages entry points too, per Phase D's own precedent of treating `FloatingChatHub` as a deliberately reduced surface with "open full window" as the escape hatch) rather than an oversight, but flagged explicitly so a reviewer can decide whether that precedent still holds or whether this phase should close it.
- **No placeholders** except explicitly-flagged "verify against the real prop list/payload shape before trusting this snippet" notes (Task 1 Step 2, Task 2 Step 2, Task 3 Step 4) — all "read the real code first" directives, matching this plan's own and Phase D's established convention, not gaps in this plan's logic.

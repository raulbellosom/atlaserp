# Chat Pins & Reactions Phase D — Plan B (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a member pin/unpin a message (permission-gated) and react with an emoji (unprivileged), and see reaction pills + a pinned-messages list.

**Architecture:** New hooks wrap the already-complete backend (Plan A, all committed). `MessageActions` (in `ChatMessageBubble.jsx`) gains "Fijar/Desfijar" and "Reaccionar" items. A new small `MessageReactions.jsx` renders reaction pills under a bubble (extracted from the start per spec risk 1 — `ChatMessageBubble.jsx` is already ~926 lines). A new `PinnedMessagesSheet.jsx` (same `Sheet` pattern as `ChannelDirectorySheet`/`ChannelDetailsSheet` from earlier phases) is opened from `ChatHeader`.

**Tech Stack:** React, `@atlas/ui`, `emoji-picker-react` (already a dependency, already used by `MessageComposer.jsx` — reused as-is for the reaction picker, not reimplemented).

**Depends on:** Plan A (backend) — complete (commits `fdf4ddb`, `a76a54b`, `8e57910`, `c3ab50b`).

**Spec:** `docs/superpowers/specs/2026-08-26-chat-pins-reactions-phase-d-design.md`

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` | Modify | Add `usePinMessage`, `useToggleReaction` mutations |
| `apps/desktop/src/modules/atlas.chat/hooks/usePinnedMessages.js` | Create | `usePinnedMessages(conversationId)` query |
| `apps/desktop/src/modules/atlas.chat/components/MessageReactions.jsx` | Create | Reaction pill row (grouped, toggle-on-click, "you reacted" highlight) |
| `apps/desktop/src/modules/atlas.chat/components/MessageReactionPicker.jsx` | Create | Small popover wrapping `EmojiPicker` for adding a reaction |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx` | Modify | Pin/unpin + react actions in `MessageActions`; render `MessageReactions`; pinned-message visual indicator |
| `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx` | Modify | Thread `conversationType`, `onPin`, `onReact` through to `ChatMessageBubble` |
| `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` | Modify | Wire pin/react handlers; pass `conversation.type` down; header pinned-count button |
| `apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx` | Create | Pinned messages list sheet |

---

### Task 1: Hooks

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js`
- Create: `apps/desktop/src/modules/atlas.chat/hooks/usePinnedMessages.js`

- [ ] **Step 1: Read `useChatMessages.js` first**

Confirm its existing query-key convention for a conversation's message list (needed so the new mutations invalidate the right key on success — reactions/pin state live inside each message object, which that list query already returns per Plan A's backend changes).

- [ ] **Step 2: Add `usePinMessage` and `useToggleReaction`**

Append to `useChatMessages.js` (same file `useSendMessage`/`useDeleteMessage` already live in, per this module's existing convention of grouping message-mutation hooks together):

```javascript
export function usePinMessage(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, pinned }) => atlas.chat.pinMessage(messageId, pinned, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-pinned-messages", conversationId] });
    },
  });
}

export function useToggleReaction(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji }) => atlas.chat.toggleReaction(messageId, emoji, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
  });
}
```

**IMPORTANT:** the query key `["chat-messages", conversationId]` above is a GUESS at this file's real convention — read `useChatMessages`'s actual `useQuery` call in this same file first and match its exact key shape (it may be `["chat-messages", conversationId]`, `["chat", conversationId, "messages"]`, or include a cursor/limit — copy whatever the real query already uses so invalidation actually hits the right cache entry; an invalidation call using the wrong key silently does nothing).

- [ ] **Step 3: Create `usePinnedMessages.js`**

```javascript
// apps/desktop/src/modules/atlas.chat/hooks/usePinnedMessages.js
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export function usePinnedMessages(conversationId) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ["chat-pinned-messages", conversationId],
    queryFn: () => atlas.chat.listPinnedMessages(conversationId, token),
    enabled: Boolean(token && conversationId),
    staleTime: 15_000,
  });
}
```

- [ ] **Step 4: Build check and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js apps/desktop/src/modules/atlas.chat/hooks/usePinnedMessages.js
git commit -m "feat(chat): add pin/reaction/pinned-messages data hooks"
```

---

### Task 2: Reaction pills + picker

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/MessageReactions.jsx`
- Create: `apps/desktop/src/modules/atlas.chat/components/MessageReactionPicker.jsx`

- [ ] **Step 1: Implement `MessageReactions.jsx`**

```javascript
// apps/desktop/src/modules/atlas.chat/components/MessageReactions.jsx
// Renders the pill row under a message bubble. `reactions` is the message's
// own `reactions` field from the API — `{ emoji, userIds }[]` or null/undefined
// for a message with none (already aggregated server-side, Plan A backend).
export function MessageReactions({ reactions, currentUserId, onToggle }) {
  if (!reactions?.length) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map(({ emoji, userIds }) => {
        const mine = currentUserId && userIds?.includes(currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            className={[
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
              mine
                ? "bg-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                : "bg-[hsl(var(--muted))] border-transparent hover:border-[hsl(var(--border))]",
            ].join(" ")}
          >
            <span>{emoji}</span>
            <span className="tabular-nums">{userIds?.length ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Implement `MessageReactionPicker.jsx`**

```javascript
// apps/desktop/src/modules/atlas.chat/components/MessageReactionPicker.jsx
import { useState, useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";

// A minimal popover wrapping the same EmojiPicker MessageComposer.jsx already
// uses for its own emoji button — same library, same visual language, not a
// reimplementation. `onPick(emoji)` receives the plain emoji character.
export function MessageReactionPicker({ open, onOpenChange, onPick, anchorAlign = "start" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className={["absolute bottom-full mb-1 z-50 shadow-xl rounded-xl overflow-hidden", anchorAlign === "end" ? "right-0" : "left-0"].join(" ")}
    >
      <EmojiPicker
        onEmojiClick={(emojiData) => { onPick(emojiData.emoji); onOpenChange(false); }}
        theme="dark"
        width={260}
        height={320}
        searchPlaceholder="Buscar emoji..."
        lazyLoadEmojis
        skinTonesDisabled
        autoFocusSearch={false}
      />
    </div>
  );
}
```

Note: this component assumes its parent renders it inside a `position: relative` container (so `absolute bottom-full` anchors correctly) — the integration task (Task 3) is responsible for that positioning context, matching how `MessageComposer.jsx`'s own emoji picker is already positioned relative to its trigger button.

- [ ] **Step 3: Build and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/components/MessageReactions.jsx apps/desktop/src/modules/atlas.chat/components/MessageReactionPicker.jsx
git commit -m "feat(chat): add reaction pill display and picker components"
```

---

### Task 3: Wire pin + react into `ChatMessageBubble`/`MessageActions`, thread props through `ChatMessageList`/`ChatWindow`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx`

- [ ] **Step 1: Read all three files in full first (required)**

This is the highest-risk task in this plan — it touches the same `MessageActions`/`ChatMessageBubble` structure that a prior phase (Phase C) had to carefully thread `currentUserId`/`members` through (see `ChatMessageList.jsx`'s existing `currentUserId`/`members` props, already wired). Follow the exact same threading pattern for the two new pieces of data this task needs: `conversationType` (from `ChatWindow`'s already-in-scope `conversation.type`) and the pin/react handlers.

- [ ] **Step 2: Compute permission gating**

In `ChatMessageBubble.jsx`, near where Phase C's `isMentioned`/`ownRoleId` computation already lives (it already derives the viewer's own member entry from the `members` prop), add:
```javascript
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";
```
(if not already imported — check first, `chatPermissions.js` may already be imported for the mention-highlight feature) and compute:
```javascript
  const ownMember = findOwnMember(members, currentUserId); // may already exist from Phase C — reuse, don't duplicate
  const canPin = (conversationType === "channel" || conversationType === "group") && roleHasPermission(ownMember, CHAT_PERMISSIONS.MESSAGES_PIN);
```

- [ ] **Step 3: Add pin/react actions to `MessageActions`**

Extend `MessageActions`'s props with `canPin`, `isPinned`, `onPin`, `onReact` (a function accepting `(emoji) => void`, already resolved — the picker's own open/close state lives locally in `ChatMessageBubble`, not in `MessageActions`). Add two new `DropdownMenuItem`s (import `Pin`, `PinOff`, `Smile` from `lucide-react`):
```javascript
        {canPin && onPin && (
          <DropdownMenuItem onSelect={onPin}>
            {isPinned ? <PinOff className="h-3.5 w-3.5 mr-2" /> : <Pin className="h-3.5 w-3.5 mr-2" />}
            {isPinned ? "Desfijar mensaje" : "Fijar mensaje"}
          </DropdownMenuItem>
        )}
        {hasBody && onReact && (
          <DropdownMenuItem onSelect={onReact}>
            <Smile className="h-3.5 w-3.5 mr-2" />
            Reaccionar
          </DropdownMenuItem>
        )}
```
Place these consistently with the existing item ordering/separator logic (read the current separator conditions and extend them sensibly rather than guessing — the existing code has a single `DropdownMenuSeparator` gated on a specific boolean expression; decide whether the new items need their own separator or fit within the existing grouping, and justify your choice in your report).

- [ ] **Step 4: Wire the reaction picker popover and reaction pills into the bubble body**

In `ChatMessageBubble`'s main render (both own-message and other-message layouts), add local state `const [reactionPickerOpen, setReactionPickerOpen] = useState(false);`, pass `onReact={() => setReactionPickerOpen(true)}` into `MessageActions`, and render (inside a `relative`-positioned wrapper around the bubble, or reusing an existing one if the bubble container is already `relative` — check first):
```javascript
<MessageReactionPicker
  open={reactionPickerOpen}
  onOpenChange={setReactionPickerOpen}
  onPick={(emoji) => onToggleReaction?.(message.id, emoji)}
  anchorAlign={isOwn ? "end" : "start"}
/>
```
and, right after the message body render (before or after attachments — your call based on visual flow, note which you chose):
```javascript
<MessageReactions
  reactions={message.reactions}
  currentUserId={currentUserId}
  onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
/>
```
`onToggleReaction` and `onPin`/`isPinned` are new props `ChatMessageBubble` needs from its parent (`ChatMessageList`) — add them to its prop list.

- [ ] **Step 5: Add a visual pinned indicator**

Somewhere unobtrusive in the bubble (e.g. a small `Pin` icon near the timestamp) when `message.pinnedAt` is truthy — keep this small, don't restructure the bubble's layout.

- [ ] **Step 6: Thread through `ChatMessageList.jsx`**

Add `conversationType`, `onPinMessage`, `onToggleReaction` to `ChatMessageList`'s prop list, and pass them down to each `<ChatMessageBubble .../>` call (both the own-message and other-message render branches, same as how `onDeleteMessage`/`onForward`/etc. are already conditionally passed) — e.g.:
```javascript
            conversationType={conversationType}
            isPinned={Boolean(item.pinnedAt)}
            onPin={onPinMessage ? () => onPinMessage(item.id, !item.pinnedAt) : undefined}
            onToggleReaction={onToggleReaction}
```

- [ ] **Step 7: Wire through `ChatWindow.jsx`**

Import and call the new hooks:
```javascript
import { usePinMessage, useToggleReaction } from "../hooks/useChatMessages";
```
```javascript
  const { mutate: pinMutate } = usePinMessage(conversationId);
  const { mutate: toggleReactionMutate } = useToggleReaction(conversationId);
```
Pass to `<ChatMessageList .../>`:
```javascript
        conversationType={conversation?.type}
        onPinMessage={(messageId, pinned) => pinMutate({ messageId, pinned })}
        onToggleReaction={(messageId, emoji) => toggleReactionMutate({ messageId, emoji })}
```

- [ ] **Step 8: Build and manual sanity check**

```bash
pnpm --filter @atlas/desktop exec vite build
```

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ChatMessageBubble.jsx apps/desktop/src/modules/atlas.chat/components/ChatMessageList.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): wire pin and reaction actions into the message bubble"
```

---

### Task 4: `PinnedMessagesSheet` + header entry point

**Files:**
- Create: `apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx`
- Modify: `apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx` (the `ChatHeader` sub-component within it)

- [ ] **Step 1: Implement `PinnedMessagesSheet.jsx`**

```javascript
// apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, EmptyState, Skeleton, Button } from "@atlas/ui";
import { Pin } from "lucide-react";
import { usePinnedMessages } from "../hooks/usePinnedMessages";
import { usePinMessage } from "../hooks/useChatMessages";
import { renderMentionText } from "@atlas/ui";
import { formatMessageTime } from "../lib/chatUtils";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

export function PinnedMessagesSheet({ open, onOpenChange, conversationId, currentUserId, members, onJumpToMessage }) {
  const { data, isLoading } = usePinnedMessages(conversationId);
  const { mutate: pinMutate } = usePinMessage(conversationId);
  const messages = data?.data ?? [];
  const ownMember = findOwnMember(members ?? [], currentUserId);
  const canUnpin = roleHasPermission(ownMember, CHAT_PERMISSIONS.MESSAGES_PIN);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-[hsl(var(--primary))]" />
            Mensajes fijados
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-3">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          )}

          {!isLoading && !messages.length && (
            <EmptyState icon={Pin} title="Sin mensajes fijados" description="Los mensajes importantes fijados apareceran aqui." />
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium truncate">{msg.sender?.displayName ?? "Usuario"}</span>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">{formatMessageTime(msg.created_at)}</span>
              </div>
              <p className="text-sm line-clamp-3 whitespace-pre-wrap wrap-break-word">{renderMentionText(msg.body)}</p>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => onJumpToMessage?.(msg.id)}>Ver en el chat</Button>
                {canUnpin && (
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-500" onClick={() => pinMutate({ messageId: msg.id, pinned: false })}>
                    Desfijar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Note: verify `formatMessageTime` is genuinely exported from `../lib/chatUtils` (it's already used by other components in this module per earlier phases) before relying on the import — read that file if unsure. `onJumpToMessage` is a best-effort callback (scroll-to-message in the main thread) — if `ChatMessageList`/`ChatWindow` doesn't already have a scroll-to-message mechanism, it's acceptable for this prop to be a no-op stub for this phase (note this as a scope cut rather than building a new scroll-targeting system) — check first whether one already exists (e.g. from the existing search-jump-to-match feature, which likely already has similar scroll logic you can reuse) before assuming you need to build one from scratch.

- [ ] **Step 2: Wire a header entry point**

In `ChatWindow.jsx`'s `ChatHeader` sub-component: read the current header button layout (it already has Search/Files/More-menu icon buttons in a row, per earlier phases). Add a `Pin` icon button, visible only when `pinnedCount > 0` (compute from `usePinnedMessages` or from a lighter-weight count already available — check if the conversation object already carries a pinned count, otherwise call `usePinnedMessages` directly in `ChatHeader` and use `data?.data?.length`), opening local state that renders `<PinnedMessagesSheet ... />` — same `useState` + conditional-render pattern already used for `ChannelDetailsSheet` (Phase B) in this same file.

- [ ] **Step 3: Build and commit**

```bash
pnpm --filter @atlas/desktop exec vite build
git add apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx apps/desktop/src/modules/atlas.chat/components/ChatWindow.jsx
git commit -m "feat(chat): add pinned messages sheet and header entry point"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1-4 together cover spec Section 8's full UX requirements and acceptance criteria 1-5.
- **File-size discipline:** reaction pills and the reaction picker are separate components from the start (spec risk 1), not inlined into the already-large `ChatMessageBubble.jsx`.
- **Learned from Phase C's review cycle:** Task 3 Step 1 explicitly requires reading all three touched files in full before editing (the exact discipline that would have caught Phase C's mention-chip-render-path mistake earlier) — and Task 4 explicitly asks the implementer to check for an existing scroll/jump mechanism before building a new one, rather than assuming one exists or building a redundant one blind.
- **No placeholders** except the explicitly-flagged "verify the real query key" (Task 1) and "check for an existing jump-to-message mechanism" (Task 4) instructions — both are deliberate "read the real code" directives, not gaps in this plan's own logic.

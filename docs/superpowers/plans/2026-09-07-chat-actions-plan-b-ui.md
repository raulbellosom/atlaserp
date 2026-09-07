# Plan B (UI) — atlas.chat message actions

Spec: `docs/superpowers/specs/2026-09-07-chat-scroll-and-message-actions-design.md`
Status: implemented 2026-09-07 (commit ac550385).
Depends on Plan A (SDK `atlas.chat.forwardMessages`, search DM titles).
Scope: `apps/desktop/src/modules/atlas.chat/**`, no API changes.

## B1 — "C Chat" client verification

File: `components/MessageSearchResults.jsx`

- Server now returns a resolved `conversation.title` / `avatarUrl` for direct
  chats (Plan A1). Keep `conversation.title ?? "Chat"` as the last-ditch
  fallback but confirm the resolved value renders. If the group header still
  needs the current user id to disambiguate, thread `currentUserId` through
  and use `getConversationDisplayName`.

Verify: manual — global search of a DM shows the person's name + avatar.

## B2 — Mobile long-press popover

Files: `components/MessageActionSheet.jsx`, `components/ChatMessageBubble.jsx`,
`hooks/useLongPress.js` (or wherever `onLongPress` nulls the point on mobile).

- `useLongPress`: stop passing `point: null` on mobile — always forward the
  press coordinates. (In `ChatMessageBubble` the `onLongPress` already builds
  the point from `e.clientX/Y`; just remove any mobile-specific null-out.)
- `MessageActionSheet` `isMobile` branch: delete the `Sheet`. Render via
  `createPortal(..., document.body)`:
  - a fixed inset-0 scrim `bg-black/40` (tap or Esc -> `onOpenChange(false)`),
  - a fixed panel positioned from `anchorPoint`: `left` clamped to
    `[8, vw - panelW - 8]`, `top` = `anchorPoint.y + 8`, flipped to
    `anchorPoint.y - panelH - 8` when it would overflow `vh - 8`; measure with
    a ref + `useLayoutEffect`.
  - panel: `chat-glass-theme chat-glass rounded-2xl` with the existing
    `quickRow(false)` + primary/danger lists (reuse the current mobile markup).
  - keep the `armed` 400ms gate.
- `ChatMessageBubble`: while `actionSheet.open`, add `relative z-[60]` + a
  slight `scale-[1.02]` transition to the message row so it sits above the
  scrim.

Verify: 390px viewport — long-press a message near the top, middle, and
bottom of the list; panel stays on screen, scrim dismisses, reaction + action
taps work. Desktop right-click unchanged.

## B3 — Forward icon

Files: `lib/messageActions.jsx`, `components/ForwardMessageModal.jsx`,
`components/ChatWindow.jsx`.

- Replace `Share2` with `Forward` from lucide in all three (the `forward`
  action entry, the modal `DialogTitle`, the selection-toolbar button).
- Remove now-unused `Share2` imports.

Verify: `pnpm lint`; icons render.

## B4 — Copy multiple messages

File: `components/ChatWindow.jsx` (+ import `Copy` from lucide, `toast`).

- Selection toolbar (`selectionCount > 0` block): add a "Copiar" button
  before "Reenviar".
- `handleCopySelected` (`useCallback`):
  - `msgs = (messagesData?.data ?? []).filter(m => selectedMsgIds.has(m.id) && m.body && !m.deleted_at)`
    sorted by `created_at` asc.
  - line = `[${toLocalIso date d/m/yy}, ${h:mm}] ${sender.displayName ?? "Usuario"}: ${body}`
    using `@atlas/core` local-time helpers (no `toISOString`; lint rule bans it).
  - `await navigator.clipboard.writeText(lines.join("\n"))` in try/catch,
    `toast.success("Mensajes copiados")`, `exitSelectionMode()`.
- Pass `onCopySelected={handleCopySelected}` into the header component and wire
  the button.

Verify: select 3 messages, Copiar, paste elsewhere -> WhatsApp-style transcript,
chronological.

## B5 — Forward modal with attachments + rewire selection

Files: `components/ForwardMessageModal.jsx`, `components/ChatWindow.jsx`,
`hooks/useChatMessages.js` (only if a helper is needed).

- `ChatWindow`:
  - state `forwardTarget` (`{ messageIds }`) replaces `forwardMessage`.
  - `onForward={(m) => setForwardTarget({ messageIds: [m.id] })}`.
  - `handleForwardSelected` -> ordered `messageIds` from `selectedMsgIds`
    (order by position in `messagesData.data`), `setForwardTarget(...)`,
    `exitSelectionMode()`. Drop the body-concatenation.
  - `<ForwardMessageModal open={Boolean(forwardTarget)} messageIds={forwardTarget?.messageIds ?? []} sourceMessages={<resolved from messagesData.data>} conversations={...} onClose={() => setForwardTarget(null)} />`.
- `ForwardMessageModal`:
  - props: `messageIds`, `sourceMessages` (array of full message objects),
    `conversations`, `open`, `onClose`.
  - preview: up to 3 rows; per message show body snippet (`renderMentionText`,
    `line-clamp-2`) or, when no body, an attachment chip row (icon by mime +
    `file_name`, "+N" when `attachment_count > shown`). "+N mensajes mas" when
    `messageIds.length > 3`.
  - remove the `!canForward` / `!message?.body` gate; `canForward =
    messageIds.length > 0`.
  - `handleForward`: `await atlas.chat.forwardMessages({ messageIds, targetConversationIds: orderedIds }, token)`;
    `queryClient.invalidateQueries({ queryKey: ["chat-conversations"] })` and
    for each target `["chat-messages", id]`; toast; `handleClose`.
  - button label: `count > 1 ? "Reenviar a N chats" : "Reenviar"`; disabled
    while `isSending` or `targetCount === 0`.

Verify: forward a photo message + a text message together to 2 chats; both
arrive in both, with the image visible, in original order.

## B6 — "Reenviado" label

File: `components/ChatMessageBubble.jsx`.

- When `message.metadata?.forwardedFrom`, render above the body a small muted
  row: `<Forward className="h-3 w-3" /> Reenviado`, `text-[11px]
  text-[hsl(var(--muted-foreground))] italic`, matching the existing
  edited/pinned marker treatment. Applies to own and other bubbles. Not shown
  for `date_separator` / system rows.

Verify: forwarded messages show the label; normal messages do not.

## B7 — Search-jump edge cases

File: `components/ChatMessageList.jsx` (+ `ChatWindow.jsx` for thread routing).

- `revealMessageId` state: set to `scrollToMessage.id` when a jump starts;
  `visibleMessages` includes a row whose id equals `revealMessageId` even if
  it is in `hiddenMessageIds`. Cleared when the jump resolves or
  `scrollToMessage` changes.
- In the jump's `tryScroll` give-up branch: before `onJumpFailed`, if the
  target message object (look it up in `messages`) has `thread_root_id`, call
  a new `onJumpToThread(threadRootId, targetId)` prop instead; `ChatWindow`
  maps it to `setThreadPanelRootId(threadRootId)` + passes the target into
  `ThreadPanel` as its own `scrollToMessage`.
- Else on give-up also do `topSentinelRef.current?.scrollIntoView({ block: "start" })`
  (or `listRef.current.scrollTop = 0`) so the view sits at the oldest loaded
  message, then `onJumpFailed?.()`.

Verify: search a hidden-for-me message -> it appears and flashes; search a
thread reply -> thread panel opens on it; search something older than the
loaded history -> list ends at the top + toast.

## Done when

- `pnpm lint` green.
- `apps/desktop` `vite build` green.
- Any existing chat component tests green; new ones for `handleCopySelected`
  format + `ForwardMessageModal` attachment preview added where a test file
  exists.
- Manual QA at 390px and 1440px in both `ChatWindow` and `MiniChatWindow`.

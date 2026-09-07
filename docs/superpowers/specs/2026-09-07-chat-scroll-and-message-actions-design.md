# atlas.chat — scroll-on-open fix + message actions overhaul

Date: 2026-09-07
Status: approved
Author: Raul Belloso Medina (with Claude)

## Context

A batch of atlas.chat annoyances reported from daily use:

1. Opening a conversation frequently starts scrolled near the top and then
   animates one long scroll down to the bottom, instead of landing instantly
   at the bottom / first unread message.
2. Searching the history sometimes only shows the "message may be further
   back" toast and never scrolls to / opens the found message.
3. The global message-search results show a group header labelled "C Chat"
   for direct conversations instead of the other participant's name/avatar.
4. On mobile the per-message long-press opens a bottom sheet; it should open
   an anchored popover over the message (iMessage/Telegram style).
5. The forward action uses the "share" icon instead of a forward icon.
6. There is no way to copy several selected messages at once.
7. Forwarding selected messages drops their attachments — only the combined
   text is forwarded.

## Goals

- Conversation opens land at the bottom (or first unread) with no visible
  catch-up animation, on every conversation, every time.
- History-search jumps reliably navigate to the target, including messages
  hidden-for-me, thread replies, and targets deep in history.
- Direct-conversation search results show the other participant.
- Mobile long-press shows an anchored popover, not a bottom sheet.
- Forward uses a forward icon everywhere.
- Selected messages can be copied to the clipboard (WhatsApp-style transcript).
- Forwarding carries the original attachments and tags the result as
  "Reenviado".

## Non-goals

- Reworking the desktop hover menu or right-click menu (unchanged).
- Forward to non-chat targets, scheduled forward, or forward with a caption.
- Copying attachments to the OS clipboard (text transcript only).
- Storage-object duplication on forward (rows are cloned, object reused).

## Item 1 — scroll on open (DONE, shipped ahead of this spec)

Root cause: `ChatMessageList` is reused across conversation switches (no
`key`), so `isInitialLoadRef` stayed `false` after the first conversation and
every later open took the smooth `scrollIntoView` branch. Compounded by the
initial jump running one `requestAnimationFrame` early — before images / media
lay out — and by `unreadBoundary` being a fresh object each render, which
re-fired the effect on every background refetch.

Fix (in `ChatMessageList.jsx`, `ChatWindow.jsx`, `MiniChatWindow.jsx`,
`ExternalInboxScreen.jsx`):

- `key={conversationId}` on every `<ChatMessageList>` so its refs reset per
  conversation.
- Opening placement in `useLayoutEffect`, instant, then re-pinned for ~1.5s
  while `scrollHeight` grows from late media; aborts on user scroll or an
  explicit jump.
- Effect depends on `unreadBoundary?.id`, not the object.
- New-message follow effect only fires on a real append (head/tail id diff),
  never a prepend or a same-ends refetch, and only when parked at the bottom.
  Typing indicator auto-scroll gated the same way.
- `suppressAutoScrollRef` held while an explicit jump resolves so the opening
  / new-message / typing scrolls do not fight it.

## Item 2 — reliable search jump

In `ChatMessageList.jsx` jump effect:

- Increase attempts 12 -> 20, retry delay 600 -> 450ms (already shipped with
  item 1's `suppressAutoScrollRef`).
- If the target id is in `hiddenMessageIds`, render it anyway for this jump
  (a new `revealMessageId` state on `ChatMessageList` that forces the row into
  `visibleMessages`) instead of failing.
- If the target is never found in the main list and the source message has a
  `thread_root_id`, call `onOpenThread(thread_root_id)` and pass the target so
  the thread panel scrolls to it, rather than showing the failure toast.
- On give-up, scroll to the oldest loaded message (top of the list) in
  addition to the toast, so the view reflects "went as far back as we could".

## Item 3 — direct-conversation search results

Server (`chat-search-service.js`): add a `LEFT JOIN LATERAL` that, for
`conv.type = 'direct'`, resolves the other member's `display_name` and
`avatar_url` (mirrors the conversation-list resolver). Return them as
`conversation.title` / `conversation.avatarUrl` when the stored title is null.
Client keeps `getConversationDisplayName` as a fallback.

## Item 4 — mobile long-press popover

Rewrite the `isMobile` branch of `MessageActionSheet.jsx`:

- Replace the bottom `Sheet` with a fixed-position overlay: a dimmed scrim
  (tap to dismiss) plus a panel anchored near `anchorPoint` (the long-press
  coordinates, already captured by `useLongPress`). Panel clamps to the
  viewport with an 8px margin and flips above the point when it would overflow
  the bottom.
- Panel content unchanged: quick-reaction row on top, `buildMessageActions`
  primary list, separator, danger list.
- The pressed bubble is raised above the scrim (`ChatMessageBubble` adds a
  `z` + subtle scale to the row while its `actionSheet.open`).
- `useLongPress`'s `onLongPress` stops nulling the point on mobile.
- Keep the 400ms "armed" delay before the panel accepts pointer input.

## Item 5 — forward icon

Swap `Share2` -> `Forward` (lucide) in `lib/messageActions.jsx` (forward
entry), `ForwardMessageModal.jsx` (title), `ChatWindow.jsx` (selection
toolbar button). No behaviour change.

## Item 6 — copy multiple messages

`ChatWindow.jsx` selection toolbar: add a "Copiar" button (`Copy` icon) shown
when `selectionCount > 0`. New `handleCopySelected`:

- Take selected, non-deleted messages with a body, sorted by `created_at`.
- Format each line as `[D/M/YY, H:MM] Sender: body` using
  `@atlas/core` local-time helpers (never `toISOString`).
- `navigator.clipboard.writeText(lines.join("\n"))`, `toast.success`, exit
  selection mode. Silent no-op if clipboard write rejects (mirrors existing
  single-message copy).

## Item 7 — forward with attachments + "Reenviado"

### API — `POST /chat/messages/forward`

Request (Zod, `@atlas/validators`):

```
{
  messageIds: string[] (uuid, 1..30),
  targetConversationIds: string[] (uuid, 1..20)
}
```

Behaviour (`chat-service.js`, new `forwardMessages`):

1. Resolve caller profile id.
2. Load the source messages with their conversation ids and attachments.
   Reject (403) if the caller is not an active member of every source
   conversation, (404) if any message id is missing or soft-deleted.
3. Reject (403) if the caller is not an active member of every target
   conversation (reuse `assertConversationMember`).
4. For each target conversation, for each source message **in ascending
   `created_at` order**, in a transaction:
   - Insert a `chat_messages` row: same `body`, `message_type`,
     `attachment_count`; `metadata.forwardedFrom = { conversationId,
     messageId, senderName, at }` merged over `{}` (entity refs are not
     carried).
   - For each source attachment, insert a new `chat_attachments` row reusing
     `bucket` / `object_key` / `file_name` / `mime_type` / `size_bytes`, with
     `conversation_id` = target, `uploaded_by_user_id` = caller,
     `message_id` = new message.
   - `updateConversationLastMessage(target, newMsg.id, newMsg.created_at)`.
5. Fire the same notification path `sendMessage` uses, per inserted message
   (best-effort, `setImmediate`).
6. Return `{ forwarded: <count of inserted messages> }`.

Permissions: route guarded by `chat.conversations.read`; membership checks as
above. No new permission key.

Notes:
- Storage objects are never duplicated. `deleteAttachment` only deletes the
  row and never the object, so reusing `object_key` across messages is safe.
- Attachment-only messages are forwardable (no body gate).

### SDK

`atlas.chat.forwardMessages({ messageIds, targetConversationIds }, token)` ->
`POST /chat/messages/forward`.

### UI

- `ForwardMessageModal` takes `messageIds` (array) + the resolved source
  messages for preview instead of a synthetic `{ body }`. Preview shows up to
  3 rows: body snippet or an attachment chip (`file_name`, icon by mime).
  Drops the `!message?.body` gate; disabled only when `messageIds` is empty.
  Calls `atlas.chat.forwardMessages`, invalidates `["chat-conversations"]`
  and the target `["chat-messages", id]` queries, toasts, closes.
- `ChatWindow`:
  - `setForwardMessage(message)` -> `setForwardTarget({ messageIds: [message.id] })`.
  - `handleForwardSelected` -> `setForwardTarget({ messageIds: [...selectedMsgIds ordered] })`, no body concatenation.
- `ChatMessageBubble`: when `message.metadata?.forwardedFrom`, render a small
  muted "Reenviado" label with a forward icon above the body (both own and
  other bubbles), styled like the existing edited/pinned markers.

## Testing

- API: `apps/api/src/routes/chat/__tests__/` — `forwardMessages` happy path
  (text, with-attachments, multi-target, multi-message ordering), permission
  failures (non-member source, non-member target), missing/deleted message,
  `forwardedFrom` metadata shape, attachment row cloning (object_key reused,
  uploader rewritten). `chat-search-service` direct-conversation title
  resolution.
- UI: extend the chat component tests where they exist —
  `handleCopySelected` transcript format, `ForwardMessageModal` preview for
  attachment-only messages, `MessageActionSheet` mobile popover clamping.
- Full `node --test apps/api/src/...` suite green; `pnpm lint`; desktop
  `vite build`.

## Rollout

- No migration. New endpoint + validator + SDK method are additive.
- `pnpm db:seed` not required (no new permission).
- Manual QA (per repo policy): 390px and 1440px, both `ChatWindow` and
  `MiniChatWindow`; verify open-scroll, search jump, mobile popover, copy,
  forward-with-attachments round trip.

# atlas.chat — Reply-to-message + mobile gesture layer

- **Status:** Approved (brainstorm 2026-08-28)
- **Owner:** Raul Belloso Medina
- **Module:** `atlas.chat`
- **Related:** Phase E threads (`docs/superpowers/specs/2026-08-25-chat-*`), `project_atlas_chat` memory

## 1. Problem

On touch devices the per-message affordances in `ChatMessageBubble.jsx` are unreachable:
the quick-react face and the `MoreHorizontal` ("...") menu live in `MessageActions`, revealed
only via `opacity-0 group-hover/msg:opacity-100`. No hover on mobile means no reactions and no
message menu. There is also no lightweight "reply to a message" model at all — the only reply
primitive today is Phase E **threads** (`ThreadPanel`, a right-side `Sheet`), which is
channel/group-only and is itself opened from the same hover-gated dropdown.

## 2. Goals

1. Add a full **reply-to-message** feature (WhatsApp/Telegram style quoted reply) that works in
   DMs, groups and channels, coexisting with — not replacing — threads.
2. Make every message action reachable on touch via gestures:
   - **long-press** → bottom action sheet (reactions row + full action list)
   - **horizontal swipe** → reply
   - **double-tap** → toggle `❤️`
3. Desktop parity: **right-click** → same action sheet as a context menu. Existing hover
   affordances stay unchanged.
4. Ship with the mandated pre-refactors of the two oversized files this work touches.

## 3. Non-goals

- `ExternalInboxScreen` (guest support inbox) — out of scope.
- Replacing or removing threads (Phase E). Decision: **coexist, separate** (Telegram model).
  "Responder" = inline quote in the same timeline. "Responder en hilo" stays as-is.
- A new notification channel for "someone replied to you" — v1 only reuses the mention
  highlight treatment on the incoming bubble.
- Editing which emoji is the double-tap reaction (fixed `❤️` in v1).
- Reply targets across conversations (UI only ever offers reply within the open conversation).

## 4. Surfaces

| Surface | Gestures + long-press | Inline "Responder" quote |
|---|---|---|
| `ChatWindow` (main screen) | Yes | Yes |
| `MiniChatWindow` / `FloatingChatHub` (floating widget) | Yes | Yes |
| `ThreadPanel` (inside a thread) | Yes | Yes (reply within the thread) |
| `PinnedMessagesSheet` | No | Read-only — tap a quote jumps to the message |
| `ExternalInboxScreen` | No | No |

Rationale for enumerating: every prior chat phase's review caught a feature that reached
`ChatMessageBubble.jsx`'s main path but missed one of the other message-rendering surfaces.

## 5. Data model

Forward-only migration `prisma/migrations/2026XXXXXXXXXXXX_chat_reply_to/migration.sql`:

- `chat_messages.reply_to_message_id UUID NULL`
- FK `chat_messages.reply_to_message_id → chat_messages(id) ON DELETE SET NULL`
- Index on `reply_to_message_id`

No denormalized snapshot columns. The replied-to preview is resolved on read (see §6).
`chat_messages` is a real Prisma-migration table (not AME3) — same pattern as the Phase E
`thread_root_id` migration. Applied migrations are immutable; this is a new forward migration.

## 6. API

### 6.1 Mandated pre-refactor

`apps/api/src/routes/chat/chat-service.js` is 1469 lines — 31 lines from the 1500 hard
ceiling. CLAUDE.md requires splitting it before any further growth. **Task 1 of Plan A**:
extract `listConversations` / `getConversation` / `archiveConversation` into a sibling
`apps/api/src/routes/chat/chat-conversations-service.js`, mirroring the existing
`chat-reactions-service.js` / `chat-mentions-service.js` splits. Pure move + re-wire in
`index.js`; no behavior change; existing tests stay green.

### 6.2 `sendMessage`

- New optional param `replyToMessageId` (default `null`), threaded through the same way
  `threadRootId` already is.
- Validation: the target message must exist, not be `deleted_at`, and share the same
  `conversation_id`. On failure → `chat-service-error` `400` (`reply_target_invalid`).
- Persist into the new column in the existing `INSERT INTO chat_messages (...)`.
- `replyToMessageId` is independent of `threadRootId` — a thread reply may also quote another
  message; both columns can be set.

### 6.3 `listMessages` / `getThread`

For every page of messages, resolve a lightweight preview of each row's `reply_to_message_id`
in **one** extra query (fetch the set of referenced ids, build a map, attach). Shape:

```json
"reply_to": {
  "id": "uuid",
  "senderUserId": "uuid | null",
  "senderName": "string",
  "bodyPreview": "string | null",
  "kind": "text | image | video | audio | file | entity | deleted",
  "isDeleted": false
}
```

- `bodyPreview`: first ~120 chars of `body`, single line, or `null` when the message is
  media-only.
- `kind`: derived from `message_type` / attachment mime / entity refs; `deleted` when the
  original row has `deleted_at`.
- Deleted original → `{ isDeleted: true, kind: "deleted", bodyPreview: null }` (id + senderName
  still populated so the quote can render "Mensaje eliminado").
- `reply_to` is `null` when `reply_to_message_id IS NULL`.

### 6.4 `listMessages({ around })` — optional (Plan A, last task)

Add optional `around=<messageId>` to the messages list endpoint: returns the page containing
that message (plus normal neighbours). Used by "jump to a quoted message not currently
loaded". If this proves expensive it is dropped from Plan A and the frontend falls back to
repeated `loadOlder()` (see §7.6).

### 6.5 Realtime

`chat.message.new` broadcast payload gains `replyToMessageId` (same place `threadRootId` was
added). Clients build the `reply_to` preview locally from the already-known original when it
is in cache; otherwise the next `listMessages` refetch fills it.

### 6.6 Validators / SDK

- `packages/validators/src/chat.js` — `sendMessageSchema` gains
  `replyToMessageId: z.string().uuid().optional()`.
- `packages/sdk/src/domains/chat.js` — `sendMessage` propagates `replyToMessageId`;
  `listMessages` accepts `{ around }`.

## 7. Frontend

### 7.1 Mandated pre-refactor

`ChatMessageBubble.jsx` is 1367 lines (over the 1000 limit, under the 1500 ceiling).
CLAUDE.md requires extracting the attachment sub-components first. **Task 1 of Plan B**:
move `getFileTypeInfo`, `useAttachmentUrl`, `AttachmentTileActions`, `AttachmentReactionPills`,
`ImageCard`, `VideoCard`, `AudioCard`, `FileCard`, `ImageCoverCell`, `ImageGrid`,
`AttachmentsBlock` into `apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx`
and import `AttachmentsBlock` back. Pure move; no behavior change. Brings the bubble to ~900
lines before the feature work adds to it.

### 7.2 New components

- **`MessageQuote.jsx`** — the quoted-reply chip. Props: `reply` (the §6.3 preview),
  `variant` (`"inline"` | `"compose"`), `isOwn`, `onJump`, `onCancel`.
  - `inline`: left accent bar in the sender's colour, sender name, one-line
    `bodyPreview` or a media icon + label ("Foto", "Video", "Nota de voz", "Archivo",
    "Referencia"). Rendered inside the bubble, above the body. Tap → `onJump(reply.id)`.
  - `compose`: same visual, plus an `X` → `onCancel()`. Rendered above the composer input.
  - Deleted original → italic "Mensaje eliminado", not tappable.
- **`MessageActionSheet.jsx`** — the unified action surface.
  - Mobile: `Sheet` (`side="bottom"`) from `@atlas/ui`.
  - Desktop right-click: same content inside a context menu anchored at the cursor.
  - Content: quick-reaction row (`👍 ❤️ 😂 😮 😢 🙏` + `+` opening the full
    `MessageReactionPicker`), then the action list from §7.4 (Responder, Copiar, Reenviar,
    Fijar/Desfijar, Seleccionar, Eliminar para todos, Eliminar para mí), gated by the same
    conditions `MessageActions` uses today.
- **`MessageAttachments.jsx`** — see §7.1.

### 7.3 Gesture hooks — `packages/ui/src/hooks/` (new dir), exported from `@atlas/ui`

- **`useLongPress({ onLongPress, delay = 450, moveTolerance = 10 })`** → returns pointer
  handlers. Starts a timer on `pointerdown`; cancels on `pointermove` beyond `moveTolerance`,
  on `pointerup`/`pointercancel` before `delay`, or when the event target is an
  `a`/`button`/`img`/`video`/`input` (closest match). Fires `navigator.vibrate?.(10)` then
  `onLongPress`.
- **`useSwipeToReply({ onReply, threshold = 64, direction })`** → pointer handlers + a
  `translateX` value for the caller to apply. Only engages when `|dx| > |dy| * 1.5`
  (mostly-horizontal). `direction` is `"right"` for received, `"left"` for own. Past
  `threshold` on release → `onReply()`; otherwise springs back to 0. Never calls
  `preventDefault` on vertical intent, so scroll is untouched.
- Double-tap is handled inline in the bubble (250ms window, target must be the bubble
  background or text node — not an attachment, link, or reaction pill).

These live in `@atlas/ui` because long-press and swipe-to-action are not chat-specific.
Document them in `docs/ai-context/ame3-runtime-capabilities.md`.

### 7.4 Shared action descriptor

Extract the message-action list into `useMessageActions(message, handlers)` returning an
array of `{ key, label, icon, onSelect, danger?, hidden? }`. Consumed by both the existing
`MessageActions` (desktop hover — no visual change) and the new `MessageActionSheet`. Single
source of truth for which actions exist and when.

### 7.5 `replyingTo` state

Owned by each conversation view (`ChatWindow`, `MiniChatWindow`, `ThreadPanel`), one per
view. Passed down to:

- `ChatMessageList` → each `ChatMessageBubble` gets `onReply(message)` which sets it.
- `MessageComposer` → new props `replyingTo`, `onCancelReply`. Renders
  `<MessageQuote variant="compose">` above the input when set; focuses the input on set.
  On send, includes `replyToMessageId: replyingTo.id` in the payload, then calls
  `onCancelReply()`. Switching conversation clears it.

Optimistic send: the temp message carries a client-built `reply_to` preview from the known
original so the quote shows immediately.

### 7.6 Jump to a quoted message

`ChatMessageList` exposes `scrollToMessage(id)`:

1. Find `[data-msg-id="<id>"]` in the DOM → `scrollIntoView({ block: "center" })`, add a
   `.chat-msg-flash` class for ~1.2s (CSS keyframe in `chat-theme.css`).
2. Not in DOM → call `loadOlder()` up to 5 times, waiting for each page, retrying the lookup.
3. Still not found → toast "No se pudo cargar el mensaje original."

(If §6.4 `around` ships, step 2 uses it instead of looping `loadOlder`.)

### 7.7 `ChatMessageBubble.jsx` wiring

- Row wrapper gets `useLongPress` + `useSwipeToReply` handlers + double-tap detection, plus
  `onContextMenu` (desktop) → open `MessageActionSheet`.
- Gestures are inert in `selectionMode`.
- `<MessageQuote variant="inline">` renders above the body when `message.reply_to` is set,
  inside both the own and received branches.
- A message whose `reply_to.senderUserId === currentUserId` (someone replied to me) reuses
  the existing `mentioned` left-border highlight.
- Existing hover `MessageActions` stays; the new sheet is additive.

## 8. Error handling

- Reply target deleted between compose and send → API `400 reply_target_invalid`; toast
  "No se puede responder a un mensaje eliminado"; reply state cleared.
- Quoted original deleted after the fact → inline quote shows "Mensaje eliminado", not
  tappable.
- Quoted original not loadable on jump → toast (§7.6.3).
- `navigator.vibrate` absent (iOS Safari) → guarded optional call, no-op.
- Swipe and scroll conflict → resolved by the horizontal-intent ratio gate in §7.3.

## 9. Testing

**API** (`apps/api/src/routes/chat/__tests__/`, `node --test`):
- `sendMessage` persists `reply_to_message_id`; rejects a target in another conversation;
  rejects a deleted target.
- `listMessages` attaches the `reply_to` preview with correct `kind` for text / image /
  audio / file / entity-ref originals.
- Deleted original → `reply_to.isDeleted === true`.
- `ON DELETE SET NULL`: deleting an original nulls `reply_to_message_id` on repliers.
- The `chat-conversations-service.js` extraction leaves existing chat tests green.

**Frontend** (`node --test`):
- `useLongPress` fires after `delay`; cancels on move > tolerance; cancels on early pointerup.
- `useSwipeToReply` triggers only past `threshold` and only on horizontal intent.

**Manual (per `feedback_responsive_qa`):** 390px and 1440px; run the 14-aspect UI checklist
on `ChatWindow`, `MiniChatWindow`, `ThreadPanel`. Verify long-press, swipe, double-tap,
right-click, jump-to-message, and that vertical scroll is never captured.

## 10. Plan split

Per `feedback_split_large_plans`:

- **Plan A — API & contracts:** migration; `chat-conversations-service.js` extraction;
  `sendMessage` / `listMessages` / `getThread` reply-to support; realtime payload; validators;
  SDK; optional `around` param; API tests.
- **Plan B — UI & gestures:** `MessageAttachments.jsx` extraction; gesture hooks +
  `@atlas/ui` export + docs; `MessageQuote`; `MessageActionSheet`; `useMessageActions`
  descriptor; `replyingTo` state in the 3 views; composer reply UI; `scrollToMessage` +
  flash; bubble wiring; `PinnedMessagesSheet` jump-only; responsive QA.

Plan B depends on Plan A's contract (the `reply_to` shape and `replyToMessageId` param).

# atlas.chat — Conversation row gestures & context menu

**Status:** approved 2026-09-07
**Author:** Raul Belloso Medina (with Claude)

## Problem

The chat conversation list has no per-row actions. On mobile there is no
swipe gesture (WhatsApp/Telegram style); on desktop there is no right-click
context menu. The only per-row action today is a bespoke "unarchive" side
button that only appears inside the archived accordion.

## Goal

Give every conversation row a consistent action surface across:

1. `ChatSidebar` main list
2. `ChatSidebar` archived section
3. `FloatingChatHub` conversation list

Actions: **Fijar/Desfijar arriba**, **Silenciar/Activar**, **Marcar como
leído**, **Archivar/Desarchivar**, **Eliminar** (contextual by type).

Interaction models:

- **Mobile:** swipe-left reveals a row of action buttons; swipe-right past a
  threshold runs Archivar/Desarchivar directly. Long-press opens a bottom
  `Sheet` with the full action list.
- **Desktop:** right-click opens a context menu with the full action list.

## Approach

### New `@atlas/ui` primitives

- **`SwipeableRow`** — wraps a row. Uses `motion` (`framer-motion` v12,
  already a dependency) `drag="x"`. Only engages on coarse/touch pointers
  (`useIsMobile` + `matchMedia("(pointer: coarse)")`). Snap states: closed,
  open-left (reveal `rightActions`), and a right-swipe past `fullSwipeThreshold`
  that fires `onFullSwipeRight` then snaps back. `onDragStart` locks the axis;
  vertical intent releases the drag so list scroll is unaffected. Closes on:
  outside tap, scroll, another row opening (via an `openRowId` + `onOpen`
  controlled pair owned by the list).
- **`ContextMenu*`** — thin themed wrapper over `@radix-ui/react-context-menu`
  (new dep, same family as the existing `DropdownMenu`). Exports
  `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`,
  `ContextMenuSeparator`. Styling copied from `DropdownMenu.jsx`.

Both documented in `docs/ai-context/ame3-runtime-capabilities.md`.

### Single source of truth for the action list

`apps/desktop/src/modules/atlas.chat/lib/buildConversationActions.js` — pure,
tested. Signature:

```
buildConversationActions(conversation, { currentUserId, canManageChannel }) -> Action[]
Action = { key, label, icon, destructive?, run: (handlers) => void, hidden? }
```

Rules:

| key        | label                                   | shown when                                   |
|------------|-----------------------------------------|----------------------------------------------|
| pin        | Fijar arriba / Desfijar                 | always                                       |
| mute       | Silenciar / Activar notificaciones      | always                                       |
| read       | Marcar como leído                       | `unread_count > 0`                           |
| archive    | Archivar / Desarchivar                  | always (label from `is_archived`)            |
| delete     | Eliminar chat                           | `type === "direct"` → hide                   |
| delete     | Eliminar canal / Eliminar grupo         | channel/group AND `canManageChannel`         |
| leave      | Salir del canal / Salir del grupo       | channel/group AND NOT `canManageChannel`     |

`delete` and `leave` are `destructive` → routed through `ConfirmDialog`.

The same array feeds the `SwipeableRow` buttons (first 2 non-destructive +
"Más" → Sheet), the `ContextMenu` items, and the long-press `Sheet`.

## Backend (Plan A)

### Migration `20260907000000_chat_conversation_pin_hide`

```sql
ALTER TABLE chat_conversation_members
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS chat_ccm_user_pinned_idx
  ON chat_conversation_members (user_id, pinned_at DESC)
  WHERE user_id IS NOT NULL AND pinned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_ccm_user_hidden_idx
  ON chat_conversation_members (user_id, hidden_at)
  WHERE user_id IS NOT NULL AND hidden_at IS NOT NULL;
```

### `chat-conversation-reads-service.js`

- `listConversations`:
  - add `AND ccm.hidden_at IS NULL` to the non-archived branch (archived
    branch unchanged — hidden only ever applies to direct chats which are
    unarchived by nature, but the guard is cheap and correct either way).
  - select `ccm.pinned_at`, `ccm.pinned_at IS NOT NULL AS is_pinned`.
  - `ORDER BY (ccm.pinned_at IS NOT NULL) DESC, ccm.pinned_at DESC,
    COALESCE(c.last_message_at, c.created_at) DESC`. Cursor pagination keeps
    filtering on `last_message_at`; acceptable because pinned rows are few and
    always on page 1.
- `pinConversation({ conversationId, authUserId, pinned })` — `UPDATE ... SET
  pinned_at = ${pinned ? new Date() : null} WHERE conversation_id AND
  user_id AND left_at IS NULL`. Returns `{ ok: true, pinned }`.
- `hideConversation({ conversationId, authUserId })` — assert the conversation
  `type` is `direct` (else `ChatServiceError("Solo los chats directos se
  pueden eliminar de la lista.", 400)`), then `SET hidden_at = NOW()` for the
  caller's row. Returns `{ ok: true }`.
- Export both; destructure in `chat-service.js` alongside
  `archiveConversation`.

### `chat-service.js`

`updateConversationLastMessage` (the single choke point every real send hits)
gains, after the existing UPDATE:

```sql
UPDATE chat_conversation_members SET hidden_at = NULL
  WHERE conversation_id = ${conversationId} AND hidden_at IS NOT NULL;
```

so a "deleted" direct chat reappears when a new message arrives.

### Routes (`index.js`, next to archive/unarchive, `chat.conversations.read`)

- `PATCH /chat/conversations/:id/pin` — body `chatPinConversationSchema`
  (`{ pinned: boolean }`) → `chatService.pinConversation`.
- `POST /chat/conversations/:id/hide` → `chatService.hideConversation`.

"Salir" reuses the existing `DELETE /chat/conversations/:id/members/:userId`
(self-removal already permitted, see `removeMember`). "Eliminar canal/grupo"
reuses the existing `DELETE /chat/conversations/:id`.

### Validators

`chatPinConversationSchema = z.object({ pinned: z.boolean() })` in
`packages/validators/src/chat.js`, re-exported from the package index.

### SDK (`packages/sdk/src/domains/chat.js`)

```
pinConversation: (id, pinned, token) => POST .../pin { pinned }
hideConversation: (id, token) => POST .../hide {}
```

### Tests

`apps/api/src/routes/chat/__tests__/` — new `chat-conversation-pin-hide.test.js`:
pin reorders `listConversations`; unpin restores order; hide removes a direct
chat from the list; a new message clears `hidden_at`; hide on a channel →
400; pin state is per-member.

## Frontend (Plan B)

### `@atlas/ui`

- `packages/ui/src/components/SwipeableRow.jsx` (+ export)
- `packages/ui/src/components/ContextMenu.jsx` (+ export)
- `packages/ui/package.json` — add `@radix-ui/react-context-menu`

### chat module

- `lib/buildConversationActions.js` (+ `__tests__/buildConversationActions.test.js`)
- `hooks/useChatConversations.js` — add `usePinConversation`,
  `useHideConversation`, `useLeaveConversation` (wraps
  `atlas.chat.removeMember(id, currentUserId, token)`). All optimistic on
  `["chat-conversations"]` / `["chat-conversations-archived"]`, with rollback.
  `useMuteConversation` already exists in `useChatModeration.js`;
  `useMarkRead` in `useChatMessages.js`.
- `components/ConversationRowActions.jsx` — small wrapper that, given a
  `conversation` + resolved handlers, renders `children` inside `ContextMenu`
  always, inside `SwipeableRow` when touch, and owns the long-press → `Sheet`.
  Hosts the `ConfirmDialog` for destructive actions. Exposes an `openRowId`
  controlled pair to the parent list so only one swipe row is open at a time.
- `components/ChatConversationItem.jsx` — drop the bespoke `onUnarchive`
  side-button; the row is now wrapped by `ConversationRowActions`. Add a small
  `Pin` glyph in the title row when `conversation.is_pinned`.
- `components/ChatSidebar.jsx` — wrap both the main and archived `.map()` rows;
  own `openRowId` state; wire `handleUnarchive` into the new action set.
- `components/FloatingChatHub.jsx` — replace the bespoke row button
  ([FloatingChatHub.jsx:336]) with `ChatConversationItem` (compact) wrapped in
  `ConversationRowActions`. Fallback if the refactor regresses layout:
  keep the bespoke row but wrap it in `ContextMenu` only.

### Tests

- `buildConversationActions.test.js` — full matrix (type × archived × muted ×
  pinned × unread × canManageChannel).
- `vite build`, `node --test` chat suites, `eslint .` all green.
- Manual QA 390 / 1440: touch swipe (both directions + full-swipe archive),
  long-press sheet, desktop right-click, pinned ordering + glyph, delete/leave
  confirms.

## Out of scope

- Reordering pinned conversations among themselves (drag).
- Pin/hide on the `MiniChatWindow` header (only the list rows).
- Realtime broadcast of pin/hide to the user's other devices — local
  invalidation only; the next `listConversations` fetch reconciles.

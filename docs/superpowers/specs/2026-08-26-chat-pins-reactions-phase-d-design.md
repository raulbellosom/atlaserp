# Chat Channels & Roles — Phase D: Pinned Messages & Reactions

Date: 2026-08-26
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-26-chat-pins-reactions-phase-d-design.md
Plan files: docs/superpowers/plans/2026-08-26-chat-pins-reactions-phase-d-plan-a-backend.md, docs/superpowers/plans/2026-08-26-chat-pins-reactions-phase-d-plan-b-frontend.md

---

## 1. Feature title

Chat Channels & Roles — Phase D: Pinned Messages & Reactions

## 2. Status

Draft

## 3. Context

Phases A–C built channels, roles, and mentions. The channel-scoped permission catalog already defines `messages.pin` (Phase A) but nothing enforces or exposes it — no message can be pinned today. There is no reaction mechanism at all. `emoji-picker-react` is already a dependency, already used by `MessageComposer.jsx`'s emoji button, and can be reused as-is for reactions.

## 4. Problem

A member with `messages.pin` cannot pin an important message for the channel to find later. No one can react to a message with a quick emoji instead of sending a full reply.

## 5. Goals

1. A member with `messages.pin` can pin/unpin a message from its action menu.
2. Any channel/group has a "Mensajes fijados" view listing pinned messages, newest first, reachable from the chat header.
3. Any member can react to a message with an emoji (via the existing `emoji-picker-react` picker); reactions render as small pill badges under the message, grouped by emoji, with a count and "you reacted" highlight; clicking a pill toggles your own reaction.
4. `direct`/`external_support` conversations support reactions (no permission gate — matches how any 1:1 participant can already do anything) but the UI never offers pinning there (no roles exist there to gate `messages.pin`, and a 2-person conversation has no use case for a shared "pinned" list).

## 6. Non-goals

1. No pin limit enforcement (e.g. "max 50 pinned messages") — can be added later if it becomes a real problem.
2. No reaction analytics/leaderboard.
3. No custom (non-Unicode) emoji/sticker reactions — `emoji-picker-react`'s standard Unicode set only, matching the composer's existing emoji button.
4. No "who pinned this" audit trail beyond the single `pinned_by_user_id`/`pinned_at` columns (no history of unpin/re-pin events).

## 7. User stories

- As a moderator, I want to pin an announcement so new members can find it without scrolling through history.
- As any member, I want to react with 👍 to acknowledge a message without cluttering the conversation with a reply.

## 8. UX requirements

Spanish labels, `@atlas/ui` primitives only.

- **Message action menu** (`MessageActions` in `ChatMessageBubble.jsx`): a new "Fijar mensaje"/"Desfijar mensaje" item (icon: `Pin`/`PinOff` from `lucide-react`), visible only for `channel`/`group` conversations and only when the viewer has `messages.pin`. A new "Reaccionar" item (icon: `Smile`) opens a small emoji picker popover anchored to the message — visible for every conversation type, no permission gate.
- **Pinned messages entry point**: when a channel/group has at least one pinned message, `ChatHeader` shows a header icon-button (a `Pin` icon with a small count badge, matching the existing header-button visual pattern already used for search/files) opening a `PinnedMessagesSheet` listing all pinned messages (sender, timestamp, truncated body via `renderMentionText`), each with a "Ver en el chat" jump action and (if the viewer has `messages.pin`) an unpin action.
- **Reaction pills**: rendered under a message bubble's body (own and other-message layouts), grouped by emoji with a count (`👍 3`), viewer's own reaction visually distinguished (e.g. a colored ring/background), click toggles add/remove.
- **Loading/empty states**: `PinnedMessagesSheet` uses `EmptyState` when nothing is pinned, `Skeleton` while loading.

## 9. Routes/screens

No new top-level routes. New component: `PinnedMessagesSheet` (`apps/desktop/src/modules/atlas.chat/components/PinnedMessagesSheet.jsx`), reached from `ChatWindow`'s header, same pattern as `ChannelDetailsSheet` (Phase B).

## 10. Data model

### New models

**`chat_message_reactions`** (raw-SQL-managed — chat tables are not Prisma-modeled; mirrors the existing Prisma-modeled `EntityCommentReaction`'s shape, used for the equivalent generic-comments feature, for consistency): `id`, `message_id` (FK → `chat_messages`, cascade delete), `user_id`, `emoji`, `created_at`. Unique on `(message_id, user_id, emoji)` — the same person can't double-react with the identical emoji; toggling removes it.

### Modified models

**`chat_messages`**: two new nullable columns, `pinned_at` (TIMESTAMPTZ) and `pinned_by_user_id` (UUID). `pinned_at IS NOT NULL` is the pinned/unpinned flag; `pinned_by_user_id` records who most recently pinned it (overwritten on re-pin, not accumulated — no pin history).

## 11. Prisma impact

New models: none as Prisma models (`chat_message_reactions` is raw-SQL, matching every other chat table). Modified models: none (chat tables aren't Prisma-modeled).
New migration required: **Yes** — the first schema change since Phase A (Phases B/C were additive-to-existing-columns or JSONB-only, no migration needed).
Migration safety notes: both new `chat_messages` columns are nullable with no default beyond `NULL` — safe on a live table. The new table is a plain `CREATE TABLE IF NOT EXISTS`, same pattern as every prior chat migration.

## 12. API contract

### PATCH /chat/messages/:id/pin

Auth: required
Permission: caller must have `messages.pin` on the message's conversation for `channel`/`group` types; for `direct`/`external_support`, any active member may pin (the UI never offers this per Section 5 goal 4, but a stray direct API call pinning a message in your own 1:1/support chat is harmless, so it isn't hard-blocked at the API layer — there is no role system to check against for those types anyway).
Body: `{ pinned: boolean }`
Response: `{ data: Message }` (with `pinnedAt`/`pinnedByUserId` reflected)
Errors: 403 (lacks `messages.pin` in a channel/group), 404 (message not found or not in a conversation the caller belongs to).

### GET /chat/conversations/:id/pinned-messages

Auth: required
Permission: `chat.conversations.read` + membership (existing `assertMember` pattern)
Response: `{ data: Message[] }` ordered by `pinned_at DESC`, excluding soft-deleted messages.

### POST /chat/messages/:id/reactions

Auth: required
Permission: membership in the message's conversation only (no channel-scoped permission — reactions are unprivileged)
Body: `{ emoji: string }`
Response: `{ data: { added: boolean, emoji: string } }` — toggles: if the caller already reacted with this exact emoji, removes it (`added: false`); otherwise adds it (`added: true`).
Errors: 404 (message not found / not a member of its conversation, or message soft-deleted), 400 (empty/invalid emoji string).

No other endpoints change. `getMessageFull`/`listMessages` (existing) gain `pinnedAt`, `pinnedByUserId`, and a `reactions` array (`{ emoji, userIds }[]`, aggregated) in their response shape — additive fields on an existing response, not a new endpoint.

## 13. SDK contract

Domain: `chat` — `pinMessage(messageId, pinned, token)`, `listPinnedMessages(conversationId, token)`, `toggleReaction(messageId, emoji, token)`.

## 14. Validator contract

- `chatPinMessageSchema`: `{ pinned: z.boolean() }`.
- `chatToggleReactionSchema`: `{ emoji: z.string().trim().min(1).max(16) }` (16 chars comfortably covers multi-codepoint emoji + ZWJ sequences, e.g. family/skin-tone variants).

## 15. Module manifest impact

N/A — `atlas.chat` is a built-in module, not AME3.

## 16. Navigation impact

N/A — no new navigation items; reached from the existing chat header.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

`messages.pin` (already exists in the channel-scoped permission catalog, Phase A) is enforced for the first time by this phase — no new permission keys. Reactions are intentionally unprivileged (any active member, no permission check beyond membership).

| Permission key | Guards |
|---|---|
| `messages.pin` | `PATCH /chat/messages/:id/pin` for `channel`/`group` conversations |

## 19. Multi-company behavior

Unchanged pattern — every new query scopes through the message's `conversation_id` and the existing `assertMember`/`assertChannelPermission` checks already used throughout this module; no cross-company access paths introduced.

## 20. Files/storage impact

N/A — emoji reactions are Unicode text, not files; no Supabase Storage interaction.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — pinning and reacting are lightweight, frequent, reversible social actions, not administrative changes; consistent with regular chat messages and existing role/member actions in the RBAC-relevant sense (Phase A's audit table covers role/permission changes, not message-level actions like edit/delete/pin, none of which are audited today).

## 23. Edge cases

1. **Pinning a message in a conversation the caller isn't a member of**: 404 (existing `assertMember` pattern), not 403 — consistent with this codebase's "don't leak conversation existence" convention.
2. **Reacting twice with the same emoji** (double-click race): the unique constraint backstops the toggle logic; a concurrent duplicate insert attempt is caught (Postgres unique-violation, error code `23505`) and treated as "already reacted, remove instead" rather than surfacing a raw DB error.
3. **Unpinning a message that's already unpinned** (double-click): idempotent — `PATCH .../pin { pinned: false }` on an already-unpinned message just re-confirms `pinned_at = NULL`, no error.
4. **A pinned message gets soft-deleted**: `PinnedMessagesSheet`'s query excludes `deleted_at IS NOT NULL` rows (a deleted message pinned before deletion shouldn't linger in the pinned list) — the pin flag itself is left as-is on the row (no need to auto-unpin on delete), just filtered out of the pinned-list query.
5. **Reacting to a deleted message**: blocked (404-equivalent — reactions require the message to be a live, non-deleted row in a conversation the caller belongs to).

## 24. Risks

1. Risk: `ChatMessageBubble.jsx` is already ~926 lines after Phase C. Mitigation: extract reaction-pill rendering into a small, separate `MessageReactions.jsx` component from the start, same discipline already applied to `ChannelDetailsSheet`'s Members/Roles tab split in Phase B.
2. Risk: `getMessageFull`/`listMessages` growing a `reactions` aggregation subquery adds cost to every message fetch. Mitigation: aggregate via a single `json_agg` correlated subquery (same pattern already used for `attachments`), not N+1 queries — acceptable for expected reaction volumes.
3. Risk (learned from Phase C's review cycle): a new/changed data shape (like Phase C's `metadata.mentions`) has to reach every place a message is rendered, not just the primary chat thread — Phase C's own review found 3 missed preview surfaces (`FloatingChatHub`, `ExternalInboxScreen`, `ForwardMessageModal`) after the "main" fix looked complete. Mitigation: this phase's plan explicitly enumerates every `message.body`/message-summary render site up front (Section 9's implementation plan) rather than fixing the primary thread and treating previews as an afterthought.

## 25. Acceptance criteria

1. Given a member with `messages.pin`, when they pin a message, then it appears in `GET /chat/conversations/:id/pinned-messages`.
2. Given a member WITHOUT `messages.pin` in a channel, when they attempt to pin via the API directly, then the response is 403; the UI never shows them the option to begin with.
3. Given any member, when they react with 👍 twice in a row, then the second action removes their reaction (toggle).
4. Given a message with 3 different users' 👍 reactions, when any viewer opens the conversation, then they see one `👍 3` pill, visually highlighted if they're one of the 3.
5. Given a pinned message that gets deleted, when the pinned-messages list is fetched, then it no longer appears there.

## 26. Verification plan

- `pnpm build` — no build errors.
- `node --test apps/api/src/routes/chat/__tests__/` (explicit filenames) — new coverage for pin permission gating and reaction toggle logic.
- Manual browser QA if a session is available: pin a message, confirm it appears in the pinned list; react to a message, confirm the pill renders and toggles.

## 27. Rollback plan

New migration (2 additive columns on `chat_messages` + 1 new table) — revertable via a new forward migration dropping both if ever needed; no data-destructive risk to existing columns/tables/rows.

## 28. Future enhancements

1. Pin limit per conversation.
2. Reaction summary/leaderboard.
3. Custom emoji/stickers.

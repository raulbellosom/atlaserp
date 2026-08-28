# Chat — Per-Attachment Reactions & Delete

Date: 2026-08-27
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-27-chat-per-attachment-actions-design.md
Plan files: docs/superpowers/plans/2026-08-27-chat-per-attachment-actions-plan-a-backend.md, docs/superpowers/plans/2026-08-27-chat-per-attachment-actions-plan-b-frontend.md

---

## 1. Feature title

Chat — Per-Attachment Reactions & Delete (grouped photo/video messages act individually)

## 2. Status

Draft

## 3. Context

When a user attaches several images/videos to one message, `ChatMessageBubble.jsx`'s `AttachmentsBlock`/`ImageGrid` renders them as one WhatsApp/Telegram-style album (1/2/3/4+ grid layouts, overflow counter on the 4th tile). This grouping is kept as-is (confirmed with the user). Today, everything about that album is scoped to the single underlying `chat_messages` row: one set of reactions (`chat_message_reactions`, keyed by `message_id` only), one "..." menu, one delete action that removes the whole message (and therefore every attachment in it) at once.

## 4. Problem

A user who sends 4 photos in one message cannot react to just one of them, or delete just one of them — every action (react, delete) applies to the whole batch. There is no way to say "I like this one photo" or "that one photo was a mistake, remove just it" without affecting the other photos sent alongside it.

## 5. Goals

1. Hovering (desktop) or tapping (touch) an individual tile inside a multi-image/video grid reveals a small per-tile action affordance (react + delete), separate from the message-level "..." menu.
2. A reaction placed via a tile's own react action is scoped to that specific attachment — it does not appear as a message-level reaction and does not appear on any other attachment in the same grid.
3. Reaction pills for an attachment-scoped reaction render as a small overlay inside that tile (bottom corner), not in the message-level reaction row below the whole bubble.
4. Deleting one attachment from a multi-attachment message removes only that file — the message and its remaining attachments stay intact, the grid re-lays-out for the remaining count (e.g. 4→3 collapses the 2×2+overflow layout into the 3-tile "1 wide + 2 below" layout).
5. Deleting the last remaining attachment of a message that also has no body text and no entity references soft-deletes the whole message (there is nothing left to show) — same visible result as today's "delete whole message" for a single-attachment message.
6. The reaction picker popover opens beside the trigger (already fixed independently of this feature — see `MessageReactionPicker.jsx` — not re-specified here).

## 6. Non-goals

1. No change to message-level (whole-message, no-attachment or text-only) reactions or delete — those keep working exactly as today, via the existing message-level "..." menu and message-level reaction row.
2. No splitting a multi-attachment message into genuinely separate `chat_messages` rows (the alternative design the user explicitly rejected in favor of keeping the grid).
3. No per-attachment edit, pin, forward, or "delete for me" — only react and delete are in scope. Pin/forward/hide-for-me remain message-level only.
4. No Storage object cleanup for a hard-deleted attachment in this phase (see Section 20) — the DB row is removed but the underlying Supabase Storage object is left in place, matching how this codebase already treats several other soft-delete-only flows. Tracked as a future enhancement (Section 28).
5. No retroactive backfill or migration of existing message-level reactions onto a "representative" attachment — pre-existing reactions on messages that happen to have attachments stay message-level.

## 7. User stories

- As a chat user, I want to react with 👍 to just one photo in a batch of 4, without that reaction implying I liked the other 3.
- As a chat user, I want to delete a screenshot I attached by mistake alongside 3 correct ones, without having to re-send the other 3.
- As a chat user, I want to still see the batch as one tidy album, not as 4 separate stacked bubbles cluttering the conversation.

## 8. UX requirements

All labels in Spanish.

- **Per-tile hover affordance** (desktop): on hover over a grid tile (`ImageCoverCell`/single-image `ImageCard`, in `ChatMessageBubble.jsx`), show two small icon buttons in the tile's top-right corner — a smile/react icon and a trash/delete icon — each `h-6 w-6`, `bg-black/50` circular, matching the existing `RemoveBtn` visual language already used in `MessageComposer.jsx`'s pending-attachment previews. Hidden by default, `opacity-0 group-hover:opacity-100 transition-opacity`.
- **Touch fallback**: the two icon buttons are always visible at reduced opacity (`opacity-70`) on touch devices (no hover state to reveal them) — detect via existing `touch-manipulation` convention, or simplest: always render them at `opacity-60 sm:opacity-0 sm:group-hover:opacity-100` so touch/mobile always shows them dimmed and desktop reveals on hover.
- **Per-tile react**: tapping the react icon opens the existing `MessageReactionPicker` anchored to that specific tile (not the whole bubble) — same component, same side-opening behavior, just a different anchor.
- **Per-tile delete**: tapping the delete icon opens the existing `ConfirmDialog` (`@atlas/ui`) — "¿Eliminar este archivo?" / "Esta accion no se puede deshacer." — confirming calls the new delete-attachment mutation (Section 12/13). Only the attachment's own sender may delete it (enforced server-side, matches `deleteMessage`'s existing sender-only rule) — the delete icon is hidden entirely for tiles the current viewer didn't send.
- **Per-tile reaction pills**: an attachment-scoped reaction renders as a small pill overlaid on the tile's bottom-left corner (`absolute bottom-1 left-1`, small rounded-full chip, emoji + count, semi-opaque dark background) — reusing the visual pattern of `MessageReactions.jsx`'s existing pills at a smaller size, not the full-size component (that one is sized for below a whole bubble, not inside a ~110px tile).
- **Grid re-layout on delete**: `ImageGrid` already keys each cell off the `images` array position, not a fixed count — removing one attachment from the array and re-rendering naturally re-triggers the existing 1/2/3/4+ branch logic. No new grid code needed beyond passing the updated `attachments` array through (handled by the existing realtime/query-invalidation refresh path).
- **Loading/empty states**: N/A — no new loading state; the delete mutation follows the existing `useDeleteMessage` optimistic-update-then-invalidate pattern.

## 9. Routes/screens

No new routes or screens — modifies `ChatMessageBubble.jsx` (and its internal `ImageCard`/`VideoCard`/`ImageCoverCell`/`AttachmentsBlock` sub-components) and `MessageReactionPicker.jsx`'s call sites.

## 10. Data model

### Modified models

**`chat_message_reactions`** (raw-SQL-managed, not Prisma-modeled — same as today): add a nullable `attachment_id UUID` column, FK to `chat_attachments(id)` `ON DELETE CASCADE` (so deleting an attachment automatically removes its own reactions — no separate cleanup code needed). `NULL` = message-level reaction (today's only case, unchanged). Non-`NULL` = scoped to that one attachment.

Uniqueness: the existing single `UNIQUE (message_id, user_id, emoji)` constraint is dropped and replaced with two **partial unique indexes** (not a single `NULLS NOT DISTINCT` constraint, to avoid depending on Postgres 15+ on the self-hosted VPS):
- `(message_id, user_id, emoji) WHERE attachment_id IS NULL` — one reaction per user per emoji per message, at the message level (today's rule, preserved).
- `(message_id, attachment_id, user_id, emoji) WHERE attachment_id IS NOT NULL` — one reaction per user per emoji per attachment.

No changes to `chat_attachments` or `chat_messages` schema — `chat_attachments` rows are already independently identified and already cascade-delete when their parent message is hard-deleted (they don't today; messages are soft-deleted, so this phase introduces the first actual `DELETE FROM chat_attachments` statement in the codebase, see Section 12).

## 11. Prisma impact

New models: none (raw-SQL table, same as `chat_message_reactions` already is). Modified models: none in `schema.prisma` — this table was never Prisma-modeled, so nothing there changes. **New migration required: Yes** — `prisma/migrations/20260827000000_chat_attachment_reactions/migration.sql`, additive only (new nullable column + new indexes, existing constraint dropped and replaced, no data loss for existing rows since they all get `attachment_id = NULL`, which is exactly their current meaning).

## 12. API contract

### POST /chat/messages/:id/reactions (modified — new optional field)

Auth/permission: unchanged (`chat.conversations.create`).
Body: `{ emoji: string, attachmentId?: string }` — `attachmentId` omitted or `null` behaves exactly as today (message-level reaction). When provided, the server verifies the attachment belongs to that message before toggling; a mismatched/foreign attachment id returns 404.
Response shape: `{ data: { added: boolean, emoji: string, attachmentId: string | null } }` (was `{ added, emoji }` — `attachmentId` is a strictly additive field).
New error: 404 `"Archivo no encontrado."` when `attachmentId` doesn't belong to the target message.

### DELETE /chat/attachments/:id (new)

Auth/permission: `requirePermission("chat.conversations.create")` (matches the existing message-mutation endpoints' permission key — there is no separate "delete" permission for chat today).
Path param: `id` — the `chat_attachments.id` to remove.
Behavior:
- 404 if the attachment doesn't exist, its parent message is already soft-deleted, or the caller isn't that message's `sender_user_id`.
- If this is the attachment's message's only remaining attachment AND the message has an empty/null `body` AND no `metadata.entityRefs` — soft-deletes the whole message (same effect as `DELETE /chat/messages/:messageId`) instead of leaving an empty, contentless message behind.
- Otherwise: deletes the `chat_attachments` row (cascade-removes its own reactions via the FK) and decrements `chat_messages.attachment_count` by 1 **via an `UPDATE chat_messages ... WHERE id = ...`** on the parent — not just a side-effecting read. This matters: the frontend's realtime sync (`subscribeToMessages` in `apps/desktop/src/modules/atlas.chat/lib/supabaseRealtime.js`) is a Supabase `postgres_changes` listener on the `chat_messages` table only — neither `chat_attachments` nor `chat_message_reactions` have their own subscription, and `toggleReaction` never touches `chat_messages` at all (confirmed: message-level reactions already don't realtime-sync to other open clients today — a pre-existing gap, not something this feature fixes). An `UPDATE` on the parent `chat_messages` row is what makes *this* endpoint's result actually reach other clients live, the same way `deleteMessage`'s own `UPDATE ... SET deleted_at = NOW()` does.
Response shape: `{ data: { ok: true, messageDeleted: boolean } }` — `messageDeleted: true` tells the frontend to treat this exactly like a whole-message delete (optimistic-update the message's `deleted_at`) instead of just removing one attachment from its local `attachments` array.
Error codes: 404 (not found / not sender / message already deleted), 403 is not used here (404 is used uniformly for "not found or no permission," matching `deleteMessage`'s existing convention of never distinguishing the two to the caller).

## 13. SDK contract

`packages/sdk/src/domains/chat.js`:
- `toggleReaction(messageId, emoji, token, { attachmentId } = {})` — modified signature (new optional 4th param, object form so it doesn't break the two existing 3-arg call sites); sends `{ emoji, attachmentId: attachmentId ?? null }`.
- `deleteAttachment(attachmentId, token)` — new method, `DELETE /chat/attachments/:id`.

## 14. Validator contract

`packages/validators/src/chat.js`:
- `chatToggleReactionSchema` — add `attachmentId: z.string().uuid().nullable().optional()`.
- No new schema for the delete-attachment endpoint — it takes no request body (path param only), matching `DELETE /chat/messages/:messageId`'s existing no-body convention.

## 15. Module manifest impact

N/A — `atlas.chat` is a core module (`core: true`), not an AME3 custom module; no manifest changes.

## 16. Navigation impact

N/A — no new navigation items.

## 17. Blueprint impact

N/A — `atlas.chat` predates the blueprint system and isn't blueprint-driven.

## 18. RBAC/permissions

No new permission keys. Both endpoints reuse the existing `chat.conversations.create` permission, matching every other message-mutation endpoint in this router (send, delete, pin, react all already share it).

## 19. Multi-company behavior

Unchanged — attachment and reaction rows are scoped through their parent message's `conversation_id`, which is already company-scoped by the existing conversation membership checks (`chat_conversation_members`). No new cross-company exposure surface is introduced.

## 20. Files/storage impact

The Supabase Storage object backing a hard-deleted `chat_attachments` row is **not** removed in this phase (Non-goal 4) — only the DB row (and its reactions, via cascade) are removed. The object becomes orphaned in the `atlas-chat` bucket. Storage cleanup is deferred (Section 28) since it requires a decision on whether to do it synchronously (adds latency/failure surface to the delete request) or via a background sweep job, which doesn't exist yet for this bucket.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — chat message/attachment mutations have never written to `AuditLog` (matches `deleteMessage`'s existing behavior, which also doesn't). Not introducing a new pattern here.

## 23. Edge cases

1. Deleting an attachment while another user has that message's conversation open — the parent message's `UPDATE` (attachment_count decrement, or `deleted_at` in the whole-message-deleted branch) fires the existing `postgres_changes` subscription on `chat_messages` so their client refetches, the same way a normal message delete does today. Verified by confirming the delete-attachment SQL always includes a real `UPDATE chat_messages` statement in both branches, not just a `DELETE FROM chat_attachments`.
2. Deleting the *last* attachment of a message that also has a non-empty body — per Goal 5, this must NOT soft-delete the message (there's still text content); only messages with empty body AND no entity refs AND no remaining attachments get soft-deleted.
3. Reacting to an attachment whose message has since been soft-deleted — the existing `WHERE m.deleted_at IS NULL` guard in `toggleReaction`'s membership check already rejects this with 404, unchanged.
4. A reaction race: two toggles for the same `(message_id, attachment_id, user_id, emoji)` firing near-simultaneously could both pass the pre-insert "does it exist" check and attempt to insert — the partial unique index will reject the second `INSERT` with a duplicate-key error since this phase's `INSERT` (per Section 12/Plan A) does not use `ON CONFLICT` (see Non-goal note in Plan A Task 2 — matches the acceptable-race precedent already set by the pre-existing message-level toggle, which has the same theoretical window today).
5. `attachmentId` provided but pointing at an attachment belonging to a *different* message than the `:id` in the URL — rejected with 404 (Section 12), preventing a client from reacting to attachment X while recording it under message Y.
6. Deleting the only attachment of a message whose body is `""` (empty string, not `null`) — treated as "no body" (Goal 5's "empty ... body" condition uses a falsy/blank check, not strict `null`), matching how `deleteMessage` itself already sets `body = ''` for a fully-deleted message.

## 24. Risks

1. **Orphaned Storage objects accumulate** (Non-goal 4 / Section 20) — mitigation: tracked explicitly as a future enhancement, not silently forgotten; low severity since Storage cost for a chat attachment bucket is small relative to the UX win.
2. **Reaction race condition** (Edge case 4) — mitigation: the toggle endpoint already returns a clean 400/500 on the rare duplicate-key hit rather than corrupting state; a second click naturally resolves it (the reaction now exists, so the next toggle removes it). Acceptable given the pre-existing message-level toggle has the identical theoretical race today and it's never been reported as an issue.
3. **Migration touches a table with existing production rows** — mitigation: the migration is purely additive (new nullable column, existing rows get `attachment_id = NULL` by default, which is their exact current meaning) plus an index swap that doesn't change any existing row's matched behavior for `attachment_id IS NULL` reactions. No backfill script needed.

## 25. Acceptance criteria

1. Given a message with 4 photos, when the sender reacts with 😂 to photo #2 only, then photo #2 shows a 😂 pill and photos #1/#3/#4 and the message-level reaction row do not.
2. Given a message with 4 photos, when the sender deletes photo #3, then the message still has photos #1/#2/#4 and re-renders in the 3-tile grid layout, and photo #3 is gone from every other open client viewing the same conversation.
3. Given a message with exactly 1 photo and no body text, when the sender deletes that photo, then the whole message disappears from the conversation the same way a normal message delete does today.
4. Given a message with 1 photo and body text "mira esto", when the sender deletes that photo, then the message remains visible showing only its text.
5. Given a viewer who is not the sender of a multi-photo message, when they view the grid, then no per-tile delete icon is shown to them (react icon still shown, matching today's message-level reaction permission).
6. Given the reactions API test suite, when `node --test apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js` runs, then all existing message-level-toggle behavior still passes (their assertions gain `attachmentId: null` in the expected return shape, since that field is now always present — no behavioral change), plus new tests for attachment-scoped toggle pass.

## 26. Verification plan

- `node --test apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js` (existing + new attachment-scoped cases).
- `node --test apps/api/src/routes/chat/__tests__/*.test.js` (full chat suite, confirm no regression).
- `node --check` on every modified backend `.js` file.
- esbuild parse-check (`loader: '.jsx': 'jsx'`) on every modified frontend `.jsx` file (this codebase has no configured JSX linter; this is the established substitute used throughout this session).
- Manual/browser verification (documented, not assumed): send a 4-image message, react to one tile, delete one tile, confirm the remaining 3 re-lay-out correctly and the reaction only shows on its own tile.

## 27. Rollback plan

Revert the two application-code commits (backend, frontend). The migration is additive and does not need a down-migration to "undo" the feature from the app's perspective — leaving the `attachment_id` column and the two partial indexes in place after a code revert is harmless (nothing will ever populate `attachment_id` again once the frontend stops sending it, and `IS NULL`-scoped reactions keep working exactly as before this feature existed). If the column must be physically removed later, a new forward migration would `DROP COLUMN IF EXISTS "attachment_id"` and restore the original single `UNIQUE (message_id, user_id, emoji)` constraint — not written proactively per this project's "don't add unused code" convention.

## 28. Future enhancements

1. Storage object cleanup for hard-deleted attachments (Section 20/Risk 1).
2. Per-attachment forward/pin (explicitly out of scope this phase — Non-goal 3).
3. Multi-select delete of several tiles within one grid at once.

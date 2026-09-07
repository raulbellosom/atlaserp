# Plan A (API) — atlas.chat forward endpoint + search DM titles

Spec: `docs/superpowers/specs/2026-09-07-chat-scroll-and-message-actions-design.md`
Status: implemented 2026-09-07 (commit 0ef0c500).
Scope: server + SDK + validators + API tests. No migration.

## A1 — Direct-conversation titles in message search

File: `apps/api/src/routes/chat/chat-search-service.js`

- In the main `$queryRaw`, add `LEFT JOIN LATERAL` that, when `conv.type = 'direct'`,
  selects the other active member's `display_name` and `avatar_url`
  (`chat_conversation_members` join `user_profile`, `user_id <> profileId`,
  `left_at IS NULL`, `LIMIT 1`).
- In the `data.map`, set `conversation.title = r.conversation_title ?? r.dm_name ?? null`
  and `conversation.avatarUrl = r.conversation_avatar_url ?? r.dm_avatar_url ?? null`.

Verify: `node --test apps/api/src/routes/chat/__tests__/chat-search-service.test.js`
(add a case: direct conversation with null title returns the other member's name).

## A2 — Validator for the forward payload

File: `packages/validators/` (chat schemas file — match existing chat schema location)

- `forwardMessagesSchema = z.object({ messageIds: z.array(z.string().uuid()).min(1).max(30), targetConversationIds: z.array(z.string().uuid()).min(1).max(20) })`
- Export it alongside the other chat schemas.

Verify: `node --check` the file; `pnpm --filter @atlas/validators test` if it has tests.

## A3 — `forwardMessages` service

File: `apps/api/src/routes/chat/chat-service.js`

Add `async function forwardMessages({ authUserId, messageIds, targetConversationIds })`:

1. `profileId = await resolveUserProfileId(prisma, authUserId)`.
2. Load sources:
   ```sql
   SELECT m.id, m.conversation_id, m.body, m.message_type, m.attachment_count, m.created_at,
          up.display_name AS sender_name
   FROM chat_messages m
   LEFT JOIN user_profile up ON up.id = m.sender_user_id
   WHERE m.id = ANY(${messageIds}::uuid[]) AND m.deleted_at IS NULL
   ```
   If `rows.length !== unique(messageIds).length` -> `ChatServiceError("Mensaje no encontrado.", 404)`.
3. Membership: gather `distinct conversation_id` from sources + all
   `targetConversationIds`; one query against `chat_conversation_members`
   for `user_id = profileId AND left_at IS NULL`; if any id missing ->
   `ChatServiceError("Sin acceso a la conversacion.", 403)`.
4. Load attachments for all sources:
   `SELECT * FROM chat_attachments WHERE message_id = ANY(${sourceIds}::uuid[])`,
   group by `message_id`.
5. Sort sources by `created_at ASC`.
6. `let forwarded = 0; const inserted = [];`
   For each `targetId` (in the order given), for each source `s`:
   - `prisma.$transaction` (mirror `sendMessage`'s non-thread insert):
     - INSERT `chat_messages` (`conversation_id=targetId`, `sender_user_id=profileId`,
       `sender_type='user'`, `body=s.body`, `message_type=s.message_type`,
       `attachment_count=<count>`, `metadata` =
       `{"forwardedFrom":{"conversationId":s.conversation_id,"messageId":s.id,"senderName":s.sender_name,"at":<s.created_at ISO>}}`)
       `RETURNING *`.
     - For each source attachment: INSERT `chat_attachments`
       (`conversation_id=targetId`, `bucket`, `object_key`, `file_name`,
       `mime_type`, `size_bytes`, `uploaded_by_user_id=profileId`,
       `message_id=<new id>`).
   - `await updateConversationLastMessage(targetId, newMsg.id, newMsg.created_at)`.
   - `inserted.push({ msg: newMsg, targetId }); forwarded++`.
7. Best-effort notifications: `setImmediate` loop over `inserted`, reuse the
   existing notification block from `sendMessage` (extract a shared
   `notifyNewMessage({ conversationId, message, body })` helper if the
   duplication is large; otherwise inline a trimmed copy — mentions do not
   apply to forwards).
8. `return { forwarded }`.

Export `forwardMessages` from the service factory return object (near
`sendMessage`).

Verify: new tests below.

## A4 — Route

File: `apps/api/src/routes/chat/index.js`

- `internal.post("/messages/forward", requirePermission("chat.conversations.read"), async (c) => { ... })`
  - parse body with `forwardMessagesSchema`,
  - `const authUserId = c.get("authUserId")` (match how sibling routes read it),
  - `const result = await chatService.forwardMessages({ authUserId, ...parsed })`,
  - `return c.json(result)`.
  - Map `ChatServiceError` via the same error handling sibling routes use.

Verify: route registered before the 1000-line note's extraction target isn't
worsened — this adds ~12 lines; acceptable. If `index.js` is already >1000,
place the handler in `chat-forward-routes.js` sibling and mount it (follow the
moderation-routes precedent named in CLAUDE.md). Decide at implementation time
based on the current line count.

## A5 — SDK

File: `packages/sdk/` chat client section.

- `forwardMessages: (payload, token) => http.post("/chat/messages/forward", payload, token)`
  under the `chat` group, matching the existing method style.

Verify: `node --check`; `pnpm --filter @atlas/sdk test` if present.

## A6 — API tests

File: `apps/api/src/routes/chat/__tests__/chat-forward.test.js` (new)

Cases:
- forwards a text message to one target; new row has `forwardedFrom` with the
  right shape; `forwarded === 1`.
- forwards a message with 2 attachments; 2 new `chat_attachments` rows exist
  for the new message with the same `object_key`s and
  `uploaded_by_user_id === forwarder`; source rows untouched.
- multi-message + multi-target: `forwarded === messages * targets`; per target
  the inserted order is ascending `created_at`.
- attachment-only message (empty body) forwards fine.
- caller not a member of a source conversation -> 403.
- caller not a member of a target conversation -> 403.
- unknown / soft-deleted message id -> 404.
- `updateConversationLastMessage` ran for each target (last message id/time
  match the last inserted).

Verify: `node --test apps/api/src/routes/chat/__tests__/` all green;
then full `node --test apps/api/src/...`.

## Done when

- `node --test apps/api/src/...` green.
- `pnpm lint` green.
- SDK + validator exports resolve in `vite build` (checked by Plan B).

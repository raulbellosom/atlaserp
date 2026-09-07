# Plan A — Chat conversation pin/hide API

Spec: `docs/superpowers/specs/2026-09-07-chat-conversation-gestures-design.md`

## Tasks

1. **Migration** `prisma/migrations/20260907000000_chat_conversation_pin_hide/migration.sql`
   - Add `pinned_at`, `hidden_at` (TIMESTAMPTZ) to `chat_conversation_members`.
   - Two partial indexes (see spec).

2. **`chat-conversation-reads-service.js`**
   - `listConversations`: add `hidden_at IS NULL` guard (non-archived branch),
     select `pinned_at` + `is_pinned`, reorder `ORDER BY (pinned_at IS NOT NULL)
     DESC, pinned_at DESC, COALESCE(last_message_at, created_at) DESC`.
   - Add `pinConversation({conversationId, authUserId, pinned})`.
   - Add `hideConversation({conversationId, authUserId})` — 400 if not `direct`.
   - Return both from the factory.

3. **`chat-service.js`**
   - Destructure `pinConversation`, `hideConversation` from
     `conversationReadsService`; add to the returned object.
   - `updateConversationLastMessage`: clear `hidden_at` for the conversation.

4. **Validators** — `chatPinConversationSchema` in `packages/validators/src/chat.js`
   + re-export from `packages/validators/src/index.js`.

5. **Routes** (`apps/api/src/routes/chat/index.js`) — `PATCH /conversations/:id/pin`,
   `POST /conversations/:id/hide`, both `requirePermission("chat.conversations.read")`.
   Import `chatPinConversationSchema`.

6. **SDK** — `pinConversation`, `hideConversation` in
   `packages/sdk/src/domains/chat.js`.

7. **Tests** — `apps/api/src/routes/chat/__tests__/chat-conversation-pin-hide.test.js`.
   Run `node --test apps/api/src/routes/chat/__tests__/`.

## Verify

- `pnpm db:migrate` (live Supabase).
- `node --test apps/api/src/routes/chat/__tests__/` green.
- `pnpm --filter @atlas/validators test` (if present) / `node --check`.

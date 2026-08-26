# Chat Pins & Reactions Phase D — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce `messages.pin` for pinning/unpinning, add a reactions table + toggle endpoint, and expose both in `listMessages`/`getMessageFull`.

**Architecture:** A migration adds `pinned_at`/`pinned_by_user_id` to `chat_messages` and a new `chat_message_reactions` table. `pinMessage`/`listPinnedMessages` join `chat-service.js` (tightly coupled to existing message functions and the already-in-scope `permissionsService`). A new sibling `chat-reactions-service.js` handles the toggle (self-contained, unprivileged — no `permissionsService` dependency needed).

**Tech Stack:** Hono, Prisma `$queryRaw`/`$executeRaw`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-26-chat-pins-reactions-phase-d-design.md`

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/migrations/20260826000000_chat_pins_reactions/migration.sql` | Create | `chat_messages` pin columns, `chat_message_reactions` table, RLS, realtime |
| `apps/api/src/routes/chat/chat-reactions-service.js` | Create | `toggleReaction` |
| `apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js` | Create | Unit tests |
| `apps/api/src/routes/chat/chat-service.js` | Modify | `pinMessage`, `listPinnedMessages`; `listMessages`/`getMessageFull` gain `pinnedAt`/`pinnedByUserId`/`reactions` fields |
| `apps/api/src/routes/chat/index.js` | Modify | Wire `chat-reactions-service.js`; 3 new routes |
| `packages/validators/src/chat.js` | Modify | `chatPinMessageSchema`, `chatToggleReactionSchema` |
| `packages/sdk/src/domains/chat.js` | Modify | `pinMessage`, `listPinnedMessages`, `toggleReaction` |

---

### Task 1: Migration

**Files:**
- Create: `prisma/migrations/20260826000000_chat_pins_reactions/migration.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =============================================================================
-- Atlas ERP — Chat Pinned Messages & Reactions (Phase D)
-- Migration: 20260826000000_chat_pins_reactions
-- =============================================================================

ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pinned_by_user_id" UUID;

CREATE INDEX "chat_messages_pinned_idx"
  ON "chat_messages" ("conversation_id", "pinned_at" DESC)
  WHERE "pinned_at" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- chat_message_reactions — mirrors the Prisma-modeled EntityCommentReaction
-- shape (generic comments feature) for consistency; raw-SQL here since chat
-- tables aren't Prisma-modeled.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
  "id"         UUID        NOT NULL DEFAULT uuidv7(),
  "message_id" UUID        NOT NULL,
  "user_id"    UUID        NOT NULL,
  "emoji"      TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_message_reactions_message_fkey"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_message_reactions_unique" UNIQUE ("message_id", "user_id", "emoji")
);

CREATE INDEX "chat_message_reactions_message_id_idx"
  ON "chat_message_reactions" ("message_id");

ALTER TABLE "chat_message_reactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_message_reactions_select" ON "chat_message_reactions"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_messages m
      WHERE m.id = message_id AND chat_is_member(m.conversation_id)
    )
  );

CREATE POLICY "chat_message_reactions_service_all" ON "chat_message_reactions"
  FOR ALL USING (auth.role() = 'service_role');

ALTER PUBLICATION supabase_realtime ADD TABLE "chat_message_reactions";
```

- [ ] **Step 2: Apply and sanity-check**

```bash
pnpm db:migrate
```
Sanity query (via `pnpm db:studio` or a throwaway script, no secrets printed):
```sql
SELECT count(*) FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name IN ('pinned_at', 'pinned_by_user_id');
-- expect 2
SELECT count(*) FROM information_schema.tables WHERE table_name = 'chat_message_reactions';
-- expect 1
```

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/20260826000000_chat_pins_reactions/migration.sql
git commit -m "feat(chat): add pin columns and reactions table"
```

---

### Task 2: `chat-reactions-service.js`

**Files:**
- Create: `apps/api/src/routes/chat/chat-reactions-service.js`
- Create: `apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatReactionsService, ChatReactionsError } from "../chat-reactions-service.js";

function buildPrismaMock(queryRawResults, executeRawResults = []) {
  let qIdx = 0, eIdx = 0;
  return {
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    $executeRaw: async () => executeRawResults[eIdx++] ?? { count: 1 },
  };
}

describe("chat-reactions-service — toggleReaction", () => {
  it("throws 404 when the message doesn't exist or isn't in a conversation the caller belongs to", async () => {
    const prisma = buildPrismaMock([
      [{ id: "profile-1" }], // resolveUserProfileId
      [], // message + membership lookup: no match
    ]);
    const svc = createChatReactionsService({ prisma });
    await assert.rejects(
      () => svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "👍" }),
      (err) => err instanceof ChatReactionsError && err.status === 404,
    );
  });

  it("adds the reaction when the caller hasn't reacted with this emoji yet", async () => {
    const prisma = buildPrismaMock([
      [{ id: "profile-1" }],
      [{ id: "msg-1" }],       // message + membership lookup: found
      [],                      // existing-reaction check: none
      [{ id: "reaction-1" }],  // INSERT ... RETURNING id
    ]);
    const svc = createChatReactionsService({ prisma });
    const result = await svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "👍" });
    assert.deepEqual(result, { added: true, emoji: "👍" });
  });

  it("removes the reaction when the caller already reacted with this emoji (toggle off)", async () => {
    const prisma = buildPrismaMock([
      [{ id: "profile-1" }],
      [{ id: "msg-1" }],
      [{ id: "reaction-1" }], // existing-reaction check: found
    ], [
      { count: 1 }, // DELETE
    ]);
    const svc = createChatReactionsService({ prisma });
    const result = await svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "👍" });
    assert.deepEqual(result, { added: false, emoji: "👍" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js`

- [ ] **Step 3: Implement**

```javascript
// apps/api/src/routes/chat/chat-reactions-service.js
import { resolveUserProfileId } from "./chat-service.js";

export class ChatReactionsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatReactionsError";
    this.status = status;
  }
}

export function createChatReactionsService({ prisma }) {
  async function toggleReaction({ messageId, authUserId, emoji }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);

    const rows = await prisma.$queryRaw`
      SELECT m.id FROM chat_messages m
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = m.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE m.id = ${messageId} AND m.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatReactionsError("Mensaje no encontrado.", 404);

    const existing = await prisma.$queryRaw`
      SELECT id FROM chat_message_reactions
      WHERE message_id = ${messageId} AND user_id = ${profileId} AND emoji = ${emoji}
      LIMIT 1
    `;

    if (existing.length) {
      await prisma.$executeRaw`DELETE FROM chat_message_reactions WHERE id = ${existing[0].id}`;
      return { added: false, emoji };
    }

    await prisma.$queryRaw`
      INSERT INTO chat_message_reactions (message_id, user_id, emoji)
      VALUES (${messageId}, ${profileId}, ${emoji})
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
      RETURNING id
    `;
    return { added: true, emoji };
  }

  return { toggleReaction };
}
```

Note: the `INSERT ... ON CONFLICT DO NOTHING` guards the edge case from spec Section 23.2 (a concurrent duplicate insert race) — if a race means the row already exists by the time this INSERT runs, it's a harmless no-op and `{ added: true }` is still the correct response (the caller's desired end state — "I reacted" — is achieved either way).

- [ ] **Step 4: Run to verify pass, syntax check, commit**

```bash
node --test apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js
node --check apps/api/src/routes/chat/chat-reactions-service.js
git add apps/api/src/routes/chat/chat-reactions-service.js apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js
git commit -m "feat(chat): add reaction toggle service"
```

---

### Task 3: `pinMessage`/`listPinnedMessages` in `chat-service.js`, expose pin/reactions in message reads

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`
- Modify: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Add `pinnedAt`/`pinnedByUserId`/`reactions` to `listMessages` and `getMessageFull`**

Read the current file first (line numbers may have shifted). In `listMessages`'s SQL (the `SELECT` list), add after `m.deleted_at,`:
```sql
        m.pinned_at,
        m.pinned_by_user_id,
```
and add a new correlated subquery alongside the existing `attachments` one:
```sql
        -- reactions, grouped by emoji
        (
          SELECT json_agg(json_build_object('emoji', r.emoji, 'userIds', r.user_ids))
          FROM (
            SELECT emoji, json_agg(user_id) AS user_ids
            FROM chat_message_reactions
            WHERE message_id = m.id
            GROUP BY emoji
          ) r
        ) AS reactions
```
(This becomes the last item in the `SELECT` list — remember the preceding `attachments` line needs its trailing comma restored since `reactions` is now last.)

Make the exact same two additions (columns + reactions subquery) to `getMessageFull`'s `SELECT` list.

- [ ] **Step 2: Add `pinMessage`**

Add this new function to `chat-service.js`, placed near `editMessage`/`deleteMessage` (after `deleteMessage`):

```javascript
  async function pinMessage({ messageId, authUserId, pinned }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT m.id, m.conversation_id, c.type AS conversation_type
      FROM chat_messages m
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = m.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      INNER JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.id = ${messageId} AND m.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Mensaje no encontrado.", 404);
    const { conversation_id: conversationId, conversation_type: conversationType } = rows[0];

    if (permissionsService && (conversationType === "channel" || conversationType === "group")) {
      await permissionsService.assertChannelPermission(conversationId, profileId, "messages.pin");
    }

    await prisma.$executeRaw`
      UPDATE chat_messages
      SET pinned_at = ${pinned ? new Date() : null},
          pinned_by_user_id = ${pinned ? profileId : null}
      WHERE id = ${messageId}
    `;

    return getMessageFull(messageId);
  }

  async function listPinnedMessages({ conversationId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const rows = await prisma.$queryRaw`
      SELECT m.id FROM chat_messages m
      WHERE m.conversation_id = ${conversationId} AND m.pinned_at IS NOT NULL AND m.deleted_at IS NULL
      ORDER BY m.pinned_at DESC
    `;
    const messages = await Promise.all(rows.map((r) => getMessageFull(r.id)));
    return { data: messages.filter(Boolean) };
  }
```

- [ ] **Step 3: Export the two new functions**

In the object returned at the end of `createChatService`, add `pinMessage` and `listPinnedMessages` alongside the existing exports (e.g. next to `deleteMessage`).

- [ ] **Step 4: Add tests**

Append to `apps/api/src/routes/chat/__tests__/chat-service.test.js` (follow this file's existing `buildPrismaMock`/fake-`permissionsService` conventions — read the file first for the exact call-sequence style already used by the `updateConversation`/`addMembers`/`removeMember` permission-enforcement describe blocks, which this closely mirrors):

```javascript
describe("chat-service — pinMessage permission enforcement", () => {
  it("channel: calls assertChannelPermission with messages.pin and propagates a 403 rejection", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],                                             // resolveUserProfileId
      [{ id: "msg-1", conversation_id: CONV_ID, conversation_type: "channel" }], // message+membership+type lookup
    ]);
    let calledWith = null;
    const permissionsService = {
      assertChannelPermission: async (convId, profileId, key) => {
        calledWith = { convId, profileId, key };
        const err = new Error("No tienes permiso para realizar esta accion.");
        err.status = 403;
        throw err;
      },
    };
    const svc = createChatService({ prisma, permissionsService });
    await assert.rejects(
      () => svc.pinMessage({ messageId: "msg-1", authUserId: AUTH_USER_ID, pinned: true }),
      (err) => err.status === 403,
    );
    assert.deepEqual(calledWith, { convId: CONV_ID, profileId: PROFILE_ID, key: "messages.pin" });
  });

  it("direct: never calls assertChannelPermission — behavior unaffected", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "msg-1", conversation_id: CONV_ID, conversation_type: "direct" }],
      [], // UPDATE via $executeRaw doesn't consume $queryRaw
      [{  // getMessageFull's query
        id: "msg-1", conversation_id: CONV_ID, sender_user_id: PROFILE_ID, sender_guest_id: null,
        sender_type: "user", body: "hola", message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        pinned_at: new Date(), pinned_by_user_id: PROFILE_ID,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null, reactions: null,
      }],
    ]);
    const permissionsService = { assertChannelPermission: throwingAssertChannelPermission };
    const svc = createChatService({ prisma, permissionsService });
    const result = await svc.pinMessage({ messageId: "msg-1", authUserId: AUTH_USER_ID, pinned: true });
    assert.ok(result);
  });
});
```

Note: `getMessageFull`'s exact `$queryRaw` call sequence (and whether the `[]` placeholder for the `$executeRaw` UPDATE step is even needed, since `$executeRaw` and `$queryRaw` consume from separate mocked arrays in this file's `buildPrismaMock`) must be verified against the real, current `getMessageFull` implementation before finalizing this test — read it and adjust the mock array precisely; do not guess. This mirrors the exact same discipline Phase C's Plan A Task 2 already required for its `sendMessage` tests.

- [ ] **Step 5: Full suite, syntax check, commit**

```bash
node --check apps/api/src/routes/chat/chat-service.js
node --test apps/api/src/routes/chat/__tests__/chat-service.test.js apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js apps/api/src/routes/chat/__tests__/channel-directory-service.test.js
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): enforce messages.pin, add pinMessage/listPinnedMessages, expose pin+reactions in message reads"
```

---

### Task 4: Validators, SDK, routes

**Files:**
- Modify: `packages/validators/src/chat.js`
- Modify: `packages/sdk/src/domains/chat.js`
- Modify: `apps/api/src/routes/chat/index.js`

- [ ] **Step 1: Validators**

Append to `packages/validators/src/chat.js`:

```javascript
export const chatPinMessageSchema = z.object({
  pinned: z.boolean(),
});

export const chatToggleReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});
```

- [ ] **Step 2: SDK**

Append to `packages/sdk/src/domains/chat.js`'s returned object (near the existing `editMessage`/`deleteMessage` methods):

```javascript
    pinMessage: (messageId, pinned, token) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}/pin`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ pinned }),
      }),

    listPinnedMessages: (conversationId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/pinned-messages`, {
        headers: withAuthHeaders(token),
      }),

    toggleReaction: (messageId, emoji, token) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ emoji }),
      }),
```

- [ ] **Step 3: Routes**

In `apps/api/src/routes/chat/index.js`: read the current file first. Add the two new validator imports (`chatPinMessageSchema`, `chatToggleReactionSchema`) to the existing `@atlas/validators` import block; import and instantiate `createChatReactionsService` alongside the other sibling services:

```javascript
import { createChatReactionsService } from "./chat-reactions-service.js";
```
```javascript
  const reactionsService = createChatReactionsService({ prisma });
```

Add 3 new routes (placed near the existing `PATCH /messages/:id` / `DELETE /messages/:id` routes, following this file's established try/catch + `ZodError` → 422 + `handleError` pattern exactly):

```javascript
  // PATCH /chat/messages/:id/pin
  internal.patch("/messages/:id/pin", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const messageId = c.req.param("id");
      const body = await c.req.json();
      const { pinned } = chatPinMessageSchema.parse(body);
      const result = await chatService.pinMessage({ messageId, authUserId, pinned });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error fijando el mensaje.");
    }
  });

  // GET /chat/conversations/:id/pinned-messages
  internal.get("/conversations/:id/pinned-messages", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const result = await chatService.listPinnedMessages({ conversationId, authUserId });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error listando mensajes fijados.");
    }
  });

  // POST /chat/messages/:id/reactions
  internal.post("/messages/:id/reactions", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const messageId = c.req.param("id");
      const body = await c.req.json();
      const { emoji } = chatToggleReactionSchema.parse(body);
      const result = await reactionsService.toggleReaction({ messageId, authUserId, emoji });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error reaccionando al mensaje.");
    }
  });
```

Also add `ChatReactionsError` to the `handleError` function's `instanceof` check (import it alongside `createChatReactionsService`), mirroring exactly how `ChatPermissionsError` was added in Phase A.

- [ ] **Step 4: Full build/test verification and commit**

```bash
node --check apps/api/src/routes/chat/index.js
node --check packages/validators/src/chat.js
node --check packages/sdk/src/domains/chat.js
node --test apps/api/src/routes/chat/__tests__/chat-service.test.js apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js apps/api/src/routes/chat/__tests__/chat-mentions-service.test.js apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js apps/api/src/routes/chat/__tests__/channel-directory-service.test.js
git add packages/validators/src/chat.js packages/sdk/src/domains/chat.js apps/api/src/routes/chat/index.js
git commit -m "feat(chat): wire pin and reaction routes"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers Section 10/11. Task 2 covers Section 12's reaction endpoint and Section 23.2's race handling. Task 3 covers Section 12's pin endpoint, Section 18's permission enforcement, and Section 12's "additive fields on existing reads" requirement. Task 4 covers Section 13/14 and wires everything live.
- **Consistency with established patterns:** `pinMessage`'s permission check mirrors `updateConversation`/`addMembers`/`removeMember`'s exact `if (permissionsService && (type === "channel" || type === "group"))` gating pattern from Phase A's final fix — same shape, same reasoning (direct/external_support have no roles to check against).
- **No placeholders**, except the explicit "verify getMessageFull's exact call sequence against the real file" instruction in Task 3 Step 4 — a deliberate "read the real code, don't guess" instruction matching the same discipline already required (and already found to matter) in Phase C's Plan A.

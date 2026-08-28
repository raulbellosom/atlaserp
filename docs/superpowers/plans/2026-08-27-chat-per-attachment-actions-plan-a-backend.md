# Chat Per-Attachment Actions — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reaction and a delete target one specific attachment inside a multi-attachment message, instead of only the whole message.

**Architecture:** One additive migration (nullable `attachment_id` on `chat_message_reactions` + two partial unique indexes replacing the old single unique constraint). `chat-reactions-service.js`'s `toggleReaction` grows an optional `attachmentId` param. `chat-service.js` grows a new `deleteAttachment` function (sibling to the existing `deleteMessage`) and its two message-reading queries (`getMessageFull`, `listMessages`) grow a nested per-attachment `reactions` array while their existing message-level `reactions` field is scoped to `attachment_id IS NULL` so the two never overlap.

**Tech Stack:** Hono, Prisma `$queryRaw`/`$executeRaw` (raw SQL — this table isn't Prisma-modeled), `node:test`, Zod.

**Spec:** `docs/superpowers/specs/2026-08-27-chat-per-attachment-actions-design.md`

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/migrations/20260827000000_chat_attachment_reactions/migration.sql` | Create | `attachment_id` column + partial unique indexes |
| `apps/api/src/routes/chat/chat-reactions-service.js` | Modify | `toggleReaction` accepts `attachmentId` |
| `apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js` | Modify | Update existing assertions, add attachment-scoped cases |
| `apps/api/src/routes/chat/chat-service.js` | Modify | New `deleteAttachment`; `getMessageFull`/`listMessages` reaction queries updated |
| `apps/api/src/routes/chat/__tests__/chat-service.test.js` | Modify | New `deleteAttachment` tests |
| `apps/api/src/routes/chat/index.js` | Modify | Reactions route reads `attachmentId`; new `DELETE /attachments/:id` route |
| `packages/validators/src/chat.js` | Modify | `chatToggleReactionSchema` gains `attachmentId` |
| `packages/sdk/src/domains/chat.js` | Modify | `toggleReaction` gains 4th param; new `deleteAttachment` method |

---

### Task 1: Migration

**Files:**
- Create: `prisma/migrations/20260827000000_chat_attachment_reactions/migration.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =============================================================================
-- Atlas ERP — Chat Per-Attachment Reactions
-- Migration: 20260827000000_chat_attachment_reactions
-- =============================================================================
-- Additive only: existing chat_message_reactions rows all get
-- attachment_id = NULL, which is exactly their current meaning
-- (a message-level reaction). No backfill needed.

ALTER TABLE "chat_message_reactions"
  ADD COLUMN IF NOT EXISTS "attachment_id" UUID;

ALTER TABLE "chat_message_reactions"
  ADD CONSTRAINT "chat_message_reactions_attachment_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "chat_attachments"("id") ON DELETE CASCADE;

-- Replace the single UNIQUE(message_id, user_id, emoji) constraint with two
-- partial unique indexes. A plain UNIQUE constraint including attachment_id
-- would NOT work here: Postgres treats every NULL as distinct by default, so
-- multiple message-level (attachment_id IS NULL) reactions from the same user
-- with the same emoji would NOT violate a naive UNIQUE(message_id,
-- attachment_id, user_id, emoji) constraint. NULLS NOT DISTINCT (PG 15+)
-- would fix that in one constraint, but this database's version on the
-- self-hosted VPS isn't guaranteed to be 15+, so two partial indexes are used
-- instead — portable back to any Postgres version this project already runs on.
ALTER TABLE "chat_message_reactions"
  DROP CONSTRAINT IF EXISTS "chat_message_reactions_unique";

CREATE UNIQUE INDEX "chat_message_reactions_message_unique"
  ON "chat_message_reactions" ("message_id", "user_id", "emoji")
  WHERE "attachment_id" IS NULL;

CREATE UNIQUE INDEX "chat_message_reactions_attachment_unique"
  ON "chat_message_reactions" ("message_id", "attachment_id", "user_id", "emoji")
  WHERE "attachment_id" IS NOT NULL;

CREATE INDEX "chat_message_reactions_attachment_id_idx"
  ON "chat_message_reactions" ("attachment_id")
  WHERE "attachment_id" IS NOT NULL;
```

- [ ] **Step 2: Apply the migration**

Run: `pnpm db:migrate`
Expected: `20260827000000_chat_attachment_reactions` listed as applied, no errors. If the VPS Postgres version predates partial index support (it doesn't — partial indexes have existed since Postgres 7.2 — this step is a formality, not a real risk) the command would fail loudly here, before any application code changes.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `pnpm db:generate`
Expected: succeeds with no schema diff warnings — `chat_message_reactions` was never Prisma-modeled, so this is a no-op confirmation, not a real regeneration of anything touching this table.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260827000000_chat_attachment_reactions/migration.sql
git commit -m "feat(chat): add attachment_id to chat_message_reactions for per-photo reactions"
```

---

### Task 2: `chat-reactions-service.js` — attachment-scoped toggle

**Files:**
- Modify: `apps/api/src/routes/chat/chat-reactions-service.js`
- Modify: `apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js`

- [ ] **Step 1: Update the two existing test assertions (they now expect `attachmentId: null`)**

In `apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js`, change:

```javascript
    const result = await svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "👍" });
    assert.deepEqual(result, { added: true, emoji: "👍" });
```

to:

```javascript
    const result = await svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "👍" });
    assert.deepEqual(result, { added: true, emoji: "👍", attachmentId: null });
```

and the toggle-off test's:

```javascript
    const result = await svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "👍" });
    assert.deepEqual(result, { added: false, emoji: "👍" });
```

to:

```javascript
    const result = await svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "👍" });
    assert.deepEqual(result, { added: false, emoji: "👍", attachmentId: null });
```

- [ ] **Step 2: Add the new failing tests for attachment-scoped toggle**

Append to the same file, inside the existing `describe("chat-reactions-service — toggleReaction", ...)` block:

```javascript
  it("throws 404 when attachmentId doesn't belong to the target message", async () => {
    const prisma = buildPrismaMock([
      [{ id: "profile-1" }],
      [{ id: "msg-1" }],       // message + membership lookup: found
      [],                      // attachment ownership check: no match
    ]);
    const svc = createChatReactionsService({ prisma });
    await assert.rejects(
      () => svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "👍", attachmentId: "att-1" }),
      (err) => err instanceof ChatReactionsError && err.status === 404,
    );
  });

  it("adds an attachment-scoped reaction, keyed separately from message-level ones", async () => {
    const prisma = buildPrismaMock([
      [{ id: "profile-1" }],
      [{ id: "msg-1" }],
      [{ id: "att-1" }],       // attachment ownership check: found
      [],                      // existing-reaction check (scoped to this attachment): none
      [{ id: "reaction-1" }],  // INSERT ... RETURNING id
    ]);
    const svc = createChatReactionsService({ prisma });
    const result = await svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "😂", attachmentId: "att-1" });
    assert.deepEqual(result, { added: true, emoji: "😂", attachmentId: "att-1" });
  });

  it("removes an attachment-scoped reaction on toggle-off", async () => {
    const prisma = buildPrismaMock([
      [{ id: "profile-1" }],
      [{ id: "msg-1" }],
      [{ id: "att-1" }],
      [{ id: "reaction-1" }], // existing-reaction check: found
    ], [
      { count: 1 }, // DELETE
    ]);
    const svc = createChatReactionsService({ prisma });
    const result = await svc.toggleReaction({ messageId: "msg-1", authUserId: "auth-1", emoji: "😂", attachmentId: "att-1" });
    assert.deepEqual(result, { added: false, emoji: "😂", attachmentId: "att-1" });
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js`
Expected: FAIL — the two updated assertions fail because the current implementation never returns `attachmentId`; the two new tests fail because `toggleReaction` doesn't accept/use `attachmentId` at all yet.

- [ ] **Step 4: Rewrite `toggleReaction`**

Replace the whole function body in `apps/api/src/routes/chat/chat-reactions-service.js`:

```javascript
import { resolveUserProfileId } from "./chat-service.js";

export class ChatReactionsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatReactionsError";
    this.status = status;
  }
}

export function createChatReactionsService({ prisma }) {
  // attachmentId omitted/null = message-level reaction (unchanged behavior).
  // attachmentId set = scoped to that one attachment inside the message —
  // toggled independently from the message-level reaction set and from
  // every other attachment's own reactions.
  async function toggleReaction({ messageId, authUserId, emoji, attachmentId = null }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);

    const rows = await prisma.$queryRaw`
      SELECT m.id FROM chat_messages m
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = m.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE m.id = ${messageId} AND m.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatReactionsError("Mensaje no encontrado.", 404);

    if (attachmentId) {
      const attRows = await prisma.$queryRaw`
        SELECT id FROM chat_attachments WHERE id = ${attachmentId} AND message_id = ${messageId} LIMIT 1
      `;
      if (!attRows.length) throw new ChatReactionsError("Archivo no encontrado.", 404);
    }

    // IS NOT DISTINCT FROM (not =) so a NULL attachmentId still matches NULL
    // rows — plain `=` never matches NULL in SQL, which would silently break
    // the message-level (attachmentId omitted) toggle-off path entirely.
    const existing = await prisma.$queryRaw`
      SELECT id FROM chat_message_reactions
      WHERE message_id = ${messageId}
        AND attachment_id IS NOT DISTINCT FROM ${attachmentId}
        AND user_id = ${profileId} AND emoji = ${emoji}
      LIMIT 1
    `;

    if (existing.length) {
      await prisma.$executeRaw`DELETE FROM chat_message_reactions WHERE id = ${existing[0].id}`;
      return { added: false, emoji, attachmentId };
    }

    // No ON CONFLICT here (unlike a plain single-constraint table): the two
    // partial unique indexes from the migration would each need their own
    // differently-shaped ON CONFLICT target depending on whether
    // attachmentId is null, which raw SQL can't branch on inline. The
    // pre-check above already covers the common case; a genuine concurrent
    // double-click race is a pre-existing, documented, low-severity
    // possibility (spec Section 24 risk 2) that already existed for
    // message-level reactions before this change.
    await prisma.$queryRaw`
      INSERT INTO chat_message_reactions (message_id, attachment_id, user_id, emoji)
      VALUES (${messageId}, ${attachmentId}, ${profileId}, ${emoji})
      RETURNING id
    `;
    return { added: true, emoji, attachmentId };
  }

  return { toggleReaction };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js`
Expected: PASS — all 6 tests (2 original updated + 2 original toggle-off/on unaffected by null path since `IS NOT DISTINCT FROM NULL` still matches NULL rows + 2 new).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/chat-reactions-service.js apps/api/src/routes/chat/__tests__/chat-reactions-service.test.js
git commit -m "feat(chat): scope message reactions to an individual attachment"
```

---

### Task 3: Embed per-attachment reactions in message reads

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js` (two call sites: `getMessageFull` and `listMessages`)

- [ ] **Step 1: Update `getMessageFull`'s attachments+reactions SQL block**

In `apps/api/src/routes/chat/chat-service.js`, find the block starting around line 553 (`(SELECT json_agg(json_build_object( 'id', a.id, ...`) inside `getMessageFull`. Replace it and the `reactions` block right after it with:

```javascript
        (
          SELECT json_agg(json_build_object(
            'id', a.id,
            'fileName', a.file_name,
            'mimeType', a.mime_type,
            'sizeBytes', a.size_bytes,
            'width', a.width,
            'height', a.height,
            'objectKey', a.object_key,
            'bucket', a.bucket,
            'reactions', (
              SELECT json_agg(json_build_object('emoji', ar.emoji, 'userIds', ar.user_ids))
              FROM (
                SELECT emoji, json_agg(user_id) AS user_ids
                FROM chat_message_reactions
                WHERE attachment_id = a.id
                GROUP BY emoji
              ) ar
            )
          ) ORDER BY a.created_at)
          FROM chat_attachments a WHERE a.message_id = m.id
        ) AS attachments,
        -- reactions, grouped by emoji — message-level ONLY. Attachment-scoped
        -- reactions are nested inside each attachment object above instead,
        -- so a single reaction never shows up in both places.
        (
          SELECT json_agg(json_build_object('emoji', r.emoji, 'userIds', r.user_ids))
          FROM (
            SELECT emoji, json_agg(user_id) AS user_ids
            FROM chat_message_reactions
            WHERE message_id = m.id AND attachment_id IS NULL
            GROUP BY emoji
          ) r
        ) AS reactions
```

- [ ] **Step 2: Apply the identical change to `listMessages`**

Same replacement, same two blocks, inside `listMessages` (the near-duplicate SQL starting around line 631). The two queries have always carried near-identical attachments/reactions sub-selects (pre-existing duplication, not introduced by this task) — keep them in sync the same way the file already does today.

- [ ] **Step 3: Add a regression test proving the split**

In `apps/api/src/routes/chat/__tests__/chat-service.test.js`, add:

```javascript
describe("chat-service — listMessages separates message-level and attachment-level reactions", () => {
  it("returns message-level reactions in `reactions` and per-attachment reactions nested in `attachments`", async () => {
    const msgId = "01900000-0000-7000-8000-00000000m005";
    const attId = "01900000-0000-7000-8000-00000000a001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [{ id: PROFILE_ID }], // assertMember lookup
      [
        {
          id: msgId,
          conversation_id: CONV_ID,
          sender_user_id: PROFILE_ID,
          sender_type: "user",
          body: null,
          message_type: "image",
          attachment_count: 1,
          metadata: {},
          created_at: new Date(),
          edited_at: null,
          deleted_at: null,
          pinned_at: null,
          pinned_by_user_id: null,
          thread_root_id: null,
          thread_reply_count: 0,
          thread_last_reply_at: null,
          sender: { id: PROFILE_ID, displayName: "Ada", avatarFileId: null },
          attachments: [
            { id: attId, fileName: "foto.jpg", mimeType: "image/jpeg", sizeBytes: 100, width: null, height: null, objectKey: "k", bucket: "atlas-chat", reactions: [{ emoji: "😂", userIds: [OTHER_PROFILE_ID] }] },
          ],
          reactions: [{ emoji: "👍", userIds: [PROFILE_ID] }],
        },
      ],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.listMessages({ conversationId: CONV_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result.data[0].reactions, [{ emoji: "👍", userIds: [PROFILE_ID] }]);
    assert.deepEqual(result.data[0].attachments[0].reactions, [{ emoji: "😂", userIds: [OTHER_PROFILE_ID] }]);
  });
});
```

Note: this test mocks the SQL's *result shape* (proving the service correctly passes the DB's nested JSON straight through), not the SQL text itself — matching this file's existing convention of not asserting raw SQL strings for `listMessages` (only the spy-based tests for `deleteMessage` do that, because that one issues conditional `$executeRaw` calls worth counting).

- [ ] **Step 4: Run the test**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): nest per-attachment reactions inside each attachment in message reads"
```

---

### Task 4: `deleteAttachment`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`
- Modify: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/routes/chat/__tests__/chat-service.test.js`:

```javascript
describe("chat-service — deleteAttachment", () => {
  const ATT_ID = "01900000-0000-7000-8000-00000000a010";
  const MSG_ID = "01900000-0000-7000-8000-00000000m010";

  it("throws 404 when the attachment doesn't exist or the caller isn't the message sender", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [],                    // ownership lookup: no match
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await assert.rejects(
      () => service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("removes just the attachment and decrements attachment_count when other attachments/body remain", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: MSG_ID, body: "mira esto", attachment_count: 3, metadata: {} }],
    ], [
      { count: 1 }, // DELETE FROM chat_attachments
      { count: 1 }, // UPDATE chat_messages SET attachment_count = ...
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, messageDeleted: false });
    assert.equal(prisma._executeRawCallCount, 2);
  });

  it("soft-deletes the whole message when this is the last attachment and there is no body or entity refs", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: MSG_ID, body: "", attachment_count: 1, metadata: {} }],
    ], [
      { count: 1 }, // UPDATE chat_messages SET deleted_at = NOW()
      { count: 1 }, // DELETE FROM chat_attachments
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, messageDeleted: true });
  });

  it("does NOT soft-delete the whole message when it's the last attachment but body text remains", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: MSG_ID, body: "no borres esto", attachment_count: 1, metadata: {} }],
    ], [
      { count: 1 }, // DELETE FROM chat_attachments
      { count: 1 }, // UPDATE chat_messages SET attachment_count = ...
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, messageDeleted: false });
  });

  it("does NOT soft-delete the whole message when it's the last attachment but an entity ref remains", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: MSG_ID, body: null, attachment_count: 1, metadata: { entityRefs: [{ entityType: "contact", recordId: "x" }] } }],
    ], [
      { count: 1 },
      { count: 1 },
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, messageDeleted: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL with `service.deleteAttachment is not a function`.

- [ ] **Step 3: Implement `deleteAttachment`**

In `apps/api/src/routes/chat/chat-service.js`, add this function directly after `deleteMessage` (which ends around line 1032):

```javascript
  // Removes ONE attachment from a message without touching the rest of it —
  // the message and its other attachments (if any) stay intact. If this was
  // the message's only attachment and there's nothing else left to show
  // (no body text, no entity refs), the whole message is soft-deleted
  // instead, matching what deleteMessage already does for a single-
  // attachment message (spec Section 12/Goal 5).
  async function deleteAttachment({ attachmentId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT a.id, a.message_id, m.body, m.attachment_count, m.metadata
      FROM chat_attachments a
      INNER JOIN chat_messages m ON m.id = a.message_id
      WHERE a.id = ${attachmentId}
        AND m.sender_user_id = ${profileId}
        AND m.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Archivo no encontrado o sin permiso.", 404);
    const { message_id: messageId, body, attachment_count: attachmentCount, metadata } = rows[0];

    const isLastAttachment = attachmentCount <= 1;
    const hasBody = Boolean(body && body.trim());
    const hasEntityRefs = Boolean(metadata?.entityRefs?.length);

    if (isLastAttachment && !hasBody && !hasEntityRefs) {
      // This UPDATE (not just the DELETE below) is what makes the change
      // reach other open clients — the frontend's realtime sync
      // (subscribeToMessages in supabaseRealtime.js) is a postgres_changes
      // listener on chat_messages only; chat_attachments has no subscription
      // of its own. Same mechanism deleteMessage already relies on.
      await prisma.$executeRaw`
        UPDATE chat_messages SET deleted_at = NOW(), body = '' WHERE id = ${messageId}
      `;
      await prisma.$executeRaw`DELETE FROM chat_attachments WHERE id = ${attachmentId}`;
      return { ok: true, messageDeleted: true };
    }

    await prisma.$executeRaw`DELETE FROM chat_attachments WHERE id = ${attachmentId}`;
    await prisma.$executeRaw`
      UPDATE chat_messages SET attachment_count = GREATEST(attachment_count - 1, 0) WHERE id = ${messageId}
    `;
    return { ok: true, messageDeleted: false };
  }
```

Then add `deleteAttachment` to the service's returned object (find the `return { ... }` at the bottom of `createChatService` and add it alongside `deleteMessage`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS (all 5 new tests, plus the full existing suite still green).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): add deleteAttachment for removing one file from a multi-attachment message"
```

---

### Task 5: Validator + SDK + routes

**Files:**
- Modify: `packages/validators/src/chat.js`
- Modify: `packages/sdk/src/domains/chat.js`
- Modify: `apps/api/src/routes/chat/index.js`

- [ ] **Step 1: Update the Zod schema**

In `packages/validators/src/chat.js`, change:

```javascript
export const chatToggleReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});
```

to:

```javascript
export const chatToggleReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
  attachmentId: z.string().uuid().nullable().optional(),
});
```

- [ ] **Step 2: Update the reactions route to pass `attachmentId` through**

In `apps/api/src/routes/chat/index.js`, change:

```javascript
      const { emoji } = chatToggleReactionSchema.parse(body);
      const result = await reactionsService.toggleReaction({ messageId, authUserId, emoji });
```

to:

```javascript
      const { emoji, attachmentId } = chatToggleReactionSchema.parse(body);
      const result = await reactionsService.toggleReaction({ messageId, authUserId, emoji, attachmentId: attachmentId ?? null });
```

- [ ] **Step 3: Add the new route**

In `apps/api/src/routes/chat/index.js`, immediately after the `POST /chat/messages/:id/reactions` route block, add:

```javascript
  // DELETE /chat/attachments/:id
  internal.delete("/attachments/:id", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const attachmentId = c.req.param("id");
      const result = await chatService.deleteAttachment({ attachmentId, authUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error eliminando archivo.");
    }
  });
```

- [ ] **Step 4: Add the SDK methods**

In `packages/sdk/src/domains/chat.js`, change:

```javascript
    toggleReaction: (messageId, emoji, token) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ emoji }),
      }),
```

to:

```javascript
    toggleReaction: (messageId, emoji, token, { attachmentId } = {}) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ emoji, attachmentId: attachmentId ?? null }),
      }),
```

Then add, immediately after the `deleteMessage` method:

```javascript
    deleteAttachment: (attachmentId, token) =>
      request(`/chat/attachments/${encodeURIComponent(attachmentId)}`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),
```

- [ ] **Step 5: Verify syntax on every modified file**

Run:
```bash
node --check apps/api/src/routes/chat/index.js
node --check packages/validators/src/chat.js
node --check packages/sdk/src/domains/chat.js
```
Expected: no output (success) from all three.

- [ ] **Step 6: Commit**

```bash
git add packages/validators/src/chat.js packages/sdk/src/domains/chat.js apps/api/src/routes/chat/index.js
git commit -m "feat(chat): wire attachmentId through the reactions route + add deleteAttachment endpoint/SDK method"
```

---

### Task 6: Full backend verification

- [ ] **Step 1: Run the entire chat test suite**

Run: `node --test apps/api/src/routes/chat/__tests__/*.test.js`
Expected: all tests pass (existing suite + every test added in Tasks 2–4), 0 failures.

- [ ] **Step 2: Syntax-check every file touched in this plan**

Run:
```bash
node --check apps/api/src/routes/chat/chat-reactions-service.js
node --check apps/api/src/routes/chat/chat-service.js
node --check apps/api/src/routes/chat/index.js
node --check packages/validators/src/chat.js
node --check packages/sdk/src/domains/chat.js
```
Expected: no output (success) from all five.

- [ ] **Step 3: Confirm the migration applied cleanly against the real database (not just mocked tests)**

Run: `pnpm db:studio` and manually inspect `chat_message_reactions` — confirm the `attachment_id` column exists and existing rows show `NULL`. Close Studio when done (do not leave it running).

- [ ] **Step 4: Commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore(chat): backend verification pass for per-attachment actions"
```

(Skip this step entirely if nothing needed fixing — don't create an empty commit.)

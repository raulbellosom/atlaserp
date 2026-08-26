# Chat Threads Phase E — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a member reply "in thread" to a message in a `channel`/`group` conversation. Replies are excluded from the main timeline, tracked via a denormalized reply-count/last-reply-at pair on the root message, and notify only thread participants (not the whole channel).

**Architecture:** One migration (3 new columns on `chat_messages`, no new table). `sendMessage` (existing) gains an optional `threadRootId` param with auto-flatten resolution and a distinct notification path; a new `listThreadReplies` service function backs a new read endpoint; `deleteMessage` gains a counter-decrement side effect; `listMessages`/`listConversations` gain a `thread_root_id IS NULL` filter at the two call sites that need it (and nowhere else — see spec Section 24 Risk 1 for the full enumerated audit of every other `chat_messages` call site, deliberately left untouched).

**Tech Stack:** Node.js, Hono, Prisma `$queryRaw`/`$executeRaw`/`$transaction`, Zod.

**Spec:** `docs/superpowers/specs/2026-08-26-chat-threads-phase-e-design.md` — read it in full before starting, especially Section 12 (API contract), Section 14's casing pitfall note, and Section 24 (risks).

**Casing reminder (read this twice)**: the `threadRootId` REQUEST field (in `sendMessage`'s body) is camelCase. Every RESPONSE field on a `Message` object is snake_case (`thread_root_id`, `thread_reply_count`, `thread_last_reply_at`) because `getMessageFull`/`listMessages`' SQL selects top-level `chat_messages` columns unaliased — Prisma's `$queryRaw` returns the literal column name. This exact camelCase-vs-snake_case confusion caused a real, shipped bug in Phase D (`item.pinnedAt` never matched the real `pinned_at` response field — found and fixed in commit `7aea017`, immediately before this plan was written). Every code snippet below already uses the correct casing for its context — copy them as written, do not "fix" them to be consistent with each other, they are correctly inconsistent (request vs. response).

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/migrations/20260827000000_chat_threads/migration.sql` | Create | 3 new `chat_messages` columns + index |
| `apps/api/src/routes/chat/chat-service.js` | Modify | `sendMessage` (threadRootId param, auto-flatten, counter txn, notification branch), `deleteMessage` (counter decrement), `listMessages`/`listConversations` (filter), new `listThreadReplies` |
| `packages/validators/src/chat.js` | Modify | `chatSendMessageSchema` gains `threadRootId` |
| `packages/sdk/src/domains/chat.js` | Modify | New `getThread` method |
| `apps/api/src/routes/chat/index.js` | Modify | New `GET /chat/messages/:id/thread` route |
| `apps/api/src/routes/chat/__tests__/chat-service.test.js` | Modify | New test coverage |

---

### Task 1: Migration

**Files:**
- Create: `prisma/migrations/20260827000000_chat_threads/migration.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =============================================================================
-- Atlas ERP — Chat Threads (Phase E)
-- Migration: 20260827000000_chat_threads
-- =============================================================================

ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "thread_root_id" UUID,
  ADD COLUMN IF NOT EXISTS "thread_reply_count" INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "thread_last_reply_at" TIMESTAMPTZ;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_thread_root_fkey"
    FOREIGN KEY ("thread_root_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE;

CREATE INDEX "chat_messages_thread_root_id_idx"
  ON "chat_messages" ("thread_root_id", "created_at" ASC)
  WHERE "thread_root_id" IS NOT NULL;
```

- [ ] **Step 2: Apply the migration**

Run: `pnpm db:migrate`
Expected: migration `20260827000000_chat_threads` applies cleanly with no errors (self-hosted Supabase Postgres, no local DB stack per this repo's `CLAUDE.md`).

- [ ] **Step 3: Sanity query**

Run (via `pnpm db:studio` or a throwaway `psql`/`$queryRaw` check): confirm `chat_messages` now has `thread_root_id`, `thread_reply_count`, `thread_last_reply_at` columns and every existing row has `thread_root_id IS NULL, thread_reply_count = 0, thread_last_reply_at IS NULL`.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260827000000_chat_threads/migration.sql
git commit -m "feat(chat): add thread columns to chat_messages"
```

---

### Task 2: `sendMessage` — threadRootId, auto-flatten, counter transaction, notification branch

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`
- Test: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

This is the highest-risk task in this plan — it touches `sendMessage`, the most heavily-modified function in this file across every prior phase (mentions in Phase C, reactions/pin in Phase D). Read the current full body of `sendMessage` (starts at line 770) before editing.

- [ ] **Step 1: Write the failing tests first**

Add to `apps/api/src/routes/chat/__tests__/chat-service.test.js`, following the exact `buildPrismaMock`/`_resetProfileIdCacheForTests` convention already at the top of that file (do not redefine it — it's already imported/defined once per file):

```javascript
describe("chat-service — sendMessage thread replies", () => {
  it("resolves threadRootId, increments the root's counter, and skips updateConversationLastMessage", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],                                            // resolveUserProfileId
      [{ id: rootId }],                                                // assertMember (sendMessage's own)
      [{ id: rootId, conversation_id: CONV_ID, thread_root_id: null, deleted_at: null }], // thread target lookup
      [{ id: "msg-reply-1", conversation_id: CONV_ID, created_at: new Date() }], // INSERT ... RETURNING *
      [{ id: "msg-reply-1", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }], // getMessageFull
    ], [
      { count: 1 }, // UPDATE chat_messages SET thread_reply_count = thread_reply_count + 1, thread_last_reply_at = ...
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.sendMessage({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "respuesta", threadRootId: rootId,
    });
    assert.equal(result.id, "msg-reply-1");
    // updateConversationLastMessage would be an extra $executeRaw call the mock
    // doesn't have queued for — if sendMessage still called it for a thread
    // reply, this test would throw "Unexpected $executeRaw call" instead of
    // reaching the assertion above, which is exactly the coverage we want.
  });

  it("auto-flattens a reply-to-a-reply onto the original root", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const replyId = "01900000-0000-7000-8000-00000000r002";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: replyId }],
      [{ id: replyId, conversation_id: CONV_ID, thread_root_id: rootId, deleted_at: null }], // target is itself a reply
      [{ id: "msg-reply-2", conversation_id: CONV_ID, created_at: new Date() }],
      [{ id: "msg-reply-2", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }],
    ], [
      { count: 1 },
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await service.sendMessage({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "respuesta anidada", threadRootId: replyId,
    });
    // The INSERT's actual thread_root_id value is asserted via the mock's
    // fixed-sequence contract: if sendMessage inserted with replyId instead of
    // rootId, the counter-UPDATE's WHERE id = <resolved root> would target the
    // wrong row in a real DB — this test can't inspect the SQL text with this
    // mock shape, so Step 2 below also adds an integration-style assertion via
    // a spy; see that step for the actual root-id verification.
  });

  it("rejects a threadRootId belonging to a different conversation with 404", async () => {
    const foreignRootId = "01900000-0000-7000-8000-00000000f001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: foreignRootId }],
      [{ id: foreignRootId, conversation_id: "some-other-conv", thread_root_id: null, deleted_at: null }],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await assert.rejects(
      () => service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "x", threadRootId: foreignRootId }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("rejects replying to a soft-deleted message with 404", async () => {
    const deletedId = "01900000-0000-7000-8000-00000000d001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: deletedId }],
      [], // deleted_at IS NULL filter excludes it — lookup returns no rows
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await assert.rejects(
      () => service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "x", threadRootId: deletedId }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });
});
```

- [ ] **Step 2: Add a root-id-verification test using a spy-capable mock**

`buildPrismaMock`'s fixed-sequence-array shape can't assert on the SQL a given call actually contained. Add one more test using a lightweight inline spy instead of the shared helper, to directly prove the counter-UPDATE targets the flattened root, not the immediate reply target:

```javascript
it("counter-UPDATE targets the flattened root id, not the immediate reply target (spy-based)", async () => {
  const rootId = "01900000-0000-7000-8000-00000000r001";
  const replyId = "01900000-0000-7000-8000-00000000r002";
  const executeRawCalls = [];
  let qIdx = 0;
  const queryRawResults = [
    [{ id: PROFILE_ID }],
    [{ id: replyId }],
    [{ id: replyId, conversation_id: CONV_ID, thread_root_id: rootId, deleted_at: null }],
    [{ id: "msg-reply-3", conversation_id: CONV_ID, created_at: new Date() }],
    [{ id: "msg-reply-3", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }],
  ];
  const prisma = {
    $queryRaw: async (strings, ...values) => {
      executeRawCalls.push({ kind: "query", values });
      return queryRawResults[qIdx++];
    },
    $executeRaw: async (strings, ...values) => {
      executeRawCalls.push({ kind: "execute", values });
      return { count: 1 };
    },
    $transaction: async (fn) => fn(prisma),
    membership: { findFirst: async () => null },
  };
  const service = createChatService({ prisma, supabaseAdmin: {} });
  await service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "x", threadRootId: replyId });
  const executeCall = executeRawCalls.find((c) => c.kind === "execute");
  assert.ok(executeCall, "expected a counter-update $executeRaw call");
  assert.ok(executeCall.values.includes(rootId), "counter update must target the original root id, not the immediate reply id");
  assert.ok(!executeCall.values.includes(replyId), "counter update must NOT target the immediate reply id");
});
```

**Note for whoever runs this step**: Prisma's tagged-template `$queryRaw`/`$executeRaw` pass `(strings, ...values)` where `values` are the interpolated template values in order — confirm this matches how `chat-service.js` actually invokes them (look at any existing call, e.g. `assertMember`) before trusting the `values.includes(rootId)` assertion above; if Prisma's actual client shape differs (e.g. wraps values in a `Prisma.Sql` object instead of passing them as trailing args to the tag function), adjust the spy to unwrap whatever shape is real — don't guess, read `node_modules/@prisma/client`'s raw-query typings or just log the actual call args once locally to confirm before finalizing this test.

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL — `sendMessage` doesn't accept `threadRootId` yet, extra mocked calls are unconsumed / `getMessageFull`'s later stages error.

- [ ] **Step 4: Implement — extend `sendMessage`'s signature and add resolution + counter logic**

Read the current `sendMessage` function (starts around line 770) in full first. Modify its signature and add resolution logic right after `assertMember`, before the mention-resolution block:

```javascript
  async function sendMessage({ conversationId, authUserId, body, messageType = "text", metadata = {}, attachmentIds = [], threadRootId = null }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    // Resolve threadRootId: validate it exists, belongs to this conversation,
    // isn't soft-deleted, and auto-flatten a reply-to-a-reply onto its own
    // root (spec Non-goal 1 — threads are one level deep, replying to a
    // reply silently redirects to that reply's own root instead of erroring
    // or creating a nested thread).
    let resolvedThreadRootId = null;
    if (threadRootId) {
      const targetRows = await prisma.$queryRaw`
        SELECT id, conversation_id, thread_root_id, deleted_at
        FROM chat_messages
        WHERE id = ${threadRootId} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!targetRows.length || targetRows[0].conversation_id !== conversationId) {
        throw new ChatServiceError("Mensaje no encontrado.", 404);
      }
      resolvedThreadRootId = targetRows[0].thread_root_id ?? targetRows[0].id;
    }
```

(Note: `targetRows[0].conversation_id !== conversationId` — both sides are UUID values returned/passed as strings by this module's existing convention throughout `chat-service.js`; confirm this comparison actually works against the real Prisma raw-query return type during Step 5's manual/integration check, not just the mocked unit tests, since a UUID column could theoretically come back as a non-string wrapper type depending on the Postgres driver config — if it does, use `String(targetRows[0].conversation_id) !== String(conversationId)` instead.)

- [ ] **Step 5: Wrap the insert + counter update in a transaction**

Replace the existing plain `INSERT` (currently a bare `prisma.$queryRaw` outside any transaction) with a transaction when `resolvedThreadRootId` is set — but keep the existing non-threaded path exactly as it already is (no transaction needed there, unchanged behavior/risk profile):

```javascript
    let msg;
    if (resolvedThreadRootId) {
      [msg] = await prisma.$transaction(async (tx) => {
        const inserted = await tx.$queryRaw`
          INSERT INTO chat_messages (conversation_id, sender_user_id, sender_type, body, message_type, attachment_count, metadata, thread_root_id)
          VALUES (
            ${conversationId}, ${profileId}, 'user', ${body}, ${messageType}, ${attachmentIds.length},
            ${JSON.stringify(finalMetadata)}::jsonb, ${resolvedThreadRootId}
          )
          RETURNING *
        `;
        await tx.$executeRaw`
          UPDATE chat_messages
          SET thread_reply_count = thread_reply_count + 1,
              thread_last_reply_at = ${inserted[0].created_at}
          WHERE id = ${resolvedThreadRootId}
        `;
        return inserted;
      });
    } else {
      const msgRows = await prisma.$queryRaw`
        INSERT INTO chat_messages (conversation_id, sender_user_id, sender_type, body, message_type, attachment_count, metadata)
        VALUES (
          ${conversationId}, ${profileId}, 'user', ${body}, ${messageType}, ${attachmentIds.length},
          ${JSON.stringify(finalMetadata)}::jsonb
        )
        RETURNING *
      `;
      msg = msgRows[0];
    }
```

This replaces the existing `const msgRows = await prisma.$queryRaw\`INSERT...\`; const msg = msgRows[0];` block — read the surrounding code first so the mention-resolution block above it (unchanged) and the `if (attachmentIds.length) { ... }` block below it (unchanged, still references `msg.id`) stay correctly wired to this new `msg` variable.

- [ ] **Step 5b: Add `threadRootId` to the realtime broadcast payload**

Find the `if (broadcaster) { ... broadcaster.broadcastToUsers(memberIds, "chat.message.new", { ... }) ... }` block near the end of `sendMessage` (around line 891) and add one field to the payload:

```javascript
    if (broadcaster) {
      const memberIds = await getConversationMemberIds(conversationId).catch(() => []);
      broadcaster.broadcastToUsers(memberIds, "chat.message.new", {
        conversationId,
        messageId: msg.id,
        senderId: profileId.toString(),
        senderName: fullMsg?.sender?.displayName ?? null,
        threadRootId: resolvedThreadRootId,
      }).catch(() => {});
    }
```

This is required for Plan B's `ThreadPanel` to know when to invalidate its own query cache in real time — Plan B's frontend realtime listener checks this field to distinguish "a new top-level message arrived" from "a reply arrived in thread X." `resolvedThreadRootId` is `null` for a normal top-level send, matching the existing implicit contract every other consumer of this broadcast already relies on (no consumer currently reads a `threadRootId` field, so adding it with a `null` default for non-thread sends is purely additive — confirm no other file destructures this broadcast payload in a way that would break on an extra key, e.g. `grep -rn "chat.message.new" apps/desktop/src` before finalizing this step, though object spread/destructuring in JS is tolerant of extra keys by default so this is a low-risk check, not an expected blocker).

- [ ] **Step 6: Skip `updateConversationLastMessage` for thread replies**

Find `await updateConversationLastMessage(conversationId, msg.id, msg.created_at);` (currently unconditional) and gate it:

```javascript
    if (!resolvedThreadRootId) {
      await updateConversationLastMessage(conversationId, msg.id, msg.created_at);
    }
```

- [ ] **Step 7: Branch the notification logic**

Find the `if (notificationService) { setImmediate(async () => { ... }) }` block. Inside it, after `const recipientIds = otherMembers...` is computed (unchanged, still needed for the non-thread path) but before the `if (recipientIds.length) { ...chat.message.new... }` publish call, branch on `resolvedThreadRootId`:

```javascript
          if (resolvedThreadRootId) {
            const participantRows = await prisma.$queryRaw`
              SELECT DISTINCT sender_user_id FROM chat_messages
              WHERE (id = ${resolvedThreadRootId} OR thread_root_id = ${resolvedThreadRootId})
                AND sender_user_id IS NOT NULL
                AND sender_user_id != ${profileId}
            `;
            const mentionedSet2 = new Set(mentionResult.notifyUserIds);
            const threadRecipientIds = participantRows
              .map((r) => r.sender_user_id.toString())
              .filter((id) => !mentionedSet2.has(id));
            if (threadRecipientIds.length) {
              await notificationService.publish({
                companyId,
                actorId: profileId,
                input: {
                  eventType: "chat.thread.reply",
                  title: "Nueva respuesta en un hilo",
                  body: preview,
                  link: `/app/m/atlas.chat/chat/inbox`,
                  recipients: { userIds: threadRecipientIds },
                  channels: ["in_app", "web_push"],
                  priority: "medium",
                  sourceType: "chat_conversation",
                  sourceId: conversationId,
                  dedupeKey: `chat.thread.reply:${msg.id}`,
                },
              });
            }
          } else if (recipientIds.length) {
            await notificationService.publish({
              eventType: "chat.message.new",
              // ...unchanged, existing block — just now inside this else branch
            });
          }
```

Read the actual current code around this block carefully (it's roughly lines 850-867) — the existing `if (recipientIds.length) { ... chat.message.new ... }` block must become the `else if` branch verbatim (don't retype it from this snippet, move the real existing block), and the pre-existing `if (mentionResult.notifyUserIds.length) { ...chat.mention.new... }` block immediately after stays completely unchanged and unconditional (mentions fire the same way regardless of whether the message is a thread reply — spec Section 12's notification contract paragraph is explicit about this: mentions are "on top of, not instead of" the thread-reply logic).

- [ ] **Step 8: Include the 3 new fields in `getMessageFull`/`listMessages`' SELECT lists**

In both functions (search for `m.pinned_at,\n        m.pinned_by_user_id,` — it appears in both `getMessageFull` around line 606 and `listMessages` around line 679), add immediately after:

```javascript
        m.thread_root_id,
        m.thread_reply_count,
        m.thread_last_reply_at,
```

- [ ] **Step 9: Filter thread replies out of the two call sites identified in spec Section 24 Risk 1**

In `listMessages`'s WHERE clause (around line 713), add the filter:

```sql
      WHERE m.conversation_id = ${conversationId}
        AND m.thread_root_id IS NULL
        ${before ? Prisma.sql`AND m.created_at < ${new Date(before)}` : Prisma.empty}
```

In `listConversations`' `unread_count` subquery (around line 201-211) and `last_message` subquery (around line 213-226), add `AND m.thread_root_id IS NULL` to each subquery's WHERE clause (both currently filter on `m.conversation_id = c.id AND m.deleted_at IS NULL` — add the new condition alongside those, same pattern).

Do NOT add this filter anywhere else — re-read spec Section 24 Risk 1's full enumeration (`getMessageFull`, `editMessage`, `deleteMessage`, `pinMessage`, `listPinnedMessages`, `listExternalInbox` all explicitly do NOT need it) before touching any other query in this file.

- [ ] **Step 10: Run tests, iterate until green**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: all new tests PASS, all pre-existing tests in this file still PASS (65 pre-existing, per this session's last full run).

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): sendMessage supports thread replies with auto-flatten and scoped notifications"
```

---

### Task 3: `deleteMessage` counter decrement + `listThreadReplies`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`
- Test: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
describe("chat-service — deleteMessage decrements thread counter", () => {
  it("decrements the root's thread_reply_count when a reply is deleted", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const replyId = "01900000-0000-7000-8000-00000000r003";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: replyId, thread_root_id: rootId }], // ownership lookup, now also selects thread_root_id
    ], [
      { count: 1 }, // UPDATE ... SET deleted_at = NOW()
      { count: 1 }, // UPDATE chat_messages SET thread_reply_count = thread_reply_count - 1 WHERE id = rootId
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await service.deleteMessage({ messageId: replyId, authUserId: AUTH_USER_ID });
    assert.equal(prisma._executeRawCallCount ?? 2, 2); // sanity: both UPDATEs actually ran (buildPrismaMock doesn't track this by name — see Step 3 note)
  });

  it("does not touch any counter when deleting a top-level (non-reply) message", async () => {
    const msgId = "01900000-0000-7000-8000-00000000m001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: msgId, thread_root_id: null }],
    ], [
      { count: 1 }, // only the deleted_at UPDATE — a second unexpected $executeRaw call would return undefined from buildPrismaMock's array and the test would need to assert THAT didn't blow up; simplest proof is just that this resolves without throwing
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await service.deleteMessage({ messageId: msgId, authUserId: AUTH_USER_ID });
  });
});

describe("chat-service — listThreadReplies", () => {
  it("returns the root and its replies in chronological order", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],                             // resolveUserProfileId
      [{ id: rootId, conversation_id: CONV_ID, thread_root_id: null }], // root lookup
      [{ id: PROFILE_ID }],                              // assertMember
      [{ id: rootId, conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }], // getMessageFull(root)
      [{ id: "reply-a" }, { id: "reply-b" }],             // reply id list, ORDER BY created_at ASC
      [{ id: "reply-a", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }], // getMessageFull(reply-a)
      [{ id: "reply-b", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }], // getMessageFull(reply-b)
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.listThreadReplies({ messageId: rootId, authUserId: AUTH_USER_ID });
    assert.equal(result.root.id, rootId);
    assert.deepEqual(result.replies.map((r) => r.id), ["reply-a", "reply-b"]);
  });

  it("auto-flattens: reading a reply's own id resolves to its root's thread", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const replyId = "01900000-0000-7000-8000-00000000r002";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: replyId, conversation_id: CONV_ID, thread_root_id: rootId }], // lookup on the reply id resolves thread_root_id
      [{ id: PROFILE_ID }],
      [{ id: rootId, conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }],
      [],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.listThreadReplies({ messageId: replyId, authUserId: AUTH_USER_ID });
    assert.equal(result.root.id, rootId);
  });

  it("throws 404 for a nonexistent message id", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await assert.rejects(
      () => service.listThreadReplies({ messageId: "does-not-exist", authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });
});
```

**Note**: the first test's `assert.equal(prisma._executeRawCallCount ?? 2, 2)` line is deliberately a soft/no-op-shaped assertion because `buildPrismaMock` (as it exists today in this file) doesn't track a named call count for `$executeRaw` the way it does for `$transaction` (`_transactionCallCount`). Before relying on that exact assertion, either (a) extend the shared `buildPrismaMock` in this test file to also increment a `_executeRawCallCount`, matching the existing `_transactionCallCount` convention (preferred — small, reusable, matches this file's own established pattern), or (b) replace that assertion with a simpler proof, e.g. asserting the function resolves without the mock throwing "Unexpected $executeRaw call" (which it would if `deleteMessage` tried to run a THIRD `$executeRaw` beyond the two queued). Pick (a) if it's a two-line change; don't leave a no-op assertion in the committed test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL — `listThreadReplies` doesn't exist yet, `deleteMessage` doesn't decrement anything yet.

- [ ] **Step 3: Implement — `deleteMessage` counter decrement**

Read the current `deleteMessage` function (around line 926) in full. Its existing ownership-check SELECT only selects `id` — extend it to also select `thread_root_id`, and add the decrement after the existing soft-delete UPDATE:

```javascript
  async function deleteMessage({ messageId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT id, thread_root_id FROM chat_messages
      WHERE id = ${messageId}
        AND sender_user_id = ${profileId}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Mensaje no encontrado o sin permiso.", 403);

    await prisma.$executeRaw`
      UPDATE chat_messages SET deleted_at = NOW(), body = '' WHERE id = ${messageId}
    `;

    if (rows[0].thread_root_id) {
      await prisma.$executeRaw`
        UPDATE chat_messages
        SET thread_reply_count = GREATEST(thread_reply_count - 1, 0)
        WHERE id = ${rows[0].thread_root_id}
      `;
    }

    return { ok: true };
  }
```

(`GREATEST(..., 0)` guards against the counter ever going negative under a hypothetical double-delete race — cheap insurance, matches the defensive style already used elsewhere in this file, e.g. `isLastOwner` guards in `chat-permissions-service.js`.)

- [ ] **Step 4: Implement — `listThreadReplies`**

Add as a new function, placed near `listPinnedMessages` (both are "list messages related to one message/conversation" reads, keep them adjacent for discoverability):

```javascript
  async function listThreadReplies({ messageId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);

    const targetRows = await prisma.$queryRaw`
      SELECT id, conversation_id, thread_root_id FROM chat_messages WHERE id = ${messageId} LIMIT 1
    `;
    if (!targetRows.length) throw new ChatServiceError("Mensaje no encontrado.", 404);
    const rootId = targetRows[0].thread_root_id ?? targetRows[0].id;
    const conversationId = targetRows[0].conversation_id;

    await assertMember(conversationId, profileId);

    const root = await getMessageFull(rootId);
    const replyRows = await prisma.$queryRaw`
      SELECT id FROM chat_messages
      WHERE thread_root_id = ${rootId}
      ORDER BY created_at ASC
    `;
    const replies = await Promise.all(replyRows.map((r) => getMessageFull(r.id)));

    return { root, replies: replies.filter(Boolean) };
  }
```

(The `Promise.all(rows.map((r) => getMessageFull(r.id)))` N+1 pattern here mirrors `listPinnedMessages`' already-shipped, already-reviewed, explicitly-accepted approach from Phase D — same justification: expected reply/pin volumes per thread are small, and this keeps the code consistent with an established, deliberate precedent rather than introducing a second, different aggregation strategy for a structurally identical problem.)

Add `listThreadReplies` to the function's final `return { ... }` object (alongside `listPinnedMessages`).

- [ ] **Step 5: Run tests, iterate until green**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): decrement thread counter on reply delete, add listThreadReplies"
```

---

### Task 4: Validator, SDK, route

**Files:**
- Modify: `packages/validators/src/chat.js`
- Modify: `packages/sdk/src/domains/chat.js`
- Modify: `apps/api/src/routes/chat/index.js`

- [ ] **Step 1: Extend the validator**

In `packages/validators/src/chat.js`, modify `chatSendMessageSchema`:

```javascript
export const chatSendMessageSchema = z.object({
  body: z.string().max(10000).nullish().transform(v => v ?? ""),
  messageType: z.enum(["text", "image", "file", "system"]).default("text"),
  metadata: z.record(z.unknown()).optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
  threadRootId: z.string().uuid().optional(),
});
```

- [ ] **Step 2: Add the SDK method**

In `packages/sdk/src/domains/chat.js`, add near `listPinnedMessages`/`toggleReaction` (same "Messages (internal)" section):

```javascript
    getThread: (messageId, token) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}/thread`, {
        headers: withAuthHeaders(token),
      }),
```

- [ ] **Step 3: Add the route**

In `apps/api/src/routes/chat/index.js`, add near the `GET /chat/conversations/:id/pinned-messages` route (same file section, both are message-set reads):

```javascript
  // GET /chat/messages/:id/thread
  internal.get("/messages/:id/thread", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const messageId = c.req.param("id");
      const result = await chatService.listThreadReplies({ messageId, authUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error listando el hilo.");
    }
  });
```

- [ ] **Step 4: Build check**

Run: `pnpm build` (full build, not just `vite build` — this task touches `packages/validators` and `packages/sdk`, which the frontend build depends on but so does the API; a full `pnpm build` catches issues in both, matching the verification bar this repo's `CLAUDE.md` sets for cross-package changes).

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/chat.js packages/sdk/src/domains/chat.js apps/api/src/routes/chat/index.js
git commit -m "feat(chat): add threadRootId to sendMessage validator, getThread SDK method and route"
```

---

## Self-Review Notes

- **Spec coverage**: Task 1 covers Section 10/11. Task 2 covers Section 12's `sendMessage` extension, auto-flatten (Section 23-3), cross-conversation rejection (Section 19), notification contract (Section 12's dedicated paragraph), and the two Section 24 Risk 1 filter sites. Task 3 covers Section 23-4 (counter decrement) and the `GET /chat/messages/:id/thread` read side of Section 12. Task 4 covers Section 13/14's SDK/validator/route contract.
- **Casing discipline**: every snippet above was written with the real request-vs-response casing split from spec Section 14 already applied — flagged explicitly at the top of this plan so it survives being read out of order.
- **No placeholders** except two explicitly-flagged "verify against the real Prisma client shape before trusting this" notes (Task 2 Step 2's spy assertion, Task 2 Step 4's UUID-comparison note) and one explicitly-flagged "extend buildPrismaisMock or replace this assertion" note (Task 3 Step 1) — all three are deliberate "confirm against real code" directives, not gaps in this plan's own logic, matching the precedent set by Phase D's Task 1 Step 2 ("verify the real query key") and Task 4 Step 3 ("check for an existing jump-to-message mechanism").

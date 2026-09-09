# Chat Pending Attachments — Plan A (API + Worker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `DELETE /chat/attachments/:id` able to discard an un-sent ("pending", `message_id IS NULL`) upload and always delete the underlying storage object, and add a worker tick that sweeps abandoned pending attachments.

**Architecture:** `chat-attachments-service.js#deleteAttachment` is rewritten to fetch the attachment row without joining `chat_messages`, then branch on `message_id`: pending rows are authorized by uploader id and hard-deleted (row + object); sent rows keep the existing message-context logic and gain an unconditional `storage.remove`. A new stateless job module `orphan-attachment-sweep-job.js` bulk-deletes pending rows older than 120 minutes; `apps/worker/src/index.js` runs it every 30 minutes with the same guard pattern as the other ticks.

**Tech Stack:** Node.js, Hono, Prisma 7 `$queryRaw`/`$executeRaw` tagged templates, Supabase Storage admin client, Node built-in test runner (`node --test`).

Reference spec: `docs/superpowers/specs/2026-09-09-chat-pending-attachments-design.md`

---

### Task 1: Rewrite `deleteAttachment` — fetch row without message join, branch on pending vs sent, always remove the storage object

**Files:**
- Modify: `apps/api/src/routes/chat/chat-attachments-service.js:114-151` (the `deleteAttachment` function)
- Test: `apps/api/src/routes/chat/__tests__/chat-service.test.js:1881-1949` (the `describe("chat-service — deleteAttachment")` block)

- [ ] **Step 1: Replace the existing deleteAttachment tests with the new branch coverage**

In `apps/api/src/routes/chat/__tests__/chat-service.test.js`, replace the whole `describe("chat-service — deleteAttachment", () => { ... })` block (currently lines 1881-1949) with:

```javascript
describe("chat-service — deleteAttachment", () => {
  const ATT_ID = "01900000-0000-7000-8000-00000000a010";
  const MSG_ID = "01900000-0000-7000-8000-00000000m010";

  // A supabaseAdmin stub whose storage.from(bucket).remove(keys) records calls.
  function buildStorageStub() {
    const removed = [];
    return {
      removed,
      storage: {
        from(bucket) {
          return {
            async remove(keys) {
              removed.push({ bucket, keys });
              return { data: keys.map((k) => ({ name: k })), error: null };
            },
          };
        },
      },
    };
  }

  it("throws 404 when the attachment row doesn't exist", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [],                    // attachment row lookup: no match
    ]);
    const service = createChatService({ prisma, supabaseAdmin: buildStorageStub() });
    await assert.rejects(
      () => service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("pending: uploader deletes the row and the storage object", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: null, bucket: "atlas-chat", object_key: "conversations/c/x.jpg", uploaded_by_user_id: PROFILE_ID }],
    ], [
      { count: 1 }, // DELETE FROM chat_attachments
    ]);
    const supabaseAdmin = buildStorageStub();
    const service = createChatService({ prisma, supabaseAdmin });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, pending: true });
    assert.deepEqual(supabaseAdmin.removed, [{ bucket: "atlas-chat", keys: ["conversations/c/x.jpg"] }]);
    assert.equal(prisma._executeRawCallCount, 1);
  });

  it("pending: a non-uploader gets 404 and nothing is deleted", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: null, bucket: "atlas-chat", object_key: "conversations/c/x.jpg", uploaded_by_user_id: OTHER_PROFILE_ID }],
    ]);
    const supabaseAdmin = buildStorageStub();
    const service = createChatService({ prisma, supabaseAdmin });
    await assert.rejects(
      () => service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
    assert.deepEqual(supabaseAdmin.removed, []);
    assert.equal(prisma._executeRawCallCount, 0);
  });

  it("sent: throws 404 when the caller isn't the message sender", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: MSG_ID, bucket: "atlas-chat", object_key: "k", uploaded_by_user_id: PROFILE_ID }],
      [], // message-context lookup: no row (not the sender / deleted)
    ]);
    const service = createChatService({ prisma, supabaseAdmin: buildStorageStub() });
    await assert.rejects(
      () => service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("sent: removes just the attachment, decrements attachment_count, deletes the object", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: MSG_ID, bucket: "atlas-chat", object_key: "k1", uploaded_by_user_id: PROFILE_ID }],
      [{ body: "mira esto", attachment_count: 3, metadata: {} }],
    ], [
      { count: 1 }, // DELETE FROM chat_attachments
      { count: 1 }, // UPDATE chat_messages SET attachment_count = ...
    ]);
    const supabaseAdmin = buildStorageStub();
    const service = createChatService({ prisma, supabaseAdmin });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, messageDeleted: false });
    assert.deepEqual(supabaseAdmin.removed, [{ bucket: "atlas-chat", keys: ["k1"] }]);
    assert.equal(prisma._executeRawCallCount, 2);
  });

  it("sent: soft-deletes the message when it's the last attachment with no body or entity refs, deletes the object", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: MSG_ID, bucket: "atlas-chat", object_key: "k2", uploaded_by_user_id: PROFILE_ID }],
      [{ body: "", attachment_count: 1, metadata: {} }],
    ], [
      { count: 1 }, // UPDATE chat_messages SET deleted_at = NOW()
      { count: 1 }, // DELETE FROM chat_attachments
    ]);
    const supabaseAdmin = buildStorageStub();
    const service = createChatService({ prisma, supabaseAdmin });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, messageDeleted: true });
    assert.deepEqual(supabaseAdmin.removed, [{ bucket: "atlas-chat", keys: ["k2"] }]);
  });

  it("sent: keeps the message when the last attachment leaves body text behind", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: MSG_ID, bucket: "atlas-chat", object_key: "k3", uploaded_by_user_id: PROFILE_ID }],
      [{ body: "no borres esto", attachment_count: 1, metadata: {} }],
    ], [
      { count: 1 },
      { count: 1 },
    ]);
    const service = createChatService({ prisma, supabaseAdmin: buildStorageStub() });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, messageDeleted: false });
  });

  it("sent: keeps the message when the last attachment leaves an entity ref behind", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: MSG_ID, bucket: "atlas-chat", object_key: "k4", uploaded_by_user_id: PROFILE_ID }],
      [{ body: null, attachment_count: 1, metadata: { entityRefs: [{ entityType: "contact", recordId: "x" }] } }],
    ], [
      { count: 1 },
      { count: 1 },
    ]);
    const service = createChatService({ prisma, supabaseAdmin: buildStorageStub() });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, messageDeleted: false });
  });

  it("swallows a storage-removal error and still deletes the row", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: ATT_ID, message_id: null, bucket: "atlas-chat", object_key: "boom", uploaded_by_user_id: PROFILE_ID }],
    ], [
      { count: 1 },
    ]);
    const supabaseAdmin = {
      storage: { from: () => ({ remove: async () => ({ data: null, error: new Error("network") }) }) },
    };
    const service = createChatService({ prisma, supabaseAdmin });
    const result = await service.deleteAttachment({ attachmentId: ATT_ID, authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { ok: true, pending: true });
    assert.equal(prisma._executeRawCallCount, 1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL in the `deleteAttachment` describe — the current implementation queues a single `INNER JOIN chat_messages` query and never touches `supabaseAdmin.storage`, so `pending: true`, the `removed` assertions, and the `_executeRawCallCount` expectations all fail.

- [ ] **Step 3: Rewrite `deleteAttachment` in the service**

In `apps/api/src/routes/chat/chat-attachments-service.js`, replace the entire `deleteAttachment` function (lines 114-151) with:

```javascript
  async function removeStorageObject(bucket, objectKey) {
    try {
      const { error } = await supabaseAdmin.storage.from(bucket).remove([objectKey]);
      if (error) {
        console.error("[atlas.chat] deleteAttachment: storage remove failed", { bucket, objectKey, error: error.message });
      }
    } catch (err) {
      console.error("[atlas.chat] deleteAttachment: storage remove threw", { bucket, objectKey, error: err?.message ?? err });
    }
  }

  async function deleteAttachment({ attachmentId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);

    // Fetch the attachment WITHOUT joining chat_messages: a pending upload
    // (message_id NULL, never linked to a sent message) has no message to join.
    const attRows = await prisma.$queryRaw`
      SELECT id, message_id, bucket, object_key, uploaded_by_user_id
      FROM chat_attachments
      WHERE id = ${attachmentId}
      LIMIT 1
    `;
    if (!attRows.length) throw new ChatServiceError("Archivo no encontrado o sin permiso.", 404);
    const att = attRows[0];

    // ── Pending upload: the uploader can always discard their own un-sent file.
    if (att.message_id == null) {
      if (att.uploaded_by_user_id !== profileId) {
        throw new ChatServiceError("Archivo no encontrado o sin permiso.", 404);
      }
      await removeStorageObject(att.bucket, att.object_key);
      await prisma.$executeRaw`DELETE FROM chat_attachments WHERE id = ${attachmentId}`;
      return { ok: true, pending: true };
    }

    // ── Sent attachment: same message-context rules as before.
    const rows = await prisma.$queryRaw`
      SELECT m.body, m.attachment_count, m.metadata
      FROM chat_messages m
      WHERE m.id = ${att.message_id}
        AND m.sender_user_id = ${profileId}
        AND m.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Archivo no encontrado o sin permiso.", 404);
    const { body, attachment_count: attachmentCount, metadata } = rows[0];

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
        UPDATE chat_messages SET deleted_at = NOW(), body = '' WHERE id = ${att.message_id}
      `;
      await prisma.$executeRaw`DELETE FROM chat_attachments WHERE id = ${attachmentId}`;
      await removeStorageObject(att.bucket, att.object_key);
      return { ok: true, messageDeleted: true };
    }

    await prisma.$executeRaw`DELETE FROM chat_attachments WHERE id = ${attachmentId}`;
    await prisma.$executeRaw`
      UPDATE chat_messages SET attachment_count = GREATEST(attachment_count - 1, 0) WHERE id = ${att.message_id}
    `;
    await removeStorageObject(att.bucket, att.object_key);
    return { ok: true, messageDeleted: false };
  }
```

Note: `removeStorageObject` is a new inner helper — declare it inside `createChatAttachmentsService({ ... })` (function scope, same as `deleteAttachment`) so it can see `supabaseAdmin`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS — all `deleteAttachment` cases green, no regressions elsewhere in the file.

- [ ] **Step 5: Syntax-check the modified service file**

Run: `node --check apps/api/src/routes/chat/chat-attachments-service.js`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/chat-attachments-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "fix(chat): deleteAttachment discards pending uploads and always removes the storage object"
```

---

### Task 2: New `sweepOrphanChatAttachments` job module

**Files:**
- Create: `apps/api/src/routes/chat/orphan-attachment-sweep-job.js`
- Test: `apps/api/src/routes/chat/__tests__/orphan-attachment-sweep-job.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/chat/__tests__/orphan-attachment-sweep-job.test.js`:

```javascript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sweepOrphanChatAttachments } from "../orphan-attachment-sweep-job.js";

function buildPrisma(queryRows) {
  const calls = { query: [], execute: [] };
  return {
    calls,
    $queryRaw: async (strings, ...values) => {
      calls.query.push({ sql: strings.join("?"), values });
      return queryRows;
    },
    $executeRaw: async (strings, ...values) => {
      calls.execute.push({ sql: strings.join("?"), values });
      return queryRows.length;
    },
  };
}

function buildStorage() {
  const removed = [];
  return {
    removed,
    storage: {
      from(bucket) {
        return {
          async remove(keys) {
            removed.push({ bucket, keys });
            return { data: [], error: null };
          },
        };
      },
    },
  };
}

describe("sweepOrphanChatAttachments", () => {
  it("no-ops with no orphan rows", async () => {
    const prisma = buildPrisma([]);
    const supabaseAdmin = buildStorage();
    const result = await sweepOrphanChatAttachments({ prisma, supabaseAdmin });
    assert.deepEqual(result, { swept: 0 });
    assert.equal(prisma.calls.execute.length, 0);
    assert.deepEqual(supabaseAdmin.removed, []);
  });

  it("only selects message_id IS NULL rows past the age threshold", async () => {
    const prisma = buildPrisma([
      { id: "a1", bucket: "atlas-chat", object_key: "k1" },
    ]);
    const supabaseAdmin = buildStorage();
    await sweepOrphanChatAttachments({ prisma, supabaseAdmin, olderThanMinutes: 120 });
    const sql = prisma.calls.query[0].sql;
    assert.match(sql, /message_id IS NULL/i);
    assert.match(sql, /created_at </i);
    assert.deepEqual(prisma.calls.query[0].values, [120, 200]); // olderThanMinutes, limit
  });

  it("groups keys by bucket, removes them, then bulk-deletes the rows", async () => {
    const prisma = buildPrisma([
      { id: "a1", bucket: "atlas-chat", object_key: "k1" },
      { id: "a2", bucket: "atlas-chat", object_key: "k2" },
    ]);
    const supabaseAdmin = buildStorage();
    const result = await sweepOrphanChatAttachments({ prisma, supabaseAdmin });
    assert.deepEqual(supabaseAdmin.removed, [{ bucket: "atlas-chat", keys: ["k1", "k2"] }]);
    assert.equal(prisma.calls.execute.length, 1);
    assert.match(prisma.calls.execute[0].sql, /DELETE FROM chat_attachments WHERE id = ANY/i);
    assert.deepEqual(prisma.calls.execute[0].values, [["a1", "a2"]]);
    assert.deepEqual(result, { swept: 2 });
  });

  it("still deletes the rows when a bucket removal errors", async () => {
    const prisma = buildPrisma([{ id: "a1", bucket: "atlas-chat", object_key: "k1" }]);
    const supabaseAdmin = {
      storage: { from: () => ({ remove: async () => ({ data: null, error: new Error("nope") }) }) },
    };
    const result = await sweepOrphanChatAttachments({ prisma, supabaseAdmin });
    assert.deepEqual(result, { swept: 1 });
    assert.equal(prisma.calls.execute.length, 1);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test apps/api/src/routes/chat/__tests__/orphan-attachment-sweep-job.test.js`
Expected: FAIL — `Cannot find module '../orphan-attachment-sweep-job.js'`.

- [ ] **Step 3: Implement the job module**

Create `apps/api/src/routes/chat/orphan-attachment-sweep-job.js`:

```javascript
// apps/api/src/routes/chat/orphan-attachment-sweep-job.js
//
// Deletes abandoned "pending" chat attachments: rows written by
// presignAttachmentUpload (message_id NULL) that never got linked to a sent
// message. The composer deletes its own removed/unsent uploads via
// DELETE /chat/attachments/:id, but a closed tab, a crash, or an offline
// client leaves the row + storage object behind. This sweep is the safety net.
//
// Threshold: the presigned upload URL expires in 300s, so anything with a NULL
// message_id older than a couple hours is certainly abandoned. Never touch a
// compose still in progress (long voice note, slow upload, user stepped away).

export async function sweepOrphanChatAttachments({
  prisma,
  supabaseAdmin,
  olderThanMinutes = 120,
  limit = 200,
}) {
  const rows = await prisma.$queryRaw`
    SELECT id, bucket, object_key
    FROM chat_attachments
    WHERE message_id IS NULL
      AND created_at < NOW() - (${olderThanMinutes} * INTERVAL '1 minute')
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return { swept: 0 };

  const byBucket = new Map();
  for (const row of rows) {
    if (!byBucket.has(row.bucket)) byBucket.set(row.bucket, []);
    byBucket.get(row.bucket).push(row.object_key);
  }
  for (const [bucket, keys] of byBucket) {
    try {
      const { error } = await supabaseAdmin.storage.from(bucket).remove(keys);
      if (error) {
        console.error("[chat.orphan-sweep] storage remove failed", { bucket, count: keys.length, error: error.message });
      }
    } catch (err) {
      console.error("[chat.orphan-sweep] storage remove threw", { bucket, error: err?.message ?? err });
    }
  }

  const ids = rows.map((row) => row.id);
  const deleted = await prisma.$executeRaw`
    DELETE FROM chat_attachments WHERE id = ANY(${ids}::uuid[])
  `;
  return { swept: Number(deleted) || ids.length };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/orphan-attachment-sweep-job.test.js`
Expected: PASS — all four cases green.

- [ ] **Step 5: Syntax-check**

Run: `node --check apps/api/src/routes/chat/orphan-attachment-sweep-job.js`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/orphan-attachment-sweep-job.js apps/api/src/routes/chat/__tests__/orphan-attachment-sweep-job.test.js
git commit -m "feat(chat): sweepOrphanChatAttachments job for abandoned pending uploads"
```

---

### Task 3: Wire the sweep into the worker

**Files:**
- Modify: `apps/worker/src/index.js` (import near line 35; new tick + interval near line 407, after the `runChatSessionExpiryTick` block)

- [ ] **Step 1: Add the import**

In `apps/worker/src/index.js`, directly below the existing line:

```javascript
import { expireStaleGuestSessions } from '../../api/src/routes/chat/session-expiry-job.js'
```

add:

```javascript
import { sweepOrphanChatAttachments } from '../../api/src/routes/chat/orphan-attachment-sweep-job.js'
```

- [ ] **Step 2: Add the tick + interval**

In `apps/worker/src/index.js`, immediately after this existing block:

```javascript
runChatSessionExpiryTick()
setInterval(() => {
  runChatSessionExpiryTick()
}, CHAT_EXPIRY_INTERVAL_MS)
```

insert:

```javascript
const CHAT_ORPHAN_SWEEP_INTERVAL_MS = 30 * 60 * 1000
async function runChatOrphanAttachmentSweepTick() {
  try {
    const result = await sweepOrphanChatAttachments({ prisma, supabaseAdmin: workerSupabaseAdmin })
    if ((result.swept ?? 0) > 0) {
      console.log(
        `[worker] chat orphan attachment sweep ${formatLogTimestamp()} swept=${result.swept}`,
      )
    }
  } catch (err) {
    console.error('[worker] chat orphan attachment sweep tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}

runChatOrphanAttachmentSweepTick()
setInterval(() => {
  runChatOrphanAttachmentSweepTick()
}, CHAT_ORPHAN_SWEEP_INTERVAL_MS)
```

- [ ] **Step 3: Syntax-check the worker entry**

Run: `node --check apps/worker/src/index.js`
Expected: no output (exit 0).

- [ ] **Step 4: Full chat API test sweep (no regressions)**

Run: `node --test apps/api/src/routes/chat/__tests__/*.test.js`
Expected: PASS — total pass count is the prior chat suite total plus the new `orphan-attachment-sweep-job` and `deleteAttachment` cases; 0 fail.

- [ ] **Step 5: Lint the touched files**

Run: `npx eslint apps/api/src/routes/chat/chat-attachments-service.js apps/api/src/routes/chat/orphan-attachment-sweep-job.js apps/api/src/routes/chat/__tests__/orphan-attachment-sweep-job.test.js apps/worker/src/index.js`
Expected: no errors (npm config warnings are fine).

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/index.js
git commit -m "feat(worker): run chat orphan-attachment sweep every 30 minutes"
```

---

## Self-Review

**Spec coverage:**
- B1 (deleteAttachment pending branch + always remove object) → Task 1. ✓
- B3 (`sweepOrphanChatAttachments`) → Task 2. ✓
- B3 (worker tick, 30 min interval, 120 min threshold, sibling-pattern guard) → Task 3 + `olderThanMinutes = 120` default in Task 2. ✓
- Testing section (pending branch, non-uploader 404, sent not-last, sent last soft-delete, storage error swallowed; sweep selects/gropus/deletes/empty) → Task 1 Step 1 + Task 2 Step 1. ✓

**Placeholder scan:** none — every step has full code or an exact command.

**Type consistency:**
- `deleteAttachment` return shapes: `{ ok: true, pending: true }` (pending), `{ ok: true, messageDeleted: boolean }` (sent) — used identically in impl and tests.
- `sweepOrphanChatAttachments({ prisma, supabaseAdmin, olderThanMinutes = 120, limit = 200 })` → `{ swept: number }` — matches Task 3 caller (`result.swept`) and tests.
- Storage stub contract `supabaseAdmin.storage.from(bucket).remove(keys) -> { data, error }` — consistent across service, job, and both test files.
- `removeStorageObject(bucket, objectKey)` inner helper — defined and called only within `createChatAttachmentsService`.

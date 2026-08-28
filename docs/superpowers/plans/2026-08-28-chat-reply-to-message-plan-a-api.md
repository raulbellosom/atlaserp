# Chat Reply-to-Message — Plan A (API & contracts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side support for replying to a specific chat message — a nullable `reply_to_message_id` column, a resolved `reply_to` preview on every message read, realtime propagation, and validated request plumbing.

**Architecture:** `chat_messages` gets a self-referencing nullable FK (`ON DELETE SET NULL`), mirroring the Phase E `thread_root_id` migration. A new pure module `chat-reply-preview.js` derives the preview shape from raw rows; `chat-service.js` calls it from `listMessages`, `getMessageFull` (which feeds `sendMessage`'s return and `listThreadReplies`). To stay under the 1500-line hard ceiling, the self-contained external-inbox operator functions are first extracted to `chat-external-inbox-service.js`.

**Tech Stack:** Node.js, Hono, Prisma 7 (`$queryRaw` tagged templates), Zod, `node --test`.

**Reference before starting:**
- `CLAUDE.md` — "Applied Prisma migrations are immutable", "Global ID policy: UUID v7", "keep route files thin", atomic file-size limits.
- `prisma/migrations/20260827000000_chat_threads/migration.sql` — the pattern this migration follows.
- `apps/api/src/routes/chat/chat-service.js` — `listMessages` (~L612), `getMessageFull` (~L537), `sendMessage` (~L736), `listThreadReplies` (~L1149), service factory `createChatService` (~L58), return block (~L1387).
- `apps/api/src/routes/chat/__tests__/channel-directory-service.test.js` — the `buildPrismaMock` sequential-`$queryRaw` test style.
- `apps/api/src/routes/chat/index.js` — routes at L177 (list messages) and L195 (send message); service instantiation at L69.

**Contract this plan freezes for Plan B:**
```jsonc
//每 message object gained one field:
"reply_to": null | {
  "id": "uuid",
  "senderUserId": "uuid" | null,
  "senderName": "string",
  "bodyPreview": "string" | null,   // ≤120 chars, newlines collapsed to spaces
  "kind": "text" | "image" | "video" | "audio" | "file" | "entity" | "deleted",
  "isDeleted": false
}
// send payload gained one optional field:
"replyToMessageId": "uuid"   // optional
```

---

## Task 1: Extract external-inbox operator functions out of `chat-service.js`

Frees ~105 lines so the reply-to additions stay under the 1500 hard ceiling. Pure move — no behavior change.

**Files:**
- Create: `apps/api/src/routes/chat/chat-external-inbox-service.js`
- Modify: `apps/api/src/routes/chat/chat-service.js` (remove 4 functions + their exports; keep everything else)
- Modify: `apps/api/src/routes/chat/index.js` (instantiate + delegate)

- [ ] **Step 1: Read the four functions and their helper dependencies**

Read `apps/api/src/routes/chat/chat-service.js` lines 1280–1385. The functions are `listExternalInbox`, `markExternalRead`, `assignOperator`, `closeExternalConversation`. Note every helper they call that is defined in the `createChatService` closure (`getUserProfileId`, `assertMember`, `ChatServiceError`, any `batchSign*`). List them.

- [ ] **Step 2: Create `chat-external-inbox-service.js` with a factory that takes its deps explicitly**

```js
// apps/api/src/routes/chat/chat-external-inbox-service.js
import { ChatServiceError } from "./chat-service-error.js";
import { resolveUserProfileId } from "./chat-service.js";

// Operator-facing "external support" inbox. Split out of chat-service.js
// (2026-08-28) to keep that file under the 1500-line ceiling — no behavior
// change from the pre-split version.
export function createChatExternalInboxService({ prisma }) {
  async function getUserProfileId(authUserId) {
    return resolveUserProfileId(prisma, authUserId);
  }

  async function assertMember(conversationId, userProfileId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId}
        AND user_id = ${userProfileId}
        AND left_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("No eres miembro de esta conversacion.", 403);
  }

  // <-- paste listExternalInbox, markExternalRead, assignOperator,
  //     closeExternalConversation verbatim from chat-service.js here,
  //     unchanged except for now living in this closure -->

  return { listExternalInbox, markExternalRead, assignOperator, closeExternalConversation };
}
```

Paste the four function bodies exactly as they were. If any references a `batchSign*` helper, copy that helper into this file too (check during Step 1).

- [ ] **Step 3: Remove the four functions from `chat-service.js`**

Delete the four `async function` definitions (L1283–L1384 region) and remove `listExternalInbox`, `markExternalRead`, `assignOperator`, `closeExternalConversation` from the `return { ... }` block near L1408.

- [ ] **Step 4: Wire the new service in `index.js`**

At `apps/api/src/routes/chat/index.js` near L24 add:
```js
import { createChatExternalInboxService } from "./chat-external-inbox-service.js";
```
Near L69 after `const chatService = createChatService({...})` add:
```js
const chatExternalInboxService = createChatExternalInboxService({ prisma });
```
In the 4 route handlers that call `chatService.listExternalInbox` / `.markExternalRead` / `.assignOperator` / `.closeExternalConversation` (grep for them — around L650, plus assign/close/mark handlers), change `chatService.` to `chatExternalInboxService.` for those 4 calls only.

- [ ] **Step 5: Verify nothing else imports the moved names**

Run: `cd d:/RacoonDevs/atlaserp-v2 && grep -rn "chatService.listExternalInbox\|chatService.markExternalRead\|chatService.assignOperator\|chatService.closeExternalConversation" apps/api`
Expected: no matches.

- [ ] **Step 6: Run existing chat tests + syntax check**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/api/src/routes/chat/chat-external-inbox-service.js && node --check apps/api/src/routes/chat/chat-service.js && node --check apps/api/src/routes/chat/index.js && node --test apps/api/src/routes/chat/__tests__/`
Expected: all PASS (same count as before the change).

- [ ] **Step 7: Confirm line count headroom**

Run: `cd d:/RacoonDevs/atlaserp-v2 && wc -l apps/api/src/routes/chat/chat-service.js`
Expected: ~1305–1315 lines (was 1413).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/chat/chat-external-inbox-service.js apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/index.js
git commit -m "refactor(chat): extract external-inbox operator fns into chat-external-inbox-service"
```

---

## Task 2: Migration — `reply_to_message_id` column

**Files:**
- Create: `prisma/migrations/20260828030000_chat_reply_to/migration.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =============================================================================
-- Atlas ERP — Chat reply-to-message
-- Migration: 20260828030000_chat_reply_to
-- Adds a nullable self-reference so a message can quote another message in the
-- same conversation. ON DELETE SET NULL: deleting the quoted original leaves
-- the reply intact, its quote just resolves to "message deleted" on read.
-- =============================================================================

ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "reply_to_message_id" UUID;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_reply_to_fkey"
    FOREIGN KEY ("reply_to_message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL;

CREATE INDEX "chat_messages_reply_to_message_id_idx"
  ON "chat_messages" ("reply_to_message_id")
  WHERE "reply_to_message_id" IS NOT NULL;
```

- [ ] **Step 2: Apply the migration**

Run: `cd d:/RacoonDevs/atlaserp-v2 && pnpm db:migrate`
Expected: `20260828030000_chat_reply_to` applied, no errors. (Requires the VPS DB connection / IP allowlist per CLAUDE.md.)

- [ ] **Step 3: Regenerate Prisma client**

Run: `cd d:/RacoonDevs/atlaserp-v2 && pnpm db:generate`
Expected: success. (`chat_messages` is not a Prisma-modelled table for these columns — the client is used elsewhere; regenerate anyway for safety.)

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260828030000_chat_reply_to/migration.sql
git commit -m "feat(chat): add chat_messages.reply_to_message_id column"
```

---

## Task 3: `chat-reply-preview.js` — pure preview builder (TDD)

**Files:**
- Create: `apps/api/src/routes/chat/chat-reply-preview.js`
- Create: `apps/api/src/routes/chat/__tests__/chat-reply-preview.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/chat/__tests__/chat-reply-preview.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReplyPreview } from "../chat-reply-preview.js";

const base = {
  id: "01900000-0000-7000-8000-00000000000a",
  sender_user_id: "01900000-0000-7000-8000-0000000000u1",
  sender_name: "Ana",
  body: "Hola equipo",
  message_type: "text",
  deleted_at: null,
  attachment_mime: null,
  has_entity_refs: false,
};

describe("buildReplyPreview", () => {
  it("returns null for a null row", () => {
    assert.equal(buildReplyPreview(null), null);
  });

  it("builds a text preview", () => {
    assert.deepEqual(buildReplyPreview(base), {
      id: base.id,
      senderUserId: base.sender_user_id,
      senderName: "Ana",
      bodyPreview: "Hola equipo",
      kind: "text",
      isDeleted: false,
    });
  });

  it("truncates a long body to 120 chars and collapses newlines", () => {
    const row = { ...base, body: "a\nb".padEnd(200, "x") };
    const out = buildReplyPreview(row);
    assert.equal(out.bodyPreview.length, 120);
    assert.ok(!out.bodyPreview.includes("\n"));
  });

  it("marks a deleted original", () => {
    const out = buildReplyPreview({ ...base, deleted_at: new Date() });
    assert.equal(out.isDeleted, true);
    assert.equal(out.kind, "deleted");
    assert.equal(out.bodyPreview, null);
    assert.equal(out.senderName, "Ana"); // id + name still populated
  });

  it("derives kind from attachment mime when body is empty", () => {
    assert.equal(buildReplyPreview({ ...base, body: "", attachment_mime: "image/png" }).kind, "image");
    assert.equal(buildReplyPreview({ ...base, body: "", attachment_mime: "video/mp4" }).kind, "video");
    assert.equal(buildReplyPreview({ ...base, body: "", attachment_mime: "audio/webm" }).kind, "audio");
    assert.equal(buildReplyPreview({ ...base, body: "", attachment_mime: "application/pdf" }).kind, "file");
  });

  it("derives kind=entity when the original is entity-ref-only", () => {
    assert.equal(buildReplyPreview({ ...base, body: "", has_entity_refs: true }).kind, "entity");
  });

  it("prefers text kind when the original has both a body and an attachment", () => {
    assert.equal(buildReplyPreview({ ...base, body: "mira esto", attachment_mime: "image/png" }).kind, "text");
    assert.equal(buildReplyPreview({ ...base, body: "mira esto", attachment_mime: "image/png" }).bodyPreview, "mira esto");
  });

  it("falls back to a generic sender name when null", () => {
    assert.equal(buildReplyPreview({ ...base, sender_name: null }).senderName, "Usuario");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test apps/api/src/routes/chat/__tests__/chat-reply-preview.test.js`
Expected: FAIL — `Cannot find module '../chat-reply-preview.js'`.

- [ ] **Step 3: Implement**

```js
// apps/api/src/routes/chat/chat-reply-preview.js

// Pure derivation of the lightweight "quoted message" preview attached to
// every message read (listMessages / getMessageFull / listThreadReplies).
// The caller supplies a flat row already joined to the original message's
// sender name, first attachment mime, and an entity-ref flag.
const MAX_PREVIEW = 120;

export function buildReplyPreview(row) {
  if (!row) return null;

  const senderName = row.sender_name || "Usuario";
  const isDeleted = Boolean(row.deleted_at);

  if (isDeleted) {
    return {
      id: row.id,
      senderUserId: row.sender_user_id ?? null,
      senderName,
      bodyPreview: null,
      kind: "deleted",
      isDeleted: true,
    };
  }

  const body = typeof row.body === "string" ? row.body.trim() : "";
  let bodyPreview = null;
  if (body) {
    const collapsed = body.replace(/\s+/g, " ");
    bodyPreview = collapsed.length > MAX_PREVIEW ? collapsed.slice(0, MAX_PREVIEW) : collapsed;
  }

  let kind;
  if (body) {
    kind = "text";
  } else if (row.attachment_mime) {
    const m = String(row.attachment_mime).toLowerCase();
    if (m.startsWith("image/")) kind = "image";
    else if (m.startsWith("video/")) kind = "video";
    else if (m.startsWith("audio/")) kind = "audio";
    else kind = "file";
  } else if (row.has_entity_refs) {
    kind = "entity";
  } else {
    kind = "text";
  }

  return {
    id: row.id,
    senderUserId: row.sender_user_id ?? null,
    senderName,
    bodyPreview,
    kind,
    isDeleted: false,
  };
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test apps/api/src/routes/chat/__tests__/chat-reply-preview.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-reply-preview.js apps/api/src/routes/chat/__tests__/chat-reply-preview.test.js
git commit -m "feat(chat): pure buildReplyPreview helper for quoted-message previews"
```

---

## Task 4: `resolveReplyPreviews` — batch resolver in `chat-service.js`

Given a set of message rows that carry `reply_to_message_id`, fetch every referenced original in one query and attach a `reply_to` field.

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js` (add import + one closure helper)
- Modify: `apps/api/src/routes/chat/__tests__/chat-service.test.js` (add a focused describe block)

- [ ] **Step 1: Add the import**

At the top of `chat-service.js` (near L6):
```js
import { buildReplyPreview } from "./chat-reply-preview.js";
```

- [ ] **Step 2: Add the closure helper inside `createChatService`**

Place it right after `getMessageFull` (~L607):
```js
  // Given message rows that may carry `reply_to_message_id`, fetch every
  // referenced original once and return a Map<id, previewRow> ready for
  // buildReplyPreview. One query regardless of page size.
  async function fetchReplyPreviewRows(rows) {
    const ids = [...new Set(rows.map((r) => r.reply_to_message_id).filter(Boolean))];
    if (!ids.length) return new Map();
    const previewRows = await prisma.$queryRaw`
      SELECT
        m.id,
        m.sender_user_id,
        m.body,
        m.message_type,
        m.deleted_at,
        up.display_name AS sender_name,
        (SELECT a.mime_type FROM chat_attachments a
           WHERE a.message_id = m.id ORDER BY a.created_at LIMIT 1) AS attachment_mime,
        (m.metadata ? 'entityRefs') AS has_entity_refs
      FROM chat_messages m
      LEFT JOIN user_profile up ON up.id = m.sender_user_id
      WHERE m.id IN (${Prisma.join(ids)})
    `;
    const map = new Map();
    for (const pr of previewRows) map.set(pr.id, pr);
    return map;
  }

  // Attach `reply_to` (built preview or null) to each row in-place-ish and
  // return the new array. `deleted-original` still yields a preview object
  // (with isDeleted:true) so the client can render "Mensaje eliminado".
  async function attachReplyPreviews(rows) {
    const map = await fetchReplyPreviewRows(rows);
    return rows.map((r) => ({
      ...r,
      reply_to: r.reply_to_message_id ? buildReplyPreview(map.get(r.reply_to_message_id) ?? null) : null,
    }));
  }
```

Note: `(m.metadata ? 'entityRefs')` is Postgres jsonb `?` existence operator; in a Prisma tagged template the literal `?` inside a string is fine (it is not a positional param — those are `${}` interpolations only).

- [ ] **Step 3: Write the failing test**

Add to `apps/api/src/routes/chat/__tests__/chat-service.test.js` (create the file if it only has a stub; follow `buildPrismaMock` from `channel-directory-service.test.js`):

```js
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createChatService, _resetProfileIdCacheForTests } from "../chat-service.js";

beforeEach(() => _resetProfileIdCacheForTests());

const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const CONV_ID = "01900000-0000-7000-8000-0000000000cc";
const MSG_A = "01900000-0000-7000-8000-0000000000a1"; // the quoted original
const MSG_B = "01900000-0000-7000-8000-0000000000b2"; // the reply

function seqMock(results) {
  let i = 0;
  return {
    $queryRaw: async () => {
      if (i >= results.length) throw new Error(`unexpected $queryRaw #${i + 1}`);
      return results[i++];
    },
    $executeRaw: async () => 0,
    $transaction: async (fn) => fn({ $queryRaw: async () => [{ id: MSG_B, created_at: new Date() }], $executeRaw: async () => 0 }),
    membership: { findFirst: async () => ({ companyId: "c1" }) },
  };
}

describe("chat-service — listMessages reply_to", () => {
  it("attaches a resolved reply_to preview to a reply row", async () => {
    const prisma = seqMock([
      [{ id: PROFILE_ID }],                              // resolveUserProfileId
      [{ id: "member-row" }],                            // assertMember
      [                                                  // listMessages main SELECT
        { id: MSG_B, conversation_id: CONV_ID, sender_user_id: PROFILE_ID, body: "de acuerdo",
          message_type: "text", attachment_count: 0, metadata: {}, created_at: new Date(),
          reply_to_message_id: MSG_A, attachments: null, reactions: null, sender: null,
          thread_root_id: null, thread_reply_count: 0, thread_last_reply_at: null },
      ],
      [],                                                // batchSign avatars (none)
      [                                                  // fetchReplyPreviewRows
        { id: MSG_A, sender_user_id: "u9", body: "¿Vamos con A?", message_type: "text",
          deleted_at: null, sender_name: "Ana", attachment_mime: null, has_entity_refs: false },
      ],
    ]);
    const svc = createChatService({ prisma });
    const res = await svc.listMessages({ conversationId: CONV_ID, authUserId: "auth-1" });
    const reply = res.data.find((m) => m.id === MSG_B);
    assert.equal(reply.reply_to.id, MSG_A);
    assert.equal(reply.reply_to.senderName, "Ana");
    assert.equal(reply.reply_to.kind, "text");
    assert.equal(reply.reply_to.bodyPreview, "¿Vamos con A?");
  });

  it("sets reply_to to null when the row has no reply_to_message_id", async () => {
    const prisma = seqMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      [{ id: MSG_B, conversation_id: CONV_ID, sender_user_id: PROFILE_ID, body: "hola",
         message_type: "text", attachment_count: 0, metadata: {}, created_at: new Date(),
         reply_to_message_id: null, attachments: null, reactions: null, sender: null,
         thread_root_id: null, thread_reply_count: 0, thread_last_reply_at: null }],
      [],
    ]);
    const svc = createChatService({ prisma });
    const res = await svc.listMessages({ conversationId: CONV_ID, authUserId: "auth-1" });
    assert.equal(res.data[0].reply_to, null);
  });
});
```

- [ ] **Step 4: Run it, verify it fails**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL — `reply_to` is `undefined` (helper not called yet) / SELECT does not return `reply_to_message_id`.

*(Implemented in Task 5. This task ends with the helper defined and the test written & red.)*

- [ ] **Step 5: Syntax check + commit (red test committed with implementation in Task 5)**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/api/src/routes/chat/chat-service.js`
Expected: PASS.

Do not commit yet — Task 5 makes the test green in the same commit.

---

## Task 5: Wire `reply_to` into `listMessages`, `getMessageFull`, `listThreadReplies`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`

- [ ] **Step 1: Add `reply_to_message_id` to the three SELECTs**

In `listMessages` main SELECT (~L633) and `getMessageFull` SELECT (~L545), add a line next to `m.thread_last_reply_at,`:
```sql
        m.reply_to_message_id,
```
`listThreadReplies` reuses `getMessageFull` per row, so it is covered transitively.

- [ ] **Step 2: Call `attachReplyPreviews` in `listMessages`**

In `listMessages`, the return currently maps `data.reverse().map((m) => ({ ...m, attachments: ..., sender: ... }))`. Wrap the final array:
```js
    const mapped = data.reverse().map((m) => ({
      ...m,
      attachments: (m.attachments ?? []).map((a) => ({
        ...a,
        url: attachmentUrlMap[`${a.bucket}:${a.objectKey}`] ?? null,
        objectKey: undefined,
        bucket: undefined,
      })),
      sender: m.sender
        ? { ...m.sender, avatarUrl: m.sender.avatarFileId ? (avatarUrlMap[m.sender.avatarFileId] ?? null) : null, avatarFileId: undefined }
        : m.sender,
    }));
    const withReplies = await attachReplyPreviews(mapped);
    return { data: withReplies, hasMore, nextCursor: hasMore ? data[data.length - 1]?.created_at?.toISOString() : null };
```
(Replace the existing `return { data: data.reverse().map(...), ... }` with the two statements above.)

- [ ] **Step 3: Call the builder in `getMessageFull`**

`getMessageFull` returns a single object. After it builds `rows[0]` into `m` and resolves the sender avatar, add:
```js
    const [replyRow] = m.reply_to_message_id
      ? await fetchReplyPreviewRows([{ reply_to_message_id: m.reply_to_message_id }]).then((map) => [map.get(m.reply_to_message_id) ?? null])
      : [null];
    return {
      ...m,
      reply_to: m.reply_to_message_id ? buildReplyPreview(replyRow) : null,
      sender: m.sender ? { ...m.sender, avatarUrl: ..., avatarFileId: undefined } : m.sender,
    };
```
Keep the existing `sender` shaping; only add the `reply_to` line and the `replyRow` lookup above the `return`.

- [ ] **Step 4: Run the Task 4 tests, verify they pass**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS (both `listMessages reply_to` tests).

- [ ] **Step 5: Run the whole chat suite**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test apps/api/src/routes/chat/__tests__/`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): resolve reply_to preview in listMessages/getMessageFull/thread"
```

---

## Task 6: `sendMessage` accepts + validates + persists `replyToMessageId`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js` (`sendMessage`)
- Modify: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `chat-service.test.js`:
```js
describe("chat-service — sendMessage replyToMessageId", () => {
  it("rejects a reply target from another conversation with 400", async () => {
    const prisma = seqMock([
      [{ id: PROFILE_ID }],                         // resolveUserProfileId
      [{ id: "member-row" }],                       // assertMember
      [{ type: "direct" }],                         // conversation type lookup
      [],                                           // assertNotBlocked -> other members
      [{ id: MSG_A, conversation_id: "OTHER-CONV", deleted_at: null }], // reply target lookup
    ]);
    const svc = createChatService({ prisma });
    await assert.rejects(
      () => svc.sendMessage({ conversationId: CONV_ID, authUserId: "auth-1", body: "x", replyToMessageId: MSG_A }),
      (e) => e.status === 400,
    );
  });

  it("rejects a deleted reply target with 400", async () => {
    const prisma = seqMock([
      [{ id: PROFILE_ID }], [{ id: "member-row" }], [{ type: "direct" }], [],
      [{ id: MSG_A, conversation_id: CONV_ID, deleted_at: new Date() }],
    ]);
    const svc = createChatService({ prisma });
    await assert.rejects(
      () => svc.sendMessage({ conversationId: CONV_ID, authUserId: "auth-1", body: "x", replyToMessageId: MSG_A }),
      (e) => e.status === 400,
    );
  });

  it("persists reply_to_message_id in the INSERT when the target is valid", async () => {
    let insertSql = "";
    let i = 0;
    const results = [
      [{ id: PROFILE_ID }], [{ id: "member-row" }], [{ type: "direct" }], [],
      [{ id: MSG_A, conversation_id: CONV_ID, deleted_at: null }],   // reply target OK
      [{ id: MSG_B, created_at: new Date(), reply_to_message_id: MSG_A }], // INSERT ... RETURNING *
      [{ id: MSG_B, sender: null, attachments: null, reactions: null, reply_to_message_id: MSG_A,
         thread_root_id: null }],                                    // getMessageFull SELECT
    ];
    const prisma = {
      $queryRaw: async (strings) => {
        const sql = strings.join("?");
        if (sql.includes("INSERT INTO chat_messages")) insertSql = sql;
        return results[i++];
      },
      $executeRaw: async () => 0,
      membership: { findFirst: async () => ({ companyId: "c1" }) },
    };
    const svc = createChatService({ prisma });
    await svc.sendMessage({ conversationId: CONV_ID, authUserId: "auth-1", body: "de acuerdo", replyToMessageId: MSG_A });
    assert.ok(insertSql.includes("reply_to_message_id"), "INSERT should name reply_to_message_id");
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL — `replyToMessageId` is ignored; no validation; INSERT lacks the column.

- [ ] **Step 3: Implement in `sendMessage`**

Add `replyToMessageId = null` to the destructured params (~L736):
```js
  async function sendMessage({ conversationId, authUserId, body, messageType = "text", metadata = {}, attachmentIds = [], threadRootId = null, entityRefs = [], replyToMessageId = null }) {
```

After the `assertNotBlocked(...)` call and before the `threadRootId` resolution block, add:
```js
    // Validate the quoted message: must exist, not be soft-deleted, and live
    // in THIS conversation (a quote never crosses conversations — the client
    // only ever offers reply within the open conversation).
    let resolvedReplyToId = null;
    if (replyToMessageId) {
      const [target] = await prisma.$queryRaw`
        SELECT id, conversation_id, deleted_at
        FROM chat_messages
        WHERE id = ${replyToMessageId}
        LIMIT 1
      `;
      if (!target || target.conversation_id !== conversationId || target.deleted_at) {
        throw new ChatServiceError("No se puede responder a ese mensaje.", 400);
      }
      resolvedReplyToId = replyToMessageId;
    }
```

In BOTH `INSERT INTO chat_messages (...)` statements (the thread branch ~L834 and the plain branch ~L851), add the column + value:
- thread branch: `(conversation_id, sender_user_id, sender_type, body, message_type, attachment_count, metadata, thread_root_id, reply_to_message_id)` … `..., ${resolvedThreadRootId}, ${resolvedReplyToId}`
- plain branch: `(conversation_id, sender_user_id, sender_type, body, message_type, attachment_count, metadata, reply_to_message_id)` … add `, ${resolvedReplyToId}` as the final value.

- [ ] **Step 4: Add `replyToMessageId` to the realtime broadcast payload**

In the `if (broadcaster)` block (~L991) add one field:
```js
      broadcaster.broadcastToUsers(memberIds, "chat.message.new", {
        conversationId,
        messageId: msg.id,
        senderId: profileId.toString(),
        senderName: fullMsg?.sender?.displayName ?? null,
        threadRootId: resolvedThreadRootId,
        replyToMessageId: resolvedReplyToId,
      }).catch(() => {});
```

- [ ] **Step 5: Run tests, verify pass**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS (all sendMessage + listMessages reply tests).

- [ ] **Step 6: Full chat suite + syntax check**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check apps/api/src/routes/chat/chat-service.js && node --test apps/api/src/routes/chat/__tests__/`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): sendMessage validates + persists replyToMessageId, broadcasts it"
```

---

## Task 7: Validator + route plumbing

**Files:**
- Modify: `packages/validators/src/chat.js`
- Modify: `apps/api/src/routes/chat/index.js`

- [ ] **Step 1: Extend `chatSendMessageSchema`**

In `packages/validators/src/chat.js` (~L10-20), add one line to the object:
```js
export const chatSendMessageSchema = z.object({
  body: z.string().max(10000).nullish().transform(v => v ?? ""),
  messageType: z.enum(["text", "image", "file", "system"]).default("text"),
  metadata: z.record(z.unknown()).optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
  threadRootId: z.string().uuid().optional(),
  replyToMessageId: z.string().uuid().optional(),
  entityRefs: z.array(z.object({
    entityType: z.enum(["contact", "file", "ledger_account", "hr_employee", "project", "task", "calendar_event"]),
    recordId: z.string().uuid(),
  })).max(5).optional(),
});
```

- [ ] **Step 2: Confirm the send routes need no change**

`apps/api/src/routes/chat/index.js` L201 and L727 both do `chatService.sendMessage({ conversationId, authUserId, ...data })`, so `replyToMessageId` flows automatically once the schema keeps it. No edit needed there.

- [ ] **Step 3: Add optional `around` to the list-messages route**

At `apps/api/src/routes/chat/index.js` L181-187, extend:
```js
      const { limit, before, around } = c.req.query();
      const result = await chatService.listMessages({
        conversationId,
        authUserId,
        limit: limit ? Math.min(parseInt(limit, 10), 100) : 40,
        before: before || null,
        around: around || null,
      });
```

- [ ] **Step 4: Implement `around` in `listMessages`**

In `chat-service.js` `listMessages` signature add `around = null`. When `around` is set, replace the `before` windowing with a centred window:
```js
  async function listMessages({ conversationId, authUserId, limit = 40, before = null, around = null }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    if (around) {
      const [anchor] = await prisma.$queryRaw`
        SELECT created_at FROM chat_messages
        WHERE id = ${around} AND conversation_id = ${conversationId} LIMIT 1
      `;
      if (!anchor) throw new ChatServiceError("Mensaje no encontrado.", 404);
      const half = Math.ceil(limit / 2);
      const olderRows = await prisma.$queryRaw`
        SELECT ${Prisma.raw(MESSAGE_SELECT_COLUMNS)}
        FROM chat_messages m
        LEFT JOIN user_profile up ON up.id = m.sender_user_id
        WHERE m.conversation_id = ${conversationId} AND m.thread_root_id IS NULL
          AND m.created_at <= ${anchor.created_at}
        ORDER BY m.created_at DESC LIMIT ${half + 1}
      `;
      const newerRows = await prisma.$queryRaw`
        SELECT ${Prisma.raw(MESSAGE_SELECT_COLUMNS)}
        FROM chat_messages m
        LEFT JOIN user_profile up ON up.id = m.sender_user_id
        WHERE m.conversation_id = ${conversationId} AND m.thread_root_id IS NULL
          AND m.created_at > ${anchor.created_at}
        ORDER BY m.created_at ASC LIMIT ${half}
      `;
      const hasMore = olderRows.length > half;
      const combined = [...olderRows.slice(0, half).reverse(), ...newerRows];
      return finalizeMessagePage(combined, hasMore, olderRows.slice(0, half));
    }
    // ... existing before-windowed path unchanged ...
  }
```

This requires refactoring the big inline SELECT column list into a `const MESSAGE_SELECT_COLUMNS` string constant (module scope) and the post-query URL-signing + `attachReplyPreviews` + shaping into a `finalizeMessagePage(rows, hasMore, cursorSourceRows)` closure helper, then having the existing `before` path call `finalizeMessagePage` too. If this refactor proves large, **defer `around` entirely** — mark Steps 3-4 skipped and note "frontend falls back to repeated loadOlder()" (spec §6.4 allows this). Do not half-implement.

- [ ] **Step 5: Syntax check + tests**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --check packages/validators/src/chat.js && node --check apps/api/src/routes/chat/index.js && node --check apps/api/src/routes/chat/chat-service.js && node --test apps/api/src/routes/chat/__tests__/`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/validators/src/chat.js apps/api/src/routes/chat/index.js apps/api/src/routes/chat/chat-service.js
git commit -m "feat(chat): accept replyToMessageId in validator; optional around window for jump-to-message"
```

---

## Task 8: `ON DELETE SET NULL` behaviour test + SDK note

**Files:**
- Modify: `apps/api/src/routes/chat/__tests__/chat-service.test.js`
- Modify: `packages/sdk/src/domains/chat.js` (comment only — no code change needed)

- [ ] **Step 1: Add a documentation test for the deleted-original preview path**

```js
describe("chat-service — reply_to when the original was deleted", () => {
  it("returns a preview with isDeleted:true and kind:deleted", async () => {
    const prisma = seqMock([
      [{ id: PROFILE_ID }], [{ id: "member-row" }],
      [{ id: MSG_B, conversation_id: CONV_ID, sender_user_id: PROFILE_ID, body: "ok",
         message_type: "text", attachment_count: 0, metadata: {}, created_at: new Date(),
         reply_to_message_id: MSG_A, attachments: null, reactions: null, sender: null,
         thread_root_id: null, thread_reply_count: 0, thread_last_reply_at: null }],
      [],
      [{ id: MSG_A, sender_user_id: "u9", body: "original", message_type: "text",
         deleted_at: new Date(), sender_name: "Ana", attachment_mime: null, has_entity_refs: false }],
    ]);
    const svc = createChatService({ prisma });
    const res = await svc.listMessages({ conversationId: CONV_ID, authUserId: "auth-1" });
    assert.equal(res.data[0].reply_to.isDeleted, true);
    assert.equal(res.data[0].reply_to.kind, "deleted");
  });
});
```

(Note: the actual `ON DELETE SET NULL` FK behaviour is exercised by Postgres itself — covered by the migration; this test documents the read-side rendering of a still-present `reply_to_message_id` pointing at a soft-deleted row, which is the common real case since messages are soft-deleted, not hard-deleted.)

- [ ] **Step 2: Add an SDK comment**

In `packages/sdk/src/domains/chat.js` above `sendMessage` (~L118):
```js
    // `data` may include `replyToMessageId` (uuid) — the message this one
    // quotes. `listMessages` params may include `around` (messageId) to fetch
    // the page containing a specific message for jump-to-quote.
```

- [ ] **Step 3: Run full suite**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test apps/api/src/routes/chat/__tests__/ && node --check packages/sdk/src/domains/chat.js`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/chat/__tests__/chat-service.test.js packages/sdk/src/domains/chat.js
git commit -m "test(chat): deleted-original reply preview; document SDK reply-to params"
```

---

## Task 9: Plan A self-verification

- [ ] **Step 1: Run every touched test suite**

Run: `cd d:/RacoonDevs/atlaserp-v2 && node --test apps/api/src/routes/chat/__tests__/`
Expected: all green.

- [ ] **Step 2: Lint**

Run: `cd d:/RacoonDevs/atlaserp-v2 && pnpm lint`
Expected: no new errors in `apps/api/src/routes/chat/**` or `packages/validators/**`.

- [ ] **Step 3: Line-count ceilings**

Run: `cd d:/RacoonDevs/atlaserp-v2 && wc -l apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/chat-external-inbox-service.js apps/api/src/routes/chat/chat-reply-preview.js`
Expected: `chat-service.js` < 1400 (comfortably under the 1500 ceiling); the others small.

- [ ] **Step 4: Manual smoke via curl (optional, needs a running API + token)**

```bash
# with the dev API on :4010 and $ATLAS_TOKEN exported
curl -s -X POST localhost:4010/chat/conversations/<CONV_ID>/messages \
  -H "Authorization: Bearer $ATLAS_TOKEN" -H 'content-type: application/json' \
  -d '{"body":"respondiendo","replyToMessageId":"<MSG_ID>"}' | jq '.data.reply_to'
```
Expected: a `reply_to` object with `senderName` + `bodyPreview`.

- [ ] **Step 5: Confirm the contract doc block at the top of this file matches what shipped.** Fix the doc if the implementation diverged.

---

## Self-review notes (author)

- Spec §5 (migration) → Task 2. §6.1 (split) → Task 1. §6.2 (sendMessage) → Task 6. §6.3 (preview on read) → Tasks 3-5. §6.4 (`around`) → Task 7 Steps 3-4 (explicitly deferrable). §6.5 (realtime payload) → Task 6 Step 4. §6.6 (validators/SDK) → Tasks 7-8. §9 API tests → Tasks 3,4,6,8.
- Type consistency: `reply_to` object keys (`id`, `senderUserId`, `senderName`, `bodyPreview`, `kind`, `isDeleted`) are identical in `buildReplyPreview` (Task 3), the tests (Tasks 4,6,8), and the Plan B contract.
- `resolvedReplyToId` (service local) vs `replyToMessageId` (param/wire) vs `reply_to_message_id` (column) — deliberate, consistent across tasks.
- Deferral is explicit and bounded (Task 7 `around`); no other placeholders.

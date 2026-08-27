# Chat Connectors — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `atlas.chat`'s backend so messages can reference `project`/`task`/`calendar_event` entities, and a channel can be linked 1:1 to a project.

**Architecture:** Reuse existing mechanisms wherever possible — `CalendarEvent.sourceModule`/`sourceEntityId` (already exists, no changes needed) for the calendar side; a new pair of generic `linked_module`/`linked_entity_id` columns on `chat_conversations` for the channel↔project side, kept out of the already-near-the-line `chat-service.js` by housing the link-specific queries in a new sibling service, `chat-channel-links-service.js`, that `createConversation`/`updateConversation` call into.

**Tech Stack:** Node.js, Hono, Prisma (raw `$queryRaw`/`$executeRaw` for the chat tables — they are not Prisma models), Zod, `node:test`.

**Reference spec:** `docs/superpowers/specs/2026-08-27-chat-projects-calendar-connectors-design.md`

**Companion plan:** `docs/superpowers/plans/2026-08-27-chat-connectors-plan-b-frontend.md` (frontend — depends on this plan being merged first).

---

### Task 1: Migration — `linked_module`/`linked_entity_id` on `chat_conversations`

**Files:**
- Create: `prisma/migrations/20260828020000_chat_conversation_link/migration.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =============================================================================
-- Atlas ERP — Chat Conversation ↔ External Entity Link (e.g. atlas.projects)
-- Migration: 20260828020000_chat_conversation_link
-- =============================================================================

ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "linked_module" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "linked_entity_id" UUID;

-- At most one channel per (module, entity) — e.g. one channel per project.
-- Partial index (WHERE linked_module IS NOT NULL) so any number of
-- conversations with no link can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_linked_entity_unique"
  ON "chat_conversations" ("linked_module", "linked_entity_id")
  WHERE "linked_module" IS NOT NULL;
```

- [ ] **Step 2: Apply the migration**

Run: `pnpm db:migrate`
Expected: output includes `20260828020000_chat_conversation_link` applied, exit code 0.

- [ ] **Step 3: Verify the columns exist**

Run: `pnpm db:studio` (or) a one-off check:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRawUnsafe('SELECT column_name FROM information_schema.columns WHERE table_name = \'chat_conversations\' AND column_name IN (\'linked_module\', \'linked_entity_id\')').then((r) => { console.log(r); p.\$disconnect(); });
"
```
Expected: 2 rows printed (`linked_module`, `linked_entity_id`).

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260828020000_chat_conversation_link
git commit -m "feat(chat): add linked_module/linked_entity_id to chat_conversations"
```

---

### Task 2: Validators — entityRefs enum + link fields

**Files:**
- Modify: `packages/validators/src/chat.js:10-20` (`chatSendMessageSchema`)
- Modify: `packages/validators/src/chat.js:26-35` (`chatUpdateConversationSchema`)
- Modify: `packages/validators/src/chat.js:70-76` (`chatCreateChannelSchema`)

- [ ] **Step 1: Extend `chatSendMessageSchema.entityRefs.entityType`**

In `packages/validators/src/chat.js`, replace:

```js
  entityRefs: z.array(z.object({
    entityType: z.enum(["contact", "file", "ledger_account", "hr_employee"]),
    recordId: z.string().uuid(),
  })).max(5).optional(),
```

with:

```js
  entityRefs: z.array(z.object({
    entityType: z.enum(["contact", "file", "ledger_account", "hr_employee", "project", "task", "calendar_event"]),
    recordId: z.string().uuid(),
  })).max(5).optional(),
```

- [ ] **Step 2: Add link fields to `chatUpdateConversationSchema`**

Replace:

```js
export const chatUpdateConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["open", "pending", "closed", "archived"]).optional(),
  // .min(1) so an empty string can never be treated as "setting a real emoji"
  // by updateConversation's mutual-exclusion logic (which only special-cases
  // an explicit null as "clear this field," not falsy-but-truthy values).
  avatarFileId: z.string().uuid().nullable().optional(),
  avatarEmoji: z.string().min(1).max(16).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

with:

```js
export const chatUpdateConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["open", "pending", "closed", "archived"]).optional(),
  // .min(1) so an empty string can never be treated as "setting a real emoji"
  // by updateConversation's mutual-exclusion logic (which only special-cases
  // an explicit null as "clear this field," not falsy-but-truthy values).
  avatarFileId: z.string().uuid().nullable().optional(),
  avatarEmoji: z.string().min(1).max(16).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  // Both must be sent together (both a string+uuid, or both null) — enforced
  // in chat-service.js, not here, since Zod can't easily express "both or
  // neither" across two independent optional fields without .refine noise
  // that would obscure the simpler two-field shape for the common case.
  linkedModule: z.string().trim().min(1).max(64).nullable().optional(),
  linkedEntityId: z.string().uuid().nullable().optional(),
});
```

- [ ] **Step 3: Add link fields to `chatCreateChannelSchema`**

Replace:

```js
export const chatCreateChannelSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  isPublic: z.boolean().optional().default(false),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, "El slug solo puede contener minusculas, numeros y guiones.").optional(),
  memberUserIds: z.array(z.string().uuid()).max(50).optional().default([]),
});
```

with:

```js
export const chatCreateChannelSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  isPublic: z.boolean().optional().default(false),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, "El slug solo puede contener minusculas, numeros y guiones.").optional(),
  memberUserIds: z.array(z.string().uuid()).max(50).optional().default([]),
  linkedModule: z.string().trim().min(1).max(64).optional(),
  linkedEntityId: z.string().uuid().optional(),
});
```

- [ ] **Step 4: Run existing validator tests to confirm nothing broke**

Run: `node --check packages/validators/src/chat.js`
Expected: no output, exit code 0 (this package has no dedicated Zod-schema test file — `node --check` is the available static check here).

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/chat.js
git commit -m "feat(chat): extend entityRefs enum and add channel link fields to chat validators"
```

---

### Task 3: New service — `chat-channel-links-service.js`

**Files:**
- Create: `apps/api/src/routes/chat/chat-channel-links-service.js`
- Test: `apps/api/src/routes/chat/__tests__/chat-channel-links-service.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatChannelLinksService } from "../chat-channel-links-service.js";

const CONV_ID = "01900000-0000-7000-8000-0000000000c1";
const OTHER_CONV_ID = "01900000-0000-7000-8000-0000000000c2";
const PROJECT_ID = "01900000-0000-7000-8000-0000000000pr";

function buildPrismaMock(queryRawResults = []) {
  let qIdx = 0;
  const calls = [];
  return {
    _queryRawCalls: calls,
    $queryRaw: async (strings, ...values) => {
      calls.push({ sql: strings.join("?"), values });
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
  };
}

describe("chat-channel-links-service — findByLink", () => {
  it("returns null when no conversation has that link", async () => {
    const prisma = buildPrismaMock([[]]);
    const svc = createChatChannelLinksService({ prisma });
    const result = await svc.findByLink("atlas.projects", PROJECT_ID);
    assert.equal(result, null);
  });

  it("returns the conversation row when a link exists", async () => {
    const row = { id: CONV_ID, linked_module: "atlas.projects", linked_entity_id: PROJECT_ID };
    const prisma = buildPrismaMock([[row]]);
    const svc = createChatChannelLinksService({ prisma });
    const result = await svc.findByLink("atlas.projects", PROJECT_ID);
    assert.deepEqual(result, row);
  });
});

describe("chat-channel-links-service — assertLinkAvailable", () => {
  it("does not throw when no conversation holds the link", async () => {
    const prisma = buildPrismaMock([[]]);
    const svc = createChatChannelLinksService({ prisma });
    await svc.assertLinkAvailable("atlas.projects", PROJECT_ID, null);
  });

  it("throws a 409 ChatServiceError when another conversation already holds the link", async () => {
    const prisma = buildPrismaMock([[{ id: OTHER_CONV_ID }]]);
    const svc = createChatChannelLinksService({ prisma });
    await assert.rejects(
      () => svc.assertLinkAvailable("atlas.projects", PROJECT_ID, CONV_ID),
      (err) => {
        assert.equal(err.name, "ChatServiceError");
        assert.equal(err.status, 409);
        return true;
      },
    );
  });

  it("excludes the given conversationId from the collision check (so re-saving the same link on the same channel is allowed)", async () => {
    const prisma = buildPrismaMock([[]]);
    const svc = createChatChannelLinksService({ prisma });
    await svc.assertLinkAvailable("atlas.projects", PROJECT_ID, CONV_ID);
    assert.match(prisma._queryRawCalls[0].sql, /id != \?/);
    assert.equal(prisma._queryRawCalls[0].values.at(-1), CONV_ID);
  });
});

describe("chat-channel-links-service — assertBothOrNeither", () => {
  it("does not throw when both are null", () => {
    const svc = createChatChannelLinksService({ prisma: {} });
    svc.assertBothOrNeither(null, null);
  });

  it("does not throw when both are set", () => {
    const svc = createChatChannelLinksService({ prisma: {} });
    svc.assertBothOrNeither("atlas.projects", PROJECT_ID);
  });

  it("throws a 422 ChatServiceError when only linkedModule is set", () => {
    const svc = createChatChannelLinksService({ prisma: {} });
    assert.throws(
      () => svc.assertBothOrNeither("atlas.projects", null),
      (err) => { assert.equal(err.name, "ChatServiceError"); assert.equal(err.status, 422); return true; },
    );
  });

  it("throws a 422 ChatServiceError when only linkedEntityId is set", () => {
    const svc = createChatChannelLinksService({ prisma: {} });
    assert.throws(
      () => svc.assertBothOrNeither(null, PROJECT_ID),
      (err) => { assert.equal(err.status, 422); return true; },
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-channel-links-service.test.js`
Expected: FAIL — `Cannot find module '../chat-channel-links-service.js'`

- [ ] **Step 3: Write the implementation**

```js
import { ChatServiceError } from "./chat-service.js";

// Backs both the "1 channel per project" rule (Spec A §4) and the
// generic future-proofing that motivated linked_module/linked_entity_id
// over a project-specific column — see the spec's §3 "Principio de diseño".
export function createChatChannelLinksService({ prisma }) {
  // linkedModule/linkedEntityId must travel together — a row with one set and
  // the other null is a "half-linked" state the partial unique index in
  // Task 1's migration cannot catch (Postgres unique indexes never treat two
  // NULLs as colliding, so N rows could all have the same linked_module with
  // a null linked_entity_id). Synchronous — pure validation, no I/O — so
  // callers can call it before touching prisma at all.
  function assertBothOrNeither(linkedModule, linkedEntityId) {
    const hasModule = linkedModule !== null && linkedModule !== undefined;
    const hasEntityId = linkedEntityId !== null && linkedEntityId !== undefined;
    if (hasModule !== hasEntityId) {
      throw new ChatServiceError("linkedModule y linkedEntityId deben enviarse juntos.", 422);
    }
  }

  async function findByLink(linkedModule, linkedEntityId) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM chat_conversations
      WHERE linked_module = ${linkedModule} AND linked_entity_id = ${linkedEntityId} AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async function assertLinkAvailable(linkedModule, linkedEntityId, excludeConversationId = null) {
    const rows = excludeConversationId
      ? await prisma.$queryRaw`
          SELECT id FROM chat_conversations
          WHERE linked_module = ${linkedModule} AND linked_entity_id = ${linkedEntityId}
            AND deleted_at IS NULL AND id != ${excludeConversationId}
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT id FROM chat_conversations
          WHERE linked_module = ${linkedModule} AND linked_entity_id = ${linkedEntityId} AND deleted_at IS NULL
          LIMIT 1
        `;
    if (rows.length) {
      throw new ChatServiceError("Ese registro ya tiene un canal vinculado.", 409);
    }
  }

  return { findByLink, assertLinkAvailable, assertBothOrNeither };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-channel-links-service.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-channel-links-service.js apps/api/src/routes/chat/__tests__/chat-channel-links-service.test.js
git commit -m "feat(chat): add chat-channel-links-service for the channel<->project link"
```

---

### Task 4: `chat-service.js` — wire `channelLinksService` + extend `createConversation`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js:62` (factory signature)
- Modify: `apps/api/src/routes/chat/chat-service.js:381-432` (`createConversation`)
- Test: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/routes/chat/__tests__/chat-service.test.js`:

```js
describe("chat-service — createConversation with a channel link", () => {
  it("returns the existing conversation when one already holds the requested link (idempotent)", async () => {
    const existing = { id: CONV_ID, linked_module: "atlas.projects", linked_entity_id: "proj-1" };
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }], // getUserProfileId
        [{ ...existing, members: null }], // getConversation's SELECT c.*, members
      ],
      [],
    );
    const channelLinksService = {
      assertBothOrNeither: () => {},
      findByLink: async (mod, id) => { assert.equal(mod, "atlas.projects"); assert.equal(id, "proj-1"); return existing; },
      assertLinkAvailable: async () => { throw new Error("should not be called when a link already exists"); },
    };
    const chatService = createChatService({ prisma, channelLinksService });
    const result = await chatService.createConversation({
      authUserId: AUTH_USER_ID, type: "channel", title: "Proyecto X", memberUserIds: [],
      linkedModule: "atlas.projects", linkedEntityId: "proj-1",
    });
    assert.equal(result.id, CONV_ID);
  });

  it("propagates a 409 from assertLinkAvailable instead of creating a duplicate channel", async () => {
    const prisma = buildPrismaMock([[{ id: PROFILE_ID }]], []);
    const channelLinksService = {
      assertBothOrNeither: () => {},
      findByLink: async () => null,
      assertLinkAvailable: async () => { throw new ChatServiceError("Ese registro ya tiene un canal vinculado.", 409); },
    };
    const chatService = createChatService({ prisma, channelLinksService });
    await assert.rejects(
      () => chatService.createConversation({
        authUserId: AUTH_USER_ID, type: "channel", title: "Proyecto X", memberUserIds: [],
        linkedModule: "atlas.projects", linkedEntityId: "proj-1",
      }),
      (err) => { assert.equal(err.status, 409); return true; },
    );
  });

  it("propagates a 422 from assertBothOrNeither when only linkedModule is provided, before touching prisma", async () => {
    const prisma = buildPrismaMock([], []); // no $queryRaw/$executeRaw calls expected — must fail before any DB access
    const channelLinksService = {
      assertBothOrNeither: () => { throw new ChatServiceError("linkedModule y linkedEntityId deben enviarse juntos.", 422); },
      findByLink: async () => { throw new Error("should not be called"); },
      assertLinkAvailable: async () => { throw new Error("should not be called"); },
    };
    const chatService = createChatService({ prisma, channelLinksService });
    await assert.rejects(
      () => chatService.createConversation({
        authUserId: AUTH_USER_ID, type: "channel", title: "Proyecto X", memberUserIds: [],
        linkedModule: "atlas.projects",
      }),
      (err) => { assert.equal(err.status, 422); return true; },
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL — first test fails because `createConversation` doesn't call `channelLinksService.findByLink` (falls through to the normal INSERT path and the mock prisma throws "Unexpected $queryRaw call"); second test fails the same way (no 409 raised).

- [ ] **Step 3: Wire `channelLinksService` into the factory**

In `apps/api/src/routes/chat/chat-service.js:62`, replace:

```js
export function createChatService({ prisma, supabaseAdmin, notificationService = null, broadcaster = null, permissionsService = null, mentionsService = null, entityReferencesService = null }) {
```

with:

```js
export function createChatService({ prisma, supabaseAdmin, notificationService = null, broadcaster = null, permissionsService = null, mentionsService = null, entityReferencesService = null, channelLinksService = null }) {
```

- [ ] **Step 4: Extend `createConversation`**

In `apps/api/src/routes/chat/chat-service.js:381`, replace the function signature and add the link check right after the existing direct-conversation dedup block (before the `INSERT INTO chat_conversations` at line 427):

```js
  async function createConversation({ authUserId, type, title, memberUserIds, metadata = {}, isPublic = false, slug = null, description = null, linkedModule = null, linkedEntityId = null }) {
    if (channelLinksService) channelLinksService.assertBothOrNeither(linkedModule, linkedEntityId);

    const creatorProfileId = await getUserProfileId(authUserId);

    // Prevent self-chat
    if (type === "direct" && memberUserIds.length === 1 && memberUserIds[0] === creatorProfileId.toString()) {
      throw new ChatServiceError("No puedes iniciar un chat contigo mismo.", 400);
    }

    // For direct conversations, enforce uniqueness (find existing)
    if (type === "direct" && memberUserIds.length === 1) {
      const otherId = memberUserIds[0];
      await assertNotBlockedByTarget(creatorProfileId, otherId);
      const existing = await prisma.$queryRaw`
        SELECT c.id FROM chat_conversations c
        WHERE c.type = 'direct'
          AND c.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM chat_conversation_members WHERE conversation_id = c.id AND user_id = ${creatorProfileId} AND left_at IS NULL
          )
          AND EXISTS (
            SELECT 1 FROM chat_conversation_members WHERE conversation_id = c.id AND user_id = ${otherId} AND left_at IS NULL
          )
        LIMIT 1
      `;
      if (existing.length) {
        return getConversation({ conversationId: existing[0].id, authUserId });
      }
    }

    // Same "find existing, return it" idempotency as the direct-conversation
    // case above, applied to channel↔module links (spec §5 "idempotente").
    if (linkedModule && linkedEntityId && channelLinksService) {
      const existing = await channelLinksService.findByLink(linkedModule, linkedEntityId);
      if (existing) {
        return getConversation({ conversationId: existing.id, authUserId });
      }
      await channelLinksService.assertLinkAvailable(linkedModule, linkedEntityId);
    }

    const membership = await prisma.membership.findFirst({
```

- [ ] **Step 5: Include the link columns in the INSERT**

In the same function, replace:

```js
    const convRows = await prisma.$queryRaw`
      INSERT INTO chat_conversations (type, title, created_by_user_id, company_id, is_public, slug, description, metadata)
      VALUES (${type}, ${title ?? null}, ${creatorProfileId}, ${companyId}, ${isPublic}, ${slug}, ${description}, ${JSON.stringify(metadata)}::jsonb)
      RETURNING *
    `;
```

with:

```js
    const convRows = await prisma.$queryRaw`
      INSERT INTO chat_conversations (type, title, created_by_user_id, company_id, is_public, slug, description, metadata, linked_module, linked_entity_id)
      VALUES (${type}, ${title ?? null}, ${creatorProfileId}, ${companyId}, ${isPublic}, ${slug}, ${description}, ${JSON.stringify(metadata)}::jsonb, ${linkedModule}, ${linkedEntityId})
      RETURNING *
    `;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS, including the 3 new tests. (If an unrelated existing test now fails because `getConversation`'s mocked `$queryRaw` sequence assumed a different call count, that means this step changed call ordering — it should not have; re-check Step 4 only added calls inside the new `if (linkedModule && ...)` branch, which existing tests that don't pass `linkedModule` never enter. Also note: existing tests that don't set `channelLinksService` at all pass `channelLinksService: undefined` implicitly via the factory's `channelLinksService = null` default — `assertBothOrNeither` is only called `if (channelLinksService)`, so those tests are unaffected.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): createConversation accepts linkedModule/linkedEntityId, idempotent on existing link"
```

---

### Task 5: `chat-service.js` — extend `updateConversation` (link / unlink)

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js:543-596` (`updateConversation`)
- Test: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/routes/chat/__tests__/chat-service.test.js`:

```js
describe("chat-service — updateConversation link/unlink", () => {
  it("links a channel to a project after checking availability", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }],       // getUserProfileId
        [{ id: "member-row" }],     // assertMember
        [{ type: "channel" }],      // conversation type lookup
        [{ ...{}, id: CONV_ID, members: null }], // getConversation
      ],
      [],
    );
    let assertedWith = null;
    const channelLinksService = {
      assertBothOrNeither: () => {},
      findByLink: async () => null,
      assertLinkAvailable: async (mod, id, excludeId) => { assertedWith = { mod, id, excludeId }; },
    };
    const permissionsService = { assertChannelPermission: async () => {} };
    const chatService = createChatService({ prisma, permissionsService, channelLinksService });
    await chatService.updateConversation({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID,
      updates: { linkedModule: "atlas.projects", linkedEntityId: "proj-1" },
    });
    assert.deepEqual(assertedWith, { mod: "atlas.projects", id: "proj-1", excludeId: CONV_ID });
  });

  it("unlinks a channel by sending both link fields as null, without an availability check", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }],
        [{ id: "member-row" }],
        [{ type: "channel" }],
        [{ id: CONV_ID, members: null }],
      ],
      [],
    );
    const channelLinksService = {
      assertBothOrNeither: () => {},
      assertLinkAvailable: async () => { throw new Error("should not be called when unlinking"); },
      findByLink: async () => null,
    };
    const permissionsService = { assertChannelPermission: async () => {} };
    const chatService = createChatService({ prisma, permissionsService, channelLinksService });
    const result = await chatService.updateConversation({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID,
      updates: { linkedModule: null, linkedEntityId: null },
    });
    assert.equal(result.id, CONV_ID);
  });

  it("propagates a 422 from assertBothOrNeither when only linkedEntityId is provided, before touching prisma beyond membership checks", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }],   // getUserProfileId
        [{ id: "member-row" }], // assertMember
        [{ type: "channel" }],  // conversation type lookup
      ],
      [],
    );
    const channelLinksService = {
      assertBothOrNeither: () => { throw new ChatServiceError("linkedModule y linkedEntityId deben enviarse juntos.", 422); },
      findByLink: async () => { throw new Error("should not be called"); },
      assertLinkAvailable: async () => { throw new Error("should not be called"); },
    };
    const permissionsService = { assertChannelPermission: async () => {} };
    const chatService = createChatService({ prisma, permissionsService, channelLinksService });
    await assert.rejects(
      () => chatService.updateConversation({
        conversationId: CONV_ID, authUserId: AUTH_USER_ID,
        updates: { linkedEntityId: "proj-1" },
      }),
      (err) => { assert.equal(err.status, 422); return true; },
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL — `updateConversation` currently ignores `updates.linkedModule`/`updates.linkedEntityId` entirely (falls into the `!hasTitle && !hasStatus && !hasAvatarFileId && !hasAvatarEmoji` early-return branch and never touches `channelLinksService`), so `assertedWith` stays `null` in the first test.

- [ ] **Step 3: Implement**

In `apps/api/src/routes/chat/chat-service.js:543`, replace the whole `updateConversation` function with:

```js
  async function updateConversation({ conversationId, authUserId, updates }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    if (permissionsService) {
      const [conv] = await prisma.$queryRaw`SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1`;
      if (conv && (conv.type === "channel" || conv.type === "group")) {
        await permissionsService.assertChannelPermission(conversationId, profileId, "channel.manage");
      }
    }

    if (channelLinksService) channelLinksService.assertBothOrNeither(updates.linkedModule, updates.linkedEntityId);

    const hasTitle = updates.title !== undefined;
    const hasStatus = updates.status !== undefined;
    const hasAvatarFileId = updates.avatarFileId !== undefined;
    const hasAvatarEmoji = updates.avatarEmoji !== undefined;
    const hasLinkedModule = updates.linkedModule !== undefined;

    if (!hasTitle && !hasStatus && !hasAvatarFileId && !hasAvatarEmoji && !hasLinkedModule) {
      return getConversation({ conversationId, authUserId });
    }

    // Mutual exclusivity: setting a real (non-null) avatar of one kind clears
    // the other kind, even if the caller didn't explicitly touch it — a
    // conversation has at most one avatar source at a time. Explicitly
    // clearing one (sending null) does NOT touch the other — a "remove both"
    // action must send both fields as null itself (spec Section 23 edge case 1).
    // If a caller sends both as real (non-null) values in the same request,
    // avatarFileId wins and the emoji is discarded — an `if`, not parallel
    // handling, so this branch always fires first when both are present.
    let nextAvatarFileId = updates.avatarFileId;
    let nextAvatarEmoji = updates.avatarEmoji;
    let touchAvatarFileId = hasAvatarFileId;
    let touchAvatarEmoji = hasAvatarEmoji;
    if (hasAvatarFileId && nextAvatarFileId !== null) {
      nextAvatarEmoji = null;
      touchAvatarEmoji = true;
    } else if (hasAvatarEmoji && nextAvatarEmoji !== null) {
      nextAvatarFileId = null;
      touchAvatarFileId = true;
    }

    // Setting a real link (both fields non-null) checks availability first —
    // excluding this conversation itself, so re-saving the same link is a
    // no-op, not a false-positive collision. Clearing the link (both null)
    // skips the check entirely: an unlink can never collide with anything.
    if (hasLinkedModule && updates.linkedModule !== null && channelLinksService) {
      await channelLinksService.assertLinkAvailable(updates.linkedModule, updates.linkedEntityId, conversationId);
    }

    const sets = [Prisma.sql`updated_at = NOW()`];
    if (hasTitle) sets.push(Prisma.sql`title = ${updates.title}`);
    if (hasStatus) sets.push(Prisma.sql`status = ${updates.status}`);
    if (touchAvatarFileId) sets.push(Prisma.sql`avatar_file_id = ${nextAvatarFileId}`);
    if (touchAvatarEmoji) sets.push(Prisma.sql`avatar_emoji = ${nextAvatarEmoji}`);
    if (hasLinkedModule) {
      sets.push(Prisma.sql`linked_module = ${updates.linkedModule}`);
      sets.push(Prisma.sql`linked_entity_id = ${updates.linkedEntityId ?? null}`);
    }

    await prisma.$executeRaw`
      UPDATE chat_conversations
      SET ${Prisma.join(sets, ", ")}
      WHERE id = ${conversationId}
    `;

    return getConversation({ conversationId, authUserId });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Confirm the file is still under the 1500-line hard ceiling**

Run: `wc -l apps/api/src/routes/chat/chat-service.js`
Expected: a number below 1500 (starting point was 1469; Tasks 4+5 add roughly 25 lines total, so expect ~1494). If this is at or over 1500, stop and extract `updateConversation`'s link-handling block into a call to a new `channelLinksService.buildUpdateFragment(...)` helper instead of inlining it, before proceeding to Task 6.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): updateConversation supports linking/unlinking a channel to a project"
```

---

### Task 6: `chat-entity-references-service.js` — resolve `project`/`task`/`calendar_event`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-entity-references-service.js:19-86`
- Test: `apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js`:

```js
describe("chat-entity-references-service — project/task/calendar_event", () => {
  it("resolves a project reference, deriving profileId from authUserId (not passing authUserId through)", async () => {
    const prisma = {
      userProfile: { findUnique: async () => ({ id: "profile-1" }) },
      membership: { findFirst: async () => ({ companyId: "company-1" }) },
    };
    let capturedArgs = null;
    const deps = {
      projectsService: { getProject: async (id, userId) => { capturedArgs = { id, userId }; return { id: "proj-1", name: "Relanzamiento web", color: "#6366f1", icon: "Rocket" }; } },
      tasksService: {}, calendarEventService: {}, contactsService: {}, filesService: {}, hrService: {}, ledgerService: {}, prisma,
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "project", recordId: "proj-1" }],
    });
    assert.deepEqual(capturedArgs, { id: "proj-1", userId: "profile-1" });
    assert.deepEqual(result, [{
      entityType: "project", recordId: "proj-1", title: "Relanzamiento web",
      subtitle: null, url: "/app/m/atlas.projects/proj-1", color: "#6366f1", icon: "Rocket",
    }]);
  });

  it("drops a project reference the caller cannot access (404 from getProject)", async () => {
    const prisma = {
      userProfile: { findUnique: async () => ({ id: "profile-1" }) },
      membership: { findFirst: async () => ({ companyId: "company-1" }) },
    };
    const deps = {
      projectsService: { getProject: async () => { throw new Error("Proyecto no encontrado."); } },
      tasksService: {}, calendarEventService: {}, contactsService: {}, filesService: {}, hrService: {}, ledgerService: {}, prisma,
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "project", recordId: "proj-1" }],
    });
    assert.deepEqual(result, []);
  });

  it("resolves a task reference, using the task's status name as subtitle", async () => {
    const deps = {
      tasksService: { getTask: async (id) => { assert.equal(id, "task-1"); return { id: "task-1", title: "Diseñar landing", status: { name: "En progreso" } }; } },
      projectsService: {}, calendarEventService: {}, contactsService: {}, filesService: {}, hrService: {}, ledgerService: {}, prisma: {},
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "task", recordId: "task-1" }],
    });
    assert.deepEqual(result, [{
      entityType: "task", recordId: "task-1", title: "Diseñar landing",
      subtitle: "En progreso", url: "/app/m/atlas.projects/tasks/task-1",
    }]);
  });

  it("resolves a calendar_event reference, deriving profileId from authUserId", async () => {
    const prisma = {
      userProfile: { findUnique: async () => ({ id: "profile-1" }) },
      membership: { findFirst: async () => ({ companyId: "company-1" }) },
    };
    let capturedArgs = null;
    const deps = {
      calendarEventService: { getEvent: async (userId, id) => { capturedArgs = { userId, id }; return { id: "evt-1", title: "Reunion de seguimiento", startAt: "2026-09-01T15:00:00.000Z" }; } },
      projectsService: {}, tasksService: {}, contactsService: {}, filesService: {}, hrService: {}, ledgerService: {}, prisma,
    };
    const service = createChatEntityReferencesService(deps);
    const result = await service.resolveEntityRefs({
      authUserId: "auth-1",
      entityRefs: [{ entityType: "calendar_event", recordId: "evt-1" }],
    });
    assert.deepEqual(capturedArgs, { userId: "profile-1", id: "evt-1" });
    assert.equal(result[0].title, "Reunion de seguimiento");
    assert.equal(result[0].url, "/app/m/atlas.calendar/events/evt-1");
    assert.equal(typeof result[0].subtitle, "string");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js`
Expected: FAIL — `createChatEntityReferencesService` ignores the `project`/`task`/`calendar_event` cases (`resolveOne` returns `null` for unknown `entityType`), so all 4 new tests fail on the `assert.deepEqual`/`assert.equal` calls against an empty or `null` result.

- [ ] **Step 3: Implement**

In `apps/api/src/routes/chat/chat-entity-references-service.js`, replace the factory signature:

```js
export function createChatEntityReferencesService({ prisma, contactsService, filesService, hrService, ledgerService }) {
```

with:

```js
export function createChatEntityReferencesService({ prisma, contactsService, filesService, hrService, ledgerService, projectsService, tasksService, calendarEventService }) {
```

Then, inside `resolveOne`, right before the `if (entityType === "ledger_account")` block, insert:

```js
      if (entityType === "project") {
        const ctx = await resolveActorContext(prisma, authUserId);
        if (!ctx) return null;
        const row = await projectsService.getProject(recordId, ctx.profileId);
        return {
          entityType, recordId, title: row.name, subtitle: null,
          url: `/app/m/atlas.projects/${recordId}`,
          color: row.color ?? null,
          icon: row.icon ?? null,
        };
      }
      if (entityType === "task") {
        const row = await tasksService.getTask(recordId);
        if (!row) return null;
        return {
          entityType, recordId, title: row.title,
          subtitle: row.status?.name ?? null,
          url: `/app/m/atlas.projects/tasks/${recordId}`,
        };
      }
      if (entityType === "calendar_event") {
        const ctx = await resolveActorContext(prisma, authUserId);
        if (!ctx) return null;
        const row = await calendarEventService.getEvent(ctx.profileId, recordId);
        const startDate = new Date(row.startAt);
        const subtitle = Number.isNaN(startDate.getTime())
          ? null
          : startDate.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
        return {
          entityType, recordId, title: row.title, subtitle,
          url: `/app/m/atlas.calendar/events/${recordId}`,
        };
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js`
Expected: PASS, all tests including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-entity-references-service.js apps/api/src/routes/chat/__tests__/chat-entity-references-service.test.js
git commit -m "feat(chat): resolve project/task/calendar_event entity references"
```

---

### Task 7: Wire new services + `GET /chat/channels/linked` lookup route

**Files:**
- Modify: `apps/api/src/routes/chat/index.js:1-65` (imports + service wiring)
- Modify: `apps/api/src/routes/chat/index.js:446-460` (add the new GET route near the existing channel-directory routes)
- Test: `apps/api/src/routes/chat/__tests__/channel-directory-service.test.js` is untouched — the new route is a thin pass-through tested at the service layer already (Task 3); this task only needs a smoke check (Step 5).

- [ ] **Step 1: Add the new imports**

In `apps/api/src/routes/chat/index.js`, after the existing service imports (around line 37), add:

```js
import { createChatChannelLinksService } from "./chat-channel-links-service.js";
import { createProjectsService } from "../projects/projects-service.js";
import { createTasksService } from "../projects/tasks-service.js";
import { createCalendarEventService } from "../calendar/calendar-event-service.js";
```

- [ ] **Step 2: Instantiate the new services and wire them in**

Replace:

```js
export function createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService = null, broadcaster = null }) {
  const app = new Hono();
  const permissionsService = createChatPermissionsService({ prisma });
  const mentionsService = createChatMentionsService({ prisma });
  const entityReferencesService = createChatEntityReferencesService({
    prisma,
    contactsService: createContactsService({ prisma }),
    filesService: createFilesService({ prisma, supabaseAdmin }),
    hrService: createHrService({ prisma }),
    ledgerService: createLedgerService({ prisma }),
  });
  const chatService = createChatService({ prisma, supabaseAdmin, notificationService, broadcaster, permissionsService, mentionsService, entityReferencesService });
```

with:

```js
export function createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService = null, broadcaster = null }) {
  const app = new Hono();
  const permissionsService = createChatPermissionsService({ prisma });
  const mentionsService = createChatMentionsService({ prisma });
  const channelLinksService = createChatChannelLinksService({ prisma });
  const entityReferencesService = createChatEntityReferencesService({
    prisma,
    contactsService: createContactsService({ prisma }),
    filesService: createFilesService({ prisma, supabaseAdmin }),
    hrService: createHrService({ prisma }),
    ledgerService: createLedgerService({ prisma }),
    projectsService: createProjectsService({ prisma }),
    tasksService: createTasksService({ prisma }),
    calendarEventService: createCalendarEventService({ prisma }),
  });
  const chatService = createChatService({ prisma, supabaseAdmin, notificationService, broadcaster, permissionsService, mentionsService, entityReferencesService, channelLinksService });
```

- [ ] **Step 3: Add the lookup route**

In `apps/api/src/routes/chat/index.js`, right after the existing `GET /chat/channels/directory` route (ends at line 460 with `});`), add:

```js
  // GET /chat/channels/linked?module=atlas.projects&entityId=<uuid>
  // Used by the source module's UI (e.g. a project's detail screen) to know
  // whether it already has a linked channel before rendering "Crear canal"
  // vs. "Ir al canal".
  internal.get("/channels/linked", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const { module: linkedModule, entityId } = c.req.query();
      if (!linkedModule || !entityId) {
        return c.json({ error: "module y entityId son requeridos." }, 422);
      }
      const conversation = await channelLinksService.findByLink(linkedModule, entityId);
      return c.json({ data: conversation });
    } catch (err) {
      return handleError(c, err, "Error buscando el canal vinculado.");
    }
  });
```

- [ ] **Step 4: Static check**

Run: `node --check apps/api/src/routes/chat/index.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Full chat test suite + line count smoke check**

Run: `node --test apps/api/src/routes/chat/__tests__/`
Expected: all tests PASS (no regressions from the wiring change).

Run: `wc -l apps/api/src/routes/chat/index.js`
Expected: a number under 1500 (file was 1068 lines as of 2026-08-28 per CLAUDE.md; this task adds ~15 lines).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/index.js
git commit -m "feat(chat): wire projects/tasks/calendar services and add GET /chat/channels/linked"
```

---

### Task 8: Full backend verification

- [ ] **Step 1: Run the complete chat test suite**

Run: `node --test apps/api/src/routes/chat/__tests__/`
Expected: all tests PASS, 0 failures.

- [ ] **Step 2: Run the complete projects and calendar test suites (unchanged, but touched-by-reference — confirm no accidental breakage)**

Run: `node --test apps/api/src/routes/projects/__tests__/ apps/api/src/routes/calendar/__tests__/`
Expected: all tests PASS, 0 failures (this plan does not modify these services — this step exists to catch an accidental typo introduced while reading their exports in Tasks 6-7).

- [ ] **Step 3: Static check every touched file**

Run:
```bash
node --check apps/api/src/routes/chat/chat-service.js
node --check apps/api/src/routes/chat/chat-entity-references-service.js
node --check apps/api/src/routes/chat/chat-channel-links-service.js
node --check apps/api/src/routes/chat/index.js
node --check packages/validators/src/chat.js
```
Expected: no output for any of them, exit code 0.

- [ ] **Step 4: Manual smoke test against a running API**

With `pnpm dev:api` running and a valid `$ATLAS_TOKEN`:

```bash
curl -s -X POST http://localhost:4010/chat/channels \
  -H "Authorization: Bearer $ATLAS_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Test proyecto","linkedModule":"atlas.projects","linkedEntityId":"<a real project id>"}'
```
Expected: `201`, response `data.linked_module === "atlas.projects"`.

```bash
curl -s "http://localhost:4010/chat/channels/linked?module=atlas.projects&entityId=<same project id>" \
  -H "Authorization: Bearer $ATLAS_TOKEN"
```
Expected: `200`, `data.id` matches the channel created above.

Repeating the first `curl` a second time with the same `linkedEntityId` should return `200`/the same conversation `id` (idempotent), not a `409` or a second channel.

- [ ] **Step 5: Final commit (if any cleanup was needed)**

```bash
git status
```
If clean (all prior task commits already cover everything), no further commit is needed.

---

## Plan Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-08-27-chat-projects-calendar-connectors-design.md`):
- §5 "Menciones (extensión de lo existente)" → Task 6.
- §5 "Vínculo canal↔proyecto" → Tasks 1, 3, 4, 5, 7 (the plan implements this via extending `POST /chat/channels` and `PATCH /chat/conversations/:id` rather than the spec's illustrative separate `PATCH /chat/conversations/:id/link` and `POST /projects/:id/chat-channel` routes — reusing the existing update/create endpoints turned out simpler once `updateConversation`'s and `createConversation`'s actual code was read; no separate `POST /projects/:id/chat-channel` backend route is needed at all, since the frontend can call the existing `POST /chat/channels` directly with `linkedModule`/`linkedEntityId` — this is a plan-time refinement of the spec, not a scope change).
- §5 "Calendario — sin nuevos endpoints" → confirmed with no code changes needed to `calendar-event-service.js`/`calendar-routes.js` (Plan B wires the SDK/UI side).
- §3 "Nota de tamaño de archivo" (`chat-service.js` must not grow unbounded) → Task 3 (new `chat-channel-links-service.js`) + Task 4/5 Step 5 (explicit line-count gate).

**Placeholder scan:** none — every step has literal code.

**Type/name consistency:** `channelLinksService.findByLink(linkedModule, linkedEntityId)`, `.assertLinkAvailable(linkedModule, linkedEntityId, excludeConversationId)`, and `.assertBothOrNeither(linkedModule, linkedEntityId)` are used with the same names and argument order in Tasks 3, 4, and 5. `entityReferencesService`'s new deps (`projectsService`, `tasksService`, `calendarEventService`) are named identically in Task 6's factory signature and Task 7's instantiation call.

**Post-Task-2-review fix (applied during execution, not in the original written plan):** the code quality reviews for Tasks 1 and 2 independently flagged the same gap — nothing enforced that `linkedModule`/`linkedEntityId` travel together, so a caller could persist a "half-linked" row the partial unique index can't catch (Postgres unique indexes never treat two NULLs as colliding). Task 3 gained a synchronous `assertBothOrNeither` guard, called from both `createConversation` (Task 4, before any DB access) and `updateConversation` (Task 5, right after the permission check). This is reflected in the task text above, not left as a follow-up.

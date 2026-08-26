# Chat Conversation Profile Panel — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-08-26-chat-conversation-profile-panel-design.md`

**Goal:** Add the data model, service functions, block-enforcement, and API endpoints for muting a conversation, blocking/unblocking a user, filing/reviewing chat reports, and listing "groups in common" — everything Plan B's frontend needs to call.

**Architecture:** One new forward migration (`chat_blocks`, `chat_reports` tables, `chat_conversation_members.muted_at` column), one new service file `chat-moderation-service.js` following the existing per-area service convention in `apps/api/src/routes/chat/`, a small block-enforcement addition inside the existing `chat-service.js` (`sendMessage`/`createConversation`), new routes in the existing `apps/api/src/routes/chat/index.js` router, two new `identity.chat_reports.*` permissions declared in atlas.identity's manifest, and new SDK methods in `packages/sdk/src/domains/chat.js`.

**Tech Stack:** Hono, Prisma `$queryRaw`/`$executeRaw` (raw SQL — these tables are intentionally not Prisma models, matching every other `chat_*` table), Zod (`@atlas/validators`), Node's built-in test runner (`node --test`).

---

### Task 1: Migration — `chat_blocks`, `chat_reports`, `muted_at`

**Files:**
- Create: `prisma/migrations/20260828000000_chat_moderation/migration.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- =============================================================================
-- Atlas ERP — Chat Moderation (mute, block, report)
-- Migration: 20260828000000_chat_moderation
-- =============================================================================

-- Per-member mute flag, same shape as the existing archived_at column
ALTER TABLE "chat_conversation_members"
  ADD COLUMN IF NOT EXISTS "muted_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "chat_conversation_members_muted_idx"
  ON "chat_conversation_members" ("user_id", "muted_at")
  WHERE "user_id" IS NOT NULL AND "muted_at" IS NOT NULL;

-- Blocks are between two users, not conversation-scoped
CREATE TABLE IF NOT EXISTS "chat_blocks" (
  "id"                UUID        NOT NULL DEFAULT uuidv7(),
  "blocker_user_id"   UUID        NOT NULL,
  "blocked_user_id"   UUID        NOT NULL,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_blocks_blocker_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_blocks_blocked_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_blocks_blocker_blocked_idx"
  ON "chat_blocks" ("blocker_user_id", "blocked_user_id");

CREATE INDEX IF NOT EXISTS "chat_blocks_blocked_user_idx"
  ON "chat_blocks" ("blocked_user_id");

-- Reports filed against a user, optionally referencing the conversation they
-- originated from
CREATE TABLE IF NOT EXISTS "chat_reports" (
  "id"                    UUID        NOT NULL DEFAULT uuidv7(),
  "reporter_user_id"      UUID        NOT NULL,
  "reported_user_id"      UUID        NOT NULL,
  "conversation_id"       UUID,
  "reason"                TEXT        NOT NULL,
  "note"                  TEXT,
  "status"                TEXT        NOT NULL DEFAULT 'open',
  "reviewed_by_user_id"   UUID,
  "reviewed_at"           TIMESTAMPTZ,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_reports_reporter_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_reports_reported_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_reports_reason_check" CHECK ("reason" IN ('spam', 'abuse', 'inappropriate', 'other')),
  CONSTRAINT "chat_reports_status_check" CHECK ("status" IN ('open', 'dismissed', 'user_disabled'))
);

CREATE INDEX IF NOT EXISTS "chat_reports_status_idx"
  ON "chat_reports" ("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "chat_reports_reported_user_idx"
  ON "chat_reports" ("reported_user_id");
```

- [ ] **Step 2: Apply the migration**

Run: `pnpm db:migrate`
Expected: Output ends with `Your database is now in sync with your migrations history.` and lists `20260828000000_chat_moderation` as applied. No errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/20260828000000_chat_moderation/migration.sql
git commit -m "feat(chat): add chat_blocks, chat_reports tables and muted_at column"
```

---

### Task 2: Permission catalog + atlas.identity manifest

**Files:**
- Modify: `apps/api/src/permission-catalog.js`
- Modify: `apps/api/src/manifests/official/core-modules.js`

- [ ] **Step 1: Add display metadata to the permission catalog**

In `apps/api/src/permission-catalog.js`, find the `atlas.identity` section (search for `identity.permissions.delete` — it's the last identity permission before the next module's comment block) and add two entries directly after it, inside the same object:

```js
  "identity.chat_reports.read": {
    displayNameEs: "Ver reportes de chat",
    descriptionEs: "Permite ver los reportes de usuarios de chat filtrados por otros usuarios.",
    groupKey: "identity",
    order: 90,
  },
  "identity.chat_reports.manage": {
    displayNameEs: "Gestionar reportes de chat",
    descriptionEs: "Permite desestimar reportes de chat o deshabilitar al usuario reportado.",
    groupKey: "identity",
    order: 100,
  },
```

Adjust the `order` values to be higher than the last existing `identity.*` entry's `order` in that block (read the surrounding entries first — do not duplicate an existing `order` number).

- [ ] **Step 2: Add the permissions + navigation to the atlas.identity manifest**

In `apps/api/src/manifests/official/core-modules.js`, inside `identityMap`'s `permissions` array (the array containing `identity.access`, `identity.users.read`, etc. — ends around line 188 in the current file), add two entries at the end:

```js
    { key: "identity.chat_reports.read", name: "Read Chat Reports" },
    { key: "identity.chat_reports.manage", name: "Manage Chat Reports" },
```

In the same manifest's `navigation` array (contains the "Usuarios" and "Roles" entries), add a third entry:

```js
    {
      label: "Reportes de chat",
      path: "/identity/chat-reports",
      icon: "Flag",
      layout: "main",
      permissionKey: "identity.chat_reports.read",
    },
```

In the manifest's `acl.actions` map, add:

```js
      "identity.chat_reports.read": "identity.chat_reports.read",
      "identity.chat_reports.manage": "identity.chat_reports.manage",
```

- [ ] **Step 3: Re-seed and verify**

Run: `pnpm db:seed`
Expected: No errors. Output includes the identity module's permission count increasing by 2 (or at minimum no errors/warnings about unknown permission keys).

Run this to confirm the two new permissions now exist in the database:
```bash
node -e "
import('@prisma/client').then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  const rows = await prisma.permission.findMany({ where: { key: { in: ['identity.chat_reports.read', 'identity.chat_reports.manage'] } }, select: { key: true } });
  console.log(rows);
  await prisma.\$disconnect();
});
"
```
Expected: prints both keys.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/permission-catalog.js apps/api/src/manifests/official/core-modules.js
git commit -m "feat(identity): add chat_reports permissions and navigation entry"
```

---

### Task 3: Validators — `packages/validators/src/chat.js`

**Files:**
- Modify: `packages/validators/src/chat.js`

- [ ] **Step 1: Add the three new schemas**

Open `packages/validators/src/chat.js` and add these exports after the last existing schema in the file (`chatToggleReactionSchema`):

```js
export const chatMuteConversationSchema = z.object({
  muted: z.boolean(),
});

export const chatCreateReportSchema = z.object({
  reportedUserId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  reason: z.enum(["spam", "abuse", "inappropriate", "other"]),
  note: z.string().max(2000).optional(),
  alsoBlock: z.boolean().optional(),
});

export const chatResolveReportSchema = z.object({
  action: z.enum(["dismiss", "disable_user"]),
});
```

- [ ] **Step 2: Verify the file is syntactically valid**

Run: `node --check packages/validators/src/chat.js`
Expected: No output (success).

- [ ] **Step 3: Commit**

```bash
git add packages/validators/src/chat.js
git commit -m "feat(validators): add chat mute, report create/resolve schemas"
```

---

### Task 4: `chat-moderation-service.js` — mute, block, groups-in-common

**Files:**
- Create: `apps/api/src/routes/chat/chat-moderation-service.js`
- Test: `apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js`

This task covers `muteConversation`, `getBlockStatus`, `blockUser`, `unblockUser`, `getGroupsInCommon`. Task 5 covers the report functions in the same file.

- [ ] **Step 1: Write the failing tests for mute and block**

Create `apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js`:

```js
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatModerationService,
  ChatModerationServiceError,
} from "../chat-moderation-service.js";
import { _resetProfileIdCacheForTests } from "../chat-service.js";

const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const OTHER_PROFILE_ID = "01900000-0000-7000-8000-0000000000p2";
const CONV_ID = "01900000-0000-7000-8000-0000000000c1";

beforeEach(() => {
  _resetProfileIdCacheForTests();
});

function buildPrismaMock(queryRawResults = [], executeRawResults = []) {
  let qIdx = 0;
  let eIdx = 0;
  const client = {
    _executeRawCallCount: 0,
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    $executeRaw: async () => {
      client._executeRawCallCount++;
      return executeRawResults[eIdx++] ?? { count: 1 };
    },
  };
  return client;
}

describe("chat-moderation-service — muteConversation", () => {
  it("sets muted_at when muted:true and the caller is a member", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.muteConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, muted: true });
    assert.deepEqual(result, { conversationId: CONV_ID, muted: true });
    assert.equal(prisma._executeRawCallCount, 1);
  });

  it("clears muted_at when muted:false", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.muteConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, muted: false });
    assert.deepEqual(result, { conversationId: CONV_ID, muted: false });
  });
});

describe("chat-moderation-service — block/unblock", () => {
  it("blockUser rejects blocking yourself", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId for caller
    ]);
    const service = createChatModerationService({ prisma });
    await assert.rejects(
      () => service.blockUser({ authUserId: AUTH_USER_ID, targetUserId: PROFILE_ID }),
      (err) => err instanceof ChatModerationServiceError && err.status === 400,
    );
  });

  it("blockUser inserts a chat_blocks row for a different user", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.blockUser({ authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID });
    assert.deepEqual(result, { blocked: true });
    assert.equal(prisma._executeRawCallCount, 1);
  });

  it("getBlockStatus reports both directions", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ blocker_user_id: PROFILE_ID, blocked_user_id: OTHER_PROFILE_ID }], // blockedByMe row exists
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.getBlockStatus({ authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID });
    assert.deepEqual(result, { blockedByMe: true, blockedByThem: false });
  });
});

describe("chat-moderation-service — getGroupsInCommon", () => {
  it("returns group/channel conversations shared by both users", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [{ id: CONV_ID, type: "group", title: "Proyecto X", avatar_url: null, avatar_emoji: null }],
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.getGroupsInCommon({ authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, CONV_ID);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js`
Expected: FAIL — `Cannot find module '../chat-moderation-service.js'`

- [ ] **Step 3: Create the service file (mute, block, groups-in-common only)**

Create `apps/api/src/routes/chat/chat-moderation-service.js`:

```js
import { resolveUserProfileId } from "./chat-service.js";

export class ChatModerationServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatModerationServiceError";
    this.status = status;
  }
}

export function createChatModerationService({ prisma }) {
  async function getUserProfileId(authUserId) {
    return resolveUserProfileId(prisma, authUserId);
  }

  async function muteConversation({ conversationId, authUserId, muted }) {
    const profileId = await getUserProfileId(authUserId);
    await prisma.$executeRaw`
      UPDATE chat_conversation_members
      SET muted_at = ${muted ? new Date() : null}
      WHERE conversation_id = ${conversationId} AND user_id = ${profileId} AND left_at IS NULL
    `;
    return { conversationId, muted };
  }

  async function blockUser({ authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    if (profileId.toString() === targetUserId) {
      throw new ChatModerationServiceError("No puedes bloquearte a ti mismo.", 400);
    }
    await prisma.$executeRaw`
      INSERT INTO chat_blocks (blocker_user_id, blocked_user_id)
      VALUES (${profileId}, ${targetUserId})
      ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING
    `;
    return { blocked: true };
  }

  async function unblockUser({ authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await prisma.$executeRaw`
      DELETE FROM chat_blocks WHERE blocker_user_id = ${profileId} AND blocked_user_id = ${targetUserId}
    `;
    return { blocked: false };
  }

  async function getBlockStatus({ authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    const rows = await prisma.$queryRaw`
      SELECT blocker_user_id, blocked_user_id FROM chat_blocks
      WHERE (blocker_user_id = ${profileId} AND blocked_user_id = ${targetUserId})
         OR (blocker_user_id = ${targetUserId} AND blocked_user_id = ${profileId})
    `;
    const blockedByMe = rows.some((r) => r.blocker_user_id.toString() === profileId.toString());
    const blockedByThem = rows.some((r) => r.blocker_user_id.toString() === targetUserId);
    return { blockedByMe, blockedByThem };
  }

  async function getGroupsInCommon({ authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    const rows = await prisma.$queryRaw`
      SELECT c.id, c.type, c.title, c.avatar_url, c.avatar_emoji
      FROM chat_conversations c
      WHERE c.type IN ('group', 'channel')
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM chat_conversation_members
          WHERE conversation_id = c.id AND user_id = ${profileId} AND left_at IS NULL
        )
        AND EXISTS (
          SELECT 1 FROM chat_conversation_members
          WHERE conversation_id = c.id AND user_id = ${targetUserId} AND left_at IS NULL
        )
      ORDER BY c.title ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      avatarUrl: r.avatar_url,
      avatarEmoji: r.avatar_emoji,
    }));
  }

  return {
    muteConversation,
    blockUser,
    unblockUser,
    getBlockStatus,
    getGroupsInCommon,
  };
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-moderation-service.js apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js
git commit -m "feat(chat): add mute/block/groups-in-common moderation service"
```

---

### Task 5: `chat-moderation-service.js` — reports (create, list, resolve)

**Files:**
- Modify: `apps/api/src/routes/chat/chat-moderation-service.js`
- Modify: `apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js`:

```js
describe("chat-moderation-service — reports", () => {
  it("createReport rejects reporting yourself", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
    ]);
    const service = createChatModerationService({ prisma });
    await assert.rejects(
      () => service.createReport({ authUserId: AUTH_USER_ID, reportedUserId: PROFILE_ID, reason: "spam" }),
      (err) => err instanceof ChatModerationServiceError && err.status === 400,
    );
  });

  it("createReport inserts a row and optionally blocks", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [{ id: "report-1", status: "open" }], // INSERT ... RETURNING
    ], [
      { count: 1 }, // block insert (alsoBlock: true)
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.createReport({
      authUserId: AUTH_USER_ID,
      reportedUserId: OTHER_PROFILE_ID,
      conversationId: CONV_ID,
      reason: "abuse",
      note: "Mensajes ofensivos",
      alsoBlock: true,
    });
    assert.deepEqual(result, { id: "report-1", status: "open" });
    assert.equal(prisma._executeRawCallCount, 1);
  });

  it("listReports returns rows with joined display names", async () => {
    const prisma = buildPrismaMock([
      [{
        id: "report-1",
        reporter_user_id: PROFILE_ID,
        reporter_display_name: "Ana",
        reported_user_id: OTHER_PROFILE_ID,
        reported_display_name: "Beto",
        conversation_id: CONV_ID,
        reason: "spam",
        note: null,
        status: "open",
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: new Date("2026-08-26T00:00:00Z"),
      }],
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.listReports({ status: "open" });
    assert.equal(result.length, 1);
    assert.equal(result[0].reporterDisplayName, "Ana");
    assert.equal(result[0].reportedDisplayName, "Beto");
  });

  it("resolveReport with action:dismiss updates status only", async () => {
    const prisma = buildPrismaMock([
      [{ id: "report-1", reported_user_id: OTHER_PROFILE_ID, status: "open" }], // fetch report
      [{ id: PROFILE_ID }], // resolveUserProfileId for reviewer
    ], [
      { count: 1 }, // UPDATE chat_reports
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.resolveReport({ reportId: "report-1", authUserId: AUTH_USER_ID, action: "dismiss" });
    assert.deepEqual(result, { id: "report-1", status: "dismissed" });
    assert.equal(prisma._executeRawCallCount, 1);
  });

  it("resolveReport with action:disable_user updates status AND disables the user", async () => {
    const prisma = buildPrismaMock([
      [{ id: "report-1", reported_user_id: OTHER_PROFILE_ID, status: "open" }], // fetch report
      [{ id: PROFILE_ID }], // resolveUserProfileId for reviewer
    ], [
      { count: 1 }, // UPDATE user_profile SET enabled = false
      { count: 1 }, // UPDATE chat_reports
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.resolveReport({ reportId: "report-1", authUserId: AUTH_USER_ID, action: "disable_user" });
    assert.deepEqual(result, { id: "report-1", status: "user_disabled" });
    assert.equal(prisma._executeRawCallCount, 2);
  });

  it("resolveReport rejects an already-resolved report", async () => {
    const prisma = buildPrismaMock([
      [{ id: "report-1", reported_user_id: OTHER_PROFILE_ID, status: "dismissed" }],
    ]);
    const service = createChatModerationService({ prisma });
    await assert.rejects(
      () => service.resolveReport({ reportId: "report-1", authUserId: AUTH_USER_ID, action: "dismiss" }),
      (err) => err instanceof ChatModerationServiceError && err.status === 400,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js`
Expected: FAIL — `createReport`/`listReports`/`resolveReport` are not functions.

- [ ] **Step 3: Add the report functions**

In `apps/api/src/routes/chat/chat-moderation-service.js`, add these functions inside `createChatModerationService`, above the final `return { ... }` statement:

```js
  async function createReport({ authUserId, reportedUserId, conversationId = null, reason, note = null, alsoBlock = false }) {
    const profileId = await getUserProfileId(authUserId);
    if (profileId.toString() === reportedUserId) {
      throw new ChatModerationServiceError("No puedes reportarte a ti mismo.", 400);
    }
    const rows = await prisma.$queryRaw`
      INSERT INTO chat_reports (reporter_user_id, reported_user_id, conversation_id, reason, note)
      VALUES (${profileId}, ${reportedUserId}, ${conversationId}, ${reason}, ${note})
      RETURNING id, status
    `;
    if (alsoBlock) {
      await prisma.$executeRaw`
        INSERT INTO chat_blocks (blocker_user_id, blocked_user_id)
        VALUES (${profileId}, ${reportedUserId})
        ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING
      `;
    }
    return { id: rows[0].id, status: rows[0].status };
  }

  async function listReports({ status = null }) {
    const statusClause = status ? Prisma.sql`WHERE r.status = ${status}` : Prisma.empty;
    const rows = await prisma.$queryRaw`
      SELECT
        r.id, r.reporter_user_id, reporter.display_name AS reporter_display_name,
        r.reported_user_id, reported.display_name AS reported_display_name,
        r.conversation_id, r.reason, r.note, r.status,
        r.reviewed_by_user_id, r.reviewed_at, r.created_at
      FROM chat_reports r
      LEFT JOIN user_profile reporter ON reporter.id = r.reporter_user_id
      LEFT JOIN user_profile reported ON reported.id = r.reported_user_id
      ${statusClause}
      ORDER BY r.created_at DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      reporterUserId: r.reporter_user_id,
      reporterDisplayName: r.reporter_display_name,
      reportedUserId: r.reported_user_id,
      reportedDisplayName: r.reported_display_name,
      conversationId: r.conversation_id,
      reason: r.reason,
      note: r.note,
      status: r.status,
      reviewedByUserId: r.reviewed_by_user_id,
      reviewedAt: r.reviewed_at,
      createdAt: r.created_at,
    }));
  }

  async function resolveReport({ reportId, authUserId, action }) {
    const reportRows = await prisma.$queryRaw`
      SELECT id, reported_user_id, status FROM chat_reports WHERE id = ${reportId} LIMIT 1
    `;
    if (!reportRows.length) throw new ChatModerationServiceError("Reporte no encontrado.", 404);
    if (reportRows[0].status !== "open") {
      throw new ChatModerationServiceError("Este reporte ya fue resuelto.", 400);
    }
    const reviewerProfileId = await getUserProfileId(authUserId);
    const newStatus = action === "disable_user" ? "user_disabled" : "dismissed";

    if (action === "disable_user") {
      await prisma.$executeRaw`
        UPDATE user_profile SET enabled = false WHERE id = ${reportRows[0].reported_user_id}
      `;
    }
    await prisma.$executeRaw`
      UPDATE chat_reports
      SET status = ${newStatus}, reviewed_by_user_id = ${reviewerProfileId}, reviewed_at = NOW()
      WHERE id = ${reportId}
    `;
    return { id: reportId, status: newStatus };
  }
```

Add the `Prisma` import at the top of the file (needed for `Prisma.sql`/`Prisma.empty` in `listReports`):

```js
import { Prisma } from "@prisma/client";
import { resolveUserProfileId } from "./chat-service.js";
```

Update the `return { ... }` statement at the bottom of `createChatModerationService` to include the three new functions:

```js
  return {
    muteConversation,
    blockUser,
    unblockUser,
    getBlockStatus,
    getGroupsInCommon,
    createReport,
    listReports,
    resolveReport,
  };
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-moderation-service.js apps/api/src/routes/chat/__tests__/chat-moderation-service.test.js
git commit -m "feat(chat): add report create/list/resolve to moderation service"
```

---

### Task 6: Block enforcement in `chat-service.js`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js:71` (near `assertMember`)
- Modify: `apps/api/src/routes/chat/chat-service.js:312` (`createConversation`)
- Modify: `apps/api/src/routes/chat/chat-service.js:805` (`sendMessage`)
- Modify: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/routes/chat/__tests__/chat-service.test.js`:

```js
describe("chat-service — block enforcement", () => {
  it("sendMessage rejects when the recipient has blocked the sender", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId (sender)
      [{ id: "member-row" }], // assertMember
      [{ type: "direct" }], // conversation type lookup for block check
      [{ user_id: OTHER_PROFILE_ID }], // other member lookup
      [{ blocker_user_id: OTHER_PROFILE_ID, blocked_user_id: PROFILE_ID }], // block row found
    ]);
    const service = createChatService({ prisma, supabaseAdmin: buildSupabaseAdminMock() });
    await assert.rejects(
      () => service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "hola" }),
      (err) => err instanceof ChatServiceError && err.status === 403,
    );
  });

  it("sendMessage proceeds normally in a group conversation (block check skipped)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [{ id: "member-row" }], // assertMember
      [{ type: "group" }], // conversation type lookup — not direct, block check short-circuits
      [], // mention scan etc. — no mentions in body, no further $queryRaw before the INSERT
      [{ id: "msg-1", conversation_id: CONV_ID, created_at: new Date(), body: "hola", sender_user_id: PROFILE_ID, sender_type: "user", message_type: "text", attachment_count: 0, metadata: {} }],
    ], [
      { count: 1 }, // updateConversationLastMessage
    ]);
    const service = createChatService({ prisma, supabaseAdmin: buildSupabaseAdminMock() });
    const result = await service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "hola" });
    assert.equal(result.id, "msg-1");
  });

  it("createConversation rejects starting a direct chat with someone who blocked you", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId (creator)
      [], // existing direct-conversation lookup — none found
      [{ blocker_user_id: OTHER_PROFILE_ID, blocked_user_id: PROFILE_ID }], // block row found
    ]);
    const service = createChatService({ prisma, supabaseAdmin: buildSupabaseAdminMock() });
    await assert.rejects(
      () => service.createConversation({ authUserId: AUTH_USER_ID, type: "direct", memberUserIds: [OTHER_PROFILE_ID] }),
      (err) => err instanceof ChatServiceError && err.status === 403,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: FAIL — the block scenarios currently succeed instead of throwing 403 (no block check exists yet), and/or the mock's `$queryRaw` sequence throws "Unexpected call" because the real code doesn't consume those extra mocked rows yet. Either failure mode confirms the check is missing.

- [ ] **Step 3: Add the `assertNotBlocked` helper**

In `apps/api/src/routes/chat/chat-service.js`, add this function directly after `assertMember` (after line 82, the closing `}` of `assertMember`):

```js
  // Only direct conversations can be blocked (spec Non-goal 2 — a block never
  // affects shared groups/channels). Checks both directions: either party
  // blocking the other stops messages both ways.
  async function assertNotBlocked(conversationId, profileId) {
    const [convRow] = await prisma.$queryRaw`
      SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1
    `;
    if (convRow?.type !== "direct") return;

    const [otherRow] = await prisma.$queryRaw`
      SELECT user_id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId} AND user_id != ${profileId} AND user_id IS NOT NULL AND left_at IS NULL
      LIMIT 1
    `;
    if (!otherRow) return;

    const blocks = await prisma.$queryRaw`
      SELECT blocker_user_id, blocked_user_id FROM chat_blocks
      WHERE (blocker_user_id = ${profileId} AND blocked_user_id = ${otherRow.user_id})
         OR (blocker_user_id = ${otherRow.user_id} AND blocked_user_id = ${profileId})
      LIMIT 1
    `;
    if (blocks.length) {
      throw new ChatServiceError("No puedes enviar mensajes a este usuario.", 403);
    }
  }

  async function assertNotBlockedByTarget(profileId, targetUserId) {
    const blocks = await prisma.$queryRaw`
      SELECT blocker_user_id, blocked_user_id FROM chat_blocks
      WHERE (blocker_user_id = ${profileId} AND blocked_user_id = ${targetUserId})
         OR (blocker_user_id = ${targetUserId} AND blocked_user_id = ${profileId})
      LIMIT 1
    `;
    if (blocks.length) {
      throw new ChatServiceError("No puedes iniciar una conversacion con este usuario.", 403);
    }
  }
```

- [ ] **Step 4: Call `assertNotBlocked` from `sendMessage`**

In `sendMessage` (around line 807), change:

```js
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);
```

to:

```js
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);
    await assertNotBlocked(conversationId, profileId);
```

- [ ] **Step 5: Call `assertNotBlockedByTarget` from `createConversation`**

In `createConversation` (around line 320-338), the "For direct conversations, enforce uniqueness" block currently reads:

```js
    // For direct conversations, enforce uniqueness (find existing)
    if (type === "direct" && memberUserIds.length === 1) {
      const otherId = memberUserIds[0];
      const existing = await prisma.$queryRaw`
```

Change it to check blocks first, before the uniqueness lookup:

```js
    // For direct conversations, enforce uniqueness (find existing)
    if (type === "direct" && memberUserIds.length === 1) {
      const otherId = memberUserIds[0];
      await assertNotBlockedByTarget(creatorProfileId, otherId);
      const existing = await prisma.$queryRaw`
```

- [ ] **Step 6: Run the tests again to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS — all tests in the file green, including the 3 new block-enforcement tests.

- [ ] **Step 7: Run the full chat test suite**

Run: `node --test apps/api/src/routes/chat/__tests__/`
Expected: All test files pass (no regressions in `chat-permissions-service.test.js`, `chat-reactions-service.test.js`, etc. — none of them call `sendMessage`/`createConversation`, so this is a safety check, not expected to catch anything new).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): enforce blocks on sendMessage and direct conversation creation"
```

---

### Task 7: Expose `is_muted` on `listConversations`

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js:248` (`listConversations`)
- Modify: `apps/api/src/routes/chat/__tests__/chat-service.test.js`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/routes/chat/__tests__/chat-service.test.js`:

```js
describe("chat-service — listConversations exposes is_muted", () => {
  it("passes through ccm.muted_at IS NOT NULL as is_muted on each row", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [{
        id: CONV_ID, type: "direct", title: null, avatar_url: null, avatar_file_id: null,
        avatar_emoji: null, status: "active", last_message_at: new Date(), last_message_id: null,
        website_id: null, company_id: null, metadata: {}, created_at: new Date(),
        unread_count: 0, last_message: null, members: [], is_archived: false, is_muted: true,
      }],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: buildSupabaseAdminMock() });
    const result = await service.listConversations({ authUserId: AUTH_USER_ID });
    assert.equal(result.data[0].is_muted, true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: The mocked row already includes `is_muted: true` (mocks don't execute real SQL), so this specific test will actually pass immediately since it only checks pass-through — this is expected: the test proves the service doesn't strip the field, not that the SQL produces it. Confirm it passes as a baseline, then proceed to Step 3 to make the real SQL produce that field.

- [ ] **Step 3: Add `muted_at` to the SELECT**

In `listConversations`, find this line (around line 248):

```js
        ccm.archived_at IS NOT NULL AS is_archived
```

Change it to:

```js
        ccm.archived_at IS NOT NULL AS is_archived,
        ccm.muted_at IS NOT NULL AS is_muted
```

- [ ] **Step 4: Run the full chat-service test file**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-service.test.js`
Expected: PASS — no regressions (the mock-based tests don't execute real SQL, so this step is validated by the manual check in Task 9's verification plan against the live database instead).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js apps/api/src/routes/chat/__tests__/chat-service.test.js
git commit -m "feat(chat): expose is_muted on listConversations rows"
```

---

### Task 8: Wire routes into `apps/api/src/routes/chat/index.js`

**Files:**
- Modify: `apps/api/src/routes/chat/index.js`

- [ ] **Step 1: Import the new service and schemas**

At the top of `apps/api/src/routes/chat/index.js`, add `chatMuteConversationSchema`, `chatCreateReportSchema`, `chatResolveReportSchema` to the existing `@atlas/validators` import block, and add a new import line:

```js
import {
  chatCreateConversationSchema,
  chatSendMessageSchema,
  chatEditMessageSchema,
  chatUpdateConversationSchema,
  chatAddMembersSchema,
  chatPresignAttachmentSchema,
  chatGuestSessionSchema,
  chatGuestMessageSchema,
  chatAssignOperatorSchema,
  chatCreateChannelSchema,
  chatCreateChannelRoleSchema,
  chatUpdateChannelRoleSchema,
  chatAssignMemberRoleSchema,
  chatPinMessageSchema,
  chatToggleReactionSchema,
  chatMuteConversationSchema,
  chatCreateReportSchema,
  chatResolveReportSchema,
} from "@atlas/validators";
import { createChatService, ChatServiceError } from "./chat-service.js";
import { createChatModerationService, ChatModerationServiceError } from "./chat-moderation-service.js";
```

- [ ] **Step 2: Register the error class and instantiate the service**

In `handleError`, add `ChatModerationServiceError` to the `instanceof` check:

```js
function handleError(c, err, fallback) {
  if (err instanceof ChatServiceError || err instanceof GuestChatServiceError || err instanceof ChatPermissionsError || err instanceof ChatReactionsError || err instanceof ChatModerationServiceError) {
    return c.json({ error: err.message }, err.status);
  }
```

Inside `createChatRouter`, after the existing `const reactionsService = createChatReactionsService({ prisma });` line, add:

```js
  const moderationService = createChatModerationService({ prisma });
```

- [ ] **Step 3: Add the new routes**

Add these routes to the `internal` router, right after the existing `POST /chat/conversations/:id/read` route (around line 300, before the `CHANNELS & ROLES` section comment):

```js
  // PATCH /chat/conversations/:id/mute
  internal.patch("/conversations/:id/mute", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const body = await c.req.json();
      const { muted } = chatMuteConversationSchema.parse(body);
      const result = await moderationService.muteConversation({ conversationId, authUserId, muted });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error actualizando notificaciones.");
    }
  });

  // GET /chat/users/:userId/block-status
  internal.get("/users/:userId/block-status", requirePermission("chat.access"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const targetUserId = c.req.param("userId");
      const result = await moderationService.getBlockStatus({ authUserId, targetUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error obteniendo estado de bloqueo.");
    }
  });

  // POST /chat/users/:userId/block
  internal.post("/users/:userId/block", requirePermission("chat.access"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const targetUserId = c.req.param("userId");
      const result = await moderationService.blockUser({ authUserId, targetUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error bloqueando usuario.");
    }
  });

  // DELETE /chat/users/:userId/block
  internal.delete("/users/:userId/block", requirePermission("chat.access"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const targetUserId = c.req.param("userId");
      const result = await moderationService.unblockUser({ authUserId, targetUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error desbloqueando usuario.");
    }
  });

  // GET /chat/users/:userId/groups-in-common
  internal.get("/users/:userId/groups-in-common", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const targetUserId = c.req.param("userId");
      const result = await moderationService.getGroupsInCommon({ authUserId, targetUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error obteniendo grupos en comun.");
    }
  });

  // POST /chat/reports
  internal.post("/reports", requirePermission("chat.access"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json();
      const data = chatCreateReportSchema.parse(body);
      const result = await moderationService.createReport({ authUserId, ...data });
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error creando reporte.");
    }
  });

  // GET /chat/reports
  internal.get("/reports", requirePermission("identity.chat_reports.read"), async (c) => {
    try {
      const { status } = c.req.query();
      const result = await moderationService.listReports({ status: status || null });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error listando reportes.");
    }
  });

  // PATCH /chat/reports/:id/resolve
  internal.patch("/reports/:id/resolve", requirePermission("identity.chat_reports.manage"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const reportId = c.req.param("id");
      const body = await c.req.json();
      const { action } = chatResolveReportSchema.parse(body);
      const result = await moderationService.resolveReport({ reportId, authUserId, action });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error resolviendo reporte.");
    }
  });
```

- [ ] **Step 4: Verify the file is syntactically valid**

Run: `node --check apps/api/src/routes/chat/index.js`
Expected: No output (success).

- [ ] **Step 5: Start the API and smoke-test one route**

Run: `pnpm dev:api` (in a background terminal, or confirm it's already running — check for a process on port 4010)

Once running, from another terminal (replace `$ATLAS_TOKEN` with a real token obtained via the app's normal login flow — never paste a real token into this file):

```bash
curl -s -X GET "http://localhost:4010/chat/users/00000000-0000-0000-0000-000000000000/block-status" \
  -H "Authorization: Bearer $ATLAS_TOKEN"
```

Expected: `{"data":{"blockedByMe":false,"blockedByThem":false}}` (or a 403/404 if the target id doesn't correspond to a real profile — either response confirms the route is wired and reaching the service, not a 404 "route not found" from Hono itself).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/index.js
git commit -m "feat(chat): wire mute/block/groups-in-common/reports routes"
```

---

### Task 9: SDK — `packages/sdk/src/domains/chat.js`

**Files:**
- Modify: `packages/sdk/src/domains/chat.js`

- [ ] **Step 1: Read the existing file to match its exact request/header helper calls**

Open `packages/sdk/src/domains/chat.js` and find the `archiveConversation`/`unarchiveConversation` methods (near the top, per earlier investigation) to copy their exact `request(...)`/`withAuthHeaders(...)` call shape — this plan does not repeat that boilerplate since it must match whatever the file already does verbatim, not a guessed shape.

- [ ] **Step 2: Add the new methods**

Add these methods to the object returned by `createChatDomain`, following the same pattern as `archiveConversation`/`unarchiveConversation`:

```js
    muteConversation: (conversationId, muted, token) =>
      request(`/chat/conversations/${conversationId}/mute`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ muted }),
      }),

    getBlockStatus: (userId, token) =>
      request(`/chat/users/${userId}/block-status`, {
        headers: withAuthHeaders(token),
      }),

    blockUser: (userId, token) =>
      request(`/chat/users/${userId}/block`, {
        method: "POST",
        headers: withAuthHeaders(token),
      }),

    unblockUser: (userId, token) =>
      request(`/chat/users/${userId}/block`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),

    getGroupsInCommon: (userId, token) =>
      request(`/chat/users/${userId}/groups-in-common`, {
        headers: withAuthHeaders(token),
      }),

    createReport: (payload, token) =>
      request(`/chat/reports`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    listReports: (query, token) =>
      request(`/chat/reports${toQueryString(query)}`, {
        headers: withAuthHeaders(token),
      }),

    resolveReport: (reportId, action, token) =>
      request(`/chat/reports/${reportId}/resolve`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ action }),
      }),
```

**Important:** before pasting these in, check the exact call signature `archiveConversation`/`unarchiveConversation` actually use in the file (method casing, whether `request` takes headers as a second positional arg vs. an options object, whether POST/DELETE bodies are omitted when empty, etc.) and adjust the snippet above to match exactly — do not introduce a second inconsistent calling convention into this file.

- [ ] **Step 3: Verify the file is syntactically valid**

Run: `node --check packages/sdk/src/domains/chat.js`
Expected: No output (success).

- [ ] **Step 4: Build the SDK package**

Run: `pnpm --filter @atlas/sdk build` (or `pnpm build` if the SDK package has no standalone build script — check `packages/sdk/package.json` first)
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/domains/chat.js
git commit -m "feat(sdk): add mute/block/groups-in-common/report methods to chat domain"
```

---

## Plan A Self-Review Notes

- **Spec coverage:** Sections 10-16 (data model, Prisma impact, API contract, SDK contract, validator contract, module manifest, navigation) are fully covered by Tasks 1-9. Section 22 (audit log) is intentionally NOT included as a task — confirmed via grep that no route in `apps/api/src/routes/chat/` or `apps/api/src/routes/users-routes.js` writes to `AuditLog` today, so the spec was corrected to mark this N/A (deferred to Future Enhancements as a module-wide gap) rather than fabricate a call to a nonexistent mechanism.
- **Task 6 risk:** `sendMessage`'s existing `$queryRaw` call sequence is order-dependent in the test mocks (`buildPrismaMock` consumes results by call order). If a future change reorders `sendMessage`'s internal calls, these tests will fail with confusing "Unexpected call" errors rather than a clear assertion failure — this is a pre-existing pattern in this test file, not something this plan introduces.
- **Verification gap:** Tasks 4-7's tests all use mocked Prisma clients, so they prove the service logic is correct given a certain SQL result shape, but do NOT prove the raw SQL itself is valid Postgres. Task 1's migration must be applied (Step 2) against the real Supabase instance before Plan B can be tested end-to-end, and a manual smoke test (Task 8, Step 5) is the only step in this plan that exercises real SQL.

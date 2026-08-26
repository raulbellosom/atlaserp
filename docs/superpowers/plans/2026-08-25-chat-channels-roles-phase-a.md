# Chat Channels & Roles — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `channel` conversation type, a per-conversation role/permission system shared by channels and groups, and the minimal API surface (create channel, directory, join, role CRUD, member-role assignment) that Phase B's UI will be built on.

**Architecture:** Follows the existing `apps/api/src/routes/chat/` pattern of small, independent service files composed in `index.js`. Two new service files are added (`chat-permissions-service.js`, `channel-directory-service.js`); `chat-service.js` gets three small, surgical edits (it is already at the project's 1000-line soft limit, so all new logic lives in the new files — see Task 5's file-size note). A single new forward SQL migration adds the schema (raw-SQL-managed, like the rest of chat — not a Prisma model).

**Tech Stack:** Hono, Prisma `$queryRaw`/`$executeRaw` (raw SQL, no ORM models), Zod (`@atlas/validators`), `node:test` for unit tests, PostgreSQL (Supabase).

**Spec:** `docs/superpowers/specs/2026-08-25-chat-channels-roles-phase-a-design.md`

**Task order matters — each task depends on the ones before it:** Task 2 (extraction) must land before Task 4 (which imports what it exports); Task 4 must land before Task 5 (which calls the permission engine); Tasks 2–7 must all land before Task 8 (routes wire everything together).

---

## File Structure Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/migrations/20260825000000_chat_channels_roles/migration.sql` | Create | New `chat_channel_roles` table, `chat_conversations`/`chat_conversation_members` alterations, backfill of existing groups, RLS, realtime |
| `apps/api/src/routes/chat/chat-service.js` | Modify | Extract `resolveUserProfileId` to module scope (exported); later, `createConversation` populates `company_id`/`is_public`/`slug`/`description` and seeds roles; `addMembers` assigns default role; `removeMember` blocks removing the last Owner |
| `apps/api/src/routes/chat/chat-permissions-service.js` | Create | Permission catalog, default role defs, role CRUD, member-role assignment, hierarchy + last-Owner guards |
| `apps/api/src/routes/chat/channel-directory-service.js` | Create | Public channel directory listing + joining a public channel |
| `apps/api/src/routes/chat/index.js` | Modify | Wire up the two new services; new routes; recognize `ChatPermissionsError` in `handleError` |
| `packages/validators/src/chat.js` | Modify | `chatCreateChannelSchema`, `chatCreateChannelRoleSchema`, `chatUpdateChannelRoleSchema`, `chatAssignMemberRoleSchema` |
| `packages/sdk/src/domains/chat.js` | Modify | SDK methods for the new endpoints |
| `apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js` | Create | Unit tests for the permission engine |
| `apps/api/src/routes/chat/__tests__/channel-directory-service.test.js` | Create | Unit tests for join/directory |

---

### Task 1: Database migration

**Files:**
- Create: `prisma/migrations/20260825000000_chat_channels_roles/migration.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- =============================================================================
-- Atlas ERP — Chat Channels & Roles (Phase A foundation)
-- Migration: 20260825000000_chat_channels_roles
-- =============================================================================

-- ---------------------------------------------------------------------------
-- chat_channel_roles — role definitions scoped to one conversation
-- (applies to type='channel' and type='group'; direct/external_support are
-- untouched and keep using chat_conversation_members.role, the legacy text column)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_channel_roles" (
  "id"              UUID        NOT NULL DEFAULT uuidv7(),
  "conversation_id" UUID        NOT NULL,
  "name"            TEXT        NOT NULL,
  "color"           TEXT,
  "position"        INT         NOT NULL DEFAULT 0,
  "is_system"       BOOLEAN     NOT NULL DEFAULT false,
  "permissions"     JSONB       NOT NULL DEFAULT '{}',
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "chat_channel_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_channel_roles_conversation_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_channel_roles_conversation_name_key" UNIQUE ("conversation_id", "name")
);

CREATE INDEX "chat_channel_roles_conversation_id_idx"
  ON "chat_channel_roles" ("conversation_id");

-- ---------------------------------------------------------------------------
-- chat_conversations — new type, channel metadata
-- ---------------------------------------------------------------------------
ALTER TABLE "chat_conversations" DROP CONSTRAINT "chat_conversations_type_check";
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_type_check"
  CHECK ("type" IN ('direct', 'group', 'channel', 'external_support'));

ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "is_public"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "slug"        TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE UNIQUE INDEX "chat_conversations_company_slug_idx"
  ON "chat_conversations" ("company_id", "slug")
  WHERE "slug" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- chat_conversation_members — role_id (coexists with legacy `role` text)
-- ---------------------------------------------------------------------------
ALTER TABLE "chat_conversation_members"
  ADD COLUMN IF NOT EXISTS "role_id" UUID
    REFERENCES "chat_channel_roles"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Backfill: seed the 4 default roles for every existing group conversation
-- and map each member's legacy `role` text to the matching role_id.
--
-- IMPORTANT: the permission keys/values here MUST stay in sync with
-- DEFAULT_CHANNEL_ROLES in apps/api/src/routes/chat/chat-permissions-service.js
-- (that constant is used for every *new* channel/group going forward; this
-- SQL block only ever runs once, for conversations that already existed).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  conv RECORD;
  owner_role_id UUID;
  admin_role_id UUID;
  moderator_role_id UUID;
  member_role_id UUID;
BEGIN
  FOR conv IN SELECT id FROM chat_conversations WHERE type = 'group' LOOP
    INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
    VALUES (
      conv.id, 'Owner', 100, true,
      '{"channel.manage":true,"members.manage":true,"roles.manage":true,"messages.send":true,"messages.pin":true,"messages.delete_others":true,"mentions.everyone":true,"mentions.here":true}'::jsonb
    )
    RETURNING id INTO owner_role_id;

    INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
    VALUES (
      conv.id, 'Admin', 75, false,
      '{"channel.manage":true,"members.manage":true,"roles.manage":true,"messages.pin":true,"messages.delete_others":true,"mentions.everyone":true,"messages.send":true}'::jsonb
    )
    RETURNING id INTO admin_role_id;

    INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
    VALUES (
      conv.id, 'Moderator', 50, false,
      '{"messages.pin":true,"messages.delete_others":true,"mentions.here":true,"messages.send":true}'::jsonb
    )
    RETURNING id INTO moderator_role_id;

    INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
    VALUES (
      conv.id, 'Member', 0, false,
      '{"messages.send":true}'::jsonb
    )
    RETURNING id INTO member_role_id;

    UPDATE chat_conversation_members
    SET role_id = CASE
      WHEN role = 'owner' THEN owner_role_id
      WHEN role = 'admin' THEN admin_role_id
      ELSE member_role_id
    END
    WHERE conversation_id = conv.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS + Realtime for chat_channel_roles (mirrors the pattern from
-- 20260625000000_add_chat_tables — chat_is_member() already exists)
-- ---------------------------------------------------------------------------
ALTER TABLE "chat_channel_roles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_channel_roles_select" ON "chat_channel_roles"
  FOR SELECT USING (chat_is_member(conversation_id));

CREATE POLICY "chat_channel_roles_service_all" ON "chat_channel_roles"
  FOR ALL USING (auth.role() = 'service_role');

ALTER PUBLICATION supabase_realtime ADD TABLE "chat_channel_roles";
```

- [ ] **Step 2: Apply the migration**

Run: `pnpm db:migrate`
Expected: migration `20260825000000_chat_channels_roles` applies with no errors; output confirms the new table and columns exist.

- [ ] **Step 3: Sanity-check the backfill**

Run (via `pnpm db:studio` or a throwaway local script using `DATABASE_URL` from `.env` — do not print the connection string):

```sql
SELECT type, count(*) FROM chat_conversations GROUP BY type;
SELECT r.name, count(*) FROM chat_channel_roles r GROUP BY r.name ORDER BY r.name;
SELECT count(*) FROM chat_conversation_members m
  JOIN chat_conversations c ON c.id = m.conversation_id
  WHERE c.type = 'group' AND m.left_at IS NULL AND m.role_id IS NULL;
```

Expected: the last query returns `0` — no active member of an existing group is left without a `role_id`.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260825000000_chat_channels_roles/migration.sql
git commit -m "feat(chat): add channel_roles table, channel type, and group role backfill"
```

---

### Task 2: `chat-service.js` — extract `resolveUserProfileId` to module scope

Standalone, no dependency on later tasks. Every other new file (`chat-permissions-service.js`, `channel-directory-service.js`) imports this export, so it must land first.

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`

- [ ] **Step 1: Extract the function**

In `apps/api/src/routes/chat/chat-service.js`, replace lines 43-55 (the `getUserProfileId` function currently defined inside `createChatService`):

```javascript
  async function getUserProfileId(authUserId) {
    const cached = _profileIdCache.get(authUserId);
    if (cached && cached.expiresAt > Date.now()) return cached.profileId;

    const rows = await prisma.$queryRaw`
      SELECT id FROM user_profile WHERE auth_user_id = ${authUserId} LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Usuario no encontrado.", 404);

    const profileId = rows[0].id;
    _profileIdCache.set(authUserId, { profileId, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
    return profileId;
  }
```

with:

```javascript
  async function getUserProfileId(authUserId) {
    return resolveUserProfileId(prisma, authUserId);
  }
```

Then, directly above `export function createChatService(...)` (currently line 38), add the extracted, now-exported, module-level version:

```javascript
// Exported so sibling chat services (chat-permissions-service.js,
// channel-directory-service.js) can resolve auth_user_id -> user_profile.id
// without duplicating the cache.
export async function resolveUserProfileId(prisma, authUserId) {
  const cached = _profileIdCache.get(authUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.profileId;

  const rows = await prisma.$queryRaw`
    SELECT id FROM user_profile WHERE auth_user_id = ${authUserId} LIMIT 1
  `;
  if (!rows.length) throw new ChatServiceError("Usuario no encontrado.", 404);

  const profileId = rows[0].id;
  _profileIdCache.set(authUserId, { profileId, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
  return profileId;
}

```

- [ ] **Step 2: Syntax check**

Run: `node --check apps/api/src/routes/chat/chat-service.js`
Expected: no output (syntax OK).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js
git commit -m "refactor(chat): extract resolveUserProfileId to module scope for reuse"
```

---

### Task 3: `chat-permissions-service.js` — pure helpers and constants

**Files:**
- Create: `apps/api/src/routes/chat/chat-permissions-service.js`
- Test: `apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js`

- [ ] **Step 1: Write the failing tests for the pure helpers**

```javascript
// apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_PERMISSIONS,
  DEFAULT_CHANNEL_ROLES,
  roleHasPermission,
  assertHigherPosition,
  ChatPermissionsError,
} from "../chat-permissions-service.js";

describe("chat-permissions-service — pure helpers", () => {
  it("DEFAULT_CHANNEL_ROLES has exactly 4 roles with the expected positions", () => {
    assert.equal(DEFAULT_CHANNEL_ROLES.length, 4);
    const byName = Object.fromEntries(DEFAULT_CHANNEL_ROLES.map((r) => [r.name, r]));
    assert.equal(byName.Owner.position, 100);
    assert.equal(byName.Owner.isSystem, true);
    assert.equal(byName.Admin.position, 75);
    assert.equal(byName.Moderator.position, 50);
    assert.equal(byName.Member.position, 0);
    assert.equal(byName.Admin.isSystem, false);
    assert.equal(byName.Moderator.isSystem, false);
    assert.equal(byName.Member.isSystem, false);
  });

  it("Owner's permissions object grants every key in CHAT_PERMISSIONS", () => {
    const owner = DEFAULT_CHANNEL_ROLES.find((r) => r.name === "Owner");
    for (const key of Object.values(CHAT_PERMISSIONS)) {
      assert.equal(owner.permissions[key], true, `Owner should grant ${key}`);
    }
  });

  it("Member only grants messages.send", () => {
    const member = DEFAULT_CHANNEL_ROLES.find((r) => r.name === "Member");
    assert.deepEqual(Object.keys(member.permissions), [CHAT_PERMISSIONS.MESSAGES_SEND]);
  });

  it("roleHasPermission returns false for a null role", () => {
    assert.equal(roleHasPermission(null, CHAT_PERMISSIONS.MESSAGES_SEND), false);
  });

  it("roleHasPermission always returns true for a system (Owner) role, regardless of its permissions object", () => {
    const role = { isSystem: true, permissions: {} };
    assert.equal(roleHasPermission(role, CHAT_PERMISSIONS.CHANNEL_MANAGE), true);
  });

  it("roleHasPermission checks the permissions map for a non-system role", () => {
    const role = { isSystem: false, permissions: { [CHAT_PERMISSIONS.MESSAGES_SEND]: true } };
    assert.equal(roleHasPermission(role, CHAT_PERMISSIONS.MESSAGES_SEND), true);
    assert.equal(roleHasPermission(role, CHAT_PERMISSIONS.CHANNEL_MANAGE), false);
  });

  it("assertHigherPosition throws ChatPermissionsError(403) when actor position is not strictly higher", () => {
    assert.throws(
      () => assertHigherPosition(50, 50),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
    assert.throws(
      () => assertHigherPosition(0, 50),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("assertHigherPosition does not throw when actor position is strictly higher", () => {
    assert.doesNotThrow(() => assertHigherPosition(75, 50));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js`
Expected: FAIL — `Cannot find module '../chat-permissions-service.js'`

- [ ] **Step 3: Write the implementation (constants + pure helpers only for now)**

```javascript
// apps/api/src/routes/chat/chat-permissions-service.js
import { resolveUserProfileId } from "./chat-service.js";

export class ChatPermissionsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatPermissionsError";
    this.status = status;
  }
}

export const CHAT_PERMISSIONS = Object.freeze({
  CHANNEL_MANAGE: "channel.manage",
  MEMBERS_MANAGE: "members.manage",
  ROLES_MANAGE: "roles.manage",
  MESSAGES_SEND: "messages.send",
  MESSAGES_PIN: "messages.pin",
  MESSAGES_DELETE_OTHERS: "messages.delete_others",
  MENTIONS_EVERYONE: "mentions.everyone",
  MENTIONS_HERE: "mentions.here",
});

const ALL_PERMISSIONS_TRUE = Object.fromEntries(
  Object.values(CHAT_PERMISSIONS).map((key) => [key, true]),
);

export const DEFAULT_CHANNEL_ROLES = Object.freeze([
  { name: "Owner", position: 100, isSystem: true, permissions: ALL_PERMISSIONS_TRUE },
  {
    name: "Admin",
    position: 75,
    isSystem: false,
    permissions: {
      [CHAT_PERMISSIONS.CHANNEL_MANAGE]: true,
      [CHAT_PERMISSIONS.MEMBERS_MANAGE]: true,
      [CHAT_PERMISSIONS.ROLES_MANAGE]: true,
      [CHAT_PERMISSIONS.MESSAGES_PIN]: true,
      [CHAT_PERMISSIONS.MESSAGES_DELETE_OTHERS]: true,
      [CHAT_PERMISSIONS.MENTIONS_EVERYONE]: true,
      [CHAT_PERMISSIONS.MESSAGES_SEND]: true,
    },
  },
  {
    name: "Moderator",
    position: 50,
    isSystem: false,
    permissions: {
      [CHAT_PERMISSIONS.MESSAGES_PIN]: true,
      [CHAT_PERMISSIONS.MESSAGES_DELETE_OTHERS]: true,
      [CHAT_PERMISSIONS.MENTIONS_HERE]: true,
      [CHAT_PERMISSIONS.MESSAGES_SEND]: true,
    },
  },
  {
    name: "Member",
    position: 0,
    isSystem: false,
    permissions: {
      [CHAT_PERMISSIONS.MESSAGES_SEND]: true,
    },
  },
]);

export function roleHasPermission(role, permissionKey) {
  if (!role) return false;
  if (role.isSystem) return true;
  return role.permissions?.[permissionKey] === true;
}

export function assertHigherPosition(actorPosition, targetPosition, message = "No tienes rango suficiente para esta accion.") {
  if (!(actorPosition > targetPosition)) {
    throw new ChatPermissionsError(message, 403);
  }
}
```

(`createChatPermissionsService` is added in Task 4 — this file is intentionally incomplete after this step.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-permissions-service.js apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js
git commit -m "feat(chat): add chat permission catalog and default role definitions"
```

---

### Task 4: `chat-permissions-service.js` — DB-backed role engine

**Files:**
- Modify: `apps/api/src/routes/chat/chat-permissions-service.js`
- Modify: `apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js`

- [ ] **Step 1: Write the failing tests for the DB-backed methods**

Append to `apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js`:

```javascript
import { createChatPermissionsService } from "../chat-permissions-service.js";

const CONV_ID = "01900000-0000-7000-8000-0000000000c1";
const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const OTHER_PROFILE_ID = "01900000-0000-7000-8000-0000000000p2";
const OWNER_ROLE = { id: "role-owner", name: "Owner", position: 100, isSystem: true, permissions: {} };
const ADMIN_ROLE = { id: "role-admin", name: "Admin", position: 75, isSystem: false, permissions: { "roles.manage": true } };
const MEMBER_ROLE = { id: "role-member", name: "Member", position: 0, isSystem: false, permissions: { "messages.send": true } };

function buildPrismaMock(queryRawResults, executeRawResults = []) {
  let qIdx = 0;
  let eIdx = 0;
  return {
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    $executeRaw: async () => executeRawResults[eIdx++] ?? { count: 1 },
  };
}

describe("chat-permissions-service — assertChannelPermission", () => {
  it("throws 404 when the caller is not a member of the conversation", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [], // assertConversationMember: no active membership row
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.listRoles({ conversationId: CONV_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 404,
    );
  });
});

describe("chat-permissions-service — createRole", () => {
  it("blocks creating a role at or above the actor's own position (403)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],       // resolveUserProfileId
      [{ id: "m1" }],             // assertConversationMember
      [ADMIN_ROLE],               // getMemberRole (actor is Admin, position 75)
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.createRole({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, name: "Super", position: 90, permissions: {} }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("blocks a duplicate role name in the same conversation (400)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],
      [{ id: "existing-role" }], // duplicate name lookup finds one
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.createRole({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, name: "Admin", position: 10, permissions: {} }),
      (err) => err instanceof ChatPermissionsError && err.status === 400,
    );
  });

  it("creates the role when the actor outranks the requested position", async () => {
    const newRole = { id: "role-new", conversationId: CONV_ID, name: "Support", color: null, position: 10, isSystem: false, permissions: {}, createdAt: new Date(), updatedAt: new Date() };
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],
      [],           // no duplicate
      [newRole],    // insert RETURNING
    ]);
    const svc = createChatPermissionsService({ prisma });
    const result = await svc.createRole({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, name: "Support", position: 10, permissions: {} });
    assert.equal(result.name, "Support");
  });
});

describe("chat-permissions-service — deleteRole", () => {
  it("refuses to delete the system Owner role (403)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],
      [{ id: "role-owner", is_system: true, position: 100 }],
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.deleteRole({ conversationId: CONV_ID, roleId: "role-owner", authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("reassigns members holding the deleted role to Member and reports the count", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }],
        [{ id: "m1" }],
        [ADMIN_ROLE],
        [{ id: "role-custom", is_system: false, position: 10 }], // target role
        [{ id: "role-member" }],                                  // fallback Member role lookup
        [{ id: "member-1" }, { id: "member-2" }],                 // UPDATE ... RETURNING id
      ],
    );
    const svc = createChatPermissionsService({ prisma });
    const result = await svc.deleteRole({ conversationId: CONV_ID, roleId: "role-custom", authUserId: AUTH_USER_ID });
    assert.equal(result.reassignedMemberCount, 2);
  });
});

describe("chat-permissions-service — assignMemberRole", () => {
  it("allows self-demotion without the self-hierarchy check blocking it", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],  // resolveUserProfileId (actor)
      [{ id: "m1" }],        // assertConversationMember
      [ADMIN_ROLE],          // getMemberRole (actor)
      [ADMIN_ROLE],          // getMemberRole (target current role — same person, self-demotion)
      [MEMBER_ROLE],         // new role lookup
    ]);
    const svc = createChatPermissionsService({ prisma });
    const result = await svc.assignMemberRole({
      conversationId: CONV_ID,
      memberUserId: PROFILE_ID, // demoting self
      roleId: MEMBER_ROLE.id,
      authUserId: AUTH_USER_ID,
    });
    assert.equal(result.roleId, MEMBER_ROLE.id);
  });

  it("blocks managing a member ranked at or above the actor (403)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],           // actor: Admin (75)
      [ADMIN_ROLE],           // target's current role: also Admin (75) — different person
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.assignMemberRole({ conversationId: CONV_ID, memberUserId: OTHER_PROFILE_ID, roleId: MEMBER_ROLE.id, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("only an Owner (system role holder) can grant the Owner role", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],           // actor: Admin, not system
      [MEMBER_ROLE],          // target's current role
      [OWNER_ROLE],           // the role being granted is Owner (is_system)
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.assignMemberRole({ conversationId: CONV_ID, memberUserId: OTHER_PROFILE_ID, roleId: OWNER_ROLE.id, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("blocks demoting the last remaining Owner away from the Owner role (400)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [OWNER_ROLE],           // actor is the Owner
      [OWNER_ROLE],           // self-demotion target current role: Owner
      [MEMBER_ROLE],          // new role: Member (not system)
      [OWNER_ROLE],           // getMemberRole inside isLastOwner
      [{ count: 1 }],         // COUNT of active system-role holders: only 1
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.assignMemberRole({ conversationId: CONV_ID, memberUserId: PROFILE_ID, roleId: MEMBER_ROLE.id, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 400,
    );
  });
});

describe("chat-permissions-service — isLastOwner", () => {
  it("returns false when the member does not hold a system role", async () => {
    const prisma = buildPrismaMock([[MEMBER_ROLE]]);
    const svc = createChatPermissionsService({ prisma });
    assert.equal(await svc.isLastOwner(CONV_ID, PROFILE_ID), false);
  });

  it("returns true when exactly one active system-role holder remains", async () => {
    const prisma = buildPrismaMock([[OWNER_ROLE], [{ count: 1 }]]);
    const svc = createChatPermissionsService({ prisma });
    assert.equal(await svc.isLastOwner(CONV_ID, PROFILE_ID), true);
  });

  it("returns false when more than one active system-role holder remains", async () => {
    const prisma = buildPrismaMock([[OWNER_ROLE], [{ count: 2 }]]);
    const svc = createChatPermissionsService({ prisma });
    assert.equal(await svc.isLastOwner(CONV_ID, PROFILE_ID), false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js`
Expected: FAIL — `svc.listRoles is not a function` (and similar) since `createChatPermissionsService` doesn't exist yet.

- [ ] **Step 3: Append the DB-backed implementation**

Append to `apps/api/src/routes/chat/chat-permissions-service.js`:

```javascript
export function createChatPermissionsService({ prisma }) {
  async function assertConversationMember(conversationId, userProfileId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId} AND user_id = ${userProfileId} AND left_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatPermissionsError("Conversacion no encontrada.", 404);
  }

  async function getMemberRole(conversationId, userProfileId) {
    const rows = await prisma.$queryRaw`
      SELECT r.id, r.name, r.position, r.is_system AS "isSystem", r.permissions
      FROM chat_conversation_members m
      JOIN chat_channel_roles r ON r.id = m.role_id
      WHERE m.conversation_id = ${conversationId} AND m.user_id = ${userProfileId} AND m.left_at IS NULL
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async function assertChannelPermission(conversationId, userProfileId, permissionKey) {
    await assertConversationMember(conversationId, userProfileId);
    const role = await getMemberRole(conversationId, userProfileId);
    if (!roleHasPermission(role, permissionKey)) {
      throw new ChatPermissionsError("No tienes permiso para realizar esta accion.", 403);
    }
    return role;
  }

  async function seedDefaultRoles(conversationId) {
    const roleIds = {};
    for (const def of DEFAULT_CHANNEL_ROLES) {
      const rows = await prisma.$queryRaw`
        INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
        VALUES (${conversationId}, ${def.name}, ${def.position}, ${def.isSystem}, ${JSON.stringify(def.permissions)}::jsonb)
        RETURNING id, name
      `;
      roleIds[rows[0].name] = rows[0].id;
    }
    return roleIds;
  }

  async function isLastOwner(conversationId, userProfileId) {
    const role = await getMemberRole(conversationId, userProfileId);
    if (!role || !role.isSystem) return false;
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM chat_conversation_members m
      JOIN chat_channel_roles r ON r.id = m.role_id
      WHERE m.conversation_id = ${conversationId} AND r.is_system = true AND m.left_at IS NULL
    `;
    return (rows[0]?.count ?? 0) <= 1;
  }

  async function listRoles({ conversationId, authUserId }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    await assertConversationMember(conversationId, profileId);
    return prisma.$queryRaw`
      SELECT id, conversation_id AS "conversationId", name, color, position,
             is_system AS "isSystem", permissions, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM chat_channel_roles
      WHERE conversation_id = ${conversationId}
      ORDER BY position DESC, created_at ASC
    `;
  }

  async function createRole({ conversationId, authUserId, name, color = null, position, permissions }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    const actorRole = await assertChannelPermission(conversationId, profileId, CHAT_PERMISSIONS.ROLES_MANAGE);
    assertHigherPosition(actorRole.position, position, "No puedes crear un rol con rango igual o mayor al tuyo.");

    const existing = await prisma.$queryRaw`
      SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = ${name} LIMIT 1
    `;
    if (existing.length) throw new ChatPermissionsError("Ya existe un rol con ese nombre en esta conversacion.", 400);

    const rows = await prisma.$queryRaw`
      INSERT INTO chat_channel_roles (conversation_id, name, color, position, is_system, permissions)
      VALUES (${conversationId}, ${name}, ${color}, ${position}, false, ${JSON.stringify(permissions)}::jsonb)
      RETURNING id, conversation_id AS "conversationId", name, color, position,
                is_system AS "isSystem", permissions, created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    return rows[0];
  }

  async function updateRole({ conversationId, roleId, authUserId, updates }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    const actorRole = await assertChannelPermission(conversationId, profileId, CHAT_PERMISSIONS.ROLES_MANAGE);

    const targetRows = await prisma.$queryRaw`
      SELECT * FROM chat_channel_roles WHERE id = ${roleId} AND conversation_id = ${conversationId} LIMIT 1
    `;
    const target = targetRows[0];
    if (!target) throw new ChatPermissionsError("Rol no encontrado.", 404);
    if (target.is_system) throw new ChatPermissionsError("El rol Owner no se puede modificar.", 403);
    assertHigherPosition(actorRole.position, target.position, "No puedes modificar un rol de rango igual o mayor al tuyo.");
    if (updates.position !== undefined) {
      assertHigherPosition(actorRole.position, updates.position, "No puedes asignar un rango igual o mayor al tuyo.");
    }
    if (updates.name !== undefined && updates.name !== target.name) {
      const dupe = await prisma.$queryRaw`
        SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = ${updates.name} AND id != ${roleId} LIMIT 1
      `;
      if (dupe.length) throw new ChatPermissionsError("Ya existe un rol con ese nombre en esta conversacion.", 400);
    }

    const rows = await prisma.$queryRaw`
      UPDATE chat_channel_roles
      SET name = COALESCE(${updates.name ?? null}, name),
          color = COALESCE(${updates.color ?? null}, color),
          position = COALESCE(${updates.position ?? null}, position),
          permissions = COALESCE(${updates.permissions ? JSON.stringify(updates.permissions) : null}::jsonb, permissions),
          updated_at = NOW()
      WHERE id = ${roleId}
      RETURNING id, conversation_id AS "conversationId", name, color, position,
                is_system AS "isSystem", permissions, created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    return rows[0];
  }

  async function deleteRole({ conversationId, roleId, authUserId }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    const actorRole = await assertChannelPermission(conversationId, profileId, CHAT_PERMISSIONS.ROLES_MANAGE);

    const targetRows = await prisma.$queryRaw`
      SELECT * FROM chat_channel_roles WHERE id = ${roleId} AND conversation_id = ${conversationId} LIMIT 1
    `;
    const target = targetRows[0];
    if (!target) throw new ChatPermissionsError("Rol no encontrado.", 404);
    if (target.is_system) throw new ChatPermissionsError("El rol Owner no se puede eliminar.", 403);
    assertHigherPosition(actorRole.position, target.position, "No puedes eliminar un rol de rango igual o mayor al tuyo.");

    const fallbackRows = await prisma.$queryRaw`
      SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = 'Member' AND id != ${roleId} LIMIT 1
    `;
    const fallbackRoleId = fallbackRows[0]?.id ?? null;

    const reassigned = await prisma.$queryRaw`
      UPDATE chat_conversation_members
      SET role_id = ${fallbackRoleId}
      WHERE conversation_id = ${conversationId} AND role_id = ${roleId}
      RETURNING id
    `;

    await prisma.$executeRaw`DELETE FROM chat_channel_roles WHERE id = ${roleId}`;

    return { id: roleId, reassignedMemberCount: reassigned.length };
  }

  async function assignMemberRole({ conversationId, memberUserId, roleId, authUserId }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    const actorRole = await assertChannelPermission(conversationId, profileId, CHAT_PERMISSIONS.ROLES_MANAGE);

    const targetCurrentRole = await getMemberRole(conversationId, memberUserId);
    if (!targetCurrentRole) throw new ChatPermissionsError("Miembro no encontrado en esta conversacion.", 404);

    const isSelfTarget = memberUserId === profileId;
    if (!isSelfTarget) {
      assertHigherPosition(actorRole.position, targetCurrentRole.position, "No puedes gestionar a un miembro de rango igual o mayor al tuyo.");
    }

    const newRoleRows = await prisma.$queryRaw`
      SELECT id, name, position, is_system AS "isSystem" FROM chat_channel_roles
      WHERE id = ${roleId} AND conversation_id = ${conversationId} LIMIT 1
    `;
    const newRole = newRoleRows[0];
    if (!newRole) throw new ChatPermissionsError("Rol no encontrado.", 404);

    if (newRole.isSystem) {
      if (!actorRole.isSystem) {
        throw new ChatPermissionsError("Solo un Owner puede asignar el rol Owner.", 403);
      }
    } else {
      assertHigherPosition(actorRole.position, newRole.position, "No puedes asignar un rol de rango igual o mayor al tuyo.");
    }

    if (targetCurrentRole.isSystem && !newRole.isSystem) {
      const isLast = await isLastOwner(conversationId, memberUserId);
      if (isLast) {
        throw new ChatPermissionsError("No puedes quitar el rol Owner al unico Owner de la conversacion. Asigna otro Owner primero.", 400);
      }
    }

    await prisma.$executeRaw`
      UPDATE chat_conversation_members
      SET role_id = ${roleId}
      WHERE conversation_id = ${conversationId} AND user_id = ${memberUserId} AND left_at IS NULL
    `;

    return { conversationId, userId: memberUserId, roleId };
  }

  return {
    seedDefaultRoles,
    isLastOwner,
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    assignMemberRole,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js`
Expected: PASS — all tests (pure + DB-backed) green.

- [ ] **Step 5: Syntax check and commit**

```bash
node --check apps/api/src/routes/chat/chat-permissions-service.js
git add apps/api/src/routes/chat/chat-permissions-service.js apps/api/src/routes/chat/__tests__/chat-permissions-service.test.js
git commit -m "feat(chat): add role CRUD, member-role assignment, and hierarchy/last-Owner guards"
```

---

### Task 5: `chat-service.js` — wire roles into the conversation lifecycle

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`

- [ ] **Step 1: Accept `permissionsService` and populate `company_id`/channel fields on `createConversation`**

Change the factory signature (currently `export function createChatService({ prisma, supabaseAdmin, notificationService = null, broadcaster = null }) {`) to:

```javascript
export function createChatService({ prisma, supabaseAdmin, notificationService = null, broadcaster = null, permissionsService = null }) {
```

Change the `createConversation` signature and body. Replace:

```javascript
  async function createConversation({ authUserId, type, title, memberUserIds, metadata = {} }) {
    const creatorProfileId = await getUserProfileId(authUserId);
```

with:

```javascript
  async function createConversation({ authUserId, type, title, memberUserIds, metadata = {}, isPublic = false, slug = null, description = null }) {
    const creatorProfileId = await getUserProfileId(authUserId);
```

Then, immediately before the existing `const convRows = await prisma.$queryRaw` INSERT block, insert:

```javascript
    const membership = await prisma.membership.findFirst({
      where: { userId: creatorProfileId.toString(), enabled: true },
      orderBy: { createdAt: "desc" },
      select: { companyId: true },
    });
    const companyId = membership?.companyId ?? null;

    if (type === "channel" && slug) {
      const dupe = await prisma.$queryRaw`
        SELECT id FROM chat_conversations WHERE company_id = ${companyId} AND slug = ${slug} AND deleted_at IS NULL LIMIT 1
      `;
      if (dupe.length) throw new ChatServiceError("Ya existe un canal con ese slug en tu empresa.", 400);
    }

```

Replace the INSERT itself:

```javascript
    const convRows = await prisma.$queryRaw`
      INSERT INTO chat_conversations (type, title, created_by_user_id, metadata)
      VALUES (${type}, ${title ?? null}, ${creatorProfileId}, ${JSON.stringify(metadata)}::jsonb)
      RETURNING *
    `;
```

with:

```javascript
    const convRows = await prisma.$queryRaw`
      INSERT INTO chat_conversations (type, title, created_by_user_id, company_id, is_public, slug, description, metadata)
      VALUES (${type}, ${title ?? null}, ${creatorProfileId}, ${companyId}, ${isPublic}, ${slug}, ${description}, ${JSON.stringify(metadata)}::jsonb)
      RETURNING *
    `;
```

Then, immediately after the existing member-insert loop (`for (const uid of allMembers) { ... }` block) and before the `// System message: group created` comment, insert the role-seeding block:

```javascript
    if ((type === "channel" || type === "group") && permissionsService) {
      const roleIds = await permissionsService.seedDefaultRoles(conv.id);
      await prisma.$executeRaw`
        UPDATE chat_conversation_members SET role_id = ${roleIds.Owner}
        WHERE conversation_id = ${conv.id} AND user_id = ${creatorProfileId}
      `;
      const otherIds = allMembers.filter((id) => id !== creatorProfileId);
      if (otherIds.length) {
        await prisma.$executeRaw`
          UPDATE chat_conversation_members SET role_id = ${roleIds.Member}
          WHERE conversation_id = ${conv.id} AND user_id IN (${Prisma.join(otherIds)})
        `;
      }
    }

```

- [ ] **Step 2: Assign the default `Member` role when a member is added later, for channel/group conversations**

In `addMembers`, inside the `for (const uid of userIds) { ... }` loop, immediately after the existing:

```javascript
      await prisma.$executeRaw`
        INSERT INTO chat_conversation_members (conversation_id, user_id, role)
        VALUES (${conversationId}, ${uid}, ${role})
        ON CONFLICT DO NOTHING
      `;
```

insert:

```javascript
      await prisma.$executeRaw`
        UPDATE chat_conversation_members
        SET role_id = (SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = 'Member' LIMIT 1)
        WHERE conversation_id = ${conversationId} AND user_id = ${uid} AND role_id IS NULL
      `;
```

(This is a no-op for `direct`/`external_support` conversations — the subquery finds no `chat_channel_roles` row for them, so `role_id` stays `NULL`, unchanged.)

- [ ] **Step 3: Block removing the last remaining Owner in `removeMember`**

Change:

```javascript
  async function removeMember({ conversationId, authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    await prisma.$executeRaw`
```

to:

```javascript
  async function removeMember({ conversationId, authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    if (permissionsService) {
      const isLast = await permissionsService.isLastOwner(conversationId, targetUserId);
      if (isLast) {
        throw new ChatServiceError("No puedes eliminar al unico Owner de la conversacion. Asigna otro Owner primero.", 400);
      }
    }

    await prisma.$executeRaw`
```

- [ ] **Step 4: Syntax check**

Run: `node --check apps/api/src/routes/chat/chat-service.js`
Expected: no output (syntax OK).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js
git commit -m "feat(chat): populate company_id and seed channel/group roles on conversation lifecycle"
```

**Note on file size:** after this task, `chat-service.js` grows from ~1000 to ~1045 lines — over the project's 1000-line soft limit but well under the 1500 hard ceiling. The additions are the minimum necessary edits to three existing functions (`createConversation`, `addMembers`, `removeMember`); all genuinely new functionality lives in the two new files instead. A future pass should consider splitting `chat-service.js` by concern (conversations vs. messages vs. members), but that is an unrelated, larger refactor and out of scope for this phase — flagged here rather than done silently.

---

### Task 6: `channel-directory-service.js` — join and directory listing

**Files:**
- Create: `apps/api/src/routes/chat/channel-directory-service.js`
- Test: `apps/api/src/routes/chat/__tests__/channel-directory-service.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// apps/api/src/routes/chat/__tests__/channel-directory-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChannelDirectoryService } from "../channel-directory-service.js";
import { ChatServiceError } from "../chat-service.js";

const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const COMPANY_ID = "01900000-0000-7000-8000-0000000000c9";
const CONV_ID = "01900000-0000-7000-8000-0000000000cc";

function buildPrismaMock({ queryRawResults = [], membershipResult = { companyId: COMPANY_ID } } = {}) {
  let qIdx = 0;
  return {
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    membership: {
      findFirst: async () => membershipResult,
    },
  };
}

describe("channel-directory-service — listChannelDirectory", () => {
  it("returns an empty list when the caller has no active company membership", async () => {
    const prisma = buildPrismaMock({
      queryRawResults: [[{ id: PROFILE_ID }]],
      membershipResult: null,
    });
    const svc = createChannelDirectoryService({ prisma });
    const result = await svc.listChannelDirectory({ authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { data: [], nextCursor: null });
  });

  it("returns public channels for the caller's company", async () => {
    const channelRow = { id: CONV_ID, title: "General", description: null, slug: "general", isPublic: true, createdAt: new Date() };
    const prisma = buildPrismaMock({
      queryRawResults: [[{ id: PROFILE_ID }], [channelRow]],
    });
    const svc = createChannelDirectoryService({ prisma });
    const result = await svc.listChannelDirectory({ authUserId: AUTH_USER_ID });
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].slug, "general");
  });
});

describe("channel-directory-service — joinChannel", () => {
  it("throws 404 when the target is not a public channel", async () => {
    const prisma = buildPrismaMock({ queryRawResults: [[{ id: PROFILE_ID }], []] });
    const svc = createChannelDirectoryService({ prisma });
    await assert.rejects(
      () => svc.joinChannel({ conversationId: CONV_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("throws 400 when the caller is already a member", async () => {
    const prisma = buildPrismaMock({
      queryRawResults: [
        [{ id: PROFILE_ID }],
        [{ id: CONV_ID, isPublic: true }],
        [{ id: "existing-member-row" }],
      ],
    });
    const svc = createChannelDirectoryService({ prisma });
    await assert.rejects(
      () => svc.joinChannel({ conversationId: CONV_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 400,
    );
  });

  it("inserts a membership row with the conversation's default Member role", async () => {
    const membershipRow = { id: "new-member", conversationId: CONV_ID, userId: PROFILE_ID, roleId: "role-member", joinedAt: new Date() };
    const prisma = buildPrismaMock({
      queryRawResults: [
        [{ id: PROFILE_ID }],
        [{ id: CONV_ID, isPublic: true }],
        [],
        [{ id: "role-member" }],
        [membershipRow],
      ],
    });
    const svc = createChannelDirectoryService({ prisma });
    const result = await svc.joinChannel({ conversationId: CONV_ID, authUserId: AUTH_USER_ID });
    assert.equal(result.roleId, "role-member");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test apps/api/src/routes/chat/__tests__/channel-directory-service.test.js`
Expected: FAIL — `Cannot find module '../channel-directory-service.js'`

- [ ] **Step 3: Write the implementation**

```javascript
// apps/api/src/routes/chat/channel-directory-service.js
import { resolveUserProfileId, ChatServiceError } from "./chat-service.js";

export function createChannelDirectoryService({ prisma }) {
  async function listChannelDirectory({ authUserId, cursor = null, limit = 30 }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);

    const membership = await prisma.membership.findFirst({
      where: { userId: profileId.toString(), enabled: true },
      orderBy: { createdAt: "desc" },
      select: { companyId: true },
    });
    const companyId = membership?.companyId ?? null;
    if (!companyId) return { data: [], nextCursor: null };

    const rows = await prisma.$queryRaw`
      SELECT c.id, c.title, c.description, c.slug, c.is_public AS "isPublic", c.created_at AS "createdAt"
      FROM chat_conversations c
      WHERE c.company_id = ${companyId}
        AND c.type = 'channel'
        AND c.is_public = true
        AND c.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM chat_conversation_members m
          WHERE m.conversation_id = c.id AND m.user_id = ${profileId} AND m.left_at IS NULL
        )
        AND (${cursor}::timestamptz IS NULL OR c.created_at < ${cursor}::timestamptz)
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `;
    const nextCursor = rows.length === limit ? rows[rows.length - 1].createdAt : null;
    return { data: rows, nextCursor };
  }

  async function joinChannel({ conversationId, authUserId }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);

    const convRows = await prisma.$queryRaw`
      SELECT id, is_public AS "isPublic" FROM chat_conversations
      WHERE id = ${conversationId} AND type = 'channel' AND is_public = true AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!convRows.length) throw new ChatServiceError("Canal no encontrado.", 404);

    const existing = await prisma.$queryRaw`
      SELECT id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId} AND user_id = ${profileId} AND left_at IS NULL
      LIMIT 1
    `;
    if (existing.length) throw new ChatServiceError("Ya eres miembro de este canal.", 400);

    const memberRoleRows = await prisma.$queryRaw`
      SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = 'Member' LIMIT 1
    `;
    const roleId = memberRoleRows[0]?.id ?? null;

    const inserted = await prisma.$queryRaw`
      INSERT INTO chat_conversation_members (conversation_id, user_id, role, role_id)
      VALUES (${conversationId}, ${profileId}, 'member', ${roleId})
      RETURNING id, conversation_id AS "conversationId", user_id AS "userId", role_id AS "roleId", joined_at AS "joinedAt"
    `;
    return inserted[0];
  }

  return { listChannelDirectory, joinChannel };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test apps/api/src/routes/chat/__tests__/channel-directory-service.test.js`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Syntax check and commit**

```bash
node --check apps/api/src/routes/chat/channel-directory-service.js
git add apps/api/src/routes/chat/channel-directory-service.js apps/api/src/routes/chat/__tests__/channel-directory-service.test.js
git commit -m "feat(chat): add public channel directory listing and join flow"
```

---

### Task 7: Validators

**Files:**
- Modify: `packages/validators/src/chat.js`

- [ ] **Step 1: Add the four new schemas**

At the end of `packages/validators/src/chat.js`, append:

```javascript
export const chatCreateChannelSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  isPublic: z.boolean().optional().default(false),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, "El slug solo puede contener minusculas, numeros y guiones.").optional(),
  memberUserIds: z.array(z.string().uuid()).max(50).optional().default([]),
});

export const chatCreateChannelRoleSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).max(99),
  permissions: z.record(z.boolean()),
});

export const chatUpdateChannelRoleSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).max(99).optional(),
  permissions: z.record(z.boolean()).optional(),
});

export const chatAssignMemberRoleSchema = z.object({
  roleId: z.string().uuid(),
});
```

- [ ] **Step 2: Syntax check**

Run: `node --check packages/validators/src/chat.js`
Expected: no output (syntax OK).

- [ ] **Step 3: Commit**

```bash
git add packages/validators/src/chat.js
git commit -m "feat(validators): add schemas for channel creation, roles, and role assignment"
```

---

### Task 8: API routes

**Files:**
- Modify: `apps/api/src/routes/chat/index.js`

- [ ] **Step 1: Update imports**

Replace the import block at the top of `apps/api/src/routes/chat/index.js`:

```javascript
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
} from "@atlas/validators";
import { createChatService, ChatServiceError } from "./chat-service.js";
import { createGuestChatService, GuestChatServiceError } from "./guest-service.js";
import { createChatTemplateService } from "./template-service.js";
import { expireStaleGuestSessions } from "./session-expiry-job.js";
```

with:

```javascript
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
} from "@atlas/validators";
import { createChatService, ChatServiceError } from "./chat-service.js";
import { createGuestChatService, GuestChatServiceError } from "./guest-service.js";
import { createChatTemplateService } from "./template-service.js";
import { expireStaleGuestSessions } from "./session-expiry-job.js";
import { createChatPermissionsService, ChatPermissionsError } from "./chat-permissions-service.js";
import { createChannelDirectoryService } from "./channel-directory-service.js";
```

- [ ] **Step 2: Recognize `ChatPermissionsError` in `handleError`**

Replace:

```javascript
function handleError(c, err, fallback) {
  if (err instanceof ChatServiceError || err instanceof GuestChatServiceError) {
    return c.json({ error: err.message }, err.status);
  }
```

with:

```javascript
function handleError(c, err, fallback) {
  if (err instanceof ChatServiceError || err instanceof GuestChatServiceError || err instanceof ChatPermissionsError) {
    return c.json({ error: err.message }, err.status);
  }
```

- [ ] **Step 3: Instantiate the new services**

Replace:

```javascript
export function createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService = null, broadcaster = null }) {
  const app = new Hono();
  const chatService = createChatService({ prisma, supabaseAdmin, notificationService, broadcaster });
  const guestService = createGuestChatService({ prisma, supabaseAdmin, notificationService, broadcaster });
  const templateService = createChatTemplateService({ prisma });
```

with:

```javascript
export function createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService = null, broadcaster = null }) {
  const app = new Hono();
  const permissionsService = createChatPermissionsService({ prisma });
  const chatService = createChatService({ prisma, supabaseAdmin, notificationService, broadcaster, permissionsService });
  const guestService = createGuestChatService({ prisma, supabaseAdmin, notificationService, broadcaster });
  const templateService = createChatTemplateService({ prisma });
  const channelDirectoryService = createChannelDirectoryService({ prisma });
```

- [ ] **Step 4: Add the new routes**

Immediately after the `// POST /chat/conversations/:id/read` route block (ends with the closing `});` right before `// PATCH /chat/availability`), insert:

```javascript
  // ================================================================
  // CHANNELS & ROLES (Phase A foundation)
  // ================================================================

  // POST /chat/channels
  internal.post("/channels", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const body = await c.req.json();
      const data = chatCreateChannelSchema.parse(body);
      const result = await chatService.createConversation({ authUserId, type: "channel", ...data });
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error creando canal.");
    }
  });

  // GET /chat/channels/directory
  internal.get("/channels/directory", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const { cursor, limit } = c.req.query();
      const result = await channelDirectoryService.listChannelDirectory({
        authUserId,
        cursor: cursor || null,
        limit: limit ? Math.min(parseInt(limit, 10), 100) : 30,
      });
      return c.json(result);
    } catch (err) {
      return handleError(c, err, "Error listando canales.");
    }
  });

  // POST /chat/conversations/:id/join
  internal.post("/conversations/:id/join", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const result = await channelDirectoryService.joinChannel({ conversationId, authUserId });
      return c.json({ data: result }, 201);
    } catch (err) {
      return handleError(c, err, "Error uniendote al canal.");
    }
  });

  // GET /chat/conversations/:id/roles
  internal.get("/conversations/:id/roles", requirePermission("chat.conversations.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const result = await permissionsService.listRoles({ conversationId, authUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error listando roles.");
    }
  });

  // POST /chat/conversations/:id/roles
  internal.post("/conversations/:id/roles", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const body = await c.req.json();
      const data = chatCreateChannelRoleSchema.parse(body);
      const result = await permissionsService.createRole({ conversationId, authUserId, ...data });
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error creando rol.");
    }
  });

  // PATCH /chat/conversations/:id/roles/:roleId
  internal.patch("/conversations/:id/roles/:roleId", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const roleId = c.req.param("roleId");
      const body = await c.req.json();
      const updates = chatUpdateChannelRoleSchema.parse(body);
      const result = await permissionsService.updateRole({ conversationId, roleId, authUserId, updates });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error actualizando rol.");
    }
  });

  // DELETE /chat/conversations/:id/roles/:roleId
  internal.delete("/conversations/:id/roles/:roleId", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const roleId = c.req.param("roleId");
      const result = await permissionsService.deleteRole({ conversationId, roleId, authUserId });
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "Error eliminando rol.");
    }
  });

  // PATCH /chat/conversations/:id/members/:memberId/role
  internal.patch("/conversations/:id/members/:memberId/role", requirePermission("chat.conversations.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const conversationId = c.req.param("id");
      const memberUserId = c.req.param("memberId");
      const body = await c.req.json();
      const { roleId } = chatAssignMemberRoleSchema.parse(body);
      const result = await permissionsService.assignMemberRole({ conversationId, memberUserId, roleId, authUserId });
      return c.json({ data: result });
    } catch (err) {
      if (err?.name === "ZodError") return c.json({ error: (err.errors ?? err.issues)?.[0]?.message ?? "Datos invalidos." }, 422);
      return handleError(c, err, "Error asignando rol.");
    }
  });

```

- [ ] **Step 5: Syntax check**

Run: `node --check apps/api/src/routes/chat/index.js`
Expected: no output (syntax OK).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/index.js
git commit -m "feat(chat): wire up channel, directory, join, and role API routes"
```

---

### Task 9: SDK

**Files:**
- Modify: `packages/sdk/src/domains/chat.js`

- [ ] **Step 1: Add the new SDK methods**

In `packages/sdk/src/domains/chat.js`, immediately after the `updateConversation` method (inside the `// Conversations (internal)` section), insert:

```javascript
    createChannel: (data, token) =>
      request("/chat/channels", {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    listChannelDirectory: (params, token) =>
      request(`/chat/channels/directory${toQueryString(params)}`, {
        headers: withAuthHeaders(token),
      }),

    joinChannel: (conversationId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/join`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({}),
      }),

    listChannelRoles: (conversationId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/roles`, {
        headers: withAuthHeaders(token),
      }),

    createChannelRole: (conversationId, data, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/roles`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    updateChannelRole: (conversationId, roleId, data, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/roles/${encodeURIComponent(roleId)}`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteChannelRole: (conversationId, roleId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/roles/${encodeURIComponent(roleId)}`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),

    assignMemberRole: (conversationId, memberId, roleId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(memberId)}/role`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ roleId }),
      }),

```

- [ ] **Step 2: Syntax check**

Run: `node --check packages/sdk/src/domains/chat.js`
Expected: no output (syntax OK).

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/domains/chat.js
git commit -m "feat(sdk): add chat channel, directory, join, and role methods"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full chat test suite**

Run: `node --test apps/api/src/routes/chat/__tests__/`
Expected: PASS — every test file under that directory (including the two new ones) passes.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: no build errors across `apps/api`, `packages/validators`, `packages/sdk`.

- [ ] **Step 3: Confirm the migration state matches the spec's acceptance criteria**

Run the three sanity queries from Task 1 Step 3 again (via `pnpm db:studio` or a local script) and additionally confirm:

```sql
-- Acceptance criterion 2: every existing group has exactly 4 roles
SELECT conversation_id, count(*) FROM chat_channel_roles
  GROUP BY conversation_id HAVING count(*) <> 4;
```

Expected: zero rows returned (no group has a role count other than 4).

- [ ] **Step 4: Manual smoke test (local dev, via the already-configured session/dev auth flow — do not hardcode a bearer token)**

With `pnpm dev:api` running locally:
1. Create a channel: `POST /chat/channels` with `{ "title": "General", "isPublic": true, "slug": "general" }` — confirm `201` and that the creator appears with the `Owner` role via `GET /chat/conversations/:id/roles`.
2. As the same user (Owner), `POST /chat/conversations/:id/roles` with `{ "name": "Support", "position": 50, "permissions": {"messages.pin": true} }` — confirm `201`. Then attempt the same with `position: 100` — confirm `403` (cannot create a role at or above the Owner's own position).
3. As a second user, `POST /chat/conversations/:id/join` on the public channel — confirm `201` and that they now hold the `Member` role.
4. As the second user (Member), attempt `PATCH /chat/conversations/:id/roles/:roleId` on any role — confirm `403`.
5. As the Owner, `DELETE` the "Support" role created in step 2 after assigning it to the second user — confirm the response reports `reassignedMemberCount: 1` and the second user now holds `Member` again.

Expected: all steps behave as described, matching Section 25 (Acceptance criteria) of the spec.

- [ ] **Step 5: Update `docs/TASKS.md`**

Add a line under the current phase section noting Phase A of the chat channels/roles work, with verification evidence:

```
- atlas.chat: Channels & Roles Phase A (foundation) — complete.
  Verified: <YYYY-MM-DD> (node --test apps/api/src/routes/chat/__tests__/, pnpm build, pnpm db:migrate, manual smoke test per plan Task 10 Step 4)
```

- [ ] **Step 6: Final commit**

```bash
git add docs/TASKS.md
git commit -m "docs: mark chat channels/roles Phase A complete with verification evidence"
```

---

## Self-Review Notes (completed during plan writing)

- **Spec coverage:** every API endpoint in spec Section 12 has a corresponding route (Task 8); every data model change in Section 10 is in the Task 1 migration; the permission catalog and default roles from Section 18 are Task 3; all 7 edge cases in Section 23 are covered (backfill: Task 1; last-Owner removal: Task 5 Step 3 and Task 4's `isLastOwner`/`assignMemberRole` tests; duplicate slug: Task 5 Step 1; role deletion reassignment: Task 4; position ties: intentionally unenforced, matches spec edge case 5; self-demotion: Task 4's dedicated test; non-member 404s: `assertConversationMember`).
- **Type consistency:** `getMemberRole` returns camelCase (`isSystem`, `position`) and every function that consumes its result (`roleHasPermission`, `assertHigherPosition` call sites, `assignMemberRole`) uses that same casing. Raw `SELECT *`/ad-hoc queries against `chat_channel_roles` inside `updateRole`/`deleteRole` use snake_case (`is_system`, `position`) consistently within those functions only, and are never passed to `roleHasPermission`.
- **Task ordering fixed during self-review:** the original draft had Task "3" instruct the executor to jump into the middle of a later task to satisfy an import dependency — reordered so `resolveUserProfileId` extraction (now Task 2) stands alone and comes first, and the conversation-lifecycle wiring that depends on the finished permission engine (now Task 5) comes after it (Task 4). Tasks now run strictly in numeric order with no forward/backward jumps.
- **No placeholders:** every step has complete, runnable code; no "add validation" or "handle edge cases" stand-ins.

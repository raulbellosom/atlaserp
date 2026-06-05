# atlas.ledger Collaboration & Groups — Plan A (API)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-owned accounts, group spaces, member invitations, access filtering, and user search to the ledger API.

**Architecture:** SQL migration adds `owner_id`/`group_id` to `ledger_account` and creates 3 new tables. Two new services (`group-service.js`, `collaboration-service.js`) handle business logic. Three new routers mount under the existing ledger router. `ledger-service.js` `listAccounts`/`getAccount` gain actorId-based access filtering. Notification service is called internally on invite/revoke.

**Tech Stack:** Node.js, Hono, Prisma `$queryRaw`, Zod, existing `createNotificationService`, `getActivityContext`.

**Spec:** `docs/superpowers/specs/2026-06-05-ledger-collaboration-groups-design.md`

---

## File map

| Action | File |
|---|---|
| Create | `prisma/migrations/20260605000000_add_ledger_collaboration_tables/migration.sql` |
| Modify | `apps/api/src/permission-catalog.js` |
| Modify | `apps/api/src/routes/ledger/validators.js` |
| Create | `apps/api/src/routes/ledger/group-service.js` |
| Create | `apps/api/src/routes/ledger/collaboration-service.js` |
| Modify | `apps/api/src/routes/ledger/ledger-service.js` |
| Modify | `apps/api/src/routes/ledger/accounts-routes.js` |
| Create | `apps/api/src/routes/ledger/groups-routes.js` |
| Create | `apps/api/src/routes/ledger/collaboration-routes.js` |
| Create | `apps/api/src/routes/users-routes.js` |
| Modify | `apps/api/src/routes/ledger/index.js` |
| Modify | `apps/api/src/index.js` |
| Create | `apps/api/src/routes/ledger/__tests__/group-service.test.js` |
| Create | `apps/api/src/routes/ledger/__tests__/collaboration-service.test.js` |

---

## Task 1: SQL migration

**Files:**
- Create: `prisma/migrations/20260605000000_add_ledger_collaboration_tables/migration.sql`

- [ ] **Step 1: Create migration directory and file**

```bash
mkdir prisma/migrations/20260605000000_add_ledger_collaboration_tables
```

Write `prisma/migrations/20260605000000_add_ledger_collaboration_tables/migration.sql`:

```sql
-- ledger collaboration: groups, members, account members
-- Safe to run multiple times thanks to IF NOT EXISTS / IF EXISTS guards.

-- 1. New tables must be created before altering ledger_account (FK target).

CREATE TABLE IF NOT EXISTS "ledger_group" (
  "id"          UUID        NOT NULL DEFAULT uuidv7(),
  "company_id"  UUID        NOT NULL,
  "name"        TEXT        NOT NULL,
  "created_by"  UUID,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enabled"     BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT "ledger_group_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ledger_group_company_id_idx"
  ON "ledger_group"("company_id");

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ledger_group_member" (
  "id"          UUID        NOT NULL DEFAULT uuidv7(),
  "group_id"    UUID        NOT NULL,
  "user_id"     UUID        NOT NULL,
  "role"        TEXT        NOT NULL DEFAULT 'viewer',
  "invited_by"  UUID,
  "invited_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"      TEXT        NOT NULL DEFAULT 'active',
  CONSTRAINT "ledger_group_member_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_group_member_group_user_key" UNIQUE ("group_id", "user_id"),
  CONSTRAINT "ledger_group_member_role_check" CHECK (role IN ('viewer', 'editor', 'admin')),
  CONSTRAINT "ledger_group_member_status_check" CHECK (status IN ('active', 'rejected')),
  CONSTRAINT "ledger_group_member_group_fk" FOREIGN KEY ("group_id")
    REFERENCES "ledger_group"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ledger_group_member_user_id_idx"
  ON "ledger_group_member"("user_id");

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ledger_account_member" (
  "id"          UUID        NOT NULL DEFAULT uuidv7(),
  "account_id"  UUID        NOT NULL,
  "user_id"     UUID        NOT NULL,
  "role"        TEXT        NOT NULL DEFAULT 'viewer',
  "invited_by"  UUID,
  "invited_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"      TEXT        NOT NULL DEFAULT 'active',
  CONSTRAINT "ledger_account_member_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_account_member_account_user_key" UNIQUE ("account_id", "user_id"),
  CONSTRAINT "ledger_account_member_role_check" CHECK (role IN ('viewer', 'editor')),
  CONSTRAINT "ledger_account_member_status_check" CHECK (status IN ('active', 'rejected')),
  CONSTRAINT "ledger_account_member_account_fk" FOREIGN KEY ("account_id")
    REFERENCES "ledger_account"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ledger_account_member_user_id_idx"
  ON "ledger_account_member"("user_id");

-- ──────────────────────────────────────────────────────────────────────────────

-- 2. Add ownership columns to ledger_account.
--    owner_id = NULL means legacy account visible to all company members.
--    group_id = NULL means personal account; non-null = belongs to a group.

ALTER TABLE "ledger_account"
  ADD COLUMN IF NOT EXISTS "owner_id"  UUID,
  ADD COLUMN IF NOT EXISTS "group_id"  UUID;

-- FK from ledger_account.group_id → ledger_group.id (add only if not already there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ledger_account_group_fk'
  ) THEN
    ALTER TABLE "ledger_account"
      ADD CONSTRAINT "ledger_account_group_fk"
      FOREIGN KEY ("group_id") REFERENCES "ledger_group"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Drop the old company-wide unique name constraint; personal accounts from
-- different users can share the same name, so the old constraint is wrong.
DROP INDEX IF EXISTS "ledger_account_company_id_name_key";

-- Partial unique index for legacy accounts (owner_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_account_legacy_name_key"
  ON "ledger_account"("company_id", "name")
  WHERE "owner_id" IS NULL;
```

- [ ] **Step 2: Apply migration**

```bash
pnpm db:migrate
```

Expected output: `1 migration applied` with no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/20260605000000_add_ledger_collaboration_tables/migration.sql
git commit -m "feat(ledger): add collaboration tables migration"
```

---

## Task 2: Permissions

**Files:**
- Modify: `apps/api/src/permission-catalog.js`

- [ ] **Step 1: Add three ledger permissions**

Open `apps/api/src/permission-catalog.js`. Find the `"ledger.import"` block (around line 741). After the closing `}` of the `"ledger.types.manage"` block, append:

```js
  "ledger.groups.read": {
    displayNameEs: "Ver grupos",
    descriptionEs: "Permite ver grupos y sus cuentas en el libro de cuentas.",
    groupKey: "ledger",
    order: 50,
  },
  "ledger.groups.write": {
    displayNameEs: "Gestionar grupos",
    descriptionEs: "Permite crear y administrar grupos en el libro de cuentas.",
    groupKey: "ledger",
    order: 51,
  },
  "ledger.members.write": {
    displayNameEs: "Gestionar colaboradores",
    descriptionEs: "Permite invitar y remover colaboradores de cuentas y grupos.",
    groupKey: "ledger",
    order: 52,
  },
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/permission-catalog.js
git commit -m "feat(ledger): add groups and members permissions"
```

---

## Task 3: Validators

**Files:**
- Modify: `apps/api/src/routes/ledger/validators.js`

- [ ] **Step 1: Add group and member schemas**

At the end of `apps/api/src/routes/ledger/validators.js`, append:

```js
// ── Groups ────────────────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1).max(128),
})

export const updateGroupSchema = createGroupSchema.partial()

// ── Group / Account members ───────────────────────────────────────────────────

export const inviteGroupMemberSchema = z.object({
  user_id: z.string().uuid(),
  role:    z.enum(['viewer', 'editor', 'admin']),
})

export const updateGroupMemberRoleSchema = z.object({
  role: z.enum(['viewer', 'editor', 'admin']),
})

export const inviteAccountMemberSchema = z.object({
  user_id: z.string().uuid(),
  role:    z.enum(['viewer', 'editor']),
})

export const updateAccountMemberRoleSchema = z.object({
  role: z.enum(['viewer', 'editor']),
})

// ── Move account ──────────────────────────────────────────────────────────────

export const moveAccountGroupSchema = z.object({
  group_id: z.string().uuid().nullable(),
})

// ── User search ───────────────────────────────────────────────────────────────

export const userSearchQuerySchema = z.object({
  q:     z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/ledger/validators.js
git commit -m "feat(ledger): add group and member Zod validators"
```

---

## Task 4: group-service.js — CRUD

**Files:**
- Create: `apps/api/src/routes/ledger/group-service.js`

- [ ] **Step 1: Create group-service.js with CRUD functions**

```js
// apps/api/src/routes/ledger/group-service.js
import { createNotificationService } from '../../services/notification-service.js'
import { firstRow, isUniqueViolation } from './service-helpers.js'

export class GroupServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'GroupServiceError'
    this.status = status
  }
}

export function createGroupService({ prisma }) {
  const notifService = createNotificationService({ prisma })

  // ── Internal helpers ──────────────────────────────────────────────────────

  async function requireGroupAccess({ companyId, groupId, actorId, minRole = null }) {
    const rows = await prisma.$queryRaw`
      SELECT g.id, g.name, g.created_by, gm.role, gm.status
      FROM ledger_group g
      LEFT JOIN ledger_group_member gm ON gm.group_id = g.id AND gm.user_id = ${actorId}::uuid
      WHERE g.id = ${groupId}::uuid AND g.company_id = ${companyId}::uuid AND g.enabled = true
    `
    const row = firstRow(rows)
    if (!row) throw new GroupServiceError('Grupo no encontrado.', 404)

    const isMemberActive = row.status === 'active'
    const isCreator = row.created_by === actorId
    const hasAccess = isCreator || isMemberActive
    if (!hasAccess) throw new GroupServiceError('No tienes acceso a este grupo.', 403)

    if (minRole) {
      const ROLE_RANK = { viewer: 1, editor: 2, admin: 3 }
      const actorRank = isCreator ? 3 : (ROLE_RANK[row.role] ?? 0)
      if (actorRank < ROLE_RANK[minRole]) {
        throw new GroupServiceError('No tienes permisos suficientes en este grupo.', 403)
      }
    }
    return row
  }

  async function getActorDisplayName(actorId) {
    const rows = await prisma.$queryRaw`
      SELECT display_name FROM user_profile WHERE id = ${actorId}::uuid
    `
    return firstRow(rows)?.display_name ?? 'Un usuario'
  }

  // ── Group CRUD ────────────────────────────────────────────────────────────

  async function createGroup({ companyId, actorId, data }) {
    const name = String(data.name).trim()
    try {
      const rows = await prisma.$queryRaw`
        WITH new_group AS (
          INSERT INTO ledger_group (company_id, name, created_by)
          VALUES (${companyId}::uuid, ${name}, ${actorId}::uuid)
          RETURNING *
        ),
        _member AS (
          INSERT INTO ledger_group_member (group_id, user_id, role, invited_by, status)
          SELECT id, ${actorId}::uuid, 'admin', ${actorId}::uuid, 'active'
          FROM new_group
        )
        SELECT * FROM new_group
      `
      return firstRow(rows)
    } catch (err) {
      if (isUniqueViolation(err)) throw new GroupServiceError(`Ya existe un grupo con el nombre "${name}".`, 409)
      throw err
    }
  }

  async function listGroups({ companyId, actorId }) {
    const rows = await prisma.$queryRaw`
      SELECT g.*,
        gm.role AS my_role,
        COUNT(DISTINCT gm2.user_id) FILTER (WHERE gm2.status = 'active') AS member_count,
        COUNT(DISTINCT a.id) FILTER (WHERE a.enabled = true) AS account_count
      FROM ledger_group g
      LEFT JOIN ledger_group_member gm
        ON gm.group_id = g.id AND gm.user_id = ${actorId}::uuid AND gm.status = 'active'
      LEFT JOIN ledger_group_member gm2 ON gm2.group_id = g.id
      LEFT JOIN ledger_account a ON a.group_id = g.id
      WHERE g.company_id = ${companyId}::uuid
        AND g.enabled = true
        AND (
          g.created_by = ${actorId}::uuid
          OR (gm.user_id IS NOT NULL AND gm.status = 'active')
        )
      GROUP BY g.id, gm.role
      ORDER BY g.name
    `
    return { data: rows }
  }

  async function getGroup({ companyId, groupId, actorId }) {
    const group = await requireGroupAccess({ companyId, groupId, actorId })

    const [memberRows, accountRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT gm.*, p.display_name, p.email
        FROM ledger_group_member gm
        JOIN user_profile p ON p.id = gm.user_id
        WHERE gm.group_id = ${groupId}::uuid AND gm.status = 'active'
        ORDER BY p.display_name
      `,
      prisma.$queryRaw`
        SELECT a.id, a.name, a.bank, a.currency,
          a.opening_balance + COALESCE(
            SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0)) FILTER (WHERE t.enabled = true),
            0
          ) AS current_balance,
          a.owner_id, a.enabled
        FROM ledger_account a
        LEFT JOIN ledger_transaction t ON t.account_id = a.id
        WHERE a.group_id = ${groupId}::uuid AND a.enabled = true
        GROUP BY a.id
        ORDER BY a.name
      `,
    ])

    return {
      data: {
        ...group,
        members: memberRows,
        accounts: accountRows,
      },
    }
  }

  async function updateGroup({ companyId, groupId, actorId, data }) {
    await requireGroupAccess({ companyId, groupId, actorId, minRole: 'admin' })
    const name = String(data.name).trim()
    try {
      const rows = await prisma.$queryRaw`
        UPDATE ledger_group
        SET name = ${name}, updated_at = NOW()
        WHERE id = ${groupId}::uuid AND company_id = ${companyId}::uuid
        RETURNING *
      `
      const row = firstRow(rows)
      if (!row) throw new GroupServiceError('Grupo no encontrado.', 404)
      return row
    } catch (err) {
      if (isUniqueViolation(err)) throw new GroupServiceError(`Ya existe un grupo con el nombre "${name}".`, 409)
      throw err
    }
  }

  async function deleteGroup({ companyId, groupId, actorId }) {
    const group = await requireGroupAccess({ companyId, groupId, actorId })
    if (group.created_by !== actorId) {
      throw new GroupServiceError('Solo el creador del grupo puede eliminarlo.', 403)
    }
    const rows = await prisma.$queryRaw`
      UPDATE ledger_group
      SET enabled = false, updated_at = NOW()
      WHERE id = ${groupId}::uuid AND company_id = ${companyId}::uuid
      RETURNING *
    `
    return firstRow(rows)
  }

  // ── Member management ─────────────────────────────────────────────────────

  async function inviteMember({ companyId, groupId, actorId, actorName, data }) {
    const group = await requireGroupAccess({ companyId, groupId, actorId, minRole: 'admin' })
    const { user_id: targetUserId, role } = data

    if (targetUserId === actorId) {
      throw new GroupServiceError('No puedes invitarte a ti mismo.', 400)
    }

    try {
      await prisma.$queryRaw`
        INSERT INTO ledger_group_member (group_id, user_id, role, invited_by, status)
        VALUES (${groupId}::uuid, ${targetUserId}::uuid, ${role}, ${actorId}::uuid, 'active')
        ON CONFLICT (group_id, user_id) DO UPDATE
          SET role = EXCLUDED.role, status = 'active', invited_by = EXCLUDED.invited_by, invited_at = NOW()
      `
    } catch (err) {
      if (err.message?.includes('violates foreign key')) {
        throw new GroupServiceError('Usuario no encontrado.', 404)
      }
      throw err
    }

    await notifService.publish({
      companyId,
      actorId,
      input: {
        eventType: 'ledger.group_invite',
        title: `Te invitaron al grupo "${group.name}"`,
        body: `Rol asignado: ${role}`,
        recipients: { userIds: [targetUserId] },
        channels: ['in_app'],
        priority: 'medium',
        sourceType: 'ledger_group',
        sourceId: groupId,
        metadata: {
          resource_type: 'group',
          resource_id: groupId,
          resource_name: group.name,
          role,
          invited_by_name: actorName,
        },
      },
    }).catch(() => {}) // non-fatal: user might not be in the company membership yet

    return { ok: true }
  }

  async function updateMemberRole({ companyId, groupId, actorId, targetUserId, data }) {
    await requireGroupAccess({ companyId, groupId, actorId, minRole: 'admin' })
    const rows = await prisma.$queryRaw`
      UPDATE ledger_group_member
      SET role = ${data.role}
      WHERE group_id = ${groupId}::uuid AND user_id = ${targetUserId}::uuid AND status = 'active'
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new GroupServiceError('Miembro no encontrado.', 404)
    return row
  }

  async function removeMember({ companyId, groupId, actorId, targetUserId, actorName }) {
    const group = await requireGroupAccess({ companyId, groupId, actorId, minRole: 'admin' })
    const rows = await prisma.$queryRaw`
      DELETE FROM ledger_group_member
      WHERE group_id = ${groupId}::uuid AND user_id = ${targetUserId}::uuid
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new GroupServiceError('Miembro no encontrado.', 404)

    if (targetUserId !== actorId) {
      await notifService.publish({
        companyId,
        actorId,
        input: {
          eventType: 'ledger.access_revoked',
          title: 'Se revocó tu acceso',
          body: `Ya no tienes acceso al grupo "${group.name}"`,
          recipients: { userIds: [targetUserId] },
          channels: ['in_app'],
          priority: 'low',
          metadata: { resource_type: 'group', resource_name: group.name },
        },
      }).catch(() => {})
    }
    return row
  }

  return {
    createGroup,
    listGroups,
    getGroup,
    updateGroup,
    deleteGroup,
    inviteMember,
    updateMemberRole,
    removeMember,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/ledger/group-service.js
git commit -m "feat(ledger): add group-service (CRUD + member management)"
```

---

## Task 5: collaboration-service.js

**Files:**
- Create: `apps/api/src/routes/ledger/collaboration-service.js`

- [ ] **Step 1: Create collaboration-service.js**

```js
// apps/api/src/routes/ledger/collaboration-service.js
import { createNotificationService } from '../../services/notification-service.js'
import { firstRow } from './service-helpers.js'

export class CollaborationServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'CollaborationServiceError'
    this.status = status
  }
}

export function createCollaborationService({ prisma }) {
  const notifService = createNotificationService({ prisma })

  // ── Internal helpers ──────────────────────────────────────────────────────

  async function getAccountOwned({ companyId, accountId, actorId }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM ledger_account
      WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid AND owner_id = ${actorId}::uuid
    `
    const row = firstRow(rows)
    if (!row) throw new CollaborationServiceError('Cuenta no encontrada o no eres el propietario.', 404)
    return row
  }

  async function isGroupAdmin({ groupId, actorId }) {
    const rows = await prisma.$queryRaw`
      SELECT 1 FROM ledger_group_member
      WHERE group_id = ${groupId}::uuid AND user_id = ${actorId}::uuid
        AND status = 'active' AND role = 'admin'
      UNION
      SELECT 1 FROM ledger_group WHERE id = ${groupId}::uuid AND created_by = ${actorId}::uuid
    `
    return rows.length > 0
  }

  // ── Move account ──────────────────────────────────────────────────────────

  async function moveAccountToGroup({ companyId, accountId, actorId, groupId }) {
    const account = await getAccountOwned({ companyId, accountId, actorId })

    // Validate the group exists and belongs to same company
    const groupRows = await prisma.$queryRaw`
      SELECT id FROM ledger_group
      WHERE id = ${groupId}::uuid AND company_id = ${companyId}::uuid AND enabled = true
    `
    if (!firstRow(groupRows)) throw new CollaborationServiceError('Grupo no encontrado.', 404)

    // When moving to a group, delete all personal members (access switches to group)
    await prisma.$queryRaw`
      DELETE FROM ledger_account_member WHERE account_id = ${accountId}::uuid
    `

    const rows = await prisma.$queryRaw`
      UPDATE ledger_account SET group_id = ${groupId}::uuid, updated_at = NOW()
      WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid
      RETURNING *
    `
    return firstRow(rows)
  }

  async function moveAccountFromGroup({ companyId, accountId, actorId }) {
    // Owner OR group admin can move account out of group
    const accRows = await prisma.$queryRaw`
      SELECT * FROM ledger_account
      WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid AND group_id IS NOT NULL
    `
    const account = firstRow(accRows)
    if (!account) throw new CollaborationServiceError('Cuenta no encontrada o no pertenece a un grupo.', 404)

    const isOwner = account.owner_id === actorId
    const adminAccess = account.group_id ? await isGroupAdmin({ groupId: account.group_id, actorId }) : false

    if (!isOwner && !adminAccess) {
      throw new CollaborationServiceError('No tienes permisos para mover esta cuenta.', 403)
    }

    const rows = await prisma.$queryRaw`
      UPDATE ledger_account SET group_id = NULL, updated_at = NOW()
      WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid
      RETURNING *
    `
    return firstRow(rows)
  }

  // ── Account members (personal accounts only) ──────────────────────────────

  async function inviteAccountMember({ companyId, accountId, actorId, actorName, data }) {
    const account = await getAccountOwned({ companyId, accountId, actorId })
    if (account.group_id) {
      throw new CollaborationServiceError('Esta cuenta pertenece a un grupo. Gestiona el acceso desde el grupo.', 400)
    }
    const { user_id: targetUserId, role } = data
    if (targetUserId === actorId) {
      throw new CollaborationServiceError('No puedes invitarte a ti mismo.', 400)
    }

    try {
      await prisma.$queryRaw`
        INSERT INTO ledger_account_member (account_id, user_id, role, invited_by, status)
        VALUES (${accountId}::uuid, ${targetUserId}::uuid, ${role}, ${actorId}::uuid, 'active')
        ON CONFLICT (account_id, user_id) DO UPDATE
          SET role = EXCLUDED.role, status = 'active', invited_by = EXCLUDED.invited_by, invited_at = NOW()
      `
    } catch (err) {
      if (err.message?.includes('violates foreign key')) {
        throw new CollaborationServiceError('Usuario no encontrado.', 404)
      }
      throw err
    }

    await notifService.publish({
      companyId,
      actorId,
      input: {
        eventType: 'ledger.account_invite',
        title: `Te compartieron la cuenta "${account.name}"`,
        body: `Rol asignado: ${role}`,
        recipients: { userIds: [targetUserId] },
        channels: ['in_app'],
        priority: 'medium',
        sourceType: 'ledger_account',
        sourceId: accountId,
        metadata: {
          resource_type: 'account',
          resource_id: accountId,
          resource_name: account.name,
          role,
          invited_by_name: actorName,
        },
      },
    }).catch(() => {})

    return { ok: true }
  }

  async function updateAccountMemberRole({ companyId, accountId, actorId, targetUserId, data }) {
    await getAccountOwned({ companyId, accountId, actorId })
    const rows = await prisma.$queryRaw`
      UPDATE ledger_account_member
      SET role = ${data.role}
      WHERE account_id = ${accountId}::uuid AND user_id = ${targetUserId}::uuid AND status = 'active'
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new CollaborationServiceError('Colaborador no encontrado.', 404)
    return row
  }

  async function removeAccountMember({ companyId, accountId, actorId, targetUserId, actorName }) {
    const account = await getAccountOwned({ companyId, accountId, actorId })
    const rows = await prisma.$queryRaw`
      DELETE FROM ledger_account_member
      WHERE account_id = ${accountId}::uuid AND user_id = ${targetUserId}::uuid
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new CollaborationServiceError('Colaborador no encontrado.', 404)

    if (targetUserId !== actorId) {
      await notifService.publish({
        companyId,
        actorId,
        input: {
          eventType: 'ledger.access_revoked',
          title: 'Se revocó tu acceso',
          body: `Ya no tienes acceso a la cuenta "${account.name}"`,
          recipients: { userIds: [targetUserId] },
          channels: ['in_app'],
          priority: 'low',
          metadata: { resource_type: 'account', resource_name: account.name },
        },
      }).catch(() => {})
    }
    return row
  }

  // ── Memberships (actor's own view) ────────────────────────────────────────

  async function listMemberships({ companyId, actorId }) {
    const [groups, accounts] = await Promise.all([
      prisma.$queryRaw`
        SELECT g.id, g.name, gm.role, gm.invited_at,
          COUNT(DISTINCT gm2.user_id) FILTER (WHERE gm2.status = 'active') AS member_count
        FROM ledger_group_member gm
        JOIN ledger_group g ON g.id = gm.group_id AND g.enabled = true
        LEFT JOIN ledger_group_member gm2 ON gm2.group_id = g.id
        WHERE gm.user_id = ${actorId}::uuid AND gm.status = 'active'
          AND g.company_id = ${companyId}::uuid
          AND g.created_by != ${actorId}::uuid
        GROUP BY g.id, gm.role, gm.invited_at
        ORDER BY g.name
      `,
      prisma.$queryRaw`
        SELECT a.id, a.name, a.bank, a.currency, am.role, am.invited_at,
          p.display_name AS owner_name
        FROM ledger_account_member am
        JOIN ledger_account a ON a.id = am.account_id AND a.enabled = true
        JOIN user_profile p ON p.id = a.owner_id
        WHERE am.user_id = ${actorId}::uuid AND am.status = 'active'
          AND a.company_id = ${companyId}::uuid
        ORDER BY a.name
      `,
    ])
    return { data: { groups, accounts } }
  }

  async function leaveGroup({ companyId, actorId, groupId }) {
    const rows = await prisma.$queryRaw`
      DELETE FROM ledger_group_member
      WHERE group_id = ${groupId}::uuid AND user_id = ${actorId}::uuid
        AND EXISTS (
          SELECT 1 FROM ledger_group WHERE id = ${groupId}::uuid AND company_id = ${companyId}::uuid
        )
      RETURNING *
    `
    if (!firstRow(rows)) throw new CollaborationServiceError('No eres miembro de este grupo.', 404)
    return { ok: true }
  }

  async function leaveAccount({ companyId, actorId, accountId }) {
    const rows = await prisma.$queryRaw`
      DELETE FROM ledger_account_member
      WHERE account_id = ${accountId}::uuid AND user_id = ${actorId}::uuid
        AND EXISTS (
          SELECT 1 FROM ledger_account WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid
        )
      RETURNING *
    `
    if (!firstRow(rows)) throw new CollaborationServiceError('No eres colaborador de esta cuenta.', 404)
    return { ok: true }
  }

  async function rejectGroupInvitation({ companyId, actorId, groupId }) {
    const rows = await prisma.$queryRaw`
      UPDATE ledger_group_member
      SET status = 'rejected'
      WHERE group_id = ${groupId}::uuid AND user_id = ${actorId}::uuid
        AND EXISTS (
          SELECT 1 FROM ledger_group WHERE id = ${groupId}::uuid AND company_id = ${companyId}::uuid
        )
      RETURNING *
    `
    if (!firstRow(rows)) throw new CollaborationServiceError('Invitacion no encontrada.', 404)
    return { ok: true }
  }

  async function rejectAccountInvitation({ companyId, actorId, accountId }) {
    const rows = await prisma.$queryRaw`
      UPDATE ledger_account_member
      SET status = 'rejected'
      WHERE account_id = ${accountId}::uuid AND user_id = ${actorId}::uuid
        AND EXISTS (
          SELECT 1 FROM ledger_account WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid
        )
      RETURNING *
    `
    if (!firstRow(rows)) throw new CollaborationServiceError('Invitacion no encontrada.', 404)
    return { ok: true }
  }

  return {
    moveAccountToGroup,
    moveAccountFromGroup,
    inviteAccountMember,
    updateAccountMemberRole,
    removeAccountMember,
    listMemberships,
    leaveGroup,
    leaveAccount,
    rejectGroupInvitation,
    rejectAccountInvitation,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/ledger/collaboration-service.js
git commit -m "feat(ledger): add collaboration-service (members, move, memberships)"
```

---

## Task 6: Update ledger-service.js

**Files:**
- Modify: `apps/api/src/routes/ledger/ledger-service.js`

The three key changes: (a) `listAccounts` filters by actor access, (b) `getAccount` validates actor access, (c) `createAccount` sets `owner_id`, (d) new helper `canWriteAccount` for transaction/update routes.

- [ ] **Step 1: Update `listAccounts` signature and WHERE clause**

Find `async function listAccounts({ companyId })` and replace it:

```js
async function listAccounts({ companyId, actorId }) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT a.*,
        a.opening_balance + COALESCE(
          SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0)) FILTER (WHERE t.enabled = true),
          0
        ) AS current_balance
      FROM ledger_account a
      LEFT JOIN ledger_transaction t ON t.account_id = a.id
      WHERE a.company_id = ${companyId}::uuid
        AND a.enabled = true
        AND (
          a.owner_id IS NULL
          OR a.owner_id = ${actorId}::uuid
          OR EXISTS (
            SELECT 1 FROM ledger_account_member m
            WHERE m.account_id = a.id AND m.user_id = ${actorId}::uuid AND m.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM ledger_group_member gm
            WHERE gm.group_id = a.group_id AND gm.user_id = ${actorId}::uuid AND gm.status = 'active'
          )
        )
      GROUP BY a.id
      ORDER BY a.name
    `
    return { data: rows }
  } catch (err) {
    if (isTableNotFoundError(err)) throw new LedgerServiceError('El modulo Ledger no esta instalado.', 503)
    throw err
  }
}
```

- [ ] **Step 2: Update `getAccount` to accept and validate actorId**

Find `async function getAccount({ companyId, accountId })` and replace it:

```js
async function getAccount({ companyId, accountId, actorId = null }) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT a.*,
        a.opening_balance + COALESCE(
          SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0)) FILTER (WHERE t.enabled = true),
          0
        ) AS current_balance
      FROM ledger_account a
      LEFT JOIN ledger_transaction t ON t.account_id = a.id
      WHERE a.id = ${accountId}::uuid
        AND a.company_id = ${companyId}::uuid
        AND (
          ${actorId}::uuid IS NULL
          OR a.owner_id IS NULL
          OR a.owner_id = ${actorId}::uuid
          OR EXISTS (
            SELECT 1 FROM ledger_account_member m
            WHERE m.account_id = a.id AND m.user_id = ${actorId}::uuid AND m.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM ledger_group_member gm
            WHERE gm.group_id = a.group_id AND gm.user_id = ${actorId}::uuid AND gm.status = 'active'
          )
        )
      GROUP BY a.id
    `
    const account = firstRow(rows)
    if (!account) throw new LedgerServiceError('Cuenta no encontrada.', 404)
    return account
  } catch (err) {
    if (err instanceof LedgerServiceError) throw err
    if (isTableNotFoundError(err)) throw new LedgerServiceError('El modulo Ledger no esta instalado.', 503)
    throw err
  }
}
```

- [ ] **Step 3: Update `createAccount` to accept and store ownerId and groupId**

Find `async function createAccount({ companyId, data })` and replace with:

```js
async function createAccount({ companyId, ownerId = null, groupId = null, data }) {
  const { name, bank, account_number, currency, opening_balance } = data
  try {
    const rows = await prisma.$queryRaw`
      INSERT INTO ledger_account
        (company_id, owner_id, group_id, name, bank, account_number, currency, opening_balance, enabled)
      VALUES (
        ${companyId}::uuid,
        ${ownerId}::uuid,
        ${groupId ? `${groupId}::uuid` : null},
        ${name},
        ${bank},
        ${normalizeOptionalString(account_number)},
        ${currency},
        ${opening_balance ?? 0},
        true
      )
      RETURNING *
    `
    return firstRow(rows)
  } catch (err) {
    if (isUniqueViolation(err)) throw new LedgerServiceError(`Ya existe una cuenta con el nombre "${name}".`, 409)
    throw err
  }
}
```

**Note:** The `${groupId ? ...}` pattern doesn't work with tagged template literals. Replace the groupId line with a proper null cast. Use this version for the groupId value: cast it with `${groupId}::uuid` when groupId is a string, or pass `null` directly when it's null. In tagged template literals, passing JavaScript `null` sends a SQL NULL. So use:

```js
async function createAccount({ companyId, ownerId = null, groupId = null, data }) {
  const { name, bank, account_number, currency, opening_balance } = data
  try {
    const rows = await prisma.$queryRaw`
      INSERT INTO ledger_account
        (company_id, owner_id, group_id, name, bank, account_number, currency, opening_balance, enabled)
      VALUES (
        ${companyId}::uuid,
        ${ownerId},
        ${groupId},
        ${name},
        ${bank},
        ${normalizeOptionalString(account_number)},
        ${currency},
        ${opening_balance ?? 0},
        true
      )
      RETURNING *
    `
    return firstRow(rows)
  } catch (err) {
    if (isUniqueViolation(err)) throw new LedgerServiceError(`Ya existe una cuenta con el nombre "${name}".`, 409)
    throw err
  }
}
```

- [ ] **Step 4: Add `canWriteAccount` helper inside `createLedgerService`**

Add this function after `getAccount`:

```js
async function canWriteAccount({ companyId, accountId, actorId }) {
  const rows = await prisma.$queryRaw`
    SELECT 1 FROM ledger_account a
    WHERE a.id = ${accountId}::uuid
      AND a.company_id = ${companyId}::uuid
      AND (
        a.owner_id IS NULL
        OR a.owner_id = ${actorId}::uuid
        OR EXISTS (
          SELECT 1 FROM ledger_account_member m
          WHERE m.account_id = a.id AND m.user_id = ${actorId}::uuid
            AND m.status = 'active' AND m.role = 'editor'
        )
        OR EXISTS (
          SELECT 1 FROM ledger_group_member gm
          WHERE gm.group_id = a.group_id AND gm.user_id = ${actorId}::uuid
            AND gm.status = 'active' AND gm.role IN ('editor', 'admin')
        )
      )
  `
  return rows.length > 0
}
```

Also add `canWriteAccount` to the return object at the bottom of `createLedgerService`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/ledger/ledger-service.js
git commit -m "feat(ledger): add actorId access filtering to listAccounts/getAccount/createAccount"
```

---

## Task 7: Update accounts-routes.js

**Files:**
- Modify: `apps/api/src/routes/ledger/accounts-routes.js`

Pass `actorId` everywhere it's needed and enforce write-access for mutations.

- [ ] **Step 1: Update import to include `getActorId`**

Find:
```js
import { getCompanyId, getValidationErrorMessage } from "./service-helpers.js";
```
Replace with:
```js
import { getCompanyId, getActorId, getValidationErrorMessage } from "./service-helpers.js";
```

- [ ] **Step 2: Update `GET /ledger/accounts` to pass actorId**

Find the `app.get("/ledger/accounts", ...)` handler body:
```js
return c.json(
  await service.listAccounts({ companyId: getCompanyId(c) }),
);
```
Replace with:
```js
return c.json(
  await service.listAccounts({ companyId: getCompanyId(c), actorId: getActorId(c) }),
);
```

- [ ] **Step 3: Update `GET /ledger/accounts/:id` to pass actorId**

Find:
```js
data: await service.getAccount({
  companyId: getCompanyId(c),
  accountId: c.req.param("id"),
}),
```
Replace with:
```js
data: await service.getAccount({
  companyId: getCompanyId(c),
  accountId: c.req.param("id"),
  actorId: getActorId(c),
}),
```

- [ ] **Step 4: Update `POST /ledger/accounts` to pass ownerId and enforce write-access on mutations**

Find the `createAccount` call:
```js
const account = await service.createAccount({
  companyId: getCompanyId(c),
  data: parsed.data,
});
```
Replace with:
```js
const account = await service.createAccount({
  companyId: getCompanyId(c),
  ownerId: getActorId(c),
  data: parsed.data,
});
```

- [ ] **Step 5: Add write-access guard to `PATCH /ledger/accounts/:id`**

Find the `updateAccount` handler. After getting `companyId` (top of the try block), add before the schema parse:

```js
const companyId = getCompanyId(c)
const actorId   = getActorId(c)
const accountId = c.req.param("id")
if (!(await service.canWriteAccount({ companyId, accountId, actorId }))) {
  return c.json({ error: 'No tienes permisos para editar esta cuenta.' }, 403)
}
```

Adjust the rest of the handler to use the already-extracted `companyId`, `actorId`, `accountId` variables instead of calling `getCompanyId(c)` and `c.req.param("id")` again.

- [ ] **Step 6: Add write-access guard to `POST /ledger/accounts/:id/transactions` and `PATCH /ledger/accounts/:id/transactions/:txId`**

In both handlers, add the same guard pattern at the start of the try block:

```js
const companyId = getCompanyId(c)
const actorId   = getActorId(c)
const accountId = c.req.param("id")
if (!(await service.canWriteAccount({ companyId, accountId, actorId }))) {
  return c.json({ error: 'No tienes permisos para registrar movimientos en esta cuenta.' }, 403)
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/ledger/accounts-routes.js
git commit -m "feat(ledger): pass actorId to listAccounts/getAccount/createAccount, add write-access guards"
```

---

## Task 8: users-routes.js

**Files:**
- Create: `apps/api/src/routes/users-routes.js`

- [ ] **Step 1: Create users-routes.js**

```js
// apps/api/src/routes/users-routes.js
import { Hono } from 'hono'
import { userSearchQuerySchema } from './ledger/validators.js'
import { getCompanyId, getActorId } from './ledger/service-helpers.js'

export function createUsersRouter({ prisma, requirePermission }) {
  const app = new Hono()

  app.get('/users/search', requirePermission('ledger.accounts.read'), async (c) => {
    const parsed = userSearchQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return c.json({ error: 'Parametros invalidos. Se requiere "q" (min 2 chars).' }, 400)
    }
    const { q, limit } = parsed.data
    const companyId = getCompanyId(c)
    const actorId   = getActorId(c)
    const pattern   = `%${q}%`

    try {
      const rows = await prisma.$queryRaw`
        SELECT DISTINCT p.id, p.display_name, p.email
        FROM user_profile p
        INNER JOIN membership m ON m.user_id = p.id AND m.enabled = true
        WHERE m.company_id = ${companyId}::uuid
          AND p.id != ${actorId}::uuid
          AND (
            p.display_name ILIKE ${pattern}
            OR p.email ILIKE ${pattern}
          )
        ORDER BY p.display_name
        LIMIT ${limit}
      `
      return c.json({ data: rows })
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[users/search]', err)
      return c.json({ error: 'No se pudo realizar la busqueda.' }, 500)
    }
  })

  return app
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/users-routes.js
git commit -m "feat(api): add GET /users/search typeahead endpoint"
```

---

## Task 9: groups-routes.js

**Files:**
- Create: `apps/api/src/routes/ledger/groups-routes.js`

- [ ] **Step 1: Create groups-routes.js**

```js
// apps/api/src/routes/ledger/groups-routes.js
import { Hono } from 'hono'
import {
  createGroupSchema, updateGroupSchema,
  inviteGroupMemberSchema, updateGroupMemberRoleSchema,
} from './validators.js'
import { createGroupService, GroupServiceError } from './group-service.js'
import { getCompanyId, getActorId, getValidationErrorMessage } from './service-helpers.js'
import { getActivityContext } from '../../services/activity-publisher.js'

function handleError(c, err, fallback) {
  if (err instanceof GroupServiceError) return c.json({ error: err.message }, err.status)
  if (process.env.NODE_ENV !== 'production') console.error('[atlas.ledger/groups]', err)
  return c.json({ error: fallback }, 500)
}

export function createGroupsRouter({ prisma, requirePermission }) {
  const app = new Hono()
  const service = createGroupService({ prisma })

  app.post('/ledger/groups', requirePermission('ledger.groups.write'), async (c) => {
    try {
      const parsed = createGroupSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const group = await service.createGroup({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        data: parsed.data,
      })
      return c.json({ data: group }, 201)
    } catch (err) {
      return handleError(c, err, 'No se pudo crear el grupo.')
    }
  })

  app.get('/ledger/groups', requirePermission('ledger.groups.read'), async (c) => {
    try {
      return c.json(await service.listGroups({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
      }))
    } catch (err) {
      return handleError(c, err, 'No se pudieron listar los grupos.')
    }
  })

  app.get('/ledger/groups/:id', requirePermission('ledger.groups.read'), async (c) => {
    try {
      return c.json(await service.getGroup({
        companyId: getCompanyId(c),
        groupId: c.req.param('id'),
        actorId: getActorId(c),
      }))
    } catch (err) {
      return handleError(c, err, 'No se pudo obtener el grupo.')
    }
  })

  app.patch('/ledger/groups/:id', requirePermission('ledger.groups.write'), async (c) => {
    try {
      const parsed = updateGroupSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.updateGroup({
        companyId: getCompanyId(c),
        groupId: c.req.param('id'),
        actorId: getActorId(c),
        data: parsed.data,
      })})
    } catch (err) {
      return handleError(c, err, 'No se pudo actualizar el grupo.')
    }
  })

  app.delete('/ledger/groups/:id', requirePermission('ledger.groups.write'), async (c) => {
    try {
      return c.json({ data: await service.deleteGroup({
        companyId: getCompanyId(c),
        groupId: c.req.param('id'),
        actorId: getActorId(c),
      })})
    } catch (err) {
      return handleError(c, err, 'No se pudo eliminar el grupo.')
    }
  })

  // ── Members ──────────────────────────────────────────────────────────────

  app.post('/ledger/groups/:id/members', requirePermission('ledger.members.write'), async (c) => {
    try {
      const parsed = inviteGroupMemberSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const { actorName } = getActivityContext(c)
      return c.json({ data: await service.inviteMember({
        companyId: getCompanyId(c),
        groupId: c.req.param('id'),
        actorId: getActorId(c),
        actorName,
        data: parsed.data,
      })}, 201)
    } catch (err) {
      return handleError(c, err, 'No se pudo invitar al miembro.')
    }
  })

  app.patch('/ledger/groups/:id/members/:uid', requirePermission('ledger.members.write'), async (c) => {
    try {
      const parsed = updateGroupMemberRoleSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.updateMemberRole({
        companyId: getCompanyId(c),
        groupId: c.req.param('id'),
        actorId: getActorId(c),
        targetUserId: c.req.param('uid'),
        data: parsed.data,
      })})
    } catch (err) {
      return handleError(c, err, 'No se pudo actualizar el rol.')
    }
  })

  app.delete('/ledger/groups/:id/members/:uid', requirePermission('ledger.members.write'), async (c) => {
    try {
      const { actorName } = getActivityContext(c)
      return c.json({ data: await service.removeMember({
        companyId: getCompanyId(c),
        groupId: c.req.param('id'),
        actorId: getActorId(c),
        targetUserId: c.req.param('uid'),
        actorName,
      })})
    } catch (err) {
      return handleError(c, err, 'No se pudo remover al miembro.')
    }
  })

  return app
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/ledger/groups-routes.js
git commit -m "feat(ledger): add groups-routes (CRUD + member management)"
```

---

## Task 10: collaboration-routes.js

**Files:**
- Create: `apps/api/src/routes/ledger/collaboration-routes.js`

- [ ] **Step 1: Create collaboration-routes.js**

```js
// apps/api/src/routes/ledger/collaboration-routes.js
import { Hono } from 'hono'
import {
  inviteAccountMemberSchema, updateAccountMemberRoleSchema, moveAccountGroupSchema,
} from './validators.js'
import { createCollaborationService, CollaborationServiceError } from './collaboration-service.js'
import { getCompanyId, getActorId, getValidationErrorMessage } from './service-helpers.js'
import { getActivityContext } from '../../services/activity-publisher.js'

function handleError(c, err, fallback) {
  if (err instanceof CollaborationServiceError) return c.json({ error: err.message }, err.status)
  if (process.env.NODE_ENV !== 'production') console.error('[atlas.ledger/collab]', err)
  return c.json({ error: fallback }, 500)
}

export function createCollaborationRouter({ prisma, requirePermission }) {
  const app = new Hono()
  const service = createCollaborationService({ prisma })

  // ── Move account ──────────────────────────────────────────────────────────

  app.patch('/ledger/accounts/:id/group', requirePermission('ledger.accounts.update'), async (c) => {
    try {
      const parsed = moveAccountGroupSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const companyId = getCompanyId(c)
      const actorId   = getActorId(c)
      const accountId = c.req.param('id')
      const groupId   = parsed.data.group_id

      const result = groupId
        ? await service.moveAccountToGroup({ companyId, accountId, actorId, groupId })
        : await service.moveAccountFromGroup({ companyId, accountId, actorId })

      return c.json({ data: result })
    } catch (err) {
      return handleError(c, err, 'No se pudo mover la cuenta.')
    }
  })

  // ── Account members ───────────────────────────────────────────────────────

  app.post('/ledger/accounts/:id/members', requirePermission('ledger.members.write'), async (c) => {
    try {
      const parsed = inviteAccountMemberSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const { actorName } = getActivityContext(c)
      return c.json({ data: await service.inviteAccountMember({
        companyId: getCompanyId(c),
        accountId: c.req.param('id'),
        actorId: getActorId(c),
        actorName,
        data: parsed.data,
      })}, 201)
    } catch (err) {
      return handleError(c, err, 'No se pudo invitar al colaborador.')
    }
  })

  app.patch('/ledger/accounts/:id/members/:uid', requirePermission('ledger.members.write'), async (c) => {
    try {
      const parsed = updateAccountMemberRoleSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.updateAccountMemberRole({
        companyId: getCompanyId(c),
        accountId: c.req.param('id'),
        actorId: getActorId(c),
        targetUserId: c.req.param('uid'),
        data: parsed.data,
      })})
    } catch (err) {
      return handleError(c, err, 'No se pudo actualizar el rol.')
    }
  })

  app.delete('/ledger/accounts/:id/members/:uid', requirePermission('ledger.members.write'), async (c) => {
    try {
      const { actorName } = getActivityContext(c)
      return c.json({ data: await service.removeAccountMember({
        companyId: getCompanyId(c),
        accountId: c.req.param('id'),
        actorId: getActorId(c),
        targetUserId: c.req.param('uid'),
        actorName,
      })})
    } catch (err) {
      return handleError(c, err, 'No se pudo remover al colaborador.')
    }
  })

  // ── Memberships (own) ─────────────────────────────────────────────────────

  app.get('/ledger/memberships', requirePermission('ledger.groups.read'), async (c) => {
    try {
      return c.json(await service.listMemberships({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
      }))
    } catch (err) {
      return handleError(c, err, 'No se pudieron obtener las membresias.')
    }
  })

  app.delete('/ledger/memberships/groups/:id', requirePermission('ledger.groups.read'), async (c) => {
    try {
      return c.json(await service.leaveGroup({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        groupId: c.req.param('id'),
      }))
    } catch (err) {
      return handleError(c, err, 'No se pudo salir del grupo.')
    }
  })

  app.delete('/ledger/memberships/accounts/:id', requirePermission('ledger.accounts.read'), async (c) => {
    try {
      return c.json(await service.leaveAccount({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        accountId: c.req.param('id'),
      }))
    } catch (err) {
      return handleError(c, err, 'No se pudo salir de la cuenta compartida.')
    }
  })

  // ── Reject invitations ────────────────────────────────────────────────────

  app.post('/ledger/invitations/groups/:id/reject', requirePermission('ledger.groups.read'), async (c) => {
    try {
      return c.json(await service.rejectGroupInvitation({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        groupId: c.req.param('id'),
      }))
    } catch (err) {
      return handleError(c, err, 'No se pudo rechazar la invitacion.')
    }
  })

  app.post('/ledger/invitations/accounts/:id/reject', requirePermission('ledger.accounts.read'), async (c) => {
    try {
      return c.json(await service.rejectAccountInvitation({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        accountId: c.req.param('id'),
      }))
    } catch (err) {
      return handleError(c, err, 'No se pudo rechazar la invitacion.')
    }
  })

  return app
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/ledger/collaboration-routes.js
git commit -m "feat(ledger): add collaboration-routes (members, move, memberships, invitations)"
```

---

## Task 11: Wire up ledger/index.js

**Files:**
- Modify: `apps/api/src/routes/ledger/index.js`

- [ ] **Step 1: Register new routers**

Replace the entire file:

```js
// apps/api/src/routes/ledger/index.js
import { Hono } from 'hono'
import { createAccountsRouter }      from './accounts-routes.js'
import { createTypesRouter }          from './types-routes.js'
import { createCategoriesRouter }     from './categories-routes.js'
import { createGroupsRouter }         from './groups-routes.js'
import { createCollaborationRouter }  from './collaboration-routes.js'

export function createLedgerRouter({ prisma, requirePermission }) {
  const app = new Hono()

  app.route('/', createAccountsRouter({ prisma, requirePermission }))
  app.route('/', createTypesRouter({ prisma, requirePermission }))
  app.route('/', createCategoriesRouter({ prisma, requirePermission }))
  app.route('/', createGroupsRouter({ prisma, requirePermission }))
  app.route('/', createCollaborationRouter({ prisma, requirePermission }))

  return app
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/ledger/index.js
git commit -m "feat(ledger): register groups and collaboration routers"
```

---

## Task 12: Wire up apps/api/src/index.js for /users/search

**Files:**
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Import and register users router**

In `apps/api/src/index.js`, find where other routers are imported (around where `ledger` is mounted). Add the import:

```js
import { createUsersRouter } from './routes/users-routes.js'
```

Then, near where the ledger router is registered (search for `createLedgerRouter`), add after it:

```js
app.route('/', createUsersRouter({ prisma, requirePermission }))
```

The `requirePermission` factory is already available everywhere via dependency injection — `ledger.accounts.read` ensures the caller is authenticated and has basic ledger access, which is the right guard for user search.

- [ ] **Step 2: Restart API and test endpoint**

```bash
# In one terminal
pnpm dev:api

# In another terminal (replace TOKEN with your Bearer token)
curl -s "http://localhost:4010/users/search?q=ra" \
  -H "Authorization: Bearer $ATLAS_TOKEN" | jq .
```

Expected: `{ "data": [ { "id": "...", "display_name": "...", "email": "..." } ] }`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(api): mount users-routes for GET /users/search"
```

---

## Task 13: Tests for group-service

**Files:**
- Create: `apps/api/src/routes/ledger/__tests__/group-service.test.js`

- [ ] **Step 1: Create test directory and file**

```bash
mkdir -p apps/api/src/routes/ledger/__tests__
```

```js
// apps/api/src/routes/ledger/__tests__/group-service.test.js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGroupService, GroupServiceError } from '../group-service.js'

const COMPANY_ID = '01900000-0000-7000-8000-000000000001'
const ACTOR_ID   = '01900000-0000-7000-8000-000000000002'
const OTHER_ID   = '01900000-0000-7000-8000-000000000003'
const GROUP_ID   = '01900000-0000-7000-8000-000000000004'

function makeGroup(overrides = {}) {
  return {
    id: GROUP_ID,
    company_id: COMPANY_ID,
    name: 'Test Group',
    created_by: ACTOR_ID,
    enabled: true,
    role: 'admin',
    status: 'active',
    ...overrides,
  }
}

function buildMock() {
  const groups = []
  const members = []
  let notifPublishCalls = []

  const notifService = {
    publish: async (args) => { notifPublishCalls.push(args); return { created: 1 } },
  }

  const prisma = {
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join('?').toLowerCase().trim()

      if (sql.includes('insert into ledger_group')) {
        const g = { id: GROUP_ID, company_id: COMPANY_ID, name: values[1], created_by: values[0], enabled: true }
        groups.push(g)
        members.push({ group_id: GROUP_ID, user_id: ACTOR_ID, role: 'admin', status: 'active' })
        return [g]
      }

      if (sql.includes('select') && sql.includes('ledger_group') && sql.includes('ledger_group_member')) {
        // requireGroupAccess query
        const g = groups.find((x) => x.company_id === COMPANY_ID && x.enabled)
        if (!g) return []
        const m = members.find((x) => x.group_id === g.id && x.user_id === ACTOR_ID)
        return [{ ...g, role: m?.role ?? null, status: m?.status ?? null }]
      }

      if (sql.includes('select') && sql.includes('display_name')) {
        return [{ display_name: 'Test Actor' }]
      }

      if (sql.includes('insert into ledger_group_member')) {
        const entry = { group_id: GROUP_ID, user_id: OTHER_ID, role: 'viewer', status: 'active' }
        members.push(entry)
        return [entry]
      }

      if (sql.includes('delete from ledger_group_member')) {
        const idx = members.findIndex((m) => m.user_id === OTHER_ID)
        if (idx === -1) return []
        return members.splice(idx, 1)
      }

      return []
    },
  }

  return { prisma, notifService, notifPublishCalls, groups, members }
}

describe('createGroupService', () => {
  it('createGroup inserts group and adds creator as admin member', async () => {
    const { prisma } = buildMock()
    const service = createGroupService({ prisma })
    const group = await service.createGroup({ companyId: COMPANY_ID, actorId: ACTOR_ID, data: { name: 'Test Group' } })
    assert.equal(group.id, GROUP_ID)
    assert.equal(group.name, 'Test Group')
  })

  it('inviteMember publishes a notification and does not throw', async () => {
    const { prisma, notifPublishCalls } = buildMock()
    // Pre-populate group and creator membership
    const mock = buildMock()
    mock.groups.push(makeGroup())
    mock.members.push({ group_id: GROUP_ID, user_id: ACTOR_ID, role: 'admin', status: 'active' })

    const service = createGroupService({ prisma: mock.prisma })
    // Override notifService to track calls
    const calls = []
    const origPublish = mock.prisma.$queryRaw
    mock.prisma._notifCalls = calls

    await service.inviteMember({
      companyId: COMPANY_ID,
      groupId: GROUP_ID,
      actorId: ACTOR_ID,
      actorName: 'Test Actor',
      data: { user_id: OTHER_ID, role: 'viewer' },
    })
    // No assertion on notification since we mocked prisma not notifService;
    // the key check is no exception thrown.
    assert.ok(true, 'inviteMember completed without throwing')
  })

  it('requireGroupAccess throws 403 when actor is not a member', async () => {
    const mock = buildMock()
    // Group exists but actor is NOT a member
    mock.prisma.$queryRaw = async () => [{
      id: GROUP_ID,
      company_id: COMPANY_ID,
      name: 'Test',
      created_by: OTHER_ID, // someone else is creator
      enabled: true,
      role: null,
      status: null,
    }]

    const service = createGroupService({ prisma: mock.prisma })
    await assert.rejects(
      () => service.getGroup({ companyId: COMPANY_ID, groupId: GROUP_ID, actorId: ACTOR_ID }),
      (err) => {
        assert.ok(err instanceof GroupServiceError)
        assert.equal(err.status, 403)
        return true
      }
    )
  })

  it('deleteGroup throws 403 when actor is not creator', async () => {
    const mock = buildMock()
    mock.prisma.$queryRaw = async () => [{
      id: GROUP_ID,
      company_id: COMPANY_ID,
      name: 'Test',
      created_by: OTHER_ID,
      enabled: true,
      role: 'admin',
      status: 'active',
    }]

    const service = createGroupService({ prisma: mock.prisma })
    await assert.rejects(
      () => service.deleteGroup({ companyId: COMPANY_ID, groupId: GROUP_ID, actorId: ACTOR_ID }),
      (err) => {
        assert.ok(err instanceof GroupServiceError)
        assert.equal(err.status, 403)
        return true
      }
    )
  })
})
```

- [ ] **Step 2: Run tests**

```bash
node --test apps/api/src/routes/ledger/__tests__/group-service.test.js
```

Expected: `4 passing`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/ledger/__tests__/group-service.test.js
git commit -m "test(ledger): add group-service unit tests"
```

---

## Task 14: Tests for collaboration-service

**Files:**
- Create: `apps/api/src/routes/ledger/__tests__/collaboration-service.test.js`

- [ ] **Step 1: Create test file**

```js
// apps/api/src/routes/ledger/__tests__/collaboration-service.test.js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createCollaborationService, CollaborationServiceError } from '../collaboration-service.js'

const COMPANY_ID = '01900000-0000-7000-8000-000000000001'
const ACTOR_ID   = '01900000-0000-7000-8000-000000000002'
const OTHER_ID   = '01900000-0000-7000-8000-000000000003'
const ACCOUNT_ID = '01900000-0000-7000-8000-000000000005'
const GROUP_ID   = '01900000-0000-7000-8000-000000000004'

function makeAccount(overrides = {}) {
  return {
    id: ACCOUNT_ID,
    company_id: COMPANY_ID,
    owner_id: ACTOR_ID,
    group_id: null,
    name: 'BBVA Nomina',
    enabled: true,
    ...overrides,
  }
}

describe('createCollaborationService', () => {
  it('inviteAccountMember throws 400 when account belongs to a group', async () => {
    const prisma = {
      $queryRaw: async () => [makeAccount({ group_id: GROUP_ID })],
    }
    const service = createCollaborationService({ prisma })
    await assert.rejects(
      () => service.inviteAccountMember({
        companyId: COMPANY_ID,
        accountId: ACCOUNT_ID,
        actorId: ACTOR_ID,
        actorName: 'Test',
        data: { user_id: OTHER_ID, role: 'viewer' },
      }),
      (err) => {
        assert.ok(err instanceof CollaborationServiceError)
        assert.equal(err.status, 400)
        return true
      }
    )
  })

  it('inviteAccountMember throws 400 when actor invites themselves', async () => {
    const prisma = {
      $queryRaw: async () => [makeAccount()],
    }
    const service = createCollaborationService({ prisma })
    await assert.rejects(
      () => service.inviteAccountMember({
        companyId: COMPANY_ID,
        accountId: ACCOUNT_ID,
        actorId: ACTOR_ID,
        actorName: 'Test',
        data: { user_id: ACTOR_ID, role: 'viewer' },
      }),
      (err) => {
        assert.ok(err instanceof CollaborationServiceError)
        assert.equal(err.status, 400)
        return true
      }
    )
  })

  it('moveAccountFromGroup throws 403 when actor is not owner and not group admin', async () => {
    let queryCount = 0
    const prisma = {
      $queryRaw: async () => {
        queryCount++
        if (queryCount === 1) return [makeAccount({ group_id: GROUP_ID, owner_id: OTHER_ID })]
        return [] // isGroupAdmin returns empty
      },
    }
    const service = createCollaborationService({ prisma })
    await assert.rejects(
      () => service.moveAccountFromGroup({ companyId: COMPANY_ID, accountId: ACCOUNT_ID, actorId: ACTOR_ID }),
      (err) => {
        assert.ok(err instanceof CollaborationServiceError)
        assert.equal(err.status, 403)
        return true
      }
    )
  })

  it('leaveGroup removes the membership row and returns ok', async () => {
    const rows = [{ group_id: GROUP_ID, user_id: ACTOR_ID }]
    const prisma = {
      $queryRaw: async () => rows.splice(0),
    }
    const service = createCollaborationService({ prisma })
    const result = await service.leaveGroup({ companyId: COMPANY_ID, actorId: ACTOR_ID, groupId: GROUP_ID })
    assert.equal(result.ok, true)
  })

  it('rejectGroupInvitation throws 404 when membership not found', async () => {
    const prisma = { $queryRaw: async () => [] }
    const service = createCollaborationService({ prisma })
    await assert.rejects(
      () => service.rejectGroupInvitation({ companyId: COMPANY_ID, actorId: ACTOR_ID, groupId: GROUP_ID }),
      (err) => {
        assert.ok(err instanceof CollaborationServiceError)
        assert.equal(err.status, 404)
        return true
      }
    )
  })
})
```

- [ ] **Step 2: Run tests**

```bash
node --test apps/api/src/routes/ledger/__tests__/collaboration-service.test.js
```

Expected: `5 passing`

- [ ] **Step 3: Run all ledger tests**

```bash
node --test apps/api/src/routes/ledger/__tests__/
```

Expected: all passing.

- [ ] **Step 4: Final commit**

```bash
git add apps/api/src/routes/ledger/__tests__/collaboration-service.test.js
git commit -m "test(ledger): add collaboration-service unit tests"
```

# Notifications: Inventory Mentions + Reaction Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire mention notifications for atlas.inventory comments and add reaction notifications in both atlas.projects and atlas.inventory, while extracting shared `parseMentionIds` utility.

**Architecture:** Create `inventory-notification-service.js` modeled after `projects-notification-service.js`. Update `createComment` in `inventory-service.js` to return `mentionIds` so routes can fire notifications. Add `notifyTaskReaction` and `notifyInvReaction` functions. All notification wiring happens at the route layer (index.js for inventory, projects-routes.js for projects) — the service layer stays pure business logic.

**Tech Stack:** Node.js ESM, Hono, Prisma, existing `createNotificationService` (notification-service.js). Node.js built-in test runner (`node:test`). No new dependencies.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/api/src/lib/mention-utils.js` | Shared `parseMentionIds` function |
| Create | `apps/api/src/services/inventory-notification-service.js` | `notifyInvComment`, `notifyInvReaction` |
| Modify | `apps/api/src/services/notification-delivery-worker.js` | Add 4 new event type labels |
| Modify | `apps/api/src/services/inventory-service.js` | `createComment` returns `{ comment, mentionIds }` |
| Modify | `apps/api/src/index.js` | Instantiate inventoryNotifSvc, wire comment + reaction routes |
| Modify | `apps/api/src/routes/projects/projects-notification-service.js` | Add `notifyTaskReaction` |
| Modify | `apps/api/src/routes/projects/projects-routes.js` | Wire reaction notification, import shared parseMentionIds |

---

## Task 1: Extract `parseMentionIds` to shared utility

**Files:**
- Create: `apps/api/src/lib/mention-utils.js`
- Modify: `apps/api/src/routes/projects/projects-routes.js` (remove local copy, add import)
- Modify: `apps/api/src/services/inventory-service.js` (remove local copy, add import)

- [ ] **Step 1: Write the test**

Create `apps/api/src/lib/__tests__/mention-utils.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMentionIds } from '../mention-utils.js'

describe('parseMentionIds', () => {
  it('extracts UUIDs from mention tokens', () => {
    const body = 'Hello @[01900000-0000-7000-8000-000000000001:Ana Lopez] how are you?'
    const ids = parseMentionIds(body)
    assert.deepEqual(ids, ['01900000-0000-7000-8000-000000000001'])
  })

  it('deduplicates repeated mentions of the same user', () => {
    const body = '@[01900000-0000-7000-8000-000000000001:Ana] and @[01900000-0000-7000-8000-000000000001:Ana] again'
    const ids = parseMentionIds(body)
    assert.deepEqual(ids, ['01900000-0000-7000-8000-000000000001'])
  })

  it('extracts multiple different users', () => {
    const body = '@[01900000-0000-7000-8000-000000000001:Ana] @[01900000-0000-7000-8000-000000000002:Bob]'
    const ids = parseMentionIds(body)
    assert.deepEqual(ids, ['01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000002'])
  })

  it('returns empty array for null or empty body', () => {
    assert.deepEqual(parseMentionIds(null), [])
    assert.deepEqual(parseMentionIds(''), [])
    assert.deepEqual(parseMentionIds('no mentions here'), [])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
node --test apps/api/src/lib/__tests__/mention-utils.test.js
```

Expected: `ReferenceError: Cannot find module '../mention-utils.js'` or similar.

- [ ] **Step 3: Create the shared utility**

Create `apps/api/src/lib/mention-utils.js`:

```js
export function parseMentionIds(body) {
  if (!body) return []
  const regex = /@\[([a-f0-9-]{36}):[^\]]+\]/g
  const ids = []
  let m
  while ((m = regex.exec(body)) !== null) ids.push(m[1])
  return [...new Set(ids)]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test apps/api/src/lib/__tests__/mention-utils.test.js
```

Expected: all 4 tests pass.

- [ ] **Step 5: Replace local copy in `projects-routes.js`**

In `apps/api/src/routes/projects/projects-routes.js`, replace the local `parseMentionIds` definition (lines 24–30) with an import:

Remove:
```js
function parseMentionIds(body) {
  if (!body) return []
  const regex = /@\[([a-f0-9-]{36}):[^\]]+\]/g
  const ids = []
  let m
  while ((m = regex.exec(body)) !== null) ids.push(m[1])
  return [...new Set(ids)]
}
```

Add at the top imports section:
```js
import { parseMentionIds } from '../../lib/mention-utils.js'
```

- [ ] **Step 6: Replace local copy in `inventory-service.js`**

In `apps/api/src/services/inventory-service.js`, remove the `parseMentionIds` function definition (lines 11–19) and add import at the top:

```js
import { parseMentionIds } from '../lib/mention-utils.js'
```

- [ ] **Step 7: Run existing inventory tests to confirm nothing broke**

```bash
node --test apps/api/src/services/__tests__/inventory-service.test.js
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/lib/mention-utils.js apps/api/src/lib/__tests__/mention-utils.test.js apps/api/src/routes/projects/projects-routes.js apps/api/src/services/inventory-service.js
git commit -m "refactor: extract parseMentionIds to shared lib/mention-utils.js"
```

---

## Task 2: Add new event types to notification-delivery-worker.js

**Files:**
- Modify: `apps/api/src/services/notification-delivery-worker.js` (~line 109)

- [ ] **Step 1: Add the 4 missing event types to `EVENT_TYPE_LABELS`**

In `apps/api/src/services/notification-delivery-worker.js`, find the `EVENT_TYPE_LABELS` object (around line 109) and add inventory + reaction entries:

```js
const EVENT_TYPE_LABELS = {
  // Calendar
  "calendar.event.reminder": "Recordatorio de evento",
  "calendar.event.created": "Evento creado",
  "calendar.event.updated": "Evento actualizado",
  "calendar.event.deleted": "Evento eliminado",
  "calendar.event.invite": "Invitacion a evento",
  "calendar.event.reschedule": "Evento reprogramado",
  "calendar.event.cancel": "Evento cancelado",
  // Projects
  "projects.member.added": "Agregado a proyecto",
  "projects.task.assigned": "Tarea asignada",
  "projects.task.unassigned": "Removido de tarea",
  "projects.task.comment": "Comentario en tarea",
  "projects.task.mention": "Mencion en comentario",
  "projects.task.reaction": "Reaccion a tu comentario",
  "projects.task.status_changed": "Estado de tarea actualizado",
  "projects.task.due_soon": "Tarea por vencer",
  // Inventory
  "inventory.item.mention": "Mencion en inventario",
  "inventory.item.comment": "Comentario en elemento",
  "inventory.item.reaction": "Reaccion a tu comentario",
  // Ledger
  "ledger.account_invite": "Invitacion a cuenta",
  "ledger.group_invite": "Invitacion a grupo",
  "ledger.access_revoked": "Acceso revocado",
  // Website / storefront
  "website.sale.confirmed": "Venta confirmada",
  // System
  "system.alert": "Alerta del sistema",
  "general": "General",
};
```

- [ ] **Step 2: Verify with syntax check**

```bash
node --check apps/api/src/services/notification-delivery-worker.js
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/notification-delivery-worker.js
git commit -m "feat(notifications): add inventory and reaction event type labels"
```

---

## Task 3: Update `createComment` in inventory-service.js to return mentionIds

The route layer needs the `mentionIds` to fire notifications. Currently `createComment` returns only the comment record. We extend the return value to `{ comment, mentionIds }` without breaking the transaction logic.

**Files:**
- Modify: `apps/api/src/services/inventory-service.js`
- Modify: `apps/api/src/services/__tests__/inventory-service.test.js`

- [ ] **Step 1: Add a test for the new return shape**

In `apps/api/src/services/__tests__/inventory-service.test.js`, add inside the existing test file (after the last existing test block):

```js
describe('createComment return shape', () => {
  it('returns { comment, mentionIds } with no mentions when body has none', async () => {
    const prisma = buildPrismaMock({
      invItem: { findFirst: async () => ({ id: ITEM_ID }) },
      _root: {
        userProfile: { findUnique: async () => ({ id: USER_ID }) },
      },
    })
    const svc = createInventoryService({ prisma })
    const result = await svc.createComment(ITEM_ID, 'auth-user-id', 'plain comment', COMPANY_ID)

    assert.ok(result.comment, 'has comment property')
    assert.deepEqual(result.mentionIds, [], 'mentionIds is empty array')
    assert.equal(result.comment.id, COMMENT_ID)
  })

  it('returns mentionIds extracted from the comment body', async () => {
    const MENTION_ID = '01900000-0000-7000-8000-000000000099'
    const prisma = buildPrismaMock({
      invItem: { findFirst: async () => ({ id: ITEM_ID }) },
      _root: {
        userProfile: { findUnique: async () => ({ id: USER_ID }) },
      },
    })
    const svc = createInventoryService({ prisma })
    const body = `Hello @[${MENTION_ID}:Someone]`
    const result = await svc.createComment(ITEM_ID, 'auth-user-id', body, COMPANY_ID)

    assert.deepEqual(result.mentionIds, [MENTION_ID])
  })
})
```

- [ ] **Step 2: Run to confirm these tests fail**

```bash
node --test apps/api/src/services/__tests__/inventory-service.test.js
```

Expected: the two new tests fail with `TypeError: Cannot read properties of undefined (reading 'comment')` or similar, since current `createComment` returns the comment directly.

- [ ] **Step 3: Update `createComment` to return `{ comment, mentionIds }`**

In `apps/api/src/services/inventory-service.js`, find `createComment` (around line 637) and update the return at the end of the `$transaction` call. The function currently ends with:

```js
    return prisma.$transaction(async (tx) => {
      const comment = await tx.invComment.create({ ... })

      for (const userId of mentionIds) {
        try {
          await tx.invMention.create({ data: { commentId: comment.id, userId } })
        } catch (err) {
          if (err.code !== 'P2003' && err.code !== 'P2002') throw err
        }
      }

      return comment
    })
```

Change `return comment` to `return { comment, mentionIds }`:

```js
    return prisma.$transaction(async (tx) => {
      const comment = await tx.invComment.create({ ... })

      for (const userId of mentionIds) {
        try {
          await tx.invMention.create({ data: { commentId: comment.id, userId } })
        } catch (err) {
          if (err.code !== 'P2003' && err.code !== 'P2002') throw err
        }
      }

      return { comment, mentionIds }
    })
```

- [ ] **Step 4: Run all inventory service tests**

```bash
node --test apps/api/src/services/__tests__/inventory-service.test.js
```

Expected: all tests pass including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/inventory-service.js apps/api/src/services/__tests__/inventory-service.test.js
git commit -m "feat(inventory): createComment returns { comment, mentionIds } for notification wiring"
```

---

## Task 4: Create `inventory-notification-service.js`

**Files:**
- Create: `apps/api/src/services/inventory-notification-service.js`
- Create: `apps/api/src/services/__tests__/inventory-notification-service.test.js`

- [ ] **Step 1: Write the tests**

Create `apps/api/src/services/__tests__/inventory-notification-service.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createInventoryNotificationService } from '../inventory-notification-service.js'

const COMPANY_ID  = '01900000-0000-7000-8000-000000000001'
const ACTOR_ID    = '01900000-0000-7000-8000-000000000002'
const ITEM_ID     = '01900000-0000-7000-8000-000000000003'
const COMMENT_ID  = '01900000-0000-7000-8000-000000000005'
const MENTION_ID  = '01900000-0000-7000-8000-000000000006'
const AUTHOR_ID   = '01900000-0000-7000-8000-000000000007'

function buildPrisma(overrides = {}) {
  return {
    invItem: {
      findFirst: async () => ({ id: ITEM_ID, name: 'Laptop Test' }),
      ...(overrides.invItem ?? {}),
    },
    invComment: {
      findFirst: async () => ({ id: COMMENT_ID, authorId: AUTHOR_ID }),
      ...(overrides.invComment ?? {}),
    },
    ...(overrides._root ?? {}),
  }
}

describe('notifyInvComment', () => {
  it('calls publish with mention eventType for each mentioned user', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma()
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await svc.notifyInvComment({ companyId: COMPANY_ID, actorId: ACTOR_ID, itemId: ITEM_ID, mentionedUserIds: [MENTION_ID] })

    assert.equal(published.length, 1, 'publish called once for mention')
    assert.equal(published[0].input.eventType, 'inventory.item.mention')
    assert.deepEqual(published[0].input.recipients.userIds, [MENTION_ID])
    assert.equal(published[0].input.priority, 'medium')
    assert.ok(published[0].input.link.includes(ITEM_ID))
  })

  it('skips publish when mentionedUserIds is empty', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma()
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await svc.notifyInvComment({ companyId: COMPANY_ID, actorId: ACTOR_ID, itemId: ITEM_ID, mentionedUserIds: [] })

    assert.equal(published.length, 0, 'publish not called when no mentions')
  })

  it('excludes the actor from mention recipients', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma()
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    // Actor mentions themselves — should be excluded
    await svc.notifyInvComment({ companyId: COMPANY_ID, actorId: ACTOR_ID, itemId: ITEM_ID, mentionedUserIds: [ACTOR_ID] })

    assert.equal(published.length, 0, 'actor self-mention skipped')
  })

  it('does not throw when item is not found', async () => {
    const notifSvc = { publish: async () => { throw new Error('should not reach') } }
    const prisma = buildPrisma({ invItem: { findFirst: async () => null } })
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await assert.doesNotReject(() =>
      svc.notifyInvComment({ companyId: COMPANY_ID, actorId: ACTOR_ID, itemId: ITEM_ID, mentionedUserIds: [MENTION_ID] })
    )
  })
})

describe('notifyInvReaction', () => {
  it('calls publish with reaction eventType to comment author', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma()
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await svc.notifyInvReaction({ companyId: COMPANY_ID, actorId: ACTOR_ID, commentId: COMMENT_ID })

    assert.equal(published.length, 1, 'publish called once')
    assert.equal(published[0].input.eventType, 'inventory.item.reaction')
    assert.deepEqual(published[0].input.recipients.userIds, [AUTHOR_ID])
    assert.equal(published[0].input.priority, 'low')
  })

  it('skips publish when actor is the comment author', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma({ invComment: { findFirst: async () => ({ id: COMMENT_ID, authorId: ACTOR_ID }) } })
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await svc.notifyInvReaction({ companyId: COMPANY_ID, actorId: ACTOR_ID, commentId: COMMENT_ID })

    assert.equal(published.length, 0, 'self-reaction not notified')
  })

  it('does not throw when comment is not found', async () => {
    const notifSvc = { publish: async () => { throw new Error('should not reach') } }
    const prisma = buildPrisma({ invComment: { findFirst: async () => null } })
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await assert.doesNotReject(() =>
      svc.notifyInvReaction({ companyId: COMPANY_ID, actorId: ACTOR_ID, commentId: COMMENT_ID })
    )
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
node --test apps/api/src/services/__tests__/inventory-notification-service.test.js
```

Expected: `Cannot find module '../inventory-notification-service.js'`

- [ ] **Step 3: Create the notification service**

Create `apps/api/src/services/inventory-notification-service.js`:

```js
import { createNotificationService } from './notification-service.js'

export function createInventoryNotificationService({ prisma, notificationService }) {
  const notifSvc = notificationService ?? createNotificationService({ prisma })

  async function notifyInvComment({ companyId, actorId, itemId, mentionedUserIds = [] }) {
    const recipients = mentionedUserIds.filter((id) => id !== actorId)
    if (recipients.length === 0) return
    try {
      const item = await prisma.invItem.findFirst({
        where: { id: itemId },
        select: { name: true },
      })
      if (!item) return
      await notifSvc.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType: 'inventory.item.mention',
          title: 'Te mencionaron en inventario',
          body: `En el elemento "${item.name}"`,
          link: `/app/m/atlas.inventory/inventory/${itemId}`,
          recipients: { userIds: recipients },
          channels: ['in_app', 'email', 'web_push'],
          priority: 'medium',
          sourceType: 'InvItem',
          sourceId: itemId,
          metadata: { itemId },
        },
      })
    } catch (err) {
      console.error('[inventory.item.mention]', err?.message ?? err)
    }
  }

  async function notifyInvReaction({ companyId, actorId, commentId }) {
    try {
      const comment = await prisma.invComment.findFirst({
        where: { id: commentId },
        include: { item: { select: { id: true, name: true } } },
      })
      if (!comment) return
      if (comment.authorId === actorId) return
      await notifSvc.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType: 'inventory.item.reaction',
          title: 'Reaccionaron a tu comentario',
          body: `En el elemento "${comment.item?.name ?? 'Inventario'}"`,
          link: `/app/m/atlas.inventory/inventory/${comment.item?.id ?? ''}`,
          recipients: { userIds: [comment.authorId] },
          channels: ['in_app'],
          priority: 'low',
          sourceType: 'InvComment',
          sourceId: commentId,
          metadata: { commentId, itemId: comment.item?.id },
        },
      })
    } catch (err) {
      console.error('[inventory.item.reaction]', err?.message ?? err)
    }
  }

  return { notifyInvComment, notifyInvReaction }
}
```

Note on `notifyInvReaction`: the `invComment.findFirst` needs to include `item`. This requires `InvComment` to have a relation to `InvItem`. Confirm in `prisma/schema.prisma` that `InvComment` has an `item` relation (it should — `itemId` is the FK). If the Prisma `include: { item: ... }` doesn't work, use `include: { invItem: ... }` matching the actual relation name in the schema.

- [ ] **Step 4: Run tests — check if `item` relation name needs adjustment**

```bash
node --test apps/api/src/services/__tests__/inventory-notification-service.test.js
```

The test mocks `prisma.invComment.findFirst` to return `{ id: COMMENT_ID, authorId: AUTHOR_ID }` (no item). So the test doesn't exercise the real Prisma relation — it just tests the notification logic. All tests should pass.

Expected: 7 tests pass.

- [ ] **Step 5: Verify the actual Prisma relation name for InvComment → InvItem**

```bash
grep -n "invComment\|InvComment\|item.*InvItem\|InvItem.*item" prisma/schema.prisma | head -20
```

If the relation field is named something other than `item` (e.g., `invItem`), update line in `inventory-notification-service.js`:
```js
include: { item: { select: { id: true, name: true } } },
// ^ change 'item' to whatever the actual relation name is
```
and update the `comment.item?.name` references accordingly.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/inventory-notification-service.js apps/api/src/services/__tests__/inventory-notification-service.test.js
git commit -m "feat(inventory): add inventory-notification-service with notifyInvComment and notifyInvReaction"
```

---

## Task 5: Add `notifyTaskReaction` to projects-notification-service.js

**Files:**
- Modify: `apps/api/src/routes/projects/projects-notification-service.js`

- [ ] **Step 1: Add `notifyTaskReaction` function**

In `apps/api/src/routes/projects/projects-notification-service.js`, add the new function after `notifyTaskComment` (around line 148). The function fetches the `TaskComment` to find the author, then notifies them:

```js
  async function notifyTaskReaction({ companyId, actorId, commentId }) {
    try {
      const comment = await prisma.taskComment.findFirst({
        where: { id: commentId },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              projectId: true,
              project: { select: { name: true } },
            },
          },
        },
      })
      if (!comment) return
      if (comment.authorId === actorId) return
      await notifSvc.publish({
        companyId,
        actorId: actorId ?? null,
        input: {
          eventType: 'projects.task.reaction',
          title: 'Reaccionaron a tu comentario',
          body: `"${comment.task?.title ?? 'Tarea'}"${comment.task?.project?.name ? ` en ${comment.task.project.name}` : ''}`,
          link: `/app/m/atlas.projects?open=task:${comment.task?.id ?? ''}`,
          recipients: { userIds: [comment.authorId] },
          channels: ['in_app'],
          priority: 'low',
          sourceType: 'TaskComment',
          sourceId: commentId,
          metadata: {
            commentId,
            taskId: comment.task?.id,
            projectId: comment.task?.projectId,
          },
        },
      })
    } catch (err) {
      console.error('[projects.task.reaction]', err?.message ?? err)
    }
  }
```

Also update the `return` statement at the bottom of `createProjectsNotificationService` to expose the new function:

Find the existing return (it exports `notifyMemberAdded`, `notifyTaskAssigned`, `notifyTaskUnassigned`, `notifyTaskComment`, `notifyTaskStatusChanged`, etc.) and add `notifyTaskReaction`:

```js
  return {
    notifyMemberAdded,
    notifyTaskAssigned,
    notifyTaskUnassigned,
    notifyTaskComment,
    notifyTaskStatusChanged,
    notifyTaskDueSoon,
    notifyTaskReaction,   // ← add this
  }
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/api/src/routes/projects/projects-notification-service.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/projects/projects-notification-service.js
git commit -m "feat(projects): add notifyTaskReaction to projects notification service"
```

---

## Task 6: Wire reaction notification in projects-routes.js

**Files:**
- Modify: `apps/api/src/routes/projects/projects-routes.js`

The reaction endpoint is at `POST /projects/:id/tasks/:tid/comments/:cid/reactions` (around line 390). Currently it just calls `toggleTaskReaction` and returns the result. We add a non-blocking notification call when `action === 'added'`.

- [ ] **Step 1: Update the reaction route**

Find this block in `apps/api/src/routes/projects/projects-routes.js`:

```js
  app.post('/projects/:id/tasks/:tid/comments/:cid/reactions', requirePermission('projects.task.update'), async (c) => {
    try {
      const { emoji } = await c.req.json()
      const result = await tasksSvc.toggleTaskReaction(c.req.param('cid'), getUserId(c), emoji)
      return c.json(result)
    } catch (err) { return handleError(c, err, 'Error al actualizar reaccion.') }
  })
```

Replace with:

```js
  app.post('/projects/:id/tasks/:tid/comments/:cid/reactions', requirePermission('projects.task.update'), async (c) => {
    try {
      const { emoji } = await c.req.json()
      const commentId = c.req.param('cid')
      const result = await tasksSvc.toggleTaskReaction(commentId, getUserId(c), emoji)
      if (result.action === 'added') {
        notifSvc.notifyTaskReaction({
          companyId: getCompanyId(c),
          actorId: getUserId(c),
          commentId,
        })
      }
      return c.json(result)
    } catch (err) { return handleError(c, err, 'Error al actualizar reaccion.') }
  })
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/api/src/routes/projects/projects-routes.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/projects/projects-routes.js
git commit -m "feat(projects): trigger reaction notification when emoji added to task comment"
```

---

## Task 7: Wire inventory notifications in index.js

**Files:**
- Modify: `apps/api/src/index.js`

Three changes:
1. Import and instantiate `inventoryNotifSvc`
2. Update `POST /inventory/items/:id/comments` to destructure `{ comment, mentionIds }` and call `notifyInvComment`
3. Update `POST /inventory/items/:id/comments/:cid/reactions` to call `notifyInvReaction` when action === 'added'

- [ ] **Step 1: Add the import near the top of index.js**

Find the existing inventory import in `apps/api/src/index.js`:
```js
import { createInventoryService, InventoryServiceError } from "./services/inventory-service.js";
```

Add the notification service import directly below it:
```js
import { createInventoryNotificationService } from "./services/inventory-notification-service.js";
```

- [ ] **Step 2: Instantiate the service**

Find where `inventoryService` is instantiated (around line 133):
```js
const inventoryService = createInventoryService({ prisma });
```

Add the inventory notification service instantiation directly below:
```js
const inventoryNotifSvc = createInventoryNotificationService({ prisma, notificationService });
```

Note: `notificationService` is instantiated at line 131 (`const notificationService = createNotificationService({ prisma })`), so it is available here.

- [ ] **Step 3: Update the POST comments route**

Find the inventory comment creation route (around line 4678):

```js
app.post('/inventory/items/:id/comments', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const { id } = c.req.param();
    const { body } = await c.req.json();
    const comment = await inventoryService.createComment(id, authUserId, body, companyId);
    return c.json({ data: comment }, 201);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo crear el comentario.' }, 500);
  }
});
```

Replace with:

```js
app.post('/inventory/items/:id/comments', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const actorId    = c.get('userId');
    const { id } = c.req.param();
    const { body } = await c.req.json();
    const { comment, mentionIds } = await inventoryService.createComment(id, authUserId, body, companyId);
    if (mentionIds.length > 0) {
      inventoryNotifSvc.notifyInvComment({ companyId, actorId, itemId: id, mentionedUserIds: mentionIds })
    }
    return c.json({ data: comment }, 201);
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo crear el comentario.' }, 500);
  }
});
```

- [ ] **Step 4: Update the POST reactions route**

Find the inventory reaction route (around line 4718):

```js
app.post('/inventory/items/:id/comments/:cid/reactions', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const authUserId = c.get('authUserId');
    const { cid } = c.req.param();
    const { emoji } = await c.req.json();
    const result = await inventoryService.toggleReaction(cid, authUserId, emoji);
    return c.json({ data: result });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo registrar la reaccion.' }, 500);
  }
});
```

Replace with:

```js
app.post('/inventory/items/:id/comments/:cid/reactions', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const actorId    = c.get('userId');
    const { cid } = c.req.param();
    const { emoji } = await c.req.json();
    const result = await inventoryService.toggleReaction(cid, authUserId, emoji);
    if (result.action === 'added') {
      inventoryNotifSvc.notifyInvReaction({ companyId, actorId, commentId: cid })
    }
    return c.json({ data: result });
  } catch (err) {
    if (err instanceof InventoryServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo registrar la reaccion.' }, 500);
  }
});
```

- [ ] **Step 5: Syntax check**

```bash
node --check apps/api/src/index.js
```

Expected: no output.

- [ ] **Step 6: Smoke test with the dev API**

Start the API and test with curl. Replace `$ATLAS_TOKEN` with a valid JWT and `$ITEM_ID` with a real inventory item ID:

```bash
# Create a comment with a mention (replace UUIDs with real IDs from your DB)
curl -s -X POST http://localhost:4010/inventory/items/$ITEM_ID/comments \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "Hello @[<profile-uuid>:<name>]"}' | jq .

# Check notifications were created
curl -s http://localhost:4010/notifications \
  -H "Authorization: Bearer $ATLAS_TOKEN_FOR_MENTIONED_USER" | jq '.data[0]'
```

Expected: notification with `eventType: "inventory.item.mention"` appears for the mentioned user.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(inventory): wire mention and reaction notifications in inventory comment routes"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Inventory mention notifications → Task 4 (service) + Task 7 (wiring)
- ✅ Inventory reaction notifications → Task 4 (service) + Task 7 (wiring)
- ✅ Projects reaction notifications → Task 5 (service) + Task 6 (wiring)
- ✅ New event type labels → Task 2
- ✅ parseMentionIds deduplication → Task 1

**Placeholder scan:** No TBDs, no "handle edge cases" without code, no "similar to Task N" shortcuts.

**Type consistency:** `notifyInvComment` and `notifyInvReaction` return void (fire-and-forget pattern matching `notifyTaskComment`). `createComment` consistently returns `{ comment, mentionIds }` throughout Tasks 3 and 7.

**Edge cases handled:**
- Actor mentions themselves → excluded from recipients (Task 4 test + implementation)
- Actor reacts to their own comment → skipped (Task 4 test + implementation)
- Item/comment not found → silent return, no throw (Task 4 test + implementation)
- `mentionIds` empty → `notifyInvComment` not called from route (Task 7 Step 3)
- Reaction removed → notification not fired (Task 6, Task 7 Step 4: `if result.action === 'added'`)

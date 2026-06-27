# Realtime v2 — Plan A: API Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-side `RealtimeBroadcaster` service that fires HTTP broadcasts to Supabase Realtime after every relevant write (notifications, chat messages, chat conversations, project tasks).

**Architecture:** The broadcaster sends a single HTTP POST to `{SUPABASE_URL}/realtime/v1/api/broadcast` with the service role key. No WebSocket, no persistent connection on the server. The broadcaster is passed as an optional dependency to existing services; if absent, they behave exactly as before.

**Spec:** `docs/superpowers/specs/2026-06-26-realtime-v2-design.md`
**Plan B (frontend):** `docs/superpowers/plans/2026-06-26-realtime-v2-plan-b-frontend.md`

**Tech Stack:** Node.js ESM, Hono, `fetch` (built-in Node ≥ 18)

---

## File map

| File | Action | What changes |
|---|---|---|
| `apps/api/src/services/realtime-broadcaster.js` | **Create** | REST broadcast wrapper |
| `apps/api/src/services/notification-service.js` | **Modify** | Accept `broadcaster`, call after `publish()` |
| `apps/api/src/routes/chat/chat-service.js` | **Modify** | Accept `broadcaster`, call after `sendMessage()` and `createConversation()` |
| `apps/api/src/routes/chat/index.js` | **Modify** | Pass `broadcaster` to `createChatService` |
| `apps/api/src/routes/projects/projects-routes.js` | **Modify** | Call broadcaster after task create/update/delete |
| `apps/api/src/index.js` | **Modify** | Instantiate broadcaster, pass to notification-service, chat-router, projects-router |

---

## Task 1: Create `realtime-broadcaster.js`

**Files:**
- Create: `apps/api/src/services/realtime-broadcaster.js`

- [ ] **Step 1: Create the file**

```js
// apps/api/src/services/realtime-broadcaster.js

export function createRealtimeBroadcaster({ supabaseUrl, serviceRoleKey }) {
  const endpoint = `${supabaseUrl}/realtime/v1/api/broadcast`

  async function _send(messages) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({ messages }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(`[realtime-broadcaster] broadcast failed status=${res.status}`, text.slice(0, 200))
    }
  }

  async function broadcastToUser(profileId, event, payload) {
    if (!profileId) return
    await _send([{
      topic: `realtime:user:${profileId}:events`,
      event,
      payload: payload ?? {},
    }]).catch((err) => {
      console.warn('[realtime-broadcaster] broadcastToUser error:', err?.message)
    })
  }

  async function broadcastToUsers(profileIds, event, payload) {
    const ids = (profileIds ?? []).filter(Boolean)
    if (!ids.length) return
    await _send(
      ids.map((id) => ({
        topic: `realtime:user:${id}:events`,
        event,
        payload: payload ?? {},
      })),
    ).catch((err) => {
      console.warn('[realtime-broadcaster] broadcastToUsers error:', err?.message)
    })
  }

  return { broadcastToUser, broadcastToUsers }
}

export function createNoopBroadcaster() {
  return {
    broadcastToUser: async () => {},
    broadcastToUsers: async () => {},
  }
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/api/src/services/realtime-broadcaster.js
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/realtime-broadcaster.js
git commit -m "feat(realtime): add RealtimeBroadcaster service (REST HTTP, no WS)"
```

---

## Task 2: Update `notification-service.js` to broadcast on publish

**Files:**
- Modify: `apps/api/src/services/notification-service.js`

The `createNotificationService` factory receives an optional `broadcaster`. After the transaction that creates notification rows, it calls `broadcastToUsers` fire-and-forget. The payload includes enough for the frontend to show a badge update without refetching — the actual refetch happens on `queryClient.invalidateQueries`.

- [ ] **Step 1: Add `broadcaster` parameter and call after publish**

Find the line:
```js
export function createNotificationService({ prisma }) {
```

Change to:
```js
export function createNotificationService({ prisma, broadcaster = null }) {
```

Find the `return` statement at the end of `publish()`:
```js
    return {
      created: result.created.length,
      deduped: result.deduped,
      data: result.created.map(toNotificationView),
      actorId,
    };
```

Replace with:
```js
    const publishResult = {
      created: result.created.length,
      deduped: result.deduped,
      data: result.created.map(toNotificationView),
      actorId,
    };

    if (broadcaster && result.created.length > 0) {
      const recipientIds = result.created.map((n) => n.userId)
      broadcaster.broadcastToUsers(recipientIds, 'notification.new', {
        eventType: parsed.eventType,
        title: parsed.title,
        body: parsed.body ?? null,
        priority: parsed.priority ?? 'medium',
        link: parsed.link ?? null,
      }).catch(() => {})
    }

    return publishResult;
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/api/src/services/notification-service.js
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/notification-service.js
git commit -m "feat(realtime): broadcast notification.new after publish"
```

---

## Task 3: Update `chat-service.js` to broadcast on sendMessage and createConversation

**Files:**
- Modify: `apps/api/src/routes/chat/chat-service.js`

The chat service needs two broadcast calls:
1. After `sendMessage` — `chat.message.new` to all conversation members
2. After `createConversation` — `chat.conversation.new` to all members

- [ ] **Step 1: Add `broadcaster` parameter**

Find:
```js
export function createChatService({ prisma, supabaseAdmin, notificationService = null }) {
```

Change to:
```js
export function createChatService({ prisma, supabaseAdmin, notificationService = null, broadcaster = null }) {
```

- [ ] **Step 2: Add helper to get conversation member user IDs**

Add this helper function right after the existing `updateConversationLastMessage` helper (around line 48):

```js
  async function getConversationMemberIds(conversationId) {
    const rows = await prisma.$queryRaw`
      SELECT user_id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId} AND left_at IS NULL AND user_id IS NOT NULL
    `
    return rows.map((r) => r.user_id.toString())
  }
```

- [ ] **Step 3: Broadcast after sendMessage**

In `sendMessage`, find the existing `setImmediate` block that publishes in-app notifications (starting at line ~516):

```js
    // Notify other members (fire-and-forget — don't fail the send on notification error)
    if (notificationService) {
      setImmediate(async () => {
```

Add the broadcaster call **before** the `return fullMsg ?? msg` line at the end of `sendMessage`:

```js
    if (broadcaster) {
      const memberIds = await getConversationMemberIds(conversationId).catch(() => [])
      broadcaster.broadcastToUsers(memberIds, 'chat.message.new', {
        conversationId,
        messageId: msg.id,
        senderName: fullMsg?.sender?.displayName ?? null,
      }).catch(() => {})
    }

    return fullMsg ?? msg;
```

- [ ] **Step 4: Broadcast after createConversation**

In `createConversation`, find the final `return` statement:

```js
    return getConversation({ conversationId: conv.id, authUserId });
```

Replace with:

```js
    const newConv = await getConversation({ conversationId: conv.id, authUserId })

    if (broadcaster) {
      const memberIds = allMembers.map((id) => id.toString())
      broadcaster.broadcastToUsers(memberIds, 'chat.conversation.new', {
        conversationId: conv.id,
      }).catch(() => {})
    }

    return newConv
```

- [ ] **Step 5: Verify syntax**

```bash
node --check apps/api/src/routes/chat/chat-service.js
```

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat/chat-service.js
git commit -m "feat(realtime): broadcast chat.message.new and chat.conversation.new"
```

---

## Task 4: Pass `broadcaster` through chat router

**Files:**
- Modify: `apps/api/src/routes/chat/index.js`

- [ ] **Step 1: Accept and pass broadcaster**

Find:
```js
export function createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService = null }) {
  const app = new Hono();
  const chatService = createChatService({ prisma, supabaseAdmin, notificationService });
```

Change to:
```js
export function createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService = null, broadcaster = null }) {
  const app = new Hono();
  const chatService = createChatService({ prisma, supabaseAdmin, notificationService, broadcaster });
```

- [ ] **Step 2: Verify syntax**

```bash
node --check apps/api/src/routes/chat/index.js
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/chat/index.js
git commit -m "feat(realtime): thread broadcaster through chat router"
```

---

## Task 5: Broadcast project task mutations

**Files:**
- Modify: `apps/api/src/routes/projects/projects-routes.js`

Project task mutations that need broadcasting: create, update (PATCH), bulk update, delete, bulk delete, move, comment create/edit/delete.

For the broadcast, we need the list of project member user IDs. The `projectsSvc.getProject()` returns a project with `members` array. We'll create a small helper inside the router.

- [ ] **Step 1: Add `broadcaster` parameter to `createProjectsRouter`**

Find:
```js
export function createProjectsRouter({ prisma, requirePermission, notificationService, enrichFileAssets = null }) {
```

Change to:
```js
export function createProjectsRouter({ prisma, requirePermission, notificationService, enrichFileAssets = null, broadcaster = null }) {
```

- [ ] **Step 2: Add helper inside the router factory**

Add right after the `notifSvc` and `commentsSvc` initializations (around line 48):

```js
  async function broadcastTaskEvent(projectId, taskId, action) {
    if (!broadcaster) return
    try {
      const members = await prisma.projectMember.findMany({
        where: { projectId },
        select: { userId: true },
      })
      const memberIds = members.map((m) => m.userId)
      await broadcaster.broadcastToUsers(memberIds, 'projects.task.updated', {
        projectId,
        taskId: taskId ?? null,
        action,
      })
    } catch {}
  }
```

- [ ] **Step 3: Add broadcast to task create route**

Find the task create route handler body:
```js
  app.post('/projects/:id/tasks', requirePermission('projects.task.create'), async (c) => {
    try {
      const body = await c.req.json()
      const task = await tasksSvc.createTask(c.req.param('id'), getUserId(c), body)
      if (task.dueDate) {
        const project = await prisma.project.findFirst({ where: { id: task.projectId } })
        await bridge.syncTaskEvent(task, project?.calendarId)
      }
      return c.json(task, 201)
    } catch (err) { return handleError(c, err, 'Error al crear tarea.') }
  })
```

Change to:
```js
  app.post('/projects/:id/tasks', requirePermission('projects.task.create'), async (c) => {
    try {
      const body = await c.req.json()
      const task = await tasksSvc.createTask(c.req.param('id'), getUserId(c), body)
      if (task.dueDate) {
        const project = await prisma.project.findFirst({ where: { id: task.projectId } })
        await bridge.syncTaskEvent(task, project?.calendarId)
      }
      broadcastTaskEvent(task.projectId, task.id, 'created')
      return c.json(task, 201)
    } catch (err) { return handleError(c, err, 'Error al crear tarea.') }
  })
```

- [ ] **Step 4: Add broadcast to task update (PATCH) route**

Find (around line 229):
```js
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al actualizar tarea.') }
  })
```
(The last `return c.json(task)` inside `app.patch('/projects/:id/tasks/:tid', ...)`.)

Add `broadcastTaskEvent` before `return c.json(task)` in that handler:

```js
      broadcastTaskEvent(task.projectId ?? c.req.param('id'), task.id, 'updated')
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al actualizar tarea.') }
  })
```

- [ ] **Step 5: Add broadcast to task delete route**

Find:
```js
  app.delete('/projects/:id/tasks/:tid', requirePermission('projects.task.delete'), async (c) => {
    try {
      const task = await tasksSvc.deleteTask(c.req.param('tid'))
      if (task.calendarEventId) await bridge.deleteTaskEvent(task.calendarEventId)
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err, 'Error al eliminar tarea.') }
  })
```

Change to:
```js
  app.delete('/projects/:id/tasks/:tid', requirePermission('projects.task.delete'), async (c) => {
    try {
      const task = await tasksSvc.deleteTask(c.req.param('tid'))
      if (task.calendarEventId) await bridge.deleteTaskEvent(task.calendarEventId)
      broadcastTaskEvent(c.req.param('id'), c.req.param('tid'), 'deleted')
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err, 'Error al eliminar tarea.') }
  })
```

- [ ] **Step 6: Add broadcast to task move route**

Find:
```js
  app.patch('/projects/:id/tasks/:tid/move', requirePermission('projects.task.update'), async (c) => {
    try {
      const task = await tasksSvc.moveTask(c.req.param('tid'), await c.req.json())
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al mover tarea.') }
  })
```

Change to:
```js
  app.patch('/projects/:id/tasks/:tid/move', requirePermission('projects.task.update'), async (c) => {
    try {
      const task = await tasksSvc.moveTask(c.req.param('tid'), await c.req.json())
      broadcastTaskEvent(c.req.param('id'), c.req.param('tid'), 'moved')
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al mover tarea.') }
  })
```

- [ ] **Step 7: Verify syntax**

```bash
node --check apps/api/src/routes/projects/projects-routes.js
```

Expected: no output (clean).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/projects/projects-routes.js
git commit -m "feat(realtime): broadcast projects.task.updated after task mutations"
```

---

## Task 6: Wire broadcaster into `index.js`

**Files:**
- Modify: `apps/api/src/index.js`

Three targeted edits: import broadcaster, instantiate it, pass to both routers.

- [ ] **Step 1: Add import near the top of index.js**

Find the existing notification-service import (around line 80):
```js
import { createNotificationService } from "./services/notification-service.js";
```

Add directly below it:
```js
import { createRealtimeBroadcaster } from "./services/realtime-broadcaster.js";
```

- [ ] **Step 2: Instantiate broadcaster after `supabaseAdmin` is created**

`supabaseAdmin` is created around line 107. Find:
```js
const supabaseAdmin = createClient(
```

After the block that creates `supabaseAdmin` (and `supabaseAnon`), add:
```js
const broadcaster = createRealtimeBroadcaster({
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
})
```

- [ ] **Step 3: Pass broadcaster to notificationService**

Find (around line 139):
```js
const notificationService = createNotificationService({ prisma })
```

Change to:
```js
const notificationService = createNotificationService({ prisma, broadcaster })
```

- [ ] **Step 4: Pass broadcaster to chat router**

Find (around line 4508):
```js
app.route("/", createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService }))
```

Change to:
```js
app.route("/", createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, notificationService, broadcaster }))
```

- [ ] **Step 5: Pass broadcaster to projects router**

Find (around line 4497):
```js
mountWithAuth(app, createProjectsRouter({ prisma, requirePermission, notificationService, enrichFileAssets: filesService.enrichFileAssets.bind(filesService) }))
```

Change to:
```js
mountWithAuth(app, createProjectsRouter({ prisma, requirePermission, notificationService, enrichFileAssets: filesService.enrichFileAssets.bind(filesService), broadcaster }))
```

- [ ] **Step 6: Verify syntax**

```bash
node --check apps/api/src/index.js
```

Expected: no output (clean).

- [ ] **Step 7: Smoke test — start the API and check health**

```bash
pnpm dev:api
```

In another terminal:
```bash
curl http://localhost:4010/health
```

Expected: `{"ok":true}` or similar. No startup errors in the API console.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(realtime): wire RealtimeBroadcaster into API — notifications, chat, projects"
```

---

## Task 7: Manual smoke test of broadcasts

- [ ] **Step 1: Start the API**

```bash
pnpm dev:api
```

- [ ] **Step 2: Confirm the Supabase Realtime broadcast endpoint is reachable**

Run (replace values from your `.env`):
```bash
curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/realtime/v1/api/broadcast" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"topic":"realtime:test","event":"ping","payload":{}}]}'
```

Expected: `200` or `202` (Supabase Realtime accepts the broadcast). If you get `404`, the Realtime service URL may differ — check your self-hosted Supabase configuration.

- [ ] **Step 3: Send a test notification via API and watch the console**

```bash
# Grab a valid token by logging in via the app, then:
curl -X POST http://localhost:4010/notifications/publish \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"test.realtime","title":"Test RT","recipients":{"userIds":["<your-profile-id>"]},"channels":["in_app"],"priority":"low"}'
```

Expected: API console shows `[realtime-broadcaster]` log if broadcast fails, or silence if it succeeds.

- [ ] **Step 4: Commit done — no code changes in this task**

---

## Self-review checklist

- [x] **Spec section 4.2** (REST broadcast) → Task 1 (`_send` uses `fetch` with service role key)
- [x] **Spec section 6** (notification broadcaster) → Task 2 
- [x] **Spec section 7** (chat broadcaster — sendMessage + createConversation) → Tasks 3–4
- [x] **Spec section 12** (projects.task.updated) → Task 5
- [x] **Spec section 15** (env vars: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) → Task 6 uses `process.env.*`
- [x] **Spec section 13** (generic pattern: broadcaster.broadcastToUsers) → Demonstrated in Tasks 2, 3, 5 — pattern is consistent
- [x] No placeholders, no TBD, no "add error handling" — all error handling is shown inline
- [x] Types consistent: `broadcastToUsers(profileIds: string[], event: string, payload: object)` used identically across all tasks

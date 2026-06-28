# Realtime Layer — Plan A: API Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `realtime-broadcaster.js` pattern to POS, Calendar, and Projects bulk operations so the API fires broadcast events after every data mutation.

**Architecture:** Add `broadcastToCompany` and `broadcastToChannel` methods to the existing broadcaster, wire broadcaster into POS and Calendar routers (currently only Projects and Chat use it), and add the missing `broadcastTaskEvent` calls to the two bulk task operations in projects-routes.

**Tech Stack:** Node.js, Hono, `realtime-broadcaster.js` (existing), no new dependencies.

> **Note on Notes:** `SupabaseYjsProvider.js` already implements Y.js CRDT collaboration client-to-client via Supabase Broadcast. The `GET /notes/:id/ydoc` and `PUT /notes/:id/ydoc` endpoints already exist. Nothing in the notes API needs to change.

> **Note on Projects:** `broadcastTaskEvent` already fires on task create / update / delete / move. Only the two bulk endpoints (bulk-update, bulk-delete) are missing the call.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/api/src/services/realtime-broadcaster.js` | Modify | Add `broadcastToCompany` + `broadcastToChannel` + update noop |
| `apps/api/src/index.js` | Modify | Pass `broadcaster` to `createPosRouter` and `createCalendarRouter` |
| `apps/api/src/routes/pos/pos-routes.js` | Modify | Add `broadcaster` param + `broadcastPosEvent` helper + calls |
| `apps/api/src/routes/calendar/calendar-routes.js` | Modify | Add `broadcaster` param + `getCompanyId` + `broadcastCalendarEvent` + calls |
| `apps/api/src/routes/projects/projects-routes.js` | Modify | Add `broadcastTaskEvent` to bulk-update and bulk-delete |

---

## Task 1: Extend realtime-broadcaster.js

**Files:**
- Modify: `apps/api/src/services/realtime-broadcaster.js`

The file already has `_send(messages)` as the internal HTTP helper. Add two new public methods and update the noop broadcaster.

- [ ] **Step 1: Add broadcastToCompany and broadcastToChannel to createRealtimeBroadcaster**

Replace the closing brace + return of `createRealtimeBroadcaster` to add the two new methods. The full updated file:

```js
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
      topic: `user:${profileId}:events`,
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
        topic: `user:${id}:events`,
        event,
        payload: payload ?? {},
      })),
    ).catch((err) => {
      console.warn('[realtime-broadcaster] broadcastToUsers error:', err?.message)
    })
  }

  async function broadcastToCompany(companyId, event, payload) {
    if (!companyId) return
    await _send([{
      topic: `company:${companyId}:events`,
      event,
      payload: payload ?? {},
    }]).catch((err) => {
      console.warn('[realtime-broadcaster] broadcastToCompany error:', err?.message)
    })
  }

  async function broadcastToChannel(channelName, event, payload) {
    if (!channelName) return
    await _send([{
      topic: channelName,
      event,
      payload: payload ?? {},
    }]).catch((err) => {
      console.warn('[realtime-broadcaster] broadcastToChannel error:', err?.message)
    })
  }

  return { broadcastToUser, broadcastToUsers, broadcastToCompany, broadcastToChannel }
}

export function createNoopBroadcaster() {
  return {
    broadcastToUser: async () => {},
    broadcastToUsers: async () => {},
    broadcastToCompany: async () => {},
    broadcastToChannel: async () => {},
  }
}
```

- [ ] **Step 2: Verify no import breaks — grep for createNoopBroadcaster usages**

```bash
grep -r "createNoopBroadcaster" apps/api/src
```

Expected: appears in `index.js` or test files. The new noop methods are additive, so no breaks.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/realtime-broadcaster.js
git commit -m "feat(realtime): add broadcastToCompany and broadcastToChannel to broadcaster"
```

---

## Task 2: Wire broadcaster into POS and Calendar routers (index.js)

**Files:**
- Modify: `apps/api/src/index.js` — lines ~4572-4573

- [ ] **Step 1: Find the exact lines**

```bash
grep -n "createPosRouter\|createCalendarRouter" apps/api/src/index.js
```

Expected output shows two lines like:
```
4572:mountWithAuth(app, createPosRouter({ prisma, requirePermission }));
4573:mountWithAuth(app, createCalendarRouter({ prisma, requirePermission }));
```

- [ ] **Step 2: Add broadcaster to both calls**

In `apps/api/src/index.js`, change:
```js
mountWithAuth(app, createPosRouter({ prisma, requirePermission }));
mountWithAuth(app, createCalendarRouter({ prisma, requirePermission }));
```
to:
```js
mountWithAuth(app, createPosRouter({ prisma, requirePermission, broadcaster }));
mountWithAuth(app, createCalendarRouter({ prisma, requirePermission, broadcaster }));
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(realtime): pass broadcaster to POS and Calendar routers"
```

---

## Task 3: Add broadcaster to pos-routes.js

**Files:**
- Modify: `apps/api/src/routes/pos/pos-routes.js`

The router currently accepts `{ prisma, requirePermission }`. Add `broadcaster = null` and a `broadcastPosEvent` fire-and-forget helper, then call it after every order-state-changing endpoint.

- [ ] **Step 1: Add broadcaster param and helper to createPosRouter**

In `apps/api/src/routes/pos/pos-routes.js`, change the function signature and add the helper just before the first route:

```js
// BEFORE (line 66):
export function createPosRouter({ prisma, requirePermission }) {

// AFTER:
export function createPosRouter({ prisma, requirePermission, broadcaster = null }) {
```

Then, after the service instantiations (after `const reservationSvc = ...`, before the first `app.get`), add:

```js
  function broadcastPosEvent(c, orderId, action) {
    const companyId = getCompanyId(c)
    if (!broadcaster || !companyId) return
    broadcaster.broadcastToCompany(companyId, 'pos.order.updated', {
      orderId: orderId ?? null,
      action,
    }).catch(() => {})
  }
```

- [ ] **Step 2: Add broadcastPosEvent call to POST /pos/orders (createOrder)**

Find the `app.post("/pos/orders"` handler. After the successful `return c.json(...)`, add the broadcast call before the return. Change:

```js
  app.post("/pos/orders", requirePermission("pos.orders.create"), async (c) => {
    try {
      const data = await parseBody(c, createOrderSchema);
      return c.json({ data: await orderSvc.createOrder({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la orden POS.");
    }
  });
```

to:

```js
  app.post("/pos/orders", requirePermission("pos.orders.create"), async (c) => {
    try {
      const data = await parseBody(c, createOrderSchema);
      const result = await orderSvc.createOrder({ ...context(c), data })
      broadcastPosEvent(c, result?.id, 'created')
      return c.json({ data: result }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la orden POS.");
    }
  });
```

- [ ] **Step 3: Add broadcastPosEvent to PATCH /pos/orders/:id (updateOrder)**

Change:
```js
  app.patch("/pos/orders/:id", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, updateOrderSchema);
      return c.json({ data: await orderSvc.updateOrder({ ...context(c), id: c.req.param("id"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la orden POS.");
    }
  });
```

to:

```js
  app.patch("/pos/orders/:id", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, updateOrderSchema);
      const result = await orderSvc.updateOrder({ ...context(c), id: c.req.param("id"), data })
      broadcastPosEvent(c, c.req.param("id"), 'updated')
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la orden POS.");
    }
  });
```

- [ ] **Step 4: Add broadcastPosEvent to POST /pos/orders/:id/lines, PATCH .../lines/:lineId, DELETE .../lines/:lineId**

For `POST /pos/orders/:id/lines`:
```js
  app.post("/pos/orders/:id/lines", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, addOrderLineSchema);
      const result = await orderSvc.addOrderLine({ ...context(c), orderId: c.req.param("id"), data })
      broadcastPosEvent(c, c.req.param("id"), 'line_added')
      return c.json({ data: result }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo agregar la linea.");
    }
  });
```

For `PATCH /pos/orders/:id/lines/:lineId`:
```js
  app.patch("/pos/orders/:id/lines/:lineId", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, updateOrderLineSchema);
      const result = await orderSvc.updateOrderLine({
        ...context(c),
        orderId: c.req.param("id"),
        lineId: c.req.param("lineId"),
        data,
      })
      broadcastPosEvent(c, c.req.param("id"), 'line_updated')
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la linea.");
    }
  });
```

For `DELETE /pos/orders/:id/lines/:lineId`:
```js
  app.delete("/pos/orders/:id/lines/:lineId", requirePermission("pos.orders.update"), async (c) => {
    try {
      const result = await orderSvc.deleteOrderLine({
        ...context(c),
        orderId: c.req.param("id"),
        lineId: c.req.param("lineId"),
      })
      broadcastPosEvent(c, c.req.param("id"), 'line_deleted')
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "No se pudo eliminar la linea.");
    }
  });
```

- [ ] **Step 5: Add broadcastPosEvent to send-to-kitchen, addPayment, cancelOrder**

For `POST /pos/orders/:id/send-to-kitchen`:
```js
  app.post("/pos/orders/:id/send-to-kitchen", requirePermission("pos.orders.update"), async (c) => {
    try {
      const result = await kitchenSvc.sendOrderToKitchen({ ...context(c), orderId: c.req.param("id") })
      broadcastPosEvent(c, c.req.param("id"), 'sent_to_kitchen')
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "No se pudo enviar la orden a cocina.");
    }
  });
```

For `POST /pos/orders/:id/payments`:
```js
  app.post("/pos/orders/:id/payments", requirePermission("pos.payments.create"), async (c) => {
    try {
      const data = await parseBody(c, createPaymentSchema);
      const result = await orderSvc.addPayment({ ...context(c), orderId: c.req.param("id"), data })
      broadcastPosEvent(c, c.req.param("id"), 'payment_added')
      return c.json({ data: result }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo registrar el pago.");
    }
  });
```

For `POST /pos/orders/:id/cancel`:
```js
  app.post("/pos/orders/:id/cancel", requirePermission("pos.orders.cancel"), async (c) => {
    try {
      const data = await parseBody(c, cancelOrderSchema);
      const result = await orderSvc.cancelOrder({ ...context(c), orderId: c.req.param("id"), reason: data.reason })
      broadcastPosEvent(c, c.req.param("id"), 'cancelled')
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "No se pudo cancelar la orden.");
    }
  });
```

- [ ] **Step 6: Verify the API still starts**

```bash
node --check apps/api/src/routes/pos/pos-routes.js
```

Expected: no output (syntax ok).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/pos/pos-routes.js
git commit -m "feat(realtime): broadcast pos.order.updated after every POS order mutation"
```

---

## Task 4: Add broadcaster to calendar-routes.js

**Files:**
- Modify: `apps/api/src/routes/calendar/calendar-routes.js`

The router currently accepts `{ prisma, requirePermission, google }`. Add `broadcaster = null` and a `broadcastCalendarEvent` helper. Add calls to the three event mutation endpoints: create (line ~623), update (line ~688), delete (line ~772).

- [ ] **Step 1: Add broadcaster param and getCompanyId helper**

In `calendar-routes.js`, change the function signature:

```js
// BEFORE (line 154):
export function createCalendarRouter({ prisma, requirePermission, google }) {

// AFTER:
export function createCalendarRouter({ prisma, requirePermission, google, broadcaster = null }) {
```

Add `getCompanyId` helper right after the existing `getUserId` helper (around line 23):

```js
function getCompanyId(c) {
  return c.get('companyId') ?? c.get('userContext')?.memberships?.[0]?.companyId ?? null
}
```

Then add `broadcastCalendarEvent` inside the router function body, after the service instantiations, before the first route:

```js
  function broadcastCalendarEvent(c, eventId, action) {
    const companyId = getCompanyId(c)
    if (!broadcaster || !companyId) return
    broadcaster.broadcastToCompany(companyId, 'calendar.event.updated', {
      eventId: eventId ?? null,
      action,
    }).catch(() => {})
  }
```

- [ ] **Step 2: Add broadcastCalendarEvent to POST /calendar/events (createEvent)**

After `return c.json(event, 201)` is built but before it returns, add the broadcast. Change the handler from:

```js
        return c.json(event, 201);
      } catch (err) {
        return handleError(c, err, "No se pudo crear el evento.");
      }
    },
  );
```

(the one inside `app.post("/calendar/events"` at line ~667) to:

```js
        broadcastCalendarEvent(c, event.id, 'created')
        return c.json(event, 201);
      } catch (err) {
        return handleError(c, err, "No se pudo crear el evento.");
      }
    },
  );
```

- [ ] **Step 3: Add broadcastCalendarEvent to PATCH /calendar/events/:id (updateEvent)**

Inside `app.patch("/calendar/events/:id"` (around line 688), after `const event = await eventSvc.updateEvent(...)` and after all the activity/notification publishing, add before the final `return`:

```js
        broadcastCalendarEvent(c, eventId, 'updated')
        return c.json(event);
```

(Replace the existing bare `return c.json(event)` near the end of that handler.)

- [ ] **Step 4: Add broadcastCalendarEvent to DELETE /calendar/events/:id (deleteEvent)**

Inside `app.delete("/calendar/events/:id"` (around line 772), before `return c.json({ ok: true })`:

```js
        broadcastCalendarEvent(c, eventId, 'deleted')
        return c.json({ ok: true });
```

- [ ] **Step 5: Verify syntax**

```bash
node --check apps/api/src/routes/calendar/calendar-routes.js
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/calendar/calendar-routes.js
git commit -m "feat(realtime): broadcast calendar.event.updated after create/update/delete"
```

---

## Task 5: Fix bulk task operations in projects-routes.js

**Files:**
- Modify: `apps/api/src/routes/projects/projects-routes.js` — lines ~222-237

`broadcastTaskEvent` is already defined and called for individual task operations. The two bulk endpoints at lines 222-237 are missing the call.

- [ ] **Step 1: Add broadcastTaskEvent to PATCH /projects/:id/tasks/bulk**

Find the bulk-update handler:
```js
  app.patch('/projects/:id/tasks/bulk', requirePermission('projects.task.update'), async (c) => {
    try {
      const { taskIds, patch } = await c.req.json()
      const result = await tasksSvc.bulkUpdateTasks(c.req.param('id'), taskIds, patch ?? {})
      return c.json(result)
    } catch (err) { return handleError(c, err, 'Error al actualizar tareas en masa.') }
  })
```

Change to:
```js
  app.patch('/projects/:id/tasks/bulk', requirePermission('projects.task.update'), async (c) => {
    try {
      const { taskIds, patch } = await c.req.json()
      const result = await tasksSvc.bulkUpdateTasks(c.req.param('id'), taskIds, patch ?? {})
      broadcastTaskEvent(c.req.param('id'), null, 'bulk_updated')
      return c.json(result)
    } catch (err) { return handleError(c, err, 'Error al actualizar tareas en masa.') }
  })
```

- [ ] **Step 2: Add broadcastTaskEvent to DELETE /projects/:id/tasks/bulk**

Find the bulk-delete handler:
```js
  app.delete('/projects/:id/tasks/bulk', requirePermission('projects.task.delete'), async (c) => {
    try {
      const { taskIds } = await c.req.json()
      const result = await tasksSvc.bulkDeleteTasks(c.req.param('id'), taskIds)
      return c.json(result)
    } catch (err) { return handleError(c, err, 'Error al eliminar tareas en masa.') }
  })
```

Change to:
```js
  app.delete('/projects/:id/tasks/bulk', requirePermission('projects.task.delete'), async (c) => {
    try {
      const { taskIds } = await c.req.json()
      const result = await tasksSvc.bulkDeleteTasks(c.req.param('id'), taskIds)
      broadcastTaskEvent(c.req.param('id'), null, 'bulk_deleted')
      return c.json(result)
    } catch (err) { return handleError(c, err, 'Error al eliminar tareas en masa.') }
  })
```

- [ ] **Step 3: Verify syntax**

```bash
node --check apps/api/src/routes/projects/projects-routes.js
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/projects/projects-routes.js
git commit -m "feat(realtime): broadcast task events on bulk update/delete operations"
```

---

## Verification

- [ ] **Start the API**

```bash
pnpm dev:api
```

Expected: starts on port 4010 with no errors.

- [ ] **Verify POS broadcaster fires**

With two browser tabs open (both logged in as the same company):
1. In tab 1, open POS and create an order.
2. In tab 2, open the browser DevTools → Network → WS tab.
3. Look for the Supabase WebSocket connection. After the create, a `broadcast` frame should appear with `event: "pos.order.updated"` and `topic: "company:{companyId}:events"`.

- [ ] **Verify Calendar broadcaster fires**

1. In tab 1, create a calendar event via the API or UI.
2. In tab 2, WS tab should show `event: "calendar.event.updated"`.

- [ ] **Verify Projects bulk broadcast fires**

1. Select multiple tasks in a project and bulk-update their status.
2. WS tab should show `event: "projects.task.updated"` with `action: "bulk_updated"`.

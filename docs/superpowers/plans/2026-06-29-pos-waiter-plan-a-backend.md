# Atlas POS Waiter & Split Bill — Plan A (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add waiter assignment (`waiterId` on `PosOrder` and `PosTable`) and a per-seat totals endpoint for split-bill payments to the `atlas.pos` backend.

**Architecture:** Two new nullable `waiter_id` columns added via a forward-only Prisma migration. `pos-order-service.js` gains waiter auto-assignment on order create, an explicit reassignment function, and a seat-totals computation. `pos-floor-service.js` gains table-waiter assignment, auto-claim on order open, auto-clear on table-available, and a `myTablesOnly` filter on the active map. New Hono routes expose all of this; the SDK gets matching client methods.

**Tech Stack:** Node.js, Hono, Prisma, PostgreSQL/Supabase, Zod, Node built-in `node:test`. JavaScript only.

**Spec:** `docs/superpowers/specs/2026-06-29-pos-waiter-split-bill.md`

---

## File Map

```text
prisma/
  schema.prisma
  migrations/20260629120000_pos_waiter_split_bill/migration.sql

apps/api/src/routes/pos/
  pos-order-service.js
  pos-floor-service.js
  validators.js
  pos-routes.js
  __tests__/
    pos-order-service.test.js
    pos-floor-kitchen-service.test.js

packages/sdk/src/index.js
```

---

## Task 1: Prisma Schema and Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260629120000_pos_waiter_split_bill/migration.sql`

- [ ] **Step 1: Add `waiterId` to `PosOrder`**

In `prisma/schema.prisma`, find the `PosOrder` model. Add a new field directly after `createdById`:

```prisma
  createdById         String               @db.Uuid @map("created_by_id")
  waiterId            String?              @db.Uuid @map("waiter_id")
  updatedAt           DateTime             @updatedAt @map("updated_at")
```

- [ ] **Step 2: Add `waiterId` to `PosTable`**

In the same file, find the `PosTable` model. Add a new field directly after `enabled`:

```prisma
  enabled   Boolean        @default(true)
  waiterId  String?        @db.Uuid @map("waiter_id")
  createdAt DateTime       @default(now())
```

- [ ] **Step 3: Create the migration file**

Create `prisma/migrations/20260629120000_pos_waiter_split_bill/migration.sql`:

```sql
ALTER TABLE "pos_order" ADD COLUMN "waiter_id" UUID;
ALTER TABLE "pos_table" ADD COLUMN "waiter_id" UUID;
CREATE INDEX "pos_order_waiter_id_idx" ON "pos_order"("waiter_id");
CREATE INDEX "pos_table_waiter_id_idx" ON "pos_table"("waiter_id");
```

- [ ] **Step 4: Apply the migration and regenerate the client**

Run:
```bash
pnpm db:migrate
pnpm db:generate
```

Expected: migration applies cleanly, Prisma client regenerates without errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260629120000_pos_waiter_split_bill
git commit -m "feat(pos): add waiter_id columns to pos_order and pos_table"
```

---

## Task 2: Order Service — Waiter Hydration, Auto-Assign, Reassign

**Files:**
- Modify: `apps/api/src/routes/pos/pos-order-service.js`

- [ ] **Step 1: Resolve waiter name in `hydrateOrder`**

Find the existing `hydrateOrder` function:

```js
async function hydrateOrder(db, { companyId, id }) {
  const order = await db.posOrder.findFirst({ where: { id, companyId }, include: { table: true } });
  if (!order) throw new PosServiceError("Orden POS no encontrada.", 404);
  const [lines, guests, payments] = await Promise.all([
    db.posOrderLine.findMany({ where: { orderId: id }, orderBy: { createdAt: "asc" } }),
    db.posGuestSeat.findMany({ where: { orderId: id }, orderBy: { position: "asc" } }),
    db.posPayment.findMany({ where: { orderId: id }, orderBy: { paidAt: "asc" } }),
  ]);
  return { ...order, lines, guests, payments };
}
```

Replace it with:

```js
async function hydrateOrder(db, { companyId, id }) {
  const order = await db.posOrder.findFirst({ where: { id, companyId }, include: { table: true } });
  if (!order) throw new PosServiceError("Orden POS no encontrada.", 404);

  let waiterName = null;
  if (order.waiterId) {
    const waiter = await db.userProfile.findUnique({
      where: { id: order.waiterId },
      select: { displayName: true },
    });
    waiterName = waiter?.displayName ?? null;
  }

  const [lines, guests, payments] = await Promise.all([
    db.posOrderLine.findMany({ where: { orderId: id }, orderBy: { createdAt: "asc" } }),
    db.posGuestSeat.findMany({ where: { orderId: id }, orderBy: { position: "asc" } }),
    db.posPayment.findMany({ where: { orderId: id }, orderBy: { paidAt: "asc" } }),
  ]);
  return { ...order, waiterName, lines, guests, payments };
}
```

- [ ] **Step 2: Auto-assign waiter on order create**

Find the `posOrder.create` call inside `createOrder`:

```js
          const order = await tx.posOrder.create({
            data: {
              companyId: scopedCompanyId,
              outletId: data.outletId,
              sessionId: data.sessionId ?? null,
              terminalId: data.terminalId ?? null,
              tableId: data.tableId ?? null,
              orderNumber: await nextOrderNumber(tx, scopedCompanyId),
              status: "OPEN",
              fulfillmentType: data.fulfillmentType ?? "DINE_IN",
              salesChannel: data.salesChannel ?? "IN_STORE",
              externalProvider: data.externalProvider ?? null,
              externalOrderId: data.externalOrderId ?? null,
              customerName: normalizeText(data.customerName),
              customerPhone: normalizeText(data.customerPhone),
              guestCount: Number(data.guestCount ?? 1),
              notes: normalizeText(data.notes),
              createdById: actorId,
            },
          });
```

Add `waiterId: actorId` after `createdById: actorId`:

```js
          const order = await tx.posOrder.create({
            data: {
              companyId: scopedCompanyId,
              outletId: data.outletId,
              sessionId: data.sessionId ?? null,
              terminalId: data.terminalId ?? null,
              tableId: data.tableId ?? null,
              orderNumber: await nextOrderNumber(tx, scopedCompanyId),
              status: "OPEN",
              fulfillmentType: data.fulfillmentType ?? "DINE_IN",
              salesChannel: data.salesChannel ?? "IN_STORE",
              externalProvider: data.externalProvider ?? null,
              externalOrderId: data.externalOrderId ?? null,
              customerName: normalizeText(data.customerName),
              customerPhone: normalizeText(data.customerPhone),
              guestCount: Number(data.guestCount ?? 1),
              notes: normalizeText(data.notes),
              createdById: actorId,
              waiterId: actorId,
            },
          });
```

- [ ] **Step 3: Auto-claim the table's waiter when a dine-in order opens on it**

Find this block, still inside `createOrder`, right after guest seat creation:

```js
          if (data.tableId) {
            await tx.posTable.update({ where: { id: data.tableId }, data: { status: "OCCUPIED" } });
          }
```

Replace with:

```js
          if (data.tableId) {
            await tx.posTable.update({
              where: { id: data.tableId },
              data: { status: "OCCUPIED", waiterId: actorId },
            });
          }
```

- [ ] **Step 4: Add `assignOrderWaiter`**

Add this new function in `pos-order-service.js`, placed after `updateOrder` (or any other order-mutation function — exact position does not matter as long as it is inside `createPosOrderService`):

```js
  async function assignOrderWaiter({ companyId, actorId, id, waiterId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const order = await prisma.posOrder.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!order) throw new PosServiceError("Orden POS no encontrada.", 404);

    if (waiterId) {
      const profile = await prisma.userProfile.findUnique({
        where: { id: waiterId },
        select: { id: true },
      });
      if (!profile) throw new PosServiceError("Usuario no encontrado.", 404);
    }

    await prisma.posOrder.update({ where: { id }, data: { waiterId: waiterId ?? null } });

    await writeAudit(prisma, {
      actorId,
      entityType: "PosOrder",
      entityId: id,
      action: "pos.order.waiter.assign",
      before: { waiterId: order.waiterId },
      after: { waiterId: waiterId ?? null },
    });

    return hydrateOrder(prisma, { companyId: scopedCompanyId, id });
  }
```

- [ ] **Step 5: Add `getSeatTotals`**

Add this new function alongside `assignOrderWaiter`:

```js
  async function getSeatTotals({ companyId, id }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const order = await prisma.posOrder.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!order) throw new PosServiceError("Orden POS no encontrada.", 404);

    const [lines, guests, payments] = await Promise.all([
      prisma.posOrderLine.findMany({ where: { orderId: id } }),
      prisma.posGuestSeat.findMany({ where: { orderId: id }, orderBy: { position: "asc" } }),
      prisma.posPayment.findMany({ where: { orderId: id } }),
    ]);

    const seatMap = new Map();
    seatMap.set(null, { id: null, label: "Sin asignar", position: 0, lines: [] });
    for (const guest of guests) {
      seatMap.set(guest.id, { id: guest.id, label: guest.label, position: guest.position, lines: [] });
    }
    for (const line of lines) {
      const key = line.guestSeatId ?? null;
      const bucket = seatMap.has(key) ? seatMap.get(key) : seatMap.get(null);
      bucket.lines.push(line);
    }

    const seats = Array.from(seatMap.values())
      .filter((seat) => seat.lines.length > 0)
      .sort((a, b) => a.position - b.position)
      .map((seat) => ({
        id: seat.id,
        label: seat.label,
        position: seat.position,
        subtotal: toMoney(
          seat.lines.reduce(
            (sum, line) =>
              sum + Number(line.quantity) * Number(line.unitPrice) - Number(line.discountAmount ?? 0),
            0,
          ),
        ),
        taxAmount: toMoney(seat.lines.reduce((sum, line) => sum + Number(line.taxAmount ?? 0), 0)),
        total: toMoney(seat.lines.reduce((sum, line) => sum + Number(line.totalAmount), 0)),
        linesCount: seat.lines.length,
      }));

    const paidAmount = toMoney(payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
    const orderTotal = toMoney(Number(order.totalAmount));

    return {
      seats,
      orderTotal,
      paidAmount,
      remaining: toMoney(orderTotal - paidAmount),
    };
  }
```

- [ ] **Step 6: Export the two new functions**

Find the existing `return { ... }` statement at the bottom of `createPosOrderService`:

```js
  return {
    listOrders,
    createOrder,
    getOrderById,
    updateOrder,
    addGuest,
    addOrderLine,
    updateOrderLine,
    deleteOrderLine,
    addPayment,
    cancelOrder,
    reprintReceipt,
  };
```

Replace with:

```js
  return {
    listOrders,
    createOrder,
    getOrderById,
    updateOrder,
    addGuest,
    addOrderLine,
    updateOrderLine,
    deleteOrderLine,
    addPayment,
    cancelOrder,
    reprintReceipt,
    assignOrderWaiter,
    getSeatTotals,
  };
```

- [ ] **Step 7: Run a syntax check**

```bash
node --check apps/api/src/routes/pos/pos-order-service.js
```

Expected: no output (syntax valid).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/pos/pos-order-service.js
git commit -m "feat(pos): auto-assign order waiter and add seat totals computation"
```

---

## Task 3: Floor Service — Table Waiter Assignment and Filtering

**Files:**
- Modify: `apps/api/src/routes/pos/pos-floor-service.js`

- [ ] **Step 1: Add `updateTableWaiter`**

Add this function inside `createPosFloorService`, near the existing `updateTableStatus`:

```js
  async function updateTableWaiter({ companyId, actorId, tableId, waiterId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const table = await prisma.posTable.findFirst({
      where: { id: tableId, companyId: scopedCompanyId },
    });
    if (!table) throw new PosServiceError("Mesa no encontrada.", 404);

    if (waiterId) {
      const profile = await prisma.userProfile.findUnique({
        where: { id: waiterId },
        select: { id: true },
      });
      if (!profile) throw new PosServiceError("Usuario no encontrado.", 404);
    }

    const updated = await prisma.posTable.update({
      where: { id: tableId },
      data: { waiterId: waiterId ?? null },
    });

    await writeAudit(prisma, {
      actorId,
      entityType: "PosTable",
      entityId: tableId,
      action: "pos.table.waiter.assign",
      before: { waiterId: table.waiterId },
      after: { waiterId: waiterId ?? null },
    });

    return updated;
  }
```

- [ ] **Step 2: Clear the waiter when a table becomes `AVAILABLE`**

Find the existing `updateTableStatus` function. It currently updates `status` and writes audit. Locate the `prisma.posTable.update(...)` call inside it and change the `data` payload so that setting `status: "AVAILABLE"` also clears `waiterId`:

```js
    const updated = await prisma.posTable.update({
      where: { id: tableId },
      data: {
        status,
        ...(status === "AVAILABLE" ? { waiterId: null } : {}),
      },
    });
```

Adjust the exact variable names (`tableId`, `status`) to match what is already in the function — do not rename existing parameters.

- [ ] **Step 3: Update `getActiveMap` to support `myTablesOnly` and resolve waiter names**

Replace the existing `getActiveMap` function:

```js
  async function getActiveMap({ companyId, outletId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const floor = await prisma.posFloor.findFirst({
      where: { companyId: scopedCompanyId, outletId, isActive: true },
    });
    if (!floor) return null;
    const [zones, elements, tables] = await Promise.all([
      prisma.posFloorZone.findMany({ where: { floorId: floor.id }, orderBy: { position: "asc" } }),
      prisma.posFloorElement.findMany({ where: { floorId: floor.id } }),
      prisma.posTable.findMany({ where: { floorId: floor.id } }),
    ]);
    return { ...floor, zones, elements, tables };
  }
```

with:

```js
  async function getActiveMap({ companyId, outletId, myTablesOnly = false, actorId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const floor = await prisma.posFloor.findFirst({
      where: { companyId: scopedCompanyId, outletId, isActive: true },
    });
    if (!floor) return null;

    const tableWhere = {
      floorId: floor.id,
      ...(myTablesOnly && actorId ? { waiterId: actorId } : {}),
    };

    const [zones, elements, tables] = await Promise.all([
      prisma.posFloorZone.findMany({ where: { floorId: floor.id }, orderBy: { position: "asc" } }),
      prisma.posFloorElement.findMany({ where: { floorId: floor.id } }),
      prisma.posTable.findMany({ where: tableWhere }),
    ]);

    const waiterIds = [...new Set(tables.map((table) => table.waiterId).filter(Boolean))];
    let waiterNames = {};
    if (waiterIds.length > 0) {
      const waiters = await prisma.userProfile.findMany({
        where: { id: { in: waiterIds } },
        select: { id: true, displayName: true },
      });
      waiterNames = Object.fromEntries(waiters.map((w) => [w.id, w.displayName]));
    }

    return {
      ...floor,
      zones,
      elements,
      tables: tables.map((table) => ({
        ...table,
        waiterName: table.waiterId ? (waiterNames[table.waiterId] ?? null) : null,
      })),
    };
  }
```

- [ ] **Step 4: Resolve waiter names in `getFloorWithLayout` and support `myTablesOnly`**

`getFloorWithLayout` (backing `GET /pos/floors/:id`) is the actual data source `PosTablesScreen` renders via `usePosFloorDetail` — `getActiveMap` is a separate, currently-unused path. The "Mis mesas" filter must be wired here, not just on `getActiveMap`.

Find the existing `getFloorWithLayout` function:

```js
  async function getFloorWithLayout({ companyId, id }) {
    const scopedCompanyId = requireCompanyId(companyId)
    const floor = await prisma.posFloor.findFirst({
      where: { id, companyId: scopedCompanyId },
      include: {
        elements: { orderBy: { createdAt: 'asc' } },
        tables: {
          where: { enabled: true },
          orderBy: { createdAt: 'asc' },
          include: {
            reservations: {
              where: { status: 'CONFIRMED' },
              orderBy: { scheduledAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    })
    if (!floor) throw new PosServiceError('Plano POS no encontrado.', 404)

    return {
      ...floor,
      tables: floor.tables.map((t) => ({
        ...t,
        activeReservation: t.reservations?.[0] ?? null,
        reservations: undefined,
      })),
    }
  }
```

Replace with:

```js
  async function getFloorWithLayout({ companyId, id, myTablesOnly = false, actorId }) {
    const scopedCompanyId = requireCompanyId(companyId)
    const floor = await prisma.posFloor.findFirst({
      where: { id, companyId: scopedCompanyId },
      include: {
        elements: { orderBy: { createdAt: 'asc' } },
        tables: {
          where: {
            enabled: true,
            ...(myTablesOnly && actorId ? { waiterId: actorId } : {}),
          },
          orderBy: { createdAt: 'asc' },
          include: {
            reservations: {
              where: { status: 'CONFIRMED' },
              orderBy: { scheduledAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    })
    if (!floor) throw new PosServiceError('Plano POS no encontrado.', 404)

    const waiterIds = [...new Set(floor.tables.map((t) => t.waiterId).filter(Boolean))]
    let waiterNames = {}
    if (waiterIds.length > 0) {
      const waiters = await prisma.userProfile.findMany({
        where: { id: { in: waiterIds } },
        select: { id: true, displayName: true },
      })
      waiterNames = Object.fromEntries(waiters.map((w) => [w.id, w.displayName]))
    }

    return {
      ...floor,
      tables: floor.tables.map((t) => ({
        ...t,
        waiterName: t.waiterId ? (waiterNames[t.waiterId] ?? null) : null,
        activeReservation: t.reservations?.[0] ?? null,
        reservations: undefined,
      })),
    }
  }
```

Note: filtering tables to `myTablesOnly` here only hides tables from the *table list*; it does not filter `elements`, so `FloorOperationalCanvas` will still render the table shapes for other waiters' tables but with no `table` data bound (since `el.tableId` won't match any entry in `tableStates`). `OperationalTable` already handles a missing `table` prop by falling back to `status: 'AVAILABLE'` styling. Plan B Task 3 dims these unbound shapes instead of showing them as falsely-available.

- [ ] **Step 5: Export `updateTableWaiter`**

Find the `return { ... }` statement at the bottom of `createPosFloorService` and add it:

```js
  return {
    listFloors,
    createFloor,
    getFloorById,
    getFloorWithLayout,
    updateFloor,
    publishFloor,
    createTable,
    updateTable,
    updateTableStatus,
    updateTableWaiter,
    getActiveMap,
    saveLayout,
  };
```

- [ ] **Step 6: Run a syntax check**

```bash
node --check apps/api/src/routes/pos/pos-floor-service.js
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/pos/pos-floor-service.js
git commit -m "feat(pos): add table waiter assignment, auto-clear on available, mis-mesas filter"
```

---

## Task 4: Validators

**Files:**
- Modify: `apps/api/src/routes/pos/validators.js`

- [ ] **Step 1: Add `assignWaiterSchema`**

Open `apps/api/src/routes/pos/validators.js`, find the `z` import at the top (it already exists since other schemas use it), and add this new exported schema near the other order/table schemas:

```js
export const assignWaiterSchema = z.object({
  waiterId: z.string().uuid("El ID de mesero debe ser un UUID valido.").nullable().optional(),
});
```

- [ ] **Step 2: Run a syntax check**

```bash
node --check apps/api/src/routes/pos/validators.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/pos/validators.js
git commit -m "feat(pos): add assignWaiterSchema validator"
```

---

## Task 5: Routes

**Files:**
- Modify: `apps/api/src/routes/pos/pos-routes.js`

- [ ] **Step 1: Import the new schema**

Find the existing import block from `./validators.js` in `pos-routes.js` and add `assignWaiterSchema` to the named imports, keeping the list alphabetically consistent with the rest:

```js
import {
  addOrderLineSchema,
  assignWaiterSchema,
  cancelOrderSchema,
  cashMovementSchema,
  closeSessionSchema,
  createFloorSchema,
  createGuestSchema,
  createOrderSchema,
  createOutletSchema,
  createPaymentMethodSchema,
  createPaymentSchema,
  createStationSchema,
  createTableSchema,
  createTerminalSchema,
  kitchenStatusUpdateSchema,
  openSessionSchema,
  tableStatusUpdateSchema,
  saveLayoutSchema,
  updateFloorSchema,
  updateOrderLineSchema,
  updateOrderSchema,
  updateOutletSchema,
  updatePaymentMethodSchema,
  updateSettingsSchema,
  updateStationSchema,
  updateTableSchema,
  updateTerminalSchema,
  createReservationSchema,
  updateReservationSchema,
  seatReservationSchema,
} from "./validators.js";
```

- [ ] **Step 2: Add `PATCH /pos/orders/:id/waiter`**

Find any existing order route (for example the `PATCH /pos/orders/:id` route) inside `createPosRouter` and add this new route right after it:

```js
  app.patch("/pos/orders/:id/waiter", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, assignWaiterSchema);
      const order = await orderSvc.assignOrderWaiter({
        ...context(c),
        id: c.req.param("id"),
        waiterId: data.waiterId ?? null,
      });
      broadcastPosEvent(c, order.id, "waiter.assign");
      return c.json({ data: order });
    } catch (err) {
      return handleError(c, err, "No se pudo asignar el mesero a la orden.");
    }
  });
```

- [ ] **Step 3: Add `GET /pos/orders/:id/seat-totals`**

Add this route alongside the other order routes:

```js
  app.get("/pos/orders/:id/seat-totals", requirePermission("pos.terminal.use"), async (c) => {
    try {
      const data = await orderSvc.getSeatTotals({ ...context(c), id: c.req.param("id") });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudieron calcular los totales por comensal.");
    }
  });
```

- [ ] **Step 3b: Update `GET /pos/floors/:id` to pass through `myTablesOnly`**

This is the route that actually feeds `PosTablesScreen` (via `usePosFloorDetail`). Find:

```js
  app.get("/pos/floors/:id", requirePermission("pos.floor.read"), async (c) => {
    try {
      return c.json({ data: await floorSvc.getFloorWithLayout({ ...context(c), id: c.req.param("id") }) });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar el plano POS.");
    }
  });
```

Replace with:

```js
  app.get("/pos/floors/:id", requirePermission("pos.floor.read"), async (c) => {
    try {
      return c.json({
        data: await floorSvc.getFloorWithLayout({
          ...context(c),
          id: c.req.param("id"),
          myTablesOnly: c.req.query("myTablesOnly") === "true",
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar el plano POS.");
    }
  });
```

- [ ] **Step 4: Add `PATCH /pos/tables/:id/waiter`**

Find the existing `PATCH /pos/tables/:tableId/status`-style route (the one calling `floorSvc.updateTableStatus`) and add this new route right after it:

```js
  app.patch("/pos/tables/:id/waiter", requirePermission("pos.terminal.use"), async (c) => {
    try {
      const data = await parseBody(c, assignWaiterSchema);
      const table = await floorSvc.updateTableWaiter({
        ...context(c),
        tableId: c.req.param("id"),
        waiterId: data.waiterId ?? null,
      });
      return c.json({ data: table });
    } catch (err) {
      return handleError(c, err, "No se pudo asignar el mesero a la mesa.");
    }
  });
```

- [ ] **Step 5: Update `GET /pos/tables/active-map` to pass through `myTablesOnly`**

Find:

```js
  app.get("/pos/tables/active-map", requirePermission("pos.terminal.use"), async (c) => {
    try {
      return c.json({ data: await floorSvc.getActiveMap({ ...context(c), outletId: c.req.query("outletId") }) });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar el mapa activo.");
    }
  });
```

Replace with:

```js
  app.get("/pos/tables/active-map", requirePermission("pos.terminal.use"), async (c) => {
    try {
      return c.json({
        data: await floorSvc.getActiveMap({
          ...context(c),
          outletId: c.req.query("outletId"),
          myTablesOnly: c.req.query("myTablesOnly") === "true",
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar el mapa activo.");
    }
  });
```

Note: `context(c)` already returns `{ companyId, actorId }`, so `actorId` flows into `getActiveMap` automatically — no extra wiring needed.

- [ ] **Step 6: Run a syntax check**

```bash
node --check apps/api/src/routes/pos/pos-routes.js
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/pos/pos-routes.js
git commit -m "feat(pos): expose waiter assignment and seat-totals routes"
```

---

## Task 6: SDK Client Methods

**Files:**
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 0: Update `getFloor` to accept a `myTablesOnly` query param**

Find:

```js
      getFloor: (id, token) =>
        request(`/pos/floors/${encodeURIComponent(id)}`, {
          headers: withAuthHeaders(token),
        }),
```

Replace with:

```js
      getFloor: (id, query, token) =>
        request(`/pos/floors/${encodeURIComponent(id)}${toQueryString(query)}`, {
          headers: withAuthHeaders(token),
        }),
```

This is a breaking signature change (3 args instead of 2). Task 1 of Plan B updates the only caller (`usePosFloorDetail`) to match.

- [ ] **Step 1: Update `getActiveMap` to accept `myTablesOnly`**

Find the existing `getActiveMap` method under the `pos` namespace (it is called via `atlas.pos.getActiveMap(query, token)` already passing a `query` object with `toQueryString`, matching the pattern used by `listOrders`). If it is currently implemented inline without `toQueryString`, change it to:

```js
      getActiveMap: (query, token) =>
        request(`/pos/tables/active-map${toQueryString(query)}`, {
          headers: withAuthHeaders(token),
        }),
```

This requires no signature change on the JS side — callers already pass `{ outletId }`; they will now also be able to pass `{ outletId, myTablesOnly: true }`.

- [ ] **Step 2: Add `assignOrderWaiter`**

Add this method in the `pos` namespace, near `updateOrder`:

```js
      assignOrderWaiter: (orderId, data, token) =>
        request(`/pos/orders/${encodeURIComponent(orderId)}/waiter`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
```

- [ ] **Step 3: Add `getOrderSeatTotals`**

Add this method near `getOrder`:

```js
      getOrderSeatTotals: (orderId, token) =>
        request(`/pos/orders/${encodeURIComponent(orderId)}/seat-totals`, {
          headers: withAuthHeaders(token),
        }),
```

- [ ] **Step 4: Add `assignTableWaiter`**

Add this method near `updateTableStatus`:

```js
      assignTableWaiter: (tableId, data, token) =>
        request(`/pos/tables/${encodeURIComponent(tableId)}/waiter`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
```

- [ ] **Step 5: Run a syntax check**

```bash
node --check packages/sdk/src/index.js
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/index.js
git commit -m "feat(sdk): add pos waiter assignment and seat-totals client methods"
```

---

## Task 7: Backend Tests

**Files:**
- Modify: `apps/api/src/routes/pos/__tests__/pos-order-service.test.js`
- Modify: `apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js`

- [ ] **Step 1: Open the existing order service test file and check the mock `prisma` shape**

Read `apps/api/src/routes/pos/__tests__/pos-order-service.test.js` first to see how the mock Prisma client is constructed (look for a helper that builds `posOrder`, `posOrderLine`, `posGuestSeat`, `posPayment` mock collections). Reuse that same helper/pattern for the new tests below — do not invent a second mocking approach.

- [ ] **Step 2: Write a failing test for waiter auto-assignment on create**

Add to `pos-order-service.test.js`:

```js
test("createOrder assigns waiterId to the creating actor", async () => {
  const db = createMockDb(); // use whatever the file's existing mock-db factory is named
  const svc = createPosOrderService({ prisma: db });
  const order = await svc.createOrder({
    companyId: COMPANY_ID,
    actorId: ACTOR_ID,
    data: { outletId: OUTLET_ID, fulfillmentType: "DINE_IN", guestCount: 2 },
  });
  assert.strictEqual(order.waiterId, ACTOR_ID);
});
```

Replace `createMockDb`, `COMPANY_ID`, `ACTOR_ID`, `OUTLET_ID` with whatever names the existing test file already uses for its fixtures — match the file's own conventions exactly.

- [ ] **Step 3: Run it to verify it fails**

```bash
node --test apps/api/src/routes/pos/__tests__/pos-order-service.test.js
```

Expected: FAIL — `order.waiterId` is `undefined` until Task 2 is applied. If Task 2 was already completed, this should already PASS; in that case skip to Step 4 and just confirm green.

- [ ] **Step 4: Write a test for `assignOrderWaiter`**

```js
test("assignOrderWaiter reassigns waiter and writes audit", async () => {
  const db = createMockDb();
  const svc = createPosOrderService({ prisma: db });
  const created = await svc.createOrder({
    companyId: COMPANY_ID,
    actorId: ACTOR_ID,
    data: { outletId: OUTLET_ID, fulfillmentType: "DINE_IN", guestCount: 1 },
  });
  const updated = await svc.assignOrderWaiter({
    companyId: COMPANY_ID,
    actorId: ACTOR_ID,
    id: created.id,
    waiterId: OTHER_USER_ID,
  });
  assert.strictEqual(updated.waiterId, OTHER_USER_ID);
});
```

- [ ] **Step 5: Write a test for `getSeatTotals` grouping**

```js
test("getSeatTotals groups lines by guestSeatId with unassigned bucket", async () => {
  const db = createMockDb();
  const svc = createPosOrderService({ prisma: db });
  const order = await svc.createOrder({
    companyId: COMPANY_ID,
    actorId: ACTOR_ID,
    data: { outletId: OUTLET_ID, fulfillmentType: "DINE_IN", guestCount: 2 },
  });
  const [seat1, seat2] = order.guests;
  await svc.addOrderLine({
    companyId: COMPANY_ID,
    actorId: ACTOR_ID,
    orderId: order.id,
    data: { productId: PRODUCT_ID, quantity: 1, unitPrice: 100, guestSeatId: seat1.id },
  });
  await svc.addOrderLine({
    companyId: COMPANY_ID,
    actorId: ACTOR_ID,
    orderId: order.id,
    data: { productId: PRODUCT_ID, quantity: 1, unitPrice: 50 },
  });

  const totals = await svc.getSeatTotals({ companyId: COMPANY_ID, id: order.id });
  assert.strictEqual(totals.seats.length, 2);
  const unassigned = totals.seats.find((s) => s.id === null);
  assert.strictEqual(unassigned.linesCount, 1);
  const assigned = totals.seats.find((s) => s.id === seat1.id);
  assert.strictEqual(assigned.linesCount, 1);
});
```

Adjust the `addOrderLine` call signature and `PRODUCT_ID` fixture to match exactly what the existing test file already uses elsewhere for adding a line — copy that exact call shape rather than guessing.

- [ ] **Step 6: Run the order service tests**

```bash
node --test apps/api/src/routes/pos/__tests__/pos-order-service.test.js
```

Expected: PASS for all tests, including the three new ones.

- [ ] **Step 7: Open the floor/kitchen test file and write a test for `updateTableWaiter`**

In `apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js`, add (matching the file's existing fixture/mock conventions):

```js
test("updateTableWaiter sets waiterId and clears it when status becomes AVAILABLE", async () => {
  const db = createMockDb();
  const svc = createPosFloorService({ prisma: db });
  const table = await svc.createTable({
    companyId: COMPANY_ID,
    actorId: ACTOR_ID,
    floorId: FLOOR_ID,
    data: { name: "Mesa 1", capacity: 4 },
  });

  const assigned = await svc.updateTableWaiter({
    companyId: COMPANY_ID,
    actorId: ACTOR_ID,
    tableId: table.id,
    waiterId: ACTOR_ID,
  });
  assert.strictEqual(assigned.waiterId, ACTOR_ID);

  const cleared = await svc.updateTableStatus({
    companyId: COMPANY_ID,
    actorId: ACTOR_ID,
    tableId: table.id,
    status: "AVAILABLE",
  });
  assert.strictEqual(cleared.waiterId, null);
});
```

Adjust `createTable` / `updateTableStatus` argument shapes to match whatever the existing test file already uses.

- [ ] **Step 8: Write a test for `myTablesOnly` filtering on `getActiveMap`**

```js
test("getActiveMap filters to the actor's tables when myTablesOnly is true", async () => {
  const db = createMockDb();
  const svc = createPosFloorService({ prisma: db });
  const floor = await svc.createFloor({ companyId: COMPANY_ID, actorId: ACTOR_ID, data: { outletId: OUTLET_ID, name: "Salon" } });
  await svc.publishFloor({ companyId: COMPANY_ID, actorId: ACTOR_ID, id: floor.id });
  const mine = await svc.createTable({ companyId: COMPANY_ID, actorId: ACTOR_ID, floorId: floor.id, data: { name: "Mesa A", capacity: 2 } });
  await svc.createTable({ companyId: COMPANY_ID, actorId: ACTOR_ID, floorId: floor.id, data: { name: "Mesa B", capacity: 2 } });
  await svc.updateTableWaiter({ companyId: COMPANY_ID, actorId: ACTOR_ID, tableId: mine.id, waiterId: ACTOR_ID });

  const map = await svc.getActiveMap({ companyId: COMPANY_ID, outletId: OUTLET_ID, myTablesOnly: true, actorId: ACTOR_ID });
  assert.strictEqual(map.tables.length, 1);
  assert.strictEqual(map.tables[0].id, mine.id);
});
```

Adjust `createFloor`/`publishFloor` argument shapes to match whatever the existing test file already uses for floor setup (some POS floor tests may already have a shared "active floor" fixture helper — reuse it instead of duplicating).

- [ ] **Step 9: Run the floor/kitchen tests**

```bash
node --test apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js
```

Expected: PASS for all tests.

- [ ] **Step 10: Run the full POS test suite**

```bash
node --test apps/api/src/routes/pos/__tests__/
```

Expected: all tests PASS, no regressions in existing session/settings/order/floor/kitchen tests.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/routes/pos/__tests__/pos-order-service.test.js apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js
git commit -m "test(pos): cover waiter assignment and seat totals"
```

---

## Self-Check Before Handoff to Plan B

- [ ] `node --test apps/api/src/routes/pos/__tests__/` passes in full.
- [ ] `pnpm lint` passes for the four modified backend files.
- [ ] Manually verify via `pnpm dev:api` + a local request that `GET /pos/tables/active-map?outletId=<id>` still returns the same shape as before, plus `waiterName: null` on tables with no waiter.

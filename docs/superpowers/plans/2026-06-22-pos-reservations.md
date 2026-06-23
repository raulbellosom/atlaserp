# POS Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full reservation management to the POS tables screen — guests can be booked to a table for a specific date/time window, including guest name, phone, party size, duration, and notes; reserved tables display these details and can be converted to active orders.

**Architecture:** A new `PosReservation` Prisma model stores reservation data independently from orders. The floor detail endpoint is extended to embed each table's current active reservation. When a reservation is "seated", a POS order is created pre-filled with guest data and the reservation status transitions to `SEATED`. The existing table status (`RESERVED`) stays as the single source of truth for the canvas/grid color.

**Tech Stack:** Prisma 7 · Hono · Zod · TanStack Query · React · `@atlas/ui` (Dialog, SheetContent, TextField, DatePickerField, SelectField, Button)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `PosReservationStatus` enum + `PosReservation` model + back-relations on `PosOutlet`, `PosTable`, `PosOrder` |
| `prisma/migrations/20260622100000_pos_reservations/migration.sql` | Create | Raw SQL migration |
| `apps/api/src/routes/pos/validators.js` | Modify | Add `createReservationSchema`, `updateReservationSchema` |
| `apps/api/src/routes/pos/pos-reservation-service.js` | Create | CRUD + seat logic |
| `apps/api/src/routes/pos/pos-floor-service.js` | Modify | `getFloorWithLayout` includes active reservation per table |
| `apps/api/src/routes/pos/pos-routes.js` | Modify | Mount 5 reservation endpoints |
| `packages/sdk/src/index.js` | Modify | Add 5 `atlas.pos.reservation*` SDK methods |
| `apps/desktop/src/modules/atlas.pos/hooks/usePosReservation.js` | Create | TanStack Query hooks |
| `apps/desktop/src/modules/atlas.pos/components/ReservationFormDialog.jsx` | Create | Form (create/edit) |
| `apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx` | Modify | Wire form + detail panel |

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260622100000_pos_reservations/migration.sql`

- [ ] **Step 1.1 – Add enum and model to `prisma/schema.prisma`**

  After the `PosTableStatus` enum block (line ~117), add:

  ```prisma
  enum PosReservationStatus {
    CONFIRMED
    SEATED
    CANCELLED
    NO_SHOW

    @@map("pos_reservation_status")
  }
  ```

  After the `PosTable` model closing brace, add:

  ```prisma
  model PosReservation {
    id              String               @id @default(dbgenerated("uuidv7()")) @db.Uuid
    companyId       String               @db.Uuid @map("company_id")
    outletId        String               @db.Uuid @map("outlet_id")
    tableId         String?              @db.Uuid @map("table_id")
    guestName       String               @map("guest_name")
    guestPhone      String?              @map("guest_phone")
    partySize       Int                  @default(2) @map("party_size")
    scheduledAt     DateTime             @map("scheduled_at")
    durationMinutes Int                  @default(90) @map("duration_minutes")
    notes           String?
    status          PosReservationStatus @default(CONFIRMED)
    orderId         String?              @db.Uuid @map("order_id")
    createdById     String               @db.Uuid @map("created_by_id")
    createdAt       DateTime             @default(now()) @map("created_at")
    updatedAt       DateTime             @updatedAt @map("updated_at")

    outlet  PosOutlet  @relation(fields: [outletId], references: [id], onDelete: Cascade)
    table   PosTable?  @relation(fields: [tableId], references: [id], onDelete: SetNull)
    order   PosOrder?  @relation(fields: [orderId], references: [id], onDelete: SetNull)

    @@index([companyId, scheduledAt])
    @@index([companyId, status])
    @@index([tableId, status])
    @@map("pos_reservation")
  }
  ```

- [ ] **Step 1.2 – Add back-relations to existing models in `prisma/schema.prisma`**

  In `PosOutlet` model add inside the relations block:
  ```prisma
    reservations PosReservation[]
  ```

  In `PosTable` model add inside the relations block:
  ```prisma
    reservations PosReservation[]
  ```

  In `PosOrder` model add inside the relations block:
  ```prisma
    reservation PosReservation?
  ```

- [ ] **Step 1.3 – Create migration SQL**

  Create file `prisma/migrations/20260622100000_pos_reservations/migration.sql`:

  ```sql
  -- CreateEnum
  CREATE TYPE "pos_reservation_status" AS ENUM ('CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW');

  -- CreateTable
  CREATE TABLE "pos_reservation" (
      "id"               UUID NOT NULL DEFAULT uuidv7(),
      "company_id"       UUID NOT NULL,
      "outlet_id"        UUID NOT NULL,
      "table_id"         UUID,
      "guest_name"       TEXT NOT NULL,
      "guest_phone"      TEXT,
      "party_size"       INTEGER NOT NULL DEFAULT 2,
      "scheduled_at"     TIMESTAMPTZ NOT NULL,
      "duration_minutes" INTEGER NOT NULL DEFAULT 90,
      "notes"            TEXT,
      "status"           "pos_reservation_status" NOT NULL DEFAULT 'CONFIRMED',
      "order_id"         UUID,
      "created_by_id"    UUID NOT NULL,
      "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at"       TIMESTAMPTZ NOT NULL,

      CONSTRAINT "pos_reservation_pkey" PRIMARY KEY ("id")
  );

  -- CreateIndex
  CREATE INDEX "pos_reservation_company_id_scheduled_at_idx" ON "pos_reservation"("company_id", "scheduled_at");
  CREATE INDEX "pos_reservation_company_id_status_idx" ON "pos_reservation"("company_id", "status");
  CREATE INDEX "pos_reservation_table_id_status_idx" ON "pos_reservation"("table_id", "status");

  -- AddForeignKey
  ALTER TABLE "pos_reservation" ADD CONSTRAINT "pos_reservation_outlet_id_fkey"
      FOREIGN KEY ("outlet_id") REFERENCES "pos_outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "pos_reservation" ADD CONSTRAINT "pos_reservation_table_id_fkey"
      FOREIGN KEY ("table_id") REFERENCES "pos_table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "pos_reservation" ADD CONSTRAINT "pos_reservation_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "pos_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ```

- [ ] **Step 1.4 – Apply migration and regenerate client**

  ```bash
  pnpm db:migrate
  pnpm db:generate
  ```

  Expected: migration applies cleanly, Prisma client regenerated with `posReservation` accessor.

- [ ] **Step 1.5 – Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/20260622100000_pos_reservations/
  git commit -m "feat(pos): add PosReservation model and migration"
  ```

---

## Task 2: Backend reservation service

**Files:**
- Create: `apps/api/src/routes/pos/pos-reservation-service.js`

- [ ] **Step 2.1 – Create `pos-reservation-service.js`**

  ```js
  import {
    PosServiceError,
    requireCompanyId,
    writeAudit,
  } from "./service-helpers.js";

  export function createPosReservationService({ prisma }) {
    async function listReservations({ companyId, outletId, date, status }) {
      const scopedCompanyId = requireCompanyId(companyId);
      const where = { companyId: scopedCompanyId };
      if (outletId) where.outletId = outletId;
      if (status) where.status = status;
      if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        where.scheduledAt = { gte: start, lte: end };
      }
      return prisma.posReservation.findMany({
        where,
        include: { table: true },
        orderBy: { scheduledAt: "asc" },
      });
    }

    async function getReservation({ companyId, id }) {
      const scopedCompanyId = requireCompanyId(companyId);
      const reservation = await prisma.posReservation.findFirst({
        where: { id, companyId: scopedCompanyId },
        include: { table: true },
      });
      if (!reservation) throw new PosServiceError("Reservación no encontrada.", 404);
      return reservation;
    }

    async function createReservation({ companyId, actorId, data }) {
      const scopedCompanyId = requireCompanyId(companyId);

      if (data.tableId) {
        const table = await prisma.posTable.findFirst({
          where: { id: data.tableId, companyId: scopedCompanyId },
        });
        if (!table) throw new PosServiceError("Mesa no encontrada.", 404);
        if (table.status === "OCCUPIED")
          throw new PosServiceError("La mesa está ocupada, no se puede reservar.", 409);
      }

      const reservation = await prisma.$transaction(async (tx) => {
        const res = await tx.posReservation.create({
          data: {
            companyId: scopedCompanyId,
            outletId: data.outletId,
            tableId: data.tableId ?? null,
            guestName: data.guestName,
            guestPhone: data.guestPhone ?? null,
            partySize: data.partySize ?? 2,
            scheduledAt: new Date(data.scheduledAt),
            durationMinutes: data.durationMinutes ?? 90,
            notes: data.notes ?? null,
            status: "CONFIRMED",
            createdById: actorId,
          },
          include: { table: true },
        });

        if (data.tableId) {
          await tx.posTable.update({
            where: { id: data.tableId },
            data: { status: "RESERVED" },
          });
        }

        return res;
      });

      await writeAudit(prisma, {
        actorId,
        entityType: "PosReservation",
        entityId: reservation.id,
        action: "pos.reservation.create",
        after: reservation,
      });

      return reservation;
    }

    async function updateReservation({ companyId, actorId, id, data }) {
      const scopedCompanyId = requireCompanyId(companyId);
      const existing = await prisma.posReservation.findFirst({
        where: { id, companyId: scopedCompanyId },
      });
      if (!existing) throw new PosServiceError("Reservación no encontrada.", 404);
      if (["SEATED", "CANCELLED"].includes(existing.status))
        throw new PosServiceError("La reservación ya no se puede editar.", 409);

      const updateData = {};
      if (data.guestName !== undefined) updateData.guestName = data.guestName;
      if (data.guestPhone !== undefined) updateData.guestPhone = data.guestPhone ?? null;
      if (data.partySize !== undefined) updateData.partySize = data.partySize;
      if (data.scheduledAt !== undefined) updateData.scheduledAt = new Date(data.scheduledAt);
      if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
      if (data.notes !== undefined) updateData.notes = data.notes ?? null;
      if (data.status !== undefined) updateData.status = data.status;

      const reservation = await prisma.$transaction(async (tx) => {
        const updated = await tx.posReservation.update({
          where: { id },
          data: updateData,
          include: { table: true },
        });

        if (
          data.status === "CANCELLED" &&
          existing.tableId &&
          existing.status !== "CANCELLED"
        ) {
          const activeOrders = await tx.posOrder.count({
            where: {
              tableId: existing.tableId,
              status: { notIn: ["PAID", "CANCELLED", "REFUNDED"] },
            },
          });
          if (activeOrders === 0) {
            await tx.posTable.update({
              where: { id: existing.tableId },
              data: { status: "AVAILABLE" },
            });
          }
        }

        return updated;
      });

      await writeAudit(prisma, {
        actorId,
        entityType: "PosReservation",
        entityId: id,
        action: "pos.reservation.update",
        before: existing,
        after: reservation,
      });

      return reservation;
    }

    async function seatReservation({ companyId, actorId, id, outletId, sessionId }) {
      const scopedCompanyId = requireCompanyId(companyId);
      const reservation = await prisma.posReservation.findFirst({
        where: { id, companyId: scopedCompanyId },
      });
      if (!reservation) throw new PosServiceError("Reservación no encontrada.", 404);
      if (reservation.status !== "CONFIRMED")
        throw new PosServiceError("Solo se pueden sentar reservaciones confirmadas.", 409);

      const last = await prisma.posOrder.findFirst({
        where: { companyId: scopedCompanyId },
        orderBy: { orderNumber: "desc" },
      });
      const orderNumber = Number(last?.orderNumber ?? 0) + 1;

      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.posOrder.create({
          data: {
            companyId: scopedCompanyId,
            outletId: reservation.outletId,
            tableId: reservation.tableId,
            sessionId: sessionId ?? null,
            orderNumber,
            status: "OPEN",
            fulfillmentType: "DINE_IN",
            salesChannel: "IN_STORE",
            customerName: reservation.guestName,
            customerPhone: reservation.guestPhone,
            guestCount: reservation.partySize,
            notes: reservation.notes,
            createdById: actorId,
          },
        });

        await tx.posReservation.update({
          where: { id },
          data: { status: "SEATED", orderId: newOrder.id },
        });

        if (reservation.tableId) {
          await tx.posTable.update({
            where: { id: reservation.tableId },
            data: { status: "OCCUPIED" },
          });
        }

        return newOrder;
      });

      await writeAudit(prisma, {
        actorId,
        entityType: "PosReservation",
        entityId: id,
        action: "pos.reservation.seat",
        after: { orderId: order.id },
      });

      return order;
    }

    return { listReservations, getReservation, createReservation, updateReservation, seatReservation };
  }
  ```

- [ ] **Step 2.2 – Commit**

  ```bash
  git add apps/api/src/routes/pos/pos-reservation-service.js
  git commit -m "feat(pos): add reservation service (CRUD + seat)"
  ```

---

## Task 3: Validators + routes + floor detail enrichment

**Files:**
- Modify: `apps/api/src/routes/pos/validators.js`
- Modify: `apps/api/src/routes/pos/pos-routes.js`
- Modify: `apps/api/src/routes/pos/pos-floor-service.js`

- [ ] **Step 3.1 – Add reservation schemas to `validators.js`**

  At the end of the file, append:

  ```js
  export const reservationStatusSchema = z.enum([
    "CONFIRMED",
    "SEATED",
    "CANCELLED",
    "NO_SHOW",
  ]);

  export const createReservationSchema = z.object({
    outletId: z.string().uuid(),
    tableId: z.string().uuid().nullable().optional(),
    guestName: z.string().min(1).max(160),
    guestPhone: optionalNullableText(60),
    partySize: z.coerce.number().int().min(1).max(50).optional(),
    scheduledAt: z.string().datetime({ offset: true }),
    durationMinutes: z.coerce.number().int().min(15).max(720).optional(),
    notes: optionalNullableText(1000),
  });

  export const updateReservationSchema = z.object({
    guestName: z.string().min(1).max(160).optional(),
    guestPhone: optionalNullableText(60),
    partySize: z.coerce.number().int().min(1).max(50).optional(),
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    durationMinutes: z.coerce.number().int().min(15).max(720).optional(),
    notes: optionalNullableText(1000),
    status: reservationStatusSchema.optional(),
  });

  export const seatReservationSchema = z.object({
    sessionId: z.string().uuid().nullable().optional(),
  });
  ```

- [ ] **Step 3.2 – Add reservation routes to `pos-routes.js`**

  At the top of the file, add imports:

  ```js
  import { createPosReservationService } from "./pos-reservation-service.js";
  ```

  And add to the destructured imports from `./validators.js`:
  ```js
  createReservationSchema,
  updateReservationSchema,
  seatReservationSchema,
  ```

  Inside `createPosRouter`, after `const kitchenSvc = ...`, add:

  ```js
  const reservationSvc = createPosReservationService({ prisma });
  ```

  Then add these 5 routes anywhere after the existing routes (before the closing `return app`):

  ```js
  app.get("/pos/reservations", requirePermission("pos.orders.read"), async (c) => {
    try {
      const { outletId, date, status } = c.req.query();
      return c.json({
        data: await reservationSvc.listReservations({ ...context(c), outletId, date, status }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar las reservaciones.");
    }
  });

  app.post("/pos/reservations", requirePermission("pos.orders.manage"), async (c) => {
    try {
      const data = await parseBody(c, createReservationSchema);
      return c.json({ data: await reservationSvc.createReservation({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la reservación.");
    }
  });

  app.get("/pos/reservations/:id", requirePermission("pos.orders.read"), async (c) => {
    try {
      return c.json({
        data: await reservationSvc.getReservation({ ...context(c), id: c.req.param("id") }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar la reservación.");
    }
  });

  app.patch("/pos/reservations/:id", requirePermission("pos.orders.manage"), async (c) => {
    try {
      const data = await parseBody(c, updateReservationSchema);
      return c.json({
        data: await reservationSvc.updateReservation({ ...context(c), id: c.req.param("id"), data }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la reservación.");
    }
  });

  app.post("/pos/reservations/:id/seat", requirePermission("pos.orders.manage"), async (c) => {
    try {
      const data = await parseBody(c, seatReservationSchema);
      return c.json({
        data: await reservationSvc.seatReservation({
          ...context(c),
          id: c.req.param("id"),
          sessionId: data.sessionId,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo sentar la reservación.");
    }
  });
  ```

- [ ] **Step 3.3 – Enrich `getFloorWithLayout` with active reservation per table**

  In `pos-floor-service.js`, update `getFloorWithLayout` so each table includes its active reservation:

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

    // Flatten: expose activeReservation as a direct field instead of array
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

- [ ] **Step 3.4 – Verify API starts without errors**

  ```bash
  pnpm dev:api
  ```

  Expected: server starts on port 4010 with no import or schema errors.

- [ ] **Step 3.5 – Commit**

  ```bash
  git add apps/api/src/routes/pos/validators.js \
          apps/api/src/routes/pos/pos-routes.js \
          apps/api/src/routes/pos/pos-floor-service.js
  git commit -m "feat(pos): add reservation routes and enrich floor detail with active reservation"
  ```

---

## Task 4: SDK methods

**Files:**
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 4.1 – Add reservation SDK methods**

  In `packages/sdk/src/index.js`, find the `getActiveMap` entry inside `pos:` (around line 1130) and add these methods after `getActiveMap`:

  ```js
  listReservations: (query, token) =>
    request(`/pos/reservations${toQueryString(query)}`, {
      headers: withAuthHeaders(token),
    }),
  createReservation: (data, token) =>
    request("/pos/reservations", {
      method: "POST",
      headers: withAuthHeaders(token),
      body: JSON.stringify(data),
    }),
  getReservation: (id, token) =>
    request(`/pos/reservations/${encodeURIComponent(id)}`, {
      headers: withAuthHeaders(token),
    }),
  updateReservation: (id, data, token) =>
    request(`/pos/reservations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: withAuthHeaders(token),
      body: JSON.stringify(data),
    }),
  seatReservation: (id, data, token) =>
    request(`/pos/reservations/${encodeURIComponent(id)}/seat`, {
      method: "POST",
      headers: withAuthHeaders(token),
      body: JSON.stringify(data),
    }),
  ```

- [ ] **Step 4.2 – Commit**

  ```bash
  git add packages/sdk/src/index.js
  git commit -m "feat(pos): add reservation SDK methods"
  ```

---

## Task 5: Frontend — hook + form component + screen wiring

**Files:**
- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosReservation.js`
- Create: `apps/desktop/src/modules/atlas.pos/components/ReservationFormDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx`

- [ ] **Step 5.1 – Create `usePosReservation.js`**

  ```js
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
  import { toast } from 'sonner'
  import { useAuth } from '../../../auth/AuthProvider'
  import { atlas } from '../../../lib/atlas'

  function useToken() {
    const { session } = useAuth()
    return session?.access_token
  }

  export function usePosReservations(query = {}) {
    const token = useToken()
    return useQuery({
      queryKey: ['pos', 'reservations', query],
      queryFn: () => atlas.pos.listReservations(query, token),
      select: (res) => Array.isArray(res) ? res : (res?.data ?? []),
      enabled: Boolean(token),
      staleTime: 30 * 1000,
    })
  }

  export function useCreatePosReservation() {
    const token = useToken()
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (data) => atlas.pos.createReservation(data, token),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['pos', 'reservations'] })
        qc.invalidateQueries({ queryKey: ['pos', 'floors', 'detail'] })
        qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
        toast.success('Reservación creada')
      },
      onError: (err) => toast.error(err?.message ?? 'Error al crear reservación'),
    })
  }

  export function useUpdatePosReservation() {
    const token = useToken()
    const qc = useQueryClient()
    return useMutation({
      mutationFn: ({ id, ...data }) => atlas.pos.updateReservation(id, data, token),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['pos', 'reservations'] })
        qc.invalidateQueries({ queryKey: ['pos', 'floors', 'detail'] })
        qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
        toast.success('Reservación actualizada')
      },
      onError: (err) => toast.error(err?.message ?? 'Error al actualizar reservación'),
    })
  }

  export function useSeatPosReservation() {
    const token = useToken()
    const qc = useQueryClient()
    return useMutation({
      mutationFn: ({ id, sessionId }) => atlas.pos.seatReservation(id, { sessionId }, token),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['pos', 'reservations'] })
        qc.invalidateQueries({ queryKey: ['pos', 'floors', 'detail'] })
        qc.invalidateQueries({ queryKey: ['pos', 'orders'] })
        qc.invalidateQueries({ queryKey: ['pos', 'tables'] })
      },
      onError: (err) => toast.error(err?.message ?? 'Error al sentar reservación'),
    })
  }
  ```

- [ ] **Step 5.2 – Create `ReservationFormDialog.jsx`**

  ```jsx
  import { useState } from 'react'
  import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    Button, TextField,
  } from '@atlas/ui'

  const DEFAULT_DURATION = 90

  function toLocalDatetimeValue(isoOrDate) {
    const d = isoOrDate ? new Date(isoOrDate) : new Date()
    // round up to next 30-min slot
    const mins = d.getMinutes()
    const rounded = mins < 30 ? 30 : 60
    d.setMinutes(rounded, 0, 0)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  export function ReservationFormDialog({ open, onOpenChange, tableName, tableId, outletId, onSubmit, loading }) {
    const [form, setForm] = useState({
      guestName: '',
      guestPhone: '',
      partySize: '2',
      scheduledAt: toLocalDatetimeValue(),
      durationMinutes: String(DEFAULT_DURATION),
      notes: '',
    })

    function handleChange(field) {
      return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

    function handleSubmit(e) {
      e.preventDefault()
      if (!form.guestName.trim()) return
      const scheduledAt = new Date(form.scheduledAt).toISOString()
      onSubmit({
        outletId,
        tableId: tableId ?? null,
        guestName: form.guestName.trim(),
        guestPhone: form.guestPhone.trim() || null,
        partySize: Math.max(1, parseInt(form.partySize, 10) || 2),
        scheduledAt,
        durationMinutes: Math.max(15, parseInt(form.durationMinutes, 10) || DEFAULT_DURATION),
        notes: form.notes.trim() || null,
      })
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reservar {tableName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <TextField
              label="Nombre del cliente"
              required
              value={form.guestName}
              onChange={handleChange('guestName')}
              placeholder="Ej. Juan García"
              autoFocus
              maxLength={160}
            />
            <TextField
              label="Teléfono"
              value={form.guestPhone}
              onChange={handleChange('guestPhone')}
              placeholder="Ej. 55 1234 5678"
              maxLength={60}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Comensales"
                type="number"
                min="1"
                max="50"
                value={form.partySize}
                onChange={handleChange('partySize')}
              />
              <TextField
                label="Duración (min)"
                type="number"
                min="15"
                max="720"
                step="15"
                value={form.durationMinutes}
                onChange={handleChange('durationMinutes')}
              />
            </div>
            <TextField
              label="Fecha y hora"
              type="datetime-local"
              required
              value={form.scheduledAt}
              onChange={handleChange('scheduledAt')}
            />
            <TextField
              label="Notas"
              value={form.notes}
              onChange={handleChange('notes')}
              placeholder="Alergias, peticiones especiales..."
              maxLength={1000}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={!form.guestName.trim() || loading}>
                {loading ? 'Guardando...' : 'Confirmar reserva'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }
  ```

- [ ] **Step 5.3 – Update `PosTablesScreen.jsx`**

  **5.3a — New imports at the top:**

  Replace the existing imports block with (preserving existing imports and adding new ones):

  ```js
  import { useCreatePosReservation, useUpdatePosReservation, useSeatPosReservation } from '../hooks/usePosReservation'
  import { ReservationFormDialog } from '../components/ReservationFormDialog'
  ```

  **5.3b — Add state for reservation form inside `PosTablesScreen()`:**

  After `const [actionTable, setActionTable] = useState(null)`, add:

  ```js
  const [reserveFormTable, setReserveFormTable] = useState(null) // { id, name, outletId }
  const createReservation = useCreatePosReservation()
  const updateReservation = useUpdatePosReservation()
  const seatReservation = useSeatPosReservation()
  ```

  **5.3c — Replace `handleTableClick` reserve branch:**

  In `handleTableClick`, change:
  ```js
  if (reserveMode && status === 'AVAILABLE') {
    setActionTable({ id: table.id, name, status, action: 'reserve' })
    return
  }
  ```
  to:
  ```js
  if (reserveMode && status === 'AVAILABLE') {
    setReserveFormTable({ id: table.id, name, outletId: effectiveOutletId })
    return
  }
  ```

  **5.3d — Replace `handleReserve` with form-submit handler:**

  Remove the existing `handleReserve` function entirely and add:

  ```js
  function handleReservationSubmit(data) {
    createReservation.mutate(data, {
      onSuccess: () => {
        setReserveFormTable(null)
        setReserveMode(false)
      },
    })
  }
  ```

  **5.3e — Update `TableActionContent` to show reservation details:**

  Destructure `activeReservation` from `actionTable` (it gets populated from `tableStates` which now includes the `activeReservation` field from the API). Change the `reserved` action block:

  ```jsx
  {actionTable?.action === 'reserved' && (
    <>
      {actionTable.activeReservation && (
        <div className="mb-4 rounded-xl bg-blue-500/8 border border-blue-500/20 p-3 space-y-1.5 text-sm">
          <p className="font-semibold text-foreground">
            {actionTable.activeReservation.guestName}
          </p>
          {actionTable.activeReservation.guestPhone && (
            <p className="text-muted-foreground">{actionTable.activeReservation.guestPhone}</p>
          )}
          <p className="text-muted-foreground">
            {actionTable.activeReservation.partySize} {actionTable.activeReservation.partySize === 1 ? 'comensal' : 'comensales'}
            {' · '}
            {new Date(actionTable.activeReservation.scheduledAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            {' – '}
            {new Date(
              new Date(actionTable.activeReservation.scheduledAt).getTime() +
                actionTable.activeReservation.durationMinutes * 60000
            ).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {actionTable.activeReservation.notes && (
            <p className="text-muted-foreground italic">{actionTable.activeReservation.notes}</p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button className="w-full" onClick={onNavigateToOrder} disabled={busy}>
          <UtensilsCrossed size={15} className="mr-2 shrink-0" />
          Iniciar orden
        </Button>
        <Button
          variant="outline"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 dark:hover:bg-destructive/10"
          onClick={onCancelReserve}
          disabled={busy}
        >
          <CalendarX size={15} className="mr-2 shrink-0" />
          {busy ? 'Actualizando...' : 'Cancelar reserva'}
        </Button>
      </div>
    </>
  )}
  ```

  **5.3f — Update `handleTableClick` to pass `activeReservation` to `actionTable`:**

  ```js
  if (status === 'RESERVED') {
    setActionTable({
      id: table.id,
      name,
      status,
      action: 'reserved',
      activeReservation: liveTable.activeReservation ?? null,
    })
    return
  }
  ```

  **5.3g — Update `handleCancelReserve` to cancel via reservation service when available:**

  ```js
  function handleCancelReserve() {
    if (!actionTable) return
    const reservationId = actionTable.activeReservation?.id
    if (reservationId) {
      updateReservation.mutate(
        { id: reservationId, status: 'CANCELLED' },
        { onSuccess: () => setActionTable(null) }
      )
    } else {
      updateTableStatus.mutate({ tableId: actionTable.id, status: 'AVAILABLE' }, {
        onSuccess: () => setActionTable(null),
      })
    }
  }
  ```

  **5.3h — Update `handleActionNavigate` (Iniciar orden on reserved table) to use seatReservation:**

  ```js
  function handleActionNavigate() {
    const table = actionTable
    setActionTable(null)
    if (!table) return

    const reservationId = table.activeReservation?.id
    if (reservationId) {
      seatReservation.mutate(
        { id: reservationId },
        {
          onSuccess: (res) => {
            const orderId = (res?.data ?? res).id
            navigate(`/app/m/atlas.pos/pos/terminal?order=${orderId}`)
          },
        }
      )
    } else {
      navigateToOrder(table)
    }
  }
  ```

  **5.3i — Add `ReservationFormDialog` to the JSX (before closing `</div>` of the component return):**

  ```jsx
  <ReservationFormDialog
    open={Boolean(reserveFormTable)}
    onOpenChange={(v) => !v && setReserveFormTable(null)}
    tableName={reserveFormTable?.name ?? ''}
    tableId={reserveFormTable?.id}
    outletId={reserveFormTable?.outletId ?? ''}
    onSubmit={handleReservationSubmit}
    loading={createReservation.isPending}
  />
  ```

  Also update the `busy` prop passed to `TableActionPanel`:

  ```jsx
  busy={updateTableStatus.isPending || updateReservation.isPending || seatReservation.isPending}
  ```

- [ ] **Step 5.4 – Smoke test the full flow**

  1. Start dev: `pnpm dev`
  2. Navigate to POS → Mesas
  3. Click "Reservar" button to enter reserve mode
  4. Click a green (available) table → `ReservationFormDialog` opens
  5. Fill name "Test Guest", phone "5512345678", 4 comensales, pick a datetime, click "Confirmar reserva"
  6. Table turns blue (RESERVED)
  7. Click the reserved table → `TableActionPanel` opens showing guest name, time range, party size
  8. Click "Iniciar orden" → navigates to terminal with order pre-filled with guest data
  9. Go back → table is now amber (OCCUPIED)
  10. Create another reservation, click "Cancelar reserva" → table returns to green (AVAILABLE)

- [ ] **Step 5.5 – Commit**

  ```bash
  git add apps/desktop/src/modules/atlas.pos/hooks/usePosReservation.js \
          apps/desktop/src/modules/atlas.pos/components/ReservationFormDialog.jsx \
          apps/desktop/src/modules/atlas.pos/screens/PosTablesScreen.jsx
  git commit -m "feat(pos): reservation form, detail panel, and seat flow"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ Guest name, phone, party size, scheduled time, duration, notes — all in `createReservationSchema` and form
- ✅ Table turns RESERVED on creation, AVAILABLE on cancel, OCCUPIED on seat
- ✅ Reserved table shows details (name, time range, party size, phone, notes)
- ✅ "Iniciar orden" creates order pre-filled with guest data via `seatReservation`
- ✅ Cancel reservation path: via `updateReservation(status: CANCELLED)` which resets table to AVAILABLE
- ✅ Floor detail API enriched with `activeReservation` per table
- ✅ SDK methods match route signatures
- ✅ Hooks invalidate correct query keys

**Type consistency check:**
- `createReservation.mutate(data)` where `data` matches `createReservationSchema` ✅
- `updateReservation.mutate({ id, status })` matches `updateReservationSchema` ✅
- `seatReservation.mutate({ id, sessionId })` → `atlas.pos.seatReservation(id, { sessionId }, token)` ✅
- `activeReservation.guestName / guestPhone / partySize / scheduledAt / durationMinutes / notes / id` — all present in Prisma model ✅

**Placeholders:** None found.

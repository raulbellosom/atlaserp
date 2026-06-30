# Atlas POS — Waiter Assignment & Split Bill

**Date:** 2026-06-29
**Module:** `atlas.pos`
**Status:** Draft

---

## 1. Context

`atlas.pos` already has a working restaurant backend: orders, tables, floors, guest seats, kitchen tickets. Two pieces needed for a real waiter-with-tablet workflow are missing:

1. **Waiter assignment.** `PosOrder` only has `createdById` (who opened the order). There is no explicit "this is my table" concept, no way to reassign a table to another waiter, and no "mis mesas" filter for the table map.
2. **Split bill.** `PosGuestSeat` already tracks which order lines belong to which diner (`PosOrderLine.guestSeatId`), but there is no endpoint exposing per-seat subtotals, and `PaymentDialog` has no split mode.

## 2. Key Decisions

### Waiter identity comes from the session user's permissions, not a new role table

No new permission keys, no new "role" concept. The existing permission catalog already encodes the job functions:

- `pos.terminal.use` → mesero / cajero de piso (puede tomar comandas y ver mesas)
- `pos.payments.create` → cajero (puede cobrar)
- `pos.sessions.manage` → gerente / cajero principal (abre y cierra caja)
- `pos.floor.manage` → gerente (puede reasignar mesas entre meseros)

A "mesero" is simply a `UserProfile` with `pos.terminal.use` granted via their role. Whoever opens an order from their tablet session becomes that order's waiter automatically.

### `waiterId` lives on both `PosOrder` and `PosTable`

- `PosOrder.waiterId` — permanent record of who served that order. Set once, at creation, to `actorId`. Reassignable later (e.g. shift handoff) via `PATCH /pos/orders/:id/waiter`.
- `PosTable.waiterId` — the table's *current* assigned waiter. Set automatically to `actorId` whenever a new dine-in order opens on that table, alongside the existing `status: OCCUPIED` transition. Cleared back to `null` whenever the table returns to `AVAILABLE`. Reassignable mid-service via `PATCH /pos/tables/:id/waiter`.

Both fields are raw `@db.Uuid` columns with no Prisma relation, matching the existing pattern used by `createdById`, `openedById`, `closedById` elsewhere in the POS schema. Waiter display name is resolved via a separate `UserProfile` lookup (`displayName` field) when hydrating orders, tables, and the floor map — never via a Prisma `include`.

### "Mis mesas" is a table-level filter, not an order-level filter

`GET /pos/tables/active-map` gains `?myTablesOnly=true`. When set, the service filters tables to `waiterId = actorId` before returning them. This reuses the auto-assignment described above — no extra bookkeeping needed.

### Split bill reuses the existing payment endpoint — no new payment model

`GET /pos/orders/:id/seat-totals` derives per-seat subtotals from `PosGuestSeat` + `PosOrderLine.guestSeatId`, purely as a read computation (no new table). Lines without a seat assignment are grouped under a synthetic "Sin asignar" bucket. The UI then calls the existing `POST /pos/orders/:id/payments` once per seat the diner wants to pay for. `PosPayment` itself does not need a seat reference — V1 split bill is about helping the cashier collect the right amount per diner, not about auditing which payment paid for which seat.

## 3. Data Model Additions

```prisma
// PosOrder — add directly after createdById:
waiterId  String?  @db.Uuid @map("waiter_id")

// PosTable — add directly after enabled:
waiterId  String?  @db.Uuid @map("waiter_id")
```

Migration `prisma/migrations/20260629120000_pos_waiter_split_bill/migration.sql`:

```sql
ALTER TABLE "pos_order" ADD COLUMN "waiter_id" UUID;
ALTER TABLE "pos_table" ADD COLUMN "waiter_id" UUID;
CREATE INDEX "pos_order_waiter_id_idx" ON "pos_order"("waiter_id");
CREATE INDEX "pos_table_waiter_id_idx" ON "pos_table"("waiter_id");
```

No foreign key constraint is added, consistent with how `created_by_id` / `opened_by_id` / `closed_by_id` are already modeled in this schema (app-level integrity only).

## 4. API Contract Additions

### New endpoints

```text
PATCH  /pos/orders/:id/waiter        permission: pos.orders.update
PATCH  /pos/tables/:id/waiter        permission: pos.terminal.use
GET    /pos/orders/:id/seat-totals   permission: pos.terminal.use
```

Request body for both `PATCH .../waiter` endpoints:

```json
{ "waiterId": "uuid-or-null" }
```

`waiterId: null` unassigns. A non-null `waiterId` must reference an existing `UserProfile` or the endpoint returns 404.

### Updated endpoint

```text
GET /pos/tables/active-map?outletId=<id>&myTablesOnly=true
```

`myTablesOnly` defaults to `false`. When `true`, only tables with `waiterId = actorId` are included in the response's `tables` array.

### `seat-totals` response shape

```json
{
  "seats": [
    {
      "id": "uuid",
      "label": "Comensal 1",
      "position": 1,
      "subtotal": 150.00,
      "taxAmount": 24.00,
      "total": 174.00,
      "linesCount": 3
    },
    {
      "id": null,
      "label": "Sin asignar",
      "position": 0,
      "subtotal": 50.00,
      "taxAmount": 8.00,
      "total": 58.00,
      "linesCount": 1
    }
  ],
  "orderTotal": 232.00,
  "paidAmount": 0.00,
  "remaining": 232.00
}
```

Seats with zero lines are omitted from the array.

## 5. Hydration Changes

- `hydrateOrder` (in `pos-order-service.js`) resolves `order.waiterId` → `order.waiterName` via `UserProfile.displayName` and includes it in every order payload (create, get, update, all mutation responses).
- `getActiveMap` and `getFloorWithLayout` (in `pos-floor-service.js`) batch-resolve `waiterId → waiterName` for all returned tables in one `userProfile.findMany({ where: { id: { in: [...] } } })` call — never N+1.

## 6. UI Changes

### PosTablesScreen

- New "Mis mesas" toggle button next to the existing zone selector. Active state passes `myTablesOnly: true` into `usePosActiveMap`.
- Table cards (`TableMap` and `FloorOperationalCanvas`) render a small waiter chip (avatar-style initials or truncated `waiterName`) on tables where `waiterId` is set.
- `TableActionPanel` gains an "Asignar mesa a mí" action (visible when the table has no order yet, or when reassigning) that calls the new table-waiter endpoint with the current session user's id.

### SplitBillDialog (new component)

- Opened from `PaymentDialog` via a "Dividir cuenta" button.
- Fetches `GET /pos/orders/:id/seat-totals`.
- Renders one card per seat: label, line count, total, and a "Cobrar esta cuenta" button that pre-fills a payment for that seat's total.
- After each partial payment, refetches seat totals and shows updated `remaining`.
- Closes automatically once `remaining` reaches zero.

### PaymentDialog

- Adds a two-option toggle at the top: "Mesa completa" (existing behavior, unchanged) / "Dividir cuenta" (opens `SplitBillDialog` in place of the amount field).

## 7. Permissions

No new permission keys are introduced. Existing keys are reused:

| Action | Permission |
|---|---|
| Order auto-assigns waiter on create | `pos.terminal.use` (already required to create orders) |
| Reassign order waiter | `pos.orders.update` |
| Claim/reassign table waiter | `pos.terminal.use` |
| View seat totals / split bill | `pos.terminal.use` |
| Charge a split payment | `pos.payments.create` (already required by the payment endpoint) |

## 8. Acceptance Criteria

1. Creating a dine-in `PosOrder` sets `waiterId` to the creating user's id.
2. Creating a dine-in order on a table sets that table's `waiterId` to the creating user's id and `status` to `OCCUPIED`.
3. Marking a table `AVAILABLE` clears its `waiterId`.
4. `GET /pos/orders/:id` includes `waiterId` and `waiterName`.
5. `PATCH /pos/orders/:id/waiter` updates the order's waiter and writes an audit entry.
6. `PATCH /pos/tables/:id/waiter` updates the table's waiter and writes an audit entry; rejects unknown `waiterId` with 404.
7. `GET /pos/tables/active-map?myTablesOnly=true` returns only tables where `waiterId` equals the requesting user's id.
8. Table map UI shows a waiter chip on any table with `waiterId` set.
9. "Mis mesas" toggle in `PosTablesScreen` filters the visible tables to the current user's assignments.
10. "Asignar mesa a mí" action in `TableActionPanel` calls the table-waiter endpoint with the current user.
11. `GET /pos/orders/:id/seat-totals` correctly groups lines by `guestSeatId`, with unassigned lines under "Sin asignar", and totals match the order's recorded amounts.
12. `SplitBillDialog` lists seat cards with correct totals and can fire a partial payment per seat via the existing payment endpoint.
13. After a partial payment, `SplitBillDialog` shows updated `remaining` without a full page reload.
14. `PaymentDialog` offers "Mesa completa" / "Dividir cuenta" and both flows successfully close the order once fully paid.

## 9. Out of Scope

- New `PosRole` or POS-specific role table — the existing permission catalog is sufficient.
- Per-seat payment auditing (`PosPayment` does not gain a `guestSeatId` reference in V1).
- Automatic table reassignment on shift change/logout.
- Tip splitting or per-seat tip allocation.

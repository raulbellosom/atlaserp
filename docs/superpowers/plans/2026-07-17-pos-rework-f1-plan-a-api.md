# POS Rework F1 — Plan A (API): Money Containers Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-17-pos-role-based-rework-design.md` (sections 10–14, 18, 22–25)

**Goal:** Every POS payment lands in exactly one money container — a terminal cash session (`PosSession`) or a new waiter shift (`PosWaiterShift`) — with per-outlet flags controlling table charging; no UI changes in this plan.

**Architecture:** Additive forward migration; new `pos-waiter-shift-service.js`; `addPayment` resolves the container; routes/validators/SDK/manifest permissions extended. Orders already do not require a session (verified 2026-07-17: the only session reference in `pos-order-service.js` is `sessionId: data.sessionId ?? null` at creation) — the coupling to remove is payment attribution.

**Tech Stack:** Prisma 7 (raw SQL migration folder, repo style `2026MMDDHHmmss_name/migration.sql`), Hono, Zod, node:test with in-memory mock prisma (style of `pos-session-service.test.js`).

**Conventions:** Work directly on `main`. Every commit ends with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer. Spanish error messages, English code/comments.

---

## File Structure Map

- Create: `prisma/migrations/20260717120000_pos_rework_f1_money_containers/migration.sql`
- Modify: `prisma/schema.prisma` (PosWaiterShift model; PosPayment + PosOutlet fields)
- Create: `apps/api/src/routes/pos/pos-waiter-shift-service.js`
- Create: `apps/api/src/routes/pos/__tests__/pos-waiter-shift-service.test.js`
- Modify: `apps/api/src/routes/pos/pos-order-service.js` (addPayment container resolution; factory signature)
- Modify: `apps/api/src/routes/pos/__tests__/pos-order-service.test.js` (payment container tests)
- Modify: `apps/api/src/routes/pos/validators.js` (3 new schemas; 2 extended)
- Modify: `apps/api/src/routes/pos/pos-routes.js` (4 shift routes; service wiring)
- Modify: `apps/api/src/manifests/official/core-modules.js` (10 new permission keys + acl — navigation stays for Plan B)
- Modify: `packages/sdk/src/index.js` (pos domain: 4 shift methods)

---

### Task 1: Schema + forward migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260717120000_pos_rework_f1_money_containers/migration.sql`

- [ ] **Step 1: Add the PosWaiterShift model to `prisma/schema.prisma`** (place after `model PosSession`, reusing the `PosSessionStatus` enum):

```prisma
model PosWaiterShift {
  id                   String           @id @default(dbgenerated("uuidv7()")) @db.Uuid
  companyId            String           @db.Uuid @map("company_id")
  outletId             String           @db.Uuid @map("outlet_id")
  waiterId             String           @db.Uuid @map("waiter_id")
  status               PosSessionStatus @default(OPEN)
  expectedCashAmount   Decimal          @default(0.00) @db.Decimal(12, 2) @map("expected_cash_amount")
  deliveredAmount      Decimal?         @db.Decimal(12, 2) @map("delivered_amount")
  deliveredToSessionId String?          @db.Uuid @map("delivered_to_session_id")
  openedAt             DateTime         @default(now()) @map("opened_at")
  closedAt             DateTime?        @map("closed_at")
  notes                String?

  outlet             PosOutlet   @relation(fields: [outletId], references: [id], onDelete: Restrict)
  deliveredToSession PosSession? @relation(fields: [deliveredToSessionId], references: [id], onDelete: SetNull)
  payments           PosPayment[]

  @@index([companyId, outletId, status])
  @@index([companyId, waiterId, status])
  @@map("pos_waiter_shift")
}
```

- [ ] **Step 2: Extend `PosPayment`** — add after `createdById`:

```prisma
  sessionId     String? @db.Uuid @map("session_id")
  waiterShiftId String? @db.Uuid @map("waiter_shift_id")
```

and to its relations block:

```prisma
  session     PosSession?     @relation(fields: [sessionId], references: [id], onDelete: Restrict)
  waiterShift PosWaiterShift? @relation(fields: [waiterShiftId], references: [id], onDelete: Restrict)
```

plus indexes `@@index([sessionId])` and `@@index([waiterShiftId])`. Add the back-relations `payments PosPayment[]` and `waiterShifts PosWaiterShift[]` to `PosSession`.

- [ ] **Step 3: Extend `PosOutlet`** — add after `mode`:

```prisma
  allowTableCharge    Boolean @default(false) @map("allow_table_charge")
  defaultStationId    String? @db.Uuid @map("default_station_id")
  kitchenKdsEnabled   Boolean @default(true) @map("kitchen_kds_enabled")
  kitchenPrintEnabled Boolean @default(false) @map("kitchen_print_enabled")
```

with relation `defaultStation PosKitchenStation? @relation("OutletDefaultStation", fields: [defaultStationId], references: [id], onDelete: SetNull)` and the matching named back-relation `defaultForOutlets PosOutlet[] @relation("OutletDefaultStation")` on `PosKitchenStation`. Also add `waiterShifts PosWaiterShift[]` to `PosOutlet`.

- [ ] **Step 4: Write the migration SQL** at `prisma/migrations/20260717120000_pos_rework_f1_money_containers/migration.sql`:

```sql
-- PosWaiterShift
CREATE TABLE "pos_waiter_shift" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "waiter_id" UUID NOT NULL,
    "status" "pos_session_status" NOT NULL DEFAULT 'OPEN',
    "expected_cash_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "delivered_amount" DECIMAL(12,2),
    "delivered_to_session_id" UUID,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "pos_waiter_shift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pos_waiter_shift_company_id_outlet_id_status_idx" ON "pos_waiter_shift"("company_id", "outlet_id", "status");
CREATE INDEX "pos_waiter_shift_company_id_waiter_id_status_idx" ON "pos_waiter_shift"("company_id", "waiter_id", "status");
ALTER TABLE "pos_waiter_shift" ADD CONSTRAINT "pos_waiter_shift_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "pos_outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_waiter_shift" ADD CONSTRAINT "pos_waiter_shift_delivered_to_session_id_fkey"
    FOREIGN KEY ("delivered_to_session_id") REFERENCES "pos_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PosPayment money containers
ALTER TABLE "pos_payment"
    ADD COLUMN "session_id" UUID,
    ADD COLUMN "waiter_shift_id" UUID;
UPDATE "pos_payment" p SET "session_id" = o."session_id"
    FROM "pos_order" o WHERE p."order_id" = o."id" AND o."session_id" IS NOT NULL;
CREATE INDEX "pos_payment_session_id_idx" ON "pos_payment"("session_id");
CREATE INDEX "pos_payment_waiter_shift_id_idx" ON "pos_payment"("waiter_shift_id");
ALTER TABLE "pos_payment" ADD CONSTRAINT "pos_payment_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "pos_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_payment" ADD CONSTRAINT "pos_payment_waiter_shift_id_fkey"
    FOREIGN KEY ("waiter_shift_id") REFERENCES "pos_waiter_shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- NOT VALID: legacy payments on session-less orders keep both columns NULL; new rows must pick exactly one.
ALTER TABLE "pos_payment" ADD CONSTRAINT "pos_payment_money_container_check"
    CHECK (num_nonnulls("session_id", "waiter_shift_id") = 1) NOT VALID;

-- PosOutlet behavior flags
ALTER TABLE "pos_outlet"
    ADD COLUMN "allow_table_charge" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "default_station_id" UUID,
    ADD COLUMN "kitchen_kds_enabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "kitchen_print_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pos_outlet" ADD CONSTRAINT "pos_outlet_default_station_id_fkey"
    FOREIGN KEY ("default_station_id") REFERENCES "pos_kitchen_station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 5: Validate and apply**

```bash
pnpm.cmd exec prisma validate
pnpm.cmd db:migrate
pnpm.cmd db:generate
```

Expected: migration `20260717120000_pos_rework_f1_money_containers` applied; client regenerated. If `prisma validate` complains about relation names, fix the named relations until clean — do NOT edit the SQL after applying.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260717120000_pos_rework_f1_money_containers/
git commit -m "feat(pos): add waiter shift model, payment money containers, and outlet behavior flags

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Waiter shift service (TDD)

**Files:**
- Create: `apps/api/src/routes/pos/__tests__/pos-waiter-shift-service.test.js`
- Create: `apps/api/src/routes/pos/pos-waiter-shift-service.js`

- [ ] **Step 1: Write the failing tests.** Follow the in-memory mock style of `pos-session-service.test.js` (`makePrisma()` returning object stores). Cover:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPosWaiterShiftService } from "../pos-waiter-shift-service.js";
import { PosServiceError } from "../service-helpers.js";

function makePrisma() {
  const shifts = new Map();
  const outlets = new Map([["outlet-1", { id: "outlet-1", companyId: "co-1", allowTableCharge: true }]]);
  const sessions = new Map([["session-1", { id: "session-1", companyId: "co-1", status: "OPEN" }]]);
  const cashMovements = [];
  const audits = [];
  let seq = 0;
  return {
    shifts, cashMovements, audits,
    posOutlet: {
      findFirst: async ({ where }) => {
        const row = outlets.get(where.id);
        return row && row.companyId === where.companyId ? row : null;
      },
    },
    posSession: {
      findFirst: async ({ where }) => {
        const row = sessions.get(where.id);
        if (!row) return null;
        if (where.companyId && row.companyId !== where.companyId) return null;
        if (where.status && row.status !== where.status) return null;
        return row;
      },
    },
    posWaiterShift: {
      findFirst: async ({ where }) =>
        [...shifts.values()].find(
          (r) =>
            r.companyId === where.companyId &&
            (!where.id || r.id === where.id) &&
            (!where.outletId || r.outletId === where.outletId) &&
            (!where.waiterId || r.waiterId === where.waiterId) &&
            (!where.status || r.status === where.status),
        ) ?? null,
      findMany: async ({ where }) =>
        [...shifts.values()].filter(
          (r) =>
            r.companyId === where.companyId &&
            (!where.outletId || r.outletId === where.outletId) &&
            (!where.status || r.status === where.status),
        ),
      create: async ({ data }) => {
        const row = { id: `shift-${++seq}`, status: "OPEN", expectedCashAmount: 0, ...data };
        shifts.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...shifts.get(where.id), ...data };
        shifts.set(where.id, row);
        return row;
      },
    },
    posCashMovement: {
      create: async ({ data }) => {
        const row = { id: `mov-${cashMovements.length + 1}`, ...data };
        cashMovements.push(row);
        return row;
      },
    },
    auditLog: { create: async ({ data }) => audits.push(data) },
  };
}

describe("pos-waiter-shift-service", () => {
  it("ensureOpenShift creates a shift on first use and reuses it afterwards", async () => {
    const prisma = makePrisma();
    const svc = createPosWaiterShiftService({ prisma });
    const a = await svc.ensureOpenShift({ companyId: "co-1", outletId: "outlet-1", waiterId: "user-1" });
    const b = await svc.ensureOpenShift({ companyId: "co-1", outletId: "outlet-1", waiterId: "user-1" });
    assert.equal(a.id, b.id);
    assert.equal(prisma.shifts.size, 1);
  });

  it("ensureOpenShift rejects when the outlet does not allow table charge", async () => {
    const prisma = makePrisma();
    prisma.posOutlet.findFirst = async () => ({ id: "outlet-1", companyId: "co-1", allowTableCharge: false });
    const svc = createPosWaiterShiftService({ prisma });
    await assert.rejects(
      () => svc.ensureOpenShift({ companyId: "co-1", outletId: "outlet-1", waiterId: "user-1" }),
      (err) => err instanceof PosServiceError && err.status === 409,
    );
  });

  it("registerCharge accumulates expected cash only for cash payments", async () => {
    const prisma = makePrisma();
    const svc = createPosWaiterShiftService({ prisma });
    const shift = await svc.ensureOpenShift({ companyId: "co-1", outletId: "outlet-1", waiterId: "user-1" });
    await svc.registerCharge({ companyId: "co-1", shiftId: shift.id, amount: 100, isCash: true });
    await svc.registerCharge({ companyId: "co-1", shiftId: shift.id, amount: 50, isCash: false });
    assert.equal(Number(prisma.shifts.get(shift.id).expectedCashAmount), 100);
  });

  it("closeShift marks CLOSED, records delivery on the session, and is idempotent-guarded", async () => {
    const prisma = makePrisma();
    const svc = createPosWaiterShiftService({ prisma });
    const shift = await svc.ensureOpenShift({ companyId: "co-1", outletId: "outlet-1", waiterId: "user-1" });
    const closed = await svc.closeShift({
      companyId: "co-1", actorId: "cashier-1", id: shift.id,
      data: { deliveredAmount: 100, sessionId: "session-1" },
    });
    assert.equal(closed.status, "CLOSED");
    assert.equal(prisma.cashMovements.length, 1);
    assert.equal(prisma.cashMovements[0].kind, "WAITER_DELIVERY");
    await assert.rejects(
      () => svc.closeShift({ companyId: "co-1", actorId: "cashier-1", id: shift.id, data: { deliveredAmount: 100, sessionId: "session-1" } }),
      (err) => err instanceof PosServiceError && err.status === 409,
    );
  });
});
```

- [ ] **Step 2: Run and verify they fail** (module not found):

```bash
node --test apps/api/src/routes/pos/__tests__/pos-waiter-shift-service.test.js
```

- [ ] **Step 3: Implement `pos-waiter-shift-service.js`:**

```js
import { PosServiceError, requireCompanyId, writeAudit, toMoney } from "./service-helpers.js";

export function createPosWaiterShiftService({ prisma }) {
  async function getCurrentShift({ companyId, outletId, waiterId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    return prisma.posWaiterShift.findFirst({
      where: { companyId: scopedCompanyId, outletId, waiterId, status: "OPEN" },
    });
  }

  async function ensureOpenShift({ companyId, outletId, waiterId }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const outlet = await prisma.posOutlet.findFirst({ where: { id: outletId, companyId: scopedCompanyId } });
    if (!outlet) throw new PosServiceError("Sucursal POS no encontrada.", 404);
    if (!outlet.allowTableCharge) {
      throw new PosServiceError("El cobro en mesa no esta habilitado en esta sucursal.", 409);
    }
    const existing = await getCurrentShift({ companyId: scopedCompanyId, outletId, waiterId });
    if (existing) return existing;
    return prisma.posWaiterShift.create({
      data: { companyId: scopedCompanyId, outletId, waiterId },
    });
  }

  async function registerCharge({ companyId, shiftId, amount, isCash }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const shift = await prisma.posWaiterShift.findFirst({
      where: { id: shiftId, companyId: scopedCompanyId, status: "OPEN" },
    });
    if (!shift) throw new PosServiceError("Corte de mesero no encontrado o cerrado.", 404);
    if (!isCash) return shift;
    return prisma.posWaiterShift.update({
      where: { id: shiftId },
      data: { expectedCashAmount: toMoney(Number(shift.expectedCashAmount ?? 0) + Number(amount)) },
    });
  }

  async function closeShift({ companyId, actorId, id, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const shift = await prisma.posWaiterShift.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!shift) throw new PosServiceError("Corte de mesero no encontrado.", 404);
    if (shift.status === "CLOSED") throw new PosServiceError("El corte ya fue cerrado.", 409);
    const session = await prisma.posSession.findFirst({
      where: { id: data.sessionId, companyId: scopedCompanyId, status: "OPEN" },
    });
    if (!session) throw new PosServiceError("Sesion de caja no encontrada o cerrada.", 404);
    const deliveredAmount = toMoney(data.deliveredAmount);
    const closed = await prisma.posWaiterShift.update({
      where: { id },
      data: {
        status: "CLOSED",
        deliveredAmount,
        deliveredToSessionId: session.id,
        closedAt: new Date(),
        notes: data.notes ?? shift.notes ?? null,
      },
    });
    await prisma.posCashMovement.create({
      data: {
        companyId: scopedCompanyId,
        sessionId: session.id,
        kind: "WAITER_DELIVERY",
        amount: deliveredAmount,
        reason: `Entrega de corte de mesero ${shift.waiterId}`,
        createdById: actorId,
      },
    });
    await writeAudit(prisma, {
      actorId,
      entityType: "PosWaiterShift",
      entityId: id,
      action: "pos.waiterShift.close",
      before: shift,
      after: closed,
    });
    return closed;
  }

  async function listShifts({ companyId, outletId, status }) {
    const scopedCompanyId = requireCompanyId(companyId);
    return prisma.posWaiterShift.findMany({
      where: {
        companyId: scopedCompanyId,
        ...(outletId ? { outletId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { openedAt: "desc" },
    });
  }

  return { getCurrentShift, ensureOpenShift, registerCharge, closeShift, listShifts };
}
```

Note: check `service-helpers.js` exports `toMoney` — if it lives in the order service instead, import from where it is or inline `const toMoney = (n) => Math.round(Number(n) * 100) / 100;` matching existing behavior. Match `posCashMovement` field names against the existing `cashMovementSchema` usage in `pos-session-service.js` (e.g. `reason` vs `notes`) and adjust the create payload to the real columns.

- [ ] **Step 4: Run tests to green**

```bash
node --test apps/api/src/routes/pos/__tests__/pos-waiter-shift-service.test.js
```

Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pos/pos-waiter-shift-service.js apps/api/src/routes/pos/__tests__/pos-waiter-shift-service.test.js
git commit -m "feat(pos): add waiter shift service with ensure-open, charge accrual, and delivery close

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: addPayment money-container resolution (TDD)

**Files:**
- Modify: `apps/api/src/routes/pos/__tests__/pos-order-service.test.js`
- Modify: `apps/api/src/routes/pos/pos-order-service.js`

- [ ] **Step 1: Write failing tests** in the existing order-service test file (extend its `makePrisma` with `posWaiterShift`/`posOutlet` stores as in Task 2, and a `waiterShifts` service stub passed to the factory):

```js
describe("addPayment money containers", () => {
  it("attaches the payment to the given open session", async () => {
    // arrange order + open session in mocks; act:
    const payment = await svc.addPayment({
      companyId: "co-1", orderId: "order-1", actorId: "cashier-1",
      data: { paymentMethodId: "pm-cash", amount: 50, sessionId: "session-1" },
    });
    assert.equal(prisma.payments[0].sessionId, "session-1");
    assert.equal(prisma.payments[0].waiterShiftId, null);
  });

  it("falls back to an ensured waiter shift when no session is given and outlet allows table charge", async () => {
    const payment = await svc.addPayment({
      companyId: "co-1", orderId: "order-1", actorId: "waiter-1",
      data: { paymentMethodId: "pm-cash", amount: 50 },
    });
    assert.equal(prisma.payments[0].sessionId, null);
    assert.ok(prisma.payments[0].waiterShiftId);
  });

  it("rejects 409 when no session is given and outlet forbids table charge", async () => {
    // outlet.allowTableCharge = false in mock
    await assert.rejects(
      () => svc.addPayment({ companyId: "co-1", orderId: "order-1", actorId: "waiter-1", data: { paymentMethodId: "pm-cash", amount: 50 } }),
      (err) => err.status === 409,
    );
  });

  it("rejects 404 for a closed or foreign session", async () => {
    await assert.rejects(
      () => svc.addPayment({ companyId: "co-1", orderId: "order-1", actorId: "cashier-1", data: { paymentMethodId: "pm-cash", amount: 50, sessionId: "session-closed" } }),
      (err) => err.status === 404,
    );
  });
});
```

Fill the arrange blocks with the file's existing mock conventions (look at how current addPayment tests seed orders/methods and reuse that setup verbatim).

- [ ] **Step 2: Run to verify the new tests fail**

```bash
node --test apps/api/src/routes/pos/__tests__/pos-order-service.test.js
```

- [ ] **Step 3: Implement.** In `pos-order-service.js`:

1. Factory signature: `export function createPosOrderService({ prisma, waiterShifts })` — `waiterShifts` optional; when absent, construct lazily: `import { createPosWaiterShiftService } from "./pos-waiter-shift-service.js";` and `const shiftSvc = waiterShifts ?? createPosWaiterShiftService({ prisma });`
2. In `addPayment`, after the method lookup (line ~449) insert:

```js
    let sessionId = data.sessionId ?? null;
    let waiterShiftId = null;
    if (sessionId) {
      const session = await prisma.posSession.findFirst({
        where: { id: sessionId, companyId: scopedCompanyId, status: "OPEN" },
      });
      if (!session) throw new PosServiceError("Sesion de caja no encontrada o cerrada.", 404);
    } else {
      const shift = await shiftSvc.ensureOpenShift({
        companyId: scopedCompanyId,
        outletId: before.outletId,
        waiterId: actorId,
      });
      waiterShiftId = shift.id;
    }
```

3. Add `sessionId` and `waiterShiftId` to the `prisma.posPayment.create` data.
4. After creating the payment, when `waiterShiftId` is set:

```js
    if (waiterShiftId) {
      await shiftSvc.registerCharge({
        companyId: scopedCompanyId,
        shiftId: waiterShiftId,
        amount,
        isCash: method.kind === "CASH",
      });
    }
```

(Verify the cash `kind` literal against real data: the dev method was created with Tipo "Efectivo" — check `pos-settings-service.js` for the exact `kind` value it stores and use that constant.)

- [ ] **Step 4: Run the full order suite to green**

```bash
node --test apps/api/src/routes/pos/__tests__/pos-order-service.test.js
```

Expected: all previous + 4 new pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pos/pos-order-service.js apps/api/src/routes/pos/__tests__/pos-order-service.test.js
git commit -m "feat(pos): resolve payment money container (session or waiter shift) in addPayment

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Validators + routes

**Files:**
- Modify: `apps/api/src/routes/pos/validators.js`
- Modify: `apps/api/src/routes/pos/pos-routes.js`

- [ ] **Step 1: Validators.** Add:

```js
export const openWaiterShiftSchema = z.object({
  outletId: z.string().uuid(),
});

export const closeWaiterShiftSchema = z.object({
  deliveredAmount: z.coerce.number().min(0),
  sessionId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});
```

Extend `createPaymentSchema` with `sessionId: z.string().uuid().optional()`, and `updateOutletSchema` with:

```js
  allowTableCharge: z.boolean().optional(),
  defaultStationId: z.string().uuid().nullable().optional(),
  kitchenKdsEnabled: z.boolean().optional(),
  kitchenPrintEnabled: z.boolean().optional(),
```

Run `node --check apps/api/src/routes/pos/validators.js`.

- [ ] **Step 2: Routes.** In `pos-routes.js`: import `createPosWaiterShiftService`, `openWaiterShiftSchema`, `closeWaiterShiftSchema`; instantiate `const waiterShiftSvc = createPosWaiterShiftService({ prisma });` and pass it into the order service factory (`createPosOrderService({ prisma, waiterShifts: waiterShiftSvc })`). Add, following the file's exact route style (`requirePermission`, `context(c)`, `parseBody`, `handleError`):

```js
  app.get("/pos/waiter-shifts", requirePermission("pos.caja.read"), async (c) => {
    try {
      return c.json({
        data: await waiterShiftSvc.listShifts({
          ...context(c),
          outletId: c.req.query("outletId") || undefined,
          status: c.req.query("status") || undefined,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar los cortes de mesero.");
    }
  });

  app.get("/pos/waiter-shifts/current", requirePermission("pos.comandas.charge"), async (c) => {
    try {
      const ctx = context(c);
      return c.json({
        data: await waiterShiftSvc.getCurrentShift({
          companyId: ctx.companyId,
          outletId: c.req.query("outletId"),
          waiterId: ctx.actorId,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar el corte actual.");
    }
  });

  app.post("/pos/waiter-shifts/open", requirePermission("pos.comandas.charge"), async (c) => {
    try {
      const ctx = context(c);
      const data = await parseBody(c, openWaiterShiftSchema);
      return c.json({
        data: await waiterShiftSvc.ensureOpenShift({
          companyId: ctx.companyId,
          outletId: data.outletId,
          waiterId: ctx.actorId,
        }),
      }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo abrir el corte de mesero.");
    }
  });

  app.post("/pos/waiter-shifts/:id/close", requirePermission("pos.caja.close"), async (c) => {
    try {
      const data = await parseBody(c, closeWaiterShiftSchema);
      return c.json({
        data: await waiterShiftSvc.closeShift({
          ...context(c),
          id: c.req.param("id"),
          data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo cerrar el corte de mesero.");
    }
  });
```

Run `node --check apps/api/src/routes/pos/pos-routes.js`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/pos/validators.js apps/api/src/routes/pos/pos-routes.js
git commit -m "feat(pos): expose waiter shift routes and outlet behavior flag validators

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Manifest permissions + seed

**Files:**
- Modify: `apps/api/src/manifests/official/core-modules.js` (posMap `permissions` + `acl.actions`; navigation is Plan B's job)

- [ ] **Step 1: Append the 10 new permission entries** (keep the existing ones — legacy keys still guard old routes):

```js
    { key: "pos.caja.read", name: "Ver puesto de caja" },
    { key: "pos.caja.operate", name: "Cobrar y registrar movimientos en caja" },
    { key: "pos.caja.close", name: "Cerrar caja y recibir cortes" },
    { key: "pos.comandas.read", name: "Ver puesto de comandero" },
    { key: "pos.comandas.create", name: "Tomar y editar comandas" },
    { key: "pos.comandas.charge", name: "Cobrar en mesa" },
    { key: "pos.cocina.read", name: "Ver tablero de cocina" },
    { key: "pos.cocina.operate", name: "Marcar comandas listas" },
    { key: "pos.admin.read", name: "Ver administracion POS" },
    { key: "pos.admin.update", name: "Editar configuracion POS" },
```

and mirror each into `acl.actions` (`"pos.caja.read": "pos.caja.read"`, etc.).

- [ ] **Step 2: Reseed and verify catalog**

```bash
pnpm.cmd db:seed
pnpm.cmd run rbac:verify-catalog
```

Expected: seed OK; `missing_in_catalog=0` (add the Spanish names to `apps/api/src/permission-catalog.js` if the verifier requires entries there — follow whatever the verifier reports).

- [ ] **Step 3: Contract test**

```bash
node --test apps/api/src/manifests/official/__tests__/atlas-pos-contract.test.js
```

Expected: pass (update the test's expected permission count if it asserts one).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/manifests/official/core-modules.js apps/api/src/permission-catalog.js
git commit -m "feat(pos): add role-post permission keys (caja, comandas, cocina, admin)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: SDK methods

**Files:**
- Modify: `packages/sdk/src/index.js` (inside the `pos:` domain, near `getSettings` at ~line 933)

- [ ] **Step 1: Add:**

```js
      listWaiterShifts: (params, token) => {
        const qs = new URLSearchParams(
          Object.entries(params ?? {}).filter(([, v]) => v != null && v !== ""),
        ).toString();
        return request(`/pos/waiter-shifts${qs ? `?${qs}` : ""}`, { headers: withAuthHeaders(token) });
      },
      currentWaiterShift: (outletId, token) =>
        request(`/pos/waiter-shifts/current?outletId=${outletId}`, { headers: withAuthHeaders(token) }),
      openWaiterShift: (data, token) =>
        request("/pos/waiter-shifts/open", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      closeWaiterShift: (id, data, token) =>
        request(`/pos/waiter-shifts/${id}/close`, {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
```

Match the exact `request`/body conventions of neighboring pos methods (some use a shared `jsonBody` helper — mirror whatever `updateSettings` does).

- [ ] **Step 2: Check and commit**

```bash
node --check packages/sdk/src/index.js
git add packages/sdk/src/index.js
git commit -m "feat(sdk): add pos waiter shift client methods

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification

- [ ] **Step 1: Whole POS suite + syntax**

```bash
node --test "apps/api/src/routes/pos/__tests__/*.test.js"
node --check apps/api/src/routes/pos/pos-order-service.js
```

Expected: all pass (31 prior + new ones).

- [ ] **Step 2: Boot check** — start `pnpm dev:api`, then:

```bash
curl -s http://localhost:4010/health
```

Expected: 200. Stop the server afterwards.

- [ ] **Step 3: Update `docs/TASKS.md`** — under the atlas.pos section add:

```markdown
- [x] F1-A Money containers: `PosWaiterShift`, payment session/shift attribution, outlet flags, shift routes/SDK, role-post permissions
```

with a `Verified:` line listing the actual commands run. Commit:

```bash
git add docs/TASKS.md
git commit -m "docs(tasks): record POS rework F1-A completion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

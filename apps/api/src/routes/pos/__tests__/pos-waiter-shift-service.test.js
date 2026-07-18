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

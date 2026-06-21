import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPosSessionService } from "../pos-session-service.js";
import { PosServiceError } from "../service-helpers.js";

function makePrisma() {
  const sessions = new Map();
  const cashMovements = [];
  const payments = [];
  const audits = [];

  return {
    sessions,
    cashMovements,
    payments,
    audits,
    posSession: {
      findMany: async ({ where }) =>
        [...sessions.values()].filter(
          (row) =>
            row.companyId === where.companyId &&
            (!where.status || row.status === where.status),
        ),
      findFirst: async ({ where }) =>
        [...sessions.values()].find((row) => {
          if (where.id && row.id !== where.id) return false;
          if (where.companyId && row.companyId !== where.companyId) return false;
          if (where.terminalId && row.terminalId !== where.terminalId) return false;
          if (where.status && row.status !== where.status) return false;
          return true;
        }) ?? null,
      create: async ({ data }) => {
        const row = { id: `session-${sessions.size + 1}`, status: "OPEN", ...data };
        sessions.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...sessions.get(where.id), ...data };
        sessions.set(where.id, row);
        return row;
      },
    },
    posCashMovement: {
      create: async ({ data }) => {
        const row = { id: `movement-${cashMovements.length + 1}`, ...data };
        cashMovements.push(row);
        return row;
      },
      findMany: async ({ where }) =>
        cashMovements.filter(
          (row) => row.companyId === where.companyId && row.sessionId === where.sessionId,
        ),
    },
    posPayment: {
      findMany: async ({ where }) =>
        payments.filter(
          (row) =>
            row.companyId === where.companyId &&
            row.status === where.status &&
            row.order?.sessionId === where.order.sessionId,
        ),
    },
    auditLog: {
      create: async ({ data }) => {
        audits.push(data);
        return data;
      },
    },
  };
}

describe("createPosSessionService", () => {
  it("rejects opening a second open session for the same terminal", async () => {
    const prisma = makePrisma();
    const svc = createPosSessionService({ prisma });
    await svc.openSession({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", terminalId: "terminal-1", openingCashAmount: 100 },
    });

    await assert.rejects(
      () =>
        svc.openSession({
          companyId: "company-1",
          actorId: "user-1",
          data: { outletId: "outlet-1", terminalId: "terminal-1", openingCashAmount: 0 },
        }),
      (err) => err instanceof PosServiceError && err.status === 409,
    );
  });

  it("adds cash movements only to open sessions", async () => {
    const prisma = makePrisma();
    const svc = createPosSessionService({ prisma });
    const session = await svc.openSession({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", terminalId: "terminal-1", openingCashAmount: 100 },
    });

    const movement = await svc.addCashMovement({
      companyId: "company-1",
      sessionId: session.id,
      actorId: "user-1",
      data: { kind: "IN", amount: 20, reason: "Fondo adicional" },
    });
    assert.equal(movement.amount, 20);

    await svc.closeSession({
      companyId: "company-1",
      sessionId: session.id,
      actorId: "user-1",
      data: { countedCashAmount: 120 },
    });
    await assert.rejects(
      () =>
        svc.addCashMovement({
          companyId: "company-1",
          sessionId: session.id,
          actorId: "user-1",
          data: { kind: "OUT", amount: 10, reason: "Retiro" },
        }),
      (err) => err instanceof PosServiceError && err.status === 409,
    );
  });

  it("closes a session summing cash payments and movements", async () => {
    const prisma = makePrisma();
    const svc = createPosSessionService({ prisma });
    const session = await svc.openSession({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", terminalId: "terminal-1", openingCashAmount: 100 },
    });
    prisma.payments.push(
      {
        companyId: "company-1",
        status: "CAPTURED",
        amount: 80,
        order: { sessionId: session.id },
        paymentMethod: { kind: "CASH" },
      },
      {
        companyId: "company-1",
        status: "CAPTURED",
        amount: 50,
        order: { sessionId: session.id },
        paymentMethod: { kind: "CARD" },
      },
    );
    await svc.addCashMovement({
      companyId: "company-1",
      sessionId: session.id,
      actorId: "user-1",
      data: { kind: "IN", amount: 20, reason: "Ingreso" },
    });
    await svc.addCashMovement({
      companyId: "company-1",
      sessionId: session.id,
      actorId: "user-1",
      data: { kind: "OUT", amount: 10, reason: "Retiro" },
    });

    const closed = await svc.closeSession({
      companyId: "company-1",
      sessionId: session.id,
      actorId: "user-1",
      data: { countedCashAmount: 195 },
    });

    assert.equal(closed.status, "CLOSED");
    assert.equal(closed.expectedCashAmount, 190);
    assert.equal(closed.differenceAmount, 5);
  });

  it("rejects sessions outside company scope", async () => {
    const prisma = makePrisma();
    const svc = createPosSessionService({ prisma });
    const session = await svc.openSession({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", terminalId: "terminal-1", openingCashAmount: 0 },
    });

    await assert.rejects(
      () => svc.getSessionById({ companyId: "company-2", id: session.id }),
      (err) => err instanceof PosServiceError && err.status === 404,
    );
  });
});

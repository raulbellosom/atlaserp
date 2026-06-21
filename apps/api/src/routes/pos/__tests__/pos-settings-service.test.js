import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPosSettingsService } from "../pos-settings-service.js";
import { PosServiceError } from "../service-helpers.js";

function makePrisma() {
  const settings = new Map();
  const outlets = new Map();
  const terminals = new Map();
  const audits = [];

  return {
    audits,
    posSettings: {
      findUnique: async ({ where }) => settings.get(where.companyId) ?? null,
      create: async ({ data }) => {
        const row = { id: "settings-1", ...data };
        settings.set(data.companyId, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...settings.get(where.companyId), ...data };
        settings.set(where.companyId, row);
        return row;
      },
    },
    posOutlet: {
      findMany: async ({ where }) =>
        [...outlets.values()].filter((row) => row.companyId === where.companyId),
      create: async ({ data }) => {
        const row = { id: `outlet-${outlets.size + 1}`, enabled: true, ...data };
        outlets.set(row.id, row);
        return row;
      },
      findFirst: async ({ where }) =>
        [...outlets.values()].find(
          (row) => row.id === where.id && row.companyId === where.companyId,
        ) ?? null,
      update: async ({ where, data }) => {
        const row = { ...outlets.get(where.id), ...data };
        outlets.set(where.id, row);
        return row;
      },
    },
    posTerminal: {
      findMany: async ({ where }) =>
        [...terminals.values()].filter((row) => row.companyId === where.companyId),
      create: async ({ data }) => {
        const row = { id: `terminal-${terminals.size + 1}`, enabled: true, ...data };
        terminals.set(row.id, row);
        return row;
      },
      findFirst: async ({ where }) =>
        [...terminals.values()].find(
          (row) => row.id === where.id && row.companyId === where.companyId,
        ) ?? null,
      update: async ({ where, data }) => {
        const row = { ...terminals.get(where.id), ...data };
        terminals.set(where.id, row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        audits.push(data);
        return data;
      },
    },
  };
}

describe("createPosSettingsService", () => {
  it("creates default settings on first read", async () => {
    const svc = createPosSettingsService({ prisma: makePrisma() });

    const settings = await svc.getSettings({ companyId: "company-1" });

    assert.equal(settings.mode, "RESTAURANT");
    assert.equal(settings.currency, "MXN");
    assert.equal(Number(settings.defaultTaxRate), 16);
  });

  it("updates settings and writes audit", async () => {
    const prisma = makePrisma();
    const svc = createPosSettingsService({ prisma });

    const settings = await svc.updateSettings({
      companyId: "company-1",
      actorId: "user-1",
      data: { currency: "USD", receiptFooter: " Gracias " },
    });

    assert.equal(settings.currency, "USD");
    assert.equal(settings.receiptFooter, "Gracias");
    assert.equal(prisma.audits.at(-1).action, "pos.settings.update");
  });

  it("creates and lists outlets scoped by company", async () => {
    const svc = createPosSettingsService({ prisma: makePrisma() });

    const outlet = await svc.createOutlet({
      companyId: "company-1",
      actorId: "user-1",
      data: { name: " Sucursal Centro ", code: " CENTRO " },
    });

    assert.equal(outlet.name, "Sucursal Centro");
    assert.equal(outlet.code, "CENTRO");
    const rows = await svc.listOutlets({ companyId: "company-1" });
    assert.equal(rows.length, 1);
  });

  it("throws 404 when updating an outlet outside company scope", async () => {
    const svc = createPosSettingsService({ prisma: makePrisma() });

    await assert.rejects(
      () =>
        svc.updateOutlet({
          companyId: "company-1",
          id: "missing",
          actorId: "user-1",
          data: { name: "X" },
        }),
      (err) => err instanceof PosServiceError && err.status === 404,
    );
  });

  it("creates, lists and updates terminals scoped by company", async () => {
    const svc = createPosSettingsService({ prisma: makePrisma() });
    const outlet = await svc.createOutlet({
      companyId: "company-1",
      actorId: "user-1",
      data: { name: "Sucursal" },
    });

    const terminal = await svc.createTerminal({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: outlet.id, name: " Caja 1 ", code: " C1 " },
    });
    const updated = await svc.updateTerminal({
      companyId: "company-1",
      id: terminal.id,
      actorId: "user-1",
      data: { name: "Caja Principal" },
    });

    assert.equal(updated.name, "Caja Principal");
    assert.equal(updated.code, "C1");
    assert.equal((await svc.listTerminals({ companyId: "company-1" })).length, 1);
  });
});

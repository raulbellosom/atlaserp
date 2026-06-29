import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPosFloorService } from "../pos-floor-service.js";
import { createPosKitchenService } from "../pos-kitchen-service.js";
import { PosServiceError } from "../service-helpers.js";

function makePrisma() {
  const floors = new Map();
  const tables = new Map();
  const stations = new Map();
  const orders = new Map();
  const lines = new Map();
  const configs = new Map();
  const tickets = new Map();
  const ticketLines = new Map();
  const audits = [];

  const profiles = new Map([
    ["user-1", { id: "user-1", displayName: "Mesero Principal" }],
  ]);

  const prisma = {
    floors,
    tables,
    stations,
    orders,
    lines,
    configs,
    tickets,
    ticketLines,
    audits,
    profiles,
    $transaction: async (fn) => fn(prisma),
    userProfile: {
      findUnique: async ({ where }) => profiles.get(where.id) ?? null,
      findMany: async ({ where }) => {
        const ids = where?.id?.in ?? [];
        return ids.map((id) => profiles.get(id)).filter(Boolean);
      },
    },
    posFloor: {
      findMany: async ({ where }) =>
        [...floors.values()].filter(
          (row) => row.companyId === where.companyId && (!where.outletId || row.outletId === where.outletId),
        ),
      findFirst: async ({ where }) =>
        [...floors.values()].find((row) => {
          if (where.id && row.id !== where.id) return false;
          if (where.companyId && row.companyId !== where.companyId) return false;
          if (where.outletId && row.outletId !== where.outletId) return false;
          if (where.isActive !== undefined && row.isActive !== where.isActive) return false;
          return true;
        }) ?? null,
      create: async ({ data }) => {
        const row = { id: `floor-${floors.size + 1}`, isActive: false, ...data };
        floors.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...floors.get(where.id), ...data };
        floors.set(where.id, row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of floors.values()) {
          if (row.companyId === where.companyId && row.outletId === where.outletId && row.id !== where.id?.not) {
            floors.set(row.id, { ...row, ...data });
            count++;
          }
        }
        return { count };
      },
    },
    posTable: {
      findMany: async ({ where }) =>
        [...tables.values()].filter((row) => {
          if (where.floorId && row.floorId !== where.floorId) return false;
          if (where.waiterId !== undefined && row.waiterId !== where.waiterId) return false;
          if (where.enabled !== undefined && row.enabled !== where.enabled) return false;
          return true;
        }),
      findFirst: async ({ where }) =>
        [...tables.values()].find((row) => {
          if (where.id && row.id !== where.id) return false;
          if (where.companyId && row.companyId !== where.companyId) return false;
          return true;
        }) ?? null,
      create: async ({ data }) => {
        const row = { id: `table-${tables.size + 1}`, status: "AVAILABLE", enabled: true, ...data };
        tables.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...tables.get(where.id), ...data };
        tables.set(where.id, row);
        return row;
      },
    },
    posFloorZone: { findMany: async () => [] },
    posFloorElement: { findMany: async () => [] },
    posKitchenStation: {
      findMany: async ({ where }) =>
        [...stations.values()].filter(
          (row) => row.companyId === where.companyId && (!where.outletId || row.outletId === where.outletId),
        ),
      findFirst: async ({ where }) =>
        [...stations.values()].find((row) => row.id === where.id && row.companyId === where.companyId) ?? null,
      count: async ({ where }) =>
        [...stations.values()].filter(
          (row) => !where?.companyId || row.companyId === where.companyId,
        ).length,
      create: async ({ data }) => {
        const row = { id: `station-${stations.size + 1}`, enabled: true, ...data };
        stations.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...stations.get(where.id), ...data };
        stations.set(where.id, row);
        return row;
      },
    },
    posOrder: {
      findFirst: async ({ where }) =>
        [...orders.values()].find((row) => row.id === where.id && row.companyId === where.companyId) ?? null,
      update: async ({ where, data }) => {
        const row = { ...orders.get(where.id), ...data };
        orders.set(where.id, row);
        return row;
      },
    },
    posOrderLine: {
      findMany: async ({ where }) =>
        [...lines.values()].filter((row) => row.orderId === where.orderId),
      update: async ({ where, data }) => {
        const row = { ...lines.get(where.id), ...data };
        lines.set(where.id, row);
        return row;
      },
    },
    posProductConfig: {
      findFirst: async ({ where }) =>
        [...configs.values()].find(
          (row) =>
            row.companyId === where.companyId &&
            row.productId === where.productId &&
            (where.variantId === undefined || row.variantId === where.variantId),
        ) ?? null,
    },
    posKitchenTicket: {
      findMany: async ({ where }) =>
        [...tickets.values()].filter(
          (row) =>
            row.companyId === where.companyId &&
            (!where.stationId || row.stationId === where.stationId) &&
            (!where.status || row.status === where.status),
        ),
      findFirst: async ({ where }) =>
        [...tickets.values()].find((row) => row.id === where.id && row.companyId === where.companyId) ??
        null,
      create: async ({ data }) => {
        const row = { id: `ticket-${tickets.size + 1}`, status: "PENDING", ...data };
        tickets.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...tickets.get(where.id), ...data };
        tickets.set(where.id, row);
        return row;
      },
    },
    posKitchenTicketLine: {
      createMany: async ({ data }) => {
        for (const item of data) {
          const row = { id: `ticket-line-${ticketLines.size + 1}`, status: "PENDING", ...item };
          ticketLines.set(row.id, row);
        }
        return { count: data.length };
      },
      findFirst: async ({ where }) =>
        [...ticketLines.values()].find((row) => row.id === where.id && row.ticketId === where.ticketId) ??
        null,
      update: async ({ where, data }) => {
        const row = { ...ticketLines.get(where.id), ...data };
        ticketLines.set(where.id, row);
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

  return prisma;
}

describe("createPosFloorService", () => {
  it("publishes one floor per outlet and updates table status", async () => {
    const prisma = makePrisma();
    const svc = createPosFloorService({ prisma });
    const first = await svc.createFloor({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", name: "Salon" },
    });
    const second = await svc.createFloor({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", name: "Terraza" },
    });

    await svc.publishFloor({ companyId: "company-1", id: first.id, actorId: "user-1" });
    await svc.publishFloor({ companyId: "company-1", id: second.id, actorId: "user-1" });

    assert.equal(prisma.floors.get(first.id).isActive, false);
    assert.equal(prisma.floors.get(second.id).isActive, true);

    const table = await svc.createTable({
      companyId: "company-1",
      actorId: "user-1",
      data: { floorId: second.id, name: "M1", capacity: 4 },
    });
    const updated = await svc.updateTableStatus({
      companyId: "company-1",
      tableId: table.id,
      actorId: "user-1",
      status: "OCCUPIED",
    });
    assert.equal(updated.status, "OCCUPIED");
  });

  it("rejects table creation outside company floor scope", async () => {
    const prisma = makePrisma();
    const svc = createPosFloorService({ prisma });
    const floor = await svc.createFloor({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", name: "Salon" },
    });

    await assert.rejects(
      () =>
        svc.createTable({
          companyId: "company-2",
          actorId: "user-1",
          data: { floorId: floor.id, name: "M1" },
        }),
      (err) => err instanceof PosServiceError && err.status === 404,
    );
  });

  it("updateTableWaiter sets waiterId and updateTableStatus AVAILABLE clears it", async () => {
    const prisma = makePrisma();
    const svc = createPosFloorService({ prisma });
    const floor = await svc.createFloor({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", name: "Salon" },
    });
    const table = await svc.createTable({
      companyId: "company-1",
      actorId: "user-1",
      data: { floorId: floor.id, name: "Mesa 1", capacity: 4 },
    });
    const assigned = await svc.updateTableWaiter({
      companyId: "company-1",
      actorId: "user-1",
      tableId: table.id,
      waiterId: "user-1",
    });
    assert.equal(assigned.waiterId, "user-1");
    const auditEntry = prisma.audits.find((a) => a.action === "pos.table.waiter.assign");
    assert.ok(auditEntry, "audit entry for table waiter.assign must exist");
    const cleared = await svc.updateTableStatus({
      companyId: "company-1",
      actorId: "user-1",
      tableId: table.id,
      status: "AVAILABLE",
    });
    assert.equal(cleared.waiterId, null);
  });

  it("updateTableWaiter rejects an unknown waiterId with 404", async () => {
    const prisma = makePrisma();
    const svc = createPosFloorService({ prisma });
    const floor = await svc.createFloor({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", name: "Salon" },
    });
    const table = await svc.createTable({
      companyId: "company-1",
      actorId: "user-1",
      data: { floorId: floor.id, name: "Mesa 1", capacity: 4 },
    });
    await assert.rejects(
      () =>
        svc.updateTableWaiter({
          companyId: "company-1",
          actorId: "user-1",
          tableId: table.id,
          waiterId: "nonexistent-user",
        }),
      (err) => err instanceof PosServiceError && err.status === 404,
    );
  });

  it("getActiveMap with myTablesOnly:true returns only tables where waiterId matches actorId", async () => {
    const prisma = makePrisma();
    const svc = createPosFloorService({ prisma });
    const floor = await svc.createFloor({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", name: "Salon" },
    });
    await svc.publishFloor({ companyId: "company-1", id: floor.id, actorId: "user-1" });
    const myTable = await svc.createTable({
      companyId: "company-1",
      actorId: "user-1",
      data: { floorId: floor.id, name: "Mesa A", capacity: 2 },
    });
    await svc.createTable({
      companyId: "company-1",
      actorId: "user-1",
      data: { floorId: floor.id, name: "Mesa B", capacity: 2 },
    });
    await svc.updateTableWaiter({
      companyId: "company-1",
      actorId: "user-1",
      tableId: myTable.id,
      waiterId: "user-1",
    });
    const map = await svc.getActiveMap({
      companyId: "company-1",
      outletId: "outlet-1",
      myTablesOnly: true,
      actorId: "user-1",
    });
    assert.ok(map, "active map must exist");
    assert.strictEqual(map.tables.length, 1);
    assert.strictEqual(map.tables[0].id, myTable.id);
    assert.equal(map.tables[0].waiterName, "Mesero Principal");
  });
});

describe("createPosKitchenService", () => {
  it("creates one kitchen ticket per station and skips non-prep lines", async () => {
    const prisma = makePrisma();
    const svc = createPosKitchenService({ prisma });
    const tacos = await svc.createStation({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", name: "Tacos", code: "TACOS" },
    });
    const bar = await svc.createStation({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", name: "Bar", code: "BAR" },
    });
    prisma.orders.set("order-1", { id: "order-1", companyId: "company-1" });
    prisma.lines.set("line-1", { id: "line-1", orderId: "order-1", productId: "p1", variantId: null, quantity: 2 });
    prisma.lines.set("line-2", { id: "line-2", orderId: "order-1", productId: "p2", variantId: null, quantity: 1 });
    prisma.lines.set("line-3", { id: "line-3", orderId: "order-1", productId: "p3", variantId: null, quantity: 1 });
    prisma.configs.set("p1", { companyId: "company-1", productId: "p1", variantId: null, requiresPreparation: true, stationId: tacos.id });
    prisma.configs.set("p2", { companyId: "company-1", productId: "p2", variantId: null, requiresPreparation: true, stationId: bar.id });
    prisma.configs.set("p3", { companyId: "company-1", productId: "p3", variantId: null, requiresPreparation: false, stationId: null });

    const result = await svc.sendOrderToKitchen({
      companyId: "company-1",
      orderId: "order-1",
      actorId: "user-1",
    });

    assert.equal(result.tickets.length, 2);
    assert.equal(prisma.ticketLines.size, 2);
  });

  it("rejects prep lines without a station", async () => {
    const prisma = makePrisma();
    const svc = createPosKitchenService({ prisma });
    // A station must exist so the router enters the routing path; stationCount === 0 short-circuits to SENT.
    prisma.stations.set("station-1", { id: "station-1", companyId: "company-1", outletId: "outlet-1", enabled: true });
    prisma.orders.set("order-1", { id: "order-1", companyId: "company-1" });
    prisma.lines.set("line-1", { id: "line-1", orderId: "order-1", productId: "p1", variantId: null, quantity: 1 });
    prisma.configs.set("p1", { companyId: "company-1", productId: "p1", variantId: null, requiresPreparation: true, stationId: null });

    await assert.rejects(
      () => svc.sendOrderToKitchen({ companyId: "company-1", orderId: "order-1", actorId: "user-1" }),
      (err) => err instanceof PosServiceError && err.status === 400,
    );
  });

  it("updates ticket line status and linked order line status", async () => {
    const prisma = makePrisma();
    const svc = createPosKitchenService({ prisma });
    prisma.tickets.set("ticket-1", { id: "ticket-1", companyId: "company-1", stationId: "station-1", status: "PENDING" });
    prisma.lines.set("line-1", { id: "line-1", orderId: "order-1", productId: "p1", kitchenStatus: "PENDING" });
    prisma.ticketLines.set("ticket-line-1", {
      id: "ticket-line-1",
      ticketId: "ticket-1",
      orderLineId: "line-1",
      quantity: 1,
      status: "PENDING",
    });

    await svc.updateTicketLineStatus({
      companyId: "company-1",
      ticketId: "ticket-1",
      lineId: "ticket-line-1",
      actorId: "user-1",
      status: "READY",
    });

    assert.equal(prisma.ticketLines.get("ticket-line-1").status, "READY");
    assert.equal(prisma.lines.get("line-1").kitchenStatus, "READY");
  });
});

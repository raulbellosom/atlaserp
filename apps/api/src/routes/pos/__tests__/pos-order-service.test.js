import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPosOrderService } from "../pos-order-service.js";
import { PosServiceError } from "../service-helpers.js";

function makePrisma() {
  const orders = new Map();
  const lines = new Map();
  const guests = new Map();
  const payments = new Map();
  const receipts = new Map();
  const audits = [];
  const tables = new Map([
    ["table-1", { id: "table-1", companyId: "company-1", status: "AVAILABLE", waiterId: null }],
  ]);
  const products = new Map([
    [
      "product-1",
      {
        id: "product-1",
        companyId: "company-1",
        name: "Taco al Pastor",
        sku: "TACO-PASTOR",
        price: 50,
      },
    ],
  ]);
  const variants = new Map([
    [
      "variant-1",
      {
        id: "variant-1",
        companyId: "company-1",
        productId: "product-1",
        sku: "TACO-PASTOR-DOBLE",
        price: 75,
        product: products.get("product-1"),
      },
    ],
  ]);
  const paymentMethods = new Map([
    ["cash-1", { id: "cash-1", companyId: "company-1", kind: "CASH", enabled: true }],
  ]);

  const profiles = new Map([
    ["user-1", { id: "user-1", displayName: "Mesero Principal" }],
  ]);

  const prisma = {
    orders,
    lines,
    guests,
    payments,
    receipts,
    audits,
    tables,
    profiles,
    $transaction: async (fn) => fn(prisma),
    userProfile: {
      findUnique: async ({ where }) => profiles.get(where.id) ?? null,
    },
    posSettings: {
      findUnique: async ({ where }) =>
        where.companyId === "company-1" ? { companyId: "company-1", defaultTaxRate: 16 } : null,
    },
    posOrder: {
      findMany: async ({ where = {} } = {}) =>
        [...orders.values()].filter((row) => !where.companyId || row.companyId === where.companyId),
      findFirst: async ({ where = {}, orderBy } = {}) => {
        let rows = [...orders.values()].filter((row) => {
          if (where.id && row.id !== where.id) return false;
          if (where.companyId && row.companyId !== where.companyId) return false;
          if (where.externalProvider && row.externalProvider !== where.externalProvider) return false;
          if (where.externalOrderId && row.externalOrderId !== where.externalOrderId) return false;
          return true;
        });
        if (orderBy?.orderNumber === "desc") {
          rows = rows.sort((a, b) => b.orderNumber - a.orderNumber);
        }
        return rows[0] ?? null;
      },
      create: async ({ data }) => {
        const row = {
          id: `order-${orders.size + 1}`,
          status: "OPEN",
          subtotalAmount: 0,
          discountAmount: 0,
          taxAmount: 0,
          tipAmount: 0,
          serviceChargeAmount: 0,
          totalAmount: 0,
          paidAmount: 0,
          ...data,
        };
        orders.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...orders.get(where.id), ...data };
        orders.set(where.id, row);
        return row;
      },
    },
    posGuestSeat: {
      createMany: async ({ data }) => {
        for (const item of data) {
          const row = { id: `guest-${guests.size + 1}`, ...item };
          guests.set(row.id, row);
        }
        return { count: data.length };
      },
      create: async ({ data }) => {
        const row = { id: `guest-${guests.size + 1}`, ...data };
        guests.set(row.id, row);
        return row;
      },
      findMany: async ({ where }) =>
        [...guests.values()].filter((row) => row.orderId === where.orderId),
    },
    posOrderLine: {
      findMany: async ({ where }) =>
        [...lines.values()].filter((row) => row.orderId === where.orderId),
      findFirst: async ({ where }) =>
        [...lines.values()].find((row) => row.id === where.id && row.orderId === where.orderId) ??
        null,
      create: async ({ data }) => {
        const row = { id: `line-${lines.size + 1}`, ...data };
        lines.set(row.id, row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = { ...lines.get(where.id), ...data };
        lines.set(where.id, row);
        return row;
      },
      delete: async ({ where }) => {
        const row = lines.get(where.id);
        lines.delete(where.id);
        return row;
      },
    },
    catalogProduct: {
      findFirst: async ({ where }) =>
        [...products.values()].find((row) => row.id === where.id && row.companyId === where.companyId) ??
        null,
    },
    catalogProductVariant: {
      findFirst: async ({ where }) =>
        [...variants.values()].find((row) => row.id === where.id && row.companyId === where.companyId) ??
        null,
    },
    posPaymentMethod: {
      findFirst: async ({ where }) =>
        [...paymentMethods.values()].find(
          (row) => row.id === where.id && row.companyId === where.companyId && row.enabled === true,
        ) ?? null,
    },
    posPayment: {
      create: async ({ data }) => {
        const row = { id: `payment-${payments.size + 1}`, status: "CAPTURED", ...data };
        payments.set(row.id, row);
        return row;
      },
      findMany: async ({ where }) =>
        [...payments.values()].filter((row) => row.orderId === where.orderId),
    },
    posReceipt: {
      create: async ({ data }) => {
        const row = { id: `receipt-${receipts.size + 1}`, ...data };
        receipts.set(row.id, row);
        return row;
      },
    },
    posTable: {
      findFirst: async ({ where }) =>
        [...tables.values()].find((row) => row.id === where.id) ?? null,
      update: async ({ where, data }) => {
        const row = { ...tables.get(where.id), ...data };
        tables.set(where.id, row);
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

describe("createPosOrderService", () => {
  it("creates dine-in guest seats and rejects duplicate external orders", async () => {
    const svc = createPosOrderService({ prisma: makePrisma() });
    const order = await svc.createOrder({
      companyId: "company-1",
      actorId: "user-1",
      data: {
        outletId: "outlet-1",
        guestCount: 3,
        externalProvider: "UBER_EATS",
        externalOrderId: "ext-1",
      },
    });

    assert.equal(order.status, "OPEN");
    assert.equal(order.guests.length, 3);
    await assert.rejects(
      () =>
        svc.createOrder({
          companyId: "company-1",
          actorId: "user-1",
          data: { outletId: "outlet-1", externalProvider: "UBER_EATS", externalOrderId: "ext-1" },
        }),
      (err) => err instanceof PosServiceError && err.status === 409,
    );
  });

  it("snapshots catalog product data and recalculates totals after line changes", async () => {
    const prisma = makePrisma();
    const svc = createPosOrderService({ prisma });
    const order = await svc.createOrder({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1" },
    });

    const line = await svc.addOrderLine({
      companyId: "company-1",
      orderId: order.id,
      actorId: "user-1",
      data: { productId: "product-1", variantId: "variant-1", quantity: 2 },
    });
    assert.equal(line.productName, "Taco al Pastor");
    assert.equal(line.sku, "TACO-PASTOR-DOBLE");
    assert.equal(line.unitPrice, 75);
    assert.equal(line.taxRate, 16);

    let updated = await svc.getOrderById({ companyId: "company-1", id: order.id });
    assert.equal(updated.subtotalAmount, 150);
    assert.equal(updated.taxAmount, 24);
    assert.equal(updated.totalAmount, 174);

    await svc.updateOrderLine({
      companyId: "company-1",
      orderId: order.id,
      lineId: line.id,
      actorId: "user-1",
      data: { quantity: 1 },
    });
    updated = await svc.getOrderById({ companyId: "company-1", id: order.id });
    assert.equal(updated.totalAmount, 87);

    await svc.deleteOrderLine({
      companyId: "company-1",
      orderId: order.id,
      lineId: line.id,
      actorId: "user-1",
    });
    updated = await svc.getOrderById({ companyId: "company-1", id: order.id });
    assert.equal(updated.totalAmount, 0);
  });

  it("rejects edits for paid orders", async () => {
    const prisma = makePrisma();
    const svc = createPosOrderService({ prisma });
    const order = await svc.createOrder({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1" },
    });
    await prisma.posOrder.update({ where: { id: order.id }, data: { status: "PAID" } });

    await assert.rejects(
      () =>
        svc.addOrderLine({
          companyId: "company-1",
          orderId: order.id,
          actorId: "user-1",
          data: { productId: "product-1", quantity: 1 },
        }),
      /no se puede editar/i,
    );
  });

  it("captures payments, marks paid orders and rejects overpayment", async () => {
    const prisma = makePrisma();
    const svc = createPosOrderService({ prisma });
    const order = await svc.createOrder({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1" },
    });
    await svc.addOrderLine({
      companyId: "company-1",
      orderId: order.id,
      actorId: "user-1",
      data: { productId: "product-1", quantity: 1 },
    });

    await assert.rejects(
      () =>
        svc.addPayment({
          companyId: "company-1",
          orderId: order.id,
          actorId: "user-1",
          data: { paymentMethodId: "cash-1", amount: 100 },
        }),
      (err) => err instanceof PosServiceError && err.status === 400,
    );

    const payment = await svc.addPayment({
      companyId: "company-1",
      orderId: order.id,
      actorId: "user-1",
      data: { paymentMethodId: "cash-1", amount: 58 },
    });
    const paid = await svc.getOrderById({ companyId: "company-1", id: order.id });

    assert.equal(payment.status, "CAPTURED");
    assert.equal(paid.paidAmount, 58);
    assert.equal(paid.status, "PAID");
  });

  it("auto-assigns waiterId to the creating actor on order create", async () => {
    const svc = createPosOrderService({ prisma: makePrisma() });
    const order = await svc.createOrder({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", fulfillmentType: "DINE_IN", guestCount: 2 },
    });
    assert.equal(order.waiterId, "user-1");
    assert.equal(order.waiterName, "Mesero Principal");
  });

  it("assignOrderWaiter reassigns waiter and writes an audit entry", async () => {
    const db = makePrisma();
    db.profiles.set("user-2", { id: "user-2", displayName: "Otro Mesero" });
    db.userProfile = {
      findUnique: async ({ where }) => db.profiles.get(where.id) ?? null,
    };
    const svc = createPosOrderService({ prisma: db });
    const created = await svc.createOrder({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", fulfillmentType: "DINE_IN", guestCount: 1 },
    });
    const updated = await svc.assignOrderWaiter({
      companyId: "company-1",
      actorId: "user-1",
      id: created.id,
      waiterId: "user-2",
    });
    assert.equal(updated.waiterId, "user-2");
    assert.equal(updated.waiterName, "Otro Mesero");
    const auditEntry = db.audits.find((a) => a.action === "pos.order.waiter.assign");
    assert.ok(auditEntry, "audit entry for waiter.assign must exist");
  });

  it("getSeatTotals groups lines by seat and puts unassigned lines last", async () => {
    const db = makePrisma();
    const svc = createPosOrderService({ prisma: db });
    const order = await svc.createOrder({
      companyId: "company-1",
      actorId: "user-1",
      data: { outletId: "outlet-1", fulfillmentType: "DINE_IN", guestCount: 2 },
    });
    const seat = order.guests[0];
    // Add a line assigned to the first seat
    await svc.addOrderLine({
      companyId: "company-1",
      actorId: "user-1",
      orderId: order.id,
      data: {
        productId: "product-1",
        quantity: 1,
        guestSeatId: seat.id,
      },
    });
    // Add an unassigned line (no guestSeatId)
    await svc.addOrderLine({
      companyId: "company-1",
      actorId: "user-1",
      orderId: order.id,
      data: {
        productId: "product-1",
        quantity: 1,
      },
    });
    const totals = await svc.getSeatTotals({ companyId: "company-1", id: order.id });
    assert.strictEqual(totals.seats.length, 2);
    const unassigned = totals.seats.find((s) => s.id === null);
    assert.ok(unassigned, "unassigned bucket must exist");
    assert.strictEqual(unassigned.linesCount, 1);
    const assigned = totals.seats.find((s) => s.id === seat.id);
    assert.ok(assigned, "assigned seat bucket must exist");
    assert.strictEqual(assigned.linesCount, 1);
    // Unassigned bucket must come LAST
    const unassignedIdx = totals.seats.indexOf(unassigned);
    const assignedIdx = totals.seats.indexOf(assigned);
    assert.ok(unassignedIdx > assignedIdx, "Sin asignar bucket must be last");
  });

  it("creating a dine-in order on a table sets that table's waiterId to the actor", async () => {
    const db = makePrisma();
    const svc = createPosOrderService({ prisma: db });
    await svc.createOrder({
      companyId: "company-1",
      actorId: "user-1",
      data: {
        outletId: "outlet-1",
        fulfillmentType: "DINE_IN",
        guestCount: 2,
        tableId: "table-1",
      },
    });
    const table = db.tables.get("table-1");
    assert.equal(table.status, "OCCUPIED");
    assert.equal(table.waiterId, "user-1");
  });
});

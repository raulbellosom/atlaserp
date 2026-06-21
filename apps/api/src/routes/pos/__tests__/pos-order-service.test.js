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

  const prisma = {
    orders,
    lines,
    guests,
    payments,
    receipts,
    audits,
    $transaction: async (fn) => fn(prisma),
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
});

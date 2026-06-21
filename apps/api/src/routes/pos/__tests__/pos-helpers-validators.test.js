import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PosServiceError,
  assertEditableOrder,
  requireCompanyId,
  toMoney,
  writeAudit,
} from "../service-helpers.js";
import {
  addOrderLineSchema,
  createOrderSchema,
  openSessionSchema,
  updateSettingsSchema,
} from "../validators.js";

describe("POS service helpers", () => {
  it("requires a company id", () => {
    assert.equal(requireCompanyId("company-1"), "company-1");
    assert.throws(() => requireCompanyId(null), PosServiceError);
  });

  it("normalizes money to two decimals", () => {
    assert.equal(toMoney("12.345"), 12.35);
    assert.equal(toMoney("bad"), 0);
  });

  it("rejects immutable orders", () => {
    assert.doesNotThrow(() => assertEditableOrder({ status: "OPEN" }));
    assert.throws(() => assertEditableOrder({ status: "PAID" }), /no se puede editar/i);
  });

  it("writes audit entries as native JSON payloads", async () => {
    let entry = null;
    const prisma = {
      auditLog: {
        create: async ({ data }) => {
          entry = data;
          return data;
        },
      },
    };

    await writeAudit(prisma, {
      actorId: "user-1",
      entityType: "PosOrder",
      entityId: "00000000-0000-7000-8000-000000000001",
      action: "pos.order.create",
      before: { status: "DRAFT" },
      after: { status: "OPEN" },
      metadata: { source: "test" },
    });

    assert.equal(entry.moduleKey, "atlas.pos");
    assert.deepEqual(entry.before, { status: "DRAFT" });
    assert.deepEqual(entry.after, { status: "OPEN" });
    assert.deepEqual(entry.metadata, { source: "test" });
  });
});

describe("POS validators", () => {
  it("applies defaults for sessions and dine-in orders", () => {
    const session = openSessionSchema.parse({
      outletId: "00000000-0000-7000-8000-000000000001",
      terminalId: "00000000-0000-7000-8000-000000000002",
    });
    assert.equal(session.openingCashAmount, 0);

    const order = createOrderSchema.parse({
      outletId: "00000000-0000-7000-8000-000000000001",
    });
    assert.equal(order.fulfillmentType, "DINE_IN");
    assert.equal(order.salesChannel, "IN_STORE");
    assert.equal(order.guestCount, 1);
  });

  it("validates settings and positive order line quantities", () => {
    assert.equal(updateSettingsSchema.safeParse({ currency: "MXN" }).success, true);
    assert.equal(updateSettingsSchema.safeParse({ currency: "MX" }).success, false);
    assert.equal(addOrderLineSchema.safeParse({ quantity: 0 }).success, false);
    assert.equal(addOrderLineSchema.safeParse({ quantity: 2 }).success, true);
  });
});

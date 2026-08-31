import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInvestmentsService } from "../investments-service.js";

const W = "01900000-0000-7000-8000-0000000000f1";
const CO = "01900000-0000-7000-8000-0000000000f2";
const OW = "01900000-0000-7000-8000-0000000000f3";

function isoDay(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// Prisma stub: one INVESTMENT wallet, controllable movement history.
function makeprisma({ wallet, movements = [] }) {
  const inserted = [];
  const updated = [];
  const tx = {
    pfmMovement: {
      create: async ({ data }) => (inserted.push(data), { id: "m", ...data }),
    },
    pfmWallet: {
      update: async (args) => (updated.push(args), { id: W }),
    },
  };
  const prisma = {
    pfmWallet: {
      findMany: async () => (wallet ? [wallet] : []),
    },
    pfmMovement: {
      findMany: async () => movements,
    },
    $transaction: async (fn) => fn(tx),
  };
  return { prisma, inserted, updated };
}

describe("investments-service.accrueYieldDue", () => {
  it("books one compounding INCOME movement per un-accrued day and advances the cursor", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const { prisma, inserted, updated } = makeprisma({
      wallet: {
        id: W,
        companyId: CO,
        ownerId: OW,
        openingBalance: "1000.00",
        expectedRate: "0.3650", // daily 0.001
        lastAccruedOn: new Date("2026-08-06T00:00:00.000Z"),
      },
      movements: [],
    });
    const res = await createInvestmentsService({ prisma }).accrueYieldDue({ now });
    assert.equal(res.processed, 1);
    assert.equal(res.created, 3);
    assert.deepEqual(inserted.map((m) => isoDay(m.occurredOn)), ["2026-08-07", "2026-08-08", "2026-08-09"]);
    assert.equal(Number(inserted[0].amount), 1);
    assert.ok(Number(inserted[1].amount) >= 1);
    assert.equal(inserted[0].direction, "INCOME");
    assert.equal(inserted[0].isYield, true);
    assert.equal(inserted[0].status, "POSTED");
    assert.equal(inserted[0].walletId, W);
    assert.equal(isoDay(updated[0].data.lastAccruedOn), "2026-08-09");
  });

  it("does nothing when the cursor is already yesterday-or-later", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const { prisma, inserted } = makeprisma({
      wallet: {
        id: W,
        companyId: CO,
        ownerId: OW,
        openingBalance: "1000.00",
        expectedRate: "0.1000",
        lastAccruedOn: new Date("2026-08-09T00:00:00.000Z"),
      },
    });
    const res = await createInvestmentsService({ prisma }).accrueYieldDue({ now });
    assert.equal(res.created, 0);
    assert.equal(inserted.length, 0);
  });

  it("caps the backfill window", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const { prisma, inserted } = makeprisma({
      wallet: {
        id: W,
        companyId: CO,
        ownerId: OW,
        openingBalance: "1000.00",
        expectedRate: "0.3650",
        lastAccruedOn: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    await createInvestmentsService({ prisma }).accrueYieldDue({ now, maxBackfillDays: 5 });
    assert.equal(inserted.length, 5);
    assert.equal(isoDay(inserted[0].occurredOn), "2026-08-05");
    assert.equal(isoDay(inserted[4].occurredOn), "2026-08-09");
  });
});

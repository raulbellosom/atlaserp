// apps/api/src/routes/pfm/__tests__/movements-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMovementsService } from "../movements-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-0000000000c1";
const ACTOR = "01900000-0000-7000-8000-0000000000c2";
const WALLET = "01900000-0000-7000-8000-0000000000c3";
const MOV = "01900000-0000-7000-8000-0000000000c4";

function walletsStub({ canWrite = true, canRead = true } = {}) {
  return {
    canWriteWallet: async () => canWrite,
    canReadWallet: async () => canRead,
    getWallet: async () => ({ id: WALLET, ledgerAccountId: null }),
  };
}

describe("movements-service", () => {
  it("createMovement stamps company/owner/wallet and defaults status POSTED", async () => {
    let created = null;
    const prisma = {
      pfmMovement: { create: async ({ data }) => ((created = data), { id: MOV, ...data }) },
    };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    await service.createMovement({
      companyId: COMPANY,
      actorId: ACTOR,
      walletId: WALLET,
      data: { direction: "EXPENSE", amount: 120.5, occurredOn: "2026-08-15", status: "POSTED" },
    });
    assert.equal(created.companyId, COMPANY);
    assert.equal(created.ownerId, ACTOR);
    assert.equal(created.walletId, WALLET);
    assert.equal(created.status, "POSTED");
    assert.equal(Number(created.amount), 120.5);
  });

  it("createMovement is refused (403) when the actor cannot write the wallet", async () => {
    const prisma = {
      pfmMovement: {
        create: async () => {
          throw new Error("should not reach");
        },
      },
    };
    const service = createMovementsService({ prisma, wallets: walletsStub({ canWrite: false }) });
    await assert.rejects(
      () =>
        service.createMovement({
          companyId: COMPANY,
          actorId: ACTOR,
          walletId: WALLET,
          data: { direction: "EXPENSE", amount: 1, occurredOn: "2026-08-15" },
        }),
      (e) => e instanceof PfmServiceError && e.status === 403,
    );
  });

  it("confirmMovement flips PENDING -> POSTED and applies an override amount", async () => {
    let updateArgs = null;
    const prisma = {
      pfmMovement: {
        findFirst: async () => ({ id: MOV, walletId: WALLET, status: "PENDING", amount: 800 }),
        update: async (args) => ((updateArgs = args), { id: MOV, status: "POSTED", amount: 915 }),
      },
    };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    const res = await service.confirmMovement({
      companyId: COMPANY,
      actorId: ACTOR,
      movementId: MOV,
      amount: 915,
    });
    assert.equal(updateArgs.data.status, "POSTED");
    assert.equal(Number(updateArgs.data.amount), 915);
    assert.equal(res.status, "POSTED");
  });

  it("confirmMovement refuses a non-PENDING movement", async () => {
    const prisma = {
      pfmMovement: {
        findFirst: async () => ({ id: MOV, walletId: WALLET, status: "POSTED", amount: 10 }),
      },
    };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    await assert.rejects(
      () => service.confirmMovement({ companyId: COMPANY, actorId: ACTOR, movementId: MOV }),
      (e) => e instanceof PfmServiceError && e.status === 409,
    );
  });

  it("listMovements SQL counts only POSTED enabled rows toward runningBalance", async () => {
    let seen = "";
    const prisma = {
      $queryRaw: async (s) => (
        (seen = (Array.isArray(s) ? s.join(" ") : String(s)).toLowerCase()), []
      ),
    };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    await service.listMovements({
      companyId: COMPANY,
      actorId: ACTOR,
      walletId: WALLET,
      query: { limit: 100 },
    });
    assert.ok(seen.includes("status = 'posted'"), "running balance must filter to POSTED");
    assert.ok(seen.includes("enabled = true"));
  });

  it("listMovements exposes isAdjustment on each row", async () => {
    const prisma = {
      $queryRaw: async () => [
        {
          id: MOV,
          wallet_id: WALLET,
          direction: "INCOME",
          amount: "300.00",
          occurred_on: "2026-08-20",
          status: "POSTED",
          is_adjustment: true,
        },
      ],
    };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    const { data } = await service.listMovements({
      companyId: COMPANY,
      actorId: ACTOR,
      walletId: WALLET,
      query: {},
    });
    assert.equal(data[0].isAdjustment, true);
  });
});

// apps/api/src/routes/pfm/__tests__/wallets-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toLocalIso } from "@atlas/core";
import { createWalletsService } from "../wallets-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-0000000000a1";
const OWNER = "01900000-0000-7000-8000-0000000000a2";
const OTHER = "01900000-0000-7000-8000-0000000000a3";
const WALLET = "01900000-0000-7000-8000-0000000000a4";

function sql(strings) {
  return (Array.isArray(strings) ? strings.join(" ") : String(strings)).toLowerCase();
}

describe("wallets-service — access is never implicitly shared", () => {
  it("listWallets SQL filters by owner OR membership, never a NULL-owner fallback", async () => {
    let seen = "";
    const prisma = {
      $queryRaw: async (strings) => {
        seen = sql(strings);
        return [];
      },
    };
    const service = createWalletsService({ prisma });
    await service.listWallets({ companyId: COMPANY, actorId: OTHER });
    assert.ok(seen.includes("owner_id ="), "must scope by owner_id");
    assert.ok(seen.includes("pfm_wallet_member"), "must allow membership access");
    assert.ok(!seen.includes("owner_id is null"), "must NOT treat NULL owner as public");
  });

  it("getWallet throws 404 (not a leak) when the actor has no access", async () => {
    const prisma = { $queryRaw: async () => [] };
    const service = createWalletsService({ prisma });
    await assert.rejects(
      () => service.getWallet({ companyId: COMPANY, walletId: WALLET, actorId: OTHER }),
      (err) => err instanceof PfmServiceError && err.status === 404,
    );
  });

  it("getWallet rejects a missing actorId with 401 before querying", async () => {
    const prisma = {
      $queryRaw: async () => {
        throw new Error("must not query without an actor");
      },
    };
    const service = createWalletsService({ prisma });
    await assert.rejects(
      () => service.getWallet({ companyId: COMPANY, walletId: WALLET, actorId: null }),
      (err) => err instanceof PfmServiceError && err.status === 401,
    );
  });
});

describe("wallets-service — createWallet credit fields", () => {
  it("CREDIT wallet stores credit fields and negative opening balance from openingUsed", async () => {
    let createArgs = null;
    const prisma = {
      pfmWallet: {
        create: async (args) => {
          createArgs = args;
          return { id: "01900000-0000-7000-8000-00000000c0de", ...args.data };
        },
      },
    };
    const service = createWalletsService({ prisma });
    await service.createWallet({
      companyId: COMPANY,
      ownerId: OWNER,
      data: {
        name: "Amex",
        kind: "CREDIT",
        currency: "MXN",
        openingBalance: 0,
        creditLimit: 50000,
        statementDay: 4,
        paymentDueDay: 22,
        openingUsed: 12000,
      },
    });
    assert.equal(Number(createArgs.data.openingBalance), -12000);
    assert.equal(Number(createArgs.data.creditLimit), 50000);
    assert.equal(createArgs.data.statementDay, 4);
    assert.equal(createArgs.data.paymentDueDay, 22);
  });
});

describe("wallets-service — createWallet INVESTMENT", () => {
  it("persists expectedRate and sets lastAccruedOn to today", async () => {
    let createArgs = null;
    const prisma = {
      pfmWallet: {
        create: async (args) => ((createArgs = args), { id: "01900000-0000-7000-8000-00000000d0de", ...args.data }),
      },
    };
    const service = createWalletsService({ prisma });
    await service.createWallet({
      companyId: COMPANY,
      ownerId: OWNER,
      data: { name: "Cetes", kind: "INVESTMENT", currency: "MXN", openingBalance: 10000, expectedRate: 0.11 },
    });
    assert.equal(Number(createArgs.data.openingBalance), 10000);
    assert.equal(Number(createArgs.data.expectedRate), 0.11);
    const today = toLocalIso();
    const stored =
      createArgs.data.lastAccruedOn instanceof Date
        ? toLocalIso(createArgs.data.lastAccruedOn)
        : String(createArgs.data.lastAccruedOn).slice(0, 10);
    assert.equal(stored, today);
  });
});

// apps/api/src/routes/pfm/__tests__/wallets-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

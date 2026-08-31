// apps/api/src/routes/pfm/__tests__/isolation.test.js
//
// User B must never see User A's wallets, movements, or summary — regardless of
// RBAC permission (permission = "may use the module"; membership = "may see THIS
// wallet"). These tests assert the SQL access predicate on every list path and
// that services throw 404 (not a leak) when the row is filtered out.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWalletsService } from "../wallets-service.js";
import { createMovementsService } from "../movements-service.js";
import { createSummaryService } from "../summary-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-0000000000f1";
const USER_B = "01900000-0000-7000-8000-0000000000f2";
const WALLET_A = "01900000-0000-7000-8000-0000000000f3";

function sqlOf(strings) {
  return (Array.isArray(strings) ? strings.join(" ") : String(strings)).toLowerCase();
}

describe("pfm isolation — every list path is owner/member scoped", () => {
  it("wallets.listWallets scopes by owner_id or pfm_wallet_member and never NULL-owner", async () => {
    let sql = "";
    const prisma = { $queryRaw: async (s) => ((sql = sqlOf(s)), []) };
    await createWalletsService({ prisma }).listWallets({ companyId: COMPANY, actorId: USER_B });
    assert.ok(sql.includes("w.owner_id =") && sql.includes("pfm_wallet_member"));
    assert.ok(!sql.includes("owner_id is null"));
  });

  it("movements.listMovements refuses when canReadWallet is false", async () => {
    const wallets = { canReadWallet: async () => false, canWriteWallet: async () => false };
    const prisma = {
      $queryRaw: async () => {
        throw new Error("must not query");
      },
    };
    await assert.rejects(
      () =>
        createMovementsService({ prisma, wallets }).listMovements({
          companyId: COMPANY,
          actorId: USER_B,
          walletId: WALLET_A,
          query: {},
        }),
      (e) => e instanceof PfmServiceError && e.status === 404,
    );
  });

  it("summary.getOverview scopes every aggregate by owner_id or membership", async () => {
    const seen = [];
    const prisma = { $queryRaw: async (s) => (seen.push(sqlOf(s)), []) };
    await createSummaryService({ prisma }).getOverview({
      companyId: COMPANY,
      actorId: USER_B,
      month: "2026-08",
    });
    assert.ok(seen.length >= 3, "expected several aggregate queries");
    for (const sql of seen) {
      assert.ok(
        sql.includes("w.owner_id =") || sql.includes("wm.user_id ="),
        `aggregate not scoped to the actor: ${sql.slice(0, 80)}`,
      );
    }
  });
});

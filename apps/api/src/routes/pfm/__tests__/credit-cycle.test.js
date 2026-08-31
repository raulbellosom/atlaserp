// apps/api/src/routes/pfm/__tests__/credit-cycle.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCreditCycle } from "../wallets-service.js";

describe("computeCreditCycle", () => {
  it("returns null for a non-credit wallet or one without a statement day", () => {
    assert.equal(computeCreditCycle({ kind: "CASH" }, []), null);
    assert.equal(computeCreditCycle({ kind: "CREDIT", statementDay: null }, []), null);
  });

  it("splits movements into current-period vs total owed and computes available credit", () => {
    const wallet = { kind: "CREDIT", statementDay: 5, paymentDueDay: 25, creditLimit: 20000 };
    const now = new Date("2026-08-20T00:00:00.000Z"); // last cut = 2026-08-05
    const movements = [
      { direction: "EXPENSE", amount: 1000, occurredOn: "2026-08-10", status: "POSTED" }, // in period
      { direction: "EXPENSE", amount: 500, occurredOn: "2026-08-02", status: "POSTED" }, // before cut
      { direction: "INCOME", amount: 300, occurredOn: "2026-08-12", status: "POSTED" }, // payment in period
    ];
    const c = computeCreditCycle(wallet, movements, now);
    assert.equal(c.periodSpend, 700); // 1000 - 300
    assert.equal(c.totalOwed, 1200); // 1000 + 500 - 300
    assert.equal(c.availableCredit, 20000 - 1200);
    assert.equal(c.statementDay, 5);
    assert.equal(c.paymentDueDay, 25);
    assert.equal(c.lastStatementDate, "2026-08-05");
  });

  it("reports utilization = totalOwed / creditLimit", () => {
    const wallet = { kind: "CREDIT", statementDay: 4, creditLimit: 10000 };
    const movements = [
      { direction: "EXPENSE", amount: 2500, occurredOn: "2026-08-01", status: "POSTED" },
    ];
    const c = computeCreditCycle(wallet, movements, new Date("2026-08-20T00:00:00.000Z"));
    assert.equal(c.utilization, 0.25);
  });

  it("utilization is null without a credit limit", () => {
    const wallet = { kind: "CREDIT", statementDay: 4, creditLimit: null };
    const c = computeCreditCycle(wallet, [], new Date("2026-08-20T00:00:00.000Z"));
    assert.equal(c.utilization, null);
  });
});

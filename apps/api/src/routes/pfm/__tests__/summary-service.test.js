// apps/api/src/routes/pfm/__tests__/summary-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSummaryService } from "../summary-service.js";

const COMPANY = "01900000-0000-7000-8000-0000000000e1";
const ACTOR = "01900000-0000-7000-8000-0000000000e2";

describe("summary-service", () => {
  it("getOverview returns totals, category breakdown, trend and prev-month delta", async () => {
    // getOverview issues 4 queries in this order: balance, totals, byCategory, trend.
    const responses = [
      [{ total_balance: "22000.00", spendable: "18000.00", credit_debt: "4000.00", investments: "9000.00" }],
      [{ month_expense: "3000.00", month_income: "15000.00", prev_expense: "2500.00" }],
      [{ category_id: "c1", name: "Comida", color: "#f97316", total: "1200.00" }],
      [{ month: "2026-08", expense: "3000.00", income: "15000.00" }],
    ];
    let call = 0;
    const prisma = { $queryRaw: async () => responses[call++] ?? [] };

    const service = createSummaryService({ prisma });
    const res = await service.getOverview({ companyId: COMPANY, actorId: ACTOR, month: "2026-08" });

    assert.equal(res.totalBalance, 22000);
    assert.equal(res.spendable, 18000);
    assert.equal(res.creditDebt, 4000);
    assert.equal(res.investments, 9000);
    assert.equal(res.monthExpense, 3000);
    assert.equal(res.monthIncome, 15000);
    assert.equal(res.prevMonthExpense, 2500);
    assert.deepEqual(res.byCategory[0], {
      categoryId: "c1",
      name: "Comida",
      color: "#f97316",
      total: 1200,
    });
    assert.equal(res.trend[0].month, "2026-08");
    assert.equal(res.trend[0].expense, 3000);
  });

  it("every aggregate query is scoped to the actor (owner or membership)", async () => {
    const seen = [];
    const prisma = {
      $queryRaw: async (s) => (
        seen.push((Array.isArray(s) ? s.join(" ") : String(s)).toLowerCase()), []
      ),
    };
    await createSummaryService({ prisma }).getOverview({
      companyId: COMPANY,
      actorId: ACTOR,
      month: "2026-08",
    });
    assert.ok(seen.length >= 4);
    for (const sql of seen) {
      assert.ok(
        sql.includes("w.owner_id =") || sql.includes("wm.user_id ="),
        `aggregate not scoped to the actor: ${sql.slice(0, 90)}`,
      );
    }
  });

  it("month/category/trend queries exclude adjustments; the balance query does not", async () => {
    const seen = [];
    const prisma = {
      $queryRaw: async (strings) => {
        seen.push(strings.join("?").toLowerCase());
        return [];
      },
    };
    await createSummaryService({ prisma }).getOverview({
      companyId: COMPANY,
      actorId: ACTOR,
      month: "2026-08",
    });
    assert.ok(seen[1].includes("is_adjustment = false"), "totals query excludes adjustments");
    assert.ok(seen[2].includes("is_adjustment = false"), "byCategory query excludes adjustments");
    assert.ok(seen[3].includes("is_adjustment = false"), "trend query excludes adjustments");
    assert.ok(!seen[0].includes("is_adjustment = false"), "balance query keeps adjustments");
  });
});

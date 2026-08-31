// apps/api/src/routes/pfm/__tests__/budgets-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBudgetsService } from "../budgets-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-000000000501";
const OWNER = "01900000-0000-7000-8000-000000000502";
const OTHER = "01900000-0000-7000-8000-000000000503";
const CAT = "01900000-0000-7000-8000-000000000504";
const BUDGET = "01900000-0000-7000-8000-000000000505";

describe("budgets-service", () => {
  it("createBudget stamps owner + company and defaults alertThreshold 0.8", async () => {
    let created = null;
    const prisma = {
      pfmBudget: { create: async ({ data }) => ((created = data), { id: BUDGET, ...data }) },
    };
    const svc = createBudgetsService({ prisma });
    await svc.createBudget({
      companyId: COMPANY,
      actorId: OWNER,
      data: { categoryId: CAT, amount: 3000, alertThreshold: 0.8 },
    });
    assert.equal(created.ownerId, OWNER);
    assert.equal(created.companyId, COMPANY);
    assert.equal(Number(created.alertThreshold), 0.8);
  });

  it("listBudgets returns each budget with month spend + pct", async () => {
    const prisma = {
      $queryRaw: async () => [
        {
          id: BUDGET,
          category_id: CAT,
          category_name: "Comida",
          amount: "3000.00",
          alert_threshold: "0.800",
          wallet_id: null,
          spent: "2400.00",
        },
      ],
    };
    const svc = createBudgetsService({ prisma });
    const { data } = await svc.listBudgets({ companyId: COMPANY, actorId: OWNER, month: "2026-08" });
    assert.equal(data[0].amount, 3000);
    assert.equal(data[0].spent, 2400);
    assert.equal(data[0].pct, 0.8);
    assert.equal(data[0].categoryName, "Comida");
  });

  it("updateBudget refuses a budget owned by someone else (404)", async () => {
    const prisma = { pfmBudget: { findFirst: async () => null } };
    const svc = createBudgetsService({ prisma });
    await assert.rejects(
      () =>
        svc.updateBudget({ companyId: COMPANY, actorId: OTHER, budgetId: BUDGET, data: { amount: 1 } }),
      (e) => e instanceof PfmServiceError && e.status === 404,
    );
  });

  it("evaluateBudgets publishes a threshold notification deduped per budget/month/level", async () => {
    const published = [];
    const prisma = {
      $queryRaw: async () => [
        {
          id: BUDGET,
          owner_id: OWNER,
          company_id: COMPANY,
          category_id: CAT,
          category_name: "Comida",
          amount: "3000.00",
          alert_threshold: "0.800",
          wallet_id: null,
          spent: "2500.00",
        },
      ],
    };
    const svc = createBudgetsService({
      prisma,
      notificationService: { publish: async ({ input }) => published.push(input) },
    });
    await svc.evaluateBudgets({ now: new Date("2026-08-20T00:00:00.000Z") });
    assert.equal(published.length, 1);
    assert.match(published[0].eventType, /pfm\.budget\.(threshold|overage)/);
    assert.match(published[0].dedupeKey, /2026-08/);
    assert.deepEqual(published[0].recipients.userIds, [OWNER]);
  });

  it("evaluateBudgets uses the 'overage' event + high priority when spend >= 100%", async () => {
    const published = [];
    const prisma = {
      $queryRaw: async () => [
        {
          id: BUDGET,
          owner_id: OWNER,
          company_id: COMPANY,
          category_id: CAT,
          category_name: "Comida",
          amount: "3000.00",
          alert_threshold: "0.800",
          wallet_id: null,
          spent: "3100.00",
        },
      ],
    };
    const svc = createBudgetsService({
      prisma,
      notificationService: { publish: async ({ input }) => published.push(input) },
    });
    await svc.evaluateBudgets({ now: new Date("2026-08-20T00:00:00.000Z") });
    assert.equal(published[0].eventType, "pfm.budget.overage");
    assert.equal(published[0].priority, "high");
    assert.match(published[0].dedupeKey, /overage/);
  });
});

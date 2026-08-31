// apps/api/src/routes/pfm/__tests__/goals-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGoalsService } from "../goals-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-000000000601";
const OWNER = "01900000-0000-7000-8000-000000000602";
const OTHER = "01900000-0000-7000-8000-000000000603";
const GOAL = "01900000-0000-7000-8000-000000000604";

describe("goals-service", () => {
  it("createGoal stamps owner + company and starts at currentAmount 0", async () => {
    let created = null;
    const prisma = {
      pfmGoal: { create: async ({ data }) => ((created = data), { id: GOAL, ...data }) },
    };
    const svc = createGoalsService({ prisma });
    await svc.createGoal({
      companyId: COMPANY,
      actorId: OWNER,
      data: {
        name: "Vacaciones",
        targetAmount: 20000,
        targetDate: "2027-01-01",
        walletId: null,
        color: null,
      },
    });
    assert.equal(created.ownerId, OWNER);
    assert.equal(created.companyId, COMPANY);
    assert.equal(Number(created.currentAmount ?? 0), 0);
  });

  it("listGoals returns progress pct clamped to [0,1]", async () => {
    const prisma = {
      pfmGoal: {
        findMany: async () => [
          {
            id: GOAL,
            name: "Fondo",
            targetAmount: "10000.00",
            currentAmount: "12500.00",
            targetDate: null,
            color: null,
            walletId: null,
          },
        ],
      },
    };
    const svc = createGoalsService({ prisma });
    const { data } = await svc.listGoals({ companyId: COMPANY, actorId: OWNER });
    assert.equal(data[0].targetAmount, 10000);
    assert.equal(data[0].currentAmount, 12500);
    assert.equal(data[0].pct, 1);
  });

  it("contribute adjusts currentAmount by a signed delta, never below 0", async () => {
    let updateArg = null;
    const prisma = {
      pfmGoal: {
        findFirst: async () => ({
          id: GOAL,
          companyId: COMPANY,
          ownerId: OWNER,
          currentAmount: "300.00",
        }),
        update: async ({ data }) => ((updateArg = data), { id: GOAL, ...data }),
      },
    };
    const svc = createGoalsService({ prisma });
    await svc.contribute({ companyId: COMPANY, actorId: OWNER, goalId: GOAL, amount: -500 });
    assert.equal(Number(updateArg.currentAmount), 0);
  });

  it("contribute refuses a goal owned by someone else (404)", async () => {
    const prisma = { pfmGoal: { findFirst: async () => null } };
    const svc = createGoalsService({ prisma });
    await assert.rejects(
      () => svc.contribute({ companyId: COMPANY, actorId: OTHER, goalId: GOAL, amount: 100 }),
      (e) => e instanceof PfmServiceError && e.status === 404,
    );
  });
});

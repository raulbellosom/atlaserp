/* eslint-disable no-restricted-syntax -- test asserts UTC day math of the code under test */
// apps/api/src/routes/pfm/__tests__/recurring-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRecurringService } from "../recurring-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-000000000201";
const OWNER = "01900000-0000-7000-8000-000000000202";
const OTHER = "01900000-0000-7000-8000-000000000203";
const WALLET = "01900000-0000-7000-8000-000000000204";
const RULE = "01900000-0000-7000-8000-000000000205";

function walletsStub({ owner = true } = {}) {
  return { isWalletOwner: async () => owner };
}
function bridgeStub() {
  const calls = [];
  return {
    calls,
    syncRuleEvent: async (r) => calls.push(["sync", r.id]),
    deleteRuleEvent: async (r) => calls.push(["delete", r.id]),
  };
}

describe("recurring-service", () => {
  it("createRule refuses (403) when the actor is not the wallet owner", async () => {
    const service = createRecurringService({
      prisma: {},
      wallets: walletsStub({ owner: false }),
      calendarBridge: bridgeStub(),
    });
    await assert.rejects(
      () =>
        service.createRule({
          companyId: COMPANY,
          actorId: OTHER,
          data: {
            walletId: WALLET,
            label: "Netflix",
            direction: "EXPENSE",
            amountMode: "FIXED",
            amount: 219,
            rrule: { freq: "MONTHLY", interval: 1, byMonthDay: 5 },
            autoPost: true,
            startOn: "2026-08-01",
          },
        }),
      (e) => e instanceof PfmServiceError && e.status === 403,
    );
  });

  it("createRule stamps owner, computes nextRunAt from startOn, and syncs a calendar event", async () => {
    let created = null;
    const bridge = bridgeStub();
    const prisma = {
      pfmRecurringRule: {
        create: async ({ data }) => ((created = data), { id: RULE, ...data }),
        update: async ({ data }) => ({ id: RULE, ...created, ...data }),
        findUnique: async () => ({ id: RULE, ...created }),
      },
      pfmMovement: { create: async ({ data }) => ({ id: "m", ...data }) },
    };
    const service = createRecurringService({
      prisma,
      wallets: walletsStub(),
      calendarBridge: bridge,
    });
    const rule = await service.createRule({
      companyId: COMPANY,
      actorId: OWNER,
      data: {
        walletId: WALLET,
        label: "Netflix",
        direction: "EXPENSE",
        amountMode: "FIXED",
        amount: 219,
        rrule: { freq: "MONTHLY", interval: 1, byMonthDay: 5 },
        autoPost: true,
        startOn: "2026-08-20",
      },
    });
    assert.equal(created.ownerId, OWNER);
    assert.equal(created.companyId, COMPANY);
    // startOn 2026-08-20, byMonthDay 5 -> first run 2026-09-05
    assert.equal(new Date(created.nextRunAt).toISOString().slice(0, 10), "2026-09-05");
    assert.ok(bridge.calls.some(([k]) => k === "sync"));
    assert.ok(rule.id);
  });

  it("materializeDueRules creates PENDING movements for a VARIABLE rule, advancing nextRunAt", async () => {
    const inserted = [];
    const rule = {
      id: RULE,
      company_id: COMPANY,
      owner_id: OWNER,
      wallet_id: WALLET,
      category_id: null,
      direction: "EXPENSE",
      amount_mode: "VARIABLE",
      amount: null,
      auto_post: false,
      rrule: { freq: "MONTHLY", interval: 1, byMonthDay: 1 },
      next_run_at: new Date("2026-08-01T00:00:00.000Z"),
      end_on: null,
    };
    const prisma = {
      $queryRaw: async (s) => {
        const sql = (Array.isArray(s) ? s.join(" ") : String(s)).toLowerCase();
        return sql.includes("from pfm_recurring_rule") ? [rule] : [];
      },
      pfmMovement: {
        create: async ({ data }) => (inserted.push(data), { id: "m" + inserted.length, ...data }),
      },
      pfmRecurringRule: { update: async ({ data }) => ({ id: RULE, ...data }) },
    };
    const service = createRecurringService({
      prisma,
      wallets: walletsStub(),
      calendarBridge: bridgeStub(),
    });
    const res = await service.materializeDueRules({
      now: new Date("2026-09-15T00:00:00.000Z"),
      horizonDays: 45,
    });
    assert.ok(res.created >= 1);
    assert.ok(inserted.every((m) => m.status === "PENDING"));
    assert.ok(inserted.every((m) => m.recurringRuleId === RULE));
  });

  it("materializeDueRules disables a rule once nextRunAt passes endOn", async () => {
    let disabled = false;
    const rule = {
      id: RULE,
      company_id: COMPANY,
      owner_id: OWNER,
      wallet_id: WALLET,
      category_id: null,
      direction: "EXPENSE",
      amount_mode: "FIXED",
      amount: 100,
      auto_post: true,
      rrule: { freq: "MONTHLY", interval: 1, byMonthDay: 1 },
      next_run_at: new Date("2026-08-01T00:00:00.000Z"),
      end_on: new Date("2026-08-15T00:00:00.000Z"),
    };
    const prisma = {
      $queryRaw: async (s) => {
        const sql = (Array.isArray(s) ? s.join(" ") : String(s)).toLowerCase();
        return sql.includes("from pfm_recurring_rule") ? [rule] : [];
      },
      pfmMovement: { create: async ({ data }) => ({ id: "m", ...data }) },
      pfmRecurringRule: {
        update: async ({ data }) => {
          if (data.enabled === false) disabled = true;
          return { id: RULE, ...data };
        },
      },
    };
    const service = createRecurringService({
      prisma,
      wallets: walletsStub(),
      calendarBridge: bridgeStub(),
    });
    await service.materializeDueRules({
      now: new Date("2026-10-01T00:00:00.000Z"),
      horizonDays: 45,
    });
    assert.equal(disabled, true);
  });
});

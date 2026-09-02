// apps/api/src/routes/pfm/__tests__/assistant-tools.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TOOL_DEFS, buildToolRunners } from "../assistant-tools.js";

const CTX = {
  companyId: "01900000-0000-7000-8000-0000000009a1",
  actorId: "01900000-0000-7000-8000-0000000009a2",
};
const WALLET = "01900000-0000-7000-8000-0000000009a3";

function services(over = {}) {
  return {
    summary: {
      getOverview: async () => ({ totalBalance: 1000, spendable: 800 }),
      getUpcoming: async () => ({ data: [] }),
      ...over.summary,
    },
    wallets: {
      listWallets: async () => ({
        data: [
          { id: WALLET, name: "BBVA", kind: "DEBIT", currency: "MXN", currentBalance: 800, creditLimit: null },
        ],
      }),
      canWriteWallet: async () => true,
      ...over.wallets,
    },
    movements: {
      listMovements: async () => ({
        data: [
          {
            occurredOn: "2026-09-01",
            amount: 50,
            direction: "EXPENSE",
            merchant: "OXXO",
            categoryId: null,
            status: "POSTED",
            id: "x",
          },
        ],
      }),
      ...over.movements,
    },
    budgets: { listBudgets: async () => ({ data: [] }), ...over.budgets },
    categories: {
      listCategories: async () => ({ data: [{ id: "c1", name: "Comida", kind: "EXPENSE" }] }),
      ...over.categories,
    },
  };
}

describe("assistant-tools", () => {
  it("TOOL_DEFS is a non-empty array of OpenAI-style function tools incl. propose_movement", () => {
    assert.ok(Array.isArray(TOOL_DEFS) && TOOL_DEFS.length >= 6);
    const names = TOOL_DEFS.map((t) => t.function.name);
    for (const n of [
      "get_overview",
      "list_wallets",
      "list_movements",
      "list_budgets",
      "list_upcoming",
      "list_categories",
      "propose_movement",
    ]) {
      assert.ok(names.includes(n), `missing ${n}`);
    }
    for (const t of TOOL_DEFS) assert.equal(t.type, "function");
  });

  it("list_movements without walletId returns a guidance error, not a throw", async () => {
    const runners = buildToolRunners(services());
    const out = await runners.list_movements({}, CTX);
    assert.match(out.error, /walletId/);
  });

  it("list_movements strips audit fields from rows", async () => {
    const runners = buildToolRunners(services());
    const out = await runners.list_movements({ walletId: WALLET }, CTX);
    assert.deepEqual(Object.keys(out[0]).sort(), [
      "amount",
      "categoryId",
      "direction",
      "merchant",
      "occurredOn",
      "status",
    ]);
  });

  it("propose_movement validates without writing and returns __proposedAction with resolved names", async () => {
    let createCalled = false;
    const runners = buildToolRunners(
      services({ movements: { createMovement: async () => ((createCalled = true), {}) } }),
    );
    const out = await runners.propose_movement(
      { walletId: WALLET, direction: "EXPENSE", amount: 350, merchant: "Gasolina" },
      CTX,
    );
    assert.equal(createCalled, false);
    assert.equal(out.__proposedAction.type, "create_movement");
    assert.equal(out.__proposedAction.walletName, "BBVA");
    assert.equal(out.__proposedAction.amount, 350);
    assert.match(out.__proposedAction.occurredOn, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("propose_movement rejects a wallet the user cannot write", async () => {
    const runners = buildToolRunners(
      services({
        wallets: { canWriteWallet: async () => false, listWallets: async () => ({ data: [] }) },
      }),
    );
    const out = await runners.propose_movement(
      { walletId: WALLET, direction: "EXPENSE", amount: 10 },
      CTX,
    );
    assert.match(out.error, /acceso/i);
    assert.equal(out.__proposedAction, undefined);
  });

  it("propose_movement rejects a non-positive amount", async () => {
    const runners = buildToolRunners(services());
    const out = await runners.propose_movement(
      { walletId: WALLET, direction: "EXPENSE", amount: 0 },
      CTX,
    );
    assert.ok(out.error);
    assert.equal(out.__proposedAction, undefined);
  });
});

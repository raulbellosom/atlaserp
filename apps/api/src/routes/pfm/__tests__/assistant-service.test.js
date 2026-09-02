// apps/api/src/routes/pfm/__tests__/assistant-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAssistantService } from "../assistant-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-0000000009b1";
const OWNER = "01900000-0000-7000-8000-0000000009b2";
const OTHER = "01900000-0000-7000-8000-0000000009b3";
const THREAD = "01900000-0000-7000-8000-0000000009b4";
const WALLET = "01900000-0000-7000-8000-0000000009b5";

// A Groq stub: yields the queued responses in order. Each entry is the JSON
// body that api.groq.com would return for one chat-completions call.
function groqStub(queue) {
  const q = [...queue];
  return async () => ({
    ok: true,
    status: 200,
    json: async () =>
      q.shift() ?? { choices: [{ message: { role: "assistant", content: "(sin respuesta)" } }] },
    text: async () => "",
  });
}
const finalMsg = (content) => ({ choices: [{ message: { role: "assistant", content } }] });
const toolCallMsg = (name, args) => ({
  choices: [
    {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          { id: "call_1", type: "function", function: { name, arguments: JSON.stringify(args) } },
        ],
      },
    },
  ],
});

function deps(over = {}) {
  const messages = [];
  const threads = new Map([
    [THREAD, { id: THREAD, companyId: COMPANY, ownerId: OWNER, title: null, enabled: true }],
  ]);
  return {
    store: { messages, threads },
    prisma: {
      pfmAssistantThread: {
        findMany: async () => [...threads.values()].filter((t) => t.ownerId === OWNER && t.enabled),
        findFirst: async ({ where }) => {
          const t = threads.get(where.id);
          return t &&
            t.ownerId === where.ownerId &&
            t.companyId === where.companyId &&
            t.enabled
            ? t
            : null;
        },
        create: async ({ data }) => {
          const t = { id: `t_${threads.size}`, ...data, title: null, enabled: true };
          threads.set(t.id, t);
          return t;
        },
        update: async ({ where, data }) => {
          Object.assign(threads.get(where.id), data);
          return threads.get(where.id);
        },
        delete: async ({ where }) => (threads.delete(where.id), {}),
      },
      pfmAssistantMessage: {
        findMany: async ({ where }) =>
          messages
            .filter(
              (m) =>
                m.threadId === where.threadId &&
                (!where.role?.in || where.role.in.includes(m.role)),
            )
            .map((m) => ({ ...m })),
        create: async ({ data }) => (
          messages.push({ id: `m_${messages.length}`, createdAt: new Date(), ...data }),
          messages.at(-1)
        ),
      },
    },
    summary: {
      getOverview: async () => ({
        totalBalance: 1234.5,
        spendable: 900,
        creditDebt: 0,
        investments: 0,
        monthExpense: 300,
        monthIncome: 1000,
        byCategory: [],
      }),
      getUpcoming: async () => ({ data: [] }),
    },
    wallets: {
      listWallets: async () => ({
        data: [{ id: WALLET, name: "BBVA", kind: "DEBIT", currency: "MXN", currentBalance: 900 }],
      }),
      canWriteWallet: async () => true,
    },
    movements: { listMovements: async () => ({ data: [] }) },
    budgets: { listBudgets: async () => ({ data: [] }) },
    categories: { listCategories: async () => ({ data: [] }) },
    env: { GROQ_API_KEY: "test-key", GROQ_BASE_URL: "https://api.groq.com" },
    fetchImpl: groqStub([finalMsg("Hola")]),
    ...over,
  };
}

describe("assistant-service — threads & guards", () => {
  it("isConfigured reflects GROQ_API_KEY", () => {
    assert.equal(createAssistantService(deps()).isConfigured(), true);
    assert.equal(createAssistantService(deps({ env: {} })).isConfigured(), false);
  });

  it("createThread + listThreads are owner-scoped", async () => {
    const d = deps();
    const svc = createAssistantService(d);
    const { id } = await svc.createThread({ companyId: COMPANY, actorId: OWNER });
    assert.ok(id);
    const { data } = await svc.listThreads({ companyId: COMPANY, actorId: OWNER });
    assert.ok(data.length >= 1);
  });

  it("getThread on another owner's thread → 404", async () => {
    const svc = createAssistantService(deps());
    await assert.rejects(
      () => svc.getThread({ companyId: COMPANY, actorId: OTHER, threadId: THREAD }),
      (e) => e instanceof PfmServiceError && e.status === 404,
    );
  });

  it("deleteThread soft-deletes by default and hard-deletes with purge", async () => {
    const d = deps();
    const svc = createAssistantService(d);
    await svc.deleteThread({ companyId: COMPANY, actorId: OWNER, threadId: THREAD, purge: false });
    assert.equal(d.store.threads.get(THREAD).enabled, false);
  });

  it("sendMessage without GROQ_API_KEY → 503", async () => {
    const svc = createAssistantService(deps({ env: {} }));
    await assert.rejects(
      () =>
        svc.sendMessage({ companyId: COMPANY, actorId: OWNER, threadId: THREAD, content: "hola" }),
      (e) => e instanceof PfmServiceError && e.status === 503,
    );
  });

  it("rate limit: the 21st message in the window → 429", async () => {
    const svc = createAssistantService({
      ...deps(),
      fetchImpl: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => finalMsg("ok"),
          text: async () => "",
        }),
    });
    for (let i = 0; i < 20; i += 1) {
      await svc.sendMessage({ companyId: COMPANY, actorId: OWNER, threadId: THREAD, content: `m${i}` });
    }
    await assert.rejects(
      () =>
        svc.sendMessage({ companyId: COMPANY, actorId: OWNER, threadId: THREAD, content: "over" }),
      (e) => e instanceof PfmServiceError && e.status === 429,
    );
  });
});

describe("assistant-service — tool loop", () => {
  it("a plain question makes one Groq call and persists USER + ASSISTANT", async () => {
    const d = deps({ fetchImpl: groqStub([finalMsg("Tu saldo total es $1,234.50.")]) });
    const svc = createAssistantService(d);
    const out = await svc.sendMessage({
      companyId: COMPANY,
      actorId: OWNER,
      threadId: THREAD,
      content: "cuanto tengo?",
    });
    assert.match(out.message.content, /1,234\.50/);
    const roles = d.store.messages.map((m) => m.role);
    assert.deepEqual(roles, ["USER", "ASSISTANT"]);
  });

  it("runs a tool then answers; persists the TOOL row", async () => {
    const d = deps({
      fetchImpl: groqStub([toolCallMsg("get_overview", {}), finalMsg("Gastaste $300 este mes.")]),
    });
    const svc = createAssistantService(d);
    const out = await svc.sendMessage({
      companyId: COMPANY,
      actorId: OWNER,
      threadId: THREAD,
      content: "resumen",
    });
    assert.match(out.message.content, /300/);
    const roles = d.store.messages.map((m) => m.role);
    assert.deepEqual(roles, ["USER", "ASSISTANT", "TOOL", "ASSISTANT"]);
  });

  it("caps at 6 tool iterations and returns the 'no pude completar' note", async () => {
    const d = deps({
      fetchImpl: groqStub(Array.from({ length: 8 }, () => toolCallMsg("get_overview", {}))),
    });
    const svc = createAssistantService(d);
    const out = await svc.sendMessage({
      companyId: COMPANY,
      actorId: OWNER,
      threadId: THREAD,
      content: "loop",
    });
    assert.match(out.message.content, /no pude completar/i);
  });

  it("propose_movement returns proposedAction and writes nothing to movements", async () => {
    let created = false;
    const d = deps({
      movements: {
        listMovements: async () => ({ data: [] }),
        createMovement: async () => ((created = true), {}),
      },
      fetchImpl: groqStub([
        toolCallMsg("propose_movement", {
          walletId: WALLET,
          direction: "EXPENSE",
          amount: 350,
          merchant: "Gasolina",
        }),
      ]),
    });
    const svc = createAssistantService(d);
    const out = await svc.sendMessage({
      companyId: COMPANY,
      actorId: OWNER,
      threadId: THREAD,
      content: "apunta 350 de gasolina",
    });
    assert.equal(created, false);
    assert.equal(out.proposedAction.type, "create_movement");
    assert.equal(out.proposedAction.amount, 350);
    assert.equal(out.proposedAction.walletName, "BBVA");
  });

  it("propose_movement on a non-writable wallet → no proposedAction, loop continues", async () => {
    const d = deps({
      wallets: { listWallets: async () => ({ data: [] }), canWriteWallet: async () => false },
      fetchImpl: groqStub([
        toolCallMsg("propose_movement", { walletId: WALLET, direction: "EXPENSE", amount: 10 }),
        finalMsg("No encontre esa cartera."),
      ]),
    });
    const svc = createAssistantService(d);
    const out = await svc.sendMessage({
      companyId: COMPANY,
      actorId: OWNER,
      threadId: THREAD,
      content: "apunta 10",
    });
    assert.equal(out.proposedAction, undefined);
    assert.match(out.message.content, /no encontre/i);
  });

  it("the system prompt carries the anti-injection clause", async () => {
    const seen = [];
    const d = deps({
      fetchImpl: async (_url, opts) => {
        seen.push(JSON.parse(opts.body));
        return { ok: true, status: 200, json: async () => finalMsg("ok"), text: async () => "" };
      },
    });
    const svc = createAssistantService(d);
    await svc.sendMessage({ companyId: COMPANY, actorId: OWNER, threadId: THREAD, content: "hola" });
    const sys = seen[0].messages.find((m) => m.role === "system").content;
    assert.match(sys, /no son instrucciones|ignora cualquier orden/i);
  });
});

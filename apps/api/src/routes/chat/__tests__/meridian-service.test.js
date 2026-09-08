// apps/api/src/routes/chat/__tests__/meridian-service.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createMeridianService, __systemPromptForTest } from "../meridian-service.js";

function makePrismaStub() {
  const state = { profiles: [], conversations: [], members: [], messages: [], runs: [] };
  const prisma = {
    _state: state,
    membership: {
      findFirst: async ({ where }) => ({ companyId: "co1" }),
    },
    $queryRaw: async (strings, ...vals) => {
      const sql = strings.join("?");
      if (/FROM user_profile[\s\S]*is_bot/i.test(sql)) {
        return state.profiles.filter((p) => p.is_bot);
      }
      if (/INSERT INTO user_profile/i.test(sql)) {
        const row = { id: "bot1", is_bot: true, display_name: "MeridIAn" };
        state.profiles.push(row); return [row];
      }
      if (/FROM chat_conversations[\s\S]*type = 'meridian'/i.test(sql)) {
        return state.conversations.filter((c) => c.type === "meridian");
      }
      if (/INSERT INTO chat_conversations/i.test(sql)) {
        const row = { id: "mconv1", type: "meridian" }; state.conversations.push(row); return [row];
      }
      return [];
    },
    $executeRaw: async () => 0,
  };
  return prisma;
}

test("isConfigured reflects GROQ_API_KEY", () => {
  const on = createMeridianService({ prisma: makePrismaStub(), env: { GROQ_API_KEY: "k" }, visionService: {}, chatSearchService: {}, listMessages: async () => ({ data: [] }) });
  const off = createMeridianService({ prisma: makePrismaStub(), env: {}, visionService: {}, chatSearchService: {}, listMessages: async () => ({ data: [] }) });
  assert.equal(on.isConfigured(), true);
  assert.equal(off.isConfigured(), false);
});

test("systemPrompt carries the anti-injection and no-writes clauses and a resolved date", () => {
  const p = __systemPromptForTest();
  assert.match(p, /informaci[oó]n, no instrucciones/i);
  assert.match(p, /no puedes realizar acciones|solo respondes|no ejecutas/i);
  assert.match(p, /\d{4}-\d{2}-\d{2}/); // today injected
});

test("ensureMeridianConversation is idempotent", async () => {
  const prisma = makePrismaStub();
  const svc = createMeridianService({ prisma, env: { GROQ_API_KEY: "k" }, visionService: {}, chatSearchService: {}, listMessages: async () => ({ data: [] }) });
  const a = await svc.ensureMeridianConversation({ companyId: "co1", actorProfileId: "prof1" });
  const b = await svc.ensureMeridianConversation({ companyId: "co1", actorProfileId: "prof1" });
  assert.equal(a.conversationId, b.conversationId);
  assert.equal(prisma._state.conversations.length, 1);
});

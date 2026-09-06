import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCallLinksService, CallLinkError, generateCallCode } from "../call-links-service.js";

const CONV = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";

describe("generateCallCode", () => {
  it("produces 8 Crockford base32 chars, no ambiguous letters", () => {
    for (let i = 0; i < 50; i += 1) {
      const c = generateCallCode();
      assert.match(c, /^[0-9A-HJKMNP-TV-Z]{8}$/);
      assert.equal(/[ILOU]/.test(c), false);
    }
  });
});

describe("createCallLinksService.getOrCreateLink", () => {
  it("returns the existing non-revoked link without creating a second", async () => {
    const existing = { id: "l1", conversationId: CONV, token: "tok", code: "ABCDEFGH", requireLobby: true, maxUses: null, useCount: 0, expiresAt: null, revokedAt: null };
    let created = 0;
    const prisma = {
      $queryRaw: async () => [{ id: "member" }],
      callLink: {
        findFirst: async () => existing,
        create: async () => { created += 1; return existing; },
      },
    };
    const svc = createCallLinksService({ prisma, smtpService: null, callService: { assertCanManageCall: async () => {} } });
    const out = await svc.getOrCreateLink({ authUserId: "auth", conversationId: CONV, profileId: USER });
    assert.equal(out.token, "tok");
    assert.equal(created, 0);
  });

  it("creates a link when none exists", async () => {
    let createArgs;
    const prisma = {
      $queryRaw: async () => [{ id: "member" }],
      callLink: {
        findFirst: async () => null,
        create: async (args) => { createArgs = args; return { id: "l2", ...args.data, useCount: 0, revokedAt: null }; },
      },
    };
    const svc = createCallLinksService({ prisma, smtpService: null, callService: { assertCanManageCall: async () => {} } });
    const out = await svc.getOrCreateLink({ authUserId: "auth", conversationId: CONV, profileId: USER });
    assert.equal(createArgs.data.conversationId, CONV);
    assert.equal(createArgs.data.requireLobby, true);
    assert.match(out.code, /^[0-9A-HJKMNP-TV-Z]{8}$/);
  });
});

describe("createCallLinksService.resolveLinkForJoin", () => {
  function svcWith(link) {
    const prisma = { callLink: { findUnique: async () => link, findFirst: async () => link } };
    return createCallLinksService({ prisma, smtpService: null, callService: {} });
  }
  it("rejects a bad token", async () => {
    await assert.rejects(svcWith(null).resolveLinkForJoin({ token: "nope" }),
      (e) => e instanceof CallLinkError && e.reason === "bad_token");
  });
  it("rejects a revoked link", async () => {
    await assert.rejects(svcWith({ id: "l", revokedAt: new Date(), code: "X" }).resolveLinkForJoin({ token: "t" }),
      (e) => e.reason === "revoked");
  });
  it("rejects an expired link", async () => {
    await assert.rejects(
      svcWith({ id: "l", revokedAt: null, expiresAt: new Date(Date.now() - 1000), code: "X" }).resolveLinkForJoin({ token: "t" }),
      (e) => e.reason === "expired");
  });
  it("rejects when max uses reached", async () => {
    await assert.rejects(
      svcWith({ id: "l", revokedAt: null, expiresAt: null, maxUses: 3, useCount: 3, code: "X" }).resolveLinkForJoin({ token: "t" }),
      (e) => e.reason === "max_uses");
  });
  it("accepts a good link and matches the code case-insensitively", async () => {
    const link = { id: "l", revokedAt: null, expiresAt: null, maxUses: null, useCount: 0, code: "ABCDEFGH" };
    const out = await svcWith(link).resolveLinkForJoin({ code: "abcdefgh" });
    assert.equal(out.id, "l");
  });
});

describe("createCallLinksService.sendInvites", () => {
  it("splits matched company users from emailed invites and manual fallbacks", async () => {
    const prisma = {
      $queryRaw: async (strings) => {
        const sql = Array.isArray(strings) ? strings.join("?") : String(strings);
        if (sql.includes("membership")) return [{ userId: "u-match", email: "match@x.com" }];
        return [{ id: "member" }];
      },
      callLink: { findFirst: async () => ({ id: "l1", conversationId: CONV, token: "tok", code: "C", revokedAt: null }) },
      callInvite: { create: async ({ data }) => ({ id: `inv-${data.emailNormalized}`, ...data }) },
    };
    const sent = [];
    const smtpService = { isConfigured: async () => true, sendEmail: async (m) => { sent.push(m.to); } };
    const svc = createCallLinksService({ prisma, smtpService, callService: { assertCanManageCall: async () => {} }, env: { PUBLIC_APP_URL: "https://app.test" } });
    const out = await svc.sendInvites({ authUserId: "auth", conversationId: CONV, profileId: USER, emails: ["match@x.com", "outsider@y.com"] });
    assert.deepEqual(out.matchedUsers.map((u) => u.userId), ["u-match"]);
    assert.equal(out.invited.length, 1);
    assert.equal(out.pendingManual.length, 0);
    assert.deepEqual(sent, ["outsider@y.com"]);
  });

  it("returns pendingManual with a copyable URL when SMTP is not configured", async () => {
    const prisma = {
      $queryRaw: async (s) => (String(Array.isArray(s) ? s.join("?") : s).includes("membership") ? [] : [{ id: "member" }]),
      callLink: { findFirst: async () => ({ id: "l1", conversationId: CONV, token: "tok", code: "C", revokedAt: null }) },
      callInvite: { create: async ({ data }) => ({ id: "inv", ...data }) },
    };
    const smtpService = { isConfigured: async () => false, sendEmail: async () => { throw new Error("should not send"); } };
    const svc = createCallLinksService({ prisma, smtpService, callService: { assertCanManageCall: async () => {} }, env: { PUBLIC_APP_URL: "https://app.test" } });
    const out = await svc.sendInvites({ authUserId: "auth", conversationId: CONV, profileId: USER, emails: ["outsider@y.com"] });
    assert.equal(out.pendingManual.length, 1);
    assert.match(out.pendingManual[0].url, /^https:\/\/app\.test\/p\/call\/tok\?i=/);
  });
});

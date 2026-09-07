import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createSmtpService, encryptPassword, SmtpConfigError } from "../smtp-service.js";

// encryptPassword / decryptPassword derive their AES key from JWT_SECRET, so a
// value encrypted under one secret is unreadable once the secret changes.
const ORIGINAL_SECRET = process.env.JWT_SECRET;

function prismaWith(configRows) {
  return {
    instanceConfig: {
      findMany: async ({ where }) => {
        const wanted = new Set(where.key.in);
        return configRows.filter((r) => wanted.has(r.key));
      },
    },
  };
}

describe("createSmtpService.getStatus / isConfigured", () => {
  before(() => { process.env.JWT_SECRET = "secret-A-used-to-encrypt"; });
  after(() => { process.env.JWT_SECRET = ORIGINAL_SECRET; });

  it("reports not_configured when no SMTP rows exist", async () => {
    const svc = createSmtpService({ prisma: prismaWith([]) });
    assert.deepEqual(await svc.getStatus(), { configured: false, reason: "not_configured" });
    assert.equal(await svc.isConfigured(), false);
  });

  it("reports configured when host + user + a decryptable password are present", async () => {
    const rows = [
      { key: "smtp.host", value: "smtp.example.com" },
      { key: "smtp.user", value: "bot@example.com" },
      { key: "smtp.pass", value: encryptPassword("hunter2") },
    ];
    const svc = createSmtpService({ prisma: prismaWith(rows) });
    const status = await svc.getStatus();
    assert.equal(status.configured, true);
    assert.equal(status.reason, null);
    assert.equal(await svc.isConfigured(), true);
  });

  it("reports undecryptable_password (not a raw crypto throw) when JWT_SECRET rotated", async () => {
    const rows = [
      { key: "smtp.host", value: "smtp.example.com" },
      { key: "smtp.user", value: "bot@example.com" },
      { key: "smtp.pass", value: encryptPassword("hunter2") }, // encrypted under secret-A
    ];
    process.env.JWT_SECRET = "secret-B-rotated-in";

    const svc = createSmtpService({ prisma: prismaWith(rows) });
    const status = await svc.getStatus();
    assert.equal(status.configured, false);
    assert.equal(status.reason, "undecryptable_password");
    assert.match(status.message, /JWT_SECRET/);

    // isConfigured() must degrade to false, never throw.
    assert.equal(await svc.isConfigured(), false);

    // getConfig() surfaces the typed error for callers that want the detail.
    await assert.rejects(() => svc.getConfig(), (err) => {
      assert.ok(err instanceof SmtpConfigError);
      assert.equal(err.reason, "undecryptable_password");
      return true;
    });
  });
});

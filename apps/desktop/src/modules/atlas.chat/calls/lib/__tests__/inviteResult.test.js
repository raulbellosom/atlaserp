import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeInviteResult } from "../inviteResult.js";

describe("summarizeInviteResult", () => {
  it("counts emailed invites plus matched company users as successes", () => {
    const { successCount, notice } = summarizeInviteResult({
      invited: [{ email: "a@x.com" }, { email: "b@x.com" }],
      matchedUsers: [{ userId: "u1" }],
      pendingManual: [],
    });
    assert.equal(successCount, 3);
    assert.equal(notice, null);
  });

  it("shows the 'not configured' notice when SMTP is simply absent", () => {
    const { notice } = summarizeInviteResult({
      invited: [],
      matchedUsers: [],
      smtpConfigured: false,
      pendingManual: [{ email: "a@x.com", reason: "smtp_not_configured" }],
    });
    assert.match(notice.title, /no está configurado/);
    assert.equal(notice.description, null);
  });

  it("shows a send-failure notice with the detail when SMTP errored", () => {
    const { notice } = summarizeInviteResult({
      invited: [],
      matchedUsers: [],
      smtpConfigured: false,
      sendError: "No se pudo descifrar la contraseña SMTP (JWT_SECRET).",
      pendingManual: [{ email: "a@x.com", reason: "smtp_error" }],
    });
    assert.match(notice.title, /No se pudieron enviar/);
    assert.match(notice.description, /descifrar/);
  });

  it("treats send_failed reason as a send failure even without sendError", () => {
    const { notice } = summarizeInviteResult({
      pendingManual: [{ email: "a@x.com", reason: "send_failed" }],
    });
    assert.match(notice.title, /No se pudieron enviar/);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeInviteResult, describeInviteOutcome } from "../inviteResult.js";

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

  it("prefers notifiedUsers over matchedUsers when the API splits them out", () => {
    const summary = summarizeInviteResult({
      invited: [{ email: "a@x.com" }],
      matchedUsers: [{ userId: "u1" }, { userId: "u2" }],
      notifiedUsers: [{ userId: "u1" }],
      pendingManual: [],
    });
    assert.equal(summary.notifiedCount, 1);
    assert.equal(summary.emailedCount, 1);
    assert.equal(summary.successCount, 2);
  });

  it("describeInviteOutcome mentions both the in-app pings and the emails", () => {
    const text = describeInviteOutcome({
      invited: [{ email: "a@x.com" }, { email: "b@x.com" }],
      notifiedUsers: [{ userId: "u1" }],
    });
    assert.match(text, /1 usuario de Atlas/);
    assert.match(text, /2 invitaciones enviadas por correo/);
  });

  it("describeInviteOutcome returns null when nothing succeeded", () => {
    assert.equal(
      describeInviteOutcome({ invited: [], notifiedUsers: [], pendingManual: [{ email: "a@x.com", reason: "smtp_error" }] }),
      null,
    );
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

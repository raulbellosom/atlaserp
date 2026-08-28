import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReplyPreview } from "../chat-reply-preview.js";

const base = {
  id: "01900000-0000-7000-8000-00000000000a",
  sender_user_id: "01900000-0000-7000-8000-0000000000u1",
  sender_name: "Ana",
  body: "Hola equipo",
  message_type: "text",
  deleted_at: null,
  attachment_mime: null,
  has_entity_refs: false,
};

describe("buildReplyPreview", () => {
  it("returns null for a null row", () => {
    assert.equal(buildReplyPreview(null), null);
  });

  it("builds a text preview", () => {
    assert.deepEqual(buildReplyPreview(base), {
      id: base.id,
      senderUserId: base.sender_user_id,
      senderName: "Ana",
      bodyPreview: "Hola equipo",
      kind: "text",
      isDeleted: false,
    });
  });

  it("truncates a long body to 120 chars and collapses newlines", () => {
    const row = { ...base, body: "a\nb".padEnd(200, "x") };
    const out = buildReplyPreview(row);
    assert.equal(out.bodyPreview.length, 120);
    assert.ok(!out.bodyPreview.includes("\n"));
  });

  it("marks a deleted original", () => {
    const out = buildReplyPreview({ ...base, deleted_at: new Date() });
    assert.equal(out.isDeleted, true);
    assert.equal(out.kind, "deleted");
    assert.equal(out.bodyPreview, null);
    assert.equal(out.senderName, "Ana");
  });

  it("derives kind from attachment mime when body is empty", () => {
    assert.equal(buildReplyPreview({ ...base, body: "", attachment_mime: "image/png" }).kind, "image");
    assert.equal(buildReplyPreview({ ...base, body: "", attachment_mime: "video/mp4" }).kind, "video");
    assert.equal(buildReplyPreview({ ...base, body: "", attachment_mime: "audio/webm" }).kind, "audio");
    assert.equal(buildReplyPreview({ ...base, body: "", attachment_mime: "application/pdf" }).kind, "file");
  });

  it("derives kind=entity when the original is entity-ref-only", () => {
    assert.equal(buildReplyPreview({ ...base, body: "", has_entity_refs: true }).kind, "entity");
  });

  it("prefers text kind when the original has both a body and an attachment", () => {
    const out = buildReplyPreview({ ...base, body: "mira esto", attachment_mime: "image/png" });
    assert.equal(out.kind, "text");
    assert.equal(out.bodyPreview, "mira esto");
  });

  it("falls back to a generic sender name when null", () => {
    assert.equal(buildReplyPreview({ ...base, sender_name: null }).senderName, "Usuario");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMessagesTranscript, transcriptStamp } from "../chatUtils.js";

const mk = (over) => ({
  id: "m",
  body: "hola",
  created_at: "2026-09-07T19:33:00.000Z",
  deleted_at: null,
  sender: { displayName: "Ada" },
  ...over,
});

describe("transcriptStamp", () => {
  it("wraps a date and 24h time, no seconds", () => {
    const s = transcriptStamp("2026-09-07T19:33:00.000Z");
    assert.match(s, /\d/);
    assert.match(s, /\d{1,2}:\d{2}$/);
  });
  it("returns '' for an invalid date", () => {
    assert.equal(transcriptStamp("not-a-date"), "");
  });
});

describe("buildMessagesTranscript", () => {
  it("one line per message: [stamp] Sender: body", () => {
    const out = buildMessagesTranscript([mk()]);
    assert.match(out, /^\[.+\] Ada: hola$/);
  });

  it("sorts ascending by created_at regardless of input order", () => {
    const out = buildMessagesTranscript([
      mk({ id: "b", body: "segundo", created_at: "2026-09-07T10:00:00Z", sender: { displayName: "Bo" } }),
      mk({ id: "a", body: "primero", created_at: "2026-09-07T09:00:00Z", sender: { displayName: "Al" } }),
    ]);
    assert.deepEqual(out.split("\n").map((l) => l.split(": ")[1]), ["primero", "segundo"]);
  });

  it("skips deleted and body-less messages", () => {
    const out = buildMessagesTranscript([
      mk({ id: "a", body: "visible" }),
      mk({ id: "b", body: "", created_at: "2026-09-07T20:00:00Z" }),
      mk({ id: "c", body: "borrado", deleted_at: "2026-09-07T21:00:00Z", created_at: "2026-09-07T21:00:00Z" }),
    ]);
    assert.equal(out.split("\n").length, 1);
    assert.match(out, /visible$/);
  });

  it("falls back to 'Usuario' when the sender has no display name", () => {
    const out = buildMessagesTranscript([mk({ sender: null })]);
    assert.match(out, /\] Usuario: hola$/);
  });

  it("returns '' when nothing is copyable", () => {
    assert.equal(buildMessagesTranscript([mk({ body: "" })]), "");
    assert.equal(buildMessagesTranscript([]), "");
    assert.equal(buildMessagesTranscript(null), "");
  });
});

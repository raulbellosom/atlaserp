import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeRoomMessages } from "../roomChat.js";

describe("mergeRoomMessages", () => {
  it("dedupes by id and sorts by time", () => {
    const db = [
      { id: "b", body: "2", createdAt: "2026-09-06T10:00:02Z" },
      { id: "a", body: "1", createdAt: "2026-09-06T10:00:01Z" },
    ];
    const out = mergeRoomMessages(db, [{ id: "a", body: "1", createdAt: "2026-09-06T10:00:01Z" }]);
    assert.deepEqual(out.map((m) => m.id), ["a", "b"]);
  });

  it("keeps an optimistic live message until a matching db row lands", () => {
    const live = [{ body: "hola", senderName: "Ana", createdAt: "2026-09-06T10:00:05Z" }];
    const before = mergeRoomMessages([], live);
    assert.equal(before.length, 1);
    const after = mergeRoomMessages(
      [{ id: "x", body: "hola", senderName: "Ana", createdAt: "2026-09-06T10:00:06Z" }],
      live,
    );
    assert.deepEqual(after.map((m) => m.id), ["x"]);
  });

  it("tolerates empty inputs", () => {
    assert.deepEqual(mergeRoomMessages(), []);
    assert.deepEqual(mergeRoomMessages(undefined, undefined), []);
  });
});

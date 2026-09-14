import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeExternalPages } from "../../lib/mergeExternalPages.js";

test("mergeExternalPages returns latest as-is when there are no older pages", () => {
  const latest = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(mergeExternalPages([], latest), latest);
});

test("mergeExternalPages dedupes by id and keeps older-first order", () => {
  const older = [{ id: "a" }, { id: "b" }];
  const latest = [{ id: "b" }, { id: "c" }];
  assert.deepEqual(mergeExternalPages(older, latest).map((m) => m.id), ["a", "b", "c"]);
});

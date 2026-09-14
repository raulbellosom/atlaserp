import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnippetSegments } from "../searchSnippet.js";

test("no ranges: returns the whole body as one plain segment", () => {
  const out = buildSnippetSegments("hola mundo", [], 80);
  assert.deepEqual(out.segments, [{ text: "hola mundo", mark: false }]);
  assert.equal(out.truncatedStart, false);
  assert.equal(out.truncatedEnd, false);
});

test("marks the matched range", () => {
  // "pagué la factura hoy" — "factura" is chars [9,16) (é is one code point).
  const out = buildSnippetSegments("pagué la factura hoy", [[9, 16]], 80);
  assert.deepEqual(out.segments, [
    { text: "pagué la ", mark: false },
    { text: "factura", mark: true },
    { text: " hoy", mark: false },
  ]);
});

test("windows a long body around the first match with ellipsis flags", () => {
  const body = "x".repeat(200) + "factura" + "y".repeat(200);
  const out = buildSnippetSegments(body, [[200, 207]], 20);
  assert.equal(out.truncatedStart, true);
  assert.equal(out.truncatedEnd, true);
  const marked = out.segments.find((s) => s.mark);
  assert.equal(marked.text, "factura");
  assert.equal(out.segments[0].text.length, 20);
});

test("multiple ranges each become a marked segment", () => {
  const out = buildSnippetSegments("aa bb aa", [[0, 2], [6, 8]], 80);
  assert.deepEqual(out.segments, [
    { text: "aa", mark: true },
    { text: " bb ", mark: false },
    { text: "aa", mark: true },
  ]);
});

test("ignores malformed ranges", () => {
  const out = buildSnippetSegments("hello", [[3, 3], [1], "nope", [2, 4]], 80);
  assert.deepEqual(out.segments, [
    { text: "he", mark: false },
    { text: "ll", mark: true },
    { text: "o", mark: false },
  ]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAuthReturnPath } from "../authReturnPath.js";

test("preserves internal module routes after authentication", () => {
  assert.equal(
    normalizeAuthReturnPath("/app/m/atlas.inventory/inventory?view=table"),
    "/app/m/atlas.inventory/inventory?view=table",
  );
});

test("rejects login loops and external return paths", () => {
  assert.equal(normalizeAuthReturnPath("/app/login"), "/app");
  assert.equal(normalizeAuthReturnPath("https://malicious.example/app"), "/app");
  assert.equal(normalizeAuthReturnPath("//malicious.example/app"), "/app");
});

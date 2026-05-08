import test from "node:test";
import assert from "node:assert/strict";
import {
  featureCrudKeys,
  moduleAccessKey,
  ensureUniquePermissionKeys,
} from "../../permissions/granular-contract.js";
import { resolveLegacyFallback } from "../../permissions/legacy-fallback.js";

test("featureCrudKeys returns CRUD keys for module+feature", () => {
  assert.deepEqual(featureCrudKeys("finance", "ar"), [
    "finance.ar.read",
    "finance.ar.create",
    "finance.ar.update",
    "finance.ar.delete",
  ]);
});

test("resolveLegacyFallback maps granular read to module.read", () => {
  assert.equal(resolveLegacyFallback("finance.ar.read"), "finance.read");
});

test("ensureUniquePermissionKeys throws on duplicates", () => {
  assert.throws(
    () => ensureUniquePermissionKeys(["a.read", "a.read"]),
    /duplicado/i,
  );
});

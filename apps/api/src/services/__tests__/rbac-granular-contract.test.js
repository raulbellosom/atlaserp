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

test("moduleAccessKey returns access key for module", () => {
  assert.equal(moduleAccessKey("finance"), "finance.access");
});

test("resolveLegacyFallback maps granular read to module.read", () => {
  assert.equal(resolveLegacyFallback("finance.ar.read"), "finance.read");
});

test("resolveLegacyFallback returns null for invalid granular keys", () => {
  assert.equal(resolveLegacyFallback("finance.read"), null);
  assert.equal(resolveLegacyFallback("finance.ar.read.extra"), null);
  assert.equal(resolveLegacyFallback("finance.ar.publish"), null);
});

test("ensureUniquePermissionKeys throws on duplicates", () => {
  assert.throws(
    () => ensureUniquePermissionKeys(["a.read", "a.read"]),
    /duplicado/i,
  );
});

test("oleada A core manifests expose access and feature CRUD permission keys", async () => {
  const { coreModules } = await import(
    "../../../../../packages/maps/src/core-modules.js"
  );

  const byKey = Object.fromEntries(
    coreModules.map((moduleManifest) => [
      moduleManifest.key,
      new Set((moduleManifest.permissions ?? []).map((permission) => permission.key)),
    ]),
  );

  const requiredByModule = {
    "atlas.core": [
      "core.access",
      "core.modules.read",
      "core.modules.create",
      "core.modules.update",
      "core.modules.delete",
      "core.instance.read",
      "core.instance.create",
      "core.instance.update",
      "core.instance.delete",
    ],
    "atlas.identity": [
      "identity.access",
      "identity.users.read",
      "identity.users.create",
      "identity.users.update",
      "identity.users.delete",
      "identity.roles.read",
      "identity.roles.create",
      "identity.roles.update",
      "identity.roles.delete",
      "identity.permissions.read",
      "identity.permissions.create",
      "identity.permissions.update",
      "identity.permissions.delete",
    ],
    "atlas.company": [
      "company.access",
      "company.profile.read",
      "company.profile.create",
      "company.profile.update",
      "company.profile.delete",
      "company.address.read",
      "company.address.create",
      "company.address.update",
      "company.address.delete",
      "company.branding.read",
      "company.branding.create",
      "company.branding.update",
      "company.branding.delete",
    ],
  };

  for (const [moduleKey, requiredKeys] of Object.entries(requiredByModule)) {
    const permissionSet = byKey[moduleKey];
    assert.ok(permissionSet, `module not found: ${moduleKey}`);
    for (const permissionKey of requiredKeys) {
      assert.ok(
        permissionSet.has(permissionKey),
        `missing permission ${permissionKey} in ${moduleKey}`,
      );
    }
  }
});

test("oleada B/C finance manifest exposes granular permission keys", async () => {
  const { featureModules } = await import(
    "../../../../../packages/maps/src/feature-modules.js"
  );
  const finance = featureModules.find((moduleManifest) => moduleManifest.key === "atlas.finance");
  assert.ok(finance, "module not found: atlas.finance");

  const keys = new Set((finance.permissions ?? []).map((permission) => permission.key));
  assert.ok(keys.has("finance.access"));
  assert.ok(keys.has("finance.ar.read"));
  assert.ok(keys.has("finance.entries.create"));
  assert.ok(keys.has("finance.applications.reverse"));
});

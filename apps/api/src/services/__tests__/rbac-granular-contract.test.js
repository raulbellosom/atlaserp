import test from "node:test";
import assert from "node:assert/strict";
import {
  featureCrudKeys,
  moduleAccessKey,
  ensureUniquePermissionKeys,
} from "../../permissions/granular-contract.js";
import { listOfficialModuleManifests } from "../module-manifests-service.js";

const LEGACY_PERMISSION_KEYS = new Set([
  "modules.read",
  "modules.install",
  "modules.disable",
  "modules.uninstall",
  "identity.read",
  "identity.manage",
  "roles.read",
  "roles.manage",
  "permissions.read",
  "permissions.manage",
  "files.read",
  "files.upload",
  "files.delete",
  "files.manage",
  "company.read",
  "company.manage",
  "contacts.read",
  "contacts.create",
  "contacts.update",
  "contacts.delete",
  "finance.read",
  "finance.create",
  "finance.update",
  "finance.delete",
  "hr.read",
  "hr.create",
  "hr.update",
  "hr.delete",
]);

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

test("ensureUniquePermissionKeys throws on duplicates", () => {
  assert.throws(
    () => ensureUniquePermissionKeys(["a.read", "a.read"]),
    /duplicado/i,
  );
});

test("all manifest permissions are explicit in PERMISSION_CATALOG", async () => {
  const { PERMISSION_CATALOG } = await import("../../permission-catalog.js");
  const manifests = listOfficialModuleManifests();

  const manifestPermissionKeys = [
    ...new Set(
      manifests.flatMap((manifest) =>
        (manifest.permissions ?? []).map((permission) => permission.key),
      ),
    ),
  ];

  const missingInCatalog = manifestPermissionKeys.filter(
    (key) => !PERMISSION_CATALOG[key],
  );

  assert.equal(
    missingInCatalog.length,
    0,
    `Permisos faltantes en catalogo: ${missingInCatalog.join(", ")}`,
  );
});

test("manifests do not declare legacy permission keys", async () => {
  const manifests = listOfficialModuleManifests();

  const manifestPermissionKeys = [
    ...new Set(
      manifests.flatMap((manifest) =>
        (manifest.permissions ?? []).map((permission) => permission.key),
      ),
    ),
  ];

  const legacyFound = manifestPermissionKeys.filter((key) =>
    LEGACY_PERMISSION_KEYS.has(key),
  );

  assert.equal(
    legacyFound.length,
    0,
    `Permisos legacy detectados en manifiestos: ${legacyFound.join(", ")}`,
  );
});

test("core and identity manifests expose expected granular keys", async () => {
  const coreModules = listOfficialModuleManifests().filter(
    (manifest) => manifest?.core === true,
  );

  const byKey = Object.fromEntries(
    coreModules.map((manifest) => [
      manifest.key,
      new Set((manifest.permissions ?? []).map((permission) => permission.key)),
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
  };

  for (const [moduleKey, requiredKeys] of Object.entries(requiredByModule)) {
    const permissionSet = byKey[moduleKey];
    assert.ok(permissionSet, `Modulo no encontrado: ${moduleKey}`);
    for (const permissionKey of requiredKeys) {
      assert.ok(
        permissionSet.has(permissionKey),
        `Permiso faltante ${permissionKey} en ${moduleKey}`,
      );
    }
  }
});

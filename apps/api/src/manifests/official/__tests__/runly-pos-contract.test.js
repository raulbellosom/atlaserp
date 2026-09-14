import test from "node:test";
import assert from "node:assert/strict";
import { validateModulePwaIdentity } from "@runly/module-engine";
import { runlyPosManifest, coreModules } from "../core-modules.js";
import { PERMISSION_CATALOG } from "../../../permission-catalog.js";

const REQUIRED_PERMISSION_KEYS = [
  "pos.access",
  "pos.terminal.use",
  "pos.orders.read",
  "pos.orders.create",
  "pos.orders.update",
  "pos.orders.cancel",
  "pos.payments.create",
  "pos.sessions.read",
  "pos.sessions.manage",
  "pos.cash.manage",
  "pos.floor.read",
  "pos.floor.manage",
  "pos.stations.read",
  "pos.stations.manage",
  "pos.settings.manage",
  "pos.external.manage",
];

test("runly.pos is an official core module with PWA identity", () => {
  assert.equal(runlyPosManifest.key, "runly.pos");
  assert.equal(runlyPosManifest.core, true);
  assert.equal(runlyPosManifest.uninstallable, false);
  assert.ok(coreModules.some((manifest) => manifest.key === "runly.pos"));

  const pwaResult = validateModulePwaIdentity(runlyPosManifest);
  assert.equal(pwaResult.valid, true, pwaResult.errors.join("; "));
});

test("runly.pos declares restaurant-first POS permissions and navigation", () => {
  const permissionKeys = runlyPosManifest.permissions.map((permission) => permission.key);
  for (const key of REQUIRED_PERMISSION_KEYS) {
    assert.ok(permissionKeys.includes(key), `Permiso faltante: ${key}`);
    assert.ok(PERMISSION_CATALOG[key], `Permiso faltante en catalogo: ${key}`);
  }

  const navPaths = runlyPosManifest.navigation.map((item) => item.path);
  assert.ok(navPaths.includes("/app/m/runly.pos/pos/caja"));
  assert.ok(navPaths.includes("/app/m/runly.pos/pos/comandero"));
  assert.ok(navPaths.includes("/app/m/runly.pos/pos/cocina"));
  assert.ok(navPaths.includes("/app/m/runly.pos/pos/orders"));
  assert.ok(navPaths.includes("/app/m/runly.pos/pos/admin"));
});

test("runly.pos declares lifecycle ownership for POS tables", () => {
  const lifecycle = runlyPosManifest.lifecycle;
  assert.equal(lifecycle.installable, true);
  assert.equal(lifecycle.uninstallable, false);
  assert.equal(lifecycle.supportsDataPurge, false);
  assert.ok(lifecycle.ownedEntities.includes("PosOrder"));
  assert.ok(lifecycle.ownedEntities.includes("PosKitchenTicket"));
  assert.ok(lifecycle.ownedTables.includes("pos_order"));
  assert.ok(lifecycle.ownedTables.includes("pos_kitchen_ticket"));
});

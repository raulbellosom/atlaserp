import test from "node:test";
import assert from "node:assert/strict";
import { validateModulePwaIdentity } from "@atlas/module-engine";
import { atlasPosManifest, coreModules } from "../core-modules.js";
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

test("atlas.pos is an official core module with PWA identity", () => {
  assert.equal(atlasPosManifest.key, "atlas.pos");
  assert.equal(atlasPosManifest.core, true);
  assert.equal(atlasPosManifest.uninstallable, false);
  assert.ok(coreModules.some((manifest) => manifest.key === "atlas.pos"));

  const pwaResult = validateModulePwaIdentity(atlasPosManifest);
  assert.equal(pwaResult.valid, true, pwaResult.errors.join("; "));
});

test("atlas.pos declares restaurant-first POS permissions and navigation", () => {
  const permissionKeys = atlasPosManifest.permissions.map((permission) => permission.key);
  for (const key of REQUIRED_PERMISSION_KEYS) {
    assert.ok(permissionKeys.includes(key), `Permiso faltante: ${key}`);
    assert.ok(PERMISSION_CATALOG[key], `Permiso faltante en catalogo: ${key}`);
  }

  const navPaths = atlasPosManifest.navigation.map((item) => item.path);
  assert.ok(navPaths.includes("/app/m/atlas.pos/pos/terminal"));
  assert.ok(navPaths.includes("/app/m/atlas.pos/pos/tables"));
  assert.ok(navPaths.includes("/app/m/atlas.pos/pos/stations"));
  assert.ok(navPaths.includes("/app/m/atlas.pos/pos/settings"));
});

test("atlas.pos declares lifecycle ownership for POS tables", () => {
  const lifecycle = atlasPosManifest.lifecycle;
  assert.equal(lifecycle.installable, true);
  assert.equal(lifecycle.uninstallable, false);
  assert.equal(lifecycle.supportsDataPurge, false);
  assert.ok(lifecycle.ownedEntities.includes("PosOrder"));
  assert.ok(lifecycle.ownedEntities.includes("PosKitchenTicket"));
  assert.ok(lifecycle.ownedTables.includes("pos_order"));
  assert.ok(lifecycle.ownedTables.includes("pos_kitchen_ticket"));
});

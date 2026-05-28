import test from "node:test";
import assert from "node:assert/strict";
import { createModuleComponentRegistry } from "../module-component-registry-core.js";

test("component registry resolves registered components", () => {
  const registry = createModuleComponentRegistry();
  const ComponentA = () => null;

  registry.register("custom.fleet:VehicleStatusBadge", ComponentA);

  assert.equal(registry.has("custom.fleet:VehicleStatusBadge"), true);
  assert.equal(
    registry.resolve("custom.fleet:VehicleStatusBadge"),
    ComponentA,
  );
});

test("component registry blocks namespaced components when module is inactive", () => {
  const registry = createModuleComponentRegistry();
  const ComponentA = () => null;

  registry.register("custom.fleet:VehicleStatusBadge", ComponentA);
  registry.setActiveModules(["atlas.core"]);

  assert.equal(registry.resolve("custom.fleet:VehicleStatusBadge"), null);
  assert.equal(registry.resolve("atlas.core:Anything"), null);
});

test("component registry allows namespaced components when module is active", () => {
  const registry = createModuleComponentRegistry();
  const ComponentA = () => null;

  registry.register("custom.fleet:VehicleStatusBadge", ComponentA);
  registry.setActiveModules(["custom.fleet"]);

  assert.equal(
    registry.resolve("custom.fleet:VehicleStatusBadge"),
    ComponentA,
  );
});

test("component registry keeps non-namespaced keys always resolvable", () => {
  const registry = createModuleComponentRegistry();
  const SharedComponent = () => null;

  registry.register("AtlasTable", SharedComponent);
  registry.setActiveModules(["atlas.core"]);

  assert.equal(registry.resolve("AtlasTable"), SharedComponent);
});

test("component registry warns and replaces duplicate keys", () => {
  const warnings = [];
  const registry = createModuleComponentRegistry({
    warn: (msg) => warnings.push(msg),
  });
  const ComponentA = () => null;
  const ComponentB = () => null;

  registry.register("custom.fleet:VehicleStatusBadge", ComponentA);
  registry.register("custom.fleet:VehicleStatusBadge", ComponentB);

  assert.equal(
    registry.resolve("custom.fleet:VehicleStatusBadge"),
    ComponentB,
  );
  assert.equal(
    warnings.some((msg) => msg.includes("Duplicate registration")),
    true,
  );
});

test("component registry notifies subscribers when state changes", () => {
  const registry = createModuleComponentRegistry();
  let calls = 0;
  const unsubscribe = registry.subscribe(() => {
    calls += 1;
  });
  const ComponentA = () => null;

  registry.register("custom.fleet:VehicleStatusBadge", ComponentA);
  registry.setActiveModules(["custom.fleet"]);
  unsubscribe();
  registry.setActiveModules(["atlas.core"]);

  assert.equal(calls >= 2, true);
  assert.equal(typeof registry.getVersion(), "number");
});

import test from "node:test";
import assert from "node:assert/strict";
import { resolveBlueprintPresentation } from "../blueprint-layout-resolver.js";

test("resolveBlueprintPresentation: defaults to atlas keys when unset", () => {
  const result = resolveBlueprintPresentation({});
  assert.equal(result.shellKey, "atlas.dashboardShell");
  assert.equal(result.layoutKey, "atlas.crudLayout");
  assert.equal(result.shellSource, "default");
  assert.equal(result.layoutSource, "default");
  assert.equal(result.unsupportedShellKey, null);
  assert.equal(result.unsupportedLayoutKey, null);
});

test("resolveBlueprintPresentation: respects canonical atlas keys", () => {
  const result = resolveBlueprintPresentation({
    tableBlueprint: {
      schema: {
        shell: "atlas.dashboardShell",
        layout: "atlas.crudLayout",
      },
    },
  });

  assert.equal(result.shellKey, "atlas.dashboardShell");
  assert.equal(result.layoutKey, "atlas.crudLayout");
  assert.equal(result.shellSource, "table.schema.shell");
  assert.equal(result.layoutSource, "table.schema.layout");
});

test("resolveBlueprintPresentation: supports legacy aliases main/default", () => {
  const result = resolveBlueprintPresentation({
    pageBlueprint: {
      schema: {
        layout: "main",
        page: {
          shell: "default",
        },
      },
    },
  });

  assert.equal(result.shellKey, "atlas.dashboardShell");
  assert.equal(result.layoutKey, "atlas.crudLayout");
  assert.equal(result.shellSource, "page.schema.page.shell");
  assert.equal(result.layoutSource, "page.schema.layout");
  assert.equal(result.unsupportedShellKey, null);
  assert.equal(result.unsupportedLayoutKey, null);
});

test("resolveBlueprintPresentation: falls back and flags unsupported keys", () => {
  const result = resolveBlueprintPresentation({
    tableBlueprint: {
      schema: {
        shell: "custom.altShell",
        layout: "custom.twoColumn",
      },
    },
  });

  assert.equal(result.shellKey, "atlas.dashboardShell");
  assert.equal(result.layoutKey, "atlas.crudLayout");
  assert.equal(result.unsupportedShellKey, "custom.altShell");
  assert.equal(result.unsupportedLayoutKey, "custom.twoColumn");
});

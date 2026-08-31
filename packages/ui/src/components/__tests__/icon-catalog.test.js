import { test } from "node:test";
import assert from "node:assert/strict";
import { ICON_CATALOG, resolveLucideIcon } from "../icon-catalog.js";

test("ICON_CATALOG is a non-empty list of { name, component }", () => {
  assert.ok(Array.isArray(ICON_CATALOG));
  assert.ok(ICON_CATALOG.length > 10);
  for (const entry of ICON_CATALOG) {
    assert.equal(typeof entry.name, "string");
    assert.ok(entry.name.length > 0);
    assert.ok(entry.component, `missing component for ${entry.name}`);
  }
});

test("ICON_CATALOG includes finance icons for wallets", () => {
  const names = ICON_CATALOG.map((i) => i.name);
  for (const n of ["Wallet", "PiggyBank", "Landmark", "Banknote", "Coins", "TrendingUp"]) {
    assert.ok(names.includes(n), `expected catalog to include ${n}`);
  }
});

test("resolveLucideIcon returns the component for a known name", () => {
  const comp = resolveLucideIcon("Wallet");
  assert.ok(comp);
  assert.equal(comp, ICON_CATALOG.find((i) => i.name === "Wallet").component);
});

test("resolveLucideIcon returns null for empty / unknown / non-string input", () => {
  assert.equal(resolveLucideIcon(""), null);
  assert.equal(resolveLucideIcon(null), null);
  assert.equal(resolveLucideIcon(undefined), null);
  assert.equal(resolveLucideIcon("NotARealIcon"), null);
  assert.equal(resolveLucideIcon(42), null);
});

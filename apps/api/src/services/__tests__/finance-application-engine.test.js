import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFifoProposal,
  validateAllocation,
} from "../finance-application-engine.js";

test("buildFifoProposal allocates oldest targets first", () => {
  const result = buildFifoProposal({
    sourceOpen: 1000,
    targets: [
      { id: "a", open: 400 },
      { id: "b", open: 800 },
    ],
  });

  assert.deepEqual(result.lines, [
    { targetId: "a", amount: 400 },
    { targetId: "b", amount: 600 },
  ]);
  assert.equal(result.applied, 1000);
  assert.equal(result.unapplied, 0);
});

test("buildFifoProposal returns unapplied remainder", () => {
  const result = buildFifoProposal({
    sourceOpen: 1200,
    targets: [{ id: "a", open: 300 }],
  });

  assert.deepEqual(result.lines, [{ targetId: "a", amount: 300 }]);
  assert.equal(result.applied, 300);
  assert.equal(result.unapplied, 900);
});

test("validateAllocation rejects applying more than source open", () => {
  assert.throws(
    () =>
      validateAllocation({
        sourceOpen: 100,
        targets: [{ id: "a", open: 500 }],
        lines: [{ targetId: "a", amount: 120 }],
      }),
    /excede el saldo abierto del origen/i,
  );
});

test("validateAllocation rejects applying more than target open", () => {
  assert.throws(
    () =>
      validateAllocation({
        sourceOpen: 500,
        targets: [{ id: "a", open: 100 }],
        lines: [{ targetId: "a", amount: 120 }],
      }),
    /excede el saldo abierto del destino/i,
  );
});

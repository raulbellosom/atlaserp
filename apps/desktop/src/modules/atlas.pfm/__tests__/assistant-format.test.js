// apps/desktop/src/modules/atlas.pfm/__tests__/assistant-format.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { threadTitle, renderRichText, describeProposedAction } from "../lib/assistant-format.js";

describe("assistant-format", () => {
  it("threadTitle trims to 48 chars and collapses whitespace", () => {
    assert.equal(threadTitle("  hola   mundo  "), "hola mundo");
    assert.equal(threadTitle("x".repeat(80)).length, 48);
    assert.equal(threadTitle(""), "Nueva conversacion");
    assert.equal(threadTitle(null), "Nueva conversacion");
  });

  it("renderRichText keeps HTML as literal text and marks **bold**", () => {
    const lines = renderRichText("hola <b>mundo</b> **fuerte**");
    const segs = lines.flatMap((l) => l.segments);
    assert.ok(segs.some((s) => s.text.includes("<b>mundo</b>")));
    assert.ok(segs.some((s) => s.bold && s.text === "fuerte"));
  });

  it("renderRichText splits lines and marks bullets", () => {
    const lines = renderRichText("Resumen:\n- uno\n- dos");
    assert.equal(lines.length, 3);
    assert.equal(lines[1].bullet, true);
    assert.equal(lines[1].segments[0].text, "uno");
  });

  it("describeProposedAction summarizes a create_movement", () => {
    const s = describeProposedAction({
      type: "create_movement",
      walletName: "BBVA",
      direction: "EXPENSE",
      amount: 350,
      occurredOn: "2026-09-02",
      merchant: "Gasolina",
      categoryName: "Transporte",
    });
    assert.match(s, /Gasto/);
    assert.match(s, /\$350\.00/);
    assert.match(s, /BBVA/);
    assert.match(s, /Transporte/);
  });
});

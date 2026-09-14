import test from "node:test";
import assert from "node:assert/strict";
import { loadConversationFiles } from "../conversationFiles.js";
import { isAudioAttachment, buildAllAttachments } from "../chatUtils.js";

test("history includes old documents, audio and references without MIME", async () => {
  const calls = [];
  const pages = [
    { data: [{ id: "new", created_at: "2026-09-03", attachments: [{ id: "photo", mimeType: "image/png" }] }], hasMore: true },
    { data: [{ id: "text", created_at: "2026-09-02" }], hasMore: true },
    { data: [{ id: "old", created_at: "2026-09-01", attachments: [{ id: "audio", fileName: "nota_de_voz_1.webm", mimeType: "video/webm" }, { id: "pdf", fileName: "factura.pdf" }, { id: "zip", fileName: "datos.zip" }], metadata: { entityRefs: [{ entityType: "file", recordId: "word", title: "contrato.docx" }] } }], hasMore: false },
  ];
  const messages = await loadConversationFiles(async (params) => { calls.push(params); return pages.shift(); });
  assert.deepEqual(calls.map((p) => p.before), [undefined, "2026-09-03", "2026-09-02"]);
  assert.deepEqual(messages.map((m) => m.id), ["old", "new"]);
  assert.equal(buildAllAttachments(messages).length, 5);
  assert.equal(isAudioAttachment(messages[0].attachments[0]), true);
});

test("audio classification preserves video and accepts extension fallbacks", () => {
  assert.equal(isAudioAttachment({ mimeType: "AUDIO/OGG" }), true);
  assert.equal(isAudioAttachment({ fileName: "grabacion.m4a" }), true);
  assert.equal(isAudioAttachment({ fileName: "clip.webm", mimeType: "video/webm" }), false);
  assert.equal(isAudioAttachment({ fileName: "documento.pdf" }), false);
});

test("history stops on cancellation or a non-advancing cursor", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadConversationFiles(() => assert.fail("must not request"), controller.signal), { name: "AbortError" });
  await assert.rejects(loadConversationFiles(async () => ({ data: [{ id: "1", created_at: "2026-09-01" }], hasMore: true })), /historial/);
});

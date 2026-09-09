import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapPendingToViewerFiles,
  attachmentIdsToDiscard,
} from "../pendingAttachments.js";

const img = { localId: "l1", objectUrl: "blob:img", attachmentId: "a1", file: { name: "foto.jpg", type: "image/jpeg", size: 10 } };
const pdf = { localId: "l2", objectUrl: "blob:pdf", attachmentId: "a2", file: { name: "doc.pdf", type: "application/pdf", size: 20 } };
const voice = { localId: "l3", objectUrl: "blob:aud", attachmentId: "a3", file: { name: "nota_de_voz_10-00-00.webm", type: "audio/webm", size: 30 } };

describe("mapPendingToViewerFiles", () => {
  it("keeps non-audio entries in order and maps them to the viewer shape", () => {
    const files = mapPendingToViewerFiles([img, voice, pdf]);
    assert.deepEqual(files, [
      { id: "l1", mimeType: "image/jpeg", fileName: "foto.jpg", originalName: "foto.jpg", sizeBytes: 10, url: "blob:img", thumbnailUrl: "blob:img" },
      { id: "l2", mimeType: "application/pdf", fileName: "doc.pdf", originalName: "doc.pdf", sizeBytes: 20, url: "blob:pdf", thumbnailUrl: "blob:pdf" },
    ]);
  });

  it("drops audio / voice notes", () => {
    assert.deepEqual(mapPendingToViewerFiles([voice]), []);
  });

  it("tolerates a missing file object", () => {
    const files = mapPendingToViewerFiles([{ localId: "x", objectUrl: null }]);
    assert.equal(files.length, 1);
    assert.equal(files[0].id, "x");
    assert.equal(files[0].url, null);
  });
});

describe("attachmentIdsToDiscard", () => {
  it("returns attachmentIds of entries not in the sent set", () => {
    assert.deepEqual(attachmentIdsToDiscard([img, pdf], new Set(["l1"])), ["a2"]);
  });

  it("skips entries with no attachmentId yet", () => {
    const uploading = { localId: "l9", attachmentId: null, file: { name: "x", type: "image/png", size: 1 } };
    assert.deepEqual(attachmentIdsToDiscard([uploading], new Set()), []);
  });

  it("returns everything when nothing was sent", () => {
    assert.deepEqual(attachmentIdsToDiscard([img, pdf], new Set()), ["a1", "a2"]);
  });
});

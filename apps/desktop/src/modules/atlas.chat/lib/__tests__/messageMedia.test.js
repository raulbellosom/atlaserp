import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMergeableMediaMessage } from "../messageMedia.js";

const img = (id) => ({ id, mimeType: "image/jpeg", fileName: `${id}.jpg` });
const vid = (id) => ({ id, mimeType: "video/mp4", fileName: `${id}.mp4` });
const pdf = (id) => ({ id, mimeType: "application/pdf", fileName: `${id}.pdf` });
// A voice note whose mime got remapped to video/webm on upload (seen on some
// mobile browsers) — must NOT count as a mergeable video.
const voice = { id: "v", mimeType: "video/webm", fileName: "nota_de_voz_10-00-00.webm" };

describe("isMergeableMediaMessage", () => {
  it("false for no attachments", () => {
    assert.equal(isMergeableMediaMessage([]), false);
    assert.equal(isMergeableMediaMessage(undefined), false);
  });

  it("true for one image", () => {
    assert.equal(isMergeableMediaMessage([img("a")]), true);
  });

  it("true for a grid of images", () => {
    assert.equal(isMergeableMediaMessage([img("a"), img("b"), img("c"), img("d"), img("e")]), true);
  });

  it("true for exactly one video", () => {
    assert.equal(isMergeableMediaMessage([vid("a")]), true);
  });

  it("false for image + pdf", () => {
    assert.equal(isMergeableMediaMessage([img("a"), pdf("b")]), false);
  });

  it("false for two videos", () => {
    assert.equal(isMergeableMediaMessage([vid("a"), vid("b")]), false);
  });

  it("false for image + video", () => {
    assert.equal(isMergeableMediaMessage([img("a"), vid("b")]), false);
  });

  it("false for a single voice note remapped to a video mime", () => {
    assert.equal(isMergeableMediaMessage([voice]), false);
  });
});

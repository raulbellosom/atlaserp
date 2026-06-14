import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { createWebsiteDomain } from "../domains/website.js";
import { createAtlasClient } from "../index.js";

function makeFetch() {
  return mock.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () => ({ url }),
    text: async () => "",
  }));
}

describe("atlas SDK - website domain extraction", () => {
  it("exports the existing Website method contract", () => {
    const domain = createWebsiteDomain({
      request: async () => ({}),
      withAuthHeaders: () => ({}),
    });

    assert.deepEqual(Object.keys(domain).sort(), [
      "deleteDist",
      "getSite",
      "updateSite",
      "uploadDist",
    ]);
  });

  it("keeps request paths, methods, auth, and multipart upload", async () => {
    const fetchMock = makeFetch();
    globalThis.fetch = fetchMock;
    const client = createAtlasClient({ baseUrl: "http://api" });

    await client.website.getSite("site/1", "tok");
    await client.website.updateSite("site/1", { name: "Sitio" }, "tok");
    await client.website.uploadDist("site/1", new Blob(["zip"]), "tok");
    await client.website.deleteDist("site/1", "tok");

    const calls = fetchMock.mock.calls.map((call) => call.arguments);
    assert.equal(calls[0][0], "http://api/website/sites/site%2F1");
    assert.equal(calls[0][1].headers.Authorization, "Bearer tok");
    assert.equal(calls[1][1].method, "PATCH");
    assert.deepEqual(JSON.parse(calls[1][1].body), { name: "Sitio" });
    assert.equal(calls[2][1].method, "POST");
    assert.ok(calls[2][1].body instanceof FormData);
    assert.equal(calls[2][1].headers.Authorization, "Bearer tok");
    assert.equal(calls[3][1].method, "DELETE");

    fetchMock.mock.restore();
  });
});

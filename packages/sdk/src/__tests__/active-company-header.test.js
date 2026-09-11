import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

function makeFetch(status = 200) {
  return mock.fn(async (url) => ({
    ok: status < 400,
    status,
    json: async () => ({ url }),
    text: async () => String(status),
  }));
}

describe("atlas SDK — active company header", () => {
  it("sends X-Atlas-Company-Id when getActiveCompanyId returns an id", async () => {
    const fetchMock = makeFetch();
    const { createAtlasClient } = await import("../index.js");
    const client = createAtlasClient({
      baseUrl: "http://api",
      getActiveCompanyId: () => "company-a",
    });
    globalThis.fetch = fetchMock;
    await client.profile.me("tok");
    const [, opts] = fetchMock.mock.calls[0].arguments;
    assert.equal(opts.headers.Authorization, "Bearer tok");
    assert.equal(opts.headers["X-Atlas-Company-Id"], "company-a");
    fetchMock.mock.restore();
  });

  it("omits the header when getActiveCompanyId returns null", async () => {
    const fetchMock = makeFetch();
    const { createAtlasClient } = await import("../index.js");
    const client = createAtlasClient({
      baseUrl: "http://api",
      getActiveCompanyId: () => null,
    });
    globalThis.fetch = fetchMock;
    await client.profile.me("tok");
    const [, opts] = fetchMock.mock.calls[0].arguments;
    assert.equal("X-Atlas-Company-Id" in opts.headers, false);
    fetchMock.mock.restore();
  });

  it("omits the header when getActiveCompanyId is not provided at all", async () => {
    const fetchMock = makeFetch();
    const { createAtlasClient } = await import("../index.js");
    const client = createAtlasClient({ baseUrl: "http://api" });
    globalThis.fetch = fetchMock;
    await client.profile.me("tok");
    const [, opts] = fetchMock.mock.calls[0].arguments;
    assert.equal("X-Atlas-Company-Id" in opts.headers, false);
    fetchMock.mock.restore();
  });

  it("reads the callback fresh on every call — switching company mid-session takes effect immediately", async () => {
    const fetchMock = makeFetch();
    const { createAtlasClient } = await import("../index.js");
    let current = "company-a";
    const client = createAtlasClient({
      baseUrl: "http://api",
      getActiveCompanyId: () => current,
    });
    globalThis.fetch = fetchMock;
    await client.profile.me("tok");
    current = "company-b";
    await client.profile.me("tok");
    const [, firstOpts] = fetchMock.mock.calls[0].arguments;
    const [, secondOpts] = fetchMock.mock.calls[1].arguments;
    assert.equal(firstOpts.headers["X-Atlas-Company-Id"], "company-a");
    assert.equal(secondOpts.headers["X-Atlas-Company-Id"], "company-b");
    fetchMock.mock.restore();
  });
});

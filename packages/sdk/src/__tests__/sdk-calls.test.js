import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAtlasClient } from "../index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Atlas SDK calls domain", () => {
  it("creates a video call with auth and optional calendar link", async () => {
    let captured;
    globalThis.fetch = async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ data: { callId: "call-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = createAtlasClient({ baseUrl: "http://api" });
    await client.calls.create({
      conversationId: "11111111-1111-4111-8111-111111111111",
      calendarEventId: "22222222-2222-4222-8222-222222222222",
      kind: "VIDEO",
    }, "token");

    assert.equal(captured.url, "http://api/calls");
    assert.equal(captured.options.method, "POST");
    assert.equal(captured.options.headers.Authorization, "Bearer token");
    assert.equal(JSON.parse(captured.options.body).kind, "VIDEO");
  });

  it("uses the expected lifecycle endpoints", async () => {
    const paths = [];
    globalThis.fetch = async (url, options) => {
      paths.push({ url, method: options?.method ?? "GET" });
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = createAtlasClient({ baseUrl: "http://api" });
    await client.calls.getCurrent("token");
    await client.calls.get("call id", "token");
    await client.calls.join("call id", "token");
    await client.calls.decline("call id", "token");
    await client.calls.leave("call id", "token");
    await client.calls.end("call id", "token");

    assert.deepEqual(paths, [
      { url: "http://api/calls/current", method: "GET" },
      { url: "http://api/calls/call%20id", method: "GET" },
      { url: "http://api/calls/call%20id/join", method: "POST" },
      { url: "http://api/calls/call%20id/decline", method: "POST" },
      { url: "http://api/calls/call%20id/leave", method: "POST" },
      { url: "http://api/calls/call%20id/end", method: "POST" },
    ]);
  });
});

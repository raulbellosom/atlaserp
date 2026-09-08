import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createChatOfficeRoutes } from "../chat-office-routes.js";
import { OfficeError } from "../../../services/office/errors.js";

function app(officeService, { withAuth = true } = {}) {
  const a = new Hono();
  a.use("*", async (c, next) => {
    if (withAuth) c.set("authUserId", "auth-1");
    await next();
  });
  a.route("", createChatOfficeRoutes({ officeService }));
  return a;
}

test("mints a session, forwarding source=chat_attachment", async () => {
  const calls = [];
  const officeService = { createSession: async (args) => { calls.push(args); return { editorUrl: "https://x", accessToken: "t", fileName: "plan.xlsx" }; } };
  const res = await app(officeService).request("/attachments/abc/office/session", {
    method: "POST",
    body: JSON.stringify({ mode: "edit" }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.fileName, "plan.xlsx");
  assert.equal(calls[0].source, "chat_attachment");
  assert.equal(calls[0].fileId, "abc");
  assert.equal(calls[0].mode, "edit");
});

test("defaults mode to auto when body is empty", async () => {
  const calls = [];
  const officeService = { createSession: async (args) => { calls.push(args); return {}; } };
  await app(officeService).request("/attachments/abc/office/session", { method: "POST" });
  assert.equal(calls[0].mode, "auto");
});

test("401 without an authenticated user", async () => {
  const officeService = { createSession: async () => ({}) };
  const res = await app(officeService, { withAuth: false }).request("/attachments/abc/office/session", { method: "POST" });
  assert.equal(res.status, 401);
});

test("propagates an OfficeError status", async () => {
  const officeService = { createSession: async () => { throw new OfficeError("No perteneces a esta conversación.", 403, "forbidden"); } };
  const res = await app(officeService).request("/attachments/abc/office/session", { method: "POST" });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, "forbidden");
});

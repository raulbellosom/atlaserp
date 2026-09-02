// apps/api/src/routes/pfm/__tests__/receipts-routes.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createReceiptsRouter } from "../receipts-routes.js";

const AUTH_USER_ID = "01900000-0000-7000-8000-0000000000aa"; // Supabase auth id (payload.sub)
const PROFILE_ID = "01900000-0000-7000-8000-0000000000bb"; // UserProfile PK
const COMPANY_ID = "01900000-0000-7000-8000-0000000000cc";

function buildApp({ uploadSpy, filesUpload }) {
  const app = new Hono();
  // Mirror authMiddleware + requirePermission wiring from apps/api/src/index.js:
  //   authMiddleware       -> c.set("authUserId", <supabase sub>)
  //   requirePermission()  -> c.set("userId", context.profile.id)   (the UserProfile PK)
  app.use("*", async (c, next) => {
    c.set("authUserId", AUTH_USER_ID);
    c.set("userId", PROFILE_ID);
    c.set("userContext", {
      profile: { id: PROFILE_ID },
      memberships: [{ companyId: COMPANY_ID }],
    });
    await next();
  });
  const passthrough = () => async (c, next) => next();
  app.route(
    "/",
    createReceiptsRouter({
      requirePermission: passthrough,
      requireAnyPermission: passthrough,
      visionConfigured: () => true,
      filesService: {
        upload:
          filesUpload ??
          (async (args) => {
            uploadSpy.args = args;
            return { id: "01900000-0000-7000-8000-0000000000dd" };
          }),
      },
      receipts: {
        createReceipt: async () => ({
          id: "01900000-0000-7000-8000-0000000000ee",
          status: "PROCESSING",
        }),
      },
    }),
  );
  return app;
}

describe("receipts-routes POST /pfm/receipts", () => {
  it("passes the Supabase auth user id (c.get('authUserId')) to filesService.upload", async () => {
    const uploadSpy = {};
    const app = buildApp({ uploadSpy });
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "ticket.jpg", { type: "image/jpeg" }),
    );
    const res = await app.request("/pfm/receipts", { method: "POST", body: form });
    assert.equal(res.status, 201);
    assert.equal(uploadSpy.args.authUserId, AUTH_USER_ID);
  });

  it("surfaces a FilesService validation error with its real status/message, not an opaque 500", async () => {
    const app = buildApp({
      filesUpload: async () => {
        const err = new Error("Tipo de archivo no permitido. Usa imagen, PDF, texto u oficina.");
        err.name = "FilesServiceError";
        err.status = 400;
        throw err;
      },
    });
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "ticket.jpg", { type: "image/jpeg" }),
    );
    const res = await app.request("/pfm/receipts", { method: "POST", body: form });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Tipo de archivo no permitido/);
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { createDocumentGenerationRoutes } from "../document-generation-routes.js";

const TEMPLATE_ID = "22222222-2222-7222-8222-222222222222";
const GENERATED_ID = "55555555-5555-7555-8555-555555555555";

function requirePermission(permissionKey) {
  return async (c, next) => {
    const permissions = new Set(
      (c.req.header("x-permissions") ?? "").split(",").filter(Boolean),
    );
    if (!permissions.has(permissionKey)) {
      return c.json({ permissionKey }, 403);
    }
    c.set("companyId", "11111111-1111-7111-8111-111111111111");
    c.set("userContext", {
      profile: { id: "77777777-7777-7777-8777-777777777777" },
      permissions: [...permissions],
      permissionSet: permissions,
    });
    await next();
  };
}

function service() {
  return {
    preview: async () => ({ buffer: Buffer.from("%PDF"), warnings: [] }),
    generate: async () => ({ id: GENERATED_ID }),
    listGenerated: async () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
    getGenerated: async () => ({ id: GENERATED_ID }),
    getGeneratedDownload: async () => ({ url: "https://files.invalid/a", expiresIn: 3600 }),
    setGeneratedEnabled: async () => ({ id: GENERATED_ID, enabled: false }),
  };
}

test("generation routes fail closed with exact permissions", async () => {
  const app = createDocumentGenerationRoutes({
    service: service(),
    requirePermission,
  });
  const cases = [
    ["POST", `/documents/templates/${TEMPLATE_ID}/preview`, "documents.generated.create"],
    ["POST", `/documents/templates/${TEMPLATE_ID}/generate`, "documents.generated.create"],
    ["GET", "/documents/generated", "documents.generated.read"],
    ["GET", `/documents/generated/${GENERATED_ID}`, "documents.generated.read"],
    ["GET", `/documents/generated/${GENERATED_ID}/download`, "documents.generated.read"],
    ["PATCH", `/documents/generated/${GENERATED_ID}/enabled`, "documents.generated.delete"],
  ];

  for (const [method, path, permission] of cases) {
    const response = await app.request(path, { method });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).permissionKey, permission);
  }
});

test("preview returns an inline PDF", async () => {
  const app = createDocumentGenerationRoutes({
    service: service(),
    requirePermission,
  });
  const response = await app.request(
    `/documents/templates/${TEMPLATE_ID}/preview`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-permissions": "documents.generated.create,growth.leads.read",
      },
      body: JSON.stringify({
        sourceId: "44444444-4444-7444-8444-444444444444",
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(await response.text(), "%PDF");
});

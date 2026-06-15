import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createDocumentTemplateRoutes } from "../document-template-routes.js";

const COMPANY_ID = "11111111-1111-7111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-7222-8222-222222222222";
const VERSION_ID = "33333333-3333-7333-8333-333333333333";

function requirePermission(permissionKey) {
  return async (c, next) => {
    const permissions = new Set(
      (c.req.header("x-permissions") ?? "").split(",").filter(Boolean),
    );
    if (!permissions.has(permissionKey)) {
      return c.json({ error: "forbidden", permissionKey }, 403);
    }
    c.set("companyId", COMPANY_ID);
    c.set("userContext", {
      profile: { id: "44444444-4444-7444-8444-444444444444" },
      permissions: [...permissions],
      permissionSet: permissions,
      isAdmin: false,
    });
    await next();
  };
}

function createService() {
  return {
    listTemplates: async () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
    createTemplate: async () => ({ id: TEMPLATE_ID }),
    getTemplate: async () => ({ id: TEMPLATE_ID }),
    updateTemplate: async () => ({ id: TEMPLATE_ID }),
    setTemplateEnabled: async () => ({ id: TEMPLATE_ID }),
    listVersions: async () => [],
    createVersion: async () => ({ id: VERSION_ID }),
    updateVersion: async () => ({ id: VERSION_ID }),
    publishVersion: async () => ({ id: TEMPLATE_ID, publishedVersionId: VERSION_ID }),
  };
}

describe("Document template routes", () => {
  test("fails closed with the exact permission on every endpoint", async () => {
    const app = createDocumentTemplateRoutes({
      service: createService(),
      providerRegistry: { getSchema: () => ({ sourceType: "growth.lead" }) },
      requirePermission,
    });
    const cases = [
      ["GET", "/documents/templates", "documents.templates.read"],
      ["POST", "/documents/templates", "documents.templates.create"],
      ["GET", `/documents/templates/${TEMPLATE_ID}`, "documents.templates.read"],
      ["PATCH", `/documents/templates/${TEMPLATE_ID}`, "documents.templates.update"],
      [
        "PATCH",
        `/documents/templates/${TEMPLATE_ID}/enabled`,
        "documents.templates.delete",
      ],
      [
        "GET",
        `/documents/templates/${TEMPLATE_ID}/versions`,
        "documents.templates.read",
      ],
      [
        "POST",
        `/documents/templates/${TEMPLATE_ID}/versions`,
        "documents.templates.update",
      ],
      [
        "PATCH",
        `/documents/templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        "documents.templates.update",
      ],
      [
        "POST",
        `/documents/templates/${TEMPLATE_ID}/versions/${VERSION_ID}/publish`,
        "documents.templates.publish",
      ],
      [
        "GET",
        "/documents/providers/growth.lead/schema",
        "documents.templates.read",
      ],
    ];

    for (const [method, path, permission] of cases) {
      const response = await app.request(path, { method });
      assert.equal(response.status, 403, `${method} ${path}`);
      assert.equal((await response.json()).permissionKey, permission);
    }
  });

  test("passes company, actor, permissions, and validated input to the service", async () => {
    const calls = [];
    const service = {
      ...createService(),
      createTemplate: async (input) => (calls.push(input), { id: TEMPLATE_ID }),
    };
    const app = createDocumentTemplateRoutes({
      service,
      providerRegistry: { getSchema: () => ({ sourceType: "growth.lead" }) },
      requirePermission,
    });

    const response = await app.request("/documents/templates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-permissions": "documents.templates.create,growth.leads.read",
      },
      body: JSON.stringify({
        key: "lead-summary",
        name: "Resumen del lead",
        sourceType: "growth.lead",
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(calls[0].companyId, COMPANY_ID);
    assert.equal(calls[0].actorId, "44444444-4444-7444-8444-444444444444");
    assert.ok(calls[0].permissions.includes("growth.leads.read"));
    assert.equal(calls[0].input.key, "lead-summary");
  });

  test("checks source permissions when returning provider schemas", async () => {
    const calls = [];
    const app = createDocumentTemplateRoutes({
      service: createService(),
      providerRegistry: {
        getSchema: (input) => (calls.push(input), { sourceType: input.sourceType }),
      },
      requirePermission,
    });

    const response = await app.request(
      "/documents/providers/growth.lead/schema",
      {
        headers: {
          "x-permissions": "documents.templates.read,growth.leads.read",
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(calls[0].permissionKeys, [
      "documents.templates.read",
      "growth.leads.read",
    ]);
  });
});

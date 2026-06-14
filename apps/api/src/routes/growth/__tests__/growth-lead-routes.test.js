import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGrowthLeadRoutes } from "../growth-lead-routes.js";

const LEAD_ID = "01900000-0000-7000-8000-000000000004";
const USER_ID = "01900000-0000-7000-8000-000000000005";
const NOW = "2026-06-14T21:30:00.000Z";

function createRequirePermission() {
  return (permissionKey) => async (c, next) => {
    const permissions = new Set(
      (c.req.header("X-Test-Permissions") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (!permissions.has(permissionKey)) {
      return c.json({ error: `missing:${permissionKey}` }, 403);
    }
    c.set("companyId", "company-1");
    c.set("userContext", {
      profile: { id: "actor-1" },
      permissions: [...permissions],
      permissionSet: permissions,
      isAdmin: false,
    });
    await next();
  };
}

function buildService() {
  const calls = [];
  const result = { id: LEAD_ID };
  return {
    calls,
    getLeadSummary: async (input) => (calls.push(["summary", input]), result),
    listLeads: async (input) => (calls.push(["list", input]), result),
    createLead: async (input) => (calls.push(["create", input]), result),
    getLead: async (input) => (calls.push(["get", input]), result),
    updateLead: async (input) => (calls.push(["update", input]), result),
    addLeadNote: async (input) => (calls.push(["note", input]), result),
    convertLead: async (input) => (calls.push(["convert", input]), result),
    setLeadEnabled: async (input) => (calls.push(["enabled", input]), result),
  };
}

function request(app, path, {
  method = "GET",
  permissions = [],
  body,
} = {}) {
  return app.request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Test-Permissions": permissions.join(","),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const cases = [
  ["GET", "/growth/leads/summary", "growth.leads.read"],
  ["GET", "/growth/leads", "growth.leads.read"],
  ["POST", "/growth/leads", "growth.leads.create", {
    siteId: "01900000-0000-7000-8000-000000000003",
    name: "Ana",
  }],
  ["GET", `/growth/leads/${LEAD_ID}`, "growth.leads.read"],
  ["PATCH", `/growth/leads/${LEAD_ID}`, "growth.leads.update", {
    priority: "high",
    updatedAt: NOW,
  }],
  ["POST", `/growth/leads/${LEAD_ID}/notes`, "growth.leads.update", {
    note: "Llamar",
    updatedAt: NOW,
  }],
  ["POST", `/growth/leads/${LEAD_ID}/convert`, "growth.leads.convert", {
    mode: "create",
    updatedAt: NOW,
    contact: { type: "customer", name: "Ana" },
  }],
  ["PATCH", `/growth/leads/${LEAD_ID}/enabled`, "growth.leads.delete", {
    enabled: false,
    updatedAt: NOW,
  }],
];

describe("Growth lead routes", () => {
  it("fails closed with the exact permission on every endpoint", async () => {
    for (const [method, path, permission, body] of cases) {
      const service = buildService();
      const app = createGrowthLeadRoutes({
        service,
        requirePermission: createRequirePermission(),
      });
      const response = await request(app, path, { method, body });
      assert.equal(response.status, 403, `${method} ${path}`);
      assert.equal((await response.json()).error, `missing:${permission}`);
      assert.equal(service.calls.length, 0);
    }
  });

  it("dispatches validated requests with company and actor context", async () => {
    for (const [method, path, permission, body] of cases) {
      const service = buildService();
      const app = createGrowthLeadRoutes({
        service,
        requirePermission: createRequirePermission(),
      });
      const response = await request(app, path, {
        method,
        body,
        permissions: [
          permission,
          "contacts.contacts.create",
          "contacts.contacts.read",
        ],
      });
      assert.ok(response.status >= 200 && response.status < 300, `${method} ${path}`);
      assert.equal(service.calls.length, 1);
      assert.equal(service.calls[0][1].companyId, "company-1");
      if (!["summary", "list", "get"].includes(service.calls[0][0])) {
        assert.equal(service.calls[0][1].actorId, "actor-1");
      }
    }
  });

  it("requires growth.leads.assign when PATCH changes the assignee", async () => {
    const service = buildService();
    const app = createGrowthLeadRoutes({
      service,
      requirePermission: createRequirePermission(),
    });

    const denied = await request(app, `/growth/leads/${LEAD_ID}`, {
      method: "PATCH",
      permissions: ["growth.leads.update"],
      body: {
        assigneeUserId: USER_ID,
        updatedAt: NOW,
      },
    });
    assert.equal(denied.status, 403);
    assert.equal(service.calls.length, 0);

    const allowed = await request(app, `/growth/leads/${LEAD_ID}`, {
      method: "PATCH",
      permissions: ["growth.leads.update", "growth.leads.assign"],
      body: {
        assigneeUserId: USER_ID,
        updatedAt: NOW,
      },
    });
    assert.equal(allowed.status, 200);
    assert.equal(service.calls[0][0], "update");
  });

  it("passes effective Contacts permissions to conversion", async () => {
    const service = buildService();
    const app = createGrowthLeadRoutes({
      service,
      requirePermission: createRequirePermission(),
    });

    const response = await request(
      app,
      `/growth/leads/${LEAD_ID}/convert`,
      {
        method: "POST",
        permissions: [
          "growth.leads.convert",
          "contacts.contacts.create",
        ],
        body: {
          mode: "create",
          updatedAt: NOW,
          contact: { type: "customer", name: "Ana" },
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(service.calls[0][1].permissions, [
      "growth.leads.convert",
      "contacts.contacts.create",
    ]);
  });
});

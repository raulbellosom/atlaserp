import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGrowthAnalyticsRoutes } from "../growth-analytics-routes.js";

function requirePermission(permissionKey) {
  return async (c, next) => {
    const permissions = new Set(
      (c.req.header("X-Test-Permissions") ?? "").split(",").filter(Boolean),
    );
    if (!permissions.has(permissionKey)) {
      return c.json({ error: `missing:${permissionKey}` }, 403);
    }
    c.set("companyId", "company-1");
    c.set("userContext", {
      profile: { id: "actor-1" },
      permissionSet: permissions,
    });
    await next();
  };
}

function createService() {
  const calls = [];
  const result = {
    range: { from: "2026-06-01", to: "2026-06-14" },
    totals: { sessions: 10 },
    series: [{ date: "2026-06-14", sessions: 10 }],
    rows: [{ source: "google", sessions: 10 }],
  };
  return {
    calls,
    listSites: async (input) =>
      (calls.push(["sites", input]), [{ id: "site-1", name: "Principal" }]),
    getOverview: async (input) => (calls.push(["overview", input]), result),
    getAcquisition: async (input) =>
      (calls.push(["acquisition", input]), result),
    getContent: async (input) => (calls.push(["content", input]), result),
    getConversions: async (input) =>
      (calls.push(["conversions", input]), result),
    getRetention: async (input) => (calls.push(["retention", input]), result),
  };
}

function request(app, path, permissions = []) {
  return app.request(`http://localhost${path}`, {
    headers: { "X-Test-Permissions": permissions.join(",") },
  });
}

describe("Growth analytics routes", () => {
  it("guards JSON reports with growth.analytics.read", async () => {
    const service = createService();
    const app = createGrowthAnalyticsRoutes({
      service,
      prisma: { auditLog: { create: async () => ({}) } },
      requirePermission,
    });

    for (const report of [
      "sites",
      "overview",
      "acquisition",
      "content",
      "conversions",
      "retention",
    ]) {
      const denied = await request(app, `/growth/analytics/${report}`);
      assert.equal(denied.status, 403);
      const allowed = await request(app, `/growth/analytics/${report}${
        report === "sites" ? "" : "?from=2026-06-01&to=2026-06-14"
      }`, ["growth.analytics.read"]);
      assert.equal(allowed.status, 200);
    }
    assert.equal(service.calls.length, 6);
  });

  it("exports BOM CSV and records filter-only audit metadata", async () => {
    const service = createService();
    const audits = [];
    const app = createGrowthAnalyticsRoutes({
      service,
      prisma: {
        auditLog: {
          create: async ({ data }) => (audits.push(data), data),
        },
      },
      requirePermission,
    });

    const denied = await request(
      app,
      "/growth/analytics/export.csv?report=acquisition",
      ["growth.analytics.read"],
    );
    assert.equal(denied.status, 403);

    const response = await request(
      app,
      "/growth/analytics/export.csv?report=acquisition&from=2026-06-01&to=2026-06-14",
      ["growth.analytics.export"],
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/csv/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    assert.match(text, /Fuente,Sesiones/);
    assert.equal(audits[0].action, "growth.analytics.export");
    assert.deepEqual(audits[0].metadata, {
      companyId: "company-1",
      report: "acquisition",
      from: "2026-06-01",
      to: "2026-06-14",
      siteId: null,
      compare: false,
    });
  });
});

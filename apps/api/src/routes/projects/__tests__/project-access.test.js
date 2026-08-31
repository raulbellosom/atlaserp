// apps/api/src/routes/projects/__tests__/project-access.test.js
//
// Guards the 2026-08-30 fix: every /projects/:id/* route must verify the caller
// is a member of THAT project and that the project is in the caller's company —
// the company-wide RBAC grant is not enough.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProjectsRouter } from "../projects-routes.js";

const COMPANY = "01900000-0000-7000-8000-000000000001";
const OTHER_COMPANY = "01900000-0000-7000-8000-0000000000ff";
const USER = "01900000-0000-7000-8000-000000000002";
const PROFILE = "01900000-0000-7000-8000-000000000003";

// requirePermission stub: injects the same context the real one would.
function requirePermission() {
  return async (c, next) => {
    c.set("userContext", {
      profile: { id: PROFILE, firstName: "T", lastName: "U" },
      memberships: [{ companyId: COMPANY }],
    });
    c.set("companyId", COMPANY);
    c.set("userId", PROFILE);
    c.set("authUserId", USER);
    await next();
  };
}

function buildRouter({ project, member }) {
  const prisma = {
    project: {
      findFirst: async () => project,
    },
    projectMember: {
      findFirst: async () => member,
      findMany: async () => [],
    },
    // getProject (VIEWER route handler) needs a fuller row + statuses:
    // reuse the same object.
    task: { findMany: async () => [] },
    calendarCalendar: { findFirst: async () => null },
  };
  // getProject in projects-service does its own findFirst with includes;
  // point it at the same project object.
  prisma.project.findFirst = async () => project;

  return createProjectsRouter({ prisma, requirePermission, notificationService: null });
}

describe("requireProjectAccess", () => {
  it("404 when the project is in a different company", async () => {
    const router = buildRouter({
      project: { id: "p1", companyId: OTHER_COMPANY, ownerId: "someone" },
      member: null,
    });
    const res = await router.request("/projects/p1", { method: "GET" });
    assert.equal(res.status, 404);
  });

  it("404 when the caller is not a member of the project", async () => {
    const router = buildRouter({
      project: { id: "p1", companyId: COMPANY, ownerId: "someone-else" },
      member: null,
    });
    const res = await router.request("/projects/p1", { method: "GET" });
    assert.equal(res.status, 404);
  });

  it("403 when a VIEWER member hits an OWNER-only route (edit project)", async () => {
    const router = buildRouter({
      project: { id: "p1", companyId: COMPANY, ownerId: "someone-else", members: [{ userId: PROFILE }], statuses: [] },
      member: { role: "VIEWER" },
    });
    const res = await router.request("/projects/p1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    assert.equal(res.status, 403);
  });

  it("lets an OWNER through to an OWNER-only route", async () => {
    const project = { id: "p1", companyId: COMPANY, ownerId: PROFILE, members: [{ userId: PROFILE }], statuses: [] };
    const prisma = {
      project: {
        findFirst: async () => project,
        update: async () => ({ ...project, name: "renamed" }),
      },
      projectMember: { findFirst: async () => null, findMany: async () => [] },
      calendarCalendar: { findFirst: async () => null },
    };
    const router = createProjectsRouter({ prisma, requirePermission, notificationService: null });
    const res = await router.request("/projects/p1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "renamed" }),
    });
    assert.equal(res.status, 200);
  });

  it("lets a MEMBER read the project (VIEWER route)", async () => {
    const router = buildRouter({
      project: { id: "p1", companyId: COMPANY, ownerId: "someone-else", members: [{ userId: PROFILE }], statuses: [] },
      member: { role: "MEMBER" },
    });
    const res = await router.request("/projects/p1", { method: "GET" });
    assert.equal(res.status, 200);
  });
});

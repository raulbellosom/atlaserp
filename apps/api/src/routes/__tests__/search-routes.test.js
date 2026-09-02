import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSearchRouter } from "../search-routes.js";

const CONTACT_ROWS = [
  { id: "c1", name: "Acme", email: "a@acme.com", phone: null, type: "company" },
];
const USER_ROWS = [
  { user: { id: "u1", displayName: "Jane", email: "jane@x.com" } },
];
const EMPLOYEE_ROWS = [
  {
    id: "e1",
    firstName: "Ana",
    lastName: "Lopez",
    jobTitle: "Ventas",
    workEmail: null,
    employeeCode: null,
  },
];

function makePrisma(overrides = {}) {
  return {
    contact: { findMany: async () => CONTACT_ROWS },
    membership: { findMany: async () => USER_ROWS },
    hrEmployee: { findMany: async () => EMPLOYEE_ROWS },
    ...overrides,
  };
}

function makeContext({ isAdmin = false, permissions = [] } = {}) {
  return {
    profile: { id: "actor-1" },
    isAdmin,
    permissionSet: new Set(permissions),
    memberships: [{ companyId: "co-1" }],
  };
}

function makeApp(context, prisma = makePrisma()) {
  return createSearchRouter({ prisma, getUserContext: async () => context });
}

async function get(app, path) {
  const res = await app.request(`http://localhost${path}`);
  return { status: res.status, body: await res.json() };
}

describe("GET /search", () => {
  it("returns empty groups and calls no provider when q is too short", async () => {
    let called = false;
    const prisma = makePrisma({
      contact: {
        findMany: async () => {
          called = true;
          return CONTACT_ROWS;
        },
      },
    });
    const app = makeApp(
      makeContext({ permissions: ["contacts.contacts.read"] }),
      prisma,
    );
    const { status, body } = await get(app, "/search?q=a");
    assert.equal(status, 200);
    assert.deepEqual(body, { query: "a", groups: [] });
    assert.equal(called, false);
  });

  it("only runs providers the user has permission for", async () => {
    const app = makeApp(
      makeContext({
        permissions: ["contacts.contacts.read", "identity.users.read"],
      }),
    );
    const { body } = await get(app, "/search?q=an");
    assert.deepEqual(
      body.groups.map((g) => g.source),
      ["contacts", "users"],
    );
    assert.equal(body.groups[0].items[0].target, "/app/m/atlas.contacts/contacts/c1");
    assert.equal(body.groups[0].items[0].source, "contacts");
  });

  it("admin gets every group", async () => {
    const app = makeApp(makeContext({ isAdmin: true }));
    const { body } = await get(app, "/search?q=an");
    assert.deepEqual(
      body.groups.map((g) => g.source),
      ["contacts", "users", "employees"],
    );
  });

  it("a throwing provider is omitted, the rest still return 200", async () => {
    const prisma = makePrisma({
      membership: {
        findMany: async () => {
          throw new Error("boom");
        },
      },
    });
    const app = makeApp(makeContext({ isAdmin: true }), prisma);
    const { status, body } = await get(app, "/search?q=an");
    assert.equal(status, 200);
    assert.deepEqual(
      body.groups.map((g) => g.source),
      ["contacts", "employees"],
    );
  });

  it("no active company -> empty groups", async () => {
    const context = makeContext({ isAdmin: true });
    context.memberships = [];
    const app = makeApp(context);
    const { body } = await get(app, "/search?q=anything");
    assert.deepEqual(body.groups, []);
  });

  it("empty provider results produce no group", async () => {
    const prisma = makePrisma({ contact: { findMany: async () => [] } });
    const app = makeApp(
      makeContext({ permissions: ["contacts.contacts.read"] }),
      prisma,
    );
    const { body } = await get(app, "/search?q=zzz");
    assert.deepEqual(body.groups, []);
  });
});

// Fixture helpers for the opt-in cross-tenant security suite
// (cross-tenant-security.test.js). Creates real, clearly-prefixed throwaway
// rows in the live database and tears them all down in a `finally` block —
// never leaves orphaned data behind, even on assertion failure.
//
// Deliberately reuses the existing seeded `atlas.admin` system role (rather
// than creating new Role rows) for "full permissions in this company" test
// subjects, and `roleId: null` for "no special permissions" ones — Role.key
// is now company-scoped (see the 20260911000000_multi_tenant_schema_hardening
// migration) but atlas.admin (companyId: null) still applies in whatever
// company is active, which is exactly what a real company-admin test subject
// needs.

import crypto from "node:crypto";

const PREFIX = "__cross_tenant_test__";

export function mintTestJwt(authUserId, secret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({ sub: authUserId, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export async function createCrossTenantFixture(prisma) {
  const atlasAdminRole = await prisma.role.findFirst({
    where: { companyId: null, key: "atlas.admin" },
  });
  if (!atlasAdminRole) {
    throw new Error(
      "Seeded atlas.admin system role not found — run `pnpm db:seed` before running this suite.",
    );
  }
  const hrReadPermission = await prisma.permission.findUnique({
    where: { key: "hr.employee.read" },
  });
  if (!hrReadPermission) {
    throw new Error(
      "Seeded hr.employee.read permission not found — run `pnpm db:seed` before running this suite.",
    );
  }

  const stamp = Date.now();
  const companyA = await prisma.company.create({
    data: { name: `${PREFIX} Company A`, slug: `${PREFIX}-a-${stamp}` },
  });
  const companyB = await prisma.company.create({
    data: { name: `${PREFIX} Company B`, slug: `${PREFIX}-b-${stamp}` },
  });

  const userA = await prisma.userProfile.create({
    data: {
      authUserId: crypto.randomUUID(),
      email: `${PREFIX}-a-${stamp}@example.invalid`,
      displayName: "Cross-Tenant Test User A",
      firstName: "Test",
      lastName: "A",
    },
  });
  const userB = await prisma.userProfile.create({
    data: {
      authUserId: crypto.randomUUID(),
      email: `${PREFIX}-b-${stamp}@example.invalid`,
      displayName: "Cross-Tenant Test User B",
      firstName: "Test",
      lastName: "B",
    },
  });
  // Member of BOTH companies: admin in A, no special permissions in B.
  // Company A's membership is created AFTER Company B's on purpose — any
  // code that still derives "the current company" via
  // membership.findFirst({ orderBy: { createdAt: "desc" } }) instead of the
  // validated X-Atlas-Company-Id header would silently resolve to A (the
  // most recently created membership) even when this test explicitly
  // activates B, which is exactly the bug class this suite exists to catch.
  const userAB = await prisma.userProfile.create({
    data: {
      authUserId: crypto.randomUUID(),
      email: `${PREFIX}-ab-${stamp}@example.invalid`,
      displayName: "Cross-Tenant Test User AB",
      firstName: "Test",
      lastName: "AB",
    },
  });

  // A minimal company-scoped role for Company B with ONLY hr.employee.read —
  // not admin. Used by userAB's Company B membership so it can prove the
  // deeper bug: a caller who legitimately holds hr.employee.read in BOTH
  // companies (not blocked by the permission gate in either) must still only
  // ever see the ACTIVE company's employees, never fall back to whichever
  // membership was created most recently.
  const hrReaderRoleB = await prisma.role.create({
    data: {
      companyId: companyB.id,
      key: `${PREFIX}-hr-reader-${stamp}`,
      name: "Cross-Tenant Test HR Reader",
      system: false,
      enabled: true,
    },
  });
  await prisma.rolePermission.create({
    data: { roleId: hrReaderRoleB.id, permissionId: hrReadPermission.id },
  });

  await prisma.membership.create({
    data: { companyId: companyA.id, userId: userA.id, roleId: atlasAdminRole.id },
  });
  await prisma.membership.create({
    data: { companyId: companyB.id, userId: userB.id, roleId: atlasAdminRole.id },
  });
  await prisma.membership.create({
    data: { companyId: companyB.id, userId: userAB.id, roleId: hrReaderRoleB.id },
  });
  await prisma.membership.create({
    data: { companyId: companyA.id, userId: userAB.id, roleId: atlasAdminRole.id },
  });

  const employeeA = await prisma.hrEmployee.create({
    data: {
      companyId: companyA.id,
      firstName: `${PREFIX}`,
      lastName: "Employee In Company A",
      employeeCode: `${PREFIX}-emp-a-${stamp}`,
    },
  });

  return {
    companyA,
    companyB,
    userA,
    userB,
    userAB,
    employeeA,
    atlasAdminRoleId: atlasAdminRole.id,
    hrReaderRoleBId: hrReaderRoleB.id,
  };
}

export async function destroyCrossTenantFixture(prisma, fixture) {
  if (!fixture) return;
  const companyIds = [fixture.companyA?.id, fixture.companyB?.id].filter(Boolean);
  const userIds = [fixture.userA?.id, fixture.userB?.id, fixture.userAB?.id].filter(Boolean);

  if (companyIds.length) {
    await prisma.hrEmployee.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.role.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.membership.deleteMany({ where: { companyId: { in: companyIds } } });
  }
  if (userIds.length) {
    await prisma.userProfile.deleteMany({ where: { id: { in: userIds } } });
  }
  if (companyIds.length) {
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

const LEGACY_TO_GRANULAR_MAP = {
  "finance.read": [
    "finance.dashboard.read",
    "finance.ar.read",
    "finance.ap.read",
    "finance.accounts.read",
    "finance.entries.read",
    "finance.applications.read",
    "finance.tax_rates.read",
    "finance.fx_rates.read",
    "finance.aging.read",
    "finance.documents.read",
  ],
  "finance.create": [
    "finance.dashboard.create",
    "finance.ar.create",
    "finance.ap.create",
    "finance.accounts.create",
    "finance.entries.create",
    "finance.applications.create",
    "finance.tax_rates.create",
    "finance.fx_rates.create",
    "finance.aging.create",
    "finance.documents.create",
  ],
  "finance.update": [
    "finance.dashboard.update",
    "finance.ar.update",
    "finance.ap.update",
    "finance.accounts.update",
    "finance.entries.update",
    "finance.applications.update",
    "finance.tax_rates.update",
    "finance.fx_rates.update",
    "finance.aging.update",
    "finance.documents.update",
    "finance.applications.reverse",
    "finance.documents.reminder.send",
  ],
  "finance.delete": [
    "finance.dashboard.delete",
    "finance.ar.delete",
    "finance.ap.delete",
    "finance.accounts.delete",
    "finance.entries.delete",
    "finance.applications.delete",
    "finance.tax_rates.delete",
    "finance.fx_rates.delete",
    "finance.aging.delete",
    "finance.documents.delete",
  ],
};

export function expandLegacyPermission(legacyKey) {
  return LEGACY_TO_GRANULAR_MAP[legacyKey] ?? [];
}

async function migrateLegacyPermissionsToGranular({ dryRun = false } = {}) {
  const prisma = new PrismaClient();

  try {
    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({
        include: {
          permissions: {
            include: {
              permission: {
                select: {
                  id: true,
                  key: true,
                },
              },
            },
          },
        },
        orderBy: { key: "asc" },
      }),
      prisma.permission.findMany({
        select: {
          id: true,
          key: true,
        },
      }),
    ]);

    const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
    const plannedAdds = [];
    const skippedMissing = [];

    for (const role of roles) {
      const rolePermissionKeys = new Set(
        role.permissions.map((rolePermission) => rolePermission.permission.key),
      );
      const rolePlannedAdds = new Set();

      for (const permissionKey of rolePermissionKeys) {
        const expandedKeys = expandLegacyPermission(permissionKey);
        for (const granularKey of expandedKeys) {
          if (rolePermissionKeys.has(granularKey)) {
            continue;
          }
          if (!permissionIdByKey.has(granularKey)) {
            skippedMissing.push({ roleKey: role.key, legacyKey: permissionKey, granularKey });
            continue;
          }
          rolePlannedAdds.add(granularKey);
        }
      }

      for (const granularKey of rolePlannedAdds) {
        plannedAdds.push({
          roleId: role.id,
          roleKey: role.key,
          permissionId: permissionIdByKey.get(granularKey),
          permissionKey: granularKey,
        });
      }
    }

    if (plannedAdds.length === 0) {
      console.log("[rbac:migrate] No legacy->granular role links to add.");
      if (skippedMissing.length > 0) {
        console.log(`[rbac:migrate] Skipped ${skippedMissing.length} missing permission keys.`);
      }
      return;
    }

    const summaryByRole = new Map();
    for (const add of plannedAdds) {
      if (!summaryByRole.has(add.roleKey)) {
        summaryByRole.set(add.roleKey, []);
      }
      summaryByRole.get(add.roleKey).push(add.permissionKey);
    }

    const mode = dryRun ? "DRY-RUN" : "APPLY";
    console.log(`[rbac:migrate] ${mode} planned additions: ${plannedAdds.length}`);
    for (const [roleKey, keys] of summaryByRole.entries()) {
      console.log(`- ${roleKey}: ${keys.length} permission(s)`);
      for (const key of keys) {
        console.log(`  + ${key}`);
      }
    }

    if (skippedMissing.length > 0) {
      console.log(`[rbac:migrate] Skipped ${skippedMissing.length} missing permission keys.`);
      for (const skipped of skippedMissing) {
        console.log(
          `  ! ${skipped.roleKey}: ${skipped.legacyKey} -> ${skipped.granularKey} (missing in Permission table)`,
        );
      }
    }

    if (dryRun) {
      return;
    }

    await prisma.rolePermission.createMany({
      data: plannedAdds.map((add) => ({
        roleId: add.roleId,
        permissionId: add.permissionId,
      })),
      skipDuplicates: true,
    });

    console.log(`[rbac:migrate] Added ${plannedAdds.length} role-permission link(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

const isCliInvocation =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliInvocation) {
  const dryRun = process.argv.includes("--dry-run");
  migrateLegacyPermissionsToGranular({ dryRun }).catch((error) => {
    console.error("[rbac:migrate] Migration failed.");
    console.error(error);
    process.exitCode = 1;
  });
}

import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { coreModules } from '../packages/maps/src/core-modules.js'
import { featureModules } from '../packages/maps/src/feature-modules.js'
import { getPermissionPresentation } from '../apps/api/src/permission-catalog.js'

const prisma = new PrismaClient()

async function upsertModule(manifest) {
  const isCore = manifest.core === true;
  return prisma.atlasModule.upsert({
    where: { key: manifest.key },
    update: {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      kind: manifest.kind,
      core: manifest.core,
      uninstallable: manifest.uninstallable,
      manifest,
      // Core modules are always kept enabled; feature module state is managed by the user
      ...(isCore ? { enabled: true, status: "INSTALLED" } : {}),
    },
    create: {
      key: manifest.key,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      kind: manifest.kind,
      core: manifest.core,
      uninstallable: manifest.uninstallable,
      manifest,
      // Feature modules start as uninstalled so the user installs them via the catalog
      ...(isCore ? {} : { status: "UNINSTALLED", enabled: false }),
    }
  })
}

async function main() {
  const allModuleManifests = [...coreModules, ...featureModules]
  const manifestPermissionKeys = new Set(
    allModuleManifests.flatMap((manifest) =>
      (manifest.permissions ?? []).map((permission) => permission.key)
    )
  )

  for (const manifest of allModuleManifests) {
    const module = await upsertModule(manifest)
    for (const blueprint of manifest.blueprints ?? []) {
      await prisma.blueprint.upsert({
        where: { key: blueprint.key },
        update: {
          moduleId: module.id,
          kind: blueprint.kind,
          version: blueprint.version,
          schema: blueprint.schema,
          enabled: true
        },
        create: {
          key: blueprint.key,
          moduleId: module.id,
          kind: blueprint.kind,
          version: blueprint.version,
          schema: blueprint.schema
        }
      })
    }
    for (const permission of manifest.permissions ?? []) {
      const presentation = getPermissionPresentation(permission.key)
      await prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          name: presentation.name,
          description: presentation.description,
          moduleId: module.id,
          moduleKey: manifest.key,
          active: true,
        },
        create: {
          key: permission.key,
          name: presentation.name,
          description: presentation.description,
          moduleId: module.id,
          moduleKey: manifest.key,
        }
      })
    }
  }

  // Set active=false for permissions belonging to uninstalled or disabled modules.
  // This ensures feature module permissions are not effective until the module is installed.
  const uninstalledModules = await prisma.atlasModule.findMany({
    where: {
      OR: [
        { status: { not: "INSTALLED" } },
        { enabled: false },
      ],
    },
    select: { id: true },
  })
  if (uninstalledModules.length > 0) {
    const uninstalledIds = uninstalledModules.map((m) => m.id)
    await prisma.permission.updateMany({
      where: { moduleId: { in: uninstalledIds } },
      data: { active: false },
    })
  }

  const obsoletePermissions = await prisma.permission.findMany({
    where: {
      key: { notIn: [...manifestPermissionKeys] }
    },
    select: { id: true }
  })
  if (obsoletePermissions.length > 0) {
    const obsoletePermissionIds = obsoletePermissions.map((permission) => permission.id)
    await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: obsoletePermissionIds } }
    })
    await prisma.permission.deleteMany({
      where: { id: { in: obsoletePermissionIds } }
    })
  }

  await prisma.role.upsert({
    where: { key: 'atlas.admin' },
    update: { enabled: true },
    create: {
      key: 'atlas.admin',
      name: 'Atlas Admin',
      description: 'Full system access',
      system: true,
      enabled: true
    }
  })

  await prisma.role.upsert({
    where: { key: 'system.admin' },
    update: { enabled: true },
    create: {
      key: 'system.admin',
      name: 'System Admin',
      description: 'Full system access',
      system: true,
      enabled: true
    }
  })

  const adminRoles = await prisma.role.findMany({
    where: { key: { in: ['atlas.admin', 'system.admin'] } },
    select: { id: true }
  })
  const allPermissions = await prisma.permission.findMany({ select: { id: true } })
  for (const role of adminRoles) {
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    if (allPermissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: allPermissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id
        })),
        skipDuplicates: true
      })
    }
  }

  console.log(`Atlas modules seeded (${allModuleManifests.length})`)
}

main().finally(() => prisma.$disconnect())

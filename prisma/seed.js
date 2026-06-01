import "dotenv/config"
import pkg from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
const { PrismaClient } = pkg
import { listOfficialModuleManifests } from '../apps/api/src/services/module-manifests-service.js'
import { getPermissionPresentation } from '../apps/api/src/permission-catalog.js'

const prismaConnectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL
const prismaAdapter = new PrismaPg({ connectionString: prismaConnectionString })
const prisma = new PrismaClient({ adapter: prismaAdapter })

async function upsertModule(manifest) {
  const isCore = manifest.core === true;
  const lifecycleConfig = manifest.lifecycle ?? null;
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
      lifecycleConfig,
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
      lifecycleConfig,
      // Feature modules start as uninstalled so the user installs them via the catalog
      ...(isCore ? {} : { status: "UNINSTALLED", enabled: false }),
    }
  })
}

async function main() {
  const officialModuleManifests = listOfficialModuleManifests()
  const manifestPermissionKeys = new Set(
    officialModuleManifests.flatMap((manifest) =>
      (manifest.permissions ?? []).map((permission) => permission.key)
    )
  )

  for (const manifest of officialModuleManifests) {
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

  // Storefront roles
  for (const roleData of [
    { key: 'storefront_client', name: 'Cliente (Storefront)', description: 'Usuario final registrado desde una app externa', system: true },
    { key: 'storefront_vendor', name: 'Vendedor (Storefront)', description: 'Proveedor registrado desde una app externa', system: true },
  ]) {
    await prisma.role.upsert({
      where: { key: roleData.key },
      update: { name: roleData.name, description: roleData.description },
      create: roleData,
    })
  }

  // Storefront registrable roles config
  await prisma.instanceConfig.upsert({
    where: { key: 'storefront.registrable_roles' },
    update: {},
    create: {
      key: 'storefront.registrable_roles',
      value: JSON.stringify(['storefront_client', 'storefront_vendor']),
    },
  })

  console.log(`Atlas modules seeded (${officialModuleManifests.length})`)
}

main().finally(() => prisma.$disconnect())

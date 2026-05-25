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

  // Protect fleet permissions from the obsolete-cleanup block.
  // custom.fleet is an AME3 module outside the legacy manifests snapshot,
  // so its permissions are not included in the scan above.
  const fleetPermissionKeys = [
    'fleet.access',
    'fleet.vehicles.read', 'fleet.vehicles.create', 'fleet.vehicles.update', 'fleet.vehicles.delete',
    'fleet.maintenance.read', 'fleet.maintenance.create', 'fleet.maintenance.update', 'fleet.maintenance.delete',
    'fleet.drivers.read', 'fleet.drivers.create', 'fleet.drivers.update', 'fleet.drivers.delete',
    'fleet.catalogs.read', 'fleet.catalogs.create', 'fleet.catalogs.update', 'fleet.catalogs.delete',
  ]
  for (const key of fleetPermissionKeys) manifestPermissionKeys.add(key)

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

  // Upsert v0.2.0 permissions for custom.fleet (AME3 module outside legacy manifests).
  const fleetMod = await prisma.atlasModule.findUnique({ where: { key: 'custom.fleet' } })
  if (fleetMod) {
    const fleetNewPermissions = [
      { key: 'fleet.drivers.read', name: 'Ver choferes' },
      { key: 'fleet.drivers.create', name: 'Crear choferes' },
      { key: 'fleet.drivers.update', name: 'Editar choferes' },
      { key: 'fleet.drivers.delete', name: 'Desactivar choferes' },
      { key: 'fleet.catalogs.read', name: 'Ver catalogos de flota' },
      { key: 'fleet.catalogs.create', name: 'Crear catalogos de flota' },
      { key: 'fleet.catalogs.update', name: 'Editar catalogos de flota' },
      { key: 'fleet.catalogs.delete', name: 'Desactivar catalogos de flota' },
    ]
    for (const permission of fleetNewPermissions) {
      await prisma.permission.upsert({
        where: { key: permission.key },
        update: { name: permission.name, moduleId: fleetMod.id, moduleKey: 'custom.fleet', active: true },
        create: { key: permission.key, name: permission.name, moduleId: fleetMod.id, moduleKey: 'custom.fleet' },
      })
    }
    console.log('Fleet v0.2.0 permissions upserted (8)')
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

  console.log(`Atlas modules seeded (${officialModuleManifests.length})`)
}

main().finally(() => prisma.$disconnect())

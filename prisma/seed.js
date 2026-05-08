import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { coreModules } from '../packages/maps/src/core-modules.js'
import { getPermissionPresentation } from '../apps/api/src/permission-catalog.js'

const prisma = new PrismaClient()

async function upsertModule(manifest) {
  return prisma.atlasModule.upsert({
    where: { key: manifest.key },
    update: {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      kind: manifest.kind,
      core: manifest.core,
      uninstallable: manifest.uninstallable,
      enabled: true,
      manifest
    },
    create: {
      key: manifest.key,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      kind: manifest.kind,
      core: manifest.core,
      uninstallable: manifest.uninstallable,
      manifest
    }
  })
}

async function main() {
  for (const manifest of coreModules) {
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
          moduleId: module.id
        },
        create: {
          key: permission.key,
          name: presentation.name,
          description: presentation.description,
          moduleId: module.id
        }
      })
    }
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

  console.log('Atlas core modules seeded')
  console.log('Legacy role permissions can be expanded with: node scripts/migrate-legacy-permissions-to-granular.mjs --dry-run')
}

main().finally(() => prisma.$disconnect())

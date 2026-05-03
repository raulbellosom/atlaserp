import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { coreModules } from '../packages/maps/src/core-modules.js'

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
      await prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          name: permission.name,
          description: permission.description,
          moduleId: module.id
        },
        create: {
          key: permission.key,
          name: permission.name,
          description: permission.description,
          moduleId: module.id
        }
      })
    }
  }

  await prisma.role.upsert({
    where: { key: 'system.admin' },
    update: {},
    create: {
      key: 'system.admin',
      name: 'System Admin',
      description: 'Full system access',
      system: true
    }
  })

  console.log('Atlas core modules seeded')
}

main().finally(() => prisma.$disconnect())

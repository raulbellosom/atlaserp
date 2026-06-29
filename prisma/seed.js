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

  // Seed primary_company_id InstanceConfig (first company, idempotent)
  const firstCompany = await prisma.company.findFirst({ select: { id: true } })
  if (firstCompany) {
    await prisma.instanceConfig.upsert({
      where: { key: 'primary_company_id' },
      update: {},
      create: { key: 'primary_company_id', value: firstCompany.id },
    })
  }

  // Seed standard ledger transaction types for every company.
  // Types are now system-managed (read-only in UI); users cannot create new ones.
  // Wrapped in try-catch because ledger_transaction_type may not exist if the
  // module has never been synced (fresh install without ledger ORM migration).
  const LEDGER_DEFAULT_TYPES = [
    { code: 'DEP',   name: 'Deposito' },
    { code: 'CHQ',   name: 'Cheque' },
    { code: 'EFE',   name: 'Efectivo' },
    { code: 'TRANSF',name: 'Transferencia' },
    { code: 'SPEI',  name: 'SPEI' },
    { code: 'TC',    name: 'Tarjeta de credito' },
    { code: 'TD',    name: 'Tarjeta de debito' },
    { code: 'DOM',   name: 'Domiciliacion' },
    { code: 'OTRO',  name: 'Otro' },
  ]
  try {
    const allCompanies = await prisma.company.findMany({ select: { id: true } })
    for (const company of allCompanies) {
      for (const type of LEDGER_DEFAULT_TYPES) {
        await prisma.$executeRaw`
          INSERT INTO ledger_transaction_type (id, company_id, code, name, enabled, updated_at)
          SELECT gen_random_uuid(), ${company.id}::uuid, ${type.code}, ${type.name}, true, NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM ledger_transaction_type
            WHERE company_id = ${company.id}::uuid AND code = ${type.code}
          )
        `
      }
    }
    console.log(`Ledger types seeded for ${allCompanies.length} company(s)`)
  } catch {
    // Table doesn't exist yet — ledger module not synced, skip silently
  }

  // Seed system categories (owner_id = NULL) for every company.
  const LEDGER_SYSTEM_CATEGORIES = [
    { name: 'Alimentacion',    color: '#f59e0b', kind: 'expense' },
    { name: 'Transporte',      color: '#3b82f6', kind: 'expense' },
    { name: 'Renta',           color: '#8b5cf6', kind: 'expense' },
    { name: 'Servicios',       color: '#06b6d4', kind: 'expense' },
    { name: 'Salud',           color: '#ef4444', kind: 'expense' },
    { name: 'Entretenimiento', color: '#ec4899', kind: 'expense' },
    { name: 'Educacion',       color: '#6366f1', kind: 'expense' },
    { name: 'Ahorro',          color: '#10b981', kind: 'income'  },
    { name: 'Ingreso',         color: '#22c55e', kind: 'income'  },
    { name: 'Transferencia',   color: '#64748b', kind: 'both'    },
    { name: 'Otros',           color: '#94a3b8', kind: 'both'    },
  ]
  try {
    const allCompanies = await prisma.company.findMany({ select: { id: true } })
    for (const company of allCompanies) {
      for (const cat of LEDGER_SYSTEM_CATEGORIES) {
        await prisma.$executeRaw`
          INSERT INTO ledger_category (id, company_id, owner_id, name, color, kind, enabled, updated_at)
          SELECT gen_random_uuid(), ${company.id}::uuid, NULL, ${cat.name}, ${cat.color}, ${cat.kind}, true, NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM ledger_category
            WHERE company_id = ${company.id}::uuid AND name = ${cat.name} AND owner_id IS NULL
          )
        `
      }
    }
    console.log(`Ledger system categories seeded for ${allCompanies.length} company(s)`)
  } catch {
    // Table doesn't exist yet or migration not run — skip silently
  }

  console.log(`Atlas modules seeded (${officialModuleManifests.length})`)

  // ------------------------------------------------------------------
  // Chat message templates (default set per company)
  // ------------------------------------------------------------------
  const DEFAULT_CHAT_TEMPLATES = [
    {
      title: "Saludo de bienvenida",
      body: "Hola, bienvenido/a. Soy {nombre_agente} del equipo de soporte. ¿En que puedo ayudarte hoy?",
      tags: ["saludo", "bienvenida"],
    },
    {
      title: "Un momento por favor",
      body: "Entendido, dame un momento para revisar tu caso y darte la mejor respuesta.",
      tags: ["espera"],
    },
    {
      title: "Solicitar mas informacion",
      body: "Para ayudarte mejor, podrias indicarme: \n1. ¿Cual es el nombre de tu empresa o cuenta?\n2. ¿Que paso exactamente?\n3. ¿Desde cuando ocurre?\nGracias.",
      tags: ["soporte", "informacion"],
    },
    {
      title: "Transferir a otro agente",
      body: "Voy a transferirte con un especialista que podra ayudarte mejor en este caso. En un momento te atienden.",
      tags: ["transferencia"],
    },
    {
      title: "Cierre de conversacion",
      body: "Ha sido un placer ayudarte. Si tienes otra duda en el futuro, no dudes en escribirnos. Que tengas un excelente dia.",
      tags: ["cierre", "despedida"],
    },
    {
      title: "Problema tecnico - escalando",
      body: "Entiendo la situacion. Voy a escalar este caso a nuestro equipo tecnico para que lo revisen con prioridad. Te contactaremos a la brevedad.",
      tags: ["tecnico", "escalamiento"],
    },
    {
      title: "Cotizacion o precios",
      body: "Con gusto te ayudo con informacion sobre precios y planes. Para prepararte una propuesta personalizada, podrias indicarme: ¿cuantos usuarios necesitas y que funcionalidades son mas importantes para ti?",
      tags: ["ventas", "cotizacion"],
    },
    {
      title: "Agradecimiento por feedback",
      body: "Muchas gracias por compartir tu experiencia, nos ayuda a mejorar. Hemos registrado tu comentario para revisarlo con el equipo.",
      tags: ["feedback"],
    },
  ]

  try {
    const allCompanies = await prisma.company.findMany({ select: { id: true } })
    for (const company of allCompanies) {
      for (const tpl of DEFAULT_CHAT_TEMPLATES) {
        await prisma.$executeRaw`
          INSERT INTO chat_message_templates (company_id, title, body, tags, enabled)
          SELECT ${company.id}::uuid, ${tpl.title}, ${tpl.body}, ${tpl.tags}::text[], true
          WHERE NOT EXISTS (
            SELECT 1 FROM chat_message_templates
            WHERE company_id = ${company.id}::uuid AND title = ${tpl.title}
          )
        `
      }
    }
    console.log(`Chat templates seeded for ${allCompanies.length} company(s)`)
  } catch {
    // Table doesn't exist yet or migration not run — skip silently
  }
}

main().finally(() => prisma.$disconnect())

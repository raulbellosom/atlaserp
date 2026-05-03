import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { moduleInstallSchema, contactCreateSchema } from '@atlas/validators'
import { formatLogTimestamp, getConfiguredTimeZone } from '@atlas/core'

const prisma = new PrismaClient()
const app = new Hono()
const port = Number(process.env.ATLAS_API_PORT ?? 4010)

app.use('*', cors({
  origin: (origin) => origin || '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}))

app.get('/health', (c) => {
  const now = new Date()
  return c.json({
    ok: true,
    name: 'Atlas API',
    time: now.toISOString(),
    localTime: formatLogTimestamp(now),
    timeZone: getConfiguredTimeZone()
  })
})

app.get('/modules', async (c) => {
  const modules = await prisma.atlasModule.findMany({ orderBy: [{ core: 'desc' }, { name: 'asc' }] })
  return c.json({ data: modules })
})

app.post('/modules/install', async (c) => {
  const body = await c.req.json()
  const parsed = moduleInstallSchema.parse(body)
  const manifest = parsed.manifest

  const module = await prisma.atlasModule.upsert({
    where: { key: manifest.key },
    update: {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      kind: manifest.kind ?? 'FEATURE',
      core: manifest.core ?? false,
      uninstallable: manifest.uninstallable ?? true,
      status: 'INSTALLED',
      enabled: true,
      manifest
    },
    create: {
      key: manifest.key,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      kind: manifest.kind ?? 'FEATURE',
      core: manifest.core ?? false,
      uninstallable: manifest.uninstallable ?? true,
      manifest
    }
  })

  for (const permission of manifest.permissions ?? []) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { name: permission.name, description: permission.description, moduleId: module.id },
      create: { key: permission.key, name: permission.name, description: permission.description, moduleId: module.id }
    })
  }

  for (const blueprint of manifest.blueprints ?? []) {
    await prisma.blueprint.upsert({
      where: { key: blueprint.key },
      update: { moduleId: module.id, kind: blueprint.kind, version: blueprint.version, schema: blueprint.schema, enabled: true },
      create: { key: blueprint.key, moduleId: module.id, kind: blueprint.kind, version: blueprint.version, schema: blueprint.schema }
    })
  }

  return c.json({ data: module })
})

app.delete('/modules/:key', async (c) => {
  const key = c.req.param('key')
  const module = await prisma.atlasModule.findUnique({ where: { key } })
  if (!module) return c.json({ error: 'Module not found' }, 404)
  if (module.core || !module.uninstallable) return c.json({ error: 'Core modules cannot be uninstalled' }, 409)

  const updated = await prisma.atlasModule.update({
    where: { key },
    data: { status: 'UNINSTALLED', enabled: false }
  })
  return c.json({ data: updated })
})

app.get('/blueprints', async (c) => {
  const blueprints = await prisma.blueprint.findMany({ where: { enabled: true }, include: { module: true } })
  return c.json({ data: blueprints })
})

app.get('/contacts', async (c) => {
  const contacts = await prisma.contact.findMany({ where: { enabled: true }, orderBy: { createdAt: 'desc' } })
  return c.json({ data: contacts })
})

app.post('/contacts', async (c) => {
  const data = contactCreateSchema.parse(await c.req.json())
  const contact = await prisma.contact.create({ data })
  return c.json({ data: contact }, 201)
})

serve({ fetch: app.fetch, port })
console.log(`Atlas API running on http://localhost:${port}`)

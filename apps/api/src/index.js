import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { createClient } from '@supabase/supabase-js'
import { moduleInstallSchema, contactCreateSchema, setupInitializeSchema } from '@atlas/validators'
import { formatLogTimestamp, getConfiguredTimeZone } from '@atlas/core'

const prisma = new PrismaClient()
const app = new Hono()
const port = Number(process.env.ATLAS_API_PORT ?? 4010)

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

async function ensureBuckets() {
  await supabaseAdmin.storage.createBucket('atlas-branding', { public: false }).catch(() => {})
}
ensureBuckets()

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

app.get('/instance/status', async (c) => {
  try {
    const record = await prisma.instanceConfig.findUnique({ where: { key: 'initialized' } })
    return c.json({ initialized: record?.value === 'true' })
  } catch {
    return c.json({ error: 'Unable to read instance state' }, 503)
  }
})

app.post('/setup/initialize', async (c) => {
  try {
    const existing = await prisma.instanceConfig.findUnique({ where: { key: 'initialized' } })
    if (existing?.value === 'true') {
      return c.json({ error: 'Already initialized' }, 409)
    }

    const body = await c.req.parseBody()
    const fields = setupInitializeSchema.parse({
      adminFirstName: body.adminFirstName || undefined,
      adminLastName: body.adminLastName || undefined,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
      companyName: body.companyName,
      primaryColor: body.primaryColor,
      legalName: body.legalName || undefined,
      rfc: body.rfc || undefined,
      companyType: body.companyType || undefined,
      companyTypeName: body.companyTypeName || undefined,
      companySize: body.companySize || undefined,
      country: body.country || undefined,
      state: body.state || undefined,
      city: body.city || undefined,
      street: body.street || undefined,
      extNumber: body.extNumber || undefined,
      intNumber: body.intNumber || undefined,
      postalCode: body.postalCode || undefined,
    })

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: fields.adminEmail,
      password: fields.adminPassword,
      email_confirm: true
    })
    if (authError) return c.json({ error: authError.message }, 400)
    const authUserId = authData.user.id

    let logoUploadData = null
    const logoFile = body.logo
    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      if (logoFile.size > 2 * 1024 * 1024) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
        return c.json({ error: 'Logo must be under 2 MB' }, 400)
      }
      const slug = toSlug(fields.companyName)
      const ext = logoFile.name.split('.').pop() || 'png'
      const objectKey = `logos/${slug}.${ext}`
      const arrayBuffer = await logoFile.arrayBuffer()
      const { error: storageError } = await supabaseAdmin.storage
        .from('atlas-branding')
        .upload(objectKey, arrayBuffer, { contentType: logoFile.type, upsert: true })
      if (storageError) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
        return c.json({ error: 'Logo upload failed' }, 500)
      }
      logoUploadData = { bucket: 'atlas-branding', objectKey, originalName: logoFile.name, mimeType: logoFile.type, sizeBytes: logoFile.size }
    }

    try {
      const slug = toSlug(fields.companyName)
      const adminRole = await prisma.role.findFirst({ where: { key: 'atlas.admin' } })
      if (!adminRole) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
        return c.json({ error: 'Admin role not configured' }, 500)
      }
      const now = new Date().toISOString()

      await prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: fields.companyName,
            slug,
            legalName: fields.legalName,
            rfc: fields.rfc,
            companyType: fields.companyType,
            companyTypeName: fields.companyTypeName,
            companySize: fields.companySize,
            country: fields.country,
            state: fields.state,
            city: fields.city,
            street: fields.street,
            extNumber: fields.extNumber,
            intNumber: fields.intNumber,
            postalCode: fields.postalCode,
          }
        })
        const userProfile = await tx.userProfile.create({
          data: {
            authUserId,
            firstName: fields.adminFirstName,
            lastName: fields.adminLastName,
            displayName: `${fields.adminFirstName} ${fields.adminLastName}`.trim(),
            email: fields.adminEmail,
          }
        })
        await tx.membership.create({
          data: { companyId: company.id, userId: userProfile.id, roleId: adminRole.id }
        })
        let logoFileAssetId = null
        if (logoUploadData) {
          const fileAsset = await tx.fileAsset.create({
            data: { ...logoUploadData, moduleKey: 'atlas.branding', entityType: 'BrandingConfig' }
          })
          logoFileAssetId = fileAsset.id
        }
        await tx.brandingConfig.create({
          data: { companyId: company.id, primaryColor: fields.primaryColor, logoFileId: logoFileAssetId }
        })
        await tx.instanceConfig.upsert({
          where: { key: 'initialized' }, update: { value: 'true' }, create: { key: 'initialized', value: 'true' }
        })
        await tx.instanceConfig.upsert({
          where: { key: 'company_id' }, update: { value: company.id }, create: { key: 'company_id', value: company.id }
        })
        await tx.instanceConfig.upsert({
          where: { key: 'completed_at' }, update: { value: now }, create: { key: 'completed_at', value: now }
        })
      })

      return c.json({ ok: true })
    } catch (txError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
      throw txError
    }
  } catch (err) {
    if (err?.name === 'ZodError') return c.json({ error: err.errors?.[0]?.message ?? 'Validation error' }, 400)
    console.error('[setup/initialize]', err)
    return c.json({ error: 'Initialization failed' }, 500)
  }
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

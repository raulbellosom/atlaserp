import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { createClient } from '@supabase/supabase-js'
import { moduleInstallSchema, contactCreateSchema, setupInitializeSchema, notificationCreateSchema } from '@atlas/validators'
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

function translateSupabaseCreateUserError(error) {
  const msg = error?.message?.toLowerCase?.() ?? ''
  if (msg.includes('already') || msg.includes('registered') || msg.includes('duplicate')) {
    return 'Ya existe un usuario con ese correo electrónico.'
  }
  if (msg.includes('password')) {
    return 'La contraseña no cumple los requisitos de seguridad.'
  }
  return error?.message || 'No se pudo crear el usuario administrador en Supabase Auth.'
}

function mapSetupError(err) {
  if (err?.code === 'P2022') {
    return {
      status: 500,
      error: 'La base de datos está desactualizada. Ejecuta: pnpm db:migrate && pnpm db:seed'
    }
  }
  if (err?.code === 'P2002') {
    return {
      status: 409,
      error: 'Ya existe un registro con datos únicos duplicados (correo, slug o RFC).'
    }
  }
  if (err?.code === 'P1001' || err?.code === 'P1002') {
    return {
      status: 503,
      error: 'No se pudo conectar a PostgreSQL. Verifica la conexión de base de datos y vuelve a intentar.'
    }
  }
  return { status: 500, error: 'Error interno al inicializar la instancia.' }
}

async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return c.json({ error: 'Unauthorized' }, 401)
  c.set('authUserId', data.user.id)
  await next()
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
    const initialized = record?.value === 'true'

    if (!initialized) {
      return c.json({ initialized: false, branding: null })
    }

    const companyIdRecord = await prisma.instanceConfig.findUnique({ where: { key: 'company_id' } })
    const brandingConfig = companyIdRecord?.value
      ? await prisma.brandingConfig.findFirst({ where: { companyId: companyIdRecord.value } })
      : null

    let logoUrl = null
    if (brandingConfig?.logoFileId) {
      const fileAsset = await prisma.fileAsset.findUnique({ where: { id: brandingConfig.logoFileId } })
      if (fileAsset) {
        const { data: signedData } = await supabaseAdmin.storage
          .from(fileAsset.bucket)
          .createSignedUrl(fileAsset.objectKey, 3600)
        logoUrl = signedData?.signedUrl ?? null
      }
    }

    return c.json({
      initialized: true,
      branding: {
        primaryColor: brandingConfig?.primaryColor ?? '#6366f1',
        logoUrl
      }
    })
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
      companyIndustryKey: body.companyIndustryKey || undefined,
      companyIndustryName: body.companyIndustryName || undefined,
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
    if (authError) return c.json({ error: translateSupabaseCreateUserError(authError) }, 400)
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
      const adminRole = await prisma.role.findFirst({
        where: { key: { in: ['atlas.admin', 'system.admin'] }, enabled: true },
        orderBy: { key: 'asc' }
      })
      if (!adminRole) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
        return c.json({ error: 'No existe un rol administrador configurado (atlas.admin o system.admin).' }, 500)
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
            industryKey: fields.companyIndustryKey,
            industryName: fields.companyIndustryName,
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
    if (err?.name === 'ZodError') return c.json({ error: err.errors?.[0]?.message ?? 'Error de validación en el formulario.' }, 400)
    console.error('[setup/initialize]', err)
    const mapped = mapSetupError(err)
    return c.json({ error: mapped.error }, mapped.status)
  }
})

app.get('/user/me', authMiddleware, async (c) => {
  const authUserId = c.get('authUserId')
  try {
    const profile = await prisma.userProfile.findUnique({ where: { authUserId } })
    if (!profile) return c.json({ error: 'Profile not found' }, 404)
    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      include: { role: true }
    })
    return c.json({
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: profile.displayName,
      email: profile.email,
      role: membership?.role?.key ?? null
    })
  } catch {
    return c.json({ error: 'Internal server error' }, 500)
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

// --- Branding ---
app.get('/branding', authMiddleware, async (c) => {
  const authUserId = c.get('authUserId')
  try {
    const profile = await prisma.userProfile.findUnique({ where: { authUserId } })
    if (!profile) return c.json({ error: 'Profile not found' }, 404)
    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      include: { company: { include: { brandingConfig: true } } }
    })
    const branding = membership?.company?.brandingConfig ?? null
    let logoUrl = null
    if (branding?.logoFileId) {
      const fileAsset = await prisma.fileAsset.findUnique({ where: { id: branding.logoFileId } })
      if (fileAsset) {
        const { data: signedData } = await supabaseAdmin.storage
          .from(fileAsset.bucket)
          .createSignedUrl(fileAsset.objectKey, 3600)
        logoUrl = signedData?.signedUrl ?? null
      }
    }
    return c.json({
      primaryColor: branding?.primaryColor ?? '#6366f1',
      logoUrl,
      companyName: membership?.company?.name ?? null
    })
  } catch {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// --- Memberships ---
app.get('/memberships/me', authMiddleware, async (c) => {
  const authUserId = c.get('authUserId')
  try {
    const profile = await prisma.userProfile.findUnique({ where: { authUserId } })
    if (!profile) return c.json({ error: 'Profile not found' }, 404)
    const memberships = await prisma.membership.findMany({
      where: { userId: profile.id, enabled: true },
      include: { company: true, role: true }
    })
    const data = memberships.map((m) => ({
      id: m.id,
      companyId: m.companyId,
      companyName: m.company?.name ?? '',
      companySlug: m.company?.slug ?? '',
      role: m.role?.key ?? null,
      roleName: m.role?.name ?? null
    }))
    return c.json({ data })
  } catch {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// --- Notifications ---
app.get('/notifications', authMiddleware, async (c) => {
  const authUserId = c.get('authUserId')
  try {
    const profile = await prisma.userProfile.findUnique({ where: { authUserId } })
    if (!profile) return c.json({ error: 'Profile not found' }, 404)
    const unreadOnly = c.req.query('unreadOnly') === 'true'
    const notifications = await prisma.notification.findMany({
      where: { userId: profile.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    return c.json({ data: notifications })
  } catch {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

app.post('/notifications/:id/read', authMiddleware, async (c) => {
  const authUserId = c.get('authUserId')
  const id = c.req.param('id')
  try {
    const profile = await prisma.userProfile.findUnique({ where: { authUserId } })
    if (!profile) return c.json({ error: 'Profile not found' }, 404)
    await prisma.notification.updateMany({
      where: { id, userId: profile.id },
      data: { readAt: new Date() }
    })
    return c.json({ ok: true })
  } catch {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

app.post('/notifications/read-all', authMiddleware, async (c) => {
  const authUserId = c.get('authUserId')
  try {
    const profile = await prisma.userProfile.findUnique({ where: { authUserId } })
    if (!profile) return c.json({ error: 'Profile not found' }, 404)
    await prisma.notification.updateMany({
      where: { userId: profile.id, readAt: null },
      data: { readAt: new Date() }
    })
    return c.json({ ok: true })
  } catch {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Internal helper — usable from other services
export async function createNotification({ userId, companyId, kind = 'info', title, body, link } = {}) {
  return prisma.notification.create({ data: { userId, companyId, kind, title, body, link } })
}

serve({ fetch: app.fetch, port })
console.log(`Atlas API running on http://localhost:${port}`)

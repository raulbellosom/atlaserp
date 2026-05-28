import test from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import createInsuranceRouter from '../insurance-routes.js'

const COMPANY_ID = '11111111-1111-7111-a111-111111111111'

function buildPrismaStub() {
  let rawCalls = 0
  return {
    auditLog: { create: async () => ({ id: 'audit-1' }) },
    async $queryRaw() {
      rawCalls += 1
      if (rawCalls % 2 === 1) return []
      return [{ total: '0' }]
    },
    async $queryRawUnsafe() {
      return []
    },
  }
}

function buildRequirePermission(allowedKeys = []) {
  const allowed = new Set(allowedKeys)
  return (permissionKey) => async (c, next) => {
    if (!allowed.has(permissionKey)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  }
}

function createApp({ userContext, allowedPermissions = [] }) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userContext', userContext)
    await next()
  })
  app.route(
    '/',
    createInsuranceRouter({
      prisma: buildPrismaStub(),
      requirePermission: buildRequirePermission(allowedPermissions),
      moduleContext: { moduleKey: 'atlas.fleet' },
    })
  )
  return app
}

test('insurance-routes auth: denies list access without fleet.insurance.read', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [{ companyId: COMPANY_ID }],
    },
    allowedPermissions: [],
  })

  const response = await app.request('/fleet/insurance')
  assert.equal(response.status, 403)
})

test('insurance-routes auth: allows scoped list when fleet.insurance.read is present', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [{ companyId: COMPANY_ID }],
    },
    allowedPermissions: ['fleet.insurance.read'],
  })

  const response = await app.request('/fleet/insurance')
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.ok(Array.isArray(payload.data))
})

test('insurance-routes auth: denies create without fleet.insurance.create', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [{ companyId: COMPANY_ID }],
    },
    allowedPermissions: ['fleet.insurance.read'],
  })

  const response = await app.request('/fleet/insurance', { method: 'POST' })
  assert.equal(response.status, 403)
})

test('insurance-routes auth: denies detail access without fleet.insurance.read', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [{ companyId: COMPANY_ID }],
    },
    allowedPermissions: [],
  })

  const response = await app.request('/fleet/insurance/some-id')
  assert.equal(response.status, 403)
})

test('insurance-routes auth: allows vehicle insurance list with fleet.vehicles.read', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [{ companyId: COMPANY_ID }],
    },
    allowedPermissions: ['fleet.vehicles.read'],
  })

  const response = await app.request('/fleet/vehicles/some-vehicle-id/insurance')
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.ok(Array.isArray(payload.data))
})

test('insurance-routes auth: fail-closed when membership/company context is missing', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [],
    },
    allowedPermissions: ['fleet.insurance.read'],
  })

  const response = await app.request('/fleet/insurance')
  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.match(payload.error, /companyId es requerido/i)
})

test('insurance-routes auth: rejects legacy non-uuid companyId values', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [{ companyId: 'clx4w0abx000008l45m0z9r2a' }],
    },
    allowedPermissions: ['fleet.insurance.read'],
  })

  const response = await app.request('/fleet/insurance')
  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.match(payload.error, /companyId debe ser UUID valido/i)
})

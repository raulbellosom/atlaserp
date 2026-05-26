import test from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import createInsuranceRouter from '../insurance-routes.js'

const COMPANY_ID = '11111111-1111-7111-a111-111111111111'

function buildPrismaStub() {
  return {
    auditLog: { create: async () => ({ id: 'audit-1' }) },
    async $queryRaw() {
      return []
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
      moduleContext: { moduleKey: 'custom.fleet' },
    })
  )
  return app
}

const defaultUserContext = {
  profile: { id: 'actor-1' },
  memberships: [{ companyId: COMPANY_ID }],
}

test('insurance-routes auth: GET /fleet/insurance returns 403 without fleet.insurance.read', async () => {
  const app = createApp({
    userContext: defaultUserContext,
    allowedPermissions: [],
  })

  const response = await app.request('/fleet/insurance')
  assert.equal(response.status, 403)
})

test('insurance-routes auth: GET /fleet/insurance returns 200 with fleet.insurance.read', async () => {
  const app = createApp({
    userContext: defaultUserContext,
    allowedPermissions: ['fleet.insurance.read'],
  })

  const response = await app.request('/fleet/insurance')
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.ok(Array.isArray(payload.data))
})

test('insurance-routes auth: POST /fleet/insurance returns 403 without fleet.insurance.create', async () => {
  const app = createApp({
    userContext: defaultUserContext,
    allowedPermissions: ['fleet.insurance.read'],
  })

  const response = await app.request('/fleet/insurance', { method: 'POST' })
  assert.equal(response.status, 403)
})

test('insurance-routes auth: GET /fleet/insurance/:id returns 403 without fleet.insurance.read', async () => {
  const app = createApp({
    userContext: defaultUserContext,
    allowedPermissions: [],
  })

  const response = await app.request('/fleet/insurance/some-id')
  assert.equal(response.status, 403)
})

test('insurance-routes auth: GET /fleet/vehicles/:vehicleId/insurance returns 200 with fleet.vehicles.read', async () => {
  const app = createApp({
    userContext: defaultUserContext,
    allowedPermissions: ['fleet.vehicles.read'],
  })

  const response = await app.request('/fleet/vehicles/some-vehicle-id/insurance')
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.ok(Array.isArray(payload.data))
})

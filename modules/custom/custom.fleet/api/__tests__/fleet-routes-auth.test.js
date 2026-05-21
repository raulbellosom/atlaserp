import test from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import createFleetRouter from '../vehicles-routes.js'

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
    createFleetRouter({
      prisma: buildPrismaStub(),
      requirePermission: buildRequirePermission(allowedPermissions),
      moduleContext: { moduleKey: 'custom.fleet' },
    })
  )
  return app
}

test('fleet-routes auth: denies access without fleet permission (403)', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [{ companyId: 'company-a' }],
    },
    allowedPermissions: [],
  })

  const response = await app.request('/fleet/vehicles')
  assert.equal(response.status, 403)
})

test('fleet-routes auth: fail-closed when membership/company context is missing', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [],
    },
    allowedPermissions: ['fleet.vehicles.read'],
  })

  const response = await app.request('/fleet/vehicles')
  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.match(payload.error, /companyId es requerido/i)
})

test('fleet-routes auth: allows scoped read when permission and company context are present', async () => {
  const app = createApp({
    userContext: {
      profile: { id: 'actor-1' },
      memberships: [{ companyId: 'company-a' }],
    },
    allowedPermissions: ['fleet.vehicles.read'],
  })

  const response = await app.request('/fleet/vehicles')
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.ok(Array.isArray(payload.data))
  assert.equal(payload.pagination.total, 0)
})

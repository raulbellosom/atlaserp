import test from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import createFinanciaRouter from '../index.js'

const COMPANY_ID = '11111111-1111-7111-a111-111111111111'
const ACCOUNT_ID = '22222222-2222-7222-a222-222222222222'

const ACCOUNT_ROW = {
  id: ACCOUNT_ID, name: 'BBVA', bank: 'BBVA', currency: 'MXN',
  opening_balance: '0', company_id: COMPANY_ID, enabled: true, current_balance: '0',
}

function buildPrismaStub() {
  return {
    $queryRaw: async () => [ACCOUNT_ROW],
  }
}

function buildRequirePermission(allowedKeys = []) {
  const allowed = new Set(allowedKeys)
  return (permissionKey) => async (c, next) => {
    if (!allowed.has(permissionKey)) return c.json({ error: 'Forbidden' }, 403)
    await next()
  }
}

function createApp({ allowedPermissions = [] } = {}) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userContext', { profile: { id: 'actor-1' }, memberships: [{ companyId: COMPANY_ID }] })
    await next()
  })
  app.route('/', createFinanciaRouter({
    prisma: buildPrismaStub(),
    requirePermission: buildRequirePermission(allowedPermissions),
    moduleContext: { moduleKey: 'custom.financia' },
  }))
  return app
}

test('financia-routes auth: GET /financia/accounts returns 403 without permission', async () => {
  const app = createApp({ allowedPermissions: [] })
  const res = await app.request('/financia/accounts')
  assert.equal(res.status, 403)
})

test('financia-routes auth: GET /financia/accounts returns 200 with permission', async () => {
  const app = createApp({ allowedPermissions: ['financia.accounts.read'] })
  const res = await app.request('/financia/accounts')
  assert.equal(res.status, 200)
})

test('financia-routes auth: GET /financia/types returns 403 without permission', async () => {
  const app = createApp({ allowedPermissions: [] })
  const res = await app.request('/financia/types')
  assert.equal(res.status, 403)
})

test('financia-routes auth: GET /financia/types returns 200 with permission', async () => {
  const app = createApp({ allowedPermissions: ['financia.types.manage'] })
  const res = await app.request('/financia/types')
  assert.equal(res.status, 200)
})

test('financia-routes auth: GET /financia/categories returns 403 without permission', async () => {
  const app = createApp({ allowedPermissions: [] })
  const res = await app.request('/financia/categories')
  assert.equal(res.status, 403)
})

test('financia-routes auth: GET /financia/categories returns 200 with permission', async () => {
  const app = createApp({ allowedPermissions: ['financia.categories.manage'] })
  const res = await app.request('/financia/categories')
  assert.equal(res.status, 200)
})

test('financia-routes auth: GET transactions returns 403 without transactions.read', async () => {
  const app = createApp({ allowedPermissions: ['financia.accounts.read'] })
  const res = await app.request(`/financia/accounts/${ACCOUNT_ID}/transactions`)
  assert.equal(res.status, 403)
})

test('financia-routes auth: GET export/csv returns 403 without export permission', async () => {
  const app = createApp({ allowedPermissions: ['financia.accounts.read', 'financia.transactions.read'] })
  const res = await app.request(`/financia/accounts/${ACCOUNT_ID}/export/csv`)
  assert.equal(res.status, 403)
})

test('financia-routes auth: POST import/preview returns 403 without import permission', async () => {
  const app = createApp({ allowedPermissions: ['financia.accounts.read'] })
  const res = await app.request(`/financia/accounts/${ACCOUNT_ID}/import/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: [], mapping: {} }),
  })
  assert.equal(res.status, 403)
})

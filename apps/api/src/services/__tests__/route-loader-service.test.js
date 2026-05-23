import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRouteLoaderService } from '../route-loader-service.js'

async function writeModuleApi(projectRoot, moduleKey, routePath) {
  const moduleDir = path.join(projectRoot, 'modules', 'custom', moduleKey, 'api')
  await fs.mkdir(moduleDir, { recursive: true })
  const filePath = path.join(moduleDir, 'index.js')
  const content = `
export default function createRouter() {
  return {
    routes: [{ method: 'GET', path: '${routePath}' }],
    router: {
      match(method, requestPath) {
        const isMatch = method === 'GET' && requestPath === '${routePath}'
        return [isMatch ? [{}] : []]
      },
    },
    fetch() {
      return new Response(JSON.stringify({ ok: true, moduleKey: '${moduleKey}' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  }
}
`
  await fs.writeFile(filePath, content, 'utf8')
}

function createPrismaMock(modules) {
  const moduleMap = new Map(modules.map((row) => [row.key, { ...row }]))

  return {
    atlasModule: {
      async findUnique({ where, select }) {
        const row = moduleMap.get(where.key)
        if (!row) return null
        if (!select) return { ...row }
        const selected = {}
        for (const key of Object.keys(select)) {
          if (select[key]) selected[key] = row[key]
        }
        return selected
      },
      async findMany({ where }) {
        const rows = [...moduleMap.values()]
        return rows.filter((row) => {
          if (where?.status && row.status !== where.status) return false
          if (typeof where?.enabled === 'boolean' && row.enabled !== where.enabled) return false
          if (where?.key?.in && !where.key.in.includes(row.key)) return false
          return true
        })
      },
      async update({ where, data }) {
        const current = moduleMap.get(where.key)
        if (!current) throw new Error('module not found')
        const next = { ...current, ...data }
        moduleMap.set(where.key, next)
        return next
      },
    },
  }
}

test('route-loader keeps first module route and flags collision on subsequent module', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-route-loader-'))
  await fs.writeFile(path.join(projectRoot, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n', 'utf8')
  await fs.writeFile(path.join(projectRoot, 'package.json'), '{"name":"tmp","type":"module"}', 'utf8')
  await fs.mkdir(path.join(projectRoot, 'modules', 'official'), { recursive: true })

  await writeModuleApi(projectRoot, 'custom.alpha', '/fleet/vehicles')
  await writeModuleApi(projectRoot, 'custom.beta', '/fleet/vehicles')

  const prisma = createPrismaMock([
    {
      key: 'custom.alpha',
      status: 'INSTALLED',
      enabled: true,
      manifest: { key: 'custom.alpha' },
      lifecycleConfig: { discovery: { localPath: 'modules/custom/custom.alpha' } },
      core: false,
    },
    {
      key: 'custom.beta',
      status: 'INSTALLED',
      enabled: true,
      manifest: { key: 'custom.beta' },
      lifecycleConfig: { discovery: { localPath: 'modules/custom/custom.beta' } },
      core: false,
    },
  ])

  const previousRoot = process.env.ATLAS_PROJECT_ROOT
  process.env.ATLAS_PROJECT_ROOT = projectRoot

  const routeLoader = createRouteLoaderService({
    prisma,
    authMiddleware: async (_c, next) => next(),
    requirePermission: () => async (_c, next) => next(),
  })

  const first = await routeLoader.reloadModule('custom.alpha')
  assert.equal(first.loaded, true)

  const second = await routeLoader.reloadModule('custom.beta')
  assert.equal(second.loaded, false)
  assert.equal(second.reason, 'route_collision')
  assert.equal(second.collision?.conflictingModuleKey, 'custom.alpha')
  assert.equal(second.collision?.method, 'GET')
  assert.equal(second.collision?.path, '/fleet/vehicles')

  const status = routeLoader.getModuleRouteStatus('custom.beta')
  assert.equal(status?.status, 'ERROR')
  assert.equal(status?.collision?.code, 'ROUTE_COLLISION')

  if (typeof previousRoot === 'string') {
    process.env.ATLAS_PROJECT_ROOT = previousRoot
  } else {
    delete process.env.ATLAS_PROJECT_ROOT
  }
  await fs.rm(projectRoot, { recursive: true, force: true })
})

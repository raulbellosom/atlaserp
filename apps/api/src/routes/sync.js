import { Hono } from 'hono'
import { createSyncService, SyncServiceError } from '../services/sync-service.js'
import { createSyncPushService } from '../services/sync-push-service.js'

export function createSyncRouter({ prisma }) {
  const app = new Hono()
  const service = createSyncService({ prisma })
  const pushService = createSyncPushService({ prisma })

  function handleError(c, err, scope) {
    if (err instanceof SyncServiceError) {
      return c.json({ error: err.message, code: err.code }, err.status)
    }
    console.error(`[${scope}]`, err?.message ?? err)
    return c.json({ error: 'Error interno' }, 500)
  }

  // GET /sync/pull?modules=atlas.contacts,atlas.hr&cursor=ISO-timestamp
  app.get('/sync/pull', async (c) => {
    try {
      const authUserId = c.get('authUserId')
      const modulesParam = c.req.query('modules') ?? ''
      const cursor = c.req.query('cursor') ?? null
      const modules = modulesParam
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
      const result = await service.pull({ authUserId, modules, cursor })
      return c.json(result)
    } catch (err) {
      return handleError(c, err, 'GET /sync/pull')
    }
  })

  // GET /sync/status — returns stored SyncCursor rows for the current company
  app.get('/sync/status', async (c) => {
    try {
      const authUserId = c.get('authUserId')
      const result = await service.getStatus({ authUserId })
      return c.json({ cursors: result })
    } catch (err) {
      return handleError(c, err, 'GET /sync/status')
    }
  })

  // POST /sync/push — apply a batch of offline mutations
  app.post('/sync/push', async (c) => {
    try {
      const authUserId = c.get('authUserId')
      const body = await c.req.json()
      const mutations = Array.isArray(body?.mutations) ? body.mutations : []
      const result = await pushService.push({ authUserId, mutations })
      return c.json(result)
    } catch (err) {
      return handleError(c, err, 'POST /sync/push')
    }
  })

  return app
}

import { Hono } from 'hono'
import { createSyncService, SyncServiceError } from '../services/sync-service.js'
import { createSyncPushService } from '../services/sync-push-service.js'

// resolveTenantContext: the same X-Atlas-Company-Id-validating resolver
// requirePermission/requireAnyPermission use, injected rather than imported
// (index.js imports this router — importing back from index.js would be
// circular). None of these routes carry a single natural permission gate
// (sync pulls/pushes across arbitrary modules at once), so they call it
// directly instead of going through requirePermission. Strict: sync must
// know exactly which company it's syncing — unlike a bootstrap endpoint,
// there's no safe "ambiguous" default for a multi-company user's offline data.
// See docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §5.
export function createSyncRouter({ prisma, getUserContext, resolveTenantContext }) {
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

  async function resolveCompanyId(c) {
    const context = await getUserContext(c)
    if (!context?.profile) {
      return { error: c.json({ error: 'No autorizado. Perfil de usuario no encontrado.' }, 401) }
    }
    const resolved = await resolveTenantContext(c, context)
    if (!resolved.ok) return { error: resolved.response }
    return { companyId: resolved.tenant.companyId }
  }

  // GET /sync/pull?modules=atlas.contacts,atlas.hr&cursor=ISO-timestamp
  app.get('/sync/pull', async (c) => {
    try {
      const authUserId = c.get('authUserId')
      const { companyId, error } = await resolveCompanyId(c)
      if (error) return error
      const modulesParam = c.req.query('modules') ?? ''
      const cursor = c.req.query('cursor') ?? null
      const modules = modulesParam
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
      const result = await service.pull({ authUserId, companyId, modules, cursor })
      return c.json(result)
    } catch (err) {
      return handleError(c, err, 'GET /sync/pull')
    }
  })

  // GET /sync/status — returns stored SyncCursor rows for the current company
  app.get('/sync/status', async (c) => {
    try {
      const authUserId = c.get('authUserId')
      const { companyId, error } = await resolveCompanyId(c)
      if (error) return error
      const result = await service.getStatus({ authUserId, companyId })
      return c.json({ cursors: result })
    } catch (err) {
      return handleError(c, err, 'GET /sync/status')
    }
  })

  // POST /sync/push — apply a batch of offline mutations
  app.post('/sync/push', async (c) => {
    try {
      const authUserId = c.get('authUserId')
      const { companyId, error } = await resolveCompanyId(c)
      if (error) return error
      const body = await c.req.json()
      const mutations = Array.isArray(body?.mutations) ? body.mutations : []
      const result = await pushService.push({ authUserId, companyId, mutations })
      return c.json(result)
    } catch (err) {
      return handleError(c, err, 'POST /sync/push')
    }
  })

  return app
}

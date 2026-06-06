import { MutationQueue } from './mutation-queue.js'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH'])

// Maps API path patterns to module metadata.
// Patterns with ID must come before patterns without ID (more specific first).
const ROUTE_MAP = [
  // atlas.contacts
  { pattern: /^\/contacts\/([^/?#]+)$/, moduleKey: 'atlas.contacts', entityType: 'contact', hasId: true },
  { pattern: /^\/contacts$/, moduleKey: 'atlas.contacts', entityType: 'contact', hasId: false },
  // atlas.hr — departments
  { pattern: /^\/hr\/departments\/([^/?#]+)$/, moduleKey: 'atlas.hr', entityType: 'department', hasId: true },
  { pattern: /^\/hr\/departments$/, moduleKey: 'atlas.hr', entityType: 'department', hasId: false },
  // atlas.hr — job-titles
  { pattern: /^\/hr\/job-titles\/([^/?#]+)$/, moduleKey: 'atlas.hr', entityType: 'job_title', hasId: true },
  { pattern: /^\/hr\/job-titles$/, moduleKey: 'atlas.hr', entityType: 'job_title', hasId: false },
  // atlas.hr — employees
  { pattern: /^\/hr\/employees\/([^/?#]+)$/, moduleKey: 'atlas.hr', entityType: 'employee', hasId: true },
  { pattern: /^\/hr\/employees$/, moduleKey: 'atlas.hr', entityType: 'employee', hasId: false },
  // custom.fleet — vehicles
  { pattern: /^\/fleet\/vehicles\/([^/?#]+)$/, moduleKey: 'custom.fleet', entityType: 'vehicle', hasId: true },
  { pattern: /^\/fleet\/vehicles$/, moduleKey: 'custom.fleet', entityType: 'vehicle', hasId: false },
  // custom.fleet — drivers
  { pattern: /^\/fleet\/drivers\/([^/?#]+)$/, moduleKey: 'custom.fleet', entityType: 'driver', hasId: true },
  { pattern: /^\/fleet\/drivers$/, moduleKey: 'custom.fleet', entityType: 'driver', hasId: false },
]

export function parseMutationRoute(path, method) {
  const upperMethod = (method ?? 'GET').toUpperCase()
  // Strip query string and trailing slash before matching
  const cleanPath = path.split('?')[0].replace(/\/+$/, '')
  for (const route of ROUTE_MAP) {
    const match = cleanPath.match(route.pattern)
    if (!match) continue
    const recordId = route.hasId ? match[1] : null
    const operation = upperMethod === 'POST' ? 'CREATE' : 'UPDATE'
    return { moduleKey: route.moduleKey, entityType: route.entityType, operation, recordId }
  }
  return null
}

export function createOfflineTransport({ db, getSession }) {
  const mutationQueue = new MutationQueue({ db })

  async function queue(path, options) {
    const method = (options?.method ?? 'GET').toUpperCase()
    if (!MUTATION_METHODS.has(method)) return null

    const parsed = parseMutationRoute(path, method)
    if (!parsed) return null

    const { moduleKey, entityType, operation, recordId } = parsed
    const session = await getSession()

    let payload = {}
    if (options?.body) {
      try {
        payload = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
      } catch {
        payload = {}
      }
    }

    const id = crypto.randomUUID()
    const idempotencyKey = crypto.randomUUID()

    await mutationQueue.enqueue({
      id,
      idempotencyKey,
      moduleKey,
      entityType,
      recordId,
      operation,
      payload,
      companyId: session?.companyId ?? null,
      userId: session?.userProfile?.id ?? null,
    })

    // Optimistic update: apply the change to offline_records immediately
    if (operation === 'UPDATE' && recordId) {
      const existing = await db.offline_records.get([moduleKey, entityType, recordId])
      if (existing) {
        await db.offline_records.put({ ...existing, data: { ...existing.data, ...payload }, dirty: true })
      }
    } else if (operation === 'CREATE') {
      const localId = recordId ?? id
      await db.offline_records.put({
        moduleKey,
        entityType,
        id: localId,
        data: { id: localId, companyId: session?.companyId ?? null, ...payload },
        version: new Date().toISOString(),
        pulledAt: new Date().toISOString(),
        companyId: session?.companyId ?? null,
        dirty: true,
      })
    }

    return { queued: true, id }
  }

  return { queue, mutationQueue }
}

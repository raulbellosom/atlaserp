export class SyncServiceError extends Error {
  constructor(message, status = 500, code = 'sync_error') {
    super(message)
    this.name = 'SyncServiceError'
    this.status = status
    this.code = code
  }
}

const RECORDS_LIMIT = 500

function makeHandler(entityType, prismaKey) {
  return {
    entityType,
    async fetch({ prisma, companyId, cursor, limit }) {
      const where = { companyId }
      if (cursor) where.updatedAt = { gt: new Date(cursor) }
      return prisma[prismaKey].findMany({
        where,
        take: limit,
        orderBy: { updatedAt: 'asc' },
      })
    },
    toRecord(row) {
      return {
        id: row.id,
        data: row,
        version: row.updatedAt.toISOString(),
        deleted: false,
      }
    },
  }
}

const SYNC_MODULE_REGISTRY = {
  'atlas.contacts': {
    handlers: [makeHandler('contact', 'contact')],
  },
  'atlas.hr': {
    handlers: [
      makeHandler('employee', 'hrEmployee'),
      makeHandler('department', 'hrDepartment'),
      makeHandler('job_title', 'hrJobTitle'),
    ],
  },
  'custom.fleet': {
    handlers: [
      makeHandler('vehicle', 'fleetVehicle'),
      makeHandler('driver', 'fleetDriver'),
    ],
  },
  'atlas.calendar': {
    handlers: [
      {
        entityType: 'calendar',
        async fetch({ prisma, userId, cursor, limit }) {
          const where = { ownerId: userId, enabled: true }
          if (cursor) where.updatedAt = { gt: new Date(cursor) }
          return prisma.calendarCalendar.findMany({
            where,
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        },
        toRecord(row) {
          return { id: row.id, data: row, version: row.updatedAt.toISOString(), deleted: false }
        },
      },
      {
        entityType: 'event',
        async fetch({ prisma, userId, cursor, limit }) {
          const owned = await prisma.calendarCalendar.findMany({
            where: { ownerId: userId, enabled: true },
            select: { id: true },
          })
          const calendarIds = owned.map((c) => c.id)
          if (!calendarIds.length) return []
          const where = { calendarId: { in: calendarIds }, enabled: true }
          if (cursor) where.updatedAt = { gt: new Date(cursor) }
          return prisma.calendarEvent.findMany({
            where,
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        },
        toRecord(row) {
          return { id: row.id, data: row, version: row.updatedAt.toISOString(), deleted: false }
        },
      },
    ],
  },
}

export function createSyncService({ prisma }) {
  async function resolveCompanyContext(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    })
    if (!profile) {
      throw new SyncServiceError('Perfil de usuario no encontrado.', 404, 'profile_not_found')
    }
    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      orderBy: { createdAt: 'desc' },
      select: { companyId: true },
    })
    if (!membership?.companyId) {
      throw new SyncServiceError('No tienes una empresa activa.', 403, 'no_active_company')
    }
    return { companyId: membership.companyId, userId: profile.id }
  }

  async function pull({ authUserId, modules, cursor }) {
    if (!modules || modules.length === 0) {
      return { records: [], nextCursor: cursor ?? null, hasMore: false }
    }

    const { companyId, userId } = await resolveCompanyContext(authUserId)
    const records = []
    let hasMore = false

    for (const moduleKey of modules) {
      const mod = SYNC_MODULE_REGISTRY[moduleKey]
      if (!mod) continue
      for (const handler of mod.handlers) {
        const rows = await handler.fetch({ prisma, companyId, userId, cursor, limit: RECORDS_LIMIT + 1 })
        if (rows.length > RECORDS_LIMIT) {
          hasMore = true
          rows.splice(RECORDS_LIMIT)
        }
        for (const row of rows) {
          records.push({ moduleKey, entityType: handler.entityType, ...handler.toRecord(row) })
        }
      }
    }

    const nextCursor =
      records.length > 0
        ? records.reduce((max, r) => (r.version > max ? r.version : max), records[0].version)
        : cursor ?? null

    return { records, nextCursor, hasMore }
  }

  async function getStatus({ authUserId }) {
    const { companyId } = await resolveCompanyContext(authUserId)
    const cursors = await prisma.syncCursor.findMany({
      where: { companyId },
      orderBy: [{ moduleKey: 'asc' }, { entityType: 'asc' }],
    })
    return cursors.map((c) => ({
      moduleKey: c.moduleKey,
      entityType: c.entityType,
      cursor: c.cursor.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  }

  return { pull, getStatus }
}

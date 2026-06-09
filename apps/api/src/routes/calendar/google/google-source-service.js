import { CalendarServiceError } from '../calendar-service.js'

function normalizeCalendarName(calendar) {
  return calendar?.summary?.trim() || 'Calendario de Google'
}

function buildSourcePayload({ connectionId, atlasCalendarId, calendar, syncStatus }) {
  return {
    connectionId,
    googleCalendarId: calendar.id,
    googleCalendarName: normalizeCalendarName(calendar),
    googleCalendarTimeZone: calendar.timeZone ?? null,
    atlasCalendarId,
    enabled: true,
    syncStatus,
  }
}

function buildSourceUpdatePayload({ connectionId, atlasCalendarId, calendar, syncStatus }) {
  return {
    connectionId,
    googleCalendarId: calendar.id,
    googleCalendarName: normalizeCalendarName(calendar),
    googleCalendarTimeZone: calendar.timeZone ?? null,
    atlasCalendarId,
    enabled: true,
    syncStatus,
    lastErrorAt: null,
    lastErrorMessage: null,
  }
}

export function createGoogleCalendarSourceService({ prisma }) {
  async function listSourcesForConnection(connectionId) {
    return prisma.googleCalendarSource.findMany({
      where: { connectionId, enabled: true },
      orderBy: [{ createdAt: 'asc' }],
    })
  }

  async function saveSelectedSources({ connectionId, ownerId, calendars }) {
    if (!Array.isArray(calendars) || calendars.length === 0) {
      throw new CalendarServiceError('Debes seleccionar al menos un calendario de Google.', 400)
    }

    const uniqueCalendars = []
    const seenCalendarIds = new Set()

    for (const calendar of calendars) {
      const calendarId = typeof calendar?.id === 'string' ? calendar.id.trim() : ''

      if (!calendarId) {
        throw new CalendarServiceError('Cada calendario de Google debe incluir un id valido.', 400)
      }

      if (seenCalendarIds.has(calendarId)) {
        continue
      }

      seenCalendarIds.add(calendarId)
      uniqueCalendars.push({ ...calendar, id: calendarId })
    }

    return prisma.$transaction(async (tx) => {
      const existingSources = await tx.googleCalendarSource.findMany({
        where: { connectionId },
      })
      const existingByGoogleCalendarId = new Map(
        existingSources.map((source) => [source.googleCalendarId, source])
      )
      const selectedIds = uniqueCalendars.map((calendar) => calendar.id)
      const omittedIds = existingSources
        .filter((source) => source.enabled && !selectedIds.includes(source.googleCalendarId))
        .map((source) => source.googleCalendarId)

      if (omittedIds.length > 0) {
        await tx.googleCalendarSource.updateMany({
          where: {
            connectionId,
            googleCalendarId: { in: omittedIds },
          },
          data: {
            enabled: false,
            syncStatus: 'DISABLED',
          },
        })
      }

      const items = []
      const importTargets = []

      for (const calendar of uniqueCalendars) {
        const existingSource = existingByGoogleCalendarId.get(calendar.id)
        const shouldImport = !existingSource || existingSource.syncStatus !== 'ACTIVE'
        let atlasCalendarId = existingSource?.atlasCalendarId
        let syncStatus = existingSource?.syncStatus === 'ACTIVE'
          ? 'ACTIVE'
          : 'PENDING_INITIAL_SYNC'

        if (!atlasCalendarId) {
          const atlasCalendar = await tx.calendarCalendar.create({
            data: {
              ownerId,
              name: normalizeCalendarName(calendar),
              color: calendar.backgroundColor ?? '#1a73e8',
              icon: 'Google',
            },
          })
          atlasCalendarId = atlasCalendar.id
        }

        const createPayload = buildSourcePayload({
          connectionId,
          atlasCalendarId,
          calendar,
          syncStatus,
        })
        const updatePayload = buildSourceUpdatePayload({
          connectionId,
          atlasCalendarId,
          calendar,
          syncStatus,
        })

        const source = await tx.googleCalendarSource.upsert({
          where: {
            connectionId_googleCalendarId: {
              connectionId,
              googleCalendarId: calendar.id,
            },
          },
          create: createPayload,
          update: updatePayload,
        })

        items.push(source)

        if (shouldImport) {
          importTargets.push(source)
        }
      }

      return { items, importTargets }
    })
  }

  async function disableSourcesForConnection(connectionId) {
    return prisma.googleCalendarSource.updateMany({
      where: {
        connectionId,
        enabled: true,
      },
      data: {
        enabled: false,
        syncStatus: 'DISABLED',
      },
    })
  }

  return {
    listSourcesForConnection,
    saveSelectedSources,
    disableSourcesForConnection,
  }
}

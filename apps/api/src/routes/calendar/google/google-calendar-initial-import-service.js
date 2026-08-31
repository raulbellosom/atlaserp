// How often (in processed events) the running progress is persisted to the
// DB while importing. Writing on every single event would double the DB
// round-trips of a large import for marginal UI benefit; this still updates
// often enough to feel live for anyone polling the source list.
const PROGRESS_PERSIST_EVERY = 5

export function createGoogleCalendarInitialImportService({
  prisma,
  eventsService,
  linkService,
}) {
  async function updateSourceStatus(sourceId, data) {
    return prisma.googleCalendarSource.update({
      where: { id: sourceId },
      data,
    })
  }

  async function importSource({ source, accessToken }) {
    await updateSourceStatus(source.id, {
      syncStatus: 'SYNCING',
      lastErrorAt: null,
      lastErrorMessage: null,
      importTotalEvents: null,
      importProcessedEvents: 0,
    })

    try {
      const googleEvents = await eventsService.listAllEvents({
        accessToken,
        calendarId: source.googleCalendarId,
        onPage: async ({ totalSoFar }) => {
          await updateSourceStatus(source.id, { importTotalEvents: totalSoFar })
        },
      })

      let processed = 0
      for (const googleEvent of googleEvents) {
        await linkService.upsertImportedEvent({ source, googleEvent })
        processed += 1

        if (processed % PROGRESS_PERSIST_EVERY === 0 || processed === googleEvents.length) {
          await updateSourceStatus(source.id, { importProcessedEvents: processed })
        }
      }

      await updateSourceStatus(source.id, {
        syncStatus: 'ACTIVE',
        lastFullSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
        importTotalEvents: googleEvents.length,
        importProcessedEvents: googleEvents.length,
      })
    } catch (error) {
      await updateSourceStatus(source.id, {
        syncStatus: 'ERROR',
        lastErrorAt: new Date(),
        lastErrorMessage: error?.message ?? 'Google initial import failed.',
      })
      throw error
    }
  }

  async function markSourceError(sourceId, error) {
    return updateSourceStatus(sourceId, {
      syncStatus: 'ERROR',
      lastErrorAt: new Date(),
      lastErrorMessage: error?.message ?? 'Google initial import failed.',
    })
  }

  return {
    importSource,
    markSourceError,
  }
}

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
    })

    try {
      const googleEvents = await eventsService.listAllEvents({
        accessToken,
        calendarId: source.googleCalendarId,
      })

      for (const googleEvent of googleEvents) {
        await linkService.upsertImportedEvent({ source, googleEvent })
      }

      await updateSourceStatus(source.id, {
        syncStatus: 'ACTIVE',
        lastFullSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
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

  return {
    importSource,
  }
}

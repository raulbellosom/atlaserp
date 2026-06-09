const ALL_DAY_UTC_NOON_SUFFIX = 'T12:00:00.000Z'

function parseGoogleDateValue(value) {
  if (!value) return null

  if (value.dateTime) {
    return new Date(value.dateTime)
  }

  if (value.date) {
    return new Date(`${value.date}${ALL_DAY_UTC_NOON_SUFFIX}`)
  }

  return null
}

function normalizeText(value) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed || null
}

function normalizeTitle(value) {
  return normalizeText(value) ?? 'Evento de Google'
}

function buildCalendarEventPayload({ source, googleEvent }) {
  return {
    calendarId: source.atlasCalendarId,
    title: normalizeTitle(googleEvent.summary),
    description: normalizeText(googleEvent.description),
    startAt: parseGoogleDateValue(googleEvent.start),
    endAt: parseGoogleDateValue(googleEvent.end),
    allDay: Boolean(googleEvent.start?.date && !googleEvent.start?.dateTime),
    location: normalizeText(googleEvent.location),
  }
}

function buildGoogleLinkPayload({ source, googleEvent, lastSeenAt }) {
  const googleUpdatedAt = googleEvent.updated ? new Date(googleEvent.updated) : null

  return {
    sourceId: source.id,
    googleEventId: googleEvent.id,
    googleICalUID: googleEvent.iCalUID ?? null,
    googleRecurringEventId: googleEvent.recurringEventId ?? null,
    googleOriginalStartAt: parseGoogleDateValue(googleEvent.originalStartTime),
    googleUpdatedAt,
    googleStatus: googleEvent.status ?? null,
    cancelledInGoogleAt: googleEvent.status === 'cancelled'
      ? (googleUpdatedAt ?? lastSeenAt)
      : null,
    lastSeenAt,
    rawSnapshot: googleEvent,
  }
}

export function createGoogleCalendarEventLinkService({ prisma }) {
  async function upsertImportedEvent({ source, googleEvent }) {
    return prisma.$transaction(async (tx) => {
      const existingLink = await tx.googleCalendarEventLink.findUnique({
        where: {
          sourceId_googleEventId: {
            sourceId: source.id,
            googleEventId: googleEvent.id,
          },
        },
      })

      const lastSeenAt = new Date()
      const linkPayload = buildGoogleLinkPayload({ source, googleEvent, lastSeenAt })

      if (existingLink?.isDetached) {
        const link = await tx.googleCalendarEventLink.update({
          where: { id: existingLink.id },
          data: linkPayload,
        })

        return {
          atlasEvent: null,
          link,
          mode: 'detached',
        }
      }

      const eventPayload = buildCalendarEventPayload({ source, googleEvent })

      if (!existingLink) {
        const atlasEvent = await tx.calendarEvent.create({
          data: eventPayload,
        })
        const link = await tx.googleCalendarEventLink.create({
          data: {
            ...linkPayload,
            atlasEventId: atlasEvent.id,
          },
        })

        return {
          atlasEvent,
          link,
          mode: 'created',
        }
      }

      const atlasEvent = await tx.calendarEvent.update({
        where: { id: existingLink.atlasEventId },
        data: eventPayload,
      })
      const link = await tx.googleCalendarEventLink.update({
        where: { id: existingLink.id },
        data: linkPayload,
      })

      return {
        atlasEvent,
        link,
        mode: 'updated',
      }
    })
  }

  return {
    upsertImportedEvent,
  }
}

const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars'

function createGoogleError(message, response, payload) {
  const details = payload instanceof Error
    ? payload.message
    : payload && typeof payload === 'object'
      ? payload.error?.message ?? payload.error_description ?? payload.error ?? null
      : null
  const suffix = details ? ` ${details}` : ''
  const error = new Error(`${message}${suffix}`)

  if (response) {
    error.status = response.status
  }

  if (payload !== undefined) {
    error.payload = payload
  }

  return error
}

async function readJsonResponse(response, message) {
  let payload

  try {
    payload = await response.json()
  } catch {
    throw createGoogleError(message, response)
  }

  if (!response.ok) {
    throw createGoogleError(message, response, payload)
  }

  return payload
}

export function createGoogleCalendarEventsService({ fetchImpl = fetch }) {
  async function listAllEvents({ accessToken, calendarId }) {
    const items = []
    let pageToken = null

    do {
      const params = new URLSearchParams({
        singleEvents: 'true',
        showDeleted: 'true',
        maxResults: '2500',
      })

      if (pageToken) {
        params.set('pageToken', pageToken)
      }

      let response

      try {
        response = await fetchImpl(
          `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )
      } catch (error) {
        throw createGoogleError(
          'Google calendar events import failed.',
          null,
          error instanceof Error ? error : new Error(String(error))
        )
      }

      const payload = await readJsonResponse(
        response,
        'Google calendar events import failed.'
      )

      if (Array.isArray(payload.items)) {
        items.push(...payload.items)
      }

      pageToken = payload.nextPageToken ?? null
    } while (pageToken)

    return items
  }

  return {
    listAllEvents,
  }
}

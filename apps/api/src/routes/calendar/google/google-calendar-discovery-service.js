const GOOGLE_CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList'

function createGoogleError(message, response, payload) {
  const details = payload && typeof payload === 'object'
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

export function createGoogleCalendarDiscoveryService({ fetchImpl = fetch }) {
  async function listCalendars({ accessToken }) {
    const response = await fetchImpl(GOOGLE_CALENDAR_LIST_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const payload = await readJsonResponse(
      response,
      'Google calendar discovery failed.'
    )

    if (!Array.isArray(payload.items)) {
      return []
    }

    return payload.items.map((item) => ({
      id: item.id,
      summary: item.summary,
      primary: Boolean(item.primary),
      timeZone: item.timeZone ?? null,
      backgroundColor: item.backgroundColor ?? null,
    }))
  }

  return {
    listCalendars,
  }
}

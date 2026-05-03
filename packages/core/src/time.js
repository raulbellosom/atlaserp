const DEFAULT_LOCALE = 'sv-SE'
const DEFAULT_TIME_ZONE = 'UTC'

function readEnv(name) {
  if (typeof process === 'undefined') return undefined
  return process.env?.[name]
}

export function getConfiguredTimeZone() {
  return readEnv('ATLAS_TIME_ZONE') || readEnv('TZ') || DEFAULT_TIME_ZONE
}

export function formatLocalDateTime(value = new Date(), options = {}) {
  const date = value instanceof Date ? value : new Date(value)
  const timeZone = options.timeZone || getConfiguredTimeZone()
  const locale = options.locale || DEFAULT_LOCALE

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

export function formatLogTimestamp(value = new Date(), options = {}) {
  const timeZone = options.timeZone || getConfiguredTimeZone()
  return `${formatLocalDateTime(value, { ...options, timeZone })} ${timeZone}`
}

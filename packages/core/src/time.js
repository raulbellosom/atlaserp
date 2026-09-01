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

// Node -> the configured zone (ATLAS_TIME_ZONE || TZ || 'UTC'); browser -> the
// runtime's own zone. `toISOString()` is always UTC and must never be used to
// derive a local calendar date/month.
function runtimeTimeZone() {
  const isNode =
    typeof process !== 'undefined' && !!process.versions && !!process.versions.node
  return isNode ? getConfiguredTimeZone() : undefined
}

export function nowLocalParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: runtimeTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return { year: map.year, month: map.month, day: map.day }
}

export function toLocalIso(date = new Date()) {
  const { year, month, day } = nowLocalParts(date)
  return `${year}-${month}-${day}`
}

export function toLocalMonth(date = new Date()) {
  const { year, month } = nowLocalParts(date)
  return `${year}-${month}`
}

export function formatLogTimestamp(value = new Date(), options = {}) {
  const timeZone = options.timeZone || getConfiguredTimeZone()
  return `${formatLocalDateTime(value, { ...options, timeZone })} ${timeZone}`
}

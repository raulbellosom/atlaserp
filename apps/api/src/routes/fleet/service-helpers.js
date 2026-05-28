export function toNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

export function normalizePagination({ page, pageSize }) {
  const safePage = Math.max(1, toNumber(page, 1))
  const safePageSize = Math.min(100, Math.max(1, toNumber(pageSize, 20)))
  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize,
  }
}

export function normalizeSearch(search) {
  const value = String(search ?? '').trim()
  return value.length > 0 ? value : null
}

export function normalizeOptionalString(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

export function isTableNotFoundError(error) {
  const codes = [
    error?.code,
    error?.meta?.code,
    error?.cause?.code,
    error?.originalError?.code,
  ]
  if (codes.includes('42P01')) return true

  const message = String(error?.message ?? '')
  if (message.includes('42P01')) return true
  if (message.toLowerCase().includes('relation') && message.toLowerCase().includes('does not exist')) {
    return true
  }
  return false
}

export function isUniqueViolation(error) {
  const codes = [
    error?.code,
    error?.meta?.code,
    error?.cause?.code,
    error?.cause?.originalCode,
    error?.originalError?.code,
    error?.meta?.driverAdapterError?.cause?.code,
    error?.meta?.driverAdapterError?.cause?.originalCode,
  ]
    .map((value) => (value === undefined || value === null ? null : String(value)))
    .filter(Boolean)

  if (codes.includes('23505')) return true

  const message = String(error?.message ?? '').toLowerCase()
  if (message.includes('duplicate key value violates unique constraint')) return true

  return false
}

export function toCount(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function firstRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  return rows[0]
}

export function hasOwn(data, key) {
  return Object.prototype.hasOwnProperty.call(data, key)
}

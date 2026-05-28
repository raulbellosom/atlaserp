export function toNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizePagination({ page, pageSize, maxPageSize = 100 }) {
  const safePage = Math.max(1, toNumber(page, 1))
  const safePageSize = Math.min(maxPageSize, Math.max(1, toNumber(pageSize, 50)))
  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize }
}

export function normalizeSearch(search) {
  const value = String(search ?? '').trim()
  return value.length > 0 ? value : null
}

export function normalizeOptionalString(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

export function isTableNotFoundError(error) {
  const codes = [error?.code, error?.meta?.code, error?.cause?.code, error?.originalError?.code]
  if (codes.includes('42P01')) return true
  const message = String(error?.message ?? '')
  if (message.includes('42P01')) return true
  if (message.toLowerCase().includes('relation') && message.toLowerCase().includes('does not exist')) return true
  return false
}

export function isUniqueViolation(error) {
  const codes = [
    error?.code, error?.meta?.code, error?.cause?.code,
    error?.cause?.originalCode, error?.originalError?.code,
    error?.meta?.driverAdapterError?.cause?.code,
    error?.meta?.driverAdapterError?.cause?.originalCode,
  ].map((v) => (v == null ? null : String(v))).filter(Boolean)
  if (codes.includes('23505')) return true
  return String(error?.message ?? '').toLowerCase().includes('duplicate key value violates unique constraint')
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

export function getValidationErrorMessage(error) {
  const issue = error?.issues?.[0]
  if (!issue) return 'Datos invalidos.'
  const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join('.') : null
  return path ? `Datos invalidos en ${path}: ${issue.message}` : `Datos invalidos: ${issue.message}`
}

export function getCompanyId(c) {
  const id = c.get('userContext')?.memberships?.[0]?.companyId
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

export function getActorId(c) {
  const id = c.get('userContext')?.profile?.id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

export function normalizePath(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (text === '/') return '/'
  const withSlash = text.startsWith('/') ? text : `/${text}`
  return withSlash.replace(/\/+$/, '')
}

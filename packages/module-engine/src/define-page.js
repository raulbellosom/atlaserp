import { ModuleEngineError } from './errors.js'

// Returns { valid: boolean, errors: string[] }. Never throws.
export function validatePage(page) {
  const errors = []
  if (!page || typeof page !== 'object' || Array.isArray(page)) {
    return { valid: false, errors: ['page must be a plain object'] }
  }
  if (!page.key || typeof page.key !== 'string' || !page.key.trim()) {
    errors.push('key is required and must be a non-empty string')
  }
  if (!page.path || typeof page.path !== 'string' || !page.path.startsWith('/')) {
    errors.push('path is required and must start with /')
  }
  if (!page.title || typeof page.title !== 'string' || !page.title.trim()) {
    errors.push('title is required and must be a non-empty string')
  }
  return { valid: errors.length === 0, errors }
}

// Validates and returns the page. Throws ModuleEngineError on invalid input.
export function definePage(page) {
  const { valid, errors } = validatePage(page)
  if (!valid) {
    throw new ModuleEngineError(`Invalid page definition: ${errors.join('; ')}`, 'AME_INVALID_PAGE')
  }
  return { ...page }
}

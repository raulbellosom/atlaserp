import { BLUEPRINT_KINDS } from './constants.js'
import { ModuleEngineError } from './errors.js'

const VALID_KINDS = new Set(Object.values(BLUEPRINT_KINDS))
const VIEW_DEFAULTS = { version: '0.1.0' }

// Returns { valid: boolean, errors: string[] }. Never throws.
export function validateView(view) {
  const errors = []
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    return { valid: false, errors: ['view must be a plain object'] }
  }
  if (!view.key || typeof view.key !== 'string' || !view.key.trim()) {
    errors.push('key is required and must be a non-empty string')
  }
  if (!view.kind || !VALID_KINDS.has(view.kind)) {
    errors.push(`kind must be one of: ${[...VALID_KINDS].join(', ')}`)
  }
  if (!view.schema || typeof view.schema !== 'object' || Array.isArray(view.schema)) {
    errors.push('schema is required and must be a plain object')
  }
  return { valid: errors.length === 0, errors }
}

// Validates and returns the view with defaults applied. Throws ModuleEngineError on invalid input.
export function defineView(view) {
  const { valid, errors } = validateView(view)
  if (!valid) {
    throw new ModuleEngineError(`Invalid view definition: ${errors.join('; ')}`, 'AME_INVALID_VIEW')
  }
  return { ...VIEW_DEFAULTS, ...view }
}

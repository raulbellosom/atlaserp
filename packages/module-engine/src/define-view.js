import { BLUEPRINT_KINDS } from './constants.js'
import { ModuleEngineError } from './errors.js'

const VALID_KINDS = new Set(Object.values(BLUEPRINT_KINDS))
const VIEW_DEFAULTS = { version: '0.1.0' }

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0
}

function isColumnDeclaration(value) {
  if (typeof value === 'string' && value.trim()) return true
  if (!isPlainObject(value)) return false
  const field = value.field ?? value.key ?? value.name
  return typeof field === 'string' && field.trim().length > 0
}

function validateKindSchema(kind, schema, errors) {
  if (!isPlainObject(schema)) return

  if (kind === 'TABLE') {
    if (!hasNonEmptyArray(schema.columns)) {
      errors.push('TABLE views must declare schema.columns as a non-empty array')
      return
    }
    schema.columns.forEach((column, index) => {
      if (!isColumnDeclaration(column)) {
        errors.push(
          `TABLE schema.columns[${index}] must be a field string or object with field/key/name`
        )
      }
    })
  }

  if (kind === 'FORM') {
    if (!hasNonEmptyArray(schema.sections)) {
      errors.push('FORM views must declare schema.sections as a non-empty array')
      return
    }
    schema.sections.forEach((section, index) => {
      if (!isPlainObject(section)) {
        errors.push(`FORM schema.sections[${index}] must be an object`)
        return
      }
      const hasFields = hasNonEmptyArray(section.fields)
      const hasTypedBlock = typeof section.type === 'string' && section.type.trim().length > 0
      if (!hasFields && !hasTypedBlock) {
        errors.push(
          `FORM schema.sections[${index}] must include fields[] or a typed section descriptor`
        )
      }
    })
  }

  if (kind === 'DETAIL') {
    if (!hasNonEmptyArray(schema.sections)) {
      errors.push('DETAIL views must declare schema.sections as a non-empty array')
    }
  }
}

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
  if (VALID_KINDS.has(view.kind)) {
    validateKindSchema(view.kind, view.schema, errors)
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

import { FIELD_TYPES, RESERVED_TABLE_PREFIXES } from './constants.js'
import { ModuleEngineError } from './errors.js'

const FIELD_TYPE_SET = new Set(Object.values(FIELD_TYPES))
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

const MODEL_DEFAULTS = {
  companyScoped: true,
  softDelete:    false,
  indexes:       [],
}

// Returns { valid: boolean, errors: string[] }. Never throws.
export function validateModel(model) {
  const errors = []

  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return { valid: false, errors: ['model must be a plain object'] }
  }

  if (!model.key || typeof model.key !== 'string' || !model.key.trim()) {
    errors.push('key is required and must be a non-empty string')
  } else if (!IDENTIFIER_RE.test(model.key)) {
    errors.push('key must be a valid identifier: letters, digits, underscores; must start with letter or underscore')
  }

  if (!model.tableName || typeof model.tableName !== 'string') {
    errors.push('tableName is required and must be a string')
  } else if (!IDENTIFIER_RE.test(model.tableName)) {
    errors.push('tableName must be a valid SQL identifier: letters, digits, underscores; must start with letter or underscore; no spaces or special characters')
  } else {
    const lower = model.tableName.toLowerCase()
    const reserved = RESERVED_TABLE_PREFIXES.find((p) => lower.startsWith(p))
    if (reserved) {
      errors.push(`tableName must not start with reserved prefix "${reserved}" (PostgreSQL system namespace)`)
    }
  }

  if (!Array.isArray(model.fields)) {
    errors.push('fields must be an array')
  } else {
    model.fields.forEach((field, i) => {
      if (!field.name || typeof field.name !== 'string' || !IDENTIFIER_RE.test(field.name)) {
        errors.push(`fields[${i}].name must be a valid identifier`)
      }
      if (!field.type || !FIELD_TYPE_SET.has(field.type)) {
        errors.push(`fields[${i}].type "${field.type}" is not a supported type. Use FIELD_TYPES constants. Supported: ${[...FIELD_TYPE_SET].join(', ')}`)
      }
    })
  }

  if (model.indexes !== undefined && !Array.isArray(model.indexes)) {
    errors.push('indexes must be an array')
  }

  return { valid: errors.length === 0, errors }
}

// Validates and returns the model with defaults applied. Throws ModuleEngineError on invalid input.
export function defineModel(model) {
  const { valid, errors } = validateModel(model)
  if (!valid) {
    throw new ModuleEngineError(`Invalid model definition: ${errors.join('; ')}`, 'AME_INVALID_MODEL')
  }
  return {
    ...MODEL_DEFAULTS,
    ...model,
    fields:  model.fields ?? [],
    indexes: model.indexes ?? [],
  }
}

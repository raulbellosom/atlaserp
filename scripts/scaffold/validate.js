import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const RESERVED_PREFIXES = ['atlas', 'core', 'system', 'identity']
const MODULE_KEY_REGEX = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/
const IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/

const VALID_FIELD_TYPES = new Set([
  'text', 'textarea', 'number', 'decimal', 'boolean',
  'select', 'multiselect', 'date', 'datetime', 'email',
  'phone', 'relation', 'file', 'json', 'markdown', 'color', 'richtext',
])

export function validateConfig(config) {
  const errors = []

  if (!config || typeof config !== 'object') {
    return ['La configuracion debe ser un objeto JSON valido.']
  }

  // key
  if (!config.key || typeof config.key !== 'string') {
    errors.push('key es requerido (ej. custom.crm).')
  } else if (!MODULE_KEY_REGEX.test(config.key)) {
    errors.push(`key "${config.key}" tiene formato invalido. Debe ser <namespace>.<slug> con solo letras, numeros y guiones.`)
  } else {
    const prefix = config.key.split('.')[0]
    if (RESERVED_PREFIXES.includes(prefix)) {
      errors.push(`El prefijo "${prefix}." esta reservado. Usa "custom." u otro namespace.`)
    }
  }

  // name
  if (!config.name || typeof config.name !== 'string' || !config.name.trim()) {
    errors.push('name es requerido (nombre para mostrar en UI, en español).')
  }

  // version
  if (config.version !== undefined) {
    if (!/^\d+\.\d+\.\d+$/.test(config.version)) {
      errors.push(`version "${config.version}" debe seguir semver (ej. 0.1.0).`)
    }
  }

  // entities
  if (!Array.isArray(config.entities) || config.entities.length === 0) {
    errors.push('entities debe ser un array con al menos una entidad.')
    return errors
  }

  const entityNames = new Set()
  for (let i = 0; i < config.entities.length; i++) {
    const entity = config.entities[i]
    const prefix = `entities[${i}]`

    if (!entity.name || typeof entity.name !== 'string') {
      errors.push(`${prefix}.name es requerido.`)
      continue
    }
    if (!IDENTIFIER_REGEX.test(entity.name)) {
      errors.push(`${prefix}.name "${entity.name}" debe ser snake_case, solo letras minusculas, numeros y guiones bajos.`)
    }
    if (entityNames.has(entity.name)) {
      errors.push(`${prefix}.name "${entity.name}" duplicado. Los nombres de entidad deben ser unicos.`)
    }
    entityNames.add(entity.name)

    if (!entity.label || typeof entity.label !== 'string' || !entity.label.trim()) {
      errors.push(`${prefix}.label es requerido (nombre en español, ej. "Contacto").`)
    } else if (entity.label.includes("'")) {
      errors.push(`${prefix}.label no debe contener comillas simples.`)
    }

    if (!Array.isArray(entity.fields) || entity.fields.length === 0) {
      errors.push(`${prefix}.fields debe tener al menos un campo.`)
      continue
    }

    const fieldNames = new Set()
    for (let j = 0; j < entity.fields.length; j++) {
      const field = entity.fields[j]
      const fprefix = `${prefix}.fields[${j}]`

      if (!field.name || typeof field.name !== 'string') {
        errors.push(`${fprefix}.name es requerido.`)
        continue
      }
      if (!IDENTIFIER_REGEX.test(field.name)) {
        errors.push(`${fprefix}.name "${field.name}" debe ser snake_case.`)
      }
      if (['id', 'company_id', 'enabled', 'created_at', 'updated_at'].includes(field.name)) {
        errors.push(`${fprefix}.name "${field.name}" es un campo reservado del sistema.`)
      }
      if (fieldNames.has(field.name)) {
        errors.push(`${fprefix}.name "${field.name}" duplicado en la misma entidad.`)
      }
      fieldNames.add(field.name)

      if (field.label && typeof field.label === 'string' && field.label.includes("'")) {
        errors.push(`${fprefix}.label no debe contener comillas simples.`)
      }

      if (!field.type || typeof field.type !== 'string') {
        errors.push(`${fprefix}.type es requerido.`)
        continue
      }
      if (!VALID_FIELD_TYPES.has(field.type)) {
        errors.push(`${fprefix}.type "${field.type}" no es valido. Tipos validos: ${[...VALID_FIELD_TYPES].join(', ')}.`)
        continue
      }

      if ((field.type === 'select' || field.type === 'multiselect')) {
        if (!Array.isArray(field.options) || field.options.length === 0) {
          errors.push(`${fprefix}: tipo "${field.type}" requiere options[] con al menos una opcion.`)
        }
      }

      if (field.type === 'relation') {
        if (!field.relatedModel || typeof field.relatedModel !== 'string') {
          errors.push(`${fprefix}: tipo "relation" requiere relatedModel (ej. "fleet.vehicle").`)
        }
      }
    }
  }

  return errors
}

export function validateModuleDirectory(moduleKey, repoRoot) {
  const modulePath = resolve(repoRoot, 'modules', 'custom', moduleKey)
  return existsSync(modulePath) ? modulePath : null
}

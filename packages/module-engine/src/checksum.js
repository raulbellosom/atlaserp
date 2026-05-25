import { createHash } from 'node:crypto'
import { ModuleEngineError } from './errors.js'

function normalizeField(field) {
  return {
    name:         field.name,
    type:         field.type,
    required:     field.required ?? false,
    maxLength:    field.maxLength ?? null,
    relatedModel: field.relatedModel ?? null,
  }
}

function normalizeModel(modelDef) {
  const fields  = (modelDef.fields ?? [])
    .map(normalizeField)
    .sort((a, b) => a.name.localeCompare(b.name))
  const indexes = (modelDef.indexes ?? [])
    .map((idx) => ({ fields: [...idx.fields].sort(), unique: idx.unique ?? false }))
    .sort((a, b) => a.fields.join(',').localeCompare(b.fields.join(',')))
  const foreignKeys = (modelDef.foreignKeys ?? [])
    .map((fk) => ({
      field: fk.field,
      table: fk.references?.table ?? null,
      refField: fk.references?.field ?? null,
      onDelete: typeof fk.onDelete === 'string' ? fk.onDelete.trim().toUpperCase() : 'RESTRICT',
      onUpdate: typeof fk.onUpdate === 'string' ? fk.onUpdate.trim().toUpperCase() : 'CASCADE',
    }))
    .sort((a, b) => `${a.field}:${a.table}:${a.refField}`.localeCompare(`${b.field}:${b.table}:${b.refField}`))
  const checks = (modelDef.checks ?? [])
    .map((check) => ({
      name: check.name,
      expression: check.expression?.trim?.() ?? check.expression ?? null,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  return {
    tableName:     modelDef.tableName,
    companyScoped: modelDef.companyScoped ?? true,
    softDelete:    modelDef.softDelete ?? false,
    fields,
    indexes,
    foreignKeys,
    checks,
  }
}

// Returns a deterministic SHA-256 hex string (64 characters).
// Schema-relevant changes (tableName, companyScoped, softDelete, field name/type/required/maxLength) change the checksum.
// UI-only changes (label, description) do not change the checksum.
// Field order does not affect the checksum (fields are sorted by name before hashing).
export function createChecksum(modelDef) {
  if (!modelDef || typeof modelDef !== 'object') {
    throw new ModuleEngineError('createChecksum: modelDef must be a plain object', 'AME_INVALID_MODEL')
  }
  const normalized = normalizeModel(modelDef)
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

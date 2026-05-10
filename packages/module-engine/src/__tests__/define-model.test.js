import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineModel, validateModel } from '../define-model.js'
import { ModuleEngineError } from '../errors.js'

const VALID_MODEL = {
  key:       'vehicle',
  tableName: 'fleet_vehicle',
  fields: [
    { name: 'plate',  type: 'text',   required: true, maxLength: 20 },
    { name: 'status', type: 'select', required: true },
  ],
}

test('defineModel - returns model with tableName preserved', () => {
  const r = defineModel(VALID_MODEL)
  assert.equal(r.tableName, 'fleet_vehicle')
})

test('defineModel - atlas_ prefix is accepted', () => {
  const r = defineModel({ ...VALID_MODEL, tableName: 'atlas_fleet_vehicle' })
  assert.equal(r.tableName, 'atlas_fleet_vehicle')
})

test('defineModel - custom_ prefix is accepted', () => {
  const r = defineModel({ ...VALID_MODEL, tableName: 'custom_fleet_vehicle' })
  assert.equal(r.tableName, 'custom_fleet_vehicle')
})

test('defineModel - applies companyScoped:true by default', () => {
  assert.equal(defineModel(VALID_MODEL).companyScoped, true)
})

test('defineModel - applies softDelete:false by default', () => {
  assert.equal(defineModel(VALID_MODEL).softDelete, false)
})

test('defineModel - accepts empty fields array', () => {
  const r = defineModel({ key: 'tag', tableName: 'tag', fields: [] })
  assert.deepEqual(r.fields, [])
})

test('defineModel - throws ModuleEngineError when tableName starts with pg_', () => {
  assert.throws(
    () => defineModel({ ...VALID_MODEL, tableName: 'pg_vehicle' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('pg_')
  )
})

test('defineModel - throws when tableName contains a space', () => {
  assert.throws(
    () => defineModel({ ...VALID_MODEL, tableName: 'fleet vehicle' }),
    (err) => err instanceof ModuleEngineError
  )
})

test('defineModel - throws when tableName is missing', () => {
  assert.throws(
    () => defineModel({ key: 'vehicle', fields: [] }),
    (err) => err instanceof ModuleEngineError && err.message.includes('tableName')
  )
})

test('defineModel - throws when key is missing', () => {
  assert.throws(
    () => defineModel({ tableName: 'fleet_vehicle', fields: [] }),
    (err) => err instanceof ModuleEngineError && err.message.includes('key')
  )
})

test('defineModel - throws when field type is unsupported', () => {
  assert.throws(
    () => defineModel({ ...VALID_MODEL, fields: [{ name: 'x', type: 'unknown_type' }] }),
    (err) => err instanceof ModuleEngineError && err.message.includes('unknown_type')
  )
})

test('validateModel - returns valid:true for correct model', () => {
  const r = validateModel(VALID_MODEL)
  assert.equal(r.valid, true)
  assert.deepEqual(r.errors, [])
})

test('validateModel - returns valid:false without throwing for pg_ prefix', () => {
  const r = validateModel({ ...VALID_MODEL, tableName: 'pg_vehicle' })
  assert.equal(r.valid, false)
  assert.ok(r.errors.some((e) => e.includes('pg_')))
})

test('validateModel - handles null without throwing', () => {
  assert.equal(validateModel(null).valid, false)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createChecksum } from '../checksum.js'
import { ModuleEngineError } from '../errors.js'

const BASE = {
  tableName:     'fleet_vehicle',
  companyScoped: true,
  softDelete:    false,
  fields: [
    { name: 'plate',  type: 'text',   required: true, maxLength: 20 },
    { name: 'status', type: 'select', required: true },
  ],
  indexes: [],
}

test('createChecksum - returns a 64-character lowercase hex string', () => {
  const r = createChecksum(BASE)
  assert.equal(typeof r, 'string')
  assert.equal(r.length, 64)
  assert.ok(/^[0-9a-f]+$/.test(r))
})

test('createChecksum - same model returns same checksum', () => {
  assert.equal(createChecksum(BASE), createChecksum(BASE))
})

test('createChecksum - field name change produces different checksum', () => {
  const modified = { ...BASE, fields: [{ name: 'license_plate', type: 'text', required: true, maxLength: 20 }, BASE.fields[1]] }
  assert.notEqual(createChecksum(BASE), createChecksum(modified))
})

test('createChecksum - field type change produces different checksum', () => {
  const modified = { ...BASE, fields: [{ name: 'plate', type: 'textarea', required: true }, BASE.fields[1]] }
  assert.notEqual(createChecksum(BASE), createChecksum(modified))
})

test('createChecksum - tableName change produces different checksum', () => {
  assert.notEqual(createChecksum(BASE), createChecksum({ ...BASE, tableName: 'fleet_truck' }))
})

test('createChecksum - companyScoped change produces different checksum', () => {
  assert.notEqual(createChecksum(BASE), createChecksum({ ...BASE, companyScoped: false }))
})

test('createChecksum - softDelete change produces different checksum', () => {
  assert.notEqual(createChecksum(BASE), createChecksum({ ...BASE, softDelete: true }))
})

test('createChecksum - field order does not affect checksum', () => {
  const reordered = { ...BASE, fields: [BASE.fields[1], BASE.fields[0]] }
  assert.equal(createChecksum(BASE), createChecksum(reordered))
})

test('createChecksum - UI-only label change does not affect checksum', () => {
  const withLabels = {
    ...BASE,
    fields: [
      { name: 'plate',  type: 'text',   required: true, maxLength: 20, label: 'Placa' },
      { name: 'status', type: 'select', required: true, label: 'Estado' },
    ],
  }
  assert.equal(createChecksum(BASE), createChecksum(withLabels))
})

test('createChecksum - throws ModuleEngineError on non-object input', () => {
  assert.throws(() => createChecksum(null),  (err) => err instanceof ModuleEngineError)
  assert.throws(() => createChecksum('bad'), (err) => err instanceof ModuleEngineError)
})

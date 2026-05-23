import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateView } from '../define-view.js'

test('validateView accepts TABLE with non-empty columns array', () => {
  const result = validateView({
    key: 'fleet.vehicle.table',
    kind: 'TABLE',
    schema: {
      columns: [{ field: 'plate' }],
    },
  })

  assert.equal(result.valid, true)
})

test('validateView rejects TABLE when schema.columns is missing', () => {
  const result = validateView({
    key: 'fleet.vehicle.table',
    kind: 'TABLE',
    schema: {},
  })

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('schema.columns')))
})

test('validateView rejects TABLE when a column has no field/key/name', () => {
  const result = validateView({
    key: 'fleet.vehicle.table',
    kind: 'TABLE',
    schema: {
      columns: [{}],
    },
  })

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('schema.columns[0]')))
})

test('validateView accepts FORM with sections containing fields', () => {
  const result = validateView({
    key: 'fleet.vehicle.form',
    kind: 'FORM',
    schema: {
      sections: [{ label: 'General', fields: [{ field: 'plate' }] }],
    },
  })

  assert.equal(result.valid, true)
})

test('validateView accepts FORM typed section without fields', () => {
  const result = validateView({
    key: 'fleet.vehicle.form',
    kind: 'FORM',
    schema: {
      sections: [{ type: 'attachments', attachments: { enabled: true } }],
    },
  })

  assert.equal(result.valid, true)
})

test('validateView rejects FORM without sections', () => {
  const result = validateView({
    key: 'fleet.vehicle.form',
    kind: 'FORM',
    schema: {},
  })

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('schema.sections')))
})

test('validateView rejects DETAIL without sections', () => {
  const result = validateView({
    key: 'fleet.vehicle.detail',
    kind: 'DETAIL',
    schema: {},
  })

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('schema.sections')))
})

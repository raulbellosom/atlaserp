import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineAtlasModule, validateManifest } from '../define-module.js'
import { ModuleEngineError } from '../errors.js'

const VALID = { key: 'custom.fleet', name: 'Flota', version: '0.1.0', kind: 'FEATURE' }

test('defineAtlasModule - returns manifest with key preserved', () => {
  const r = defineAtlasModule(VALID)
  assert.equal(r.key, 'custom.fleet')
  assert.equal(r.name, 'Flota')
  assert.equal(r.version, '0.1.0')
})

test('defineAtlasModule - applies default kind when omitted', () => {
  const r = defineAtlasModule({ key: 'custom.demo', name: 'Demo', version: '0.1.0' })
  assert.equal(r.kind, 'FEATURE')
})

test('defineAtlasModule - applies empty permissions and navigation by default', () => {
  const r = defineAtlasModule(VALID)
  assert.deepEqual(r.permissions, [])
  assert.deepEqual(r.navigation, [])
})

test('defineAtlasModule - throws ModuleEngineError (not plain Error) when key is missing', () => {
  assert.throws(
    () => defineAtlasModule({ name: 'Flota', version: '0.1.0' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('key')
  )
})

test('defineAtlasModule - throws when name is missing', () => {
  assert.throws(
    () => defineAtlasModule({ key: 'custom.fleet', version: '0.1.0' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('name')
  )
})

test('defineAtlasModule - throws when version is missing', () => {
  assert.throws(
    () => defineAtlasModule({ key: 'custom.fleet', name: 'Flota' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('version')
  )
})

test('defineAtlasModule - throws when version is not semver', () => {
  assert.throws(
    () => defineAtlasModule({ key: 'custom.fleet', name: 'Flota', version: 'latest' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('version')
  )
})

test('defineAtlasModule - throws when kind is invalid', () => {
  assert.throws(
    () => defineAtlasModule({ ...VALID, kind: 'UNKNOWN' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('kind')
  )
})

test('defineAtlasModule - throws when key has path traversal', () => {
  assert.throws(
    () => defineAtlasModule({ ...VALID, key: '../evil' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('key')
  )
})

test('defineAtlasModule - throws when key has no dot separator', () => {
  assert.throws(
    () => defineAtlasModule({ ...VALID, key: 'fleet' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('key')
  )
})

test('defineAtlasModule - throws when navigation item lacks permissionKey', () => {
  assert.throws(
    () => defineAtlasModule({ ...VALID, navigation: [{ label: 'X', path: '/x' }] }),
    (err) => err instanceof ModuleEngineError && err.message.includes('permissionKey')
  )
})

test('validateManifest - returns valid:true for correct manifest', () => {
  const r = validateManifest(VALID)
  assert.equal(r.valid, true)
  assert.deepEqual(r.errors, [])
})

test('validateManifest - returns valid:false without throwing for empty object', () => {
  const r = validateManifest({})
  assert.equal(r.valid, false)
  assert.ok(r.errors.some((e) => e.includes('key')))
  assert.ok(r.errors.some((e) => e.includes('name')))
  assert.ok(r.errors.some((e) => e.includes('version')))
})

test('validateManifest - handles null without throwing', () => {
  assert.equal(validateManifest(null).valid, false)
})

test('validateManifest - handles non-object without throwing', () => {
  assert.equal(validateManifest('bad').valid, false)
})

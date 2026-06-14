import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validateConfig } from '../validate.js'

const minimalEntity = {
  name: 'item',
  label: 'Item',
  fields: [{ name: 'title', type: 'text', label: 'Titulo' }],
}

const minimalConfig = {
  key: 'custom.demo',
  name: 'Demo',
  icon: 'Box',
  color: '#6366f1',
  pwa: {
    shortName: 'Demo',
    startPath: '/demo-items',
  },
  entities: [minimalEntity],
}

describe('validateConfig', () => {
  test('accepts a minimal valid config', () => {
    const errors = validateConfig(minimalConfig)
    assert.deepEqual(errors, [])
  })

  test('rejects missing key', () => {
    const errors = validateConfig({ ...minimalConfig, key: undefined })
    assert.ok(errors.some((e) => e.includes('key')))
  })

  test('rejects invalid key format', () => {
    const errors = validateConfig({ ...minimalConfig, key: 'nodot' })
    assert.ok(errors.some((e) => e.includes('nodot')))
  })

  test('rejects reserved atlas prefix', () => {
    const errors = validateConfig({ ...minimalConfig, key: 'atlas.core' })
    assert.ok(errors.some((e) => e.includes('reservado')))
  })

  test('rejects reserved identity prefix', () => {
    const errors = validateConfig({ ...minimalConfig, key: 'identity.auth' })
    assert.ok(errors.some((e) => e.includes('reservado')))
  })

  test('rejects missing name', () => {
    const errors = validateConfig({ ...minimalConfig, name: '' })
    assert.ok(errors.some((e) => e.includes('name')))
  })

  test('rejects invalid semver version', () => {
    const errors = validateConfig({ ...minimalConfig, version: '1.0' })
    assert.ok(errors.some((e) => e.includes('version')))
  })

  test('accepts valid semver version', () => {
    const errors = validateConfig({ ...minimalConfig, version: '1.2.3' })
    assert.deepEqual(errors, [])
  })

  test('rejects empty entities array', () => {
    const errors = validateConfig({ ...minimalConfig, entities: [] })
    assert.ok(errors.some((e) => e.includes('entities')))
  })

  test('rejects entity with invalid name', () => {
    const errors = validateConfig({
      ...minimalConfig,
      entities: [{ ...minimalEntity, name: 'MyEntity' }],
    })
    assert.ok(errors.some((e) => e.includes('snake_case')))
  })

  test('rejects duplicate entity names', () => {
    const errors = validateConfig({
      ...minimalConfig,
      entities: [minimalEntity, minimalEntity],
    })
    assert.ok(errors.some((e) => e.includes('duplicado')))
  })

  test('rejects reserved field name "id"', () => {
    const errors = validateConfig({
      ...minimalConfig,
      entities: [{
        ...minimalEntity,
        fields: [{ name: 'id', type: 'text', label: 'ID' }],
      }],
    })
    assert.ok(errors.some((e) => e.includes('reservado')))
  })

  test('rejects unknown field type', () => {
    const errors = validateConfig({
      ...minimalConfig,
      entities: [{
        ...minimalEntity,
        fields: [{ name: 'foo', type: 'uuid', label: 'Foo' }],
      }],
    })
    assert.ok(errors.some((e) => e.includes('uuid')))
  })

  test('rejects select field without options', () => {
    const errors = validateConfig({
      ...minimalConfig,
      entities: [{
        ...minimalEntity,
        fields: [{ name: 'status', type: 'select', label: 'Estado' }],
      }],
    })
    assert.ok(errors.some((e) => e.includes('options')))
  })

  test('accepts select field with options', () => {
    const errors = validateConfig({
      ...minimalConfig,
      entities: [{
        ...minimalEntity,
        fields: [{ name: 'status', type: 'select', label: 'Estado', options: ['activo', 'inactivo'] }],
      }],
    })
    assert.deepEqual(errors, [])
  })

  test('rejects relation field without relatedModel', () => {
    const errors = validateConfig({
      ...minimalConfig,
      entities: [{
        ...minimalEntity,
        fields: [{ name: 'category_id', type: 'relation', label: 'Categoria' }],
      }],
    })
    assert.ok(errors.some((e) => e.includes('relatedModel')))
  })

  test('accepts relation field with relatedModel', () => {
    const errors = validateConfig({
      ...minimalConfig,
      entities: [{
        ...minimalEntity,
        fields: [{ name: 'category_id', type: 'relation', label: 'Categoria', relatedModel: 'demo.category' }],
      }],
    })
    assert.deepEqual(errors, [])
  })

  test('collects all errors before returning', () => {
    const errors = validateConfig({
      key: 'nodot',
      name: '',
      entities: [],
    })
    assert.ok(errors.length >= 3)
  })

  test('rejects missing PWA identity fields', () => {
    const errors = validateConfig({
      key: 'custom.demo',
      name: 'Demo',
      entities: [minimalEntity],
    })

    assert.ok(errors.some((error) => error.includes('icon')))
    assert.ok(errors.some((error) => error.includes('color')))
    assert.ok(errors.some((error) => error.includes('pwa.shortName')))
    assert.ok(errors.some((error) => error.includes('pwa.startPath')))
  })

  test('rejects unsafe PWA start paths', () => {
    const errors = validateConfig({
      ...minimalConfig,
      pwa: { ...minimalConfig.pwa, startPath: '/../admin' },
    })

    assert.ok(errors.some((error) => error.includes('pwa.startPath')))
  })

  test('rejects unsupported module icons', () => {
    const errors = validateConfig({
      ...minimalConfig,
      icon: 'InventedIcon',
    })

    assert.ok(errors.some((error) => error.includes('icon')))
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { StorefrontError } from '../storefront-error.js'

describe('StorefrontError', () => {
  it('is an instance of Error', () => {
    const err = new StorefrontError('test', 'NOT_FOUND', 404)
    assert.ok(err instanceof Error)
    assert.ok(err instanceof StorefrontError)
  })

  it('exposes message, code, and status', () => {
    const err = new StorefrontError('Recurso no encontrado', 'NOT_FOUND', 404)
    assert.equal(err.message, 'Recurso no encontrado')
    assert.equal(err.code, 'NOT_FOUND')
    assert.equal(err.status, 404)
  })

  it('defaults code to UNKNOWN and status to 500', () => {
    const err = new StorefrontError('algo fallo')
    assert.equal(err.code, 'UNKNOWN')
    assert.equal(err.status, 500)
  })

  it('stores extra details when provided', () => {
    const details = { field: 'email', message: 'Invalid' }
    const err = new StorefrontError('error', 'VALIDATION_ERROR', 422, details)
    assert.deepEqual(err.details, details)
  })
})

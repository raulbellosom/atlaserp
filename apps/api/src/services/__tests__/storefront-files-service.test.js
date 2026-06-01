import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveFileLimits, resolveBucket } from '../storefront-files-service.js'

describe('resolveFileLimits', () => {
  it('returns 5MB limit and image-only for storefront_client', () => {
    const limits = resolveFileLimits('storefront_client')
    assert.equal(limits.maxBytes, 5 * 1024 * 1024)
    assert.deepEqual(limits.allowedMime, ['image/'])
  })

  it('returns 100MB limit and broad types for storefront_vendor', () => {
    const limits = resolveFileLimits('storefront_vendor')
    assert.equal(limits.maxBytes, 100 * 1024 * 1024)
    assert.deepEqual(limits.allowedMime, ['image/', 'audio/', 'video/', 'application/pdf'])
  })

  it('defaults to client limits for unknown roles', () => {
    const limits = resolveFileLimits('unknown_role')
    assert.equal(limits.maxBytes, 5 * 1024 * 1024)
  })
})

describe('resolveBucket', () => {
  it('returns storefront bucket for PUBLIC visibility', () => {
    assert.equal(resolveBucket('PUBLIC'), 'atlas-storefront')
  })

  it('returns files bucket for PRIVATE visibility', () => {
    assert.equal(resolveBucket('PRIVATE'), 'atlas-files')
  })

  it('defaults to PUBLIC', () => {
    assert.equal(resolveBucket(undefined), 'atlas-storefront')
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveFileLimits, resolveBucket, createStorefrontFilesService } from '../storefront-files-service.js'

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

describe('getUrl — private asset authorization', () => {
  // Regression tests for a real unauthenticated-disclosure bug: GET /:id/url
  // previously minted a signed URL into the private atlas-files bucket for
  // ANY fileId, with no requesterId check at all.

  function makeService({ asset }) {
    const prisma = {
      fileAsset: {
        findUnique: async () => asset,
      },
    }
    const supabaseAdmin = {
      storage: {
        from: () => ({
          getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.example/public.png' } }),
          createSignedUrl: async () => ({ data: { signedUrl: 'https://cdn.example/signed.png' }, error: null }),
        }),
      },
    }
    return createStorefrontFilesService({ prisma, supabaseAdmin })
  }

  it('returns a public URL for a PUBLIC (atlas-storefront bucket) asset with no requesterId at all', async () => {
    const service = makeService({
      asset: { id: 'f1', enabled: true, bucket: 'atlas-storefront', objectKey: 'k', uploadedById: 'owner-1' },
    })
    const result = await service.getUrl('f1', {})
    assert.equal(result.type, 'public')
  })

  it('rejects a PRIVATE (atlas-files bucket) asset when no requesterId is provided', async () => {
    const service = makeService({
      asset: { id: 'f2', enabled: true, bucket: 'atlas-files', objectKey: 'k', uploadedById: 'owner-1' },
    })
    await assert.rejects(
      () => service.getUrl('f2', {}),
      (err) => err.code === 'FORBIDDEN' && err.status === 403,
    )
  })

  it('rejects a PRIVATE asset when requesterId does not match the uploader', async () => {
    const service = makeService({
      asset: { id: 'f3', enabled: true, bucket: 'atlas-files', objectKey: 'k', uploadedById: 'owner-1' },
    })
    await assert.rejects(
      () => service.getUrl('f3', { requesterId: 'someone-else' }),
      (err) => err.code === 'FORBIDDEN' && err.status === 403,
    )
  })

  it('returns a signed URL for a PRIVATE asset when requesterId matches the uploader', async () => {
    const service = makeService({
      asset: { id: 'f4', enabled: true, bucket: 'atlas-files', objectKey: 'k', uploadedById: 'owner-1' },
    })
    const result = await service.getUrl('f4', { requesterId: 'owner-1' })
    assert.equal(result.type, 'signed');
    assert.ok(result.signedUrl);
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createFilesNamespace } from '../files.js'

function makeRequest(response) {
  const calls = []
  const fn = async (method, path, body) => { calls.push({ method, path, body }); return response }
  fn.calls = calls
  return fn
}

describe('sdk.files.upload', () => {
  it('sends FormData POST to /public/storefront/files/upload', async () => {
    const req = makeRequest({ data: { id: '1', url: 'https://cdn.test/f.jpg', originalName: 'f.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 } })
    const files = createFilesNamespace({ request: req })
    const blob = new Blob(['data'], { type: 'image/jpeg' })
    const file = Object.assign(blob, { name: 'f.jpg' })
    const result = await files.upload(file, { visibility: 'PUBLIC' })
    assert.equal(result.id, '1')
    assert.equal(req.calls[0].method, 'POST')
    assert.equal(req.calls[0].path, '/public/storefront/files/upload')
    assert.ok(req.calls[0].body instanceof FormData)
  })
})

describe('sdk.files.getUrl', () => {
  it('calls GET /public/storefront/files/:id/url', async () => {
    const req = makeRequest({ data: { url: 'https://cdn.test/f.jpg', type: 'public' } })
    const files = createFilesNamespace({ request: req })
    const result = await files.getUrl('abc-123')
    assert.equal(result.url, 'https://cdn.test/f.jpg')
    assert.equal(req.calls[0].path, '/public/storefront/files/abc-123/url')
  })
})

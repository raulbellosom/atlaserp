import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRequestCore } from '../core/request.js'
import { StorefrontError } from '../storefront-error.js'

function mockFetch(status, body) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
}

describe('createRequestCore', () => {
  it('returns parsed JSON on 2xx', async () => {
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'test',
      getSession: () => null,
      fetchFn: mockFetch(200, { data: { id: '1' } }),
    })
    const result = await req('GET', '/test')
    assert.deepEqual(result, { data: { id: '1' } })
  })

  it('throws StorefrontError with code UNAUTHORIZED on 401', async () => {
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'test',
      getSession: () => null,
      fetchFn: mockFetch(401, { error: 'No autorizado' }),
    })
    await assert.rejects(
      () => req('GET', '/protected'),
      (err) => {
        assert.ok(err instanceof StorefrontError)
        assert.equal(err.code, 'UNAUTHORIZED')
        assert.equal(err.status, 401)
        return true
      }
    )
  })

  it('throws StorefrontError with code NOT_FOUND on 404', async () => {
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'test',
      getSession: () => null,
      fetchFn: mockFetch(404, { error: 'No encontrado' }),
    })
    await assert.rejects(
      () => req('GET', '/missing'),
      (err) => {
        assert.equal(err.code, 'NOT_FOUND')
        return true
      }
    )
  })

  it('injects Authorization header when session exists', async () => {
    let capturedHeaders = {}
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'test',
      getSession: () => ({ token: 'my-jwt' }),
      fetchFn: async (url, opts) => {
        capturedHeaders = opts.headers ?? {}
        return { ok: true, status: 200, json: async () => ({ data: 'ok' }), text: async () => '' }
      },
    })
    await req('GET', '/me')
    assert.equal(capturedHeaders['Authorization'], 'Bearer my-jwt')
  })

  it('injects X-Atlas-Company header on every request', async () => {
    let capturedHeaders = {}
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'myco',
      getSession: () => null,
      fetchFn: async (url, opts) => {
        capturedHeaders = opts.headers ?? {}
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
      },
    })
    await req('GET', '/anything')
    assert.equal(capturedHeaders['X-Atlas-Company'], 'myco')
  })

  it('supports empty 202 responses and forwards request options', async () => {
    let capturedOptions = null
    const signal = new AbortController().signal
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'myco',
      getSession: () => null,
      fetchFn: async (_url, options) => {
        capturedOptions = options
        return { ok: true, status: 202, text: async () => '' }
      },
    })

    const result = await req('POST', '/events', { ok: true }, {
      keepalive: true,
      signal,
      credentials: 'omit',
    })

    assert.equal(result, null)
    assert.equal(capturedOptions.keepalive, true)
    assert.equal(capturedOptions.signal, signal)
    assert.equal(capturedOptions.credentials, 'omit')
  })

  it('can return the raw Response when requested', async () => {
    const response = { ok: true, status: 204, text: async () => '' }
    const req = createRequestCore({
      baseUrl: 'https://example.com',
      company: 'myco',
      getSession: () => null,
      fetchFn: async () => response,
    })

    assert.equal(
      await req('GET', '/raw', null, { responseType: 'response' }),
      response,
    )
  })
})

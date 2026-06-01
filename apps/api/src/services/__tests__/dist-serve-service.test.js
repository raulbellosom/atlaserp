import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isAssetPath, resolveHtmlCandidates, injectSeoTags } from '../dist-serve-service.js'

describe('isAssetPath', () => {
  it('returns true for .js files', () => assert.equal(isAssetPath('/assets/main.js'), true))
  it('returns true for .css files', () => assert.equal(isAssetPath('/assets/style.css'), true))
  it('returns true for .png files', () => assert.equal(isAssetPath('/logo.png'), true))
  it('returns true for .woff2 files', () => assert.equal(isAssetPath('/font.woff2'), true))
  it('returns false for root path', () => assert.equal(isAssetPath('/'), false))
  it('returns false for clean routes', () => assert.equal(isAssetPath('/productos'), false))
  it('returns false for nested routes', () => assert.equal(isAssetPath('/bandas/rock-band'), false))
})

describe('resolveHtmlCandidates', () => {
  it('returns three candidates for a clean route', () => {
    const result = resolveHtmlCandidates('myco', '/productos/zapatos')
    assert.deepEqual(result, [
      'dist/myco/productos/zapatos/index.html',
      'dist/myco/productos/zapatos.html',
      'dist/myco/index.html',
    ])
  })

  it('returns only fallback for root path', () => {
    const result = resolveHtmlCandidates('myco', '/')
    assert.deepEqual(result, [
      'dist/myco/index.html',
      'dist/myco/index.html',
      'dist/myco/index.html',
    ])
  })
})

describe('injectSeoTags', () => {
  it('injects title when missing', () => {
    const html = '<html><head></head><body></body></html>'
    const seo = { title: 'Mi Sitio', description: 'Descripcion' }
    const result = injectSeoTags(html, seo)
    assert.ok(result.includes('<title>Mi Sitio</title>'))
    assert.ok(result.includes('<meta name="description"'))
  })

  it('does not overwrite existing title', () => {
    const html = '<html><head><title>Titulo Propio</title></head><body></body></html>'
    const seo = { title: 'Mi Sitio' }
    const result = injectSeoTags(html, seo)
    const titleCount = (result.match(/<title>/g) ?? []).length
    assert.equal(titleCount, 1)
    assert.ok(result.includes('Titulo Propio'))
  })

  it('returns html unchanged when seoDefaults is null', () => {
    const html = '<html><head></head><body></body></html>'
    const result = injectSeoTags(html, null)
    assert.equal(result, html)
  })
})

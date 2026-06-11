import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isAssetPath, resolveHtmlCandidates, injectSeoTags, rewriteDistHtml, injectAtlasConfig } from '../dist-serve-service.js'

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

describe('rewriteDistHtml', () => {
  const base = 'https://cdn.example.com/dist/myco'

  it('replaces localhost:PORT with siteOrigin in href attributes', () => {
    const html = '<html><head></head><body><a href="http://localhost:4321/about">Link</a></body></html>'
    const result = rewriteDistHtml(html, base, '', 'https://mysite.com')
    assert.ok(result.includes('href="https://mysite.com/about"'))
    assert.ok(!result.includes('localhost'))
  })

  it('replaces localhost:PORT in meta og:url content', () => {
    const html = '<html><head><meta property="og:url" content="http://localhost:4321/" /></head><body></body></html>'
    const result = rewriteDistHtml(html, base, '', 'https://mysite.com')
    assert.ok(result.includes('https://mysite.com/'))
    assert.ok(!result.includes('localhost'))
  })

  it('replaces localhost in inline script strings (e.g. Astro router config)', () => {
    const html = '<html><head><script>var base="http://localhost:4321";</script></head><body></body></html>'
    const result = rewriteDistHtml(html, base, '', 'https://mysite.com')
    assert.ok(result.includes('"https://mysite.com"'))
    assert.ok(!result.includes('localhost'))
  })

  it('leaves html unchanged when siteOrigin is empty', () => {
    const html = '<html><head></head><body><a href="http://localhost:4321/">x</a></body></html>'
    const result = rewriteDistHtml(html, base, '', '')
    assert.ok(result.includes('localhost:4321'))
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

describe('injectAtlasConfig', () => {
  const cfg = {
    supabaseUrl: 'https://supabase.racoondevs.com',
    supabaseAnonKey: 'eyJtest',
    apiUrl: 'https://mysite.com',
    company: 'acme',
    siteName: 'Acme Store',
    stripePublishableKey: 'pk_test_123',
    currency: 'usd',
  }

  it('injects window.ATLAS_CONFIG script into <head>', () => {
    const html = '<html><head></head><body></body></html>'
    const result = injectAtlasConfig(html, cfg)
    assert.ok(result.includes('window.ATLAS_CONFIG='))
    assert.ok(result.includes('supabase.racoondevs.com'))
    assert.ok(result.includes('eyJtest'))
  })

  it('computes storageKey from hostname', () => {
    const html = '<html><head></head><body></body></html>'
    const result = injectAtlasConfig(html, cfg)
    assert.ok(result.includes('"storageKey":"sb-supabase-auth-token"'))
  })

  it('injects company and siteName fields', () => {
    const html = '<html><head></head><body></body></html>'
    const result = injectAtlasConfig(html, cfg)
    assert.ok(result.includes('"company":"acme"'))
    assert.ok(result.includes('"siteName":"Acme Store"'))
  })

  it('injects stripePublishableKey and currency when provided', () => {
    const html = '<html><head></head><body></body></html>'
    const result = injectAtlasConfig(html, cfg)
    assert.ok(result.includes('"stripePublishableKey":"pk_test_123"'))
    assert.ok(result.includes('"currency":"usd"'))
  })

  it('omits stripePublishableKey when not provided', () => {
    const { stripePublishableKey: _, ...rest } = cfg
    const html = '<html><head></head><body></body></html>'
    const result = injectAtlasConfig(html, rest)
    assert.ok(!result.includes('stripePublishableKey'))
  })

  it('places script tag immediately after <head>', () => {
    const html = '<html><head><title>X</title></head><body></body></html>'
    const result = injectAtlasConfig(html, cfg)
    const headIdx   = result.indexOf('<head>')
    const scriptIdx = result.indexOf('<script>window.ATLAS_CONFIG')
    assert.ok(scriptIdx > headIdx && scriptIdx < result.indexOf('<title>'))
  })

  it('escapes </script> sequences in values', () => {
    const tricky = { ...cfg, supabaseAnonKey: 'a</script>b' }
    const html = '<html><head></head><body></body></html>'
    const result = injectAtlasConfig(html, tricky)
    assert.ok(!result.includes('</script>b'))
  })

  it('returns html unchanged when supabaseUrl is missing', () => {
    const html = '<html><head></head><body></body></html>'
    const result = injectAtlasConfig(html, { supabaseUrl: '', supabaseAnonKey: 'k', apiUrl: '/', company: '' })
    assert.equal(result, html)
  })
})

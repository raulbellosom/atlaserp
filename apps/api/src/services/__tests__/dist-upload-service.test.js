import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findRootPrefix, getMimeType, detectPrerender } from '../dist-upload-service.js'

describe('findRootPrefix', () => {
  it('returns empty string when index.html is at zip root', () => {
    const files = ['index.html', 'assets/main.js', 'assets/style.css']
    assert.equal(findRootPrefix(files), '')
  })

  it('returns prefix when index.html is inside a single folder', () => {
    const files = ['dist/index.html', 'dist/assets/main.js']
    assert.equal(findRootPrefix(files), 'dist/')
  })

  it('returns null when no index.html found', () => {
    const files = ['assets/main.js', 'README.md']
    assert.equal(findRootPrefix(files), null)
  })

  it('returns null when index.html is nested more than one level', () => {
    const files = ['output/dist/index.html']
    assert.equal(findRootPrefix(files), null)
  })
})

describe('getMimeType', () => {
  it('returns correct MIME for html', () => assert.equal(getMimeType('index.html'), 'text/html'))
  it('returns correct MIME for js', () => assert.equal(getMimeType('main.js'), 'application/javascript'))
  it('returns correct MIME for css', () => assert.equal(getMimeType('style.css'), 'text/css'))
  it('returns correct MIME for png', () => assert.equal(getMimeType('logo.png'), 'image/png'))
  it('returns octet-stream for unknown', () => assert.equal(getMimeType('file.xyz'), 'application/octet-stream'))
})

describe('detectPrerender', () => {
  it('returns false when only root index.html exists', () => {
    const paths = ['index.html', 'assets/main.js']
    assert.equal(detectPrerender(paths), false)
  })

  it('returns true when route-level HTML files exist', () => {
    const paths = ['index.html', 'productos/index.html', 'assets/main.js']
    assert.equal(detectPrerender(paths), true)
  })

  it('returns true when flat route HTML files exist', () => {
    const paths = ['index.html', 'contacto.html']
    assert.equal(detectPrerender(paths), true)
  })
})

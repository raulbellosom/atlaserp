import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Verify all expected exports exist without importing React
// (React is a peer dep — not installed in this package)
import * as reactExports from '../react/index.js'

describe('@raulbellosom/atlas-sdk/react exports', () => {
  it('exports StorefrontProvider', () => {
    assert.equal(typeof reactExports.StorefrontProvider, 'function')
  })

  it('exports useStorefront', () => {
    assert.equal(typeof reactExports.useStorefront, 'function')
  })

  it('exports useSession', () => {
    assert.equal(typeof reactExports.useSession, 'function')
  })

  it('exports useAuth', () => {
    assert.equal(typeof reactExports.useAuth, 'function')
  })

  it('exports useFileUpload', () => {
    assert.equal(typeof reactExports.useFileUpload, 'function')
  })

  it('exports useBlueprints', () => {
    assert.equal(typeof reactExports.useBlueprints, 'function')
  })

  it('exports useHasModule', () => {
    assert.equal(typeof reactExports.useHasModule, 'function')
  })

  it('exports useProducts', () => {
    assert.equal(typeof reactExports.useProducts, 'function')
  })

  it('exports useProduct', () => {
    assert.equal(typeof reactExports.useProduct, 'function')
  })

  it('exports useCategories', () => {
    assert.equal(typeof reactExports.useCategories, 'function')
  })

  it('exports useCompanyConfig', () => {
    assert.equal(typeof reactExports.useCompanyConfig, 'function')
  })

  it('exports useRequest', () => {
    assert.equal(typeof reactExports.useRequest, 'function')
  })

  it('exports analytics and public form hooks', () => {
    assert.equal(typeof reactExports.useAnalytics, 'function')
    assert.equal(typeof reactExports.usePageView, 'function')
    assert.equal(typeof reactExports.usePublicForm, 'function')
  })
})

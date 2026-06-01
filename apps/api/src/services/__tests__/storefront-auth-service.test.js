import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateRegistrableRole, buildStorefrontUserProfile } from '../storefront-auth-service.js'

describe('validateRegistrableRole', () => {
  it('returns true when role is in the allowed list', () => {
    const allowed = ['storefront_client', 'storefront_vendor']
    assert.equal(validateRegistrableRole('storefront_client', allowed), true)
    assert.equal(validateRegistrableRole('storefront_vendor', allowed), true)
  })

  it('returns false when role is not in the allowed list', () => {
    const allowed = ['storefront_client', 'storefront_vendor']
    assert.equal(validateRegistrableRole('admin', allowed), false)
    assert.equal(validateRegistrableRole('owner', allowed), false)
    assert.equal(validateRegistrableRole('', allowed), false)
  })

  it('returns false when allowed list is empty', () => {
    assert.equal(validateRegistrableRole('storefront_client', []), false)
  })
})

describe('buildStorefrontUserProfile', () => {
  it('maps a UserProfile row to the public shape', () => {
    const profile = {
      id: 'abc-123',
      displayName: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: null,
      bio: null,
      enabled: true,
    }
    const role = { key: 'storefront_client', name: 'Cliente' }
    const result = buildStorefrontUserProfile(profile, role)
    assert.deepEqual(result, {
      id: 'abc-123',
      displayName: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: null,
      bio: null,
      role: 'storefront_client',
    })
  })
})

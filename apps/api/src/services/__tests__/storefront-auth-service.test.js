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

  it('maps a UserProfile row to the public shape with hasErpAccess false by default', () => {
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
      hasErpAccess: false,
    })
  })

  it('returns hasErpAccess false when rolePermissionKeys does not include platform.erp.access', () => {
    const result = buildStorefrontUserProfile(profile, role, ['platform.contacts.read'])
    assert.equal(result.hasErpAccess, false)
  })

  it('returns hasErpAccess true when rolePermissionKeys includes platform.erp.access', () => {
    const result = buildStorefrontUserProfile(profile, role, ['platform.erp.access', 'platform.contacts.read'])
    assert.equal(result.hasErpAccess, true)
  })
})

describe('buildStorefrontUserProfile with non-storefront role', () => {
  it('returns profile with ERP role and hasErpAccess true when permission is present', () => {
    const profile = {
      id: 'erp-user-1',
      displayName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      phone: null,
      bio: null,
      enabled: true,
    }
    const role = { key: 'admin', name: 'Administrador' }
    const result = buildStorefrontUserProfile(profile, role, ['platform.erp.access'])
    assert.equal(result.role, 'admin')
    assert.equal(result.displayName, 'Admin User')
    assert.equal(result.id, 'erp-user-1')
    assert.equal(result.hasErpAccess, true)
  })
})

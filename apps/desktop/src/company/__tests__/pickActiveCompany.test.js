import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pickActiveCompany } from '../pickActiveCompany.js'

describe('pickActiveCompany', () => {
  it('returns null when the user has no companies', () => {
    assert.equal(pickActiveCompany({ companies: [], storedId: null }), null)
  })

  it('picks the only company when there is exactly one, ignoring any stale stored id', () => {
    const companies = [{ id: 'A' }]
    assert.equal(pickActiveCompany({ companies, storedId: 'ghost' }), 'A')
  })

  it('keeps the stored id when it still names a company the user belongs to', () => {
    const companies = [{ id: 'A' }, { id: 'B' }]
    assert.equal(pickActiveCompany({ companies, storedId: 'B' }), 'B')
  })

  it('never returns a stored id that is not in the current companies list', () => {
    const companies = [{ id: 'A' }, { id: 'B' }]
    assert.equal(pickActiveCompany({ companies, storedId: 'ghost' }), 'A')
  })

  it('falls back to the first company when nothing valid is stored', () => {
    const companies = [{ id: 'A' }, { id: 'B' }]
    assert.equal(pickActiveCompany({ companies, storedId: null }), 'A')
  })

  it('compares ids as strings, so a numeric-looking id still matches', () => {
    const companies = [{ id: 7 }, { id: 8 }]
    assert.equal(pickActiveCompany({ companies, storedId: '8' }), '8')
  })
})

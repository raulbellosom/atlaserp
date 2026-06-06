import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createSyncService, SyncServiceError } from '../sync-service.js'

const COMPANY_ID = '01900000-0000-7000-8000-000000000001'
const USER_ID = '01900000-0000-7000-8000-000000000002'
const now = new Date()
const past = new Date(now.getTime() - 60_000)

function makePrisma(overrides = {}) {
  return {
    userProfile: {
      findUnique: async () => ({ id: USER_ID }),
      ...(overrides.userProfile ?? {}),
    },
    membership: {
      findFirst: async () => ({ companyId: COMPANY_ID }),
      ...(overrides.membership ?? {}),
    },
    contact: {
      findMany: async () => [],
      ...(overrides.contact ?? {}),
    },
    hrEmployee: {
      findMany: async () => [],
      ...(overrides.hrEmployee ?? {}),
    },
    hrDepartment: {
      findMany: async () => [],
      ...(overrides.hrDepartment ?? {}),
    },
    hrJobTitle: {
      findMany: async () => [],
      ...(overrides.hrJobTitle ?? {}),
    },
    fleetVehicle: {
      findMany: async () => [],
      ...(overrides.fleetVehicle ?? {}),
    },
    fleetDriver: {
      findMany: async () => [],
      ...(overrides.fleetDriver ?? {}),
    },
    syncCursor: {
      findMany: async () => [],
      ...(overrides.syncCursor ?? {}),
    },
  }
}

describe('sync-service', () => {
  it('returns empty records when no modules requested', async () => {
    const svc = createSyncService({ prisma: makePrisma() })
    const result = await svc.pull({ authUserId: USER_ID, modules: [], cursor: null })
    assert.deepEqual(result, { records: [], nextCursor: null, hasMore: false })
  })

  it('throws profile_not_found when user has no profile', async () => {
    const prisma = makePrisma({ userProfile: { findUnique: async () => null } })
    const svc = createSyncService({ prisma })
    await assert.rejects(
      () => svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: null }),
      (err) => err instanceof SyncServiceError && err.code === 'profile_not_found',
    )
  })

  it('throws no_active_company when user has no membership', async () => {
    const prisma = makePrisma({ membership: { findFirst: async () => null } })
    const svc = createSyncService({ prisma })
    await assert.rejects(
      () => svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: null }),
      (err) => err instanceof SyncServiceError && err.code === 'no_active_company',
    )
  })

  it('returns contacts for atlas.contacts module', async () => {
    const contact = { id: 'c1', companyId: COMPANY_ID, type: 'person', name: 'Ana', updatedAt: now, createdAt: past }
    const svc = createSyncService({ prisma: makePrisma({ contact: { findMany: async () => [contact] } }) })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: null })
    assert.equal(result.records.length, 1)
    assert.equal(result.records[0].moduleKey, 'atlas.contacts')
    assert.equal(result.records[0].entityType, 'contact')
    assert.equal(result.records[0].id, 'c1')
    assert.equal(result.records[0].deleted, false)
    assert.ok(result.nextCursor)
  })

  it('passes cursor as Date gt filter when provided', async () => {
    let capturedWhere = null
    const svc = createSyncService({
      prisma: makePrisma({
        contact: { findMany: async ({ where }) => { capturedWhere = where; return [] } },
      }),
    })
    const cursorStr = past.toISOString()
    await svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: cursorStr })
    assert.ok(capturedWhere?.updatedAt?.gt instanceof Date)
    assert.equal(capturedWhere.updatedAt.gt.toISOString(), cursorStr)
  })

  it('returns employee, department, job_title for atlas.hr module', async () => {
    const employee = { id: 'e1', companyId: COMPANY_ID, firstName: 'Juan', lastName: 'Paz', status: 'active', updatedAt: now, createdAt: past }
    const department = { id: 'd1', companyId: COMPANY_ID, name: 'TI', enabled: true, updatedAt: now, createdAt: past }
    const jobTitle = { id: 'jt1', companyId: COMPANY_ID, name: 'Dev', enabled: true, updatedAt: now, createdAt: past }
    const svc = createSyncService({
      prisma: makePrisma({
        hrEmployee: { findMany: async () => [employee] },
        hrDepartment: { findMany: async () => [department] },
        hrJobTitle: { findMany: async () => [jobTitle] },
      }),
    })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.hr'], cursor: null })
    const types = result.records.map((r) => r.entityType)
    assert.ok(types.includes('employee'))
    assert.ok(types.includes('department'))
    assert.ok(types.includes('job_title'))
  })

  it('returns vehicle and driver for custom.fleet module', async () => {
    const vehicle = { id: 'v1', companyId: COMPANY_ID, plate: 'ABC-123', status: 'active', updatedAt: now, createdAt: past }
    const driver = { id: 'dr1', companyId: COMPANY_ID, firstName: 'Luis', lastName: 'Vega', phone: '555', licenseNumber: 'L1', status: 'active', updatedAt: now, createdAt: past }
    const svc = createSyncService({
      prisma: makePrisma({
        fleetVehicle: { findMany: async () => [vehicle] },
        fleetDriver: { findMany: async () => [driver] },
      }),
    })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['custom.fleet'], cursor: null })
    const types = result.records.map((r) => r.entityType)
    assert.ok(types.includes('vehicle'))
    assert.ok(types.includes('driver'))
  })

  it('sets nextCursor to max version across all returned records', async () => {
    const older = new Date('2026-06-01T00:00:00Z')
    const newer = new Date('2026-06-02T00:00:00Z')
    const c1 = { id: 'c1', companyId: COMPANY_ID, type: 'person', name: 'A', updatedAt: older, createdAt: older }
    const c2 = { id: 'c2', companyId: COMPANY_ID, type: 'person', name: 'B', updatedAt: newer, createdAt: older }
    const svc = createSyncService({ prisma: makePrisma({ contact: { findMany: async () => [c1, c2] } }) })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.contacts'], cursor: null })
    assert.equal(result.nextCursor, newer.toISOString())
  })

  it('silently skips unknown module keys', async () => {
    const svc = createSyncService({ prisma: makePrisma() })
    const result = await svc.pull({ authUserId: USER_ID, modules: ['atlas.unknown_module_xyz'], cursor: null })
    assert.equal(result.records.length, 0)
    assert.equal(result.hasMore, false)
  })

  it('returns sync cursor status via getStatus()', async () => {
    const cursors = [{ moduleKey: 'atlas.contacts', entityType: 'contact', cursor: now, updatedAt: now }]
    const svc = createSyncService({ prisma: makePrisma({ syncCursor: { findMany: async () => cursors } }) })
    const result = await svc.getStatus({ authUserId: USER_ID })
    assert.equal(result.length, 1)
    assert.equal(result[0].moduleKey, 'atlas.contacts')
    assert.equal(result[0].entityType, 'contact')
    assert.ok(result[0].cursor)
  })
})

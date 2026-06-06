import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createSyncPushService, SyncPushServiceError } from '../sync-push-service.js'

const COMPANY_ID = '01900000-0000-7000-8000-000000000001'
const USER_ID = '01900000-0000-7000-8000-000000000002'
const IK = '01900000-0000-7000-8000-000000000099'
const RECORD_ID = '01900000-0000-7000-8000-000000000010'
const now = new Date()

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
    syncMutationLog: {
      findUnique: async () => null,
      create: async (args) => ({ id: 'log-1', ...args.data }),
      ...(overrides.syncMutationLog ?? {}),
    },
    contact: {
      findUnique: async ({ where }) => ({
        id: where.id,
        companyId: COMPANY_ID,
        name: 'Ana',
        type: 'person',
        updatedAt: now,
        createdAt: now,
      }),
      create: async ({ data }) => ({ id: data.id ?? 'new-c1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, companyId: COMPANY_ID, updatedAt: now, ...data }),
      ...(overrides.contact ?? {}),
    },
    hrEmployee: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'e1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.hrEmployee ?? {}),
    },
    hrDepartment: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'd1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.hrDepartment ?? {}),
    },
    hrJobTitle: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'jt1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.hrJobTitle ?? {}),
    },
    fleetVehicle: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'v1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.fleetVehicle ?? {}),
    },
    fleetDriver: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'dr1', updatedAt: now, ...data }),
      update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      ...(overrides.fleetDriver ?? {}),
    },
  }
}

describe('sync-push-service', () => {
  it('returns empty results when mutations array is empty', async () => {
    const svc = createSyncPushService({ prisma: makePrisma() })
    const result = await svc.push({ authUserId: USER_ID, mutations: [] })
    assert.deepEqual(result, { results: [] })
  })

  it('throws profile_not_found when user has no profile', async () => {
    const prisma = makePrisma({ userProfile: { findUnique: async () => null } })
    const svc = createSyncPushService({ prisma })
    await assert.rejects(
      () => svc.push({ authUserId: USER_ID, mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null, payload: { name: 'X', type: 'person' } }] }),
      (err) => err instanceof SyncPushServiceError && err.code === 'profile_not_found',
    )
  })

  it('throws no_active_company when user has no membership', async () => {
    const prisma = makePrisma({ membership: { findFirst: async () => null } })
    const svc = createSyncPushService({ prisma })
    await assert.rejects(
      () => svc.push({ authUserId: USER_ID, mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null, payload: {} }] }),
      (err) => err instanceof SyncPushServiceError && err.code === 'no_active_company',
    )
  })

  it('returns OK without re-applying when idempotencyKey already in SyncMutationLog', async () => {
    const prisma = makePrisma({
      syncMutationLog: { findUnique: async () => ({ id: 'log-1', idempotencyKey: IK, recordId: RECORD_ID }) },
      contact: { findUnique: async ({ where }) => ({ id: where.id, companyId: COMPANY_ID, name: 'Ana', updatedAt: now }) },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: RECORD_ID, payload: { name: 'Ana' } }],
    })
    assert.equal(result.results.length, 1)
    assert.equal(result.results[0].status, 'OK')
  })

  it('CREATE contact returns OK with the created record', async () => {
    let createCalled = false
    const prisma = makePrisma({
      contact: {
        findUnique: async () => null,
        create: async ({ data }) => { createCalled = true; return { id: 'new-c1', updatedAt: now, ...data } },
        update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null, payload: { name: 'Bob', type: 'person' } }],
    })
    assert.equal(result.results.length, 1)
    assert.equal(result.results[0].status, 'OK')
    assert.ok(result.results[0].record)
    assert.ok(createCalled)
  })

  it('UPDATE contact returns OK with the updated record', async () => {
    let updateCalled = false
    const prisma = makePrisma({
      contact: {
        findUnique: async ({ where }) => ({ id: where.id, companyId: COMPANY_ID, name: 'Old', updatedAt: now }),
        create: async ({ data }) => ({ id: 'x', updatedAt: now, ...data }),
        update: async ({ where, data }) => { updateCalled = true; return { id: where.id, companyId: COMPANY_ID, updatedAt: now, ...data } },
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: RECORD_ID, payload: { name: 'New' } }],
    })
    assert.equal(result.results[0].status, 'OK')
    assert.equal(result.results[0].record.name, 'New')
    assert.ok(updateCalled)
  })

  it('UPDATE on nonexistent record returns NOT_FOUND', async () => {
    const prisma = makePrisma({
      contact: {
        findUnique: async () => null,
        create: async ({ data }) => ({ id: 'x', updatedAt: now, ...data }),
        update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: 'nonexistent-id', payload: {} }],
    })
    assert.equal(result.results[0].status, 'NOT_FOUND')
  })

  it('UPDATE on record from different company returns PERMISSION_DENIED', async () => {
    const OTHER_COMPANY = '01900000-0000-7000-8000-000000000999'
    const prisma = makePrisma({
      contact: {
        findUnique: async ({ where }) => ({ id: where.id, companyId: OTHER_COMPANY, name: 'X', updatedAt: now }),
        create: async ({ data }) => ({ id: 'x', updatedAt: now, ...data }),
        update: async ({ where, data }) => ({ id: where.id, updatedAt: now, ...data }),
      },
    })
    const svc = createSyncPushService({ prisma })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: RECORD_ID, payload: {} }],
    })
    assert.equal(result.results[0].status, 'PERMISSION_DENIED')
  })

  it('unknown moduleKey returns ERROR result', async () => {
    const svc = createSyncPushService({ prisma: makePrisma() })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.unknown_xyz', entityType: 'widget', operation: 'CREATE', recordId: null, payload: {} }],
    })
    assert.equal(result.results[0].status, 'ERROR')
  })

  it('unsupported operation returns ERROR result', async () => {
    const svc = createSyncPushService({ prisma: makePrisma() })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [{ idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'DELETE', recordId: RECORD_ID, payload: {} }],
    })
    assert.equal(result.results[0].status, 'ERROR')
  })

  it('batch with CREATE + UPDATE returns two results in order', async () => {
    const IK2 = '01900000-0000-7000-8000-000000000098'
    const svc = createSyncPushService({ prisma: makePrisma() })
    const result = await svc.push({
      authUserId: USER_ID,
      mutations: [
        { idempotencyKey: IK, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null, payload: { name: 'New1', type: 'person' } },
        { idempotencyKey: IK2, moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: RECORD_ID, payload: { name: 'Updated' } },
      ],
    })
    assert.equal(result.results.length, 2)
    assert.equal(result.results[0].status, 'OK')
    assert.equal(result.results[1].status, 'OK')
  })
})

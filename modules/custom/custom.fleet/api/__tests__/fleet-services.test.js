import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFleetService, FleetServiceError } from '../fleet-service.js'
import { createDriverService } from '../driver-service.js'
import { createCatalogService } from '../catalog-service.js'

const COMPANY_ID = '11111111-1111-7111-a111-111111111111'

function createPrismaMock({ rawResponses = [], rawUnsafeResponses = [] } = {}) {
  const rawCalls = []
  const rawUnsafeCalls = []
  const rawQueue = [...rawResponses]
  const rawUnsafeQueue = [...rawUnsafeResponses]

  return {
    rawCalls,
    rawUnsafeCalls,
    prisma: {
      auditLog: { create: async () => ({ id: 'audit-1' }) },
      fileAsset: { findMany: async () => [] },
      $queryRaw: async (...args) => {
        rawCalls.push(args)
        const next = rawQueue.shift()
        if (next instanceof Error) throw next
        return next ?? []
      },
      $queryRawUnsafe: async (...args) => {
        rawUnsafeCalls.push(args)
        const next = rawUnsafeQueue.shift()
        if (next instanceof Error) throw next
        return next ?? []
      },
    },
  }
}

test('fleet-service listVehicles: returns rows and uses company-scoped UUID', async () => {
  const { prisma, rawCalls } = createPrismaMock({
    rawResponses: [
      [{ id: 'veh-1', plate: 'ABC123' }],
      [{ total: '1' }],
    ],
  })
  const service = createFleetService({ prisma })
  const result = await service.listVehicles({ companyId: COMPANY_ID, page: 1, pageSize: 10 })

  assert.equal(result.data.length, 1)
  assert.equal(result.pagination.total, 1)
  const firstValues = rawCalls[0].slice(1)
  assert.ok(firstValues.includes(COMPANY_ID))
})

test('fleet-service createVehicle: maps unique violation to 409', async () => {
  const uniqueError = new Error('duplicate key value violates unique constraint')
  uniqueError.code = '23505'
  const { prisma } = createPrismaMock({
    rawResponses: [uniqueError],
  })
  const service = createFleetService({ prisma })

  await assert.rejects(
    () =>
      service.createVehicle({
        companyId: COMPANY_ID,
        actorId: 'actor-1',
        data: { plate: 'ABC123', brand: 'Marca', model_name: 'Modelo', year: 2024 },
      }),
    (error) => error instanceof FleetServiceError && error.status === 409
  )
})

test('fleet-service createVehicle: strips leading zeros from economic numbers before insert', async () => {
  const { prisma, rawCalls } = createPrismaMock({
    rawResponses: [[{ id: 'veh-1', plate: 'ABC123' }]],
  })
  const service = createFleetService({ prisma })

  await service.createVehicle({
    companyId: COMPANY_ID,
    actorId: 'actor-1',
    data: {
      plate: 'ABC123',
      brand: 'Marca',
      model_name: 'Modelo',
      year: 2024,
      economic_group_number: '0012',
      economic_individual_number: '0042',
    },
  })

  const insertValues = rawCalls[0].slice(1)
  assert.ok(insertValues.includes('12'))
  assert.ok(insertValues.includes('42'))
  assert.ok(!insertValues.includes('0012'))
  assert.ok(!insertValues.includes('0042'))
})

test('fleet-service updateVehicle: rejects empty payload with 400', async () => {
  const { prisma } = createPrismaMock()
  const service = createFleetService({ prisma })

  await assert.rejects(
    () =>
      service.updateVehicle({
        companyId: COMPANY_ID,
        id: 'b2f8f6c0-30dd-7f1f-9832-cf0f2d8f2d5e',
        data: {},
        actorId: 'actor-1',
      }),
    (error) => error instanceof FleetServiceError && error.status === 400
  )
})

test('fleet-service updateVehicle: strips leading zeros from economic numbers before update', async () => {
  const vehicleId = 'b2f8f6c0-30dd-7f1f-9832-cf0f2d8f2d5e'
  const { prisma, rawCalls } = createPrismaMock({
    rawResponses: [
      [{ id: vehicleId, plate: 'ABC123' }],
      [{ id: vehicleId, plate: 'ABC123' }],
    ],
  })
  const service = createFleetService({ prisma })

  await service.updateVehicle({
    companyId: COMPANY_ID,
    id: vehicleId,
    actorId: 'actor-1',
    data: {
      economic_group_number: '0007',
      economic_individual_number: '0089',
    },
  })

  const updateValues = rawCalls[1].slice(1)
  assert.ok(updateValues.includes('7'))
  assert.ok(updateValues.includes('89'))
  assert.ok(!updateValues.includes('0007'))
  assert.ok(!updateValues.includes('0089'))
})

test('driver-service listDrivers: uses company-scoped UUID in unsafe query', async () => {
  const { prisma, rawUnsafeCalls } = createPrismaMock({
    rawUnsafeResponses: [
      [{ id: 'drv-1', first_name: 'Ana', last_name: 'Lara' }],
      [{ total: '1' }],
    ],
  })
  const service = createDriverService({ prisma })
  const result = await service.listDrivers({ companyId: COMPANY_ID, page: 1, pageSize: 10 })

  assert.equal(result.data.length, 1)
  const firstUnsafeCall = rawUnsafeCalls[0]
  assert.equal(firstUnsafeCall[1], COMPANY_ID)
  const sqlText = firstUnsafeCall[0]
  assert.match(sqlText, /LEFT JOIN LATERAL/i)
  assert.match(sqlText, /assigned_vehicle_count/i)
  assert.match(sqlText, /assigned_vehicle_extra_count/i)
  assert.doesNotMatch(sqlText, /LEFT JOIN fleet_vehicle v ON/i)
})

test('fleet-service listVehicles: query projects full_economic_number field', async () => {
  const { prisma, rawCalls } = createPrismaMock({
    rawResponses: [[], [{ total: '0' }]],
  })
  const service = createFleetService({ prisma })

  await service.listVehicles({ companyId: COMPANY_ID, page: 1, pageSize: 10 })

  const sqlText = rawCalls[0][0].join(' ')
  assert.match(sqlText, /AS full_economic_number/)
})

test('catalog-service updateVehicleType: rejects payload without updatable fields', async () => {
  const { prisma } = createPrismaMock()
  const service = createCatalogService({ prisma })

  await assert.rejects(
    () =>
      service.updateVehicleType({
        companyId: COMPANY_ID,
        actorId: 'actor-1',
        id: 'b2f8f6c0-30dd-7f1f-9832-cf0f2d8f2d5e',
        payload: {},
      }),
    (error) => error instanceof FleetServiceError && error.status === 400
  )
})

test('catalog-service createVehicleType: strips leading zeros from economic group number', async () => {
  const { prisma, rawCalls } = createPrismaMock({
    rawResponses: [[{ id: 'vt-1', name: 'Pickup', economic_group_number: '9' }]],
  })
  const service = createCatalogService({ prisma })

  await service.createVehicleType({
    companyId: COMPANY_ID,
    actorId: 'actor-1',
    payload: {
      name: 'Pickup',
      economic_group_number: '0009',
    },
  })

  const insertValues = rawCalls[0].slice(1)
  assert.ok(insertValues.includes('9'))
  assert.ok(!insertValues.includes('0009'))
})

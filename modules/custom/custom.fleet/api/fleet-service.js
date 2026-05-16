import { createHash } from 'node:crypto'
import {
  normalizePagination,
  normalizeSearch,
  normalizeOptionalString,
  isTableNotFoundError,
  isUniqueViolation,
  toCount,
  firstRow,
  hasOwn,
} from './service-helpers.js'

const MODULE_KEY = 'custom.fleet'
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class FleetServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'FleetServiceError'
    this.status = status
  }
}

function normalizeVehiclePayload(data = {}) {
  return {
    ...data,
    plate: data.plate === undefined ? undefined : String(data.plate).trim(),
    brand: data.brand === undefined ? undefined : String(data.brand).trim(),
    model_name: data.model_name === undefined ? undefined : String(data.model_name).trim(),
    color: normalizeOptionalString(data.color),
    notes: normalizeOptionalString(data.notes),
    vehicle_model_id: normalizeOptionalString(data.vehicle_model_id),
  }
}

function ensureCompanyId(companyId) {
  if (typeof companyId === 'string' && companyId.trim()) return companyId.trim()
  throw new FleetServiceError('companyId es requerido.', 400)
}

function toScopedCompanyUuid(companyId) {
  const normalized = ensureCompanyId(companyId)
  if (UUID_REGEX.test(normalized)) return normalized.toLowerCase()

  const hash = createHash('sha256').update(`${MODULE_KEY}:${normalized}`).digest('hex')
  const p1 = hash.slice(0, 8)
  const p2 = hash.slice(8, 12)
  const p3 = `5${hash.slice(13, 16)}`
  const p4 = `a${hash.slice(17, 20)}`
  const p5 = hash.slice(20, 32)
  return `${p1}-${p2}-${p3}-${p4}-${p5}`
}

function normalizeRecordId(id, notFoundMessage) {
  const value = String(id ?? '').trim()
  if (!UUID_REGEX.test(value)) {
    throw new FleetServiceError(notFoundMessage, 404)
  }
  return value.toLowerCase()
}

async function withDbErrorMapping(fn) {
  try {
    return await fn()
  } catch (error) {
    if (isTableNotFoundError(error)) {
      throw new FleetServiceError('Las tablas del modulo no estan disponibles aun.', 503)
    }
    throw error
  }
}

export function createFleetService({ prisma }) {
  async function logAudit({
    actorId,
    entityType,
    entityId,
    action,
    before = null,
    after = null,
    metadata = null,
  }) {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: MODULE_KEY,
        entityType,
        entityId: entityId ?? null,
        action,
        before,
        after,
        metadata,
      },
    })
  }

  async function listVehicles({ companyId, page, pageSize, status, search }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const pagination = normalizePagination({ page, pageSize })
    const normalizedStatus = normalizeOptionalString(status)
    const normalizedSearch = normalizeSearch(search)
    const likeValue = normalizedSearch ? `%${normalizedSearch}%` : null

    const [rows, totalRows] = await withDbErrorMapping(async () => {
      const dataRows = await prisma.$queryRaw`
        SELECT
          fv.*,
          vm.name AS vehicle_model_name,
          vm.year AS vehicle_model_year,
          COALESCE(vb_m.name, vb.name) AS vehicle_brand_name,
          COALESCE(vt_m.name, vt.name) AS vehicle_type_name,
          COALESCE(vt_m.economic_group_number, vt.economic_group_number, fv.economic_group_number) AS economic_group_number_resolved,
          CASE
            WHEN COALESCE(vt_m.economic_group_number, vt.economic_group_number, fv.economic_group_number) IS NOT NULL
              AND fv.economic_individual_number IS NOT NULL
              THEN COALESCE(vt_m.economic_group_number, vt.economic_group_number, fv.economic_group_number) || '-' || fv.economic_individual_number
            ELSE NULL
          END AS economic_number
        FROM fleet_vehicle fv
        LEFT JOIN fleet_vehicle_model vm ON vm.id = fv.vehicle_model_id
        LEFT JOIN fleet_vehicle_brand vb_m ON vb_m.id = vm.brand_id
        LEFT JOIN fleet_vehicle_type vt_m ON vt_m.id = vm.type_id
        LEFT JOIN fleet_vehicle_type vt ON vt.id = fv.vehicle_type_id
        LEFT JOIN fleet_vehicle_brand vb ON vb.id = fv.vehicle_brand_id
        WHERE fv.company_id = ${safeCompanyId}
          AND fv.enabled = true
          AND (${normalizedStatus}::text IS NULL OR fv.status = ${normalizedStatus})
          AND (
            ${likeValue}::text IS NULL
            OR fv.plate ILIKE ${likeValue}
            OR fv.brand ILIKE ${likeValue}
            OR fv.model_name ILIKE ${likeValue}
            OR vm.name ILIKE ${likeValue}
            OR vb_m.name ILIKE ${likeValue}
          )
        ORDER BY fv.created_at DESC
        LIMIT ${pagination.pageSize}
        OFFSET ${pagination.offset}
      `

      const countRows = await prisma.$queryRaw`
        SELECT COUNT(*)::bigint AS total
        FROM fleet_vehicle fv
        LEFT JOIN fleet_vehicle_model vm ON vm.id = fv.vehicle_model_id
        LEFT JOIN fleet_vehicle_brand vb_m ON vb_m.id = vm.brand_id
        WHERE fv.company_id = ${safeCompanyId}
          AND fv.enabled = true
          AND (${normalizedStatus}::text IS NULL OR fv.status = ${normalizedStatus})
          AND (
            ${likeValue}::text IS NULL
            OR fv.plate ILIKE ${likeValue}
            OR fv.brand ILIKE ${likeValue}
            OR fv.model_name ILIKE ${likeValue}
            OR vm.name ILIKE ${likeValue}
            OR vb_m.name ILIKE ${likeValue}
          )
      `
      return [dataRows, countRows]
    })

    return {
      data: rows,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: toCount(firstRow(totalRows)?.total),
      },
    }
  }

  async function getVehicle({ companyId, id }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeId = normalizeRecordId(id, 'Vehiculo no encontrado.')
    const row = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        SELECT
          fv.*,
          vm.name AS vehicle_model_name,
          vm.year AS vehicle_model_year,
          COALESCE(vb_m.name, vb.name) AS vehicle_brand_name,
          COALESCE(vt_m.name, vt.name) AS vehicle_type_name,
          COALESCE(vt_m.economic_group_number, vt.economic_group_number, fv.economic_group_number) AS economic_group_number_resolved,
          CASE
            WHEN COALESCE(vt_m.economic_group_number, vt.economic_group_number, fv.economic_group_number) IS NOT NULL
              AND fv.economic_individual_number IS NOT NULL
              THEN COALESCE(vt_m.economic_group_number, vt.economic_group_number, fv.economic_group_number) || '-' || fv.economic_individual_number
            ELSE NULL
          END AS economic_number
        FROM fleet_vehicle fv
        LEFT JOIN fleet_vehicle_model vm ON vm.id = fv.vehicle_model_id
        LEFT JOIN fleet_vehicle_brand vb_m ON vb_m.id = vm.brand_id
        LEFT JOIN fleet_vehicle_type vt_m ON vt_m.id = vm.type_id
        LEFT JOIN fleet_vehicle_type vt ON vt.id = fv.vehicle_type_id
        LEFT JOIN fleet_vehicle_brand vb ON vb.id = fv.vehicle_brand_id
        WHERE fv.id = ${safeId}
          AND fv.company_id = ${safeCompanyId}
        LIMIT 1
      `
      return firstRow(rows)
    })

    if (!row) throw new FleetServiceError('Vehiculo no encontrado.', 404)
    return row
  }

  async function createVehicle({ companyId, data, actorId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const payload = normalizeVehiclePayload(data)

    try {
      const row = await withDbErrorMapping(async () => {
        const rows = await prisma.$queryRaw`
          INSERT INTO fleet_vehicle (
            company_id,
            plate,
            brand,
            model_name,
            year,
            color,
            status,
            driver_id,
            notes,
            economic_group_number,
            economic_individual_number,
            vehicle_type_id,
            vehicle_brand_id,
            vehicle_model_id
          )
          VALUES (
            ${safeCompanyId},
            ${payload.plate},
            ${payload.brand ?? null},
            ${payload.model_name ?? null},
            ${payload.year ?? null},
            ${payload.color ?? null},
            ${payload.status ?? 'active'},
            ${payload.driver_id ?? null},
            ${payload.notes ?? null},
            ${payload.economic_group_number ?? null},
            ${payload.economic_individual_number ?? null},
            ${payload.vehicle_type_id ?? null},
            ${payload.vehicle_brand_id ?? null},
            ${payload.vehicle_model_id ?? null}
          )
          RETURNING *
        `
        return firstRow(rows)
      })

      await logAudit({
        actorId,
        entityType: 'Vehicle',
        entityId: row?.id ?? null,
        action: 'fleet.vehicle.create',
        before: null,
        after: row,
      })

      return row
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new FleetServiceError('Ya existe un vehiculo con esa matricula.', 409)
      }
      throw error
    }
  }

  async function updateVehicle({ companyId, id, data, actorId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeId = normalizeRecordId(id, 'Vehiculo no encontrado.')
    const payload = normalizeVehiclePayload(data)

    const hasPlate = hasOwn(payload, 'plate') && payload.plate !== undefined
    const hasBrand = hasOwn(payload, 'brand') && payload.brand !== undefined
    const hasModelName = hasOwn(payload, 'model_name') && payload.model_name !== undefined
    const hasYear = hasOwn(payload, 'year') && payload.year !== undefined
    const hasStatus = hasOwn(payload, 'status') && payload.status !== undefined
    const hasColor = hasOwn(payload, 'color') && payload.color !== undefined
    const hasDriverId = hasOwn(payload, 'driver_id') && payload.driver_id !== undefined
    const hasNotes = hasOwn(payload, 'notes') && payload.notes !== undefined
    const hasEconomicGroupNumber = hasOwn(payload, 'economic_group_number') && payload.economic_group_number !== undefined
    const hasEconomicIndividualNumber = hasOwn(payload, 'economic_individual_number') && payload.economic_individual_number !== undefined
    const hasVehicleTypeId = hasOwn(payload, 'vehicle_type_id') && payload.vehicle_type_id !== undefined
    const hasVehicleBrandId = hasOwn(payload, 'vehicle_brand_id') && payload.vehicle_brand_id !== undefined
    const hasVehicleModelId = hasOwn(payload, 'vehicle_model_id') && payload.vehicle_model_id !== undefined

    const hasAnyUpdate =
      hasPlate || hasBrand || hasModelName || hasYear || hasStatus || hasColor || hasDriverId || hasNotes ||
      hasEconomicGroupNumber || hasEconomicIndividualNumber || hasVehicleTypeId || hasVehicleBrandId || hasVehicleModelId

    if (!hasAnyUpdate) {
      throw new FleetServiceError('No hay campos validos para actualizar.', 400)
    }

    const before = await getVehicle({ companyId: safeCompanyId, id: safeId })

    try {
      const updated = await withDbErrorMapping(async () => {
        const rows = await prisma.$queryRaw`
          UPDATE fleet_vehicle
          SET plate = CASE WHEN ${hasPlate} THEN ${payload.plate ?? null} ELSE plate END,
              brand = CASE WHEN ${hasBrand} THEN ${payload.brand ?? null} ELSE brand END,
              model_name = CASE WHEN ${hasModelName} THEN ${payload.model_name ?? null} ELSE model_name END,
              year = CASE WHEN ${hasYear} THEN ${payload.year ?? null} ELSE year END,
              status = CASE WHEN ${hasStatus} THEN ${payload.status ?? null} ELSE status END,
              color = CASE WHEN ${hasColor} THEN ${payload.color ?? null} ELSE color END,
              driver_id = CASE WHEN ${hasDriverId} THEN ${payload.driver_id ?? null} ELSE driver_id END,
              notes = CASE WHEN ${hasNotes} THEN ${payload.notes ?? null} ELSE notes END,
              economic_group_number = CASE WHEN ${hasEconomicGroupNumber} THEN ${payload.economic_group_number ?? null} ELSE economic_group_number END,
              economic_individual_number = CASE WHEN ${hasEconomicIndividualNumber} THEN ${payload.economic_individual_number ?? null} ELSE economic_individual_number END,
              vehicle_type_id = CASE WHEN ${hasVehicleTypeId} THEN ${payload.vehicle_type_id ?? null} ELSE vehicle_type_id END,
              vehicle_brand_id = CASE WHEN ${hasVehicleBrandId} THEN ${payload.vehicle_brand_id ?? null} ELSE vehicle_brand_id END,
              vehicle_model_id = CASE WHEN ${hasVehicleModelId} THEN ${payload.vehicle_model_id ?? null} ELSE vehicle_model_id END,
              updated_at = now()
          WHERE id = ${safeId}
            AND company_id = ${safeCompanyId}
          RETURNING *
        `
        return firstRow(rows)
      })

      if (!updated) throw new FleetServiceError('Vehiculo no encontrado.', 404)

      await logAudit({
        actorId,
        entityType: 'Vehicle',
        entityId: updated.id,
        action: 'fleet.vehicle.update',
        before,
        after: updated,
      })

      return updated
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new FleetServiceError('Ya existe un vehiculo con esa matricula.', 409)
      }
      throw error
    }
  }

  async function setVehicleEnabled({ companyId, id, enabled, actorId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeId = normalizeRecordId(id, 'Vehiculo no encontrado.')
    const before = await getVehicle({ companyId: safeCompanyId, id: safeId })

    const updated = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_vehicle
        SET enabled = ${Boolean(enabled)},
            updated_at = now()
        WHERE id = ${safeId}
          AND company_id = ${safeCompanyId}
        RETURNING *
      `
      return firstRow(rows)
    })

    if (!updated) throw new FleetServiceError('Vehiculo no encontrado.', 404)

    await logAudit({
      actorId,
      entityType: 'Vehicle',
      entityId: updated.id,
      action: 'fleet.vehicle.disable',
      before,
      after: updated,
      metadata: { enabled: Boolean(enabled) },
    })

    return updated
  }

  async function listVehicleDocuments({ companyId, vehicleId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeVehicleId = normalizeRecordId(vehicleId, 'Vehiculo no encontrado.')
    const docs = await withDbErrorMapping(() => prisma.$queryRaw`
      SELECT * FROM fleet_vehicle_document
      WHERE vehicle_id = ${safeVehicleId} AND company_id = ${safeCompanyId} AND enabled = true
      ORDER BY created_at DESC
    `)
    if (!docs.length) return { data: [] }
    const ids = docs.map((d) => d.file_asset_id).filter(Boolean)
    const assets = ids.length ? await prisma.fileAsset.findMany({ where: { id: { in: ids } } }) : []
    const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]))
    return { data: docs.map((d) => ({ ...d, file_asset: assetMap[d.file_asset_id] ?? null })) }
  }

  async function addVehicleDocument({ companyId, actorId, vehicleId, payload }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeVehicleId = normalizeRecordId(vehicleId, 'Vehiculo no encontrado.')
    const doc = await withDbErrorMapping(async () => firstRow(await prisma.$queryRaw`
      INSERT INTO fleet_vehicle_document (company_id, vehicle_id, file_asset_id, document_type, label)
      VALUES (${safeCompanyId}, ${safeVehicleId}, ${payload.file_asset_id}, ${payload.document_type ?? 'document'}, ${payload.label ?? null})
      RETURNING *
    `))
    await logAudit({ actorId, entityType: 'Vehicle', entityId: safeVehicleId, action: 'fleet.vehicle.document.add', before: null, after: doc })
    return doc
  }

  async function removeVehicleDocument({ companyId, actorId, vehicleId, docId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeVehicleId = normalizeRecordId(vehicleId, 'Vehiculo no encontrado.')
    const safeDocId = normalizeRecordId(docId, 'Documento no encontrado.')
    const updated = await withDbErrorMapping(async () => firstRow(await prisma.$queryRaw`
      UPDATE fleet_vehicle_document SET enabled = false
      WHERE id = ${safeDocId} AND vehicle_id = ${safeVehicleId} AND company_id = ${safeCompanyId}
      RETURNING *
    `))
    if (!updated) throw new FleetServiceError('Documento no encontrado.', 404)
    await logAudit({ actorId, entityType: 'Vehicle', entityId: safeVehicleId, action: 'fleet.vehicle.document.remove', before: updated, after: { ...updated, enabled: false } })
    return updated
  }

  return {
    listVehicles,
    getVehicle,
    createVehicle,
    updateVehicle,
    setVehicleEnabled,
    listVehicleDocuments,
    addVehicleDocument,
    removeVehicleDocument,
  }
}

import { createHash } from 'node:crypto'

const MODULE_KEY = 'custom.fleet'
const TABLE_NOT_READY_MESSAGE = 'Las tablas del modulo no estan disponibles aun.'
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class FleetServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'FleetServiceError'
    this.status = status
  }
}

function toNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function normalizePagination({ page, pageSize }) {
  const safePage = Math.max(1, toNumber(page, 1))
  const safePageSize = Math.min(100, Math.max(1, toNumber(pageSize, 20)))
  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize,
  }
}

function normalizeSearch(search) {
  const value = String(search ?? '').trim()
  return value.length > 0 ? value : null
}

function normalizeOptionalString(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeVehiclePayload(data = {}) {
  return {
    ...data,
    plate: data.plate === undefined ? undefined : String(data.plate).trim(),
    brand: data.brand === undefined ? undefined : String(data.brand).trim(),
    model_name: data.model_name === undefined ? undefined : String(data.model_name).trim(),
    color: normalizeOptionalString(data.color),
    notes: normalizeOptionalString(data.notes),
  }
}

function normalizeMaintenancePayload(data = {}) {
  return {
    ...data,
    description:
      data.description === undefined ? undefined : String(data.description).trim(),
    notes: normalizeOptionalString(data.notes),
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

function isTableNotFoundError(error) {
  const codes = [
    error?.code,
    error?.meta?.code,
    error?.cause?.code,
    error?.originalError?.code,
  ]
  if (codes.includes('42P01')) return true

  const message = String(error?.message ?? '')
  if (message.includes('42P01')) return true
  if (message.toLowerCase().includes('relation') && message.toLowerCase().includes('does not exist')) {
    return true
  }
  return false
}

function isUniqueViolation(error) {
  const codes = [
    error?.code,
    error?.meta?.code,
    error?.cause?.code,
    error?.originalError?.code,
  ]
  return codes.includes('23505')
}

function toCount(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

async function withDbErrorMapping(fn) {
  try {
    return await fn()
  } catch (error) {
    if (isTableNotFoundError(error)) {
      throw new FleetServiceError(TABLE_NOT_READY_MESSAGE, 503)
    }
    throw error
  }
}

function firstRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  return rows[0]
}

function hasOwn(data, key) {
  return Object.prototype.hasOwnProperty.call(data, key)
}

export function createFleetService({ prisma }) {
  let maintenanceHasEnabledColumn = null

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

  async function getMaintenanceEnabledColumnSupport() {
    if (typeof maintenanceHasEnabledColumn === 'boolean') {
      return maintenanceHasEnabledColumn
    }

    const rows = await withDbErrorMapping(() =>
      prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'fleet_maintenance'
          AND column_name = 'enabled'
        LIMIT 1
      `
    )
    maintenanceHasEnabledColumn = rows.length > 0
    return maintenanceHasEnabledColumn
  }

  async function listVehicles({ companyId, page, pageSize, status, search }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const pagination = normalizePagination({ page, pageSize })
    const normalizedStatus = normalizeOptionalString(status)
    const normalizedSearch = normalizeSearch(search)
    const likeValue = normalizedSearch ? `%${normalizedSearch}%` : null

    const [rows, totalRows] = await withDbErrorMapping(async () => {
      const dataRows = await prisma.$queryRaw`
        SELECT *
        FROM fleet_vehicle
        WHERE company_id = ${safeCompanyId}
          AND enabled = true
          AND (${normalizedStatus}::text IS NULL OR status = ${normalizedStatus})
          AND (
            ${likeValue}::text IS NULL
            OR plate ILIKE ${likeValue}
            OR brand ILIKE ${likeValue}
            OR model_name ILIKE ${likeValue}
          )
        ORDER BY created_at DESC
        LIMIT ${pagination.pageSize}
        OFFSET ${pagination.offset}
      `

      const countRows = await prisma.$queryRaw`
        SELECT COUNT(*)::bigint AS total
        FROM fleet_vehicle
        WHERE company_id = ${safeCompanyId}
          AND enabled = true
          AND (${normalizedStatus}::text IS NULL OR status = ${normalizedStatus})
          AND (
            ${likeValue}::text IS NULL
            OR plate ILIKE ${likeValue}
            OR brand ILIKE ${likeValue}
            OR model_name ILIKE ${likeValue}
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
    const row = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        SELECT *
        FROM fleet_vehicle
        WHERE id = ${id}
          AND company_id = ${safeCompanyId}
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
            notes
          )
          VALUES (
            ${safeCompanyId},
            ${payload.plate},
            ${payload.brand},
            ${payload.model_name},
            ${payload.year},
            ${payload.color ?? null},
            ${payload.status ?? 'active'},
            ${payload.driver_id ?? null},
            ${payload.notes ?? null}
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
    const payload = normalizeVehiclePayload(data)

    const hasPlate = hasOwn(payload, 'plate') && payload.plate !== undefined
    const hasBrand = hasOwn(payload, 'brand') && payload.brand !== undefined
    const hasModelName = hasOwn(payload, 'model_name') && payload.model_name !== undefined
    const hasYear = hasOwn(payload, 'year') && payload.year !== undefined
    const hasStatus = hasOwn(payload, 'status') && payload.status !== undefined
    const hasColor = hasOwn(payload, 'color') && payload.color !== undefined
    const hasDriverId = hasOwn(payload, 'driver_id') && payload.driver_id !== undefined
    const hasNotes = hasOwn(payload, 'notes') && payload.notes !== undefined

    const hasAnyUpdate =
      hasPlate ||
      hasBrand ||
      hasModelName ||
      hasYear ||
      hasStatus ||
      hasColor ||
      hasDriverId ||
      hasNotes

    if (!hasAnyUpdate) {
      throw new FleetServiceError('No hay campos validos para actualizar.', 400)
    }

    const before = await getVehicle({ companyId: safeCompanyId, id })

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
              updated_at = now()
          WHERE id = ${id}
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
    const before = await getVehicle({ companyId: safeCompanyId, id })

    const updated = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_vehicle
        SET enabled = ${Boolean(enabled)},
            updated_at = now()
        WHERE id = ${id}
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

  async function listMaintenance({ companyId, vehicleId, page, pageSize }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const pagination = normalizePagination({ page, pageSize })
    const normalizedVehicleId = normalizeOptionalString(vehicleId)

    const [rows, totalRows] = await withDbErrorMapping(async () => {
      const dataRows = await prisma.$queryRaw`
        SELECT *
        FROM fleet_maintenance
        WHERE company_id = ${safeCompanyId}
          AND (${normalizedVehicleId}::text IS NULL OR vehicle_id::text = ${normalizedVehicleId})
        ORDER BY created_at DESC
        LIMIT ${pagination.pageSize}
        OFFSET ${pagination.offset}
      `
      const countRows = await prisma.$queryRaw`
        SELECT COUNT(*)::bigint AS total
        FROM fleet_maintenance
        WHERE company_id = ${safeCompanyId}
          AND (${normalizedVehicleId}::text IS NULL OR vehicle_id::text = ${normalizedVehicleId})
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

  async function getMaintenance({ companyId, id }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const row = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        SELECT *
        FROM fleet_maintenance
        WHERE id = ${id}
          AND company_id = ${safeCompanyId}
        LIMIT 1
      `
      return firstRow(rows)
    })

    if (!row) throw new FleetServiceError('Mantenimiento no encontrado.', 404)
    return row
  }

  async function createMaintenance({ companyId, data, actorId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const payload = normalizeMaintenancePayload(data)

    const row = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        INSERT INTO fleet_maintenance (
          company_id,
          vehicle_id,
          type,
          description,
          scheduled_date,
          completed_date,
          cost,
          notes
        )
        VALUES (
          ${safeCompanyId},
          ${payload.vehicle_id},
          ${payload.type},
          ${payload.description},
          ${payload.scheduled_date},
          ${payload.completed_date ?? null},
          ${payload.cost ?? null},
          ${payload.notes ?? null}
        )
        RETURNING *
      `
      return firstRow(rows)
    })

    await logAudit({
      actorId,
      entityType: 'Maintenance',
      entityId: row?.id ?? null,
      action: 'fleet.maintenance.create',
      before: null,
      after: row,
    })

    return row
  }

  async function updateMaintenance({ companyId, id, data, actorId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const payload = normalizeMaintenancePayload(data)

    const hasVehicleId = hasOwn(payload, 'vehicle_id') && payload.vehicle_id !== undefined
    const hasType = hasOwn(payload, 'type') && payload.type !== undefined
    const hasDescription = hasOwn(payload, 'description') && payload.description !== undefined
    const hasScheduledDate = hasOwn(payload, 'scheduled_date') && payload.scheduled_date !== undefined
    const hasCompletedDate = hasOwn(payload, 'completed_date') && payload.completed_date !== undefined
    const hasCost = hasOwn(payload, 'cost') && payload.cost !== undefined
    const hasNotes = hasOwn(payload, 'notes') && payload.notes !== undefined

    const hasAnyUpdate =
      hasVehicleId ||
      hasType ||
      hasDescription ||
      hasScheduledDate ||
      hasCompletedDate ||
      hasCost ||
      hasNotes

    if (!hasAnyUpdate) {
      throw new FleetServiceError('No hay campos validos para actualizar.', 400)
    }

    const before = await getMaintenance({ companyId: safeCompanyId, id })

    const updated = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_maintenance
        SET vehicle_id = CASE WHEN ${hasVehicleId} THEN ${payload.vehicle_id ?? null} ELSE vehicle_id END,
            type = CASE WHEN ${hasType} THEN ${payload.type ?? null} ELSE type END,
            description = CASE WHEN ${hasDescription} THEN ${payload.description ?? null} ELSE description END,
            scheduled_date = CASE WHEN ${hasScheduledDate} THEN ${payload.scheduled_date ?? null} ELSE scheduled_date END,
            completed_date = CASE WHEN ${hasCompletedDate} THEN ${payload.completed_date ?? null} ELSE completed_date END,
            cost = CASE WHEN ${hasCost} THEN ${payload.cost ?? null} ELSE cost END,
            notes = CASE WHEN ${hasNotes} THEN ${payload.notes ?? null} ELSE notes END,
            updated_at = now()
        WHERE id = ${id}
          AND company_id = ${safeCompanyId}
        RETURNING *
      `
      return firstRow(rows)
    })

    if (!updated) throw new FleetServiceError('Mantenimiento no encontrado.', 404)

    await logAudit({
      actorId,
      entityType: 'Maintenance',
      entityId: updated.id,
      action: 'fleet.maintenance.update',
      before,
      after: updated,
    })

    return updated
  }

  async function setMaintenanceEnabled({ companyId, id, enabled, actorId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const supportsEnabled = await getMaintenanceEnabledColumnSupport()

    if (!supportsEnabled) {
      throw new FleetServiceError(
        'La tabla de mantenimiento no soporta habilitar o deshabilitar registros.',
        409
      )
    }

    const before = await getMaintenance({ companyId: safeCompanyId, id })

    const updated = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_maintenance
        SET enabled = ${Boolean(enabled)},
            updated_at = now()
        WHERE id = ${id}
          AND company_id = ${safeCompanyId}
        RETURNING *
      `
      return firstRow(rows)
    })

    if (!updated) throw new FleetServiceError('Mantenimiento no encontrado.', 404)

    await logAudit({
      actorId,
      entityType: 'Maintenance',
      entityId: updated.id,
      action: 'fleet.maintenance.disable',
      before,
      after: updated,
      metadata: { enabled: Boolean(enabled) },
    })

    return updated
  }

  return {
    listVehicles,
    getVehicle,
    createVehicle,
    updateVehicle,
    setVehicleEnabled,
    listMaintenance,
    getMaintenance,
    createMaintenance,
    updateMaintenance,
    setMaintenanceEnabled,
  }
}

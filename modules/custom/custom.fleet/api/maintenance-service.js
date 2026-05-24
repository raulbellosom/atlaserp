import { FleetServiceError } from './fleet-service.js'

const MODULE_KEY = 'custom.fleet'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAINTENANCE_STATUS_VALUES = ['scheduled', 'in_progress', 'completed', 'cancelled']

const SORT_FIELD_MAP = {
  created_at: 'm.created_at',
  started_at: 'm.started_at',
  odometer_km: 'm.odometer_km',
  status: 'm.status',
  cost: 'm.cost',
  title: 'm.title',
}

// Fields allowed in dynamic SET clause â€” never from raw user input
const UPDATABLE_FIELDS = new Set([
  'vehicle_id', 'type', 'description', 'scheduled_date', 'completed_date', 'cost', 'notes',
  'maintenance_type_id', 'title', 'status', 'driver_id', 'started_at', 'odometer_km', 'provider', 'currency',
])

function toNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizePagination({ page, pageSize }) {
  const safePage = Math.max(1, toNumber(page, 1))
  const safePageSize = Math.min(100, Math.max(1, toNumber(pageSize, 20)))
  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize }
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

function normalizeMaintenancePayload(data = {}) {
  return {
    ...data,
    description: data.description === undefined ? undefined : String(data.description).trim(),
    title: normalizeOptionalString(data.title),
    provider: normalizeOptionalString(data.provider),
    notes: normalizeOptionalString(data.notes),
  }
}

function toScopedCompanyUuid(companyId) {
  const normalized = (typeof companyId === 'string' && companyId.trim()) ? companyId.trim() : null
  if (!normalized) throw new FleetServiceError('companyId es requerido.', 400)
  if (!UUID_REGEX.test(normalized)) throw new FleetServiceError('companyId debe ser UUID valido.', 400)
  return normalized.toLowerCase()
}

function normalizeRecordId(id, notFoundMessage) {
  const value = String(id ?? '').trim()
  if (!UUID_REGEX.test(value)) throw new FleetServiceError(notFoundMessage, 404)
  return value.toLowerCase()
}

function isTableNotFoundError(error) {
  const codes = [error?.code, error?.meta?.code, error?.cause?.code, error?.originalError?.code]
  if (codes.includes('42P01')) return true
  const msg = String(error?.message ?? '').toLowerCase()
  return msg.includes('42p01') || (msg.includes('relation') && msg.includes('does not exist'))
}

function toCount(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

async function withDbErrorMapping(fn) {
  try {
    return await fn()
  } catch (error) {
    if (isTableNotFoundError(error)) throw new FleetServiceError('Las tablas del modulo no estan disponibles aun.', 503)
    throw error
  }
}

function firstRow(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
}

export function createMaintenanceService({ prisma }) {
  async function logAudit({ actorId, entityType, entityId, action, before = null, after = null, metadata = null }) {
    await prisma.auditLog.create({
      data: { actorId: actorId ?? null, moduleKey: MODULE_KEY, entityType, entityId: entityId ?? null, action, before, after, metadata },
    })
  }

  async function listMaintenance({ companyId, page, pageSize, search, status, vehicleId, driverId, sortBy, sortDir }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const pagination = normalizePagination({ page, pageSize })
    const normalizedStatus = MAINTENANCE_STATUS_VALUES.includes(status) ? status : null
    const safeVehicleId = vehicleId && UUID_REGEX.test(vehicleId) ? vehicleId.toLowerCase() : null
    const safeDriverId = driverId && UUID_REGEX.test(driverId) ? driverId.toLowerCase() : null
    const normalizedSearch = normalizeSearch(search)
    const likeValue = normalizedSearch ? `%${normalizedSearch}%` : null
    // sortCol/sortDirection come from allowlists, never raw user input
    const sortCol = SORT_FIELD_MAP[sortBy] ?? 'm.created_at'
    const sortDirection = sortDir === 'asc' ? 'ASC' : 'DESC'

    const baseWhere = `
      WHERE m.company_id = $1
        AND m.enabled = true
        AND ($2::text IS NULL OR m.status = $2)
        AND ($3::text IS NULL OR m.vehicle_id::text = $3)
        AND ($4::text IS NULL OR m.driver_id::text = $4)
        AND ($5::text IS NULL OR m.title ILIKE $5 OR m.provider ILIKE $5 OR v.plate ILIKE $5
             OR COALESCE(d.first_name || ' ' || d.last_name, '') ILIKE $5)`
    const baseJoins = `
      LEFT JOIN fleet_vehicle v ON v.id = m.vehicle_id AND v.company_id = m.company_id
      LEFT JOIN fleet_driver d ON d.id = m.driver_id AND d.company_id = m.company_id
      LEFT JOIN fleet_vehicle_model vm ON vm.id = v.vehicle_model_id
      LEFT JOIN fleet_vehicle_brand vb_m ON vb_m.id = vm.brand_id
      LEFT JOIN fleet_vehicle_type vt_m ON vt_m.id = vm.type_id
      LEFT JOIN fleet_vehicle_type vt ON vt.id = v.vehicle_type_id
      LEFT JOIN fleet_maintenance_type mt ON mt.id = m.maintenance_type_id AND mt.company_id = m.company_id`

    const [rows, totalRows] = await withDbErrorMapping(async () => {
      const dataRows = await prisma.$queryRawUnsafe(
        `SELECT
            m.*,
            v.plate AS vehicle_plate,
            vm.name AS vehicle_model_name,
            COALESCE(vb_m.name, v.brand) AS vehicle_brand_name,
            COALESCE(vt_m.name, vt.name) AS vehicle_type_name,
            CASE
              WHEN COALESCE(vt_m.economic_group_number, vt.economic_group_number, v.economic_group_number) IS NOT NULL
                AND v.economic_individual_number IS NOT NULL
                THEN
                  COALESCE(
                    NULLIF(REGEXP_REPLACE(COALESCE(vt_m.economic_group_number, vt.economic_group_number, v.economic_group_number), '^0+', ''), ''),
                    '0'
                  ) ||
                  COALESCE(NULLIF(REGEXP_REPLACE(v.economic_individual_number, '^0+', ''), ''), '0')
              ELSE NULL
            END AS economic_number,
            CASE
              WHEN COALESCE(vt_m.economic_group_number, vt.economic_group_number, v.economic_group_number) IS NOT NULL
                AND v.economic_individual_number IS NOT NULL
                THEN
                  COALESCE(
                    NULLIF(REGEXP_REPLACE(COALESCE(vt_m.economic_group_number, vt.economic_group_number, v.economic_group_number), '^0+', ''), ''),
                    '0'
                  ) ||
                  COALESCE(NULLIF(REGEXP_REPLACE(v.economic_individual_number, '^0+', ''), ''), '0')
              ELSE NULL
            END AS full_economic_number,
            mt.name AS maintenance_type_name,
            NULLIF(TRIM(COALESCE(d.first_name, '') || ' ' || COALESCE(d.last_name, '')), '') AS driver_full_name
         FROM fleet_maintenance m ${baseJoins} ${baseWhere}
         ORDER BY ${sortCol} ${sortDirection} LIMIT $6 OFFSET $7`,
        safeCompanyId, normalizedStatus, safeVehicleId, safeDriverId, likeValue, pagination.pageSize, pagination.offset
      )
      const countRows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS total FROM fleet_maintenance m ${baseJoins} ${baseWhere}`,
        safeCompanyId, normalizedStatus, safeVehicleId, safeDriverId, likeValue
      )
      return [dataRows, countRows]
    })

    return {
      data: rows,
      pagination: { page: pagination.page, pageSize: pagination.pageSize, total: toCount(firstRow(totalRows)?.total) },
    }
  }

  async function getMaintenance({ companyId, id }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeId = normalizeRecordId(id, 'Mantenimiento no encontrado.')
    const row = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        SELECT
          m.*,
          v.plate AS vehicle_plate,
          vm.name AS vehicle_model_name,
          COALESCE(vb_m.name, v.brand) AS vehicle_brand_name,
          COALESCE(vt_m.name, vt.name) AS vehicle_type_name,
          CASE
            WHEN COALESCE(vt_m.economic_group_number, vt.economic_group_number, v.economic_group_number) IS NOT NULL
              AND v.economic_individual_number IS NOT NULL
              THEN
                COALESCE(
                  NULLIF(REGEXP_REPLACE(COALESCE(vt_m.economic_group_number, vt.economic_group_number, v.economic_group_number), '^0+', ''), ''),
                  '0'
                ) ||
                COALESCE(NULLIF(REGEXP_REPLACE(v.economic_individual_number, '^0+', ''), ''), '0')
            ELSE NULL
          END AS economic_number,
          CASE
            WHEN COALESCE(vt_m.economic_group_number, vt.economic_group_number, v.economic_group_number) IS NOT NULL
              AND v.economic_individual_number IS NOT NULL
              THEN
                COALESCE(
                  NULLIF(REGEXP_REPLACE(COALESCE(vt_m.economic_group_number, vt.economic_group_number, v.economic_group_number), '^0+', ''), ''),
                  '0'
                ) ||
                COALESCE(NULLIF(REGEXP_REPLACE(v.economic_individual_number, '^0+', ''), ''), '0')
            ELSE NULL
          END AS full_economic_number,
          mt.name AS maintenance_type_name,
          NULLIF(TRIM(COALESCE(d.first_name, '') || ' ' || COALESCE(d.last_name, '')), '') AS driver_full_name
        FROM fleet_maintenance m
        LEFT JOIN fleet_vehicle v ON v.id = m.vehicle_id AND v.company_id = m.company_id
        LEFT JOIN fleet_driver d ON d.id = m.driver_id AND d.company_id = m.company_id
        LEFT JOIN fleet_vehicle_model vm ON vm.id = v.vehicle_model_id
        LEFT JOIN fleet_vehicle_brand vb_m ON vb_m.id = vm.brand_id
        LEFT JOIN fleet_vehicle_type vt_m ON vt_m.id = vm.type_id
        LEFT JOIN fleet_vehicle_type vt ON vt.id = v.vehicle_type_id
        LEFT JOIN fleet_maintenance_type mt ON mt.id = m.maintenance_type_id AND mt.company_id = m.company_id
        WHERE m.id = ${safeId} AND m.company_id = ${safeCompanyId}
        LIMIT 1
      `
      return firstRow(rows)
    })
    if (!row) throw new FleetServiceError('Mantenimiento no encontrado.', 404)
    return row
  }

  async function createMaintenance({ companyId, actorId, payload }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const data = normalizeMaintenancePayload(payload)

    const row = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        INSERT INTO fleet_maintenance (
          company_id, vehicle_id, type, description, scheduled_date, completed_date, cost, notes,
          maintenance_type_id, title, status, driver_id, started_at, odometer_km, provider, currency
        )
        VALUES (
          ${safeCompanyId}, ${data.vehicle_id}, ${data.type}, ${data.description},
          ${data.scheduled_date}, ${data.completed_date ?? null}, ${data.cost ?? null}, ${data.notes ?? null},
          ${data.maintenance_type_id ?? null}, ${data.title ?? null},
          ${data.status ?? 'scheduled'}, ${data.driver_id ?? null},
          ${data.started_at ?? null}, ${data.odometer_km ?? null},
          ${data.provider ?? null}, ${data.currency ?? 'MXN'}
        )
        RETURNING *
      `
      return firstRow(rows)
    })

    await logAudit({ actorId, entityType: 'Maintenance', entityId: row?.id ?? null, action: 'fleet.maintenance.create', before: null, after: row })
    return row
  }

  async function updateMaintenance({ companyId, actorId, id, payload }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeId = normalizeRecordId(id, 'Mantenimiento no encontrado.')
    const data = normalizeMaintenancePayload(payload)

    // Build dynamic SET from allowlisted fields only
    const updates = Object.entries(data).filter(([key, val]) => UPDATABLE_FIELDS.has(key) && val !== undefined)
    if (updates.length === 0) throw new FleetServiceError('No hay campos validos para actualizar.', 400)

    const before = await getMaintenance({ companyId: safeCompanyId, id: safeId })

    // Params: $1=id, $2=companyId, $3..N=field values â€” sortCol from allowlist only
    const setClauses = updates.map(([key], i) => `"${key}" = $${i + 3}`).join(', ')
    const fieldValues = updates.map(([, val]) => val)

    const updated = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRawUnsafe(
        `UPDATE fleet_maintenance SET ${setClauses}, updated_at = now() WHERE id = $1 AND company_id = $2 RETURNING *`,
        safeId, safeCompanyId, ...fieldValues
      )
      return firstRow(rows)
    })
    if (!updated) throw new FleetServiceError('Mantenimiento no encontrado.', 404)
    await logAudit({ actorId, entityType: 'Maintenance', entityId: updated.id, action: 'fleet.maintenance.update', before, after: updated })
    return updated
  }

  async function setMaintenanceEnabled({ companyId, actorId, id, enabled }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeId = normalizeRecordId(id, 'Mantenimiento no encontrado.')
    const before = await getMaintenance({ companyId: safeCompanyId, id: safeId })

    const updated = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_maintenance
        SET enabled = ${Boolean(enabled)}, updated_at = now()
        WHERE id = ${safeId} AND company_id = ${safeCompanyId}
        RETURNING *
      `
      return firstRow(rows)
    })
    if (!updated) throw new FleetServiceError('Mantenimiento no encontrado.', 404)
    await logAudit({ actorId, entityType: 'Maintenance', entityId: updated.id, action: 'fleet.maintenance.disable', before, after: updated, metadata: { enabled: Boolean(enabled) } })
    return updated
  }

  async function listMaintenanceDocuments({ companyId, maintenanceId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeMaintId = normalizeRecordId(maintenanceId, 'Mantenimiento no encontrado.')

    const docs = await withDbErrorMapping(() =>
      prisma.$queryRaw`
        SELECT * FROM fleet_maintenance_document
        WHERE maintenance_id = ${safeMaintId} AND company_id = ${safeCompanyId} AND enabled = true
        ORDER BY created_at DESC
      `
    )
    if (!docs.length) return { data: [] }

    const fileAssetIds = docs.map((d) => d.file_asset_id).filter(Boolean)
    const assets = fileAssetIds.length > 0
      ? await prisma.fileAsset.findMany({ where: { id: { in: fileAssetIds } } })
      : []
    const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]))
    return { data: docs.map((d) => ({ ...d, file_asset: assetMap[d.file_asset_id] ?? null })) }
  }

  async function addMaintenanceDocument({ companyId, actorId, maintenanceId, payload }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeMaintId = normalizeRecordId(maintenanceId, 'Mantenimiento no encontrado.')

    const doc = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        INSERT INTO fleet_maintenance_document (company_id, maintenance_id, file_asset_id, document_type, label)
        VALUES (${safeCompanyId}, ${safeMaintId}, ${payload.file_asset_id}, ${payload.document_type ?? 'document'}, ${payload.label ?? null})
        RETURNING *
      `
      return firstRow(rows)
    })
    await logAudit({ actorId, entityType: 'Maintenance', entityId: safeMaintId, action: 'fleet.maintenance.document.add', before: null, after: doc })
    return doc
  }

  async function removeMaintenanceDocument({ companyId, actorId, maintenanceId, docId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeMaintId = normalizeRecordId(maintenanceId, 'Mantenimiento no encontrado.')
    const safeDocId = normalizeRecordId(docId, 'Documento no encontrado.')

    const updated = await withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_maintenance_document
        SET enabled = false
        WHERE id = ${safeDocId} AND maintenance_id = ${safeMaintId} AND company_id = ${safeCompanyId}
        RETURNING *
      `
      return firstRow(rows)
    })
    if (!updated) throw new FleetServiceError('Documento no encontrado.', 404)
    await logAudit({ actorId, entityType: 'Maintenance', entityId: safeMaintId, action: 'fleet.maintenance.document.remove', before: updated, after: { ...updated, enabled: false } })
    return updated
  }

  return { listMaintenance, getMaintenance, createMaintenance, updateMaintenance, setMaintenanceEnabled, listMaintenanceDocuments, addMaintenanceDocument, removeMaintenanceDocument }
}



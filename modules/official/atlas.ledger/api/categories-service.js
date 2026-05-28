import {
  isTableNotFoundError, isUniqueViolation, firstRow, hasOwn, normalizeOptionalString,
} from './service-helpers.js'
import { LedgerServiceError } from './ledger-service.js'

export function createCategoriesService({ prisma }) {

  async function listCategories({ companyId }) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT * FROM ledger_category
        WHERE company_id = ${companyId}::uuid AND enabled = true
        ORDER BY name
      `
      return { data: rows }
    } catch (err) {
      if (isTableNotFoundError(err)) throw new LedgerServiceError('El modulo Ledger no esta instalado.', 503)
      throw err
    }
  }

  async function getCategory({ companyId, categoryId }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM ledger_category
      WHERE id = ${categoryId}::uuid AND company_id = ${companyId}::uuid
    `
    const row = firstRow(rows)
    if (!row) throw new LedgerServiceError('Categoria no encontrada.', 404)
    return row
  }

  async function createCategory({ companyId, data }) {
    const name  = String(data.name).trim()
    const color = normalizeOptionalString(data.color) ?? null
    const kind  = data.kind ?? 'both'
    try {
      const rows = await prisma.$queryRaw`
        INSERT INTO ledger_category (company_id, name, color, kind, enabled)
        VALUES (${companyId}::uuid, ${name}, ${color}, ${kind}, true)
        RETURNING *
      `
      return firstRow(rows)
    } catch (err) {
      if (isUniqueViolation(err)) throw new LedgerServiceError(`Ya existe una categoria con el nombre "${name}".`, 409)
      throw err
    }
  }

  async function updateCategory({ companyId, categoryId, data }) {
    const existing = await getCategory({ companyId, categoryId })
    const name  = hasOwn(data, 'name')  ? String(data.name).trim()             : existing.name
    const color = hasOwn(data, 'color') ? (normalizeOptionalString(data.color) ?? null) : existing.color
    const kind  = hasOwn(data, 'kind')  ? data.kind                            : existing.kind
    try {
      const rows = await prisma.$queryRaw`
        UPDATE ledger_category
        SET name = ${name}, color = ${color}, kind = ${kind}, updated_at = NOW()
        WHERE id = ${categoryId}::uuid AND company_id = ${companyId}::uuid
        RETURNING *
      `
      return firstRow(rows)
    } catch (err) {
      if (isUniqueViolation(err)) throw new LedgerServiceError(`Ya existe una categoria con el nombre "${name}".`, 409)
      throw err
    }
  }

  async function setCategoryEnabled({ companyId, categoryId, enabled }) {
    const rows = await prisma.$queryRaw`
      UPDATE ledger_category
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id = ${categoryId}::uuid AND company_id = ${companyId}::uuid
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new LedgerServiceError('Categoria no encontrada.', 404)
    return row
  }

  return { listCategories, getCategory, createCategory, updateCategory, setCategoryEnabled }
}

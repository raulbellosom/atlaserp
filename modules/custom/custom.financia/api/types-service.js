import {
  isTableNotFoundError, isUniqueViolation, firstRow, hasOwn,
} from './service-helpers.js'
import { FinanciaServiceError } from './financia-service.js'

export function createTypesService({ prisma }) {

  async function listTypes({ companyId }) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT * FROM financia_transaction_type
        WHERE company_id = ${companyId}::uuid AND enabled = true
        ORDER BY code
      `
      return { data: rows }
    } catch (err) {
      if (isTableNotFoundError(err)) throw new FinanciaServiceError('El modulo Financia no esta instalado.', 503)
      throw err
    }
  }

  async function getType({ companyId, typeId }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM financia_transaction_type
      WHERE id = ${typeId}::uuid AND company_id = ${companyId}::uuid
    `
    const row = firstRow(rows)
    if (!row) throw new FinanciaServiceError('Tipo de movimiento no encontrado.', 404)
    return row
  }

  async function createType({ companyId, data }) {
    const code = String(data.code).trim().toUpperCase()
    const name = String(data.name).trim()
    try {
      const rows = await prisma.$queryRaw`
        INSERT INTO financia_transaction_type (company_id, code, name, enabled)
        VALUES (${companyId}::uuid, ${code}, ${name}, true)
        RETURNING *
      `
      return firstRow(rows)
    } catch (err) {
      if (isUniqueViolation(err)) throw new FinanciaServiceError(`Ya existe un tipo con codigo "${code}".`, 409)
      throw err
    }
  }

  async function updateType({ companyId, typeId, data }) {
    const existing = await getType({ companyId, typeId })
    const code = hasOwn(data, 'code') ? String(data.code).trim().toUpperCase() : existing.code
    const name = hasOwn(data, 'name') ? String(data.name).trim()               : existing.name
    try {
      const rows = await prisma.$queryRaw`
        UPDATE financia_transaction_type
        SET code = ${code}, name = ${name}, updated_at = NOW()
        WHERE id = ${typeId}::uuid AND company_id = ${companyId}::uuid
        RETURNING *
      `
      return firstRow(rows)
    } catch (err) {
      if (isUniqueViolation(err)) throw new FinanciaServiceError(`Ya existe un tipo con codigo "${code}".`, 409)
      throw err
    }
  }

  async function setTypeEnabled({ companyId, typeId, enabled }) {
    const rows = await prisma.$queryRaw`
      UPDATE financia_transaction_type
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id = ${typeId}::uuid AND company_id = ${companyId}::uuid
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new FinanciaServiceError('Tipo de movimiento no encontrado.', 404)
    return row
  }

  return { listTypes, getType, createType, updateType, setTypeEnabled }
}

import {
  normalizePagination, normalizeOptionalString,
  isTableNotFoundError, isUniqueViolation, toCount, firstRow, hasOwn,
} from './service-helpers.js'

export class FinanciaServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'FinanciaServiceError'
    this.status = status
  }
}

export function createFinanciaService({ prisma }) {

  // ── Accounts ────────────────────────────────────────────────────────────────

  async function listAccounts({ companyId }) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT a.*,
          a.opening_balance + COALESCE(
            SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0)) FILTER (WHERE t.enabled = true),
            0
          ) AS current_balance
        FROM financia_account a
        LEFT JOIN financia_transaction t ON t.account_id = a.id
        WHERE a.company_id = ${companyId}::uuid AND a.enabled = true
        GROUP BY a.id
        ORDER BY a.name
      `
      return { data: rows }
    } catch (err) {
      if (isTableNotFoundError(err)) throw new FinanciaServiceError('El modulo Financia no esta instalado.', 503)
      throw err
    }
  }

  async function getAccount({ companyId, accountId }) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT a.*,
          a.opening_balance + COALESCE(
            SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0)) FILTER (WHERE t.enabled = true),
            0
          ) AS current_balance
        FROM financia_account a
        LEFT JOIN financia_transaction t ON t.account_id = a.id
        WHERE a.id = ${accountId}::uuid AND a.company_id = ${companyId}::uuid
        GROUP BY a.id
      `
      const account = firstRow(rows)
      if (!account) throw new FinanciaServiceError('Cuenta no encontrada.', 404)
      return account
    } catch (err) {
      if (err instanceof FinanciaServiceError) throw err
      if (isTableNotFoundError(err)) throw new FinanciaServiceError('El modulo Financia no esta instalado.', 503)
      throw err
    }
  }

  async function createAccount({ companyId, data }) {
    const { name, bank, account_number, currency, opening_balance } = data
    try {
      const rows = await prisma.$queryRaw`
        INSERT INTO financia_account (company_id, name, bank, account_number, currency, opening_balance, enabled)
        VALUES (
          ${companyId}::uuid,
          ${name},
          ${bank},
          ${normalizeOptionalString(account_number)},
          ${currency},
          ${opening_balance ?? 0},
          true
        )
        RETURNING *
      `
      return firstRow(rows)
    } catch (err) {
      if (isUniqueViolation(err)) throw new FinanciaServiceError(`Ya existe una cuenta con el nombre "${name}".`, 409)
      throw err
    }
  }

  async function updateAccount({ companyId, accountId, data }) {
    const existing = await getAccount({ companyId, accountId })

    const name            = hasOwn(data, 'name')            ? String(data.name).trim()                     : existing.name
    const bank            = hasOwn(data, 'bank')            ? String(data.bank).trim()                     : existing.bank
    const account_number  = hasOwn(data, 'account_number')  ? normalizeOptionalString(data.account_number) : existing.account_number
    const currency        = hasOwn(data, 'currency')        ? data.currency                                : existing.currency
    const opening_balance = hasOwn(data, 'opening_balance') ? Number(data.opening_balance)                 : Number(existing.opening_balance)

    try {
      const rows = await prisma.$queryRaw`
        UPDATE financia_account
        SET name = ${name},
            bank = ${bank},
            account_number = ${account_number},
            currency = ${currency},
            opening_balance = ${opening_balance},
            updated_at = NOW()
        WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid
        RETURNING *
      `
      return firstRow(rows)
    } catch (err) {
      if (isUniqueViolation(err)) throw new FinanciaServiceError(`Ya existe una cuenta con el nombre "${name}".`, 409)
      throw err
    }
  }

  async function setAccountEnabled({ companyId, accountId, enabled }) {
    const rows = await prisma.$queryRaw`
      UPDATE financia_account
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new FinanciaServiceError('Cuenta no encontrada.', 404)
    return row
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  async function listTransactions({ companyId, accountId, dateFrom, dateTo, page, pageSize }) {
    await getAccount({ companyId, accountId })

    const pag  = normalizePagination({ page, pageSize })
    const from = normalizeOptionalString(dateFrom) ?? null
    const to   = normalizeOptionalString(dateTo)   ?? null

    try {
      const rows = await prisma.$queryRaw`
        WITH ranked AS (
          SELECT
            t.*,
            tt.code  AS tipo_code,
            tt.name  AS tipo_name,
            c.name   AS category_name,
            c.color  AS category_color,
            ROW_NUMBER() OVER (
              PARTITION BY t.account_id ORDER BY t.fecha, t.created_at
            ) AS consecutive,
            a.opening_balance + SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0))
              OVER (
                PARTITION BY t.account_id
                ORDER BY t.fecha, t.created_at
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS saldo_actual
          FROM financia_transaction t
          JOIN financia_account a ON a.id = t.account_id
          LEFT JOIN financia_transaction_type tt ON tt.id = t.tipo_id
          LEFT JOIN financia_category c ON c.id = t.category_id
          WHERE t.account_id = ${accountId}::uuid
            AND t.company_id = ${companyId}::uuid
            AND t.enabled = true
        )
        SELECT * FROM ranked
        WHERE (${from}::date IS NULL OR fecha >= ${from}::date)
          AND (${to}::date   IS NULL OR fecha <= ${to}::date)
        ORDER BY fecha, created_at
        LIMIT ${pag.pageSize} OFFSET ${pag.offset}
      `

      const countRows = await prisma.$queryRaw`
        SELECT COUNT(*) AS total
        FROM financia_transaction t
        WHERE t.account_id = ${accountId}::uuid
          AND t.company_id = ${companyId}::uuid
          AND t.enabled = true
          AND (${from}::date IS NULL OR t.fecha >= ${from}::date)
          AND (${to}::date   IS NULL OR t.fecha <= ${to}::date)
      `

      return {
        data: rows,
        pagination: {
          page:     pag.page,
          pageSize: pag.pageSize,
          total:    toCount(firstRow(countRows)?.total),
        },
      }
    } catch (err) {
      if (isTableNotFoundError(err)) throw new FinanciaServiceError('El modulo Financia no esta instalado.', 503)
      throw err
    }
  }

  async function createTransaction({ companyId, accountId, data }) {
    await getAccount({ companyId, accountId })
    const { fecha, tipo_id, numero, nombre, referencia, concepto, deposito, retiro, category_id } = data

    // Normalize nullable UUID fields — pass null directly; PostgreSQL handles null::uuid = null
    const tipoIdVal     = normalizeOptionalString(tipo_id)     ?? null
    const categoryIdVal = normalizeOptionalString(category_id) ?? null

    const rows = await prisma.$queryRaw`
      INSERT INTO financia_transaction
        (account_id, company_id, fecha, tipo_id, numero, nombre,
         referencia, concepto, deposito, retiro, category_id, enabled)
      VALUES (
        ${accountId}::uuid,
        ${companyId}::uuid,
        ${fecha}::date,
        ${tipoIdVal}::uuid,
        ${normalizeOptionalString(numero)},
        ${nombre},
        ${normalizeOptionalString(referencia)},
        ${normalizeOptionalString(concepto)},
        ${deposito ?? null},
        ${retiro   ?? null},
        ${categoryIdVal}::uuid,
        true
      )
      RETURNING *
    `
    return firstRow(rows)
  }

  async function updateTransaction({ companyId, accountId, transactionId, data }) {
    const existingRows = await prisma.$queryRaw`
      SELECT * FROM financia_transaction
      WHERE id = ${transactionId}::uuid
        AND account_id = ${accountId}::uuid
        AND company_id = ${companyId}::uuid
        AND enabled = true
    `
    const existing = firstRow(existingRows)
    if (!existing) throw new FinanciaServiceError('Movimiento no encontrado.', 404)

    const fecha       = hasOwn(data, 'fecha')       ? data.fecha                               : existing.fecha
    const tipoIdVal   = hasOwn(data, 'tipo_id')
      ? (normalizeOptionalString(data.tipo_id) ?? null)
      : (existing.tipo_id ?? null)
    const numero      = hasOwn(data, 'numero')      ? normalizeOptionalString(data.numero)     : existing.numero
    const nombre      = hasOwn(data, 'nombre')      ? String(data.nombre).trim()               : existing.nombre
    const referencia  = hasOwn(data, 'referencia')  ? normalizeOptionalString(data.referencia) : existing.referencia
    const concepto    = hasOwn(data, 'concepto')    ? normalizeOptionalString(data.concepto)   : existing.concepto
    const deposito    = hasOwn(data, 'deposito')    ? (data.deposito ?? null)                  : existing.deposito
    const retiro      = hasOwn(data, 'retiro')      ? (data.retiro   ?? null)                  : existing.retiro
    const catIdVal    = hasOwn(data, 'category_id')
      ? (normalizeOptionalString(data.category_id) ?? null)
      : (existing.category_id ?? null)

    const rows = await prisma.$queryRaw`
      UPDATE financia_transaction
      SET fecha       = ${fecha}::date,
          tipo_id     = ${tipoIdVal}::uuid,
          numero      = ${numero},
          nombre      = ${nombre},
          referencia  = ${referencia},
          concepto    = ${concepto},
          deposito    = ${deposito},
          retiro      = ${retiro},
          category_id = ${catIdVal}::uuid,
          updated_at  = NOW()
      WHERE id         = ${transactionId}::uuid
        AND account_id = ${accountId}::uuid
        AND company_id = ${companyId}::uuid
      RETURNING *
    `
    return firstRow(rows)
  }

  async function setTransactionEnabled({ companyId, accountId, transactionId, enabled }) {
    const rows = await prisma.$queryRaw`
      UPDATE financia_transaction
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id         = ${transactionId}::uuid
        AND account_id = ${accountId}::uuid
        AND company_id = ${companyId}::uuid
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new FinanciaServiceError('Movimiento no encontrado.', 404)
    return row
  }

  return {
    listAccounts, getAccount, createAccount, updateAccount, setAccountEnabled,
    listTransactions, createTransaction, updateTransaction, setTransactionEnabled,
  }
}

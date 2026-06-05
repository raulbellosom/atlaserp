import {
  normalizePagination, normalizeOptionalString,
  isTableNotFoundError, isUniqueViolation, toCount, firstRow, hasOwn,
} from './service-helpers.js'

export class LedgerServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'LedgerServiceError'
    this.status = status
  }
}

export function createLedgerService({ prisma }) {

  // ── Accounts ────────────────────────────────────────────────────────────────

  async function listAccounts({ companyId, actorId }) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT a.*,
          a.opening_balance + COALESCE(
            SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0)) FILTER (WHERE t.enabled = true),
            0
          ) AS current_balance
        FROM ledger_account a
        LEFT JOIN ledger_transaction t ON t.account_id = a.id
        WHERE a.company_id = ${companyId}::uuid
          AND a.enabled = true
          AND (
            a.owner_id IS NULL
            OR a.owner_id = ${actorId}::uuid
            OR EXISTS (
              SELECT 1 FROM ledger_account_member m
              WHERE m.account_id = a.id AND m.user_id = ${actorId}::uuid AND m.status = 'active'
            )
            OR EXISTS (
              SELECT 1 FROM ledger_group_member gm
              WHERE gm.group_id = a.group_id AND gm.user_id = ${actorId}::uuid AND gm.status = 'active'
            )
          )
        GROUP BY a.id
        ORDER BY a.name
      `
      return { data: rows }
    } catch (err) {
      if (isTableNotFoundError(err)) throw new LedgerServiceError('El modulo Ledger no esta instalado.', 503)
      throw err
    }
  }

  async function getAccount({ companyId, accountId, actorId = null }) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT a.*,
          a.opening_balance + COALESCE(
            SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0)) FILTER (WHERE t.enabled = true),
            0
          ) AS current_balance
        FROM ledger_account a
        LEFT JOIN ledger_transaction t ON t.account_id = a.id
        WHERE a.id = ${accountId}::uuid
          AND a.company_id = ${companyId}::uuid
          AND (
            ${actorId}::uuid IS NULL
            OR a.owner_id IS NULL
            OR a.owner_id = ${actorId}::uuid
            OR EXISTS (
              SELECT 1 FROM ledger_account_member m
              WHERE m.account_id = a.id AND m.user_id = ${actorId}::uuid AND m.status = 'active'
            )
            OR EXISTS (
              SELECT 1 FROM ledger_group_member gm
              WHERE gm.group_id = a.group_id AND gm.user_id = ${actorId}::uuid AND gm.status = 'active'
            )
          )
        GROUP BY a.id
      `
      const account = firstRow(rows)
      if (!account) throw new LedgerServiceError('Cuenta no encontrada.', 404)
      return account
    } catch (err) {
      if (err instanceof LedgerServiceError) throw err
      if (isTableNotFoundError(err)) throw new LedgerServiceError('El modulo Ledger no esta instalado.', 503)
      throw err
    }
  }

  async function createAccount({ companyId, ownerId = null, groupId = null, data }) {
    const { name, bank, account_number, currency, opening_balance } = data
    try {
      const rows = await prisma.$queryRaw`
        INSERT INTO ledger_account
          (company_id, owner_id, group_id, name, bank, account_number, currency, opening_balance, enabled)
        VALUES (
          ${companyId}::uuid,
          ${ownerId},
          ${groupId},
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
      if (isUniqueViolation(err)) throw new LedgerServiceError(`Ya existe una cuenta con el nombre "${name}".`, 409)
      throw err
    }
  }

  async function canWriteAccount({ companyId, accountId, actorId }) {
    const rows = await prisma.$queryRaw`
      SELECT 1 FROM ledger_account a
      WHERE a.id = ${accountId}::uuid
        AND a.company_id = ${companyId}::uuid
        AND (
          a.owner_id IS NULL
          OR a.owner_id = ${actorId}::uuid
          OR EXISTS (
            SELECT 1 FROM ledger_account_member m
            WHERE m.account_id = a.id AND m.user_id = ${actorId}::uuid
              AND m.status = 'active' AND m.role = 'editor'
          )
          OR EXISTS (
            SELECT 1 FROM ledger_group_member gm
            WHERE gm.group_id = a.group_id AND gm.user_id = ${actorId}::uuid
              AND gm.status = 'active' AND (gm.role = 'editor' OR gm.role = 'admin')
          )
        )
    `
    return rows.length > 0
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
        UPDATE ledger_account
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
      if (isUniqueViolation(err)) throw new LedgerServiceError(`Ya existe una cuenta con el nombre "${name}".`, 409)
      throw err
    }
  }

  async function setAccountEnabled({ companyId, accountId, enabled }) {
    const rows = await prisma.$queryRaw`
      UPDATE ledger_account
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new LedgerServiceError('Cuenta no encontrada.', 404)
    return row
  }

  async function setAccountGroup({ companyId, accountId, actorId, groupId }) {
    const accountRows = await prisma.$queryRaw`
      SELECT id, owner_id, group_id FROM ledger_account
      WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid AND enabled = true
    `
    const account = firstRow(accountRows)
    if (!account) throw new LedgerServiceError('Cuenta no encontrada.', 404)
    if (account.owner_id !== actorId) {
      throw new LedgerServiceError('Solo el propietario puede asignar esta cuenta a un grupo.', 403)
    }

    if (groupId !== null) {
      const groupRows = await prisma.$queryRaw`
        SELECT g.id FROM ledger_group g
        WHERE g.id = ${groupId}::uuid AND g.company_id = ${companyId}::uuid AND g.enabled = true
          AND (
            g.created_by = ${actorId}::uuid
            OR EXISTS (
              SELECT 1 FROM ledger_group_member gm
              WHERE gm.group_id = g.id AND gm.user_id = ${actorId}::uuid
                AND gm.status = 'active' AND gm.role IN ('editor', 'admin')
            )
          )
      `
      if (!firstRow(groupRows)) throw new LedgerServiceError('Grupo no encontrado o sin permisos.', 403)
    }

    const rows = await prisma.$queryRaw`
      UPDATE ledger_account
      SET group_id = ${groupId}, updated_at = NOW()
      WHERE id = ${accountId}::uuid AND company_id = ${companyId}::uuid
      RETURNING *
    `
    return firstRow(rows)
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  async function listTransactions({ companyId, accountId, dateFrom, dateTo, page, pageSize }) {
    // Allow up to 2000 rows for the spreadsheet view (default API cap is 100)
    const pag  = normalizePagination({ page, pageSize, maxPageSize: 2000 })
    const from = normalizeOptionalString(dateFrom) ?? null
    const to   = normalizeOptionalString(dateTo)   ?? null

    try {
      // Single query: window functions compute consecutive + running balance,
      // filtered CTE applies date range, COUNT(*) OVER() avoids a second round trip.
      // Account ownership is enforced by the JOIN + company_id filter on the transaction.
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
            )::int4 AS consecutive,
            a.opening_balance + SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0))
              OVER (
                PARTITION BY t.account_id
                ORDER BY t.fecha, t.created_at
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS saldo_actual
          FROM ledger_transaction t
          JOIN ledger_account a ON a.id = t.account_id AND a.company_id = ${companyId}::uuid
          LEFT JOIN ledger_transaction_type tt ON tt.id = t.tipo_id
          LEFT JOIN ledger_category c ON c.id = t.category_id
          WHERE t.account_id = ${accountId}::uuid
            AND t.company_id = ${companyId}::uuid
            AND t.enabled = true
        ),
        filtered AS (
          SELECT * FROM ranked
          WHERE (${from}::date IS NULL OR fecha >= ${from}::date)
            AND (${to}::date   IS NULL OR fecha <= ${to}::date)
        )
        SELECT *, COUNT(*) OVER()::int4 AS _total_count
        FROM filtered
        ORDER BY fecha, created_at
        LIMIT ${pag.pageSize} OFFSET ${pag.offset}
      `

      const total = rows.length > 0 ? (rows[0]._total_count ?? rows.length) : 0
      // Strip the internal count column before returning to callers
      const data = rows.map(({ _total_count, ...r }) => r)

      return {
        data,
        pagination: {
          page:     pag.page,
          pageSize: pag.pageSize,
          total:    toCount(total),
        },
      }
    } catch (err) {
      if (isTableNotFoundError(err)) throw new LedgerServiceError('El modulo Ledger no esta instalado.', 503)
      throw err
    }
  }

  async function createTransaction({ companyId, accountId, data }) {
    const { fecha, tipo_id, numero, nombre, referencia, concepto, deposito, retiro, category_id } = data
    const tipoIdVal     = normalizeOptionalString(tipo_id)     ?? null
    const categoryIdVal = normalizeOptionalString(category_id) ?? null

    // Single round trip: CTE validates account ownership, INSERT only runs if account exists.
    // No pre-flight getAccount() call needed — saves one network round trip to Supabase.
    const rows = await prisma.$queryRaw`
      WITH account_check AS (
        SELECT id FROM ledger_account
        WHERE id = ${accountId}::uuid
          AND company_id = ${companyId}::uuid
          AND enabled = true
      )
      INSERT INTO ledger_transaction
        (account_id, company_id, fecha, tipo_id, numero, nombre,
         referencia, concepto, deposito, retiro, category_id, enabled)
      SELECT
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
      FROM account_check
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new LedgerServiceError('Cuenta no encontrada o no disponible.', 404)
    return row
  }

  async function updateTransaction({ companyId, accountId, transactionId, data }) {
    // Single round trip — no pre-flight SELECT. Each field uses CASE WHEN to only update
    // columns present in the payload, preserving current values for omitted fields.
    // This halves the Supabase round trips vs the old SELECT-then-UPDATE pattern.
    const hasFecha      = hasOwn(data, 'fecha')
    const hasTipoId     = hasOwn(data, 'tipo_id')
    const hasNumero     = hasOwn(data, 'numero')
    const hasNombre     = hasOwn(data, 'nombre')
    const hasReferencia = hasOwn(data, 'referencia')
    const hasConcepto   = hasOwn(data, 'concepto')
    const hasDeposito   = hasOwn(data, 'deposito')
    const hasRetiro     = hasOwn(data, 'retiro')
    const hasCatId      = hasOwn(data, 'category_id')

    const fechaVal    = hasFecha      ? (data.fecha ?? null)                                   : null
    const tipoIdVal   = hasTipoId     ? (normalizeOptionalString(data.tipo_id)     ?? null)    : null
    const numeroVal   = hasNumero     ? (normalizeOptionalString(data.numero)      ?? null)    : null
    const nombreVal   = hasNombre     ? String(data.nombre).trim()                             : null
    const refVal      = hasReferencia ? (normalizeOptionalString(data.referencia)  ?? null)    : null
    const conceptoVal = hasConcepto   ? (normalizeOptionalString(data.concepto)    ?? null)    : null
    const depositoVal = hasDeposito   ? (data.deposito ?? null)                                : null
    const retiroVal   = hasRetiro     ? (data.retiro   ?? null)                                : null
    const catIdVal    = hasCatId      ? (normalizeOptionalString(data.category_id) ?? null)    : null

    const rows = await prisma.$queryRaw`
      UPDATE ledger_transaction
      SET
        fecha       = CASE WHEN ${hasFecha}      THEN ${fechaVal}::date    ELSE fecha       END,
        tipo_id     = CASE WHEN ${hasTipoId}     THEN ${tipoIdVal}::uuid   ELSE tipo_id     END,
        numero      = CASE WHEN ${hasNumero}     THEN ${numeroVal}         ELSE numero      END,
        nombre      = CASE WHEN ${hasNombre}     THEN ${nombreVal}         ELSE nombre      END,
        referencia  = CASE WHEN ${hasReferencia} THEN ${refVal}            ELSE referencia  END,
        concepto    = CASE WHEN ${hasConcepto}   THEN ${conceptoVal}       ELSE concepto    END,
        deposito    = CASE WHEN ${hasDeposito}   THEN ${depositoVal}       ELSE deposito    END,
        retiro      = CASE WHEN ${hasRetiro}     THEN ${retiroVal}         ELSE retiro      END,
        category_id = CASE WHEN ${hasCatId}      THEN ${catIdVal}::uuid    ELSE category_id END,
        updated_at  = NOW()
      WHERE id         = ${transactionId}::uuid
        AND account_id = ${accountId}::uuid
        AND company_id = ${companyId}::uuid
        AND enabled    = true
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new LedgerServiceError('Movimiento no encontrado.', 404)
    return row
  }

  async function setTransactionEnabled({ companyId, accountId, transactionId, enabled }) {
    const rows = await prisma.$queryRaw`
      UPDATE ledger_transaction
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id         = ${transactionId}::uuid
        AND account_id = ${accountId}::uuid
        AND company_id = ${companyId}::uuid
      RETURNING *
    `
    const row = firstRow(rows)
    if (!row) throw new LedgerServiceError('Movimiento no encontrado.', 404)
    return row
  }

  return {
    listAccounts, getAccount, createAccount, canWriteAccount, updateAccount, setAccountEnabled, setAccountGroup,
    listTransactions, createTransaction, updateTransaction, setTransactionEnabled,
  }
}

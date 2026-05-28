import { Hono } from 'hono'
import {
  createAccountSchema, updateAccountSchema,
  createTransactionSchema, updateTransactionSchema,
  enabledSchema,
} from './validators.js'
import { createLedgerService, LedgerServiceError } from './ledger-service.js'
import { createSummaryService } from './summary-service.js'
// export-service and import-service use optional heavy deps (exceljs, pdfkit, csv-parse)
// that may not be hoisted in every workspace context — load them lazily so auth tests
// can import this router without triggering package resolution at module load time.
import { getCompanyId, getValidationErrorMessage } from './service-helpers.js'

function handleError(c, err, fallback) {
  if (err instanceof LedgerServiceError) return c.json({ error: err.message }, err.status)
  if (process.env.NODE_ENV !== 'production') console.error('[atlas.ledger]', err)
  return c.json({ error: fallback }, 500)
}

export function createAccountsRouter({ prisma, requirePermission }) {
  const app     = new Hono()
  const service = createLedgerService({ prisma })
  const summary = createSummaryService({ prisma })

  // ── Accounts ──────────────────────────────────────────────────────────────

  app.get('/ledger/accounts', requirePermission('ledger.accounts.read'), async (c) => {
    try {
      return c.json(await service.listAccounts({ companyId: getCompanyId(c) }))
    } catch (err) { return handleError(c, err, 'No se pudieron listar las cuentas.') }
  })

  app.post('/ledger/accounts', requirePermission('ledger.accounts.create'), async (c) => {
    try {
      const parsed = createAccountSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.createAccount({ companyId: getCompanyId(c), data: parsed.data }) }, 201)
    } catch (err) { return handleError(c, err, 'No se pudo crear la cuenta.') }
  })

  app.get('/ledger/accounts/:id', requirePermission('ledger.accounts.read'), async (c) => {
    try {
      return c.json({ data: await service.getAccount({ companyId: getCompanyId(c), accountId: c.req.param('id') }) })
    } catch (err) { return handleError(c, err, 'No se pudo obtener la cuenta.') }
  })

  app.patch('/ledger/accounts/:id', requirePermission('ledger.accounts.update'), async (c) => {
    try {
      const parsed = updateAccountSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.updateAccount({ companyId: getCompanyId(c), accountId: c.req.param('id'), data: parsed.data }) })
    } catch (err) { return handleError(c, err, 'No se pudo actualizar la cuenta.') }
  })

  app.patch('/ledger/accounts/:id/enabled', requirePermission('ledger.accounts.delete'), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Se requiere { enabled: boolean }.' }, 400)
      return c.json({ data: await service.setAccountEnabled({ companyId: getCompanyId(c), accountId: c.req.param('id'), enabled: parsed.data.enabled }) })
    } catch (err) { return handleError(c, err, 'No se pudo actualizar el estado de la cuenta.') }
  })

  // ── Transactions ─────────────────────────────────────────────────────────

  app.get('/ledger/accounts/:id/transactions', requirePermission('ledger.transactions.read'), async (c) => {
    try {
      const { from, to, page, pageSize } = c.req.query()
      return c.json(await service.listTransactions({
        companyId: getCompanyId(c), accountId: c.req.param('id'),
        dateFrom: from, dateTo: to, page, pageSize,
      }))
    } catch (err) { return handleError(c, err, 'No se pudieron listar los movimientos.') }
  })

  app.post('/ledger/accounts/:id/transactions', requirePermission('ledger.transactions.create'), async (c) => {
    try {
      const parsed = createTransactionSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.createTransaction({ companyId: getCompanyId(c), accountId: c.req.param('id'), data: parsed.data }) }, 201)
    } catch (err) { return handleError(c, err, 'No se pudo crear el movimiento.') }
  })

  app.patch('/ledger/accounts/:id/transactions/:txId', requirePermission('ledger.transactions.update'), async (c) => {
    try {
      const parsed = updateTransactionSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.updateTransaction({ companyId: getCompanyId(c), accountId: c.req.param('id'), transactionId: c.req.param('txId'), data: parsed.data }) })
    } catch (err) { return handleError(c, err, 'No se pudo actualizar el movimiento.') }
  })

  app.patch('/ledger/accounts/:id/transactions/:txId/enabled', requirePermission('ledger.transactions.delete'), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Se requiere { enabled: boolean }.' }, 400)
      return c.json({ data: await service.setTransactionEnabled({ companyId: getCompanyId(c), accountId: c.req.param('id'), transactionId: c.req.param('txId'), enabled: parsed.data.enabled }) })
    } catch (err) { return handleError(c, err, 'No se pudo actualizar el estado del movimiento.') }
  })

  // ── Summary ───────────────────────────────────────────────────────────────

  app.get('/ledger/accounts/:id/summary', requirePermission('ledger.accounts.read'), async (c) => {
    try {
      const { from, to } = c.req.query()
      return c.json(await summary.getAccountSummary({ companyId: getCompanyId(c), accountId: c.req.param('id'), dateFrom: from, dateTo: to }))
    } catch (err) { return handleError(c, err, 'No se pudo obtener el resumen.') }
  })

  // ── Export ────────────────────────────────────────────────────────────────

  app.get('/ledger/accounts/:id/export/xlsx', requirePermission('ledger.export'), async (c) => {
    try {
      const { buildExcelBuffer } = await import('./export-service.js')
      const companyId = getCompanyId(c)
      const { from, to } = c.req.query()
      const account = await service.getAccount({ companyId, accountId: c.req.param('id') })
      const { data: rows } = await service.listTransactions({ companyId, accountId: c.req.param('id'), dateFrom: from, dateTo: to, page: 1, pageSize: 10000 })
      const buffer = await buildExcelBuffer({ account, rows, dateFrom: from, dateTo: to })
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      c.header('Content-Disposition', `attachment; filename="ledger-${Date.now()}.xlsx"`)
      return c.body(buffer)
    } catch (err) { return handleError(c, err, 'No se pudo exportar el archivo Excel.') }
  })

  app.get('/ledger/accounts/:id/export/csv', requirePermission('ledger.export'), async (c) => {
    try {
      const { buildCsvString } = await import('./export-service.js')
      const companyId = getCompanyId(c)
      const { from, to } = c.req.query()
      await service.getAccount({ companyId, accountId: c.req.param('id') })
      const { data: rows } = await service.listTransactions({ companyId, accountId: c.req.param('id'), dateFrom: from, dateTo: to, page: 1, pageSize: 10000 })
      const csv = buildCsvString({ rows })
      c.header('Content-Type', 'text/csv; charset=utf-8')
      c.header('Content-Disposition', `attachment; filename="ledger-${Date.now()}.csv"`)
      return c.body(csv)
    } catch (err) { return handleError(c, err, 'No se pudo exportar el CSV.') }
  })

  app.get('/ledger/accounts/:id/export/pdf', requirePermission('ledger.export'), async (c) => {
    try {
      const { buildPdfBuffer } = await import('./export-service.js')
      const companyId = getCompanyId(c)
      const { from, to } = c.req.query()
      const account = await service.getAccount({ companyId, accountId: c.req.param('id') })
      const { data: rows } = await service.listTransactions({ companyId, accountId: c.req.param('id'), dateFrom: from, dateTo: to, page: 1, pageSize: 10000 })
      const buffer = await buildPdfBuffer({ account, rows, dateFrom: from, dateTo: to })
      c.header('Content-Type', 'application/pdf')
      c.header('Content-Disposition', `attachment; filename="ledger-${Date.now()}.pdf"`)
      return c.body(buffer)
    } catch (err) { return handleError(c, err, 'No se pudo exportar el PDF.') }
  })

  // ── Import ────────────────────────────────────────────────────────────────

  app.post('/ledger/accounts/:id/import/preview', requirePermission('ledger.import'), async (c) => {
    try {
      const { validateImportRows } = await import('./import-service.js')
      const companyId = getCompanyId(c)
      await service.getAccount({ companyId, accountId: c.req.param('id') })
      const body = await c.req.json()
      const { valid, errors } = validateImportRows(body.rows ?? [], body.mapping ?? {})
      return c.json({ valid_count: valid.length, error_count: errors.length, valid, errors })
    } catch (err) { return handleError(c, err, 'No se pudo previsualizar la importacion.') }
  })

  app.post('/ledger/accounts/:id/import/commit', requirePermission('ledger.import'), async (c) => {
    try {
      const { validateImportRows, commitImportRows } = await import('./import-service.js')
      const companyId = getCompanyId(c)
      await service.getAccount({ companyId, accountId: c.req.param('id') })
      const body = await c.req.json()
      const { valid } = validateImportRows(body.rows ?? [], body.mapping ?? {})
      const result = await commitImportRows({ prisma, companyId, accountId: c.req.param('id'), rows: valid })
      return c.json(result, 201)
    } catch (err) { return handleError(c, err, 'No se pudo completar la importacion.') }
  })

  return app
}

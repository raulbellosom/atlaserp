import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLedgerService, LedgerServiceError } from '../ledger-service.js'

const COMPANY_ID = '11111111-1111-7111-a111-111111111111'
const ACCOUNT_ID = '22222222-2222-7222-a222-222222222222'

function createPrismaMock({ rawQueue = [] } = {}) {
  const calls = []
  const queue = [...rawQueue]
  return {
    calls,
    prisma: {
      $queryRaw: async (...args) => {
        calls.push(args)
        const next = queue.shift()
        if (next instanceof Error) throw next
        return next ?? []
      },
    },
  }
}

const ACCOUNT_ROW = {
  id: ACCOUNT_ID, name: 'BBVA', bank: 'BBVA', currency: 'MXN',
  opening_balance: '1000.00', company_id: COMPANY_ID, enabled: true, current_balance: '1000.00',
}

// ── listAccounts ──────────────────────────────────────────────────────────────

test('ledger-service listAccounts: returns rows', async () => {
  const { prisma } = createPrismaMock({ rawQueue: [[ACCOUNT_ROW]] })
  const svc = createLedgerService({ prisma })
  const result = await svc.listAccounts({ companyId: COMPANY_ID })
  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].name, 'BBVA')
})

test('ledger-service listAccounts: maps 42P01 to 503', async () => {
  const err = new Error('relation "ledger_account" does not exist')
  err.code = '42P01'
  const { prisma } = createPrismaMock({ rawQueue: [err] })
  const svc = createLedgerService({ prisma })
  await assert.rejects(
    () => svc.listAccounts({ companyId: COMPANY_ID }),
    (e) => e instanceof LedgerServiceError && e.status === 503
  )
})

// ── getAccount ────────────────────────────────────────────────────────────────

test('ledger-service getAccount: 404 when not found', async () => {
  const { prisma } = createPrismaMock({ rawQueue: [[]] })
  const svc = createLedgerService({ prisma })
  await assert.rejects(
    () => svc.getAccount({ companyId: COMPANY_ID, accountId: ACCOUNT_ID }),
    (e) => e instanceof LedgerServiceError && e.status === 404
  )
})

test('ledger-service getAccount: returns account row', async () => {
  const { prisma } = createPrismaMock({ rawQueue: [[ACCOUNT_ROW]] })
  const svc = createLedgerService({ prisma })
  const result = await svc.getAccount({ companyId: COMPANY_ID, accountId: ACCOUNT_ID })
  assert.equal(result.name, 'BBVA')
})

// ── createAccount ─────────────────────────────────────────────────────────────

test('ledger-service createAccount: returns inserted row', async () => {
  const { prisma } = createPrismaMock({ rawQueue: [[ACCOUNT_ROW]] })
  const svc = createLedgerService({ prisma })
  const result = await svc.createAccount({ companyId: COMPANY_ID, data: { name: 'BBVA', bank: 'BBVA', currency: 'MXN', opening_balance: 0 } })
  assert.equal(result.name, 'BBVA')
})

test('ledger-service createAccount: maps 23505 to 409', async () => {
  const err = new Error('duplicate key value violates unique constraint')
  err.code = '23505'
  const { prisma } = createPrismaMock({ rawQueue: [err] })
  const svc = createLedgerService({ prisma })
  await assert.rejects(
    () => svc.createAccount({ companyId: COMPANY_ID, data: { name: 'BBVA', bank: 'BBVA', currency: 'MXN', opening_balance: 0 } }),
    (e) => e instanceof LedgerServiceError && e.status === 409
  )
})

// ── listTransactions — window function ───────────────────────────────────────
// listTransactions issues a single query: window CTE + filtered CTE + COUNT(*) OVER()

test('ledger-service listTransactions: returns rows with consecutive and saldo_actual', async () => {
  // _total_count is added by COUNT(*) OVER() and stripped before returning to callers
  const txRow = {
    id: 'tx-1', fecha: new Date('2026-01-15'), deposito: '500.00', retiro: null,
    consecutive: 1, saldo_actual: '1500.00', nombre: 'Deposito', _total_count: 1,
  }
  const { prisma } = createPrismaMock({
    rawQueue: [
      [txRow],  // single merged query (window + filter + COUNT(*) OVER)
    ],
  })
  const svc = createLedgerService({ prisma })
  const result = await svc.listTransactions({ companyId: COMPANY_ID, accountId: ACCOUNT_ID, page: 1, pageSize: 10 })
  assert.equal(result.data.length, 1)
  assert.equal(String(result.data[0].saldo_actual), '1500.00')
  assert.equal(result.data[0]._total_count, undefined, '_total_count debe ser eliminado del resultado')
  assert.equal(result.pagination.total, 1)
})

// ── setTransactionEnabled ─────────────────────────────────────────────────────

test('ledger-service setTransactionEnabled: 404 when not found', async () => {
  const { prisma } = createPrismaMock({ rawQueue: [[]] })
  const svc = createLedgerService({ prisma })
  await assert.rejects(
    () => svc.setTransactionEnabled({ companyId: COMPANY_ID, accountId: ACCOUNT_ID, transactionId: 'tx-x', enabled: false }),
    (e) => e instanceof LedgerServiceError && e.status === 404
  )
})

// ── setAccountEnabled ─────────────────────────────────────────────────────────

test('ledger-service setAccountEnabled: 404 when not found', async () => {
  const { prisma } = createPrismaMock({ rawQueue: [[]] })
  const svc = createLedgerService({ prisma })
  await assert.rejects(
    () => svc.setAccountEnabled({ companyId: COMPANY_ID, accountId: ACCOUNT_ID, enabled: false }),
    (e) => e instanceof LedgerServiceError && e.status === 404
  )
})

test('ledger-service setAccountEnabled: returns updated row', async () => {
  const { prisma } = createPrismaMock({ rawQueue: [[{ ...ACCOUNT_ROW, enabled: false }]] })
  const svc = createLedgerService({ prisma })
  const result = await svc.setAccountEnabled({ companyId: COMPANY_ID, accountId: ACCOUNT_ID, enabled: false })
  assert.equal(result.enabled, false)
})

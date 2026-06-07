import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { LedgerSQLiteStore, isTauriAvailable } from '../ledger-sqlite.js'

function makeDbMock() {
  const executes = []
  const selects = []

  return {
    executes,
    selects,
    async execute(sql, params = []) {
      executes.push({ sql, params })
      return { rowsAffected: 1 }
    },
    async select(sql, params = []) {
      selects.push({ sql, params })
      if (sql.includes('FROM ledger_transaction_type')) {
        return [{ id: 'type-1', code: 'DEP', name: 'Deposito' }]
      }
      if (sql.includes('FROM ledger_category') && sql.includes('ORDER BY name ASC')) {
        return [{ id: 'cat-1', name: 'Ingresos', color: '#22c55e', kind: 'both' }]
      }
      if (sql.includes('AS balance')) {
        return [{ balance: 110 }]
      }
      if (sql.includes('FROM ledger_account')) {
        return [
          {
            id: 'acc-1',
            company_id: 'company-1',
            name: 'Caja',
            bank: 'Atlas',
            account_number: '1234',
            currency: 'MXN',
            opening_balance: 100,
            owner_id: 'user-1',
            group_id: null,
            current_balance: 110,
          },
        ]
      }
      if (sql.includes('FROM ledger_transaction') && sql.includes('COUNT(*) OVER()')) {
        return [
          {
            id: 'tx-1',
            company_id: 'company-1',
            account_id: 'acc-1',
            category_id: 'cat-1',
            tipo_id: 'type-1',
            nombre: 'Deposito',
            fecha: '2026-06-07',
            deposito: 10,
            retiro: null,
            tipo_code: 'DEP',
            tipo_name: 'Deposito',
            category_name: 'Ingresos',
            category_color: '#22c55e',
            consecutive: 1,
            saldo_actual: 110,
          },
        ]
      }
      if (sql.includes(`strftime('%m', fecha)`)) {
        return [{ month: '06', depositTotal: 10, withdrawalTotal: 2 }]
      }
      if (sql.includes('ROW_NUMBER() OVER (PARTITION BY fecha')) {
        return [{ fecha: '2026-06-07', balance: 110 }]
      }
      if (sql.includes('COALESCE(SUM(COALESCE(deposito, 0)), 0) AS total_deposito')) {
        return [{ total_deposito: 10, total_retiro: 2 }]
      }
      if (sql.includes('GROUP BY c.name, c.color')) {
        return [{ category_name: 'Ingresos', color: '#22c55e', deposito: 10, retiro: 2 }]
      }
      return []
    },
    async close() {},
  }
}

describe('LedgerSQLiteStore', () => {
  let store
  let db

  beforeEach(() => {
    db = makeDbMock()
    store = new LedgerSQLiteStore({
      companyId: 'company-1',
      dbLoader: async () => db,
    })
  })

  it('returns false when Tauri internals are missing', () => {
    const originalWindow = globalThis.window
    globalThis.window = undefined
    try {
      assert.equal(isTauriAvailable(), false)
    } finally {
      globalThis.window = originalWindow
    }
  })

  it('creates tables and indexes during open', async () => {
    await store.open()
    assert.ok(db.executes.some((entry) => entry.sql.includes('CREATE TABLE IF NOT EXISTS ledger_account')))
    assert.ok(db.executes.some((entry) => entry.sql.includes('CREATE INDEX IF NOT EXISTS idx_lt_account_fecha')))
  })

  it('upserts account records and supports sync wrappers', async () => {
    await store.open()
    await store.upsertBatch('account', [{
      id: 'sync-1',
      data: {
        id: 'acc-1',
        companyId: 'company-1',
        name: 'Caja',
        bank: 'Atlas',
        accountNumber: '1234',
        currency: 'MXN',
        openingBalance: 100,
        enabled: true,
        createdAt: '2026-06-07T00:00:00.000Z',
        updatedAt: '2026-06-07T00:00:00.000Z',
      },
      deleted: false,
    }])

    const insert = db.executes.find((entry) => entry.sql.includes('INSERT OR REPLACE INTO ledger_account'))
    assert.ok(insert)
    assert.equal(insert.params[0], 'acc-1')
    assert.equal(insert.params[7], 'MXN')
  })

  it('deletes rows when a record is marked deleted', async () => {
    await store.open()
    await store.upsertBatch('transaction', [{ id: 'tx-1', deleted: true }])
    assert.ok(db.executes.some((entry) => entry.sql.includes('DELETE FROM ledger_transaction WHERE id = ?')))
  })

  it('runs account and reporting queries', async () => {
    await store.open()
    const accounts = await store.getAccountList()
    assert.equal(accounts.length, 1)
    assert.equal(accounts[0].current_balance, 110)
    assert.equal(accounts[0].owner_id, 'user-1')

    const account = await store.getAccount('acc-1')
    assert.equal(account.id, 'acc-1')
    assert.equal(account.current_balance, 110)

    assert.equal((await store.getTransactionTypes()).length, 1)
    assert.equal((await store.getCategories()).length, 1)

    const transactions = await store.queryTransactions('acc-1', { start: '2026-06-01', end: '2026-06-30' })
    assert.equal(transactions.length, 1)
    assert.equal(transactions[0].saldo_actual, 110)
    assert.equal(transactions[0].tipo_code, 'DEP')

    assert.equal(await store.getRunningBalance('acc-1', '2026-06-30'), 110)
    assert.equal((await store.getMonthlySummary('acc-1', 2026)).length, 1)

    const breakdown = await store.getCategoryBreakdown('acc-1', { start: '2026-06-01', end: '2026-06-30' })
    assert.equal(breakdown.length, 1)
    assert.equal(breakdown[0].deposito, 10)

    const summary = await store.getAccountSummary('acc-1', { start: '2026-06-01', end: '2026-06-30' })
    assert.deepEqual(Object.keys(summary), ['kpis', 'balance_series', 'by_category'])
    assert.equal(summary.kpis.current_balance, 110)
    assert.equal(summary.balance_series.length, 1)
    assert.equal(summary.by_category.length, 1)
  })
})

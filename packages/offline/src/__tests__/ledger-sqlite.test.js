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
      if (sql.includes('AS balance')) {
        return [{ balance: 110 }]
      }
      if (sql.includes('FROM ledger_account')) {
        return [
          {
            id: 'acc-1',
            companyId: 'company-1',
            name: 'Caja',
            bank: 'Atlas',
            currency: 'MXN',
            openingBalance: 100,
          },
        ]
      }
      if (sql.includes('FROM ledger_transaction') && sql.includes('ORDER BY fecha DESC')) {
        return [
          {
            id: 'tx-1',
            companyId: 'company-1',
            accountId: 'acc-1',
            nombre: 'Deposito',
            fecha: '2026-06-07',
            deposito: 10,
            retiro: null,
          },
        ]
      }
      if (sql.includes(`strftime('%m', fecha)`)) {
        return [{ month: '06', depositTotal: 10, withdrawalTotal: 2 }]
      }
      if (sql.includes('GROUP BY c.id, c.name, c.color')) {
        return [{ categoryId: 'cat-1', categoryName: 'Ingresos', categoryColor: '#22c55e', total: 10 }]
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
    assert.equal(insert.params[5], 'MXN')
  })

  it('deletes rows when a record is marked deleted', async () => {
    await store.open()
    await store.upsertBatch('transaction', [{ id: 'tx-1', deleted: true }])
    assert.ok(db.executes.some((entry) => entry.sql.includes('DELETE FROM ledger_transaction WHERE id = ?')))
  })

  it('runs account and reporting queries', async () => {
    await store.open()
    assert.equal((await store.getAccountList()).length, 1)
    assert.equal((await store.queryTransactions('acc-1', { start: '2026-06-01', end: '2026-06-30' })).length, 1)
    assert.equal(await store.getRunningBalance('acc-1', '2026-06-30'), 110)
    assert.equal((await store.getMonthlySummary('acc-1', 2026)).length, 1)
    assert.equal((await store.getCategoryBreakdown('acc-1', { start: '2026-06-01', end: '2026-06-30' })).length, 1)
  })
})

const ENTITY_CONFIG = {
  account: {
    table: 'ledger_account',
    columns: [
      'id',
      'company_id',
      'name',
      'bank',
      'account_number',
      'currency',
      'opening_balance',
      'enabled',
      'created_at',
      'updated_at',
    ],
    mapRecord(record) {
      return [
        record.id,
        record.companyId,
        record.name,
        record.bank,
        record.accountNumber ?? null,
        record.currency ?? 'MXN',
        Number(record.openingBalance ?? 0),
        record.enabled === false ? 0 : 1,
        record.createdAt,
        record.updatedAt,
      ]
    },
  },
  transaction: {
    table: 'ledger_transaction',
    columns: [
      'id',
      'company_id',
      'account_id',
      'category_id',
      'tipo_id',
      'fecha',
      'numero',
      'nombre',
      'referencia',
      'concepto',
      'deposito',
      'retiro',
      'enabled',
      'created_at',
      'updated_at',
    ],
    mapRecord(record) {
      return [
        record.id,
        record.companyId,
        record.accountId,
        record.categoryId ?? null,
        record.tipoId ?? null,
        record.fecha,
        record.numero ?? null,
        record.nombre,
        record.referencia ?? null,
        record.concepto ?? null,
        record.deposito ?? null,
        record.retiro ?? null,
        record.enabled === false ? 0 : 1,
        record.createdAt,
        record.updatedAt,
      ]
    },
  },
  category: {
    table: 'ledger_category',
    columns: [
      'id',
      'company_id',
      'name',
      'color',
      'kind',
      'enabled',
      'created_at',
      'updated_at',
    ],
    mapRecord(record) {
      return [
        record.id,
        record.companyId,
        record.name,
        record.color ?? null,
        record.kind ?? 'both',
        record.enabled === false ? 0 : 1,
        record.createdAt,
        record.updatedAt,
      ]
    },
  },
  transaction_type: {
    table: 'ledger_transaction_type',
    columns: [
      'id',
      'company_id',
      'code',
      'name',
      'enabled',
      'created_at',
      'updated_at',
    ],
    mapRecord(record) {
      return [
        record.id,
        record.companyId,
        record.code,
        record.name,
        record.enabled === false ? 0 : 1,
        record.createdAt,
        record.updatedAt,
      ]
    },
  },
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS ledger_account (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    bank TEXT NOT NULL,
    account_number TEXT,
    currency TEXT NOT NULL DEFAULT 'MXN',
    opening_balance REAL NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ledger_transaction (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT,
    tipo_id TEXT,
    fecha TEXT NOT NULL,
    numero TEXT,
    nombre TEXT NOT NULL,
    referencia TEXT,
    concepto TEXT,
    deposito REAL,
    retiro REAL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ledger_category (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    kind TEXT NOT NULL DEFAULT 'both',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ledger_transaction_type (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_lt_account_fecha ON ledger_transaction(account_id, fecha)',
  'CREATE INDEX IF NOT EXISTS idx_lt_company_fecha ON ledger_transaction(company_id, fecha)',
  'CREATE INDEX IF NOT EXISTS idx_lt_category ON ledger_transaction(category_id)',
]

function normalizeRecord(record) {
  return record?.data ?? record
}

function normalizePath(path) {
  return String(path).replace(/\\/g, '/')
}

async function loadTauriDatabase(path) {
  const { default: Database } = await import('@tauri-apps/plugin-sql')
  return Database.load(path)
}

export function isTauriAvailable() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

export class LedgerSQLiteStore {
  #dbLoader
  #openPromise

  constructor({ companyId, dbLoader } = {}) {
    this.companyId = companyId
    this.db = null
    this.#dbLoader = dbLoader ?? loadTauriDatabase
    this.#openPromise = null
  }

  async open() {
    if (this.db) return this.db
    if (!this.companyId) {
      throw new Error('LedgerSQLiteStore requires companyId')
    }
    if (!this.#openPromise) {
      this.#openPromise = (async () => {
        const path = normalizePath(`sqlite:atlas-erp/ledger-${this.companyId}.db`)
        const database = await this.#dbLoader(path)
        this.db = database
        await this._migrate()
        return database
      })().catch((error) => {
        this.#openPromise = null
        throw error
      })
    }
    return this.#openPromise
  }

  async _migrate() {
    const database = this.#ensureDb()
    for (const sql of MIGRATIONS) {
      await database.execute(sql)
    }
  }

  async upsertBatch(entityType, records = []) {
    const config = ENTITY_CONFIG[entityType]
    if (!config) {
      throw new Error(`Unsupported ledger entity type: ${entityType}`)
    }
    const database = this.#ensureDb()
    if (!Array.isArray(records) || records.length === 0) return

    const placeholders = config.columns.map(() => '?').join(', ')
    const insertSql = `INSERT OR REPLACE INTO ${config.table} (${config.columns.join(', ')}) VALUES (${placeholders})`
    const deleteSql = `DELETE FROM ${config.table} WHERE id = ?`

    for (const record of records) {
      if (record?.deleted === true) {
        if (record?.id) {
          await database.execute(deleteSql, [record.id])
        }
        continue
      }

      const normalized = normalizeRecord(record)
      if (!normalized?.id) continue
      await database.execute(insertSql, config.mapRecord(normalized))
    }
  }

  async getAccountList() {
    const database = this.#ensureDb()
    return database.select(
      `SELECT
        id,
        company_id AS companyId,
        name,
        bank,
        account_number AS accountNumber,
        currency,
        opening_balance AS openingBalance,
        enabled,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ledger_account
      WHERE company_id = ? AND enabled = 1
      ORDER BY name ASC`,
      [this.companyId],
    )
  }

  async queryTransactions(accountId, { start, end, limit = 100, offset = 0 } = {}) {
    const database = this.#ensureDb()
    const conditions = ['company_id = ?', 'account_id = ?', 'enabled = 1']
    const params = [this.companyId, accountId]

    if (start) {
      conditions.push('fecha >= ?')
      params.push(start)
    }
    if (end) {
      conditions.push('fecha <= ?')
      params.push(end)
    }

    params.push(limit, offset)

    return database.select(
      `SELECT
        id,
        company_id AS companyId,
        account_id AS accountId,
        category_id AS categoryId,
        tipo_id AS tipoId,
        fecha,
        numero,
        nombre,
        referencia,
        concepto,
        deposito,
        retiro,
        enabled,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ledger_transaction
      WHERE ${conditions.join(' AND ')}
      ORDER BY fecha DESC, created_at DESC
      LIMIT ? OFFSET ?`,
      params,
    )
  }

  async getRunningBalance(accountId, upToDate) {
    const database = this.#ensureDb()
    const rows = await database.select(
      `SELECT
        COALESCE(a.opening_balance, 0) +
        COALESCE(SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0)), 0) AS balance
      FROM ledger_account a
      LEFT JOIN ledger_transaction t
        ON t.account_id = a.id
        AND t.company_id = a.company_id
        AND t.enabled = 1
        AND (? IS NULL OR t.fecha <= ?)
      WHERE a.company_id = ? AND a.id = ?
      GROUP BY a.id, a.opening_balance`,
      [upToDate ?? null, upToDate ?? null, this.companyId, accountId],
    )

    return Number(rows?.[0]?.balance ?? 0)
  }

  async getMonthlySummary(accountId, year) {
    const database = this.#ensureDb()
    return database.select(
      `SELECT
        strftime('%m', fecha) AS month,
        COALESCE(SUM(COALESCE(deposito, 0)), 0) AS depositTotal,
        COALESCE(SUM(COALESCE(retiro, 0)), 0) AS withdrawalTotal
      FROM ledger_transaction
      WHERE company_id = ?
        AND account_id = ?
        AND enabled = 1
        AND strftime('%Y', fecha) = ?
      GROUP BY strftime('%m', fecha)
      ORDER BY month ASC`,
      [this.companyId, accountId, String(year)],
    )
  }

  async getCategoryBreakdown(accountId, { start, end } = {}) {
    const database = this.#ensureDb()
    const conditions = [
      't.company_id = ?',
      't.account_id = ?',
      't.enabled = 1',
      't.category_id IS NOT NULL',
    ]
    const params = [this.companyId, accountId]

    if (start) {
      conditions.push('t.fecha >= ?')
      params.push(start)
    }
    if (end) {
      conditions.push('t.fecha <= ?')
      params.push(end)
    }

    return database.select(
      `SELECT
        c.id AS categoryId,
        c.name AS categoryName,
        c.color AS categoryColor,
        COALESCE(SUM(COALESCE(t.deposito, 0) - COALESCE(t.retiro, 0)), 0) AS total
      FROM ledger_transaction t
      INNER JOIN ledger_category c
        ON c.id = t.category_id
        AND c.company_id = t.company_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.id, c.name, c.color
      ORDER BY total DESC, c.name ASC`,
      params,
    )
  }

  async close() {
    if (!this.db) return
    const database = this.db
    this.db = null
    this.#openPromise = null
    await database.close()
  }

  #ensureDb() {
    if (!this.db) {
      throw new Error('LedgerSQLiteStore is not open')
    }
    return this.db
  }
}

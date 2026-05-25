import { createHash } from 'node:crypto'
import {
  assertSafeMigrationSql,
  createChecksum,
  generateCreateTableSql,
} from '@atlas/module-engine'

function toObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`)
  }
  return value
}

function toRequiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value.trim()
}

function toMigrationFilename(model, checksum) {
  const tableName = toRequiredString(model.tableName, 'model.tableName')
  return `${tableName}__${checksum.slice(0, 12)}.sql`
}

function splitSqlStatements(sql) {
  const statements = []
  let current = ''
  let i = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false
  let dollarTag = null

  while (i < sql.length) {
    const ch = sql[i]
    const next = i + 1 < sql.length ? sql[i + 1] : ''

    if (inLineComment) {
      current += ch
      if (ch === '\n') {
        inLineComment = false
      }
      i += 1
      continue
    }

    if (inBlockComment) {
      current += ch
      if (ch === '*' && next === '/') {
        current += next
        i += 2
        inBlockComment = false
        continue
      }
      i += 1
      continue
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      current += ch
      i += 1
      continue
    }

    if (inSingleQuote) {
      current += ch
      if (ch === "'") {
        if (next === "'") {
          current += next
          i += 2
          continue
        }
        inSingleQuote = false
      }
      i += 1
      continue
    }

    if (inDoubleQuote) {
      current += ch
      if (ch === '"') {
        if (next === '"') {
          current += next
          i += 2
          continue
        }
        inDoubleQuote = false
      }
      i += 1
      continue
    }

    if (ch === '-' && next === '-') {
      inLineComment = true
      current += ch + next
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true
      current += ch + next
      i += 2
      continue
    }

    if (ch === "'") {
      inSingleQuote = true
      current += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inDoubleQuote = true
      current += ch
      i += 1
      continue
    }

    if (ch === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)
      if (match) {
        dollarTag = match[0]
        current += dollarTag
        i += dollarTag.length
        continue
      }
    }

    if (ch === ';') {
      const statement = current.trim()
      if (statement) {
        statements.push(`${statement};`)
      }
      current = ''
      i += 1
      continue
    }

    current += ch
    i += 1
  }

  const tail = current.trim()
  if (tail) {
    statements.push(tail.endsWith(';') ? tail : `${tail};`)
  }

  return statements
}

export function createModuleMigrationService({ prisma }) {
  if (!prisma) {
    throw new Error('createModuleMigrationService: prisma is required')
  }

  function generateSqlForModel(model) {
    const safeModel = toObject(model, 'model')
    const sql = generateCreateTableSql(safeModel)
    assertSafeMigrationSql(sql)
    return sql
  }

  async function planModelMigrations({ moduleKey, models }) {
    const safeModuleKey = toRequiredString(moduleKey, 'moduleKey')
    const safeModels = Array.isArray(models) ? models : []
    const plans = []

    for (const model of safeModels) {
      const safeModel = toObject(model, 'model')
      const sql = generateSqlForModel(safeModel)
      const checksum = createChecksum(safeModel)
      const filename = toMigrationFilename(safeModel, checksum)
      const existing = await prisma.moduleMigration.findUnique({
        where: {
          moduleKey_filename: {
            moduleKey: safeModuleKey,
            filename,
          },
        },
      })

      plans.push({
        moduleKey: safeModuleKey,
        modelKey: safeModel.key ?? null,
        tableName: safeModel.tableName,
        filename,
        checksum,
        sql,
        alreadyApplied: Boolean(existing),
        shouldApply: !existing,
      })
    }

    return plans
  }

  async function applySqlMigration({ moduleKey, filename, sql: sqlInput, allowUnsafeSql = false }) {
    const safeModuleKey = toRequiredString(moduleKey, 'moduleKey')
    const safeFilename = toRequiredString(filename, 'filename')
    const sql = toRequiredString(sqlInput, 'sql')

    return prisma.$transaction(async (tx) => {
      const existing = await tx.moduleMigration.findUnique({
        where: {
          moduleKey_filename: {
            moduleKey: safeModuleKey,
            filename: safeFilename,
          },
        },
      })
      if (existing) {
        return { applied: false, reason: 'already_applied', migration: existing }
      }

      const checksum = createHash('sha256').update(sql).digest('hex')

      for (const statement of splitSqlStatements(sql)) {
        try {
          if (!allowUnsafeSql) {
            assertSafeMigrationSql(statement)
          }
          await tx.$executeRawUnsafe(statement)
        } catch (err) {
          const wrapped = new Error(`SQL execution failed for '${safeFilename}': ${err.message}`)
          wrapped.code = 'AME_SQL_MIGRATION_EXECUTION_FAILED'
          wrapped.moduleKey = safeModuleKey
          wrapped.filename = safeFilename
          wrapped.sqlPreview = sql.slice(0, 500)
          wrapped.statementPreview = statement.slice(0, 500)
          wrapped.cause = err
          throw wrapped
        }
      }

      const migration = await tx.moduleMigration.create({
        data: {
          moduleKey: safeModuleKey,
          filename: safeFilename,
          checksum,
        },
      })

      return { applied: true, migration }
    })
  }

  async function listAppliedMigrations(moduleKey) {
    const safeModuleKey = toRequiredString(moduleKey, 'moduleKey')
    return prisma.moduleMigration.findMany({
      where: { moduleKey: safeModuleKey },
      orderBy: [{ appliedAt: 'asc' }, { filename: 'asc' }],
    })
  }

  return {
    generateSqlForModel,
    planModelMigrations,
    applySqlMigration,
    listAppliedMigrations,
  }
}

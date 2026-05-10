// TODO(AME3): switch to '@atlas/module-engine' once the package is linked for API runtime resolution.
import {
  assertSafeMigrationSql,
  createChecksum,
  generateCreateTableSql,
} from '../../../../packages/module-engine/src/index.js'

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
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => `${statement};`)
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
      const checksum = createChecksum(sql)
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

  async function applySqlMigration({ moduleKey, filename, sql: sqlInput }) {
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

      assertSafeMigrationSql(sql)
      const checksum = createChecksum(sql)

      for (const statement of splitSqlStatements(sql)) {
        assertSafeMigrationSql(statement)
        await tx.$executeRawUnsafe(statement)
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

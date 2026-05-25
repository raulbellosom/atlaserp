import { SQL_TYPE_MAP } from './field-types.js'
import { RESERVED_TABLE_PREFIXES } from './constants.js'
import { ModuleEngineError } from './errors.js'

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

// Patterns that indicate destructive or unsafe SQL. assertSafeMigrationSql rejects these.
const FORBIDDEN_SQL_PATTERNS = [
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+INDEX\b/i,
  /\bALTER\s+SYSTEM\b/i,
  /\bCREATE\s+EXTENSION\b/i,
  /\bCOPY\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+(?:"[^"]+"|\w+)/i,
  /(^|\s)\\(?:c|i|!)(?:\s|$)/im,
]

const SAFE_ADDITIVE_ALTER_TABLE_RE =
  /^\s*ALTER\s+TABLE\s+(?:"[^"]+"|\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+/im

const UNSAFE_ALTER_TABLE_PARTS_RE =
  /\b(DROP\s+COLUMN|ALTER\s+COLUMN|RENAME\s+COLUMN|RENAME\s+TO|SET\s+DATA\s+TYPE|ADD\s+CONSTRAINT|DROP\s+CONSTRAINT)\b/i

function requireSafeIdentifier(name, context) {
  if (!IDENTIFIER_RE.test(name)) {
    throw new ModuleEngineError(
      `${context}: "${name}" is not a safe SQL identifier (letters, digits, underscores only; must start with letter or underscore)`,
      'AME_UNSAFE_IDENTIFIER'
    )
  }
  return `"${name}"`
}

function escapeSqlString(value) {
  return value.replaceAll("'", "''")
}

function fieldToColumnSql(field) {
  const typeMapper = SQL_TYPE_MAP[field.type]
  if (!typeMapper) {
    throw new ModuleEngineError(
      `generateCreateTableSql: unsupported field type "${field.type}"`,
      'AME_UNSUPPORTED_FIELD_TYPE'
    )
  }
  const sqlType   = typeMapper(field)
  const notNull   = field.required ? ' NOT NULL' : ''
  const defClause = field.default !== undefined
    ? ` DEFAULT ${typeof field.default === 'string' ? `'${escapeSqlString(field.default)}'` : field.default}`
    : ''
  return `  ${requireSafeIdentifier(field.name, 'generateCreateTableSql field')} ${sqlType}${notNull}${defClause}`
}

// Returns a PostgreSQL CREATE TABLE IF NOT EXISTS DDL string.
// Pure function — no database connection, no side effects.
// tableName must be a safe SQL identifier and must not start with a reserved prefix (pg_, _pg_, sql_).
// Convention (not enforced here): official modules use atlas_<module>_<entity>; custom use custom_<module>_<entity>.
export function generateCreateTableSql(modelDef) {
  if (!modelDef || typeof modelDef !== 'object') {
    throw new ModuleEngineError('generateCreateTableSql: modelDef must be a plain object', 'AME_INVALID_MODEL')
  }
  const { tableName, companyScoped = true, softDelete = false, fields = [], indexes = [] } = modelDef

  if (!tableName || !IDENTIFIER_RE.test(tableName)) {
    throw new ModuleEngineError(
      `generateCreateTableSql: tableName "${tableName}" is not a safe SQL identifier`,
      'AME_UNSAFE_IDENTIFIER'
    )
  }
  const lower = tableName.toLowerCase()
  const reserved = RESERVED_TABLE_PREFIXES.find((p) => lower.startsWith(p))
  if (reserved) {
    throw new ModuleEngineError(
      `generateCreateTableSql: tableName must not start with reserved prefix "${reserved}"`,
      'AME_RESERVED_TABLE_PREFIX'
    )
  }

  const table   = requireSafeIdentifier(tableName, 'generateCreateTableSql')
  const columns = []
  columns.push(`  "id" UUID PRIMARY KEY DEFAULT uuidv7()`)
  if (companyScoped) {
    columns.push(`  "company_id" UUID NOT NULL`)
  }
  for (const field of fields) {
    columns.push(fieldToColumnSql(field))
  }
  if (softDelete) {
    columns.push(`  "enabled" BOOLEAN NOT NULL DEFAULT true`)
  }
  columns.push(`  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()`)
  columns.push(`  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()`)

  const lines = [
    `CREATE TABLE IF NOT EXISTS ${table} (`,
    columns.join(',\n'),
    `);`,
  ]
  for (const idx of indexes) {
    const cols    = idx.fields.map((f) => requireSafeIdentifier(f, 'generateCreateTableSql index')).join(', ')
    const unique  = idx.unique ? 'UNIQUE INDEX' : 'INDEX'
    const idxName = `${tableName}_${idx.fields.join('_')}_idx`
    lines.push(`CREATE ${unique} IF NOT EXISTS "${idxName}" ON ${table} (${cols});`)
  }
  return lines.join('\n')
}

// Asserts that a SQL string contains no forbidden destructive patterns.
// Throws ModuleEngineError if any forbidden pattern is found.
// Returns undefined (void) if the SQL is safe.
// Call this before executing any SQL from generateCreateTableSql or module migration files.
export function assertSafeMigrationSql(sql) {
  if (typeof sql !== 'string') {
    throw new ModuleEngineError('assertSafeMigrationSql: sql must be a string', 'AME_INVALID_SQL')
  }
  if (/\bALTER\s+TABLE\b/i.test(sql)) {
    if (!SAFE_ADDITIVE_ALTER_TABLE_RE.test(sql) || UNSAFE_ALTER_TABLE_PARTS_RE.test(sql)) {
      throw new ModuleEngineError(
        'assertSafeMigrationSql: ALTER TABLE is allowed only for additive ADD COLUMN IF NOT EXISTS statements. ' +
        'For other DDL (SET DEFAULT, ADD CONSTRAINT, RENAME, etc.) add unsafe: true to the migration entry in module.manifest.js.',
        'AME_UNSAFE_SQL'
      )
    }
  }

  for (const pattern of FORBIDDEN_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      throw new ModuleEngineError(
        `assertSafeMigrationSql: SQL contains a forbidden destructive pattern matching ${pattern}. Only additive DDL is allowed (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).`,
        'AME_UNSAFE_SQL'
      )
    }
  }
}


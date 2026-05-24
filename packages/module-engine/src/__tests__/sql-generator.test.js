import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateCreateTableSql, assertSafeMigrationSql } from '../sql-generator.js'
import { ModuleEngineError } from '../errors.js'

const VEHICLE_MODEL = {
  tableName:     'fleet_vehicle',
  companyScoped: true,
  softDelete:    true,
  fields: [
    { name: 'plate',     type: 'text',     required: true, maxLength: 20 },
    { name: 'brand',     type: 'text',     required: true, maxLength: 100 },
    { name: 'year',      type: 'number',   required: true },
    { name: 'status',    type: 'select',   required: true, default: 'active' },
    { name: 'driver_id', type: 'relation' },
    { name: 'notes',     type: 'textarea' },
  ],
  indexes: [
    { fields: ['company_id', 'plate'], unique: true },
    { fields: ['company_id', 'status'] },
  ],
}

test('generateCreateTableSql - starts with CREATE TABLE IF NOT EXISTS', () => {
  const sql = generateCreateTableSql(VEHICLE_MODEL)
  assert.ok(sql.startsWith('CREATE TABLE IF NOT EXISTS "fleet_vehicle"'))
})

test('generateCreateTableSql - atlas_ prefix also accepted', () => {
  const sql = generateCreateTableSql({ ...VEHICLE_MODEL, tableName: 'atlas_fleet_vehicle' })
  assert.ok(sql.includes('"atlas_fleet_vehicle"'))
})

test('generateCreateTableSql - includes id UUID column', () => {
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('"id" UUID PRIMARY KEY DEFAULT uuidv7()'))
})

test('generateCreateTableSql - includes company_id when companyScoped', () => {
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('"company_id" UUID NOT NULL'))
})

test('generateCreateTableSql - omits company_id column when companyScoped:false', () => {
  const sql = generateCreateTableSql({ ...VEHICLE_MODEL, companyScoped: false })
  assert.ok(!sql.includes('"company_id" UUID NOT NULL'))
})

test('generateCreateTableSql - includes enabled when softDelete', () => {
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('"enabled" BOOLEAN NOT NULL DEFAULT true'))
})

test('generateCreateTableSql - omits enabled when softDelete:false', () => {
  assert.ok(!generateCreateTableSql({ ...VEHICLE_MODEL, softDelete: false }).includes('"enabled"'))
})

test('generateCreateTableSql - text with maxLength uses VARCHAR(N)', () => {
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('VARCHAR(20)'))
})

test('generateCreateTableSql - number maps to INTEGER', () => {
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('"year" INTEGER NOT NULL'))
})

test('generateCreateTableSql - relation maps to UUID', () => {
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('"driver_id" UUID'))
})

test('generateCreateTableSql - escapes single quotes in string defaults', () => {
  const sql = generateCreateTableSql({
    tableName: 'fleet_vehicle_defaults',
    fields: [{ name: 'nickname', type: 'text', default: "O'Brien" }],
  })
  assert.ok(sql.includes(`DEFAULT 'O''Brien'`))
})

test('generateCreateTableSql - includes created_at and updated_at', () => {
  const sql = generateCreateTableSql(VEHICLE_MODEL)
  assert.ok(sql.includes('"created_at" TIMESTAMPTZ NOT NULL DEFAULT now()'))
  assert.ok(sql.includes('"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()'))
})

test('generateCreateTableSql - creates unique index', () => {
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('CREATE UNIQUE INDEX IF NOT EXISTS'))
})

test('generateCreateTableSql - creates non-unique index', () => {
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('CREATE INDEX IF NOT EXISTS'))
})

test('generateCreateTableSql - throws ModuleEngineError for pg_ prefix', () => {
  assert.throws(
    () => generateCreateTableSql({ ...VEHICLE_MODEL, tableName: 'pg_vehicle' }),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_RESERVED_TABLE_PREFIX'
  )
})

test('generateCreateTableSql - throws for unsafe identifier (space in name)', () => {
  assert.throws(
    () => generateCreateTableSql({ ...VEHICLE_MODEL, tableName: 'fleet vehicle' }),
    (err) => err instanceof ModuleEngineError
  )
})

test('generateCreateTableSql - all 17 field types produce output', () => {
  const allFields = [
    { name: 'f_text',        type: 'text' },
    { name: 'f_textarea',    type: 'textarea' },
    { name: 'f_number',      type: 'number' },
    { name: 'f_decimal',     type: 'decimal' },
    { name: 'f_boolean',     type: 'boolean' },
    { name: 'f_select',      type: 'select' },
    { name: 'f_multiselect', type: 'multiselect' },
    { name: 'f_date',        type: 'date' },
    { name: 'f_datetime',    type: 'datetime' },
    { name: 'f_email',       type: 'email' },
    { name: 'f_phone',       type: 'phone' },
    { name: 'f_relation',    type: 'relation' },
    { name: 'f_file',        type: 'file' },
    { name: 'f_json',        type: 'json' },
    { name: 'f_markdown',    type: 'markdown' },
    { name: 'f_color',       type: 'color' },
    { name: 'f_richtext',    type: 'richtext' },
  ]
  const sql = generateCreateTableSql({ tableName: 'all_types', fields: allFields })
  for (const f of allFields) {
    assert.ok(sql.includes(`"${f.name}"`), `SQL must include column "${f.name}"`)
  }
})

test('assertSafeMigrationSql - passes for CREATE TABLE', () => {
  assert.doesNotThrow(() =>
    assertSafeMigrationSql('CREATE TABLE IF NOT EXISTS "x" ("id" UUID PRIMARY KEY DEFAULT uuidv7());')
  )
})

test('assertSafeMigrationSql - passes for CREATE INDEX', () => {
  assert.doesNotThrow(() =>
    assertSafeMigrationSql('CREATE INDEX IF NOT EXISTS "x_idx" ON "x" ("company_id");')
  )
})

test('assertSafeMigrationSql - throws ModuleEngineError for DROP TABLE', () => {
  assert.throws(
    () => assertSafeMigrationSql('DROP TABLE "x";'),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - allows additive ALTER TABLE ADD COLUMN IF NOT EXISTS', () => {
  assert.doesNotThrow(() =>
    assertSafeMigrationSql('ALTER TABLE "x" ADD COLUMN IF NOT EXISTS "y" TEXT;')
  )
})

test('assertSafeMigrationSql - throws for non-additive ALTER TABLE', () => {
  assert.throws(
    () => assertSafeMigrationSql('ALTER TABLE "x" ADD COLUMN "y" INT;'),
    (err) => err instanceof ModuleEngineError
  )
})

test('assertSafeMigrationSql - throws for DELETE FROM', () => {
  assert.throws(
    () => assertSafeMigrationSql('DELETE FROM "x" WHERE id = 1;'),
    (err) => err instanceof ModuleEngineError
  )
})

test('assertSafeMigrationSql - throws for TRUNCATE', () => {
  assert.throws(
    () => assertSafeMigrationSql('TRUNCATE TABLE "x";'),
    (err) => err instanceof ModuleEngineError
  )
})

test('assertSafeMigrationSql - throws for UPDATE on unquoted table', () => {
  assert.throws(
    () => assertSafeMigrationSql(`UPDATE fleet_vehicle SET name = 'x';`),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - throws for UPDATE on quoted table', () => {
  assert.throws(
    () => assertSafeMigrationSql(`UPDATE "fleet_vehicle" SET name = 'x';`),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - throws for DROP DATABASE', () => {
  assert.throws(
    () => assertSafeMigrationSql('DROP DATABASE atlas;'),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - throws for DROP SCHEMA', () => {
  assert.throws(
    () => assertSafeMigrationSql('DROP SCHEMA public CASCADE;'),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - throws for ALTER SYSTEM', () => {
  assert.throws(
    () => assertSafeMigrationSql("ALTER SYSTEM SET shared_preload_libraries = 'x';"),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - throws for CREATE EXTENSION', () => {
  assert.throws(
    () => assertSafeMigrationSql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - throws for COPY statement', () => {
  assert.throws(
    () => assertSafeMigrationSql('COPY fleet_vehicle FROM STDIN;'),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - throws for psql backslash \\c command', () => {
  assert.throws(
    () => assertSafeMigrationSql('\\c atlas'),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - throws for psql backslash \\i command', () => {
  assert.throws(
    () => assertSafeMigrationSql('\\i ./migration.sql'),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})

test('assertSafeMigrationSql - throws for psql backslash \\! command', () => {
  assert.throws(
    () => assertSafeMigrationSql('\\! dir'),
    (err) => err instanceof ModuleEngineError && err.code === 'AME_UNSAFE_SQL'
  )
})


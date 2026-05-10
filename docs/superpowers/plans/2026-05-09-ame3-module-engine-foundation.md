# @atlas/module-engine Package Foundation — Implementation Plan

**Goal:** Create `packages/module-engine/` and export `ModuleEngineError`, `defineAtlasModule`, `validateManifest`, `defineModel`, `validateModel`, `FIELD_TYPES`, `defineView`, `validateView`, `definePage`, `validatePage`, `ModuleRegistry`, `ModelRegistry`, `ComponentRegistry`, `generateCreateTableSql`, `assertSafeMigrationSql`, `createChecksum`. Zero external dependencies. Zero modifications to any existing file.

**Spec:** `docs/superpowers/specs/2026-05-09-ame3-module-engine-foundation.md`

**Tech stack:** Node.js ESM (`"type": "module"`). `node:crypto` (built-in) for checksums. `node:test` and `node:assert` (both Node 18+ built-ins, no npm install) for tests. No TypeScript. No external npm packages.

**Constraint:** Every file listed below is new. No existing file in the repository may be modified.

---

## File Structure Map

### New files

| File | Responsibility |
|---|---|
| `packages/module-engine/package.json` | Package declaration: `@atlas/module-engine`, ESM, no deps |
| `packages/module-engine/src/index.js` | Entry point — re-exports all 16 public names |
| `packages/module-engine/src/constants.js` | `RESERVED_NAMESPACES`, `MODULE_KINDS`, `BLUEPRINT_KINDS`, `FIELD_TYPES` (object, 17 types) |
| `packages/module-engine/src/field-types.js` | `SQL_TYPE_MAP` — maps each field type to a PostgreSQL column type function |
| `packages/module-engine/src/errors.js` | `ModuleEngineError` — custom error class with `code` property |
| `packages/module-engine/src/define-module.js` | `defineAtlasModule`, `validateManifest` |
| `packages/module-engine/src/define-model.js` | `defineModel`, `validateModel` |
| `packages/module-engine/src/define-view.js` | `defineView`, `validateView` |
| `packages/module-engine/src/define-page.js` | `definePage`, `validatePage` |
| `packages/module-engine/src/sql-generator.js` | `generateCreateTableSql`, `assertSafeMigrationSql` |
| `packages/module-engine/src/checksum.js` | `createChecksum` |
| `packages/module-engine/src/module-registry.js` | `ModuleRegistry` class |
| `packages/module-engine/src/model-registry.js` | `ModelRegistry` class |
| `packages/module-engine/src/component-registry.js` | `ComponentRegistry` class |
| `packages/module-engine/src/__tests__/define-module.test.js` | Tests for `defineAtlasModule` + `validateManifest` |
| `packages/module-engine/src/__tests__/define-model.test.js` | Tests for `defineModel` + `validateModel` |
| `packages/module-engine/src/__tests__/sql-generator.test.js` | Tests for `generateCreateTableSql` + `assertSafeMigrationSql` |
| `packages/module-engine/src/__tests__/checksum.test.js` | Tests for `createChecksum` |

### Modified files

None.

### Files forbidden to modify

Any modification to the following files is a plan violation. Stop and raise a deviation if the implementation requires touching them.

| Forbidden file | Reason |
|---|---|
| `packages/maps/src/**` | Deprecated — no new entries |
| `packages/core/src/**` | `createModuleManifest` stays deprecated but untouched |
| `prisma/schema.prisma` | No Prisma changes in Phase 1 |
| `prisma/migrations/**` | No new migrations |
| `apps/api/src/**` | No API integration in Phase 1 |
| `apps/desktop/src/**` | No frontend changes in Phase 1 |
| `packages/validators/src/**` | Module validators stay inside each module |
| `packages/sdk/src/**` | SDK unchanged in Phase 1 |
| `pnpm-workspace.yaml` | Already includes `packages/*` |
| `package.json` (root) | No new workspace scripts in Phase 1 |
| `modules/` (any path) | This directory does not exist yet — not created in Phase 1 |

---

## Task 1 — Package scaffold

**Files:** `packages/module-engine/package.json`

- [ ] **1.1** Create `packages/module-engine/package.json`:

```json
{
  "name": "@atlas/module-engine",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.js",
  "exports": {
    ".": "./src/index.js"
  },
  "description": "Atlas Module Engine v3 — defineAtlasModule, defineModel, defineView, definePage, SQL generator, checksum",
  "license": "UNLICENSED"
}
```

**Validation:**

```bash
node -e "import { readFileSync } from 'node:fs'; const p = JSON.parse(readFileSync('packages/module-engine/package.json','utf8')); console.log(p.name, p.type)" --input-type=module
# Expected: @atlas/module-engine module
```

**Commit checkpoint:** `feat(module-engine): scaffold @atlas/module-engine package`

---

## Task 2 — Constants and field types

**Files:** `packages/module-engine/src/constants.js`, `packages/module-engine/src/field-types.js`

- [ ] **2.1** Create `packages/module-engine/src/constants.js`:

`FIELD_TYPES` is a frozen object (matching the style of `MODULE_KINDS` and `BLUEPRINT_KINDS`) so callers can write `FIELD_TYPES.TEXT` instead of the bare string `'text'`.

```js
// Reserved namespace prefixes — enforced at discovery time for modules in modules/custom/.
// validateManifest validates key structure only; namespace ownership is enforced by the discovery service (Phase 2).
export const RESERVED_NAMESPACES = ['atlas.', 'core.', 'system.', 'identity.']

// Forbidden SQL table name prefixes (PostgreSQL system namespaces).
export const RESERVED_TABLE_PREFIXES = ['pg_', '_pg_', 'sql_']

export const MODULE_KINDS = Object.freeze({
  CORE:        'CORE',
  FEATURE:     'FEATURE',
  INTEGRATION: 'INTEGRATION',
  WEBSITE:     'WEBSITE',
})

export const BLUEPRINT_KINDS = Object.freeze({
  ENTITY:    'ENTITY',
  FORM:      'FORM',
  TABLE:     'TABLE',
  DETAIL:    'DETAIL',
  PAGE:      'PAGE',
  DASHBOARD: 'DASHBOARD',
  ACTION:    'ACTION',
  RELATION:  'RELATION',
  CUSTOM:    'CUSTOM',
})

// 17 supported field types. Use FIELD_TYPES.TEXT etc. in module code for IDE-friendliness.
export const FIELD_TYPES = Object.freeze({
  TEXT:        'text',
  TEXTAREA:    'textarea',
  NUMBER:      'number',
  DECIMAL:     'decimal',
  BOOLEAN:     'boolean',
  SELECT:      'select',
  MULTISELECT: 'multiselect',
  DATE:        'date',
  DATETIME:    'datetime',
  EMAIL:       'email',
  PHONE:       'phone',
  RELATION:    'relation',
  FILE:        'file',
  JSON:        'json',
  MARKDOWN:    'markdown',
  COLOR:       'color',
  RICHTEXT:    'richtext',
})
```

- [ ] **2.2** Create `packages/module-engine/src/field-types.js`:

```js
// Maps each FIELD_TYPES value to a function (field) => SQL column type string.
// Used by generateCreateTableSql.

export const SQL_TYPE_MAP = Object.freeze({
  text:        (f) => `VARCHAR(${f.maxLength ?? 255})`,
  textarea:    ()  => 'TEXT',
  number:      ()  => 'INTEGER',
  decimal:     ()  => 'NUMERIC(18,4)',
  boolean:     ()  => 'BOOLEAN',
  select:      ()  => 'VARCHAR(64)',
  multiselect: ()  => 'TEXT[]',
  date:        ()  => 'DATE',
  datetime:    ()  => 'TIMESTAMPTZ',
  email:       ()  => 'VARCHAR(255)',
  phone:       ()  => 'VARCHAR(64)',
  relation:    ()  => 'UUID',       // FK resolution is Atlas ORM Phase 3
  file:        ()  => 'UUID',       // FK → FileAsset is Atlas ORM Phase 3
  json:        ()  => 'JSONB',
  markdown:    ()  => 'TEXT',
  color:       ()  => 'VARCHAR(32)',
  richtext:    ()  => 'TEXT',
})
```

**Validation:**

```bash
node --check packages/module-engine/src/constants.js
node --check packages/module-engine/src/field-types.js
node -e "
import { FIELD_TYPES } from './packages/module-engine/src/constants.js'
import { SQL_TYPE_MAP } from './packages/module-engine/src/field-types.js'
const ftCount = Object.keys(FIELD_TYPES).length
const smCount = Object.keys(SQL_TYPE_MAP).length
console.log('FIELD_TYPES count:', ftCount)
console.log('SQL_TYPE_MAP count:', smCount)
console.log('counts match:', ftCount === smCount)
" --input-type=module
# Expected:
# FIELD_TYPES count: 17
# SQL_TYPE_MAP count: 17
# counts match: true
```

---

## Task 3 — `ModuleEngineError`

**Files:** `packages/module-engine/src/errors.js`

- [ ] **3.1** Create `packages/module-engine/src/errors.js`:

All validation failures in this package throw `ModuleEngineError` rather than a plain `Error`. This lets callers distinguish AME3 validation errors from unexpected runtime errors.

```js
export class ModuleEngineError extends Error {
  constructor(message, code = 'AME_VALIDATION_ERROR') {
    super(message)
    this.name = 'ModuleEngineError'
    this.code = code
  }
}
```

**Validation:**

```bash
node --check packages/module-engine/src/errors.js
node -e "
import { ModuleEngineError } from './packages/module-engine/src/errors.js'
const e = new ModuleEngineError('test', 'AME_TEST')
console.log(e instanceof Error, e instanceof ModuleEngineError, e.name, e.code)
" --input-type=module
# Expected: true true ModuleEngineError AME_TEST
```

---

## Task 4 — `defineAtlasModule` and `validateManifest`

**Files:** `packages/module-engine/src/define-module.js`, `packages/module-engine/src/__tests__/define-module.test.js`

- [ ] **4.1** Create `packages/module-engine/src/define-module.js`:

```js
import { MODULE_KINDS } from './constants.js'
import { ModuleEngineError } from './errors.js'

const VALID_KINDS = new Set(Object.values(MODULE_KINDS))

const MANIFEST_DEFAULTS = {
  kind:        'FEATURE',
  description: '',
  icon:        'Box',
  color:       null,
  category:    'general',
  dependencies: [],
  permissions:  [],
  navigation:   [],
  acl: {
    module:  null,
    actions: {},
    models:  {},
  },
  lifecycle: {
    installable:            true,
    uninstallable:          true,
    resettable:             false,
    supportsDataPurge:      false,
    defaultUninstallPolicy: 'preserve-data',
    ownedEntities:          [],
    sharedEntities:         [],
  },
}

// Returns { valid: boolean, errors: string[] }. Never throws.
export function validateManifest(manifest) {
  const errors = []

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['manifest must be a plain object'] }
  }

  if (!manifest.key || typeof manifest.key !== 'string' || !manifest.key.trim()) {
    errors.push('key is required and must be a non-empty string')
  } else {
    const key = manifest.key.trim()
    if (key.includes('/') || key.includes('\\') || key.includes('..')) {
      errors.push('key must not contain path traversal characters (/, \\\\, ..)')
    }
    if (!key.includes('.')) {
      errors.push('key must contain at least one dot separator (e.g. custom.fleet)')
    }
    if (key.split('.').some((s) => s === '')) {
      errors.push('key must not have empty dot-separated segments (no leading/trailing dots)')
    }
  }

  if (!manifest.name || typeof manifest.name !== 'string' || !manifest.name.trim()) {
    errors.push('name is required and must be a non-empty string')
  }

  if (!manifest.version || typeof manifest.version !== 'string' || !manifest.version.trim()) {
    errors.push('version is required and must be a non-empty string')
  } else if (!/^\d+\.\d+\.\d+/.test(manifest.version.trim())) {
    errors.push('version must follow semver format (e.g. 0.1.0)')
  }

  if (manifest.kind !== undefined && !VALID_KINDS.has(manifest.kind)) {
    errors.push(`kind must be one of: ${[...VALID_KINDS].join(', ')}`)
  }

  if (manifest.permissions !== undefined) {
    if (!Array.isArray(manifest.permissions)) {
      errors.push('permissions must be an array')
    } else {
      manifest.permissions.forEach((p, i) => {
        if (!p.key || typeof p.key !== 'string') {
          errors.push(`permissions[${i}].key is required`)
        }
        if (!p.name || typeof p.name !== 'string') {
          errors.push(`permissions[${i}].name is required`)
        }
      })
    }
  }

  if (manifest.navigation !== undefined) {
    if (!Array.isArray(manifest.navigation)) {
      errors.push('navigation must be an array')
    } else {
      manifest.navigation.forEach((n, i) => {
        if (!n.label || typeof n.label !== 'string') {
          errors.push(`navigation[${i}].label is required`)
        }
        if (!n.path || typeof n.path !== 'string' || !n.path.startsWith('/')) {
          errors.push(`navigation[${i}].path must be a string starting with /`)
        }
        if (!n.permissionKey || typeof n.permissionKey !== 'string') {
          errors.push(`navigation[${i}].permissionKey is required`)
        }
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

// Validates and returns the manifest with defaults applied. Throws ModuleEngineError on invalid input.
export function defineAtlasModule(manifest) {
  const { valid, errors } = validateManifest(manifest)
  if (!valid) {
    throw new ModuleEngineError(`Invalid module manifest: ${errors.join('; ')}`, 'AME_INVALID_MANIFEST')
  }
  return {
    ...MANIFEST_DEFAULTS,
    ...manifest,
    acl: { ...MANIFEST_DEFAULTS.acl, ...(manifest.acl ?? {}) },
    lifecycle: { ...MANIFEST_DEFAULTS.lifecycle, ...(manifest.lifecycle ?? {}) },
  }
}
```

- [ ] **4.2** Create `packages/module-engine/src/__tests__/define-module.test.js`:

Uses `node:test` and `node:assert/strict` — both are Node 18+ built-ins. No npm install required.

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineAtlasModule, validateManifest } from '../define-module.js'
import { ModuleEngineError } from '../errors.js'

const VALID = { key: 'custom.fleet', name: 'Flota', version: '0.1.0', kind: 'FEATURE' }

test('defineAtlasModule - returns manifest with key preserved', () => {
  const r = defineAtlasModule(VALID)
  assert.equal(r.key, 'custom.fleet')
  assert.equal(r.name, 'Flota')
  assert.equal(r.version, '0.1.0')
})

test('defineAtlasModule - applies default kind when omitted', () => {
  const r = defineAtlasModule({ key: 'custom.demo', name: 'Demo', version: '0.1.0' })
  assert.equal(r.kind, 'FEATURE')
})

test('defineAtlasModule - applies empty permissions and navigation by default', () => {
  const r = defineAtlasModule(VALID)
  assert.deepEqual(r.permissions, [])
  assert.deepEqual(r.navigation, [])
})

test('defineAtlasModule - throws ModuleEngineError (not plain Error) when key is missing', () => {
  assert.throws(
    () => defineAtlasModule({ name: 'Flota', version: '0.1.0' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('key')
  )
})

test('defineAtlasModule - throws when name is missing', () => {
  assert.throws(
    () => defineAtlasModule({ key: 'custom.fleet', version: '0.1.0' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('name')
  )
})

test('defineAtlasModule - throws when version is missing', () => {
  assert.throws(
    () => defineAtlasModule({ key: 'custom.fleet', name: 'Flota' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('version')
  )
})

test('defineAtlasModule - throws when version is not semver', () => {
  assert.throws(
    () => defineAtlasModule({ key: 'custom.fleet', name: 'Flota', version: 'latest' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('version')
  )
})

test('defineAtlasModule - throws when kind is invalid', () => {
  assert.throws(
    () => defineAtlasModule({ ...VALID, kind: 'UNKNOWN' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('kind')
  )
})

test('defineAtlasModule - throws when key has path traversal', () => {
  assert.throws(
    () => defineAtlasModule({ ...VALID, key: '../evil' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('key')
  )
})

test('defineAtlasModule - throws when key has no dot separator', () => {
  assert.throws(
    () => defineAtlasModule({ ...VALID, key: 'fleet' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('key')
  )
})

test('defineAtlasModule - throws when navigation item lacks permissionKey', () => {
  assert.throws(
    () => defineAtlasModule({ ...VALID, navigation: [{ label: 'X', path: '/x' }] }),
    (err) => err instanceof ModuleEngineError && err.message.includes('permissionKey')
  )
})

test('validateManifest - returns valid:true for correct manifest', () => {
  const r = validateManifest(VALID)
  assert.equal(r.valid, true)
  assert.deepEqual(r.errors, [])
})

test('validateManifest - returns valid:false without throwing for empty object', () => {
  const r = validateManifest({})
  assert.equal(r.valid, false)
  assert.ok(r.errors.some((e) => e.includes('key')))
  assert.ok(r.errors.some((e) => e.includes('name')))
  assert.ok(r.errors.some((e) => e.includes('version')))
})

test('validateManifest - handles null without throwing', () => {
  assert.equal(validateManifest(null).valid, false)
})

test('validateManifest - handles non-object without throwing', () => {
  assert.equal(validateManifest('bad').valid, false)
})
```

**Validation:**

```bash
node --check packages/module-engine/src/define-module.js
node --test packages/module-engine/src/__tests__/define-module.test.js
# Expected: 15 tests pass, 0 fail
```

**Commit checkpoint:** `feat(module-engine): add defineAtlasModule and validateManifest`

---

## Task 5 — `defineModel` and `validateModel`

**Files:** `packages/module-engine/src/define-model.js`, `packages/module-engine/src/__tests__/define-model.test.js`

- [ ] **5.1** Create `packages/module-engine/src/define-model.js`:

Table naming rules:
- Must be a valid SQL identifier: `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- Must not start with a reserved PostgreSQL prefix: `pg_`, `_pg_`, `sql_`
- Convention: official modules use `atlas_<module>_<entity>`; custom modules use `custom_<module>_<entity>` or `<module>_<entity>`. Convention is documented, not enforced by the validator.

```js
import { FIELD_TYPES, RESERVED_TABLE_PREFIXES } from './constants.js'
import { ModuleEngineError } from './errors.js'

const FIELD_TYPE_SET = new Set(Object.values(FIELD_TYPES))
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

const MODEL_DEFAULTS = {
  companyScoped: true,
  softDelete:    false,
  indexes:       [],
}

// Returns { valid: boolean, errors: string[] }. Never throws.
export function validateModel(model) {
  const errors = []

  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return { valid: false, errors: ['model must be a plain object'] }
  }

  if (!model.key || typeof model.key !== 'string' || !model.key.trim()) {
    errors.push('key is required and must be a non-empty string')
  } else if (!IDENTIFIER_RE.test(model.key)) {
    errors.push('key must be a valid identifier: letters, digits, underscores; must start with letter or underscore')
  }

  if (!model.tableName || typeof model.tableName !== 'string') {
    errors.push('tableName is required and must be a string')
  } else if (!IDENTIFIER_RE.test(model.tableName)) {
    errors.push('tableName must be a valid SQL identifier: letters, digits, underscores; must start with letter or underscore; no spaces or special characters')
  } else {
    const lower = model.tableName.toLowerCase()
    const reserved = RESERVED_TABLE_PREFIXES.find((p) => lower.startsWith(p))
    if (reserved) {
      errors.push(`tableName must not start with reserved prefix "${reserved}" (PostgreSQL system namespace)`)
    }
  }

  if (!Array.isArray(model.fields)) {
    errors.push('fields must be an array')
  } else {
    model.fields.forEach((field, i) => {
      if (!field.name || typeof field.name !== 'string' || !IDENTIFIER_RE.test(field.name)) {
        errors.push(`fields[${i}].name must be a valid identifier`)
      }
      if (!field.type || !FIELD_TYPE_SET.has(field.type)) {
        errors.push(`fields[${i}].type "${field.type}" is not a supported type. Use FIELD_TYPES constants. Supported: ${[...FIELD_TYPE_SET].join(', ')}`)
      }
    })
  }

  if (model.indexes !== undefined && !Array.isArray(model.indexes)) {
    errors.push('indexes must be an array')
  }

  return { valid: errors.length === 0, errors }
}

// Validates and returns the model with defaults applied. Throws ModuleEngineError on invalid input.
export function defineModel(model) {
  const { valid, errors } = validateModel(model)
  if (!valid) {
    throw new ModuleEngineError(`Invalid model definition: ${errors.join('; ')}`, 'AME_INVALID_MODEL')
  }
  return {
    ...MODEL_DEFAULTS,
    ...model,
    fields:  model.fields ?? [],
    indexes: model.indexes ?? [],
  }
}
```

- [ ] **5.2** Create `packages/module-engine/src/__tests__/define-model.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineModel, validateModel } from '../define-model.js'
import { ModuleEngineError } from '../errors.js'

const VALID_MODEL = {
  key:       'vehicle',
  tableName: 'fleet_vehicle',
  fields: [
    { name: 'plate',  type: 'text',   required: true, maxLength: 20 },
    { name: 'status', type: 'select', required: true },
  ],
}

test('defineModel - returns model with tableName preserved', () => {
  const r = defineModel(VALID_MODEL)
  assert.equal(r.tableName, 'fleet_vehicle')
})

test('defineModel - atlas_ prefix is accepted', () => {
  const r = defineModel({ ...VALID_MODEL, tableName: 'atlas_fleet_vehicle' })
  assert.equal(r.tableName, 'atlas_fleet_vehicle')
})

test('defineModel - custom_ prefix is accepted', () => {
  const r = defineModel({ ...VALID_MODEL, tableName: 'custom_fleet_vehicle' })
  assert.equal(r.tableName, 'custom_fleet_vehicle')
})

test('defineModel - applies companyScoped:true by default', () => {
  assert.equal(defineModel(VALID_MODEL).companyScoped, true)
})

test('defineModel - applies softDelete:false by default', () => {
  assert.equal(defineModel(VALID_MODEL).softDelete, false)
})

test('defineModel - accepts empty fields array', () => {
  const r = defineModel({ key: 'tag', tableName: 'tag', fields: [] })
  assert.deepEqual(r.fields, [])
})

test('defineModel - throws ModuleEngineError when tableName starts with pg_', () => {
  assert.throws(
    () => defineModel({ ...VALID_MODEL, tableName: 'pg_vehicle' }),
    (err) => err instanceof ModuleEngineError && err.message.includes('pg_')
  )
})

test('defineModel - throws when tableName contains a space', () => {
  assert.throws(
    () => defineModel({ ...VALID_MODEL, tableName: 'fleet vehicle' }),
    (err) => err instanceof ModuleEngineError
  )
})

test('defineModel - throws when tableName is missing', () => {
  assert.throws(
    () => defineModel({ key: 'vehicle', fields: [] }),
    (err) => err instanceof ModuleEngineError && err.message.includes('tableName')
  )
})

test('defineModel - throws when key is missing', () => {
  assert.throws(
    () => defineModel({ tableName: 'fleet_vehicle', fields: [] }),
    (err) => err instanceof ModuleEngineError && err.message.includes('key')
  )
})

test('defineModel - throws when field type is unsupported', () => {
  assert.throws(
    () => defineModel({ ...VALID_MODEL, fields: [{ name: 'x', type: 'unknown_type' }] }),
    (err) => err instanceof ModuleEngineError && err.message.includes('unknown_type')
  )
})

test('validateModel - returns valid:true for correct model', () => {
  const r = validateModel(VALID_MODEL)
  assert.equal(r.valid, true)
  assert.deepEqual(r.errors, [])
})

test('validateModel - returns valid:false without throwing for pg_ prefix', () => {
  const r = validateModel({ ...VALID_MODEL, tableName: 'pg_vehicle' })
  assert.equal(r.valid, false)
  assert.ok(r.errors.some((e) => e.includes('pg_')))
})

test('validateModel - handles null without throwing', () => {
  assert.equal(validateModel(null).valid, false)
})
```

**Validation:**

```bash
node --check packages/module-engine/src/define-model.js
node --test packages/module-engine/src/__tests__/define-model.test.js
# Expected: 14 tests pass, 0 fail
```

**Commit checkpoint:** `feat(module-engine): add defineModel and validateModel`

---

## Task 6 — `defineView`, `validateView`, `definePage`, `validatePage`

**Files:** `packages/module-engine/src/define-view.js`, `packages/module-engine/src/define-page.js`

- [ ] **6.1** Create `packages/module-engine/src/define-view.js`:

```js
import { BLUEPRINT_KINDS } from './constants.js'
import { ModuleEngineError } from './errors.js'

const VALID_KINDS = new Set(Object.values(BLUEPRINT_KINDS))
const VIEW_DEFAULTS = { version: '0.1.0' }

// Returns { valid: boolean, errors: string[] }. Never throws.
export function validateView(view) {
  const errors = []
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    return { valid: false, errors: ['view must be a plain object'] }
  }
  if (!view.key || typeof view.key !== 'string' || !view.key.trim()) {
    errors.push('key is required and must be a non-empty string')
  }
  if (!view.kind || !VALID_KINDS.has(view.kind)) {
    errors.push(`kind must be one of: ${[...VALID_KINDS].join(', ')}`)
  }
  if (!view.schema || typeof view.schema !== 'object' || Array.isArray(view.schema)) {
    errors.push('schema is required and must be a plain object')
  }
  return { valid: errors.length === 0, errors }
}

// Validates and returns the view with defaults applied. Throws ModuleEngineError on invalid input.
export function defineView(view) {
  const { valid, errors } = validateView(view)
  if (!valid) {
    throw new ModuleEngineError(`Invalid view definition: ${errors.join('; ')}`, 'AME_INVALID_VIEW')
  }
  return { ...VIEW_DEFAULTS, ...view }
}
```

- [ ] **6.2** Create `packages/module-engine/src/define-page.js`:

```js
import { ModuleEngineError } from './errors.js'

// Returns { valid: boolean, errors: string[] }. Never throws.
export function validatePage(page) {
  const errors = []
  if (!page || typeof page !== 'object' || Array.isArray(page)) {
    return { valid: false, errors: ['page must be a plain object'] }
  }
  if (!page.key || typeof page.key !== 'string' || !page.key.trim()) {
    errors.push('key is required and must be a non-empty string')
  }
  if (!page.path || typeof page.path !== 'string' || !page.path.startsWith('/')) {
    errors.push('path is required and must start with /')
  }
  if (!page.title || typeof page.title !== 'string' || !page.title.trim()) {
    errors.push('title is required and must be a non-empty string')
  }
  return { valid: errors.length === 0, errors }
}

// Validates and returns the page. Throws ModuleEngineError on invalid input.
export function definePage(page) {
  const { valid, errors } = validatePage(page)
  if (!valid) {
    throw new ModuleEngineError(`Invalid page definition: ${errors.join('; ')}`, 'AME_INVALID_PAGE')
  }
  return { ...page }
}
```

**Validation:**

```bash
node --check packages/module-engine/src/define-view.js
node --check packages/module-engine/src/define-page.js
node -e "
import { defineView, validateView } from './packages/module-engine/src/define-view.js'
import { definePage, validatePage } from './packages/module-engine/src/define-page.js'
const v = defineView({ key: 'fleet.vehicle.list', kind: 'TABLE', schema: { entity: 'vehicle' } })
const p = definePage({ key: 'fleet.vehicles', path: '/fleet/vehicles', title: 'Vehiculos' })
const vv = validateView({})
const vp = validatePage({})
console.log('defineView key:', v.key)
console.log('definePage path:', p.path)
console.log('validateView empty:', vv.valid, vv.errors.length, 'errors')
console.log('validatePage empty:', vp.valid, vp.errors.length, 'errors')
" --input-type=module
# Expected:
# defineView key: fleet.vehicle.list
# definePage path: /fleet/vehicles
# validateView empty: false 3 errors
# validatePage empty: false 3 errors
```

---

## Task 7 — `generateCreateTableSql` and `assertSafeMigrationSql`

**Files:** `packages/module-engine/src/sql-generator.js`, `packages/module-engine/src/__tests__/sql-generator.test.js`

- [ ] **7.1** Create `packages/module-engine/src/sql-generator.js`:

Table naming: `generateCreateTableSql` validates `tableName` is a safe SQL identifier and does not start with a reserved prefix. It does NOT require an `atlas_` prefix — that convention is documentation-only.

```js
import { SQL_TYPE_MAP } from './field-types.js'
import { RESERVED_TABLE_PREFIXES } from './constants.js'
import { ModuleEngineError } from './errors.js'

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

// Patterns that indicate destructive or unsafe SQL. assertSafeMigrationSql rejects these.
const FORBIDDEN_SQL_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+INDEX\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+\w/i,
]

function requireSafeIdentifier(name, context) {
  if (!IDENTIFIER_RE.test(name)) {
    throw new ModuleEngineError(
      `${context}: "${name}" is not a safe SQL identifier (letters, digits, underscores only; must start with letter or underscore)`,
      'AME_UNSAFE_IDENTIFIER'
    )
  }
  return `"${name}"`
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
    ? ` DEFAULT ${typeof field.default === 'string' ? `'${field.default}'` : field.default}`
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
  columns.push(`  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()`)
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
  for (const pattern of FORBIDDEN_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      throw new ModuleEngineError(
        `assertSafeMigrationSql: SQL contains a forbidden destructive pattern matching ${pattern}. Only additive DDL is allowed (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).`,
        'AME_UNSAFE_SQL'
      )
    }
  }
}
```

- [ ] **7.2** Create `packages/module-engine/src/__tests__/sql-generator.test.js`:

```js
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
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()'))
})

test('generateCreateTableSql - includes company_id when companyScoped', () => {
  assert.ok(generateCreateTableSql(VEHICLE_MODEL).includes('"company_id" UUID NOT NULL'))
})

test('generateCreateTableSql - omits company_id when companyScoped:false', () => {
  assert.ok(!generateCreateTableSql({ ...VEHICLE_MODEL, companyScoped: false }).includes('company_id'))
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
    assertSafeMigrationSql('CREATE TABLE IF NOT EXISTS "x" ("id" UUID PRIMARY KEY DEFAULT gen_random_uuid());')
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

test('assertSafeMigrationSql - throws for ALTER TABLE', () => {
  assert.throws(
    () => assertSafeMigrationSql('ALTER TABLE "x" ADD COLUMN y INT;'),
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
```

**Validation:**

```bash
node --check packages/module-engine/src/sql-generator.js
node --test packages/module-engine/src/__tests__/sql-generator.test.js
# Expected: 22 tests pass, 0 fail
```

**Commit checkpoint:** `feat(module-engine): add generateCreateTableSql and assertSafeMigrationSql`

---

## Task 8 — `createChecksum`

**Files:** `packages/module-engine/src/checksum.js`, `packages/module-engine/src/__tests__/checksum.test.js`

- [ ] **8.1** Create `packages/module-engine/src/checksum.js`:

```js
import { createHash } from 'node:crypto'
import { ModuleEngineError } from './errors.js'

function normalizeField(field) {
  return {
    name:         field.name,
    type:         field.type,
    required:     field.required ?? false,
    maxLength:    field.maxLength ?? null,
    relatedModel: field.relatedModel ?? null,
  }
}

function normalizeModel(modelDef) {
  const fields  = (modelDef.fields ?? [])
    .map(normalizeField)
    .sort((a, b) => a.name.localeCompare(b.name))
  const indexes = (modelDef.indexes ?? [])
    .map((idx) => ({ fields: [...idx.fields].sort(), unique: idx.unique ?? false }))
    .sort((a, b) => a.fields.join(',').localeCompare(b.fields.join(',')))
  return {
    tableName:     modelDef.tableName,
    companyScoped: modelDef.companyScoped ?? true,
    softDelete:    modelDef.softDelete ?? false,
    fields,
    indexes,
  }
}

// Returns a deterministic SHA-256 hex string (64 characters).
// Schema-relevant changes (tableName, companyScoped, softDelete, field name/type/required/maxLength) change the checksum.
// UI-only changes (label, description) do not change the checksum.
// Field order does not affect the checksum (fields are sorted by name before hashing).
export function createChecksum(modelDef) {
  if (!modelDef || typeof modelDef !== 'object') {
    throw new ModuleEngineError('createChecksum: modelDef must be a plain object', 'AME_INVALID_MODEL')
  }
  const normalized = normalizeModel(modelDef)
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
```

- [ ] **8.2** Create `packages/module-engine/src/__tests__/checksum.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createChecksum } from '../checksum.js'
import { ModuleEngineError } from '../errors.js'

const BASE = {
  tableName:     'fleet_vehicle',
  companyScoped: true,
  softDelete:    false,
  fields: [
    { name: 'plate',  type: 'text',   required: true, maxLength: 20 },
    { name: 'status', type: 'select', required: true },
  ],
  indexes: [],
}

test('createChecksum - returns a 64-character lowercase hex string', () => {
  const r = createChecksum(BASE)
  assert.equal(typeof r, 'string')
  assert.equal(r.length, 64)
  assert.ok(/^[0-9a-f]+$/.test(r))
})

test('createChecksum - same model returns same checksum', () => {
  assert.equal(createChecksum(BASE), createChecksum(BASE))
})

test('createChecksum - field name change produces different checksum', () => {
  const modified = { ...BASE, fields: [{ name: 'license_plate', type: 'text', required: true, maxLength: 20 }, BASE.fields[1]] }
  assert.notEqual(createChecksum(BASE), createChecksum(modified))
})

test('createChecksum - field type change produces different checksum', () => {
  const modified = { ...BASE, fields: [{ name: 'plate', type: 'textarea', required: true }, BASE.fields[1]] }
  assert.notEqual(createChecksum(BASE), createChecksum(modified))
})

test('createChecksum - tableName change produces different checksum', () => {
  assert.notEqual(createChecksum(BASE), createChecksum({ ...BASE, tableName: 'fleet_truck' }))
})

test('createChecksum - companyScoped change produces different checksum', () => {
  assert.notEqual(createChecksum(BASE), createChecksum({ ...BASE, companyScoped: false }))
})

test('createChecksum - softDelete change produces different checksum', () => {
  assert.notEqual(createChecksum(BASE), createChecksum({ ...BASE, softDelete: true }))
})

test('createChecksum - field order does not affect checksum', () => {
  const reordered = { ...BASE, fields: [BASE.fields[1], BASE.fields[0]] }
  assert.equal(createChecksum(BASE), createChecksum(reordered))
})

test('createChecksum - UI-only label change does not affect checksum', () => {
  const withLabels = {
    ...BASE,
    fields: [
      { name: 'plate',  type: 'text',   required: true, maxLength: 20, label: 'Placa' },
      { name: 'status', type: 'select', required: true, label: 'Estado' },
    ],
  }
  assert.equal(createChecksum(BASE), createChecksum(withLabels))
})

test('createChecksum - throws ModuleEngineError on non-object input', () => {
  assert.throws(() => createChecksum(null),  (err) => err instanceof ModuleEngineError)
  assert.throws(() => createChecksum('bad'), (err) => err instanceof ModuleEngineError)
})
```

**Validation:**

```bash
node --check packages/module-engine/src/checksum.js
node --test packages/module-engine/src/__tests__/checksum.test.js
# Expected: 10 tests pass, 0 fail
```

**Commit checkpoint:** `feat(module-engine): add createChecksum for schema drift detection`

---

## Task 9 — `ModuleRegistry`, `ModelRegistry`, `ComponentRegistry`

**Files:** `packages/module-engine/src/module-registry.js`, `packages/module-engine/src/model-registry.js`, `packages/module-engine/src/component-registry.js`

Three separate files — one class per file. No singletons exported here; consumers create instances.

- [ ] **9.1** Create `packages/module-engine/src/module-registry.js`:

```js
import { ModuleEngineError } from './errors.js'

// In-memory registry of module manifests (results of defineAtlasModule).
// The discovery service (Phase 2) will maintain the singleton instance in apps/api.
export class ModuleRegistry {
  #modules = new Map()

  register(manifest) {
    if (!manifest?.key || typeof manifest.key !== 'string') {
      throw new ModuleEngineError('ModuleRegistry.register: manifest.key is required', 'AME_INVALID_MANIFEST')
    }
    if (this.#modules.has(manifest.key)) {
      throw new ModuleEngineError(`ModuleRegistry.register: module "${manifest.key}" is already registered`, 'AME_DUPLICATE_KEY')
    }
    this.#modules.set(manifest.key, manifest)
  }

  get(key) { return this.#modules.get(key) ?? null }
  has(key) { return this.#modules.has(key) }
  list()   { return [...this.#modules.values()] }

  unregister(key) { this.#modules.delete(key) }
  clear()         { this.#modules.clear() }
}
```

- [ ] **9.2** Create `packages/module-engine/src/model-registry.js`:

```js
import { ModuleEngineError } from './errors.js'

// In-memory registry of model definitions (results of defineModel).
// Keyed by model.key. The Atlas ORM (Phase 3) will query this to know which tables to provision.
export class ModelRegistry {
  #models = new Map()

  register(modelDef) {
    if (!modelDef?.key || typeof modelDef.key !== 'string') {
      throw new ModuleEngineError('ModelRegistry.register: modelDef.key is required', 'AME_INVALID_MODEL')
    }
    if (this.#models.has(modelDef.key)) {
      throw new ModuleEngineError(`ModelRegistry.register: model "${modelDef.key}" is already registered`, 'AME_DUPLICATE_KEY')
    }
    this.#models.set(modelDef.key, modelDef)
  }

  get(key)  { return this.#models.get(key) ?? null }
  has(key)  { return this.#models.has(key) }
  list()    { return [...this.#models.values()] }

  unregister(key) { this.#models.delete(key) }
  clear()         { this.#models.clear() }
}
```

- [ ] **9.3** Create `packages/module-engine/src/component-registry.js`:

```js
import { ModuleEngineError } from './errors.js'

// Component key format: 'moduleKey:ComponentName'
// ComponentName must start with an uppercase letter (React component convention).
const KEY_RE = /^[a-zA-Z0-9._-]+:[A-Z][a-zA-Z0-9]*$/

// In-memory registry mapping component keys to React component implementations.
// The Route Loader (Phase 4) will populate the singleton instance at boot.
export class ComponentRegistry {
  #entries = new Map()

  register(key, component) {
    if (typeof key !== 'string' || !KEY_RE.test(key)) {
      throw new ModuleEngineError(
        `ComponentRegistry.register: key "${key}" must match moduleKey:ComponentName format (e.g. custom.fleet:VehicleStatusBadge)`,
        'AME_INVALID_COMPONENT_KEY'
      )
    }
    if (this.#entries.has(key)) {
      throw new ModuleEngineError(`ComponentRegistry.register: key "${key}" is already registered`, 'AME_DUPLICATE_KEY')
    }
    this.#entries.set(key, component)
  }

  resolve(key)    { return this.#entries.get(key) ?? null }
  has(key)        { return this.#entries.has(key) }
  list()          { return [...this.#entries.keys()] }
  unregister(key) { this.#entries.delete(key) }
  clear()         { this.#entries.clear() }
}
```

**Validation:**

```bash
node --check packages/module-engine/src/module-registry.js
node --check packages/module-engine/src/model-registry.js
node --check packages/module-engine/src/component-registry.js
node -e "
import { ModuleRegistry }    from './packages/module-engine/src/module-registry.js'
import { ModelRegistry }     from './packages/module-engine/src/model-registry.js'
import { ComponentRegistry } from './packages/module-engine/src/component-registry.js'
const mr  = new ModuleRegistry()
const mdr = new ModelRegistry()
const cr  = new ComponentRegistry()
mr.register({ key: 'custom.fleet', name: 'Flota', version: '0.1.0' })
mdr.register({ key: 'vehicle', tableName: 'fleet_vehicle', fields: [] })
cr.register('custom.fleet:VehicleStatusBadge', () => null)
console.log('module:', mr.get('custom.fleet').key)
console.log('model:', mdr.get('vehicle').tableName)
console.log('component:', cr.resolve('custom.fleet:VehicleStatusBadge') !== null)
" --input-type=module
# Expected:
# module: custom.fleet
# model: fleet_vehicle
# component: true
```

---

## Task 10 — Entry point and full validation

**Files:** `packages/module-engine/src/index.js`

- [ ] **10.1** Create `packages/module-engine/src/index.js`:

Exports exactly the 16 names listed in the spec, in the specified order.

```js
// @atlas/module-engine — Atlas Module Engine v3 public API
// Phase 1: error class, manifest/model/view/page declarations and validators,
//          registries, SQL generator, migration safety guard, model checksum.

export { ModuleEngineError }             from './errors.js'
export { defineAtlasModule,
         validateManifest }              from './define-module.js'
export { defineModel,
         validateModel }                 from './define-model.js'
export { FIELD_TYPES }                   from './constants.js'
export { defineView,
         validateView }                  from './define-view.js'
export { definePage,
         validatePage }                  from './define-page.js'
export { ModuleRegistry }               from './module-registry.js'
export { ModelRegistry }                from './model-registry.js'
export { ComponentRegistry }            from './component-registry.js'
export { generateCreateTableSql,
         assertSafeMigrationSql }        from './sql-generator.js'
export { createChecksum }               from './checksum.js'

// Additional constants re-exported for module authors
export { MODULE_KINDS, BLUEPRINT_KINDS,
         RESERVED_NAMESPACES,
         RESERVED_TABLE_PREFIXES }       from './constants.js'
export { SQL_TYPE_MAP }                  from './field-types.js'
```

- [ ] **10.2** Syntax check all source files:

```bash
node --check packages/module-engine/src/index.js
node --check packages/module-engine/src/constants.js
node --check packages/module-engine/src/field-types.js
node --check packages/module-engine/src/errors.js
node --check packages/module-engine/src/define-module.js
node --check packages/module-engine/src/define-model.js
node --check packages/module-engine/src/define-view.js
node --check packages/module-engine/src/define-page.js
node --check packages/module-engine/src/sql-generator.js
node --check packages/module-engine/src/checksum.js
node --check packages/module-engine/src/module-registry.js
node --check packages/module-engine/src/model-registry.js
node --check packages/module-engine/src/component-registry.js
```

- [ ] **10.3** Run full test suite:

```bash
node --test packages/module-engine/src/__tests__/define-module.test.js
node --test packages/module-engine/src/__tests__/define-model.test.js
node --test packages/module-engine/src/__tests__/sql-generator.test.js
node --test packages/module-engine/src/__tests__/checksum.test.js
```

- [ ] **10.4** Install workspace and verify all 16 exports are importable:

```bash
pnpm install
node -e "
import('@atlas/module-engine').then(m => {
  const expected = [
    'ModuleEngineError','defineAtlasModule','validateManifest',
    'defineModel','validateModel','FIELD_TYPES',
    'defineView','validateView','definePage','validatePage',
    'ModuleRegistry','ModelRegistry','ComponentRegistry',
    'generateCreateTableSql','assertSafeMigrationSql','createChecksum',
  ]
  let ok = true
  for (const name of expected) {
    const t = typeof m[name]
    const missing = t === 'undefined'
    console.log(name + ':', missing ? 'MISSING' : t)
    if (missing) ok = false
  }
  console.log(ok ? 'ALL EXPORTS OK' : 'MISSING EXPORTS DETECTED')
})
"
```

Expected output:
```
ModuleEngineError: function
defineAtlasModule: function
validateManifest: function
defineModel: function
validateModel: function
FIELD_TYPES: object
defineView: function
validateView: function
definePage: function
validatePage: function
ModuleRegistry: function
ModelRegistry: function
ComponentRegistry: function
generateCreateTableSql: function
assertSafeMigrationSql: function
createChecksum: function
ALL EXPORTS OK
```

- [ ] **10.5** Regression guard — verify existing desktop build is not broken:

```bash
pnpm --filter ./apps/desktop build:web
# Expected: exits 0
```

**Commit checkpoint:** `feat(module-engine): complete @atlas/module-engine Phase 1 foundation`

---

## Task 11 — TASKS.md update

- [ ] **11.1** Mark completed items in `docs/TASKS.md` under AME3 Phase 1 with verification evidence:

```
- [x] Create `packages/module-engine/` — exports `defineAtlasModule`, `defineModel`, `defineView`, `definePage`

Verified: YYYY-MM-DD (node --check 13 source files pass; node --test 4 test files pass with N total tests; pnpm install succeeds; 16 exports importable; pnpm --filter ./apps/desktop build:web passes)
```

---

## Implementation order

| Order | File | Depends on |
|---|---|---|
| 1 | `package.json` | nothing |
| 2 | `constants.js` | nothing |
| 3 | `field-types.js` | `constants.js` |
| 4 | `errors.js` | nothing |
| 5 | `define-module.js` | `constants.js`, `errors.js` |
| 6 | `define-module.test.js` | `define-module.js`, `errors.js` |
| 7 | `define-model.js` | `constants.js`, `errors.js` |
| 8 | `define-model.test.js` | `define-model.js`, `errors.js` |
| 9 | `define-view.js` | `constants.js`, `errors.js` |
| 10 | `define-page.js` | `errors.js` |
| 11 | `sql-generator.js` | `field-types.js`, `constants.js`, `errors.js` |
| 12 | `sql-generator.test.js` | `sql-generator.js`, `errors.js` |
| 13 | `checksum.js` | `errors.js`, `node:crypto` |
| 14 | `checksum.test.js` | `checksum.js`, `errors.js` |
| 15 | `module-registry.js` | `errors.js` |
| 16 | `model-registry.js` | `errors.js` |
| 17 | `component-registry.js` | `errors.js` |
| 18 | `index.js` | all above |

---

## Expected outputs

| Command | Expected result |
|---|---|
| `node --check` (13 files) | All exit 0, no output |
| `node --test define-module.test.js` | 15 tests, 0 fail |
| `node --test define-model.test.js` | 14 tests, 0 fail |
| `node --test sql-generator.test.js` | 22 tests, 0 fail |
| `node --test checksum.test.js` | 10 tests, 0 fail |
| importability check | `ALL EXPORTS OK`, 16 function/object lines |
| `pnpm --filter ./apps/desktop build:web` | exits 0 |

---

## Commit checkpoints

| After task | Commit message |
|---|---|
| Task 1 | `feat(module-engine): scaffold @atlas/module-engine package` |
| Task 2 | `feat(module-engine): add FIELD_TYPES constants and SQL_TYPE_MAP` |
| Task 3 | `feat(module-engine): add ModuleEngineError` |
| Task 4 | `feat(module-engine): add defineAtlasModule and validateManifest` |
| Task 5 | `feat(module-engine): add defineModel and validateModel` |
| Task 6 | `feat(module-engine): add defineView, validateView, definePage, validatePage` |
| Task 7 | `feat(module-engine): add generateCreateTableSql and assertSafeMigrationSql` |
| Task 8 | `feat(module-engine): add createChecksum for schema drift detection` |
| Task 9 | `feat(module-engine): add ModuleRegistry, ModelRegistry, ComponentRegistry` |
| Task 10 | `feat(module-engine): complete @atlas/module-engine Phase 1 foundation` |
| Task 11 | `chore(tasks): mark AME3 Phase 1 package implementation complete` |

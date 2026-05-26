# AME3 Module Scaffolder — Design Spec

**Date:** 2026-05-26
**Status:** Implemented

## Context

Building a new AME3 module requires manually writing 7–10+ files following exact patterns from the
`custom.fleet` reference implementation. This is repetitive, error-prone, and slows down module
creation. The scaffolder generates a complete, immediately-runnable AME3 module under
`modules/custom/<moduleKey>/` from a JSON config or interactive prompts. Generated code passes
`POST /modules/sync` on first run with zero manual edits.

---

## Architecture

### Files

```
scripts/
  scaffold-module.js              CLI entry point
  scaffold/
    validate.js                   Input validation (key format, field types, etc.)
    writer.js                     Path resolution + file writes
    prompts.js                    Interactive readline question flow
    templates/
      helpers.js                  Shared utilities (toPascal, zodFieldSchema, etc.)
      manifest.js                 module.manifest.js template fn
      model.js                    models/<entity>.model.js template fn
      views.js                    TABLE, FORM, DETAIL, PAGE template fns
      service-helpers.js          api/service-helpers.js template fn (shared per module)
      service.js                  api/<entity>-service.js template fn
      routes.js                   api/<entity>-routes.js template fn
      validators.js               validators/<entity>.validators.js template fn
      api-index.js                api/index.js router factory template fn
      validators-index.js         validators/index.js re-export template fn
    __tests__/
      validate.test.js            Unit tests: all validation rules (18 tests)
      templates.test.js           Unit tests: template fn output (31 tests)
      e2e.test.js                 Smoke test: generate to tmpdir + node --check (11 tests)
  scaffold-output/
    <moduleKey>.config.json       Saved configs from interactive sessions
```

### Generated output (N entities → 4 + 8N files)

```
module.manifest.js
api/index.js
api/service-helpers.js
validators/index.js
models/<entity>.model.js          ×N
views/<entity>.table.js           ×N
views/<entity>.form.js            ×N
views/<entity>.detail.js          ×N
views/<entity>.page.js            ×N
api/<entity>-routes.js            ×N
api/<entity>-service.js           ×N
validators/<entity>.validators.js ×N
```

---

## Input Schema

### Config file (JSON)

```json
{
  "key": "custom.crm",
  "name": "CRM",
  "version": "0.1.0",
  "description": "Gestión de relaciones con clientes",
  "entities": [
    {
      "name": "contact",
      "label": "Contacto",
      "labelPlural": "Contactos",
      "softDelete": true,
      "companyScoped": true,
      "fields": [
        { "name": "full_name", "type": "text",   "label": "Nombre",  "required": true },
        { "name": "email",     "type": "email",  "label": "Correo" },
        { "name": "status",    "type": "select", "label": "Estado",  "options": ["activo", "inactivo"] }
      ]
    }
  ]
}
```

### Defaults

| Field | Default |
|-------|---------|
| `version` | `"0.1.0"` |
| `entity.softDelete` | `true` |
| `entity.companyScoped` | `true` |
| `entity.labelPlural` | `entity.label + "s"` |

### Auto-derived

| Value | Formula |
|-------|---------|
| `tableName` | `<moduleSlug>_<entityName>` |
| `moduleSlug` | last segment of `key` |
| Permission keys | `<moduleSlug>.<entityName>.read/create/update/delete` |
| Route base | `/<moduleSlug>/<entityName>s` |

---

## Validation Rules

| Rule | Detail |
|------|--------|
| Module key format | `/^[a-z][a-z0-9]*\.[a-z][a-z0-9_-]*$/`; no `atlas.*`, `core.*`, `system.*`, `identity.*` |
| Module dir collision | Prompts overwrite [y/N] if `modules/custom/<key>` exists |
| Entity name | `snake_case`, `/^[a-z_][a-z0-9_]*$/` |
| Field name | Same rule; reserved names `id/company_id/enabled/created_at/updated_at` rejected |
| Field type | Must be one of the 17 AME3 types |
| `select`/`multiselect` | `options[]` required and non-empty |
| `relation` | `relatedModel` required |
| All errors collected | Print all before aborting; never partial writes |

### Supported field types (17)

`text`, `textarea`, `number`, `decimal`, `boolean`, `select`, `multiselect`, `date`, `datetime`,
`email`, `phone`, `relation`, `file`, `json`, `markdown`, `color`, `richtext`

---

## Generated Code Patterns

### Service (per entity)

Mirrors `modules/custom/custom.fleet/api/catalog-service.js`:
- `list<Entity>s({ companyId, page, pageSize, search, ...<selectFilters> })` — paginated, `enabled = true` guard, ILIKE text search, exact match on `select` fields
- `get<Entity>ById({ companyId, id })` — 404 guard via `normalizeRecordId`
- `create<Entity>({ companyId, data, actorId })` — `RETURNING *`, AuditLog write
- `update<Entity>({ companyId, id, data, actorId })` — `CASE WHEN ${has<Field>}` partial update
- `set<Entity>Enabled({ companyId, id, enabled, actorId })` — soft-delete toggle

All queries use `prisma.$queryRaw` tagged template literals. IDs generated by DB (`DEFAULT uuidv7()`).

### Routes (per entity)

Mirrors `modules/custom/custom.fleet/api/catalogs-routes.js`:
- `GET /<slug>/<entity>s` — list, guarded by `<slug>.<entity>.read`
- `GET /<slug>/<entity>s/:id` — get by ID
- `POST /<slug>/<entity>s` — create, Zod-validated
- `PATCH /<slug>/<entity>s/:id` — partial update, Zod-validated
- `PATCH /<slug>/<entity>s/:id/enabled` — soft-delete toggle (requires `.delete` permission)

### Shared service-helpers.js (1 per module)

Contains: `<Module>ServiceError`, `toScopedCompanyUuid`, `normalizeRecordId`, `normalizePagination`,
`normalizeSearch`, `normalizeOptionalString`, `isTableNotFoundError`, `isUniqueViolation`,
`toCount`, `firstRow`, `withDbErrorMapping`.

---

## Invocation

### Config file mode

```bash
node scripts/scaffold-module.js path/to/my-module.config.json
```

### Interactive mode

```bash
node scripts/scaffold-module.js
```

Prompts for: module key, display name, version, description, then loops over entities and fields.
On completion, saves config to `scripts/scaffold-output/<key>.config.json`.

---

## Testing

```bash
node --test scripts/scaffold/__tests__/
```

- `validate.test.js` — 18 tests covering all validation rules
- `templates.test.js` — 31 tests verifying key identifiers in each template's output
- `e2e.test.js` — 11 tests: generate to `os.tmpdir()`, assert all 12 files exist, `node --check` each file

---

## Post-Generation Steps

1. Review generated files in `modules/custom/<key>/`
2. Add any entity-specific business logic to `api/<entity>-service.js`
3. Adjust views and form sections in `views/`
4. Start API: `pnpm dev:api`
5. Call `POST /modules/sync` to register the module
6. Verify with `GET /blueprints`

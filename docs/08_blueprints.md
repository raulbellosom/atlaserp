# Atlas ERP — Blueprint System

## What blueprints are

Blueprints are declarative JSON definitions that describe entities, forms, tables, and other UI structures. They drive `DynamicForm` and `DynamicTable` components (planned for Phase 3).

**Blueprints are not a substitute for:**
- Prisma schema (database structure)
- Zod validators (API validation)
- API routes and services (business logic)
- Custom React components (complex UI)

Source of truth: Prisma → API service → Zod validator → Blueprint (UI hint only).

## Blueprint kinds

| Kind | Purpose |
|---|---|
| ENTITY | Business entity and its field definitions |
| FORM | Form layout with section groupings |
| TABLE | List/grid view with column and filter config |
| DASHBOARD | Dashboard widget layout |
| ACTION | Button/action that triggers a workflow |
| RELATION | Relationship between two entities |
| PERMISSION | Permission-scoped UI element |

## Field types

| Type | Input | Notes |
|---|---|---|
| `text` | Single-line text | Name, reference number |
| `textarea` | Multi-line text | Description, notes |
| `number` | Numeric | Quantity, count |
| `decimal` | Decimal | Price, balance |
| `boolean` | Checkbox / toggle | Active, enabled |
| `select` | Dropdown (single) | Type, status |
| `multiselect` | Dropdown (multiple) | Tags, categories |
| `date` | Date picker | Birth date, due date |
| `datetime` | Date + time picker | Scheduled, created at |
| `email` | Email input | Contact email |
| `phone` | Phone input | Contact phone |
| `relation` | Entity link picker | Contact, company |
| `file` | File upload | Powered by atlas.files |
| `color` | Color picker | Brand color |
| `json` | Raw JSON editor | Metadata, settings |

## Blueprint structure example

```js
{
  key: 'contacts.contact.entity',   // module.entity.kind
  kind: 'ENTITY',
  version: '0.1.0',
  schema: {
    entity: 'Contact',              // Prisma model name
    label: 'Contacto',              // Spanish display name
    fields: [
      {
        name: 'type', label: 'Tipo', type: 'select',
        options: ['customer', 'supplier', 'person', 'company'],
        required: true
      },
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Teléfono', type: 'phone' }
    ],
    table: { columns: ['type', 'name', 'email', 'phone'] },
    form: {
      sections: [
        { title: 'Información general', fields: ['type', 'name', 'email', 'phone', 'taxId'] }
      ]
    }
  }
}
```

## Blueprint lifecycle

1. Defined in module manifest under `blueprints` array (`packages/maps/`)
2. Seeded into `Blueprint` table by `prisma/seed.js`
3. Served by `GET /blueprints` with module metadata
4. Consumed by `DynamicForm` / `DynamicTable` (Phase 3)

## Rule

Every blueprint stored in the database must have a corresponding:
- Prisma model
- API routes (minimum: list + create)
- Zod schema in `@atlas/validators`
- UI renderer (DynamicForm/DynamicTable or custom component)

## DynamicForm and DynamicTable (Phase 3)

**DynamicForm** — reads ENTITY or FORM blueprint, renders React Hook Form. Field validation sourced from `@atlas/validators` Zod schemas.

**DynamicTable** — reads TABLE blueprint, renders TanStack Table with configured columns, sortable headers, and pagination.

Both components live in `packages/ui` and are blueprint-consumer only — no module-specific knowledge.

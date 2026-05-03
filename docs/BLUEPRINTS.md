# Blueprints — Quick Reference

For the full blueprint system architecture, see [docs/08_blueprints.md](08_blueprints.md).

## What blueprints are

Blueprints are declarative JSON definitions that describe entities, forms, tables, and other UI structures. They drive `DynamicForm` and `DynamicTable` (Phase 3).

A blueprint does **not** replace Prisma. Prisma defines real persistence. Blueprints help build UI, permissions, and dynamic experiences.

## Types

| Kind | Purpose |
|---|---|
| ENTITY | Business entity and field definitions |
| FORM | Form layout with section groupings |
| TABLE | List/grid view with column config |
| DASHBOARD | Dashboard widget layout |
| ACTION | Button/action triggering a workflow |
| RELATION | Relationship between two entities |
| PERMISSION | Permission-scoped UI element |

## Field types

`text`, `textarea`, `number`, `decimal`, `boolean`, `select`, `multiselect`, `date`, `datetime`, `email`, `phone`, `relation`, `file`, `color`, `json`

## Example

```js
{
  key: 'contacts.contact.entity',
  kind: 'ENTITY',
  version: '0.1.0',
  schema: {
    entity: 'Contact',
    label: 'Contacto',
    fields: [
      { name: 'type', label: 'Tipo', type: 'select', options: ['customer', 'supplier'], required: true },
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' }
    ],
    table: { columns: ['type', 'name', 'email'] }
  }
}
```

## Rule

Every blueprint stored in the database must have a corresponding Prisma model, API routes, Zod validation schema, and UI renderer.

# Blueprints

Los blueprints describen cómo Atlas entiende entidades, formularios, tablas, acciones, relaciones y dashboards.

Un blueprint no reemplaza Prisma. Prisma define la persistencia real. El blueprint ayuda a construir UI, permisos y experiencias dinámicas.

## Tipos

- ENTITY
- FORM
- TABLE
- DASHBOARD
- ACTION
- RELATION
- PERMISSION

## Ejemplo

```js
{
  key: 'contacts.contact.entity',
  kind: 'ENTITY',
  version: '0.1.0',
  schema: {
    entity: 'Contact',
    label: 'Contacto',
    fields: [
      { name: 'type', label: 'Tipo', type: 'select', options: ['customer', 'supplier'] },
      { name: 'name', label: 'Nombre', type: 'text', required: true }
    ],
    table: { columns: ['type', 'name', 'email'] }
  }
}
```

## Regla importante

Todo blueprint persistente debe tener una equivalencia clara con:

- Prisma model
- API routes
- validation schema
- UI renderer

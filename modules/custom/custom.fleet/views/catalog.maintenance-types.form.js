import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.catalog.maintenance_types.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'maintenance_type',
    apiPath: '/fleet/catalogs/maintenance-types',
    submitLabel: 'Guardar tipo de mantenimiento',
    sections: [
      {
        key: 'general',
        label: 'Informacion general',
        fields: [
          { key: 'name', label: 'Nombre', type: 'text', required: true },
          { key: 'description', label: 'Descripcion', type: 'textarea' },
        ],
      },
    ],
  },
})

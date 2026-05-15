import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.catalog.vehicle_types.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'vehicle_type',
    apiPath: '/fleet/catalogs/vehicle-types',
    submitLabel: 'Guardar tipo de vehiculo',
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

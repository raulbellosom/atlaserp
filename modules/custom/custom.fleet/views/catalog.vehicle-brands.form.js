import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.catalog.vehicle_brands.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'vehicle_brand',
    apiPath: '/fleet/catalogs/vehicle-brands',
    submitLabel: 'Guardar marca de vehiculo',
    sections: [
      {
        key: 'general',
        label: 'Informacion general',
        fields: [
          { key: 'name', label: 'Nombre', type: 'text', required: true },
        ],
      },
    ],
  },
})

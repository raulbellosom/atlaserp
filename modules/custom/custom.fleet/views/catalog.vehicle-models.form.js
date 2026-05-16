import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.catalog.vehicle_models.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'vehicle_model',
    apiPath: '/fleet/catalogs/vehicle-models',
    submitLabel: 'Guardar modelo de vehiculo',
    sections: [
      {
        key: 'general',
        label: 'Informacion del modelo',
        fields: [
          {
            key: 'brand_id',
            label: 'Marca',
            type: 'relation',
            required: true,
            relation: {
              apiPath: '/fleet/catalogs/vehicle-brands',
              labelField: 'name',
              valueField: 'id',
            },
          },
          {
            key: 'type_id',
            label: 'Tipo de vehiculo',
            type: 'relation',
            required: true,
            relation: {
              apiPath: '/fleet/catalogs/vehicle-types',
              labelField: 'name',
              valueField: 'id',
            },
          },
          { key: 'name', label: 'Nombre del modelo', type: 'text', required: true },
          { key: 'year', label: 'Año', type: 'number', required: true },
        ],
      },
    ],
  },
})

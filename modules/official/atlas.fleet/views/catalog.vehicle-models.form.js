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
              create: {
                enabled: true,
                label: 'Crear marca de vehículo',
                mode: 'modal',
                title: 'Crear marca de vehículo',
                apiPath: '/fleet/catalogs/vehicle-brands',
                viewKey: 'fleet.catalog.vehicle_brands.form',
                selectCreated: true,
                refreshOptions: true,
                permissionKey: 'fleet.catalogs.create',
                prefillFromSearch: true,
              },
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
              create: {
                enabled: true,
                label: 'Crear tipo de vehículo',
                mode: 'modal',
                title: 'Crear tipo de vehículo',
                apiPath: '/fleet/catalogs/vehicle-types',
                viewKey: 'fleet.catalog.vehicle_types.form',
                selectCreated: true,
                refreshOptions: true,
                permissionKey: 'fleet.catalogs.create',
                prefillFromSearch: true,
              },
            },
          },
          { key: 'name', label: 'Nombre del modelo', type: 'text', required: true },
          { key: 'year', label: 'Año', type: 'number', required: true },
        ],
      },
    ],
  },
})

import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.vehicle.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'vehicle',
    component: 'AtlasForm',
    apiPath: '/fleet/vehicles',
    sections: [
      {
        label: 'Informacion general',
        fields: [
          { field: 'plate', label: 'Matricula', type: 'text', required: true },
          {
            field: 'vehicle_model_id',
            label: 'Modelo de vehículo',
            type: 'relation',
            relation: {
              apiPath: '/fleet/catalogs/vehicle-models',
              labelField: ['brand_name', 'name', 'year'],
              labelSeparator: ' ',
              clearable: true,
              disabledField: 'enabled',
              create: {
                enabled: true,
                label: 'Crear modelo de vehÃ­culo',
                mode: 'modal',
                title: 'Crear modelo de vehÃ­culo',
                apiPath: '/fleet/catalogs/vehicle-models',
                viewKey: 'fleet.catalog.vehicle_models.form',
                selectCreated: true,
                refreshOptions: true,
                permissionKey: 'fleet.catalogs.create',
              },
            },
          },
          { field: 'color', label: 'Color', type: 'color' },
          {
            field: 'status',
            label: 'Estado',
            type: 'select',
            options: ['active', 'maintenance', 'inactive', 'retired'],
          },
          { field: 'economic_individual_number', label: 'No. Economico Individual', type: 'text' },
        ],
      },
      {
        label: 'Asignacion',
        fields: [
          {
            field: 'driver_id',
            label: 'Chofer',
            type: 'relation',
            relation: {
              apiPath: '/fleet/drivers',
              labelField: ['first_name', 'last_name'],
              labelSeparator: ' ',
              clearable: true,
              disabledField: 'enabled',
            },
          },
        ],
      },
      {
        label: 'Notas',
        fields: [{ field: 'notes', label: 'Notas adicionales', type: 'textarea' }],
      },
    ],
    submitLabel: 'Guardar vehiculo',
    cancelLabel: 'Cancelar',
  },
})

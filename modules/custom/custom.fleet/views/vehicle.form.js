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
          { field: 'brand', label: 'Marca', type: 'text', required: true },
          { field: 'model_name', label: 'Modelo', type: 'text', required: true },
          { field: 'year', label: 'Anio', type: 'number', required: true },
          { field: 'color', label: 'Color', type: 'color' },
          {
            field: 'status',
            label: 'Estado',
            type: 'select',
            options: ['active', 'maintenance', 'inactive', 'retired'],
          },
          { field: 'economic_group_number', label: 'No. Economico Grupo', type: 'text' },
          { field: 'economic_individual_number', label: 'No. Economico Individual', type: 'text' },
          {
            field: 'vehicle_type_id',
            label: 'Tipo de vehículo',
            type: 'relation',
            relation: {
              apiPath: '/fleet/catalogs/vehicle-types',
              labelField: 'name',
              clearable: true,
              disabledField: 'enabled',
            },
          },
          {
            field: 'vehicle_brand_id',
            label: 'Marca del vehículo',
            type: 'relation',
            relation: {
              apiPath: '/fleet/catalogs/vehicle-brands',
              labelField: 'name',
              clearable: true,
              disabledField: 'enabled',
            },
          },
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

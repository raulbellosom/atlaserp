import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.maintenance.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'maintenance',
    component: 'AtlasForm',
    apiPath: '/fleet/maintenance',
    formMode: 'page',
    sections: [
      {
        label: 'Informacion general',
        fields: [
          { field: 'title', label: 'Titulo', type: 'text' },
          {
            field: 'maintenance_type_id',
            label: 'Tipo de mantenimiento',
            type: 'relation',
            relation: {
              apiPath: '/fleet/catalogs/maintenance-types',
              labelField: 'name',
              clearable: true,
              disabledField: 'enabled',
              create: {
                enabled: true,
                label: 'Crear tipo de mantenimiento',
                mode: 'modal',
                title: 'Crear tipo de mantenimiento',
                apiPath: '/fleet/catalogs/maintenance-types',
                viewKey: 'fleet.catalog.maintenance_types.form',
                selectCreated: true,
                refreshOptions: true,
                permissionKey: 'fleet.catalogs.create',
              },
            },
          },
          {
            field: 'type',
            label: 'Categoria',
            type: 'select',
            required: true,
            options: [
              { label: 'Preventivo', value: 'preventive' },
              { label: 'Correctivo', value: 'corrective' },
              { label: 'Inspeccion', value: 'inspection' },
            ],
          },
          {
            field: 'status',
            label: 'Estado',
            type: 'select',
            default: 'scheduled',
            options: [
              { label: 'Programado', value: 'scheduled' },
              { label: 'En progreso', value: 'in_progress' },
              { label: 'Completado', value: 'completed' },
              { label: 'Cancelado', value: 'cancelled' },
            ],
          },
        ],
      },
      {
        label: 'Vehiculo y conductor',
        fields: [
          {
            field: 'vehicle_id',
            label: 'Vehículo',
            type: 'relation',
            required: true,
            relation: {
              apiPath: '/fleet/vehicles',
              labelField: ['plate', 'model_name'],
              labelSeparator: ' · ',
              clearable: false,
              disabledField: 'enabled',
            },
          },
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
              create: {
                enabled: true,
                label: 'Crear chofer',
                mode: 'modal',
                title: 'Crear chofer',
                apiPath: '/fleet/drivers',
                viewKey: 'fleet.driver.form',
                selectCreated: true,
                refreshOptions: true,
                permissionKey: 'fleet.drivers.create',
              },
            },
          },
        ],
      },
      {
        label: 'Operacion',
        fields: [
          { field: 'started_at', label: 'Fecha de inicio', type: 'datetime' },
          { field: 'scheduled_date', label: 'Fecha programada', type: 'date', required: true },
          { field: 'odometer_km', label: 'Odometro (km)', type: 'number' },
          { field: 'provider', label: 'Proveedor', type: 'text' },
          { field: 'currency', label: 'Moneda', type: 'text', default: 'MXN' },
        ],
      },
      {
        label: 'Notas y descripcion',
        fields: [
          { field: 'description', label: 'Descripcion', type: 'textarea', required: true },
          { field: 'notes', label: 'Notas adicionales', type: 'textarea' },
          { field: 'cost', label: 'Costo', type: 'number' },
          { field: 'completed_date', label: 'Fecha de completado', type: 'date' },
        ],
      },
    ],
    submitLabel: 'Guardar mantenimiento',
    cancelLabel: 'Cancelar',
  },
})

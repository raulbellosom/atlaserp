import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.maintenance.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'maintenance',
    component: 'AtlasForm',
    apiPath: '/fleet/maintenance',
    sections: [
      {
        label: 'Informacion general',
        fields: [
          { field: 'title', label: 'Titulo', type: 'text' },
          { field: 'maintenance_type_id', label: 'Tipo de mantenimiento', type: 'uuid' },
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
          { field: 'vehicle_id', label: 'Vehiculo', type: 'uuid', required: true },
          { field: 'driver_id', label: 'Chofer', type: 'uuid' },
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

import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'maintenance',
  name: 'fleet.maintenance',
  label: 'Mantenimiento',
  tableName: 'fleet_maintenance',
  companyScoped: true,
  softDelete: true,
  fields: [
    {
      name: 'vehicle_id',
      type: 'relation',
      label: 'Vehiculo',
      required: true,
      relatedModel: 'fleet.vehicle',
    },
    {
      name: 'type',
      type: 'select',
      label: 'Tipo',
      required: true,
      options: ['preventive', 'corrective', 'inspection'],
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descripcion',
      required: true,
    },
    {
      name: 'scheduled_date',
      type: 'date',
      label: 'Fecha programada',
      required: true,
    },
    {
      name: 'completed_date',
      type: 'date',
      label: 'Fecha completada',
    },
    {
      name: 'cost',
      type: 'decimal',
      label: 'Costo',
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notas',
    },
    {
      name: 'maintenance_type_id',
      type: 'relation',
      label: 'Tipo de mantenimiento',
      relatedModel: 'fleet.maintenance_type',
    },
    {
      name: 'title',
      type: 'text',
      label: 'Titulo',
      maxLength: 255,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      required: true,
      options: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    {
      name: 'driver_id',
      type: 'relation',
      label: 'Conductor',
      relatedModel: 'fleet.driver',
    },
    {
      name: 'started_at',
      type: 'datetime',
      label: 'Inicio',
    },
    {
      name: 'odometer_km',
      type: 'number',
      label: 'Kilometraje',
    },
    {
      name: 'provider',
      type: 'text',
      label: 'Proveedor',
      maxLength: 200,
    },
    {
      name: 'currency',
      type: 'text',
      label: 'Moneda',
      maxLength: 10,
      default: 'MXN',
    },
  ],
  indexes: [
    { fields: ['company_id', 'vehicle_id'] },
    { fields: ['company_id', 'scheduled_date'] },
    { fields: ['company_id', 'status'] },
  ],
})

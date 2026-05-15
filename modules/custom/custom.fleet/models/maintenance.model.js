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
  ],
  indexes: [
    { fields: ['company_id', 'vehicle_id'] },
    { fields: ['company_id', 'scheduled_date'] },
  ],
})

import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'vehicle',
  name: 'fleet.vehicle',
  label: 'Vehiculo',
  tableName: 'fleet_vehicle',
  companyScoped: true,
  softDelete: true,
  fields: [
    {
      name: 'plate',
      type: 'text',
      label: 'Matricula',
      required: true,
      maxLength: 20,
    },
    {
      name: 'brand',
      type: 'text',
      label: 'Marca',
      required: true,
      maxLength: 100,
    },
    {
      name: 'model_name',
      type: 'text',
      label: 'Modelo',
      required: true,
      maxLength: 100,
    },
    {
      name: 'year',
      type: 'number',
      label: 'Anio',
      required: true,
    },
    {
      name: 'color',
      type: 'color',
      label: 'Color',
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      required: true,
      options: ['active', 'maintenance', 'inactive', 'retired'],
      default: 'active',
    },
    {
      name: 'driver_id',
      type: 'relation',
      label: 'Conductor',
      relatedModel: 'Employee',
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notas',
    },
  ],
  indexes: [
    { fields: ['company_id', 'plate'], unique: true },
    { fields: ['company_id', 'status'] },
  ],
})

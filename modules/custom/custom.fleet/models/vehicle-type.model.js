import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'vehicle_type',
  name: 'fleet.vehicle_type',
  label: 'Tipo de vehiculo',
  tableName: 'fleet_vehicle_type',
  companyScoped: true,
  softDelete: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nombre',
      required: true,
      maxLength: 100,
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descripcion',
      maxLength: 500,
    },
  ],
  indexes: [
    { fields: ['company_id', 'enabled'] },
  ],
})

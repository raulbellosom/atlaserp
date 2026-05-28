import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'vehicle_brand',
  name: 'fleet.vehicle_brand',
  label: 'Marca de vehiculo',
  tableName: 'fleet_vehicle_brand',
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
  ],
  indexes: [
    { fields: ['company_id', 'enabled'] },
  ],
})

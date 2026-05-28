import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'vehicle_model',
  name: 'fleet.vehicle_model',
  label: 'Modelo de vehículo',
  tableName: 'fleet_vehicle_model',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'brand_id', type: 'relation', label: 'Marca', required: true },
    { name: 'type_id', type: 'relation', label: 'Tipo de vehículo', required: true },
    { name: 'name', type: 'text', label: 'Nombre del modelo', required: true, maxLength: 150 },
    { name: 'year', type: 'number', label: 'Año', required: true },
  ],
  indexes: [
    { fields: ['company_id', 'brand_id'] },
    { fields: ['company_id', 'type_id'] },
    { fields: ['company_id', 'enabled'] },
    { fields: ['company_id', 'brand_id', 'type_id', 'name', 'year'], unique: true },
  ],
})

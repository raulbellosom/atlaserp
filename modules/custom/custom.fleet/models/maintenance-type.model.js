import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'maintenance_type',
  name: 'fleet.maintenance_type',
  label: 'Tipo de mantenimiento',
  tableName: 'fleet_maintenance_type',
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
    {
      name: 'is_system',
      type: 'boolean',
      label: 'Tipo del sistema',
      default: false,
    },
  ],
  indexes: [
    { fields: ['company_id', 'enabled'] },
  ],
})

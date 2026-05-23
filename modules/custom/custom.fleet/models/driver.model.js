import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'driver',
  name: 'fleet.driver',
  label: 'Chofer',
  tableName: 'fleet_driver',
  companyScoped: true,
  softDelete: true,
  fields: [
    {
      name: 'first_name',
      type: 'text',
      label: 'Nombre',
      required: true,
      maxLength: 100,
    },
    {
      name: 'last_name',
      type: 'text',
      label: 'Apellido',
      required: true,
      maxLength: 100,
    },
    {
      name: 'phone',
      type: 'phone',
      label: 'Telefono',
      required: true,
      maxLength: 30,
    },
    {
      name: 'email',
      type: 'email',
      label: 'Correo',
      maxLength: 254,
    },
    {
      name: 'photo_asset_id',
      type: 'text',
      label: 'Foto (ID de archivo)',
    },
    {
      name: 'hr_employee_id',
      type: 'text',
      label: 'Colaborador RH',
    },
    {
      name: 'license_number',
      type: 'text',
      label: 'Numero de licencia',
      required: true,
      maxLength: 50,
    },
    {
      name: 'license_type',
      type: 'text',
      label: 'Tipo de licencia',
      required: true,
      maxLength: 50,
    },
    {
      name: 'license_expiry_date',
      type: 'date',
      label: 'Vencimiento de licencia',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      required: true,
      options: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notas',
      maxLength: 5000,
    },
  ],
  indexes: [
    { fields: ['company_id', 'enabled'] },
    { fields: ['company_id', 'license_number'], unique: true },
  ],
})

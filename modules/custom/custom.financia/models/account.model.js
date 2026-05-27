import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'account',
  name: 'financia.account',
  label: 'Cuenta bancaria',
  tableName: 'financia_account',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'name',            type: 'text',    label: 'Nombre',        required: true,  maxLength: 255 },
    { name: 'bank',            type: 'text',    label: 'Banco',         required: true,  maxLength: 255 },
    { name: 'account_number',  type: 'text',    label: 'No. de cuenta', maxLength: 64 },
    { name: 'currency',        type: 'select',  label: 'Moneda',        required: true,  options: ['MXN', 'USD'], default: 'MXN' },
    { name: 'opening_balance', type: 'decimal', label: 'Saldo inicial', required: true,  default: 0 },
  ],
  indexes: [
    { fields: ['company_id', 'name'], unique: true },
    { fields: ['company_id', 'enabled'] },
  ],
})

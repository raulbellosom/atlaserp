import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'transaction_type',
  name: 'financia.transaction_type',
  label: 'Tipo de movimiento',
  tableName: 'financia_transaction_type',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'code', type: 'text', label: 'Codigo', required: true, maxLength: 32 },
    { name: 'name', type: 'text', label: 'Nombre', required: true, maxLength: 128 },
  ],
  indexes: [
    { fields: ['company_id', 'code'], unique: true },
  ],
})

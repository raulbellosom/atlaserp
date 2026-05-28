import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'category',
  name: 'ledger.category',
  label: 'Categoria',
  tableName: 'ledger_category',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'name',  type: 'text',   label: 'Nombre', required: true, maxLength: 128 },
    { name: 'color', type: 'color',  label: 'Color',  maxLength: 32 },
    { name: 'kind',  type: 'select', label: 'Tipo',   required: true, options: ['income', 'expense', 'both'], default: 'both' },
  ],
  indexes: [
    { fields: ['company_id', 'name'], unique: true },
  ],
})

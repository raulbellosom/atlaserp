import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'transaction',
  name: 'financia.transaction',
  label: 'Movimiento',
  tableName: 'financia_transaction',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'account_id',   type: 'relation', label: 'Cuenta',      required: true, relatedModel: 'financia.account' },
    { name: 'fecha',        type: 'date',     label: 'Fecha',       required: true },
    { name: 'tipo_id',      type: 'relation', label: 'Tipo',        relatedModel: 'financia.transaction_type' },
    { name: 'numero',       type: 'text',     label: 'Numero',      maxLength: 64 },
    { name: 'nombre',       type: 'text',     label: 'Nombre',      required: true, maxLength: 255 },
    { name: 'referencia',   type: 'text',     label: 'Referencia',  maxLength: 255 },
    { name: 'concepto',     type: 'textarea', label: 'Concepto',    maxLength: 512 },
    { name: 'deposito',     type: 'decimal',  label: 'Deposito' },
    { name: 'retiro',       type: 'decimal',  label: 'Retiro' },
    { name: 'category_id',  type: 'relation', label: 'Categoria',   relatedModel: 'financia.category' },
  ],
  indexes: [
    { fields: ['account_id', 'fecha', 'created_at'] },
    { fields: ['company_id', 'fecha'] },
    { fields: ['account_id', 'enabled'] },
  ],
})

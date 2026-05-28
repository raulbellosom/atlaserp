import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'insurance_policy',
  name: 'fleet.insurance_policy',
  label: 'Poliza de seguro',
  tableName: 'fleet_insurance_policy',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'vehicle_id',        type: 'relation', label: 'Vehiculo',            relatedModel: 'fleet.vehicle', required: true },
    { name: 'insurer_name',      type: 'text',     label: 'Aseguradora',         required: true, maxLength: 100 },
    { name: 'policy_number',     type: 'text',     label: 'Numero de poliza',    required: true, maxLength: 50 },
    { name: 'coverage_type',     type: 'select',   label: 'Tipo de cobertura',
      options: ['basic', 'comprehensive', 'third_party', 'other'] },
    { name: 'start_date',        type: 'date',     label: 'Inicio de vigencia',  required: true },
    { name: 'expiry_date',       type: 'date',     label: 'Fin de vigencia',     required: true },
    { name: 'premium',           type: 'decimal',  label: 'Prima' },
    { name: 'currency',          type: 'text',     label: 'Moneda',              maxLength: 3, default: 'MXN' },
    { name: 'notes',             type: 'textarea', label: 'Notas',               maxLength: 3000 },
    { name: 'document_asset_id', type: 'file',     label: 'Certificado (archivo)' },
  ],
  indexes: [
    { fields: ['company_id', 'vehicle_id'] },
    { fields: ['company_id', 'policy_number'], unique: true },
    { fields: ['company_id', 'expiry_date'] },
  ],
})

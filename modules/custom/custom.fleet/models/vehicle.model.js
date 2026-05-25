import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'vehicle',
  name: 'fleet.vehicle',
  label: 'Vehiculo',
  tableName: 'fleet_vehicle',
  companyScoped: true,
  softDelete: true,
  fields: [
    {
      name: 'plate',
      type: 'text',
      label: 'Matricula',
      required: true,
      maxLength: 20,
    },
    // Legacy free-text fields — optional since vehicle_model_id is the primary identifier
    {
      name: 'brand',
      type: 'text',
      label: 'Marca (texto)',
      maxLength: 100,
    },
    {
      name: 'model_name',
      type: 'text',
      label: 'Modelo (texto)',
      maxLength: 100,
    },
    {
      name: 'year',
      type: 'number',
      label: 'Anio',
    },
    // Catalog FK references
    {
      name: 'vehicle_model_id',
      type: 'relation',
      label: 'Modelo de vehiculo',
      relatedModel: 'fleet.vehicle_model',
    },
    {
      name: 'vehicle_type_id',
      type: 'relation',
      label: 'Tipo de vehiculo',
      relatedModel: 'fleet.vehicle_type',
    },
    {
      name: 'vehicle_brand_id',
      type: 'relation',
      label: 'Marca',
      relatedModel: 'fleet.vehicle_brand',
    },
    // Economic numbering
    {
      name: 'economic_group_number',
      type: 'text',
      label: 'No. economico grupo',
      maxLength: 4,
    },
    {
      name: 'economic_individual_number',
      type: 'text',
      label: 'No. economico individual',
      maxLength: 4,
    },
    {
      name: 'color',
      type: 'color',
      label: 'Color',
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      required: true,
      options: ['active', 'maintenance', 'inactive', 'retired'],
      default: 'active',
    },
    {
      name: 'driver_id',
      type: 'relation',
      label: 'Conductor',
      relatedModel: 'fleet.driver',
    },
    {
      name: 'photo_asset_id',
      type: 'file',
      label: 'Foto (ID de archivo)',
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notas',
    },
    {
      name: 'is_financed',
      type: 'boolean',
      label: 'Financiado',
      required: true,
      default: false,
    },
    {
      name: 'financing_institution',
      type: 'text',
      label: 'Financiera',
      maxLength: 200,
    },
    {
      name: 'financing_contract_number',
      type: 'text',
      label: 'Contrato de financiamiento',
      maxLength: 120,
    },
    {
      name: 'financing_start_date',
      type: 'date',
      label: 'Inicio de financiamiento',
    },
    {
      name: 'financing_end_date',
      type: 'date',
      label: 'Fin de financiamiento',
    },
    {
      name: 'financing_monthly_payment',
      type: 'decimal',
      label: 'Mensualidad',
    },
    {
      name: 'financing_notes',
      type: 'textarea',
      label: 'Notas de financiamiento',
      maxLength: 1000,
    },
  ],
  indexes: [
    { fields: ['company_id', 'plate'], unique: true },
    { fields: ['company_id', 'status'] },
    { fields: ['company_id', 'vehicle_model_id'] },
    { fields: ['company_id', 'vehicle_type_id'] },
    { fields: ['company_id', 'vehicle_brand_id'] },
  ],
})

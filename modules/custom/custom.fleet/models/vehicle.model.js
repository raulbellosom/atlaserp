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
    {
      name: 'brand',
      type: 'text',
      label: 'Marca',
      required: true,
      maxLength: 100,
    },
    {
      name: 'model_name',
      type: 'text',
      label: 'Modelo',
      required: true,
      maxLength: 100,
    },
    {
      name: 'year',
      type: 'number',
      label: 'Anio',
      required: true,
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
      relatedModel: 'Employee',
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
  ],
})

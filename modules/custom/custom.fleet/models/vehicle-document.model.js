import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'vehicle_document',
  name: 'fleet.vehicle_document',
  label: 'Documento de vehiculo',
  tableName: 'fleet_vehicle_document',
  companyScoped: true,
  softDelete: false,
  fields: [
    {
      name: 'vehicle_id',
      type: 'relation',
      label: 'Vehiculo (ID)',
      required: true,
    },
    {
      name: 'file_asset_id',
      type: 'file',
      label: 'Archivo (ID)',
      required: true,
    },
    {
      name: 'document_type',
      type: 'text',
      label: 'Tipo de documento',
      default: 'document',
      maxLength: 50,
    },
    {
      name: 'label',
      type: 'text',
      label: 'Etiqueta',
      maxLength: 200,
    },
    {
      name: 'enabled',
      type: 'boolean',
      label: 'Activo',
      default: true,
    },
  ],
  indexes: [
    { fields: ['company_id', 'vehicle_id'] },
    { fields: ['company_id', 'file_asset_id'] },
  ],
})

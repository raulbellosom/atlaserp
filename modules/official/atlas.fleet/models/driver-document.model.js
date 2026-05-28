import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'driver_document',
  name: 'fleet.driver_document',
  label: 'Documento de chofer',
  tableName: 'fleet_driver_document',
  companyScoped: true,
  softDelete: false,
  fields: [
    {
      name: 'driver_id',
      type: 'relation',
      label: 'Chofer (ID)',
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
    { fields: ['company_id', 'driver_id'] },
    { fields: ['company_id', 'file_asset_id'] },
  ],
})

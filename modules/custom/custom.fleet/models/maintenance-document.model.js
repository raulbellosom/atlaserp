import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'maintenance_document',
  name: 'fleet.maintenance_document',
  label: 'Documento de mantenimiento',
  tableName: 'fleet_maintenance_document',
  companyScoped: true,
  softDelete: false,
  fields: [
    {
      name: 'maintenance_id',
      type: 'text',
      label: 'Mantenimiento (ID)',
      required: true,
    },
    {
      name: 'file_asset_id',
      type: 'text',
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
    { fields: ['company_id', 'maintenance_id'] },
    { fields: ['company_id', 'file_asset_id'] },
  ],
})

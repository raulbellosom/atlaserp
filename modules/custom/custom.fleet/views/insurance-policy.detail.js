import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.insurance_policy.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'insurance_policy',
    component: 'AtlasDetail',
    apiPath: '/fleet/insurance',
    sections: [
      {
        label: 'Datos de la poliza',
        columns: 2,
        fields: [
          { field: 'vehicle_plate', label: 'Vehiculo (matricula)', icon: 'Truck' },
          { field: 'insurer_name', label: 'Aseguradora', icon: 'ShieldCheck' },
          { field: 'policy_number', label: 'Numero de poliza', icon: 'Hash' },
          { field: 'coverage_type', label: 'Tipo de cobertura', icon: 'Shield' },
          { field: 'is_active', label: 'Estado', type: 'boolean', icon: 'Activity' },
        ],
      },
      {
        label: 'Vigencia y costos',
        columns: 2,
        fields: [
          { field: 'start_date', label: 'Inicio de vigencia', type: 'date', icon: 'CalendarDays' },
          { field: 'expiry_date', label: 'Fin de vigencia', type: 'date', icon: 'CalendarDays' },
          { field: 'premium', label: 'Prima anual', type: 'currency', icon: 'DollarSign' },
          { field: 'currency', label: 'Moneda', icon: 'Tag' },
        ],
      },
      {
        label: 'Notas',
        fields: [
          { field: 'notes', label: 'Notas adicionales', icon: 'FileText' },
        ],
      },
      {
        id: 'certificate',
        type: 'file-preview',
        label: 'Certificado de seguro',
        filePreview: {
          fileAssetIdField: 'document_asset_id',
          signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
          permissions: {
            read: 'fleet.insurance.read',
            fileRead: 'files.assets.read',
          },
        },
      },
    ],
    actions: [
      { label: 'Editar',     permission: 'fleet.insurance.update' },
      { label: 'Desactivar', permission: 'fleet.insurance.delete' },
    ],
  },
})

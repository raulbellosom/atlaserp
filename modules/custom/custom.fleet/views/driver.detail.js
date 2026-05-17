import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.driver.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'driver',
    component: 'AtlasDetail',
    apiPath: '/fleet/drivers',
    sections: [
      {
        label: 'Perfil del chofer',
        columns: 2,
        fields: [
          { field: 'first_name', label: 'Nombre', icon: 'UserCheck' },
          { field: 'last_name', label: 'Apellido', icon: 'UserCheck' },
          { field: 'phone', label: 'Teléfono', icon: 'Phone' },
          { field: 'email', label: 'Correo electrónico', icon: 'Mail' },
        ],
      },
      {
        label: 'Licencia',
        columns: 2,
        fields: [
          { field: 'license_number', label: 'Número de licencia', icon: 'IdCard' },
          { field: 'license_type', label: 'Tipo de licencia', icon: 'ClipboardList' },
          { field: 'license_expiry_date', label: 'Fecha de vencimiento', type: 'date', icon: 'CalendarDays' },
        ],
      },
      {
        label: 'Estado',
        fields: [
          { field: 'status', label: 'Estado', icon: 'Activity' },
        ],
      },
      {
        id: 'assigned_vehicles',
        type: 'relation-list',
        label: 'Vehículos asignados',
        relationList: {
          apiPath: '/fleet/drivers/:id/vehicles',
          titleField: 'plate',
          subtitleFields: ['vehicle_model_name', 'economic_number'],
          hrefTemplate: '/app/m/custom.fleet/vehicles/:id',
          icon: 'Truck',
          emptyMessage: 'No hay vehículos asignados.',
        },
      },
      {
        label: 'Notas',
        fields: [
          { field: 'notes', label: 'Notas' },
        ],
      },
      {
        id: 'documents',
        type: 'documents',
        label: 'Documentos',
        documents: {
          listPath: '/fleet/drivers/:id/documents',
          addPath: '/fleet/drivers/:id/documents',
          removePath: '/fleet/drivers/:id/documents/:docId',
          upload: {
            endpoint: '/files/upload',
            moduleKey: 'custom.fleet',
            entityType: 'FleetDriver',
          },
          fields: {
            associationId: 'id',
            fileAssetId: 'file_asset_id',
            documentType: 'document_type',
            label: 'label',
            createdAt: 'created_at',
            enabled: 'enabled',
            fileAsset: 'file_asset',
            fileName: 'originalName',
            mimeType: 'mimeType',
            sizeBytes: 'sizeBytes',
          },
          signedUrl: {
            endpointTemplate: '/files/:fileId/signed-url',
          },
          permissions: {
            read: 'fleet.drivers.read',
            create: 'fleet.drivers.update',
            remove: 'fleet.drivers.update',
            fileUpload: 'files.assets.create',
            fileRead: 'files.assets.read',
          },
        },
      },
    ],
    actions: [
      { label: 'Editar', permission: 'fleet.drivers.update' },
      { label: 'Desactivar', permission: 'fleet.drivers.delete' },
    ],
  },
})

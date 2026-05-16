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
        label: 'Datos personales',
        columns: 2,
        fields: [
          { field: 'first_name', label: 'Nombre' },
          { field: 'last_name', label: 'Apellido' },
          { field: 'phone', label: 'Telefono' },
          { field: 'email', label: 'Correo electronico' },
        ],
      },
      {
        label: 'Licencia',
        columns: 2,
        fields: [
          { field: 'license_number', label: 'Numero de licencia' },
          { field: 'license_type', label: 'Tipo de licencia' },
          { field: 'license_expiry_date', label: 'Fecha de vencimiento', type: 'date' },
        ],
      },
      {
        label: 'Estado',
        fields: [
          { field: 'status', label: 'Estado' },
        ],
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

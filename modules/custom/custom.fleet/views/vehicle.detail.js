import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.vehicle.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'vehicle',
    component: 'AtlasDetail',
    apiPath: '/fleet/vehicles',
    sections: [
      {
        label: 'Informacion general',
        columns: 2,
        fields: [
          { field: 'plate', label: 'Matricula' },
          { field: 'vehicle_model_name', label: 'Modelo' },
          { field: 'vehicle_model_year', label: 'Anio' },
          { field: 'vehicle_brand_name', label: 'Marca' },
          { field: 'vehicle_type_name', label: 'Tipo de Vehiculo' },
          { field: 'color', label: 'Color', type: 'color' },
          { field: 'status', label: 'Estado' },
          { field: 'economic_number', label: 'No. Economico' },
        ],
      },
      {
        label: 'Conductor asignado',
        fields: [{ field: 'driver_id', label: 'Conductor', type: 'relation' }],
      },
      {
        id: 'documents',
        type: 'documents',
        label: 'Documentos',
        documents: {
          listPath: '/fleet/vehicles/:id/documents',
          addPath: '/fleet/vehicles/:id/documents',
          removePath: '/fleet/vehicles/:id/documents/:docId',
          upload: {
            endpoint: '/files/upload',
            moduleKey: 'custom.fleet',
            entityType: 'FleetVehicle',
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
            read: 'fleet.vehicles.read',
            create: 'fleet.vehicles.update',
            remove: 'fleet.vehicles.update',
            fileUpload: 'files.assets.create',
            fileRead: 'files.assets.read',
          },
        },
      },
    ],
    actions: [
      { label: 'Editar', permission: 'fleet.vehicles.update' },
      { label: 'Desactivar', permission: 'fleet.vehicles.delete' },
    ],
  },
})

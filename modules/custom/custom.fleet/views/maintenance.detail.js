import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.maintenance.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'maintenance',
    component: 'AtlasDetail',
    apiPath: '/fleet/maintenance',
    sections: [
      {
        label: 'Informacion general',
        columns: 2,
        fields: [
          { field: 'title', label: 'Titulo' },
          { field: 'type', label: 'Categoria' },
          { field: 'status', label: 'Estado' },
          { field: 'maintenance_type_id', label: 'Tipo de mantenimiento' },
        ],
      },
      {
        label: 'Vehiculo y conductor',
        columns: 2,
        fields: [
          { field: 'vehicle_plate', label: 'Vehiculo' },
          { field: 'driver_full_name', label: 'Chofer' },
        ],
      },
      {
        label: 'Operacion',
        columns: 2,
        fields: [
          { field: 'started_at', label: 'Fecha de inicio', type: 'datetime' },
          { field: 'scheduled_date', label: 'Fecha programada', type: 'date' },
          { field: 'odometer_km', label: 'Odometro (km)' },
          { field: 'provider', label: 'Proveedor' },
          { field: 'currency', label: 'Moneda' },
        ],
      },
      {
        label: 'Notas y descripcion',
        fields: [
          { field: 'description', label: 'Descripcion' },
          { field: 'notes', label: 'Notas' },
          { field: 'cost', label: 'Costo', type: 'number' },
          { field: 'completed_date', label: 'Fecha de completado', type: 'date' },
        ],
      },
      {
        id: 'documents',
        type: 'documents',
        label: 'Documentos',
        documents: {
          listPath: '/fleet/maintenance/:id/documents',
          addPath: '/fleet/maintenance/:id/documents',
          removePath: '/fleet/maintenance/:id/documents/:docId',
          upload: {
            endpoint: '/files/upload',
            moduleKey: 'custom.fleet',
            entityType: 'FleetMaintenance',
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
            read: 'fleet.maintenance.read',
            create: 'fleet.maintenance.update',
            remove: 'fleet.maintenance.update',
            fileUpload: 'files.assets.create',
            fileRead: 'files.assets.read',
          },
        },
      },
    ],
    actions: [
      { label: 'Editar', permission: 'fleet.maintenance.update' },
      { label: 'Cancelar', permission: 'fleet.maintenance.delete' },
    ],
  },
})

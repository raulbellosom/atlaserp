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
        label: 'Información general',
        columns: 2,
        fields: [
          { field: 'title', label: 'Título', icon: 'ClipboardList' },
          { field: 'type', label: 'Categoría', icon: 'Layers' },
          { field: 'status', label: 'Estado', icon: 'Activity' },
          { field: 'maintenance_type_name', label: 'Tipo de mantenimiento', icon: 'Wrench' },
        ],
      },
      {
        id: 'related_vehicle',
        type: 'relation-card',
        label: 'Vehículo',
        relationCard: {
          idField: 'vehicle_id',
          titleField: 'vehicle_plate',
          subtitleFields: ['vehicle_model_name', 'economic_number'],
          fallbackTitle: 'Vehículo no disponible',
          hrefTemplate: '/app/m/custom.fleet/vehicles/:id',
          icon: 'Truck',
        },
      },
      {
        id: 'related_driver',
        type: 'relation-card',
        label: 'Conductor',
        relationCard: {
          idField: 'driver_id',
          titleField: 'driver_full_name',
          subtitleFields: [],
          fallbackTitle: 'Conductor no asignado',
          hrefTemplate: '/app/m/custom.fleet/drivers/:id',
          icon: 'UserCheck',
        },
      },
      {
        label: 'Operación',
        columns: 2,
        fields: [
          { field: 'started_at', label: 'Fecha de inicio', type: 'datetime', icon: 'CalendarDays' },
          { field: 'scheduled_date', label: 'Fecha programada', type: 'date', icon: 'CalendarDays' },
          { field: 'odometer_km', label: 'Odómetro (km)', icon: 'Hash' },
          { field: 'provider', label: 'Proveedor', icon: 'Library' },
          { field: 'currency', label: 'Moneda', icon: 'Tag' },
        ],
      },
      {
        label: 'Notas y descripción',
        fields: [
          { field: 'description', label: 'Descripción', icon: 'FileText' },
          { field: 'notes', label: 'Notas' },
          { field: 'cost', label: 'Costo', type: 'number', icon: 'Tag' },
          { field: 'completed_date', label: 'Fecha de completado', type: 'date', icon: 'CalendarDays' },
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

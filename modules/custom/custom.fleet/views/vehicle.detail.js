import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.vehicle.detail',
  kind: 'DETAIL',
  version: '0.2.0',
  schema: {
    entity: 'vehicle',
    component: 'AtlasDetail',
    apiPath: '/fleet/vehicles',
    sections: [
      {
        label: 'Identificacion del vehiculo',
        columns: 2,
        fields: [
          { field: 'plate',               label: 'Matricula',          icon: 'Hash' },
          { field: 'full_economic_number', label: 'Numero economico',   icon: 'Hash' },
          { field: 'vehicle_brand_name',   label: 'Marca',              icon: 'Tag' },
          { field: 'vehicle_model_name',   label: 'Modelo',             icon: 'Truck' },
          { field: 'vehicle_model_year',   label: 'Año',                icon: 'CalendarDays' },
          { field: 'vehicle_type_name',    label: 'Tipo de vehiculo',   icon: 'Layers' },
        ],
      },
      {
        label: 'Estado y apariencia',
        columns: 2,
        fields: [
          { field: 'status', label: 'Estado operativo', icon: 'Activity' },
          { field: 'color',  label: 'Color del vehiculo', type: 'color', icon: 'Palette' },
        ],
      },
      {
        id: 'assigned_driver',
        type: 'relation-card',
        label: 'Conductor asignado',
        relationCard: {
          idField: 'driver_id',
          titleField: 'driver_name',
          subtitleFields: ['driver_license_number', 'driver_phone'],
          fallbackTitle: 'Sin conductor asignado',
          hrefTemplate: '/app/m/custom.fleet/drivers/:id',
          icon: 'UserCheck',
        },
      },
      {
        label: 'Observaciones',
        fields: [
          { field: 'notes', label: 'Notas', icon: 'FileText' },
        ],
      },
      {
        id: 'documents',
        type: 'documents',
        label: 'Documentos del vehiculo',
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
      { label: 'Editar',     permission: 'fleet.vehicles.update' },
      { label: 'Desactivar', permission: 'fleet.vehicles.delete' },
    ],
  },
})

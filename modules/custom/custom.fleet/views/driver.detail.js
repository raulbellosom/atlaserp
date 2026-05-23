import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.driver.detail',
  kind: 'DETAIL',
  version: '0.2.0',
  schema: {
    entity: 'driver',
    component: 'AtlasDetail',
    apiPath: '/fleet/drivers',
    sections: [
      {
        label: 'Datos del chofer',
        columns: 2,
        fields: [
          { field: 'first_name', label: 'Nombre',              icon: 'User' },
          { field: 'last_name',  label: 'Apellido',            icon: 'User' },
          { field: 'phone',      label: 'Telefono',            icon: 'Phone' },
          { field: 'email',      label: 'Correo electronico',  icon: 'Mail' },
          { field: 'status',     label: 'Estado',              icon: 'Activity' },
        ],
      },
      {
        label: 'Licencia de conducir',
        columns: 2,
        fields: [
          { field: 'license_number',      label: 'Numero de licencia',   icon: 'IdCard' },
          { field: 'license_type',        label: 'Tipo de licencia',     icon: 'ClipboardList' },
          { field: 'license_expiry_date', label: 'Fecha de vencimiento', icon: 'CalendarDays', type: 'date' },
        ],
      },
      {
        id: 'assigned_vehicles',
        type: 'relation-list',
        label: 'Vehiculo asignado',
        relationList: {
          apiPath: '/fleet/drivers/:id/vehicles',
          idField: 'id',
          titleField: 'plate',
          subtitleFields: ['vehicle_brand_name', 'vehicle_model_name', 'vehicle_type_name', 'full_economic_number', 'status'],
          subtitleLabels: ['Marca', 'Modelo', 'Tipo', 'No. Economico', 'Estado'],
          hrefTemplate: '/app/m/custom.fleet/vehicles/:id',
          icon: 'Truck',
          emptyMessage: 'Sin vehiculo asignado.',
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
      { label: 'Editar',     permission: 'fleet.drivers.update' },
      { label: 'Desactivar', permission: 'fleet.drivers.delete' },
    ],
  },
})

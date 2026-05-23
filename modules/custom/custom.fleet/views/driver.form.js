import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.driver.form',
  kind: 'FORM',
  version: '0.2.0',
  schema: {
    entity: 'driver',
    component: 'AtlasForm',
    apiPath: '/fleet/drivers',
    sections: [
      {
        label: 'Datos personales',
        columns: 2,
        collapsible: true,
        fields: [
          { field: 'first_name', label: 'Nombre',             type: 'text',   required: true },
          { field: 'last_name',  label: 'Apellido',           type: 'text',   required: true },
          { field: 'phone',      label: 'Telefono',           type: 'phone',  required: true },
          { field: 'email',      label: 'Correo electronico', type: 'email' },
          {
            field: 'status',
            label: 'Estado operativo',
            type: 'select',
            default: 'active',
            options: [
              { label: 'Activo',     value: 'active' },
              { label: 'Inactivo',   value: 'inactive' },
              { label: 'Suspendido', value: 'suspended' },
            ],
          },
        ],
      },
      {
        label: 'Licencia de conducir',
        columns: 2,
        collapsible: true,
        fields: [
          { field: 'license_number',      label: 'Numero de licencia',   type: 'text', required: true },
          { field: 'license_type',        label: 'Tipo de licencia',     type: 'text', required: true },
          { field: 'license_expiry_date', label: 'Fecha de vencimiento', type: 'date', required: true },
        ],
      },
      {
        label: 'Notas',
        collapsible: true,
        defaultCollapsed: true,
        fields: [
          { field: 'notes', label: 'Notas adicionales', type: 'textarea' },
        ],
      },
      {
        id: 'attachments',
        type: 'attachments',
        label: 'Documentos',
        collapsible: true,
        defaultCollapsed: true,
        attachments: {
          createMode: 'stage-until-parent-create',
          editMode: 'upload-immediately',
          listPath: '/fleet/drivers/:id/documents',
          addPath: '/fleet/drivers/:id/documents',
          removePath: '/fleet/drivers/:id/documents/:docId',
          upload: {
            endpoint: '/files/upload',
            moduleKey: 'custom.fleet',
            entityType: 'FleetDriver',
          },
          signedUrl: {
            endpointTemplate: '/files/:fileId/signed-url',
          },
          fields: {
            id: 'id',
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
          permissions: {
            read: 'fleet.drivers.read',
            create: 'fleet.drivers.update',
            remove: 'fleet.drivers.update',
            fileUpload: 'files.assets.create',
            fileRead: 'files.assets.read',
          },
          limits: {
            maxFiles: 20,
            maxSizeMB: 10,
            allowMultiple: true,
          },
        },
      },
    ],
    submitLabel: 'Guardar chofer',
    cancelLabel: 'Cancelar',
  },
})

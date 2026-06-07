import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { componentRegistry } from '../../../lib/moduleComponentRegistry'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
const BASE_PATH = '/app/m/atlas.fleet/drivers'

const DRIVER_TABLE = {
  key: 'fleet.driver.table',
  kind: 'TABLE',
  schema: {
    entity: 'driver',
    component: 'AtlasTable',
    apiPath: '/fleet/drivers',
    primaryField: 'full_name',
    searchable: true,
    searchPlaceholder: 'Buscar chofer...',
    columns: [
      { field: 'photo_asset_id_resolved', label: 'Foto', sortable: false, component: 'atlas.fleet:DriverAvatarCell' },
      { field: 'full_name', label: 'Nombre completo', sortable: true, link: true },
      { field: 'phone', label: 'Telefono', sortable: false },
      { field: 'license_number', label: 'No. Licencia', sortable: true },
      { field: 'license_type', label: 'Tipo licencia', sortable: false },
      { field: 'license_expiry_date', label: 'Vencimiento', sortable: true, type: 'date' },
      { field: 'assigned_plate', label: 'Vehiculo', sortable: false, component: 'atlas.fleet:DriverAssignedVehicleCell' },
      { field: 'hr_employee_name', label: 'Colaborador RH', sortable: false },
      { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:DriverStatusBadge' },
    ],
    actions: [{ label: 'Crear chofer', permission: 'fleet.drivers.create', variant: 'primary' }],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.drivers.read' },
      { label: 'Editar', permission: 'fleet.drivers.update' },
      { label: 'Desactivar', permission: 'fleet.drivers.delete' },
    ],
    emptyState: { message: 'No hay choferes registrados.' },
  },
}

const DRIVER_FORM = {
  key: 'fleet.driver.form',
  kind: 'FORM',
  schema: {
    entity: 'driver',
    component: 'AtlasForm',
    apiPath: '/fleet/drivers',
    sections: [
      {
        label: 'Datos del chofer',
        fields: [
          { field: 'first_name', label: 'Nombre', type: 'text', required: true },
          { field: 'last_name', label: 'Apellido', type: 'text', required: true },
          { field: 'phone', label: 'Telefono', type: 'phone', required: true },
          { field: 'email', label: 'Correo', type: 'email' },
          { field: 'license_number', label: 'No. de licencia', type: 'text', required: true },
          { field: 'license_type', label: 'Tipo de licencia', type: 'text', required: true },
          { field: 'license_expiry_date', label: 'Vencimiento lic.', type: 'date', required: true },
          {
            field: 'status', label: 'Estado', type: 'select',
            options: [
              { value: 'active', label: 'Activo' },
              { value: 'inactive', label: 'Inactivo' },
              { value: 'suspended', label: 'Suspendido' },
            ],
          },
          { field: 'notes', label: 'Notas', type: 'markdown' },
        ],
      },
      {
        id: 'attachments',
        type: 'attachments',
        label: 'Documentos del chofer',
        placement: 'aside',
        collapsible: true,
        attachments: {
          createMode: 'stage-until-parent-create',
          editMode: 'upload-immediately',
          listPath: '/fleet/drivers/:id/documents',
          addPath: '/fleet/drivers/:id/documents',
          removePath: '/fleet/drivers/:id/documents/:docId',
          upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetDriver' },
          signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
          fields: {
            id: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type',
            label: 'label', createdAt: 'created_at', enabled: 'enabled',
            fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes',
          },
          permissions: {
            read: 'fleet.drivers.read', create: 'fleet.drivers.update',
            remove: 'fleet.drivers.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read',
          },
          limits: { maxFiles: 20, maxSizeMB: 10, allowMultiple: true },
        },
      },
    ],
    submitLabel: 'Guardar chofer',
    cancelLabel: 'Cancelar',
  },
}

const DRIVER_DETAIL = {
  key: 'fleet.driver.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'driver',
    component: 'AtlasDetail',
    apiPath: '/fleet/drivers',
    sections: [
      {
        label: 'Datos del chofer',
        columns: 2,
        fields: [
          { field: 'full_name', label: 'Nombre completo', icon: 'User' },
          { field: 'phone', label: 'Telefono', icon: 'Phone' },
          { field: 'email', label: 'Correo', icon: 'Mail' },
          { field: 'license_number', label: 'No. Licencia', icon: 'Hash' },
          { field: 'license_type', label: 'Tipo licencia', icon: 'Tag' },
          { field: 'license_expiry_date', label: 'Vencimiento', type: 'date', icon: 'CalendarDays' },
          { field: 'status', label: 'Estado', icon: 'Activity' },
        ],
      },
      {
        id: 'documents',
        type: 'documents',
        label: 'Documentos del chofer',
        documents: {
          listPath: '/fleet/drivers/:id/documents',
          addPath: '/fleet/drivers/:id/documents',
          removePath: '/fleet/drivers/:id/documents/:docId',
          upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetDriver' },
          fields: {
            associationId: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type',
            label: 'label', createdAt: 'created_at', enabled: 'enabled',
            fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes',
          },
          signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
          permissions: {
            read: 'fleet.drivers.read', create: 'fleet.drivers.update',
            remove: 'fleet.drivers.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read',
          },
        },
      },
    ],
    actions: [
      { label: 'Editar', permission: 'fleet.drivers.update' },
      { label: 'Desactivar', permission: 'fleet.drivers.delete' },
    ],
  },
}

function parseModeAndId(wildcard) {
  const segs = String(wildcard ?? '').replace(/^\/+/, '').replace(/^drivers\/?/, '').split('/').filter(Boolean)
  if (segs[0] === 'new') return { initialMode: 'create', recordId: null }
  if (segs[1] === 'edit') return { initialMode: 'edit', recordId: segs[0] }
  if (segs[0]) return { initialMode: 'detail', recordId: segs[0] }
  return { initialMode: 'list', recordId: null }
}

export default function DriversScreen() {
  const { '*': wildcard } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { initialMode, recordId } = useMemo(() => parseModeAndId(wildcard), [wildcard])

  const handleNavigate = useCallback(({ mode, recordId }) => {
    const path =
      mode === 'create' ? `${BASE_PATH}/new` :
      mode === 'detail' && recordId ? `${BASE_PATH}/${recordId}` :
      mode === 'edit' && recordId ? `${BASE_PATH}/${recordId}/edit` :
      BASE_PATH
    navigate(path, { replace: true })
  }, [navigate])

  return (
    <AtlasCrudView
      tableBlueprint={DRIVER_TABLE}
      formBlueprint={DRIVER_FORM}
      detailBlueprint={DRIVER_DETAIL}
      token={token}
      apiBaseUrl={API_BASE}
      initialMode={initialMode}
      recordId={recordId}
      onNavigate={handleNavigate}
      componentRegistry={componentRegistry}
    />
  )
}

import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.driver.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'driver',
    component: 'AtlasTable',
    apiPath: '/fleet/drivers',
    primaryField: 'full_name',
    searchable: true,
    searchPlaceholder: 'Buscar chofer...',
    columns: [
      { field: 'full_name', label: 'Nombre completo', sortable: true, link: true },
      { field: 'phone', label: 'Telefono' },
      { field: 'license_number', label: 'N° Licencia', sortable: true },
      { field: 'license_type', label: 'Tipo de licencia' },
      { field: 'license_expiry_date', label: 'Vencimiento', type: 'date', sortable: true },
      { field: 'status', label: 'Estado', component: 'custom.fleet:DriverStatusBadge' },
    ],
    actions: [
      { label: 'Crear chofer', permission: 'fleet.drivers.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.drivers.read' },
      { label: 'Editar', permission: 'fleet.drivers.update' },
      { label: 'Desactivar', permission: 'fleet.drivers.delete' },
    ],
    emptyState: {
      message: 'No hay choferes registrados.',
    },
  },
})

import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.maintenance.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'maintenance',
    component: 'AtlasTable',
    apiPath: '/fleet/maintenance',
    primaryField: 'title',
    searchable: true,
    searchPlaceholder: 'Buscar mantenimiento...',
    columns: [
      { field: 'title', label: 'Titulo', sortable: true, link: true },
      { field: 'vehicle_plate', label: 'Vehiculo', sortable: false },
      { field: 'driver_full_name', label: 'Chofer', sortable: false },
      { field: 'status', label: 'Estado', sortable: true, component: 'custom.fleet:MaintenanceStatusBadge' },
      { field: 'started_at', label: 'Inicio', type: 'datetime', sortable: true },
      { field: 'odometer_km', label: 'Odometro (km)', type: 'number', sortable: true },
      { field: 'provider', label: 'Proveedor', sortable: false },
    ],
    actions: [
      { label: 'Registrar mantenimiento', permission: 'fleet.maintenance.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.maintenance.read' },
      { label: 'Editar', permission: 'fleet.maintenance.update' },
      { label: 'Cancelar', permission: 'fleet.maintenance.delete' },
    ],
    emptyState: {
      message: 'No hay registros de mantenimiento.',
    },
  },
})

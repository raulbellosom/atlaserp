import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.driver.table',
  kind: 'TABLE',
  version: '0.2.0',
  schema: {
    entity: 'driver',
    component: 'AtlasTable',
    apiPath: '/fleet/drivers',
    primaryField: 'full_name',
    searchable: true,
    searchPlaceholder: 'Buscar chofer...',
    columns: [
      { field: 'full_name',           label: 'Nombre completo',  sortable: true,  link: true },
      { field: 'phone',               label: 'Telefono',         sortable: false },
      { field: 'license_number',      label: 'No. Licencia',     sortable: true },
      { field: 'license_type',        label: 'Tipo licencia',    sortable: false },
      { field: 'license_expiry_date', label: 'Vencimiento',      sortable: true, type: 'date' },
      { field: 'assigned_plate',      label: 'Vehiculo',         sortable: false },
      {
        field: 'status',
        label: 'Estado',
        sortable: true,
        component: 'custom.fleet:DriverStatusBadge',
      },
    ],
    actions: [
      { label: 'Crear chofer', permission: 'fleet.drivers.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.drivers.read' },
      { label: 'Editar',      permission: 'fleet.drivers.update' },
      { label: 'Desactivar',  permission: 'fleet.drivers.delete' },
    ],
    emptyState: {
      message: 'No hay choferes registrados.',
    },
  },
})

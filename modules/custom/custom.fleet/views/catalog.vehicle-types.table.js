import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.catalog.vehicle_types.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'vehicle_type',
    component: 'AtlasTable',
    apiPath: '/fleet/catalogs/vehicle-types',
    primaryField: 'name',
    searchable: true,
    searchPlaceholder: 'Buscar tipo de vehiculo...',
    columns: [
      { field: 'name', label: 'Nombre', sortable: true, link: true },
      { field: 'description', label: 'Descripcion', sortable: false },
    ],
    actions: [
      { label: 'Agregar tipo', permission: 'fleet.catalogs.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Editar', permission: 'fleet.catalogs.update' },
      { label: 'Desactivar', permission: 'fleet.catalogs.delete' },
    ],
    emptyState: { message: 'No hay tipos de vehiculo registrados.' },
  },
})

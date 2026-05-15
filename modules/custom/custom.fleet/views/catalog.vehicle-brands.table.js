import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.catalog.vehicle_brands.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'vehicle_brand',
    component: 'AtlasTable',
    apiPath: '/fleet/catalogs/vehicle-brands',
    primaryField: 'name',
    searchable: true,
    searchPlaceholder: 'Buscar marca de vehiculo...',
    columns: [
      { field: 'name', label: 'Nombre', sortable: true, link: true },
    ],
    actions: [
      { label: 'Agregar marca', permission: 'fleet.catalogs.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Editar', permission: 'fleet.catalogs.update' },
      { label: 'Desactivar', permission: 'fleet.catalogs.delete' },
    ],
    emptyState: { message: 'No hay marcas de vehiculo registradas.' },
  },
})

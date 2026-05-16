import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.catalog.vehicle_models.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'vehicle_model',
    component: 'AtlasTable',
    apiPath: '/fleet/catalogs/vehicle-models',
    primaryField: 'name',
    searchable: true,
    searchPlaceholder: 'Buscar modelo de vehiculo...',
    columns: [
      { field: 'name', label: 'Nombre del modelo', sortable: true, link: true },
      { field: 'brand_name', label: 'Marca', sortable: false },
      { field: 'type_name', label: 'Tipo de vehiculo', sortable: false },
      { field: 'year', label: 'Año', sortable: true },
    ],
    actions: [
      { label: 'Agregar modelo', permission: 'fleet.catalogs.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Editar', permission: 'fleet.catalogs.update' },
      { label: 'Desactivar', permission: 'fleet.catalogs.delete' },
    ],
    emptyState: { message: 'No hay modelos de vehiculo registrados.' },
  },
})

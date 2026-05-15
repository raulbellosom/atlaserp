import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.catalog.maintenance_types.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'maintenance_type',
    component: 'AtlasTable',
    apiPath: '/fleet/catalogs/maintenance-types',
    primaryField: 'name',
    searchable: true,
    searchPlaceholder: 'Buscar tipo de mantenimiento...',
    columns: [
      { field: 'name', label: 'Nombre', sortable: true, link: true },
      { field: 'description', label: 'Descripcion', sortable: false },
      { field: 'is_system', label: 'Sistema', type: 'boolean', sortable: false },
    ],
    actions: [
      { label: 'Agregar tipo', permission: 'fleet.catalogs.create', variant: 'primary' },
      { label: 'Cargar predeterminados', permission: 'fleet.catalogs.create', variant: 'secondary' },
    ],
    rowActions: [
      { label: 'Editar', permission: 'fleet.catalogs.update' },
      { label: 'Desactivar', permission: 'fleet.catalogs.delete' },
    ],
    emptyState: { message: 'No hay tipos de mantenimiento registrados.' },
  },
})

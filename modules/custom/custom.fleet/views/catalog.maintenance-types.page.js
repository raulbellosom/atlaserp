import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.catalog.maintenance_types.page',
  path: '/app/m/custom.fleet/catalogs/maintenance-types',
  title: 'Tipos de Mantenimiento',
  layout: 'main',
  view: 'fleet.catalog.maintenance_types.table',
})

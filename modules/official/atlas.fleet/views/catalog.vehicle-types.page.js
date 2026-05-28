import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.catalog.vehicle_types.page',
  path: '/app/m/atlas.fleet/catalogs/vehicle-types',
  title: 'Tipos de Vehiculo',
  layout: 'main',
  view: 'fleet.catalog.vehicle_types.table',
})

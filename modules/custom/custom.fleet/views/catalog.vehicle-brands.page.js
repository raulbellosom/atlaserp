import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.catalog.vehicle_brands.page',
  path: '/app/m/custom.fleet/catalogs/vehicle-brands',
  title: 'Marcas de Vehiculo',
  layout: 'main',
  view: 'fleet.catalog.vehicle_brands.table',
})

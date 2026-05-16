import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.catalog.vehicle_models.page',
  path: '/app/m/custom.fleet/catalogs/vehicle-models',
  title: 'Modelos de Vehiculo',
  layout: 'main',
  view: 'fleet.catalog.vehicle_models.table',
})

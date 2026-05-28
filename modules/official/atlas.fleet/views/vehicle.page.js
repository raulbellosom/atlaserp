import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.vehicle.page',
  path: '/app/m/atlas.fleet/vehicles',
  title: 'Vehiculos',
  layout: 'main',
  view: 'fleet.vehicle.table',
})

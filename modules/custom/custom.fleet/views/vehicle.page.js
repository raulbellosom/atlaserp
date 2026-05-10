import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.vehicles',
  path: '/app/m/custom.fleet/vehicles',
  title: 'Vehiculos',
  layout: 'main',
  view: 'fleet.vehicle.table',
})

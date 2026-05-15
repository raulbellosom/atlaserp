import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.maintenance.page',
  path: '/app/m/custom.fleet/maintenance',
  title: 'Mantenimiento',
  layout: 'main',
  view: 'fleet.maintenance.table',
})

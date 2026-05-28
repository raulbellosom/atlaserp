import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.driver.page',
  path: '/app/m/atlas.fleet/drivers',
  title: 'Choferes',
  layout: 'main',
  view: 'fleet.driver.table',
})

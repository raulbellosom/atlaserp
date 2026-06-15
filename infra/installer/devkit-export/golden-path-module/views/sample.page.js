import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'goldenpath.sample.page',
  path: '/app/m/custom.goldenpath/samples',
  title: 'Muestras',
  layout: 'main',
  view: 'goldenpath.sample.table',
})

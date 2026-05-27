import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'financia.types.page',
  path: '/app/m/custom.financia/types',
  title: 'Tipos de movimiento',
  layout: 'main',
  view: 'financia.types.table',
})

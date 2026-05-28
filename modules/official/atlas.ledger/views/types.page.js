import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'ledger.types.page',
  path: '/app/m/atlas.ledger/types',
  title: 'Tipos de movimiento',
  layout: 'main',
  view: 'ledger.types.table',
})

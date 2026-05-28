import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'ledger.categories.page',
  path: '/app/m/atlas.ledger/categories',
  title: 'Categorias',
  layout: 'main',
  view: 'ledger.categories.table',
})

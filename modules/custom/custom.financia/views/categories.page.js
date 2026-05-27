import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'financia.categories.page',
  path: '/app/m/custom.financia/categories',
  title: 'Categorias',
  layout: 'main',
  view: 'financia.categories.table',
})

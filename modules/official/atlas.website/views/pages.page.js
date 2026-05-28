import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'website.pages',
  path: '/app/m/atlas.website/pages',
  title: 'Paginas',
  views: ['website.pages.table', 'website.pages.form', 'website.pages.detail'],
})

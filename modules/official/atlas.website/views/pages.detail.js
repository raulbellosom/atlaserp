import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'website.pages.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'website.page',
    apiPath: '/website/pages',
    fields: [
      { name: 'title',       label: 'Titulo' },
      { name: 'route_path',  label: 'Ruta' },
      { name: 'status',      label: 'Estado' },
      { name: 'page_type',   label: 'Tipo' },
      { name: 'visibility',  label: 'Visibilidad' },
      { name: 'published_at', label: 'Publicado en', type: 'datetime' },
    ],
  },
})

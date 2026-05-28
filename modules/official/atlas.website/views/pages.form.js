import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'website.pages.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'website.page',
    apiPath: '/website/pages',
    fields: [
      { name: 'title',      label: 'Titulo',      type: 'text',   required: true },
      { name: 'slug',       label: 'Slug',        type: 'text',   required: true },
      { name: 'route_path', label: 'Ruta',        type: 'text',   required: true },
      { name: 'page_type',  label: 'Tipo',        type: 'select',
        options: ['page', 'landing', 'system'] },
      { name: 'visibility', label: 'Visibilidad', type: 'select',
        options: ['public', 'authenticated', 'private'] },
    ],
  },
})

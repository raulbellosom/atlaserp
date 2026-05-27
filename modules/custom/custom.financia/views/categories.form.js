import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'financia.categories.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'category',
    component: 'AtlasForm',
    apiPath: '/financia/categories',
    fields: [
      { name: 'name',  label: 'Nombre', type: 'text',   required: true },
      { name: 'color', label: 'Color',  type: 'color' },
      { name: 'kind',  label: 'Tipo',   type: 'select', required: true, options: ['income', 'expense', 'both'] },
    ],
  },
})

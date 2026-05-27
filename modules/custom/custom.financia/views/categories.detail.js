import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'financia.categories.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'category',
    apiPath: '/financia/categories',
    sections: [
      {
        title: 'Informacion',
        fields: [
          { name: 'name',  label: 'Nombre', type: 'text' },
          { name: 'kind',  label: 'Tipo',   type: 'text' },
          { name: 'color', label: 'Color',  type: 'color' },
        ],
      },
    ],
  },
})

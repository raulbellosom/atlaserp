import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'financia.categories.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'category',
    component: 'AtlasForm',
    apiPath: '/financia/categories',
    sections: [
      {
        fields: [
          { name: 'name',  label: 'Nombre', type: 'text',      required: true },
          { name: 'color', label: 'Color',  type: 'color' },
          {
            name: 'kind',
            label: 'Tipo',
            type: 'select',
            required: true,
            options: [
              { value: 'income',  label: 'Ingreso'  },
              { value: 'expense', label: 'Egreso'   },
              { value: 'both',    label: 'Ambos'    },
            ],
          },
        ],
      },
    ],
  },
})

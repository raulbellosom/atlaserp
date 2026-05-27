import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'financia.types.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'transaction_type',
    apiPath: '/financia/types',
    sections: [
      {
        title: 'Informacion',
        fields: [
          { name: 'code', label: 'Codigo', type: 'text' },
          { name: 'name', label: 'Nombre', type: 'text' },
        ],
      },
    ],
  },
})

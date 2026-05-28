import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'ledger.types.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'transaction_type',
    apiPath: '/ledger/types',
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

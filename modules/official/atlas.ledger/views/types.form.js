import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'ledger.types.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'transaction_type',
    component: 'AtlasForm',
    apiPath: '/ledger/types',
    sections: [
      {
        fields: [
          { name: 'code', label: 'Codigo', type: 'text', required: true },
          { name: 'name', label: 'Nombre', type: 'text', required: true },
        ],
      },
    ],
  },
})

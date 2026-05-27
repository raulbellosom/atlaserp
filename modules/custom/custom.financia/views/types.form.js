import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'financia.types.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'transaction_type',
    component: 'AtlasForm',
    apiPath: '/financia/types',
    fields: [
      { name: 'code', label: 'Codigo', type: 'text', required: true },
      { name: 'name', label: 'Nombre', type: 'text', required: true },
    ],
  },
})

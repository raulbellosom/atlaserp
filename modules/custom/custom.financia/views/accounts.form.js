import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'financia.accounts.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'account',
    component: 'AtlasForm',
    apiPath: '/financia/accounts',
    sections: [
      {
        fields: [
          { name: 'name',            label: 'Nombre',        type: 'text',    required: true },
          { name: 'bank',            label: 'Banco',         type: 'text',    required: true },
          { name: 'account_number',  label: 'No. de cuenta', type: 'text' },
          { name: 'currency',        label: 'Moneda',        type: 'select',  required: true, options: ['MXN', 'USD'] },
          { name: 'opening_balance', label: 'Saldo inicial', type: 'decimal', required: true },
        ],
      },
    ],
  },
})

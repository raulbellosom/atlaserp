import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'ledger.accounts.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'account',
    apiPath: '/ledger/accounts',
    sections: [
      {
        title: 'Informacion de la cuenta',
        fields: [
          { name: 'name',            label: 'Nombre',         type: 'text' },
          { name: 'bank',            label: 'Banco',          type: 'text' },
          { name: 'account_number',  label: 'No. de cuenta',  type: 'text' },
          { name: 'currency',        label: 'Moneda',         type: 'text' },
          { name: 'opening_balance', label: 'Saldo inicial',  type: 'currency' },
          { name: 'current_balance', label: 'Saldo actual',   type: 'currency' },
          { name: 'enabled',         label: 'Estado',         type: 'boolean' },
        ],
      },
    ],
  },
})

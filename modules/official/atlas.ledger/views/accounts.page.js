import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'ledger.accounts.page',
  path: '/app/m/atlas.ledger/accounts',
  title: 'Cuentas',
  layout: 'main',
  view: 'ledger.accounts.table',
})

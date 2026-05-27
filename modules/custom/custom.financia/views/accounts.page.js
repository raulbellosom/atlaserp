import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'financia.accounts.page',
  path: '/app/m/custom.financia/accounts',
  title: 'Cuentas',
  layout: 'main',
  view: 'financia.accounts.table',
})

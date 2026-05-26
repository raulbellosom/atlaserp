import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.insurance_policy.page',
  path: '/app/m/custom.fleet/insurance',
  title: 'Polizas de seguro',
  layout: 'main',
  view: 'fleet.insurance_policy.table',
})

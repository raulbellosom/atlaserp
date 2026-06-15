import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'goldenpath.dashboard',
  kind: 'CUSTOM',
  version: '0.1.0',
  schema: {
    path: '/app/m/custom.goldenpath/dashboard',
    component: 'custom.goldenpath:ModuleDashboard',
    title: 'Dashboard Golden Path',
  },
})

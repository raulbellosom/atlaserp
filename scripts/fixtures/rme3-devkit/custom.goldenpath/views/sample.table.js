import { defineView } from '@runly/module-engine'

export default defineView({
  key: 'goldenpath.sample.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'sample',
    component: 'RunlyTable',
    apiPath: '/goldenpath/samples',
    columns: [{ field: 'name', label: 'Nombre' }],
  },
})

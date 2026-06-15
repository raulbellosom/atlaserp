import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'goldenpath.sample.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'sample',
    component: 'AtlasTable',
    apiPath: '/goldenpath/samples',
    columns: [{ field: 'name', label: 'Nombre' }],
  },
})

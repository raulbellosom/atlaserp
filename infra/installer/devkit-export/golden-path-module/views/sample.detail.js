import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'goldenpath.sample.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'sample',
    component: 'AtlasDetail',
    apiPath: '/goldenpath/samples',
    sections: [
      {
        title: 'Muestra',
        fields: ['name'],
      },
    ],
  },
})

import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'goldenpath.sample.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'sample',
    component: 'AtlasForm',
    apiPath: '/goldenpath/samples',
    sections: [
      {
        title: 'Muestra',
        fields: [{ field: 'name', label: 'Nombre', type: 'text', required: true }],
      },
    ],
  },
})

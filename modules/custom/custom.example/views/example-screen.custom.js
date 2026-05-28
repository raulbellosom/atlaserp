import { defineView } from '@atlas/module-engine'

export default defineView('custom.example.example-screen', {
  kind: 'CUSTOM',
  schema: {
    path: '/example',
    component: 'custom.example:ExampleScreen',
    title: 'Pantalla de ejemplo',
  },
})

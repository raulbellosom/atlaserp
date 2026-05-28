import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: 'custom.example',
  name: 'Example',
  version: '0.1.0',
  kind: 'FEATURE',
  core: false,
  uninstallable: true,
  navigation: [
    {
      path: '/example',
      label: 'Ejemplo',
      icon: 'Puzzle',
    },
  ],
  permissions: [],
  blueprints: [],
  exposes: [],
  consumes: [],
})

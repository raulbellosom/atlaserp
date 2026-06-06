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
      permissionKey: 'example.access',
    },
  ],
  permissions: [
    { key: 'example.access', name: 'Acceso a Example' },
  ],
  acl: {
    module: 'example.access',
    actions: {
      'example.access': 'example.access',
    },
  },
  blueprints: [],
  exposes: [],
  consumes: [],

  // Offline declaration — controls how this module participates in sync.
  // Remove or set enabled: false to keep a module fully online-only.
  offline: {
    enabled: true,
    models: [],            // replace with actual defineModel() names from this module's models/
    strategy: 'last-write-wins', // 'last-write-wins' | 'server-wins' | 'readonly' | 'conflict-ui'
    allowCreate: true,
    allowUpdate: true,
    allowDelete: false,    // DELETE operations always require connectivity
    maxRecords: 5000,      // safety cap on local IndexedDB cache size
    pullFields: null,      // null = all fields; or ['id', 'name'] to limit payload size
  },
})

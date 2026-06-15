import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: 'custom.goldenpath',
  name: 'Golden Path',
  version: '0.1.0',
  kind: 'FEATURE',
  description: 'Fixture minimo para validar installer mode de AME3.',
  icon: 'Boxes',
  color: '#2563eb',
  pwa: {
    shortName: 'Golden',
    startPath: '/samples',
  },
  dependencies: [{ key: 'atlas.core' }],
  models: [
    './models/sample.model.js',
  ],
  views: [
    './views/sample.table.js',
    './views/sample.form.js',
    './views/sample.detail.js',
    './views/sample.page.js',
    './views/dashboard.custom.js',
  ],
  permissions: [
    { key: 'goldenpath.sample.read', name: 'Ver muestras' },
    { key: 'goldenpath.sample.create', name: 'Crear muestras' },
    { key: 'goldenpath.sample.update', name: 'Editar muestras' },
    { key: 'goldenpath.sample.delete', name: 'Desactivar muestras' },
  ],
  navigation: [
    {
      label: 'Dashboard',
      path: '/app/m/custom.goldenpath/dashboard',
      icon: 'Boxes',
      permissionKey: 'goldenpath.sample.read',
      layout: 'main',
    },
    {
      label: 'Muestras',
      path: '/app/m/custom.goldenpath/samples',
      icon: 'Boxes',
      permissionKey: 'goldenpath.sample.read',
      layout: 'main',
    },
  ],
  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: true,
    supportsDataPurge: true,
    defaultUninstallPolicy: 'purge-owned-tables',
    ownedModels: ['goldenpath.sample'],
    ownedTables: ['goldenpath_sample'],
  },
})

import { createModuleManifest, MODULE_KINDS } from '@atlas/core'

export const atlasCoreMap = createModuleManifest({
  key: 'atlas.core',
  name: 'Atlas Core',
  description: 'Core runtime, registry, permissions, audit and system configuration.',
  version: '0.1.0',
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  navigation: [
    { label: 'Dashboard', path: '/', icon: 'LayoutDashboard', layout: 'main' },
    { label: 'Módulos', path: '/modules', icon: 'Puzzle', layout: 'main' },
    { label: 'Configuración', path: '/settings', icon: 'Settings', layout: 'main' }
  ],
  permissions: [
    { key: 'core.read', name: 'Read Core' },
    { key: 'core.manage', name: 'Manage Core' },
    { key: 'modules.install', name: 'Install modules' },
    { key: 'modules.uninstall', name: 'Uninstall modules' }
  ],
  blueprints: [
    {
      key: 'atlas.module.entity',
      kind: 'ENTITY',
      version: '0.1.0',
      schema: {
        entity: 'AtlasModule',
        label: 'Módulo',
        fields: [
          { name: 'key', label: 'Clave', type: 'text', required: true },
          { name: 'name', label: 'Nombre', type: 'text', required: true },
          { name: 'version', label: 'Versión', type: 'text', required: true },
          { name: 'kind', label: 'Tipo', type: 'select', options: ['CORE', 'FEATURE', 'INTEGRATION', 'WEBSITE'] },
          { name: 'enabled', label: 'Activo', type: 'boolean' }
        ]
      }
    }
  ]
})

export const identityMap = createModuleManifest({
  key: 'atlas.identity',
  name: 'Identidad',
  description: 'Profiles, companies, roles, permissions and memberships.',
  version: '0.1.0',
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  dependencies: [{ key: 'atlas.core' }],
  navigation: [
    { label: 'Usuarios', path: '/identity/users', icon: 'Users', layout: 'main' },
    { label: 'Roles', path: '/identity/roles', icon: 'Shield', layout: 'main' }
  ],
  permissions: [
    { key: 'identity.read', name: 'Read Identity' },
    { key: 'identity.manage', name: 'Manage Identity' }
  ]
})

export const filesMap = createModuleManifest({
  key: 'atlas.files',
  name: 'Archivos',
  description: 'File metadata and storage integration.',
  version: '0.1.0',
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  dependencies: [{ key: 'atlas.core' }],
  permissions: [
    { key: 'files.read', name: 'Read Files' },
    { key: 'files.upload', name: 'Upload Files' },
    { key: 'files.delete', name: 'Delete Files' }
  ]
})

export const coreModules = [atlasCoreMap, identityMap, filesMap]

import { toPascal, moduleSlug, entityRouteBase, permKey, toKebab } from './helpers.js'

export function generateManifest(config) {
  const slug = moduleSlug(config.key)
  const version = config.version || '0.1.0'
  const description = config.description || ''
  const entities = config.entities

  const modelPaths = entities
    .map((e) => `  './models/${e.name}.model.js',`)
    .join('\n')

  const viewPaths = entities
    .flatMap((e) => [
      `  './views/${e.name}.table.js',`,
      `  './views/${e.name}.form.js',`,
      `  './views/${e.name}.detail.js',`,
      `  './views/${e.name}.page.js',`,
    ])
    .join('\n')

  const permissions = entities
    .flatMap((e) => [
      `  { key: '${permKey(slug, e.name, 'read')}',   name: '${buildPermLabel('Ver', e.label)}' },`,
      `  { key: '${permKey(slug, e.name, 'create')}', name: '${buildPermLabel('Crear', e.label)}' },`,
      `  { key: '${permKey(slug, e.name, 'update')}', name: '${buildPermLabel('Editar', e.label)}' },`,
      `  { key: '${permKey(slug, e.name, 'delete')}', name: '${buildPermLabel('Desactivar', e.label)}' },`,
    ])
    .join('\n')

  const navigation = entities
    .map((e) => {
      const path = `/app/m/${config.key}/${slug}-${toKebab(e.name)}s`
      return [
        `  {`,
        `    label: '${e.labelPlural || e.label + 's'}',`,
        `    path: '${path}',`,
        `    icon: '${config.icon}',`,
        `    layout: 'main',`,
        `    permissionKey: '${permKey(slug, e.name, 'read')}',`,
        `  },`,
      ].join('\n')
    })
    .join('\n')

  const ownedModels = entities
    .map((e) => `  '${slug}.${e.name}',`)
    .join('\n')

  const ownedTables = entities
    .map((e) => `  '${slug}_${e.name}',`)
    .join('\n')

  return `import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: '${config.key}',
  name: '${config.name}',
  version: '${version}',
  kind: 'FEATURE',
  description: '${description}',
  icon: '${config.icon}',
  color: '${config.color}',
  pwa: {
    shortName: '${config.pwa.shortName}',
    startPath: '${config.pwa.startPath}',
  },
  dependencies: [{ key: 'atlas.core' }],
  models: [
${modelPaths}
  ],
  views: [
${viewPaths}
  ],
  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: true,
    supportsDataPurge: true,
    defaultUninstallPolicy: 'purge-owned-tables',
    ownedModels: [
${ownedModels}
    ],
    ownedTables: [
${ownedTables}
    ],
  },
  permissions: [
${permissions}
  ],
  navigation: [
${navigation}
  ],
})
`
}

function buildPermLabel(verb, label) {
  return `${verb} ${label.toLowerCase()}`
}

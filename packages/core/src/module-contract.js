export const MODULE_KINDS = {
  CORE: 'CORE',
  FEATURE: 'FEATURE',
  INTEGRATION: 'INTEGRATION',
  WEBSITE: 'WEBSITE'
}

export function createModuleManifest(manifest) {
  if (!manifest?.key) throw new Error('Module manifest requires key')
  if (!manifest?.name) throw new Error(`Module ${manifest.key} requires name`)
  if (!manifest?.version) throw new Error(`Module ${manifest.key} requires version`)
  return {
    kind: MODULE_KINDS.FEATURE,
    core: false,
    uninstallable: true,
    dependencies: [],
    permissions: [],
    navigation: [],
    routes: [],
    blueprints: [],
    exposes: {},
    consumes: {},
    ...manifest
  }
}

import { createModuleComponentRegistry } from './module-component-registry-core.js'

const _isDev = Boolean(import.meta.env?.DEV)

function warnDev(message) {
  if (_isDev) {
    console.warn(`[moduleComponentRegistry] ${message}`)
  }
}

export const componentRegistry = createModuleComponentRegistry({ warn: warnDev })

// Component registration is now done at runtime by ModuleBundleLoader
// via dynamic import() of each installed module's compiled bundle.
// See apps/desktop/src/shell/ModuleBundleLoader.jsx

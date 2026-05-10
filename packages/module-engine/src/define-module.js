import { MODULE_KINDS } from './constants.js'
import { ModuleEngineError } from './errors.js'

const VALID_KINDS = new Set(Object.values(MODULE_KINDS))

const MANIFEST_DEFAULTS = {
  kind:        'FEATURE',
  description: '',
  icon:        'Box',
  color:       null,
  category:    'general',
  dependencies: [],
  permissions:  [],
  navigation:   [],
  acl: {
    module:  null,
    actions: {},
    models:  {},
  },
  lifecycle: {
    installable:            true,
    uninstallable:          true,
    resettable:             false,
    supportsDataPurge:      false,
    defaultUninstallPolicy: 'preserve-data',
    ownedEntities:          [],
    sharedEntities:         [],
  },
}

// Returns { valid: boolean, errors: string[] }. Never throws.
export function validateManifest(manifest) {
  const errors = []

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['manifest must be a plain object'] }
  }

  if (!manifest.key || typeof manifest.key !== 'string' || !manifest.key.trim()) {
    errors.push('key is required and must be a non-empty string')
  } else {
    const key = manifest.key.trim()
    if (key.includes('/') || key.includes('\\') || key.includes('..')) {
      errors.push('key must not contain path traversal characters (/, \\, ..)')
    }
    if (!key.includes('.')) {
      errors.push('key must contain at least one dot separator (e.g. custom.fleet)')
    }
    if (key.split('.').some((s) => s === '')) {
      errors.push('key must not have empty dot-separated segments (no leading/trailing dots)')
    }
  }

  if (!manifest.name || typeof manifest.name !== 'string' || !manifest.name.trim()) {
    errors.push('name is required and must be a non-empty string')
  }

  if (!manifest.version || typeof manifest.version !== 'string' || !manifest.version.trim()) {
    errors.push('version is required and must be a non-empty string')
  } else if (!/^\d+\.\d+\.\d+/.test(manifest.version.trim())) {
    errors.push('version must follow semver format (e.g. 0.1.0)')
  }

  if (manifest.kind !== undefined && !VALID_KINDS.has(manifest.kind)) {
    errors.push(`kind must be one of: ${[...VALID_KINDS].join(', ')}`)
  }

  if (manifest.permissions !== undefined) {
    if (!Array.isArray(manifest.permissions)) {
      errors.push('permissions must be an array')
    } else {
      manifest.permissions.forEach((p, i) => {
        if (!p.key || typeof p.key !== 'string') {
          errors.push(`permissions[${i}].key is required`)
        }
        if (!p.name || typeof p.name !== 'string') {
          errors.push(`permissions[${i}].name is required`)
        }
      })
    }
  }

  if (manifest.navigation !== undefined) {
    if (!Array.isArray(manifest.navigation)) {
      errors.push('navigation must be an array')
    } else {
      manifest.navigation.forEach((n, i) => {
        if (!n.label || typeof n.label !== 'string') {
          errors.push(`navigation[${i}].label is required`)
        }
        if (!n.path || typeof n.path !== 'string' || !n.path.startsWith('/')) {
          errors.push(`navigation[${i}].path must be a string starting with /`)
        }
        if (!n.permissionKey || typeof n.permissionKey !== 'string') {
          errors.push(`navigation[${i}].permissionKey is required`)
        }
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

// Validates and returns the manifest with defaults applied. Throws ModuleEngineError on invalid input.
export function defineAtlasModule(manifest) {
  const { valid, errors } = validateManifest(manifest)
  if (!valid) {
    throw new ModuleEngineError(`Invalid module manifest: ${errors.join('; ')}`, 'AME_INVALID_MANIFEST')
  }
  return {
    ...MANIFEST_DEFAULTS,
    ...manifest,
    acl: { ...MANIFEST_DEFAULTS.acl, ...(manifest.acl ?? {}) },
    lifecycle: { ...MANIFEST_DEFAULTS.lifecycle, ...(manifest.lifecycle ?? {}) },
  }
}

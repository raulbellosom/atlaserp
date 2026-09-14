import { ModuleEngineError } from './errors.js'
import { findModuleByKey } from '@runly/core'

// In-memory registry of module manifests (results of defineAtlasModule).
// The discovery service (Phase 2) will maintain the singleton instance in apps/api.
export class ModuleRegistry {
  #modules = new Map()

  register(manifest) {
    if (!manifest?.key || typeof manifest.key !== 'string') {
      throw new ModuleEngineError('ModuleRegistry.register: manifest.key is required', 'AME_INVALID_MANIFEST')
    }
    if (this.#modules.has(manifest.key)) {
      throw new ModuleEngineError(`ModuleRegistry.register: module "${manifest.key}" is already registered`, 'AME_DUPLICATE_KEY')
    }
    this.#modules.set(manifest.key, manifest)
  }

  get(key) { return findModuleByKey(this.#modules, key) ?? null }
  has(key) { return this.get(key) !== null }
  list()   { return [...this.#modules.values()] }

  unregister(key) { const module = this.get(key); if (module) this.#modules.delete(module.key) }
  clear()         { this.#modules.clear() }
}

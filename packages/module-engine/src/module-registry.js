import { ModuleEngineError } from './errors.js'

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

  get(key) { return this.#modules.get(key) ?? null }
  has(key) { return this.#modules.has(key) }
  list()   { return [...this.#modules.values()] }

  unregister(key) { this.#modules.delete(key) }
  clear()         { this.#modules.clear() }
}

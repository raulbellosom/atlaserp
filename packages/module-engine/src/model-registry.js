import { ModuleEngineError } from './errors.js'

// In-memory registry of model definitions (results of defineModel).
// Keyed by model.key. The Atlas ORM (Phase 3) will query this to know which tables to provision.
export class ModelRegistry {
  #models = new Map()

  register(modelDef) {
    if (!modelDef?.key || typeof modelDef.key !== 'string') {
      throw new ModuleEngineError('ModelRegistry.register: modelDef.key is required', 'AME_INVALID_MODEL')
    }
    if (this.#models.has(modelDef.key)) {
      throw new ModuleEngineError(`ModelRegistry.register: model "${modelDef.key}" is already registered`, 'AME_DUPLICATE_KEY')
    }
    this.#models.set(modelDef.key, modelDef)
  }

  get(key)  { return this.#models.get(key) ?? null }
  has(key)  { return this.#models.has(key) }
  list()    { return [...this.#models.values()] }

  unregister(key) { this.#models.delete(key) }
  clear()         { this.#models.clear() }
}

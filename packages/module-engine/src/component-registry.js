import { ModuleEngineError } from './errors.js'

// Component key format: 'moduleKey:ComponentName'
// ComponentName must start with an uppercase letter (React component convention).
const KEY_RE = /^[a-zA-Z0-9._-]+:[A-Z][a-zA-Z0-9]*$/

// In-memory registry mapping component keys to React component implementations.
// The Route Loader (Phase 4) will populate the singleton instance at boot.
export class ComponentRegistry {
  #entries = new Map()

  register(key, component) {
    if (typeof key !== 'string' || !KEY_RE.test(key)) {
      throw new ModuleEngineError(
        `ComponentRegistry.register: key "${key}" must match moduleKey:ComponentName format (e.g. custom.fleet:VehicleStatusBadge)`,
        'AME_INVALID_COMPONENT_KEY'
      )
    }
    if (this.#entries.has(key)) {
      throw new ModuleEngineError(`ComponentRegistry.register: key "${key}" is already registered`, 'AME_DUPLICATE_KEY')
    }
    this.#entries.set(key, component)
  }

  resolve(key)    { return this.#entries.get(key) ?? null }
  has(key)        { return this.#entries.has(key) }
  list()          { return [...this.#entries.keys()] }
  unregister(key) { this.#entries.delete(key) }
  clear()         { this.#entries.clear() }
}

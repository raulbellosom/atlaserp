export class ModuleRegistry {
  constructor() {
    this.modules = new Map()
  }

  register(manifest) {
    if (this.modules.has(manifest.key)) {
      throw new Error(`Module already registered: ${manifest.key}`)
    }
    this.modules.set(manifest.key, manifest)
    return manifest
  }

  list() {
    return Array.from(this.modules.values())
  }

  get(key) {
    return this.modules.get(key)
  }

  resolveNavigation() {
    return this.list()
      .filter((module) => module.enabled !== false)
      .flatMap((module) => module.navigation ?? [])
  }

  resolveBlueprints() {
    return this.list().flatMap((module) => module.blueprints ?? [])
  }

  assertDependencies() {
    for (const module of this.list()) {
      for (const dependency of module.dependencies ?? []) {
        if (!dependency.optional && !this.modules.has(dependency.key)) {
          throw new Error(`Module ${module.key} requires ${dependency.key}`)
        }
      }
    }
  }
}

export class ModuleRegistry {
  constructor() {
    this.modules = new Map();
  }

  register(manifest) {
    if (this.modules.has(manifest.key)) {
      throw new Error(`Module already registered: ${manifest.key}`);
    }
    this.modules.set(manifest.key, manifest);
    return manifest;
  }

  list() {
    return Array.from(this.modules.values());
  }

  get(key) {
    return this.modules.get(key);
  }

  resolveNavigation() {
    return this.list()
      .filter((module) => module.enabled !== false)
      .flatMap((module) => module.navigation ?? []);
  }

  resolveBlueprints() {
    return this.list().flatMap((module) => module.blueprints ?? []);
  }

  assertDependencies() {
    for (const module of this.list()) {
      for (const dependency of module.dependencies ?? []) {
        if (!dependency.optional && !this.modules.has(dependency.key)) {
          throw new Error(`Module ${module.key} requires ${dependency.key}`);
        }
      }
    }
  }

  /**
   * Returns modules grouped by category, suitable for the app launcher.
   * Each group: { category, modules: [...] }
   */
  resolveLauncher() {
    const enabled = this.list().filter((m) => m.enabled !== false);
    const groups = {};
    for (const mod of enabled) {
      const cat = mod.category ?? "general";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(mod);
    }
    return Object.entries(groups).map(([category, modules]) => ({
      category,
      modules,
    }));
  }

  /**
   * Given a URL path, returns the module whose navigation paths match.
   * Matches by prefix so /app/m/atlas.contacts/list matches atlas.contacts.
   */
  getModuleByPath(path) {
    // Check for /app/m/:moduleKey pattern first
    const match = path.match(/\/app\/m\/([^/]+)/);
    if (match) return this.get(match[1]) ?? null;
    // Fallback: check navigation paths
    for (const mod of this.list()) {
      for (const nav of mod.navigation ?? []) {
        if (path === nav.path || path.startsWith(nav.path + "/")) return mod;
      }
    }
    return null;
  }
}

function normalizeKey(value) {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return key.length > 0 ? key : null;
}

export function createModuleComponentRegistry(options = {}) {
  const store = new Map();
  const activeModuleKeys = new Set();
  const listeners = new Set();
  let version = 0;
  const warn = typeof options.warn === "function" ? options.warn : () => {};

  function notify() {
    version += 1;
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // ignore listener errors
      }
    }
  }

  return {
    register(key, component) {
      const normalizedKey = normalizeKey(key);
      if (!normalizedKey) {
        warn("Skipped registration with empty or invalid key.");
        return;
      }
      if (component == null) {
        warn(
          `Skipped registration for "${normalizedKey}" because component is nullish.`,
        );
        return;
      }
      if (store.has(normalizedKey)) {
        warn(
          `Duplicate registration for "${normalizedKey}". Replacing previous component.`,
        );
      }
      store.set(normalizedKey, component);
      notify();
    },

    resolve(key) {
      const normalizedKey = normalizeKey(key);
      if (!normalizedKey) return null;
      if (normalizedKey.includes(":")) {
        const [moduleKey] = normalizedKey.split(":");
        if (activeModuleKeys.size > 0 && !activeModuleKeys.has(moduleKey)) {
          return null;
        }
      }
      return store.get(normalizedKey) ?? null;
    },

    has(key) {
      const normalizedKey = normalizeKey(key);
      return normalizedKey ? store.has(normalizedKey) : false;
    },

    list() {
      return Array.from(store.keys());
    },

    setActiveModules(moduleKeys) {
      activeModuleKeys.clear();
      if (!Array.isArray(moduleKeys)) return;
      for (const key of moduleKeys) {
        const normalizedKey = normalizeKey(key);
        if (!normalizedKey) continue;
        activeModuleKeys.add(normalizedKey);
      }
      notify();
    },

    subscribe(listener) {
      if (typeof listener !== "function") {
        return () => {};
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getVersion() {
      return version;
    },
  };
}

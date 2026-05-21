// Boot-time component registry for the desktop shell.
// Custom modules can contribute visual components by exporting:
//   export function register(registry) { ... }
// from modules/custom/*/components/index.js.

const _store = new Map();
const _isDev = Boolean(import.meta.env?.DEV);
const _activeModuleKeys = new Set();

function warnDev(message) {
  if (_isDev) {
    console.warn(`[moduleComponentRegistry] ${message}`);
  }
}

export const componentRegistry = {
  // Conflict behavior: last registration wins. We keep running and warn in dev
  // so one misconfigured module does not prevent app boot.
  register(key, component) {
    if (typeof key !== "string" || key.length === 0) {
      warnDev("Skipped registration with empty or invalid key.");
      return;
    }
    if (component == null) {
      warnDev(`Skipped registration for "${key}" because component is nullish.`);
      return;
    }
    if (_store.has(key)) {
      warnDev(`Duplicate registration for "${key}". Replacing previous component.`);
    }
    _store.set(key, component);
  },
  resolve(key) {
    if (typeof key === "string" && key.includes(":")) {
      const [moduleKey] = key.split(":");
      if (_activeModuleKeys.size > 0 && !_activeModuleKeys.has(moduleKey)) {
        return null;
      }
    }
    return _store.get(key) ?? null;
  },
  has(key) {
    return _store.has(key);
  },
  list() {
    return Array.from(_store.keys());
  },
  setActiveModules(moduleKeys) {
    _activeModuleKeys.clear();
    if (!Array.isArray(moduleKeys)) return;
    for (const key of moduleKeys) {
      if (typeof key !== "string" || key.trim().length === 0) continue;
      _activeModuleKeys.add(key.trim());
    }
  },
};

const componentModules = import.meta.glob(
  [
    "../../../../modules/custom/*/components/index.js",
    "../../../../modules/official/*/components/index.js",
  ],
  { eager: true },
);

for (const [modulePath, mod] of Object.entries(componentModules)) {
  try {
    const register = mod?.register;
    if (typeof register === "function") {
      register(componentRegistry);
      continue;
    }
    warnDev(`Skipped "${modulePath}" because it does not export a register() function.`);
  } catch (_error) {
    // Intentionally avoid leaking internal stack traces to end users.
    warnDev(`Failed to register components from "${modulePath}".`);
  }
}

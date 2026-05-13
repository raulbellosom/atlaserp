// Boot-time component registry for the desktop shell.
// Custom modules can contribute visual components by exporting:
//   export function register(registry) { ... }
// from modules/custom/*/components/index.js.

const _store = new Map();
const _isDev = Boolean(import.meta.env?.DEV);

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
    return _store.get(key) ?? null;
  },
  has(key) {
    return _store.has(key);
  },
  list() {
    return Array.from(_store.keys());
  },
};

const componentModules = import.meta.glob(
  "../../../../modules/custom/*/components/index.js",
  {
    eager: true,
  },
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

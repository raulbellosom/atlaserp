// Boot-time component registry for the desktop shell.
// Custom modules can contribute visual components by exporting:
//   export function register(registry) { ... }
// from modules/custom/*/components/index.js.
import { createModuleComponentRegistry } from "./module-component-registry-core.js";

const _isDev = Boolean(import.meta.env?.DEV);

function warnDev(message) {
  if (_isDev) {
    console.warn(`[moduleComponentRegistry] ${message}`);
  }
}

export const componentRegistry = createModuleComponentRegistry({ warn: warnDev });

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

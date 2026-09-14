import { mergeRuntimeModules as mergeModules } from './runtime-modules-core.js';
export * from './runtime-modules-core.js';

// Auto-import all AME3 custom module manifests bundled with the desktop app.
// Local metadata remains available to the module catalog. The authenticated
// runtime explicitly prefers API navigation because it is permission-filtered.
const _ame3ModuleFiles = import.meta.glob(
  "../../../../modules/custom/*/module.manifest.js",
  { eager: true },
);
const _ame3Manifests = Object.values(_ame3ModuleFiles)
  .map((mod) => mod?.default ?? null)
  .filter((m) => m && typeof m === "object" && m.key);

export function mergeRuntimeModules(rawApiModules, options = {}) {
  return mergeModules(rawApiModules, { ...options, manifests: _ame3Manifests });
}

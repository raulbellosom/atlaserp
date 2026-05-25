import { coreModules } from "../manifests/official/core-modules.js";
import { featureModules } from "../manifests/official/feature-modules.js";

export function listOfficialModuleManifests() {
  return [...coreModules, ...featureModules];
}

import { listOfficialModuleManifests } from "../apps/api/src/services/module-manifests-service.js";
import { PERMISSION_CATALOG } from "../apps/api/src/permission-catalog.js";

const officialModuleManifests = listOfficialModuleManifests();

const manifestPermissionKeys = [
  ...new Set(
    officialModuleManifests.flatMap((manifest) =>
      (manifest.permissions ?? []).map((permission) => permission.key),
    ),
  ),
].sort();

const catalogKeys = Object.keys(PERMISSION_CATALOG).sort();
const missingInCatalog = manifestPermissionKeys.filter(
  (key) => !PERMISSION_CATALOG[key],
);
const extraInCatalog = catalogKeys.filter(
  (key) => !manifestPermissionKeys.includes(key),
);

const report = {
  manifest_permissions: manifestPermissionKeys.length,
  catalog_permissions: catalogKeys.length,
  missing_in_catalog: missingInCatalog.length,
  extra_in_catalog: extraInCatalog.length,
};

console.log(JSON.stringify(report, null, 2));

if (missingInCatalog.length > 0) {
  console.log("\nPermisos faltantes en catalogo:");
  for (const key of missingInCatalog) console.log(`- ${key}`);
}

if (extraInCatalog.length > 0) {
  console.log("\nPermisos extra en catalogo (no declarados en manifiestos):");
  for (const key of extraInCatalog) console.log(`- ${key}`);
}

if (missingInCatalog.length > 0 || extraInCatalog.length > 0) {
  process.exitCode = 1;
}

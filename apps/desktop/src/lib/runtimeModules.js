import { coreModules, featureModules } from "@atlas/maps";

const MANIFESTS = [...coreModules, ...featureModules];

const STATUS_ORDER = {
  INSTALLED: 0,
  DISABLED: 1,
  UNINSTALLED: 2,
  ERROR: 3,
};

export const CATEGORY_LABELS = {
  sistema: "Sistema",
  operaciones: "Operaciones",
  contabilidad: "Contabilidad",
  general: "General",
};

function getManifestsByKey() {
  return new Map(MANIFESTS.map((manifest) => [manifest.key, manifest]));
}

function normalizeApiRows(raw) {
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw)) return raw;
  return [];
}

function normalizeLayoutMode(value) {
  if (value === "no-sidebar" || value === "custom" || value === "default") {
    return value;
  }
  return "default";
}

function normalizeModuleNavigationPath(moduleKey, path) {
  const rawPath = String(path ?? "").trim();
  if (!rawPath) return "/";
  if (rawPath === "/") return "/";

  const withSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const modulePrefix = `/app/m/${moduleKey}`;

  if (withSlash === modulePrefix) return "/";
  if (withSlash.startsWith(`${modulePrefix}/`)) {
    const relative = withSlash.slice(modulePrefix.length);
    return relative.startsWith("/") ? relative : `/${relative}`;
  }

  return withSlash;
}

function normalizeModuleNavigation(moduleKey, navigation) {
  const rows = Array.isArray(navigation) ? navigation : [];
  return rows
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return {
        ...item,
        path: normalizeModuleNavigationPath(moduleKey, item.path),
      };
    })
    .filter(Boolean);
}

export function mergeRuntimeModules(rawApiModules, options = {}) {
  const { includeManifestFallback = true } = options;
  const manifestsByKey = getManifestsByKey();
  const apiRows = normalizeApiRows(rawApiModules);
  const apiByKey = new Map(apiRows.map((row) => [row.key, row]));
  const allKeys = includeManifestFallback
    ? new Set([...manifestsByKey.keys(), ...apiByKey.keys()])
    : new Set([...apiByKey.keys()]);

  const merged = Array.from(allKeys).map((key) => {
    const manifest = manifestsByKey.get(key) ?? null;
    const apiRow = apiByKey.get(key) ?? null;

    const core = apiRow?.core ?? manifest?.core ?? false;
    const uninstallable =
      apiRow?.uninstallable ?? manifest?.uninstallable ?? !core;
    const status = apiRow?.status ?? (core ? "INSTALLED" : "UNINSTALLED");
    const enabled =
      typeof apiRow?.enabled === "boolean" ? apiRow.enabled : core;

    const manifestFallback = apiRow?.manifest ?? {};
    const navigationSource =
      manifest?.navigation ?? manifestFallback.navigation ?? [];
    const navigation = normalizeModuleNavigation(key, navigationSource);

    const layoutMode = normalizeLayoutMode(
      manifest?.layoutMode ?? manifestFallback.layoutMode,
    );
    const description =
      apiRow?.description ??
      manifest?.description ??
      manifestFallback.description ??
      null;
    const summary =
      manifest?.summary ??
      manifestFallback.summary ??
      description ??
      "";

    return {
      id: apiRow?.id ?? null,
      key,
      name: apiRow?.name ?? manifest?.name ?? key,
      description,
      summary,
      icon: manifest?.icon ?? manifestFallback.icon ?? "Box",
      logoUrl: manifest?.logoUrl ?? manifestFallback.logoUrl ?? null,
      color:
        manifest?.color ?? manifestFallback.color ?? "var(--brand-primary)",
      category: manifest?.category ?? manifestFallback.category ?? "general",
      navigation,
      dependencies:
        manifest?.dependencies ?? manifestFallback.dependencies ?? [],
      layoutMode,
      version: apiRow?.version ?? manifest?.version ?? "0.0.0",
      kind: apiRow?.kind ?? manifest?.kind ?? "FEATURE",
      core: Boolean(core),
      uninstallable: Boolean(uninstallable),
      status,
      enabled: Boolean(enabled),
      manifest: apiRow?.manifest ?? manifest ?? null,
      installedAt: apiRow?.installedAt ?? null,
      updatedAt: apiRow?.updatedAt ?? null,
      compatibility: apiRow?.compatibility ?? [],
      compatibilityStatus: apiRow?.compatibilityStatus ?? "OK",
      compatibilityBlocking: apiRow?.compatibilityBlocking ?? [],
    };
  });

  return merged.sort((a, b) => {
    if (a.core !== b.core) return a.core ? -1 : 1;
    const byStatus =
      (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (byStatus !== 0) return byStatus;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
}

export function isModuleAvailable(module) {
  return module?.status === "INSTALLED" && module?.enabled === true;
}

export function getAvailableModules(modules) {
  return (modules ?? []).filter(isModuleAvailable);
}

export function groupModulesByCategory(modules) {
  const groups = {};
  for (const module of modules ?? []) {
    const category = module.category ?? "general";
    if (!groups[category]) groups[category] = [];
    groups[category].push(module);
  }
  return groups;
}

export function getModuleLaunchPath(module) {
  const firstNav = module?.navigation?.[0];
  if (!module) return "/app/home";
  if (firstNav && firstNav.path !== "/") return `/app/m/${module.key}${firstNav.path}`;
  return `/app/m/${module.key}`;
}

export function getModuleByKey(modules, key) {
  return (modules ?? []).find((module) => module.key === key) ?? null;
}

export function getLayoutMode(module) {
  return normalizeLayoutMode(module?.layoutMode);
}

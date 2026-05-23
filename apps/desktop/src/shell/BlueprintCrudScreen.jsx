import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Plus } from "lucide-react";
import {
  AtlasCrudView,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  normalizeSpanishLabel,
} from "@atlas/ui";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useRuntimeModules } from "../app/useRuntimeModules";
import { atlas } from "../lib/atlas";
import { isModuleAvailable } from "../lib/runtimeModules";
import { componentRegistry } from "../lib/moduleComponentRegistry";

const API_BASE_URL =
  import.meta.env.VITE_ATLAS_API_URL || "http://localhost:4010";

function normalizePath(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text === "/") return "/";
  const withSlash = text.startsWith("/") ? text : `/${text}`;
  return withSlash.replace(/\/+$/, "");
}

function normalizeKind(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function getBlueprintKind(row) {
  return normalizeKind(row?.kind ?? row?.type);
}

function getLastSegment(path) {
  const normalized = normalizePath(path);
  if (!normalized || normalized === "/") return "";
  const parts = normalized.split("/").filter(Boolean);
  return String(parts.at(-1) ?? "").toLowerCase();
}

function collapseWildcardPath(moduleKey, wildcard) {
  const raw = String(wildcard ?? "").trim();
  const normalized = raw.replace(/^\/+/, "");
  const duplicatedPrefixes = [
    `app/m/${moduleKey}/`,
    `m/${moduleKey}/`,
    `${moduleKey}/`,
  ];
  let collapsed = normalized;
  for (const prefix of duplicatedPrefixes) {
    if (collapsed.startsWith(prefix)) {
      collapsed = collapsed.slice(prefix.length);
      break;
    }
  }
  return collapsed.replace(/^\/+/, "");
}

function parseModeFromSegments(segments) {
  let initialMode = "list";
  let recordId = null;

  if (segments[0] === "new") {
    initialMode = "create";
  } else if (segments[0] && segments[1] === "edit") {
    initialMode = "edit";
    recordId = segments[0];
  } else if (segments[0]) {
    initialMode = "detail";
    recordId = segments[0];
  }

  return { initialMode, recordId };
}

function parseFallbackRouteInfo(moduleKey, wildcard) {
  const cleanPath = collapseWildcardPath(moduleKey, wildcard);
  const segments = cleanPath.split("/").filter(Boolean);
  const second = String(segments[1] ?? "").toLowerCase();
  const isCrudToken = second === "new" || second === "edit";
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      second,
    );
  const hasNestedCollection = segments.length >= 2 && !isCrudToken && !isUuid;
  const collectionPath = hasNestedCollection
    ? `${String(segments[0] ?? "").toLowerCase()}/${String(segments[1] ?? "").toLowerCase()}`
    : String(segments[0] ?? "").toLowerCase();
  const modeSegments = hasNestedCollection ? segments.slice(2) : segments.slice(1);
  const { initialMode, recordId } = parseModeFromSegments(modeSegments);
  const moduleRoutePath = collectionPath
    ? `/app/m/${moduleKey}/${collectionPath}`
    : `/app/m/${moduleKey}`;

  return {
    entitySegment: getLastSegment(collectionPath),
    collectionPath,
    moduleRoutePath,
    initialMode,
    recordId,
    pageMatch: null,
  };
}

function getPagePath(row) {
  return normalizePath(row?.schema?.path ?? row?.schema?.page?.path);
}

function resolveRouteInfo({ moduleKey, wildcard, pathname, moduleRows }) {
  const fallback = parseFallbackRouteInfo(moduleKey, wildcard);
  const normalizedPathname = normalizePath(pathname);
  if (!normalizedPathname || !moduleKey) return fallback;

  const pageMatches = moduleRows
    .filter((row) => getBlueprintKind(row) === "PAGE")
    .map((row) => ({ row, path: getPagePath(row) }))
    .filter(({ path }) => path)
    .filter(
      ({ path }) =>
        normalizedPathname === path || normalizedPathname.startsWith(`${path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length);

  const bestMatch = pageMatches[0];
  if (!bestMatch) return fallback;

  const moduleRoot = normalizePath(`/app/m/${moduleKey}`);
  const collectionPath = bestMatch.path
    .slice(moduleRoot.length)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  const suffix = normalizedPathname
    .slice(bestMatch.path.length)
    .replace(/^\/+/, "");
  const { initialMode, recordId } = parseModeFromSegments(
    suffix.split("/").filter(Boolean),
  );

  return {
    entitySegment: getLastSegment(collectionPath),
    collectionPath,
    moduleRoutePath: bestMatch.path,
    initialMode,
    recordId,
    pageMatch: bestMatch.row,
  };
}

function matchesEntity(blueprint, entitySegment) {
  if (!entitySegment) return false;
  const schema = blueprint?.schema ?? {};
  const apiPath = normalizePath(schema.apiPath);
  const apiLastSegment = getLastSegment(apiPath);
  const entity = String(schema.entity ?? "")
    .trim()
    .toLowerCase();
  if (apiLastSegment && apiLastSegment === entitySegment) return true;
  if (apiPath && apiPath.includes(`/${entitySegment}`)) return true;
  if (entity && (entity === entitySegment || `${entity}s` === entitySegment))
    return true;
  return false;
}

function matchesCollectionPath(blueprint, collectionPath) {
  if (!collectionPath) return false;
  const normalizedCollection = String(collectionPath).trim().toLowerCase();
  const schema = blueprint?.schema ?? {};
  const apiPath = normalizePath(schema.apiPath).toLowerCase();
  if (apiPath.endsWith(`/${normalizedCollection}`)) return true;
  if (apiPath.includes(`/${normalizedCollection}/`)) return true;
  return false;
}

function selectBlueprints({ moduleRows, routeInfo }) {
  const tableRows = moduleRows.filter(
    (row) => getBlueprintKind(row) === "TABLE",
  );
  const formRows = moduleRows.filter(
    (row) => getBlueprintKind(row) === "FORM",
  );
  const detailRows = moduleRows.filter(
    (row) => getBlueprintKind(row) === "DETAIL",
  );
  const pageMatch = routeInfo.pageMatch;

  const findByKey = (key) =>
    moduleRows.find(
      (row) => String(row?.key ?? "").trim() === String(key ?? "").trim(),
    ) ?? null;

  const findSiblingBySuffix = (baseBlueprint, suffix) => {
    const baseKey = String(baseBlueprint?.key ?? "").trim();
    if (!baseKey || !baseKey.includes(".")) return null;
    const normalizedSuffix = String(suffix ?? "").trim();
    if (!normalizedSuffix) return null;
    const siblingKey = baseKey.replace(/\.[^.]+$/, `.${normalizedSuffix}`);
    return findByKey(siblingKey);
  };

  let tableBlueprint = null;
  const pageViewKey = pageMatch?.schema?.view ?? pageMatch?.schema?.page?.view;
  if (pageViewKey) tableBlueprint = findByKey(pageViewKey);
  const pageTableKey =
    pageMatch?.schema?.table ?? pageMatch?.schema?.page?.table;
  if (!tableBlueprint && pageTableKey) tableBlueprint = findByKey(pageTableKey);
  if (!tableBlueprint) {
    tableBlueprint =
      tableRows.find((row) =>
        matchesCollectionPath(row, routeInfo.collectionPath),
      ) ?? null;
  }
  if (!tableBlueprint) {
    tableBlueprint =
      tableRows.find((row) => matchesEntity(row, routeInfo.entitySegment)) ??
      null;
  }

  if (!tableBlueprint) {
    return { tableBlueprint: null, formBlueprint: null, detailBlueprint: null };
  }

  const tableApiPath = normalizePath(tableBlueprint.schema?.apiPath);
  const tableEntity = String(tableBlueprint.schema?.entity ?? "")
    .trim()
    .toLowerCase();
  const matchesTable = (row) => {
    const candidateApiPath = normalizePath(row?.schema?.apiPath);
    const candidateEntity = String(row?.schema?.entity ?? "")
      .trim()
      .toLowerCase();
    if (tableApiPath && candidateApiPath && tableApiPath === candidateApiPath)
      return true;
    if (tableEntity && candidateEntity && tableEntity === candidateEntity)
      return true;
    return false;
  };

  const formBlueprint =
    findSiblingBySuffix(tableBlueprint, "form") ??
    formRows.find(matchesTable) ??
    formRows.find((row) =>
      matchesCollectionPath(row, routeInfo.collectionPath),
    ) ??
    formRows.find((row) => matchesEntity(row, routeInfo.entitySegment)) ??
    null;
  const detailBlueprint =
    findSiblingBySuffix(tableBlueprint, "detail") ??
    detailRows.find(matchesTable) ??
    detailRows.find((row) =>
      matchesCollectionPath(row, routeInfo.collectionPath),
    ) ??
    detailRows.find((row) => matchesEntity(row, routeInfo.entitySegment)) ??
    null;

  return { tableBlueprint, formBlueprint, detailBlueprint };
}

function extractFields(tableBlueprint, formBlueprint, detailBlueprint) {
  const candidates = [tableBlueprint, formBlueprint, detailBlueprint];
  for (const blueprint of candidates) {
    if (Array.isArray(blueprint?.fields) && blueprint.fields.length > 0)
      return blueprint.fields;
    if (
      Array.isArray(blueprint?.schema?.fields) &&
      blueprint.schema.fields.length > 0
    )
      return blueprint.schema.fields;
  }
  return undefined;
}

function resolveNavItem(module, moduleRoutePath, collectionPath, entitySegment) {
  const nav = module?.navigation ?? module?.manifest?.navigation ?? [];
  if (!Array.isArray(nav) || nav.length === 0) return null;
  const normalizedRoute = normalizePath(moduleRoutePath);
  const exact = nav.find(
    (item) => normalizePath(item?.path ?? "") === normalizedRoute,
  );
  if (exact) return exact;
  if (collectionPath) {
    const normalizedCollection = normalizePath(`/${collectionPath}`);
    const byCollection = nav.find((item) =>
      normalizePath(item?.path ?? "").endsWith(normalizedCollection),
    );
    if (byCollection) return byCollection;
  }
  if (entitySegment) {
    const partial = nav.find((item) =>
      normalizePath(item?.path ?? "")
        .split("/")
        .includes(entitySegment),
    );
    if (partial) return partial;
  }
  return null;
}

function resolvePageTitle(tableBlueprint, navItem) {
  const blueprintTitle =
    tableBlueprint?.schema?.title ?? tableBlueprint?.title ?? null;
  if (blueprintTitle) return blueprintTitle;
  if (navItem?.label) return navItem.label;
  return "Registros";
}

function resolveEmptyLabel(entitySegment, navItem) {
  if (navItem?.label) return navItem.label;
  if (entitySegment)
    return entitySegment.charAt(0).toUpperCase() + entitySegment.slice(1);
  return null;
}

function resolvePageDescription(tableBlueprint, module) {
  const blueprintDesc =
    tableBlueprint?.schema?.description ?? tableBlueprint?.description ?? null;
  if (blueprintDesc) return blueprintDesc;
  return module?.description ?? module?.manifest?.description ?? null;
}

function getModuleRootPath(moduleKey) {
  return normalizePath(`/app/m/${moduleKey}`);
}

function resolveGroupSegment(collectionPath) {
  const normalized = String(collectionPath ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  if (!normalized) return null;
  return normalized.split("/").filter(Boolean)[0] ?? null;
}

function resolveCollectionPathFromPagePath(moduleKey, pagePath) {
  const normalizedPagePath = normalizePath(pagePath);
  const moduleRoot = getModuleRootPath(moduleKey);
  if (!normalizedPagePath || !moduleRoot) return "";
  if (!normalizedPagePath.startsWith(moduleRoot)) return "";
  return normalizedPagePath
    .slice(moduleRoot.length)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function resolveGroupedTabs({ moduleRows, moduleKey, routeInfo, pathname }) {
  const groupSegment = resolveGroupSegment(routeInfo.collectionPath);
  if (!groupSegment) return null;

  const pageEntries = moduleRows
    .filter((row) => getBlueprintKind(row) === "PAGE")
    .map((row, index) => {
      const path = getPagePath(row);
      const collectionPath = resolveCollectionPathFromPagePath(moduleKey, path);
      const tabOrderRaw = row?.schema?.tabOrder;
      const tabOrder =
        Number.isFinite(tabOrderRaw) || typeof tabOrderRaw === "number"
          ? Number(tabOrderRaw)
          : Number.POSITIVE_INFINITY;
      const label =
        row?.schema?.tabLabel ??
        row?.schema?.title ??
        row?.title ??
        row?.name ??
        collectionPath;
      return {
        index,
        path,
        collectionPath,
        groupSegment: resolveGroupSegment(collectionPath),
        tabOrder,
        label: normalizeSpanishLabel(String(label ?? "").trim()),
      };
    })
    .filter((entry) => entry.path && entry.collectionPath);

  const tabs = pageEntries
    .filter(
      (entry) =>
        entry.groupSegment === groupSegment && entry.collectionPath !== groupSegment,
    )
    .sort((a, b) => {
      if (a.tabOrder !== b.tabOrder) return a.tabOrder - b.tabOrder;
      return a.index - b.index;
    });

  if (tabs.length <= 1) return null;

  const moduleRoot = getModuleRootPath(moduleKey);
  const basePath = normalizePath(`${moduleRoot}/${groupSegment}`);
  const normalizedPathname = normalizePath(pathname);
  const activeTab =
    tabs.find(
      (tab) =>
        normalizedPathname === tab.path ||
        normalizedPathname.startsWith(`${tab.path}/`),
    ) ?? tabs[0];

  return {
    basePath,
    defaultPath: tabs[0].path,
    shouldRedirect: normalizedPathname === basePath,
    activePath: activeTab.path,
    tabs: tabs.map((tab) => ({ path: tab.path, label: tab.label })),
  };
}

function isNamespacedComponentKey(value) {
  if (typeof value !== "string") return false;
  return /^[a-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(value.trim());
}

function collectNamespacedComponentKeys(input, found = new Set()) {
  if (Array.isArray(input)) {
    for (const value of input) collectNamespacedComponentKeys(value, found);
    return found;
  }
  if (!input || typeof input !== "object") {
    if (isNamespacedComponentKey(input)) found.add(String(input).trim());
    return found;
  }

  for (const value of Object.values(input)) {
    if (isNamespacedComponentKey(value)) {
      found.add(String(value).trim());
      continue;
    }
    if (value && typeof value === "object") {
      collectNamespacedComponentKeys(value, found);
    }
  }

  return found;
}

function collectMissingComponentReferences({ blueprints, registry }) {
  const missing = new Map();
  if (!registry || !Array.isArray(blueprints)) return [];

  for (const blueprint of blueprints) {
    const componentKeys = collectNamespacedComponentKeys(blueprint?.schema ?? {});
    for (const componentKey of componentKeys) {
      if (registry.resolve(componentKey)) continue;
      if (!missing.has(componentKey)) {
        missing.set(componentKey, new Set());
      }
      missing.get(componentKey).add(blueprint?.key ?? "unknown");
    }
  }

  return [...missing.entries()].map(([componentKey, blueprintKeys]) => ({
    componentKey,
    blueprintKeys: [...blueprintKeys],
  }));
}

export function BlueprintCrudScreen() {
  const { moduleKey, "*": wildcard } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const { moduleMap } = useRuntimeModules();
  const module = moduleMap.get(moduleKey) ?? null;
  const moduleName = module?.name ?? module?.manifest?.name ?? moduleKey ?? "";

  useEffect(() => {
    const activeKeys = [];
    for (const row of moduleMap.values()) {
      if (isModuleAvailable(row)) {
        activeKeys.push(row.key);
      }
    }
    componentRegistry.setActiveModules(activeKeys);
  }, [moduleMap]);

  const blueprintsQuery = useQuery({
    queryKey: ["blueprints", moduleKey, token],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
    staleTime: 30000,
  });

  const moduleRows = useMemo(() => {
    const rows = Array.isArray(blueprintsQuery.data?.data)
      ? blueprintsQuery.data.data
      : [];
    return rows.filter(
      (row) => row?.source === "atlas-view" && row?.moduleKey === moduleKey,
    );
  }, [blueprintsQuery.data, moduleKey]);

  const routeInfo = useMemo(
    () =>
      resolveRouteInfo({
        moduleKey,
        wildcard,
        pathname: location.pathname,
        moduleRows,
      }),
    [location.pathname, moduleKey, moduleRows, wildcard],
  );

  const selection = useMemo(
    () => selectBlueprints({ moduleRows, routeInfo }),
    [moduleRows, routeInfo],
  );

  const fields = useMemo(
    () =>
      extractFields(
        selection.tableBlueprint,
        selection.formBlueprint,
        selection.detailBlueprint,
      ),
    [
      selection.detailBlueprint,
      selection.formBlueprint,
      selection.tableBlueprint,
    ],
  );

  const missingComponentRefs = useMemo(
    () =>
      collectMissingComponentReferences({
        blueprints: [
          selection.tableBlueprint,
          selection.formBlueprint,
          selection.detailBlueprint,
        ].filter(Boolean),
        registry: componentRegistry,
      }),
    [
      selection.detailBlueprint,
      selection.formBlueprint,
      selection.tableBlueprint,
    ],
  );

  const navItem = useMemo(
    () =>
      resolveNavItem(
        module,
        routeInfo.moduleRoutePath,
        routeInfo.collectionPath,
        routeInfo.entitySegment,
      ),
    [
      module,
      routeInfo.collectionPath,
      routeInfo.entitySegment,
      routeInfo.moduleRoutePath,
    ],
  );

  const groupedTabs = useMemo(
    () =>
      resolveGroupedTabs({
        moduleRows,
        moduleKey,
        routeInfo,
        pathname: location.pathname,
      }),
    [location.pathname, moduleKey, moduleRows, routeInfo],
  );

  useEffect(() => {
    if (!groupedTabs?.shouldRedirect || !groupedTabs.defaultPath) return;
    navigate(groupedTabs.defaultPath, { replace: true });
  }, [groupedTabs?.defaultPath, groupedTabs?.shouldRedirect, navigate]);

  const locationPathnameRef = useRef(location.pathname);
  locationPathnameRef.current = location.pathname;

  const handleNavigate = useCallback(
    ({ mode, recordId }) => {
      const basePath =
        routeInfo.moduleRoutePath ||
        (routeInfo.collectionPath
          ? `/app/m/${moduleKey}/${routeInfo.collectionPath}`
          : null);
      if (!basePath) return;

      let targetPath = basePath;
      if (mode === "create") {
        targetPath = `${basePath}/new`;
      } else if ((mode === "detail" || mode === "edit") && recordId) {
        targetPath = `${basePath}/${encodeURIComponent(String(recordId))}`;
        if (mode === "edit") targetPath = `${targetPath}/edit`;
      }

      if (targetPath !== locationPathnameRef.current) {
        navigate(targetPath, { replace: true });
      }
    },
    [
      moduleKey,
      navigate,
      routeInfo.collectionPath,
      routeInfo.moduleRoutePath,
    ],
  );

  const handleCreateSuccess = useCallback(() => {
    toast.success("Registro creado correctamente.");
  }, []);

  const handleEditSuccess = useCallback(() => {
    toast.success("Cambios guardados correctamente.");
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    toast.success("Registro eliminado.");
  }, []);

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No hay sesión activa.</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (module && !isModuleAvailable(module)) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Módulo no disponible"
          description="Este módulo no está habilitado en la instancia actual."
        />
      </div>
    );
  }

  if (blueprintsQuery.isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex-1 p-4 md:p-6 space-y-6">
          <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-28 shrink-0 sm:mt-1" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 flex-1 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="ml-auto h-8 w-24 rounded-xl" />
            </div>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="bg-[hsl(var(--muted))]/40 px-4 py-3 flex gap-4 border-b border-[hsl(var(--border))]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={`h-4 ${i === 4 ? "w-8 shrink-0" : "flex-1"}`}
                />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="px-4 py-3 border-b border-[hsl(var(--border))] last:border-0 flex gap-4"
              >
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton
                    key={j}
                    className={`h-4 ${j === 4 ? "w-8 shrink-0" : "flex-1"}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (blueprintsQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="No se pudieron cargar las vistas del módulo"
          description="Verifica tu conexión e intenta de nuevo."
          onRetry={() => blueprintsQuery.refetch()}
        />
      </div>
    );
  }

  if (groupedTabs?.shouldRedirect && groupedTabs.defaultPath) {
    return null;
  }

  if (!selection.tableBlueprint) {
    const emptyLabel = normalizeSpanishLabel(
      resolveEmptyLabel(routeInfo.entitySegment, navItem),
    );
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Vista no encontrada"
          description={
            emptyLabel
              ? `No se encontró una vista para "${emptyLabel}". Verifica que el módulo tenga blueprints configurados.`
              : "Esta ruta no tiene blueprints configurados."
          }
        />
      </div>
    );
  }

  const pageTitle = normalizeSpanishLabel(
    resolvePageTitle(selection.tableBlueprint, navItem),
  );
  const pageDescription = normalizeSpanishLabel(
    resolvePageDescription(selection.tableBlueprint, module),
  );

  const canCreate =
    Boolean(selection.formBlueprint) && routeInfo.initialMode === "list";
  const createLabel = normalizeSpanishLabel(
    selection.tableBlueprint?.schema?.actions?.[0]?.label ?? "Agregar",
  );
  const createPath = routeInfo.moduleRoutePath
    ? `${routeInfo.moduleRoutePath}/new`
    : null;

  return (
    <div className="flex flex-col">
      <div className="p-4 md:p-6 space-y-6">
        {groupedTabs?.tabs?.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {groupedTabs.tabs.map((tab) => {
              const isActive = tab.path === groupedTabs.activePath;
              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => navigate(tab.path)}
                  className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <PageHeader
          eyebrow={moduleName || undefined}
          title={pageTitle}
          description={pageDescription || undefined}
          actions={
            canCreate && createPath ? (
              <Button onClick={() => navigate(createPath)}>
                <Plus className="mr-2 h-4 w-4" />
                {createLabel}
              </Button>
            ) : undefined
          }
        />

        {missingComponentRefs.length > 0 ? (
          <Card className="border-amber-400/40 bg-amber-50/60">
            <CardHeader>
              <CardTitle>
                Componentes de m&oacute;dulo no disponibles (requiere rebuild)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Se detectaron componentes referenciados por blueprints que no est&aacute;n en el bundle actual. Reinstala o reconstruye la app para incluirlos.
              </p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {missingComponentRefs.map((entry) => (
                  <p key={entry.componentKey}>
                    <strong>{entry.componentKey}</strong> · vistas:{" "}
                    {entry.blueprintKeys.join(", ")}
                  </p>
                ))}
              </div>
            </CardHeader>
          </Card>
        ) : null}

        <AtlasCrudView
          tableBlueprint={selection.tableBlueprint}
          formBlueprint={selection.formBlueprint}
          detailBlueprint={selection.detailBlueprint}
          fields={fields}
          token={token}
          apiBaseUrl={API_BASE_URL}
          componentRegistry={componentRegistry}
          module={module}
          suppressToolbarCreate
          initialMode={routeInfo.initialMode}
          recordId={routeInfo.recordId}
          onNavigate={handleNavigate}
          onCreateSuccess={handleCreateSuccess}
          onEditSuccess={handleEditSuccess}
          onDeleteSuccess={handleDeleteSuccess}
        />
      </div>
    </div>
  );
}

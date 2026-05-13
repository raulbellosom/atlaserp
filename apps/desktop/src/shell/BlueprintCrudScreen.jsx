import { useCallback, useMemo } from "react";
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

function getLastSegment(path) {
  const normalized = normalizePath(path);
  if (!normalized || normalized === "/") return "";
  const parts = normalized.split("/").filter(Boolean);
  return String(parts.at(-1) ?? "").toLowerCase();
}

function parseRouteInfo(moduleKey, wildcard) {
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
  const cleanPath = collapsed.replace(/^\/+/, "");
  const segments = cleanPath.split("/").filter(Boolean);
  const entitySegment = String(segments[0] ?? "").toLowerCase();
  const moduleRoutePath = entitySegment
    ? `/app/m/${moduleKey}/${cleanPath}`
    : `/app/m/${moduleKey}`;

  let initialMode = "list";
  let recordId = null;
  if (segments[1] === "new") {
    initialMode = "create";
  } else if (segments[1] && segments[2] === "edit") {
    initialMode = "edit";
    recordId = segments[1];
  } else if (segments[1]) {
    initialMode = "detail";
    recordId = segments[1];
  }

  return { entitySegment, moduleRoutePath, initialMode, recordId };
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

function selectBlueprints({ rows, moduleKey, moduleRoutePath, entitySegment }) {
  const moduleRows = rows.filter(
    (row) => row?.source === "atlas-view" && row?.moduleKey === moduleKey,
  );
  const tableRows = moduleRows.filter(
    (row) => normalizeKind(row?.kind) === "TABLE",
  );
  const formRows = moduleRows.filter(
    (row) => normalizeKind(row?.kind) === "FORM",
  );
  const detailRows = moduleRows.filter(
    (row) => normalizeKind(row?.kind) === "DETAIL",
  );
  const pageRows = moduleRows.filter(
    (row) => normalizeKind(row?.kind) === "PAGE",
  );

  const normalizedRoutePath = normalizePath(moduleRoutePath);
  const pagePathOf = (row) =>
    normalizePath(row?.schema?.path ?? row?.schema?.page?.path);
  const pageMatch = pageRows.find(
    (row) => pagePathOf(row) === normalizedRoutePath,
  );

  const findByKey = (key) =>
    moduleRows.find(
      (row) => String(row?.key ?? "").trim() === String(key ?? "").trim(),
    ) ?? null;

  let tableBlueprint = null;
  const pageViewKey = pageMatch?.schema?.view ?? pageMatch?.schema?.page?.view;
  if (pageViewKey) tableBlueprint = findByKey(pageViewKey);
  const pageTableKey =
    pageMatch?.schema?.table ?? pageMatch?.schema?.page?.table;
  if (!tableBlueprint && pageTableKey) tableBlueprint = findByKey(pageTableKey);
  if (!tableBlueprint) {
    tableBlueprint =
      tableRows.find((row) => matchesEntity(row, entitySegment)) ?? null;
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
    formRows.find(matchesTable) ??
    formRows.find((row) => matchesEntity(row, entitySegment)) ??
    null;
  const detailBlueprint =
    detailRows.find(matchesTable) ??
    detailRows.find((row) => matchesEntity(row, entitySegment)) ??
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

function resolveNavItem(module, moduleRoutePath, entitySegment) {
  const nav = module?.navigation ?? module?.manifest?.navigation ?? [];
  if (!Array.isArray(nav) || nav.length === 0) return null;
  const normalizedRoute = normalizePath(moduleRoutePath);
  const exact = nav.find(
    (item) => normalizePath(item?.path ?? "") === normalizedRoute,
  );
  if (exact) return exact;
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

export function BlueprintCrudScreen() {
  const { moduleKey, "*": wildcard } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const { moduleMap } = useRuntimeModules();
  const module = moduleMap.get(moduleKey) ?? null;
  const moduleName = module?.name ?? module?.manifest?.name ?? moduleKey ?? "";

  const routeInfo = useMemo(
    () => parseRouteInfo(moduleKey, wildcard),
    [moduleKey, wildcard],
  );

  const blueprintsQuery = useQuery({
    queryKey: ["blueprints", moduleKey, token],
    queryFn: () => atlas.blueprints.list(token),
    enabled: Boolean(token),
    staleTime: 30000,
  });

  const selection = useMemo(() => {
    const rows = Array.isArray(blueprintsQuery.data?.data)
      ? blueprintsQuery.data.data
      : [];
    return selectBlueprints({
      rows,
      moduleKey,
      moduleRoutePath: routeInfo.moduleRoutePath,
      entitySegment: routeInfo.entitySegment,
    });
  }, [
    blueprintsQuery.data,
    moduleKey,
    routeInfo.entitySegment,
    routeInfo.moduleRoutePath,
  ]);

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

  const navItem = useMemo(
    () =>
      resolveNavItem(
        module,
        routeInfo.moduleRoutePath,
        routeInfo.entitySegment,
      ),
    [module, routeInfo.entitySegment, routeInfo.moduleRoutePath],
  );

  const handleNavigate = useCallback(
    ({ mode, recordId }) => {
      const entity =
        routeInfo.entitySegment ||
        getLastSegment(selection.tableBlueprint?.schema?.apiPath);
      if (!entity) return;

      const basePath = `/app/m/${moduleKey}/${entity}`;
      let targetPath = basePath;
      if (mode === "create") {
        targetPath = `${basePath}/new`;
      } else if ((mode === "detail" || mode === "edit") && recordId) {
        targetPath = `${basePath}/${encodeURIComponent(String(recordId))}`;
        if (mode === "edit") targetPath = `${targetPath}/edit`;
      }

      if (targetPath !== location.pathname) {
        navigate(targetPath, { replace: true });
      }
    },
    [
      location.pathname,
      moduleKey,
      navigate,
      routeInfo.entitySegment,
      selection.tableBlueprint?.schema?.apiPath,
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

  const entitySegment =
    routeInfo.entitySegment ||
    getLastSegment(selection.tableBlueprint?.schema?.apiPath);
  const canCreate =
    Boolean(selection.formBlueprint) && routeInfo.initialMode === "list";
  const createLabel = normalizeSpanishLabel(
    selection.tableBlueprint?.schema?.actions?.[0]?.label ?? "Agregar",
  );
  const createPath = entitySegment
    ? `/app/m/${moduleKey}/${entitySegment}/new`
    : null;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
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

        <AtlasCrudView
          tableBlueprint={selection.tableBlueprint}
          formBlueprint={selection.formBlueprint}
          detailBlueprint={selection.detailBlueprint}
          fields={fields}
          token={token}
          apiBaseUrl={API_BASE_URL}
          componentRegistry={componentRegistry}
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

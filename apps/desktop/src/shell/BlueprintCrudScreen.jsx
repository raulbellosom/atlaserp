import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AtlasCrudView, Card, CardContent, CardHeader, CardTitle } from "@atlas/ui";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useRuntimeModules } from "../app/useRuntimeModules";
import { atlas } from "../lib/atlas";
import { isModuleAvailable } from "../lib/runtimeModules";

const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || "http://localhost:4010";

function normalizePath(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text === "/") return "/";
  const withSlash = text.startsWith("/") ? text : `/${text}`;
  return withSlash.replace(/\/+$/, "");
}

function normalizeKind(value) {
  return String(value ?? "").trim().toUpperCase();
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
  const duplicatedPrefix = `app/m/${moduleKey}/`;
  const collapsed = normalized.startsWith(duplicatedPrefix)
    ? normalized.slice(duplicatedPrefix.length)
    : normalized;
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

  return {
    entitySegment,
    moduleRoutePath,
    initialMode,
    recordId,
  };
}

function matchesEntity(blueprint, entitySegment) {
  if (!entitySegment) return false;
  const schema = blueprint?.schema ?? {};
  const apiPath = normalizePath(schema.apiPath);
  const apiLastSegment = getLastSegment(apiPath);
  const entity = String(schema.entity ?? "").trim().toLowerCase();

  if (apiLastSegment && apiLastSegment === entitySegment) return true;
  if (apiPath && apiPath.includes(`/${entitySegment}`)) return true;
  if (entity && (entity === entitySegment || `${entity}s` === entitySegment)) {
    return true;
  }
  return false;
}

function selectBlueprints({ rows, moduleKey, moduleRoutePath, entitySegment }) {
  const moduleRows = rows.filter(
    (row) => row?.source === "atlas-view" && row?.moduleKey === moduleKey,
  );
  const tableRows = moduleRows.filter((row) => normalizeKind(row?.kind) === "TABLE");
  const formRows = moduleRows.filter((row) => normalizeKind(row?.kind) === "FORM");
  const detailRows = moduleRows.filter((row) => normalizeKind(row?.kind) === "DETAIL");
  const pageRows = moduleRows.filter((row) => normalizeKind(row?.kind) === "PAGE");

  const normalizedRoutePath = normalizePath(moduleRoutePath);
  const pageMatch = pageRows.find(
    (row) => normalizePath(row?.schema?.path) === normalizedRoutePath,
  );

  const findByKey = (key) =>
    moduleRows.find((row) => String(row?.key ?? "").trim() === String(key ?? "").trim()) ?? null;

  let tableBlueprint = null;
  if (pageMatch?.schema?.view) {
    tableBlueprint = findByKey(pageMatch.schema.view);
  }
  if (!tableBlueprint && pageMatch?.schema?.table) {
    tableBlueprint = findByKey(pageMatch.schema.table);
  }
  if (!tableBlueprint) {
    tableBlueprint = tableRows.find((row) => matchesEntity(row, entitySegment)) ?? tableRows[0] ?? null;
  }

  const tableApiPath = normalizePath(tableBlueprint?.schema?.apiPath);
  const tableEntity = String(tableBlueprint?.schema?.entity ?? "").trim().toLowerCase();
  const matchesTable = (row) => {
    const candidateApiPath = normalizePath(row?.schema?.apiPath);
    const candidateEntity = String(row?.schema?.entity ?? "").trim().toLowerCase();
    if (tableApiPath && candidateApiPath && tableApiPath === candidateApiPath) return true;
    if (tableEntity && candidateEntity && tableEntity === candidateEntity) return true;
    return false;
  };

  const formBlueprint =
    formRows.find(matchesTable) ??
    formRows.find((row) => matchesEntity(row, entitySegment)) ??
    formRows[0] ??
    null;
  const detailBlueprint =
    detailRows.find(matchesTable) ??
    detailRows.find((row) => matchesEntity(row, entitySegment)) ??
    detailRows[0] ??
    null;

  return { tableBlueprint, formBlueprint, detailBlueprint };
}

function extractFields(tableBlueprint, formBlueprint, detailBlueprint) {
  const candidates = [tableBlueprint, formBlueprint, detailBlueprint];
  for (const blueprint of candidates) {
    if (Array.isArray(blueprint?.fields) && blueprint.fields.length > 0) {
      return blueprint.fields;
    }
    if (Array.isArray(blueprint?.schema?.fields) && blueprint.schema.fields.length > 0) {
      return blueprint.schema.fields;
    }
  }
  return undefined;
}

export function BlueprintCrudScreen() {
  const { moduleKey, "*": wildcard } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const { moduleMap } = useRuntimeModules();
  const module = moduleMap.get(moduleKey) ?? null;

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
    [selection.detailBlueprint, selection.formBlueprint, selection.tableBlueprint],
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
        if (mode === "edit") {
          targetPath = `${targetPath}/edit`;
        }
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
      <Card>
        <CardHeader>
          <CardTitle>Módulo no disponible</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (blueprintsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando vistas del módulo...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (blueprintsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No se pudieron cargar las vistas del módulo.</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => blueprintsQuery.refetch()}
          >
            Reintentar
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!selection.tableBlueprint) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No se encontró una vista para este módulo.</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <AtlasCrudView
      tableBlueprint={selection.tableBlueprint}
      formBlueprint={selection.formBlueprint}
      detailBlueprint={selection.detailBlueprint}
      fields={fields}
      token={token}
      apiBaseUrl={API_BASE_URL}
      initialMode={routeInfo.initialMode}
      recordId={routeInfo.recordId}
      onNavigate={handleNavigate}
    />
  );
}

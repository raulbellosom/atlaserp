import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/Sheet.jsx";
import { AtlasDetail } from "./AtlasDetail.jsx";
import { AtlasForm } from "./AtlasForm.jsx";
import { AtlasTable } from "./AtlasTable.jsx";

const MODES = new Set(["list", "create", "detail", "edit"]);

function joinUrl(baseUrl, apiPath) {
  const base = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  const path = String(apiPath ?? "").trim();
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function getApiPath(blueprint) {
  const schema = blueprint?.schema ?? {};
  return typeof schema.apiPath === "string" ? schema.apiPath.trim() : "";
}

function resolveIdFromRow(row) {
  if (!row || typeof row !== "object") return null;
  return row.id ?? row.recordId ?? row.uuid ?? row.ID ?? null;
}

export function AtlasCrudView({
  tableBlueprint,
  formBlueprint,
  detailBlueprint,
  fields,
  token,
  apiBaseUrl,
  initialMode = "list",
  recordId = null,
  onNavigate,
}) {
  const tableApiPath = getApiPath(tableBlueprint);
  const resolvedInitialMode = MODES.has(initialMode) ? initialMode : "list";

  const [mode, setMode] = useState(resolvedInitialMode);
  const [activeRecordId, setActiveRecordId] = useState(recordId ?? null);
  const [recordData, setRecordData] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);

  const shouldOpenSheet = mode === "create" || mode === "detail" || mode === "edit";
  const currentDetailBlueprint = detailBlueprint ?? tableBlueprint;
  const currentFormBlueprint = formBlueprint ?? tableBlueprint;

  useEffect(() => {
    setMode(resolvedInitialMode);
  }, [resolvedInitialMode]);

  useEffect(() => {
    setActiveRecordId(recordId ?? null);
  }, [recordId]);

  useEffect(() => {
    onNavigate?.({
      mode,
      recordId: activeRecordId ?? null,
    });
  }, [activeRecordId, mode, onNavigate]);

  const fetchRecord = useMemo(() => {
    return async (nextRecordId) => {
      if (!tableApiPath || !nextRecordId) return;
      setLoadingRecord(true);
      setRecordError("");
      try {
        const endpoint = `${joinUrl(apiBaseUrl, tableApiPath)}/${encodeURIComponent(String(nextRecordId))}`;
        const response = await fetch(endpoint, {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          const text = await response.text();
          let message = "No se pudo cargar el registro.";
          try {
            const parsed = text ? JSON.parse(text) : null;
            if (parsed?.error) message = parsed.error;
          } catch {
            if (text) message = text;
          }
          throw new Error(message);
        }
        const payload = await response.json();
        setRecordData(payload?.data ?? null);
      } catch (err) {
        setRecordData(null);
        setRecordError(err instanceof Error ? err.message : "No se pudo cargar el registro.");
      } finally {
        setLoadingRecord(false);
      }
    };
  }, [apiBaseUrl, tableApiPath, token]);

  useEffect(() => {
    if ((mode === "detail" || mode === "edit") && activeRecordId) {
      fetchRecord(activeRecordId);
      return;
    }
    setRecordData(null);
    setRecordError("");
    setLoadingRecord(false);
  }, [activeRecordId, fetchRecord, mode]);

  const closeSheet = () => {
    setMode("list");
    setRecordError("");
    setLoadingRecord(false);
  };

  const openCreate = () => {
    if (!currentFormBlueprint) return;
    setMode("create");
  };

  const openDetail = (row) => {
    const nextId = resolveIdFromRow(row);
    if (!nextId) return;
    setActiveRecordId(nextId);
    setMode("detail");
  };

  const openEdit = (row) => {
    const nextId = resolveIdFromRow(row);
    if (!nextId) return;
    setActiveRecordId(nextId);
    setMode("edit");
  };

  const handleFormSuccess = () => {
    setMode("list");
    setActiveRecordId(null);
    setRefreshSignal((current) => current + 1);
  };

  if (!tableApiPath) {
    return (
      <Alert variant="warning">
        <AlertTitle>Vista sin configuración</AlertTitle>
        <AlertDescription>
          La vista de tabla no tiene <code>schema.apiPath</code>. No se puede renderizar el CRUD.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <AtlasTable
        blueprint={tableBlueprint}
        token={token}
        apiBaseUrl={apiBaseUrl}
        onCreate={currentFormBlueprint ? openCreate : undefined}
        onView={currentDetailBlueprint ? openDetail : undefined}
        onEdit={currentFormBlueprint ? openEdit : undefined}
        refreshSignal={refreshSignal}
      />

      <Sheet
        open={shouldOpenSheet}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          {mode === "create" && currentFormBlueprint && (
            <>
              <SheetHeader>
                <SheetTitle>{currentFormBlueprint?.title ?? "Nuevo registro"}</SheetTitle>
                <SheetDescription>Completa la información y guarda los cambios.</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <AtlasForm
                  blueprint={currentFormBlueprint}
                  fields={fields}
                  initialData={{}}
                  mode="create"
                  token={token}
                  apiBaseUrl={apiBaseUrl}
                  onSuccess={handleFormSuccess}
                  onCancel={closeSheet}
                />
              </div>
            </>
          )}

          {mode === "detail" && currentDetailBlueprint && (
            <>
              <SheetHeader>
                <SheetTitle>{currentDetailBlueprint?.title ?? "Detalle"}</SheetTitle>
                <SheetDescription>Información del registro seleccionado.</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                {loadingRecord && (
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                )}
                {!loadingRecord && recordError && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{recordError}</AlertDescription>
                  </Alert>
                )}
                {!loadingRecord && !recordError && recordData && (
                  <AtlasDetail
                    blueprint={currentDetailBlueprint}
                    fields={fields}
                    data={recordData}
                    onBack={closeSheet}
                    onEdit={currentFormBlueprint ? () => setMode("edit") : undefined}
                  />
                )}
              </div>
            </>
          )}

          {mode === "edit" && currentFormBlueprint && (
            <>
              <SheetHeader>
                <SheetTitle>{currentFormBlueprint?.title ?? "Editar registro"}</SheetTitle>
                <SheetDescription>Actualiza la información del registro.</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                {loadingRecord && (
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                )}
                {!loadingRecord && recordError && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{recordError}</AlertDescription>
                  </Alert>
                )}
                {!loadingRecord && !recordError && recordData && (
                  <AtlasForm
                    blueprint={currentFormBlueprint}
                    fields={fields}
                    initialData={recordData}
                    mode="edit"
                    token={token}
                    apiBaseUrl={apiBaseUrl}
                    onSuccess={handleFormSuccess}
                    onCancel={closeSheet}
                  />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

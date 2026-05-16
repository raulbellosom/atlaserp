import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
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
import {
  shouldUsePageMode,
  resolveAccentColor,
  resolveFormMode,
} from "./renderer-adapters.js";

const MODES = new Set(["list", "create", "detail", "edit"]);

function joinUrl(baseUrl, apiPath) {
  const base = String(baseUrl ?? "")
    .trim()
    .replace(/\/+$/, "");
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

function resolveRowLabel(row) {
  if (!row || typeof row !== "object") return null;
  return (
    row.name ??
    row.nombre ??
    row.title ??
    row.titulo ??
    row.description ??
    row.plate ??
    row.placa ??
    row.code ??
    row.codigo ??
    String(row.id ?? "este registro")
  );
}

export function AtlasCrudView({
  tableBlueprint,
  formBlueprint,
  detailBlueprint,
  fields,
  token,
  apiBaseUrl,
  componentRegistry = null,
  suppressToolbarCreate = false,
  initialMode = "list",
  recordId = null,
  module = null,
  onNavigate,
  onCreateSuccess,
  onEditSuccess,
  onDeleteSuccess,
}) {
  const tableApiPath = getApiPath(tableBlueprint);
  const resolvedInitialMode = MODES.has(initialMode) ? initialMode : "list";
  const accentColor = resolveAccentColor(module, tableBlueprint);

  const currentFormBlueprint = formBlueprint ?? tableBlueprint;
  const currentDetailBlueprint = detailBlueprint ?? tableBlueprint;
  const formMode = useMemo(
    () => resolveFormMode(currentFormBlueprint?.schema),
    [currentFormBlueprint],
  );

  const pageMode = useMemo(
    () =>
      formMode === "page"
        ? true
        : formMode === "sheet"
          ? false
          : shouldUsePageMode(currentFormBlueprint?.schema, fields),
    [currentFormBlueprint, fields, formMode],
  );

  const [mode, setMode] = useState(resolvedInitialMode);
  const [activeRecordId, setActiveRecordId] = useState(recordId ?? null);
  const [recordData, setRecordData] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const shouldOpenSheet =
    !pageMode && (mode === "create" || mode === "detail" || mode === "edit");
  const showPageContent =
    mode === "create" || mode === "detail" || mode === "edit";

  useEffect(() => {
    setMode(resolvedInitialMode);
  }, [resolvedInitialMode]);

  useEffect(() => {
    setActiveRecordId(recordId ?? null);
  }, [recordId]);

  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  });

  useEffect(() => {
    onNavigateRef.current?.({ mode, recordId: activeRecordId ?? null });
  }, [activeRecordId, mode]);

  const fetchRecord = useCallback(
    async (nextRecordId) => {
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
        setRecordError(
          err instanceof Error ? err.message : "No se pudo cargar el registro.",
        );
      } finally {
        setLoadingRecord(false);
      }
    },
    [apiBaseUrl, tableApiPath, token],
  );

  useEffect(() => {
    if ((mode === "detail" || mode === "edit") && activeRecordId) {
      fetchRecord(activeRecordId);
      return;
    }
    setRecordData(null);
    setRecordError("");
    setLoadingRecord(false);
  }, [activeRecordId, fetchRecord, mode]);

  const goToList = () => {
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

  const requestDelete = (row) => {
    setPendingDeleteRow(row);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    const id = resolveIdFromRow(pendingDeleteRow);
    if (!id || !tableApiPath) return;
    setDeleting(true);
    try {
      const endpoint = `${joinUrl(apiBaseUrl, tableApiPath)}/${encodeURIComponent(String(id))}`;
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const text = await response.text();
        let message = "No se pudo eliminar el registro.";
        try {
          const parsed = text ? JSON.parse(text) : null;
          if (parsed?.error) message = parsed.error;
        } catch {
          if (text) message = text;
        }
        throw new Error(message);
      }
      setDeleteConfirmOpen(false);
      setPendingDeleteRow(null);
      setRefreshSignal((c) => c + 1);
      onDeleteSuccess?.();
    } catch (err) {
      setRecordError(
        err instanceof Error ? err.message : "No se pudo eliminar el registro.",
      );
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleFormSuccess = (result) => {
    const wasCreate = mode === "create";
    goToList();
    setActiveRecordId(null);
    setRefreshSignal((c) => c + 1);
    if (wasCreate) onCreateSuccess?.(result);
    else onEditSuccess?.(result);
  };

  const renderRecordLoadingOrError = () => {
    if (loadingRecord) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }
    if (recordError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{recordError}</AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  if (!tableApiPath) {
    return (
      <Alert variant="warning">
        <AlertTitle>Vista sin configuración</AlertTitle>
        <AlertDescription>
          La vista de tabla no tiene <code>schema.apiPath</code>. No se puede
          renderizar el CRUD.
        </AlertDescription>
      </Alert>
    );
  }

  const deleteLabel = pendingDeleteRow ? resolveRowLabel(pendingDeleteRow) : "";

  return (
    <div className="space-y-4">
      {/* Page mode: show form/detail directly in page, hide table */}
      {pageMode && showPageContent ? (
        <div className="space-y-4">
          {mode === "create" && currentFormBlueprint && (
            <>
              <PageHeader
                eyebrow="Nuevo registro"
                title={
                  currentFormBlueprint?.schema?.title ??
                  currentFormBlueprint?.title ??
                  "Nuevo registro"
                }
                actions={
                  <Button variant="outline" size="sm" onClick={goToList}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Volver
                  </Button>
                }
              />
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                <AtlasForm
                  blueprint={currentFormBlueprint}
                  fields={fields}
                  initialData={{}}
                  mode="create"
                  token={token}
                  apiBaseUrl={apiBaseUrl}
                  onSuccess={handleFormSuccess}
                  onCancel={goToList}
                />
              </div>
            </>
          )}

          {mode === "detail" && currentDetailBlueprint && (
            <>
              <PageHeader
                eyebrow="Detalle"
                title={
                  currentDetailBlueprint?.schema?.title ??
                  currentDetailBlueprint?.title ??
                  "Detalle"
                }
                actions={
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToList}>
                      <ArrowLeft className="mr-1.5 h-4 w-4" />
                      Volver
                    </Button>
                    {currentFormBlueprint && (
                      <Button size="sm" onClick={() => setMode("edit")}>
                        Editar
                      </Button>
                    )}
                  </div>
                }
              />
              {renderRecordLoadingOrError() ??
                (recordData && (
                  <AtlasDetail
                    blueprint={currentDetailBlueprint}
                    fields={fields}
                    data={recordData}
                    accentColor={accentColor}
                    token={token}
                    apiBaseUrl={apiBaseUrl}
                  />
                ))}
            </>
          )}

          {mode === "edit" && currentFormBlueprint && (
            <>
              <PageHeader
                eyebrow="Editar registro"
                title={
                  currentFormBlueprint?.schema?.title ??
                  currentFormBlueprint?.title ??
                  "Editar registro"
                }
                actions={
                  <Button variant="outline" size="sm" onClick={goToList}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Volver
                  </Button>
                }
              />
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                {renderRecordLoadingOrError() ??
                  (recordData && (
                    <AtlasForm
                      blueprint={currentFormBlueprint}
                      fields={fields}
                      initialData={recordData}
                      mode="edit"
                      token={token}
                      apiBaseUrl={apiBaseUrl}
                      onSuccess={handleFormSuccess}
                      onCancel={goToList}
                    />
                  ))}
              </div>
            </>
          )}
        </div>
      ) : (
        /* Normal mode: table always visible, sheet for create/detail/edit */
        <>
          <AtlasTable
            blueprint={tableBlueprint}
            token={token}
            apiBaseUrl={apiBaseUrl}
            componentRegistry={componentRegistry}
            accentColor={accentColor}
            onCreate={
              !suppressToolbarCreate && currentFormBlueprint
                ? openCreate
                : undefined
            }
            onView={currentDetailBlueprint ? openDetail : undefined}
            onEdit={currentFormBlueprint ? openEdit : undefined}
            onDelete={requestDelete}
            refreshSignal={refreshSignal}
          />

          <Sheet
            open={shouldOpenSheet}
            onOpenChange={(open) => {
              if (!open && !pageMode) goToList();
            }}
          >
            <SheetContent side="right" className="w-full sm:max-w-2xl">
              {mode === "create" && currentFormBlueprint && (
                <>
                  <SheetHeader>
                    <SheetTitle>
                      {currentFormBlueprint?.title ?? "Nuevo registro"}
                    </SheetTitle>
                    <SheetDescription>
                      Completa la información y guarda los cambios.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 max-h-[calc(100dvh-11rem)] overflow-y-auto pr-1">
                    <AtlasForm
                      blueprint={currentFormBlueprint}
                      fields={fields}
                      initialData={{}}
                      mode="create"
                      token={token}
                      apiBaseUrl={apiBaseUrl}
                      onSuccess={handleFormSuccess}
                      onCancel={goToList}
                    />
                  </div>
                </>
              )}

              {mode === "detail" && currentDetailBlueprint && (
                <>
                  <SheetHeader>
                    <SheetTitle>
                      {currentDetailBlueprint?.title ?? "Detalle"}
                    </SheetTitle>
                    <SheetDescription>
                      Información del registro seleccionado.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 max-h-[calc(100dvh-11rem)] overflow-y-auto pr-1">
                    {renderRecordLoadingOrError() ??
                      (recordData && (
                        <AtlasDetail
                          blueprint={currentDetailBlueprint}
                          fields={fields}
                          data={recordData}
                          accentColor={accentColor}
                          token={token}
                          apiBaseUrl={apiBaseUrl}
                          onEdit={
                            currentFormBlueprint
                              ? () => setMode("edit")
                              : undefined
                          }
                        />
                      ))}
                  </div>
                </>
              )}

              {mode === "edit" && currentFormBlueprint && (
                <>
                  <SheetHeader>
                    <SheetTitle>
                      {currentFormBlueprint?.title ?? "Editar registro"}
                    </SheetTitle>
                    <SheetDescription>
                      Actualiza la información del registro.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 max-h-[calc(100dvh-11rem)] overflow-y-auto pr-1">
                    {renderRecordLoadingOrError() ??
                      (recordData && (
                        <AtlasForm
                          blueprint={currentFormBlueprint}
                          fields={fields}
                          initialData={recordData}
                          mode="edit"
                          token={token}
                          apiBaseUrl={apiBaseUrl}
                          onSuccess={handleFormSuccess}
                          onCancel={goToList}
                        />
                      ))}
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </>
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar registro"
        description="Esta acción no se puede deshacer. ¿Deseas continuar?"
        detail={deleteLabel || undefined}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

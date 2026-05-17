import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  File,
  FileImage,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./Alert.jsx";
import { Button } from "./Button.jsx";
import { Input } from "./Input.jsx";
import { FileViewer } from "./FileViewer.jsx";
import { useAttachmentsController } from "../hooks/useAttachmentsController.js";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(sizeBytes) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizePlacement(value) {
  const placement = String(value ?? "embedded").trim().toLowerCase();
  return placement === "aside" ? "aside" : "embedded";
}

function statusLabel(status) {
  switch (status) {
    case "uploading":
      return "Subiendo...";
    case "attaching":
      return "Asociando...";
    case "success":
      return "Completado";
    case "error":
      return "Error";
    default:
      return "Pendiente";
  }
}

function ItemIcon({ mimeType }) {
  if (String(mimeType ?? "").startsWith("image/")) {
    return <FileImage className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

function ItemCard({ item, children }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2">
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt={item.fileName}
              className="h-10 w-10 rounded-md border border-[hsl(var(--border))] object-cover"
            />
          ) : (
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
              <ItemIcon mimeType={item.mimeType} />
            </span>
          )}
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
              {item.fileName ?? "Archivo no disponible"}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {item.documentType || "Sin categoría"}
              {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ""}
              {item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ""}
            </p>
            {item.label ? (
              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                {item.label}
              </p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AttachmentsPanel({
  apiBaseUrl,
  token,
  recordId,
  config,
  context = "detail",
  disabled = false,
  readOnly = false,
  className = "",
  onError,
  onChange,
  onControllerReady,
}) {
  const controller = useAttachmentsController({
    apiBaseUrl,
    token,
    recordId,
    config,
    context,
    disabled,
    readOnly,
    onError,
    onChange,
  });

  const [documentType, setDocumentType] = useState("");
  const [documentLabel, setDocumentLabel] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const fileInputRef = useRef(null);
  const dropzonePlacement = normalizePlacement(config?.placement);

  useEffect(() => {
    if (typeof onControllerReady !== "function") return undefined;
    onControllerReady(controller);
    return () => onControllerReady(null);
  }, [controller, onControllerReady]);

  const heading = useMemo(
    () => String(config?.label ?? "Documentos"),
    [config?.label],
  );

  const hasRecord = Boolean(recordId);
  const canChooseFiles =
    controller.canUpload && !disabled && !readOnly && (context !== "detail" || hasRecord);
  const canManageAssociations = hasRecord && Boolean(config?.addPath && config?.removePath);

  const handleFilesPicked = async (filesLike) => {
    await controller.queueFiles(filesLike, {
      documentType: documentType.trim(),
      label: documentLabel.trim(),
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    if (!canChooseFiles) return;
    await handleFilesPicked(event.dataTransfer.files);
  };

  const handleRemoveAssociated = async (item) => {
    setRemovingId(item.id);
    await controller.removeAssociated(item);
    setRemovingId(null);
  };

  const handleOpenAssociated = async (item) => {
    setOpeningId(item.id);
    await controller.openAssociated(item);
    setOpeningId(null);
  };

  const handleDownloadAssociated = async (item) => {
    setDownloadingId(item.id);
    await controller.downloadAssociated(item);
    setDownloadingId(null);
  };

  const wrapperClass =
    dropzonePlacement === "aside"
      ? "space-y-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
      : "space-y-4";

  return (
    <div className={`${wrapperClass} ${className}`.trim()}>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">{heading}</h4>
        {!hasRecord && context !== "detail" ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Los archivos se guardarán después de crear el registro.
          </p>
        ) : null}
      </div>

      {!canManageAssociations && context === "detail" ? (
        <Alert variant="warning">
          <AlertTitle>Documentos</AlertTitle>
          <AlertDescription>
            Este registro no tiene un identificador válido para gestionar documentos.
          </AlertDescription>
        </Alert>
      ) : null}

      {canChooseFiles ? (
        <div className="space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              type="text"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              placeholder="Tipo de documento (opcional)"
              disabled={disabled || readOnly}
            />
            <Input
              type="text"
              value={documentLabel}
              onChange={(event) => setDocumentLabel(event.target.value)}
              placeholder="Etiqueta (opcional)"
              disabled={disabled || readOnly}
            />
          </div>

          <div
            className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/35 p-4 transition-colors hover:border-[hsl(var(--ring))]"
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple={controller.allowMultiple}
              className="sr-only"
              onChange={(event) => handleFilesPicked(event.target.files)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || readOnly}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Agregar documento
              </Button>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Arrastra archivos aquí o haz clic para seleccionar.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {controller.error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{controller.error}</AlertDescription>
        </Alert>
      ) : null}

      {controller.notice ? (
        <Alert variant="default">
          <AlertTitle>Información</AlertTitle>
          <AlertDescription>{controller.notice}</AlertDescription>
        </Alert>
      ) : null}

      {controller.pendingItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Pendientes
          </p>
          {controller.pendingItems.map((item) => (
            <ItemCard key={item.id} item={item}>
              <div className="flex items-center gap-1">
                <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                  {item.status === "uploading" || item.status === "attaching" ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {statusLabel(item.status)}
                    </span>
                  ) : (
                    statusLabel(item.status)
                  )}
                </span>
                {item.status === "error" && hasRecord ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => controller.retryPending(item.id)}
                  >
                    Reintentar
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => controller.removePending(item.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </ItemCard>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Archivos asociados
        </p>

        {controller.loading ? (
          <div className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando documentos...
          </div>
        ) : controller.associatedItems.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No hay documentos asociados.
          </p>
        ) : (
          <div className="space-y-2">
            {controller.associatedItems.map((item) => (
              <ItemCard key={item.id} item={item}>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenAssociated(item)}
                    disabled={openingId === item.id}
                  >
                    {openingId === item.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Abrir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadAssociated(item)}
                    disabled={downloadingId === item.id}
                  >
                    {downloadingId === item.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Descargar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveAssociated(item)}
                    disabled={!controller.canWrite || removingId === item.id}
                  >
                    {removingId === item.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Quitar
                  </Button>
                </div>
              </ItemCard>
            ))}
          </div>
        )}
      </div>

      <FileViewer
        open={Boolean(controller.viewerItem)}
        onClose={controller.closeViewer}
        file={controller.viewerItem}
        title="Documento"
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./Alert.jsx";
import { Button } from "./Button.jsx";
import { Input } from "./Input.jsx";
import { FileViewer } from "./FileViewer.jsx";
import {
  resolveAttachmentFileType,
  useAttachmentsController,
} from "../hooks/useAttachmentsController.js";

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

const FILE_TYPE_STYLES = {
  image: {
    icon: FileImage,
    iconClass:
      "bg-sky-500/10 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    labelClass:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300",
  },
  pdf: {
    icon: FileType2,
    iconClass:
      "bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    labelClass:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300",
  },
  word: {
    icon: FileText,
    iconClass:
      "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    labelClass:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300",
  },
  spreadsheet: {
    icon: FileSpreadsheet,
    iconClass:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    labelClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  text: {
    icon: FileText,
    iconClass:
      "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    labelClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  },
  archive: {
    icon: FileArchive,
    iconClass:
      "bg-fuchsia-500/10 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
    labelClass:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
  },
  file: {
    icon: File,
    iconClass:
      "bg-slate-500/10 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
    labelClass:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-300",
  },
};

const STATUS_STYLES = {
  pending: {
    label: "Pendiente",
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/20 dark:text-slate-200",
  },
  uploading: {
    label: "Subiendo",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300",
    loading: true,
  },
  attaching: {
    label: "Subiendo",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300",
    loading: true,
  },
  success: {
    label: "Subido",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  error: {
    label: "Error",
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300",
  },
};

function getStatusStyle(status) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.pending;
}

function getTypeStyle(item) {
  const typeInfo = resolveAttachmentFileType({
    mimeType: item?.mimeType,
    fileName: item?.fileName,
  });
  return {
    ...typeInfo,
    ...(FILE_TYPE_STYLES[typeInfo.kind] ?? FILE_TYPE_STYLES.file),
  };
}

function FileTypeBadge({ typeStyle }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeStyle.labelClass}`}
      aria-label={`Tipo de archivo: ${typeStyle.label}`}
    >
      {typeStyle.label}
    </span>
  );
}

function FileVisual({ item, typeStyle }) {
  if (typeStyle.kind === "image" && item?.previewUrl) {
    return (
      <img
        src={item.previewUrl}
        alt={item.fileName ?? "Archivo"}
        className="h-11 w-11 rounded-lg border border-[hsl(var(--border))] object-cover"
      />
    );
  }

  const Icon = typeStyle.icon;
  return (
    <span
      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${typeStyle.iconClass}`}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function buildMetaRow(item, typeStyle) {
  const pieces = [];
  if (typeStyle.extension) pieces.push(`.${typeStyle.extension}`);
  if (item?.sizeBytes != null) pieces.push(formatBytes(item.sizeBytes));
  if (item?.createdAt) pieces.push(formatDate(item.createdAt));
  return pieces.join(" · ");
}

function PendingCard({ item, hasRecord, onOpen, onRetry, onRemove, busy }) {
  const typeStyle = getTypeStyle(item);
  const statusStyle = getStatusStyle(item.status);
  const metaRow = buildMetaRow(item, typeStyle);
  const canOpen = Boolean(item?.file);
  const previewLabel = typeStyle.kind === "image" || typeStyle.kind === "pdf" ? "Vista previa" : "Abrir";

  return (
    <article className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5">
      <div className="flex items-start gap-2.5">
        <FileVisual item={item} typeStyle={typeStyle} />

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]" title={item.fileName}>
            {item.fileName ?? "Archivo no disponible"}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <FileTypeBadge typeStyle={typeStyle} />
            {typeStyle.extension ? (
              <span
                className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/60 px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]"
                aria-label={`Extensión ${typeStyle.extension}`}
              >
                .{typeStyle.extension}
              </span>
            ) : null}
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyle.className}`}
              aria-label={`Estado: ${statusStyle.label}`}
            >
              {statusStyle.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {statusStyle.label}
            </span>
          </div>

          {metaRow ? (
            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]" title={metaRow}>
              {metaRow}
            </p>
          ) : null}

          {item.error ? (
            <p className="truncate text-xs text-rose-600 dark:text-rose-300" title={item.error}>
              {item.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {canOpen ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpen(item)}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                )}
                {previewLabel}
              </Button>
            ) : null}

            {item.status === "error" && hasRecord ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onRetry(item.id)}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reintentar
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onRemove(item.id)}
              disabled={busy}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Quitar
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function AssociatedCard({
  item,
  onOpen,
  onDownload,
  onRemove,
  opening,
  downloading,
  removing,
  canWrite,
}) {
  const typeStyle = getTypeStyle(item);
  const metaRow = buildMetaRow(item, typeStyle);
  const previewLabel = typeStyle.kind === "image" || typeStyle.kind === "pdf" ? "Vista previa" : "Abrir";

  return (
    <article className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5">
      <div className="flex items-start gap-2.5">
        <FileVisual item={item} typeStyle={typeStyle} />

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]" title={item.fileName}>
            {item.fileName ?? "Archivo no disponible"}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <FileTypeBadge typeStyle={typeStyle} />
            {typeStyle.extension ? (
              <span
                className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/60 px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]"
                aria-label={`Extensión ${typeStyle.extension}`}
              >
                .{typeStyle.extension}
              </span>
            ) : null}
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES.success.className}`}
              aria-label="Estado: Subido"
            >
              Subido
            </span>
          </div>

          {metaRow ? (
            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]" title={metaRow}>
              {metaRow}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Button type="button" size="sm" variant="outline" onClick={() => onOpen(item)} disabled={opening}>
              {opening ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              )}
              {previewLabel}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onDownload(item)}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Descargar
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onRemove(item)}
              disabled={!canWrite || removing}
            >
              {removing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Quitar
            </Button>
          </div>
        </div>
      </div>
    </article>
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
  const [openingPendingId, setOpeningPendingId] = useState(null);
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
  const showTypeInput = Boolean(config?.metadataInputs?.showDocumentTypeInput);
  const showLabelInput = Boolean(config?.metadataInputs?.showLabelInput);
  const showMetadataInputs = showTypeInput || showLabelInput;

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

  const handleOpenPending = async (item) => {
    setOpeningPendingId(item.id);
    await controller.openPending(item);
    setOpeningPendingId(null);
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
          {showMetadataInputs ? (
            <div className="grid gap-2 md:grid-cols-2">
              {showTypeInput ? (
                <Input
                  type="text"
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  placeholder="Tipo de documento"
                  disabled={disabled || readOnly}
                />
              ) : null}
              {showLabelInput ? (
                <Input
                  type="text"
                  value={documentLabel}
                  onChange={(event) => setDocumentLabel(event.target.value)}
                  placeholder="Etiqueta"
                  disabled={disabled || readOnly}
                />
              ) : null}
            </div>
          ) : null}

          <div
            className="w-full rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/35 p-3 transition-colors hover:border-[hsl(var(--ring))]"
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

            <button
              type="button"
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-left transition hover:border-[hsl(var(--ring))]"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || readOnly}
              aria-label="Seleccionar archivos adjuntos"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                  <Upload className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[hsl(var(--foreground))]">
                    Agregar documentos
                  </span>
                  <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                    Arrastra archivos aquí o haz clic para seleccionar
                  </span>
                </span>
              </span>
            </button>
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

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Archivos pendientes
        </p>
        {controller.pendingItems.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay archivos pendientes.</p>
        ) : (
          <div className="space-y-2">
            {controller.pendingItems.map((item) => (
              <PendingCard
                key={item.id}
                item={item}
                hasRecord={hasRecord}
                onOpen={handleOpenPending}
                onRetry={controller.retryPending}
                onRemove={controller.removePending}
                busy={openingPendingId === item.id}
              />
            ))}
          </div>
        )}
      </div>

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
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay documentos asociados.</p>
        ) : (
          <div className="space-y-2">
            {controller.associatedItems.map((item) => (
              <AssociatedCard
                key={item.id}
                item={item}
                onOpen={handleOpenAssociated}
                onDownload={handleDownloadAssociated}
                onRemove={handleRemoveAssociated}
                opening={openingId === item.id}
                downloading={downloadingId === item.id}
                removing={removingId === item.id}
                canWrite={controller.canWrite}
              />
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

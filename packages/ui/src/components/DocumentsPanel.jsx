import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./Alert.jsx";
import { Button } from "./Button.jsx";
import { Input } from "./Input.jsx";

const DEFAULT_FIELDS = {
  associationId: "id",
  fileAssetId: "file_asset_id",
  documentType: "document_type",
  label: "label",
  createdAt: "created_at",
  enabled: "enabled",
  fileAsset: "file_asset",
  fileName: "originalName",
  mimeType: "mimeType",
  sizeBytes: "sizeBytes",
};

function joinUrl(baseUrl, apiPath) {
  const base = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  const path = String(apiPath ?? "").trim();
  if (!path) return base;
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function getByPath(value, path) {
  if (!path || typeof path !== "string") return undefined;
  return path
    .split(".")
    .reduce((cursor, segment) => (cursor && typeof cursor === "object" ? cursor[segment] : undefined), value);
}

function replacePathTokens(pathTemplate, tokenMap) {
  let path = String(pathTemplate ?? "");
  for (const [key, rawValue] of Object.entries(tokenMap ?? {})) {
    const safeValue = encodeURIComponent(String(rawValue ?? "").trim());
    path = path.replace(new RegExp(`:${key}\\b`, "g"), safeValue);
  }
  return path;
}

function extractArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === "object") return extractArrayPayload(payload.data);
  return [];
}

function extractErrorMessage(payload, fallback) {
  if (payload && typeof payload === "object") {
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
  }
  return fallback;
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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

function extractSignedUrlFromPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.url === "string" && payload.url.trim()) return payload.url;
  if (typeof payload.signedUrl === "string" && payload.signedUrl.trim()) return payload.signedUrl;
  if (payload.data && typeof payload.data === "object") return extractSignedUrlFromPayload(payload.data);
  return null;
}

function resolveUploadedFileAssetId(payload) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [payload.file_asset_id, payload.fileAssetId, payload.id];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (payload.data && typeof payload.data === "object") return resolveUploadedFileAssetId(payload.data);
  return null;
}

function formatBytes(sizeBytes) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeDocument(rawItem, fields) {
  const fileAsset = getByPath(rawItem, fields.fileAsset) ?? rawItem?.file_asset ?? rawItem?.fileAsset ?? null;
  const fileName =
    getByPath(rawItem, fields.fileName) ??
    fileAsset?.originalName ??
    fileAsset?.fileName ??
    fileAsset?.name ??
    "Archivo no disponible";
  const mimeType =
    getByPath(rawItem, fields.mimeType) ??
    fileAsset?.mimeType ??
    fileAsset?.mimetype ??
    "application/octet-stream";
  const sizeBytes =
    getByPath(rawItem, fields.sizeBytes) ??
    fileAsset?.sizeBytes ??
    fileAsset?.size ??
    null;

  return {
    raw: rawItem,
    associationId: getByPath(rawItem, fields.associationId) ?? rawItem?.id ?? null,
    fileAssetId: getByPath(rawItem, fields.fileAssetId) ?? rawItem?.file_asset_id ?? fileAsset?.id ?? null,
    documentType: getByPath(rawItem, fields.documentType) ?? rawItem?.document_type ?? null,
    label: getByPath(rawItem, fields.label) ?? rawItem?.label ?? null,
    createdAt: getByPath(rawItem, fields.createdAt) ?? rawItem?.created_at ?? null,
    enabled: getByPath(rawItem, fields.enabled) ?? rawItem?.enabled ?? true,
    fileName,
    mimeType,
    sizeBytes,
  };
}

export function DocumentsPanel({
  apiBaseUrl,
  token,
  recordId,
  config,
  disabled = false,
  readOnly = false,
  onError,
  onChange,
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [actionDocId, setActionDocId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState("");
  const [documentLabel, setDocumentLabel] = useState("");

  const fields = useMemo(() => ({ ...DEFAULT_FIELDS, ...(config?.fields ?? {}) }), [config?.fields]);

  const listPath = config?.listPath;
  const addPath = config?.addPath;
  const removePath = config?.removePath;
  const uploadConfig = config?.upload ?? {};
  const signedUrlConfig = config?.signedUrl ?? {};
  const signedUrlTemplate = signedUrlConfig.endpointTemplate ?? "/files/:fileId/signed-url";

  const canWrite = !disabled && !readOnly;
  const canUpload = canWrite && Boolean(uploadConfig?.endpoint && uploadConfig?.moduleKey && uploadConfig?.entityType);

  const runListFetch = useCallback(async () => {
    if (!recordId || !listPath) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const endpointPath = replacePathTokens(listPath, { id: recordId });
      const response = await fetch(joinUrl(apiBaseUrl, endpointPath), {
        method: "GET",
        headers: buildHeaders(token),
      });
      const text = await response.text();
      const payload = parseJsonSafe(text);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "No se pudieron cargar los documentos."));
      }
      const rows = extractArrayPayload(payload).map((item) => normalizeDocument(item, fields));
      setDocuments(rows);
      onChange?.(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los documentos.";
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }, [recordId, listPath, apiBaseUrl, token, fields, onChange, onError]);

  useEffect(() => {
    runListFetch();
  }, [runListFetch]);

  const resetUploadInputs = () => {
    setSelectedFile(null);
    setDocumentType("");
    setDocumentLabel("");
  };

  const handleUploadAndAttach = async () => {
    if (!recordId || !selectedFile || !canUpload || !addPath) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("moduleKey", uploadConfig.moduleKey);
      formData.append("entityType", uploadConfig.entityType);
      formData.append("entityId", String(recordId));

      const uploadResponse = await fetch(joinUrl(apiBaseUrl, uploadConfig.endpoint), {
        method: "POST",
        headers: buildHeaders(token),
        body: formData,
      });
      const uploadText = await uploadResponse.text();
      const uploadPayload = parseJsonSafe(uploadText);
      if (!uploadResponse.ok) {
        throw new Error(extractErrorMessage(uploadPayload, "No se pudo subir el documento."));
      }

      const fileAssetId = resolveUploadedFileAssetId(uploadPayload);
      if (!fileAssetId) {
        throw new Error("No se pudo asociar el documento.");
      }

      const associationPayload = { file_asset_id: fileAssetId };
      if (documentType.trim()) associationPayload.document_type = documentType.trim();
      if (documentLabel.trim()) associationPayload.label = documentLabel.trim();

      const endpointPath = replacePathTokens(addPath, { id: recordId });
      const addResponse = await fetch(joinUrl(apiBaseUrl, endpointPath), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders(token),
        },
        body: JSON.stringify(associationPayload),
      });
      const addText = await addResponse.text();
      const addPayload = parseJsonSafe(addText);
      if (!addResponse.ok) {
        throw new Error(extractErrorMessage(addPayload, "No se pudo asociar el documento."));
      }

      resetUploadInputs();
      await runListFetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo subir el documento.";
      setError(message);
      onError?.(message);
    } finally {
      setUploading(false);
    }
  };

  const resolveSignedUrlForFile = async (fileAssetId) => {
    if (!fileAssetId) throw new Error("Archivo no disponible");
    const endpointPath = replacePathTokens(signedUrlTemplate, { fileId: fileAssetId });
    const response = await fetch(joinUrl(apiBaseUrl, endpointPath), {
      method: "GET",
      headers: buildHeaders(token),
    });
    const text = await response.text();
    const payload = parseJsonSafe(text);
    if (!response.ok) throw new Error(extractErrorMessage(payload, "No se pudo abrir el archivo."));
    const url = extractSignedUrlFromPayload(payload);
    if (!url) throw new Error("Archivo no disponible");
    return url;
  };

  const handleOpen = async (doc) => {
    setActionDocId(doc.associationId ?? doc.fileAssetId ?? "open");
    setError("");
    setNotice("");
    try {
      const url = await resolveSignedUrlForFile(doc.fileAssetId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo abrir el archivo.";
      setError(message);
      onError?.(message);
    } finally {
      setActionDocId(null);
    }
  };

  const handleDownload = async (doc) => {
    setActionDocId(doc.associationId ?? doc.fileAssetId ?? "download");
    setError("");
    setNotice("");
    try {
      const url = await resolveSignedUrlForFile(doc.fileAssetId);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.fileName ?? "documento";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo abrir el archivo.";
      setError(message);
      onError?.(message);
    } finally {
      setActionDocId(null);
    }
  };

  const handleRemove = async (doc) => {
    if (!recordId || !removePath || !canWrite) return;
    const docId = doc.associationId;
    if (!docId) {
      setError("No se pudo quitar el documento.");
      return;
    }

    setActionDocId(docId);
    setError("");
    setNotice("");
    try {
      const endpointPath = replacePathTokens(removePath, { id: recordId, docId });
      const response = await fetch(joinUrl(apiBaseUrl, endpointPath), {
        method: "DELETE",
        headers: buildHeaders(token),
      });
      const text = await response.text();
      const payload = parseJsonSafe(text);
      if (!response.ok && response.status !== 404) {
        throw new Error(extractErrorMessage(payload, "No se pudo quitar el documento."));
      }
      if (response.status === 404) {
        setNotice("El documento ya no estaba disponible. Se actualizó la lista.");
      }
      await runListFetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo quitar el documento.";
      setError(message);
      onError?.(message);
    } finally {
      setActionDocId(null);
    }
  };

  if (!recordId) {
    return (
      <Alert variant="warning">
        <AlertTitle>Documentos</AlertTitle>
        <AlertDescription>Este registro no tiene un identificador válido para gestionar documentos.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3">
        <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">Documentos</h4>
        <div className="grid gap-2 md:grid-cols-3">
          <Input
            type="text"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            placeholder="Tipo de documento (opcional)"
            disabled={!canUpload || uploading}
          />
          <Input
            type="text"
            value={documentLabel}
            onChange={(event) => setDocumentLabel(event.target.value)}
            placeholder="Etiqueta (opcional)"
            disabled={!canUpload || uploading}
          />
          <Input
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            disabled={!canUpload || uploading}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleUploadAndAttach}
            disabled={!canUpload || uploading || !selectedFile}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subiendo documento...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Agregar documento
              </>
            )}
          </Button>
          {selectedFile && (
            <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">
              {selectedFile.name}
            </span>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert variant="default">
          <AlertTitle>Información</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
        {loading ? (
          <div className="p-4 text-sm text-[hsl(var(--muted-foreground))]">Cargando documentos...</div>
        ) : documents.length === 0 ? (
          <div className="p-4 text-sm text-[hsl(var(--muted-foreground))]">No hay documentos asociados.</div>
        ) : (
          documents.map((doc) => {
            const isActing = actionDocId && actionDocId === (doc.associationId ?? doc.fileAssetId);
            return (
              <div key={doc.associationId ?? doc.fileAssetId ?? doc.fileName} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{doc.fileName}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {doc.documentType || "Sin categoría"} · {formatDate(doc.createdAt)}
                      {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ""}
                    </p>
                    {doc.label ? (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{doc.label}</p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      doc.enabled
                        ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                    }`}
                  >
                    {doc.enabled ? "Activo" : "Desactivado"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(isActing)}
                    onClick={() => handleOpen(doc)}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Abrir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(isActing)}
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Descargar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(isActing) || !canWrite}
                    onClick={() => handleRemove(doc)}
                  >
                    {isActing ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Quitar
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

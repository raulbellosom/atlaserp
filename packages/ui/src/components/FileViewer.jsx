import { useMemo } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, ExternalLink, X } from "lucide-react";

function isImage(mimeType = "") {
  return String(mimeType).startsWith("image/");
}

function isPdf(mimeType = "") {
  return String(mimeType) === "application/pdf";
}

export function FileViewer({
  open,
  onClose,
  file,
  title = "Vista previa de archivo",
}) {
  const fileName = file?.originalName ?? "Archivo";
  const fileUrl = file?.signedUrl ?? file?.url ?? null;
  const mimeType = file?.mimeType ?? "";

  const mode = useMemo(() => {
    if (isImage(mimeType)) return "image";
    if (isPdf(mimeType)) return "pdf";
    return "generic";
  }, [mimeType]);

  function handleDownload() {
    if (!fileUrl) return;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogPrimitive.Portal>
        {/* Dark overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />

        {/* Viewer panel */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={[
            "fixed inset-3 sm:inset-5 z-50 flex flex-col rounded-2xl overflow-hidden",
            "glass-strong shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-200",
          ].join(" ")}
        >
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 h-12 shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/60">
            <div className="flex-1 min-w-0">
              <DialogPrimitive.Title className="text-[13px] font-medium text-[hsl(var(--foreground))] truncate">
                {fileName}
              </DialogPrimitive.Title>
              {mimeType && (
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]/70 truncate hidden sm:block">
                  {mimeType}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 shrink-0">
              {fileUrl && (
                <button
                  onClick={() => window.open(fileUrl, "_blank")}
                  aria-label="Abrir en pestaña nueva"
                  title="Abrir externo"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all duration-150"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
              {fileUrl && (
                <button
                  onClick={handleDownload}
                  aria-label="Descargar archivo"
                  title="Descargar"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all duration-150"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="w-px h-3.5 bg-[hsl(var(--border))] mx-1" />
              <DialogPrimitive.Close
                aria-label="Cerrar visor"
                title="Cerrar"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all duration-150"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {!fileUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))]" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]/70">
                  Sin vista previa disponible.
                </p>
              </div>
            ) : mode === "image" ? (
              <div className="h-full w-full flex items-center justify-center p-4">
                <img
                  src={fileUrl}
                  alt={fileName}
                  className="max-h-full max-w-full object-contain rounded-xl"
                />
              </div>
            ) : mode === "pdf" ? (
              <iframe
                title={fileName}
                src={fileUrl}
                className="h-full w-full"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="w-full max-w-xs glass rounded-2xl p-6 text-center">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate mb-1">
                    {fileName}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
                    {mimeType}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]/70 mb-4 leading-relaxed">
                    No hay vista previa disponible para este tipo de archivo.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted-foreground))]/20 transition-colors duration-150"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Minus,
  Music,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function isImage(mimeType = "") {
  return String(mimeType).startsWith("image/");
}

function isPdf(mimeType = "") {
  return String(mimeType) === "application/pdf";
}

function isVideo(mimeType = "") {
  return String(mimeType).startsWith("video/");
}

function isAudio(mimeType = "") {
  return String(mimeType).startsWith("audio/");
}

function getFileKey(file) {
  return String(file?.id ?? file?.associationId ?? file?.fileAssetId ?? file?.originalName ?? "");
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function FileViewer({
  open,
  onClose,
  file,
  files = [],
  activeIndex = 0,
  onActiveIndexChange,
  onResolveFile,
  title = "Vista previa de archivo",
}) {
  const hasGallery = Array.isArray(files) && files.length > 0;
  const viewerFileKey = getFileKey(file);
  const fileIndexInGallery = hasGallery
    ? files.findIndex((entry) => getFileKey(entry) === viewerFileKey)
    : -1;
  const canNavigate =
    hasGallery &&
    Number.isInteger(activeIndex) &&
    activeIndex >= 0 &&
    activeIndex < files.length;
  const usingExternalFile = Boolean(file && fileIndexInGallery === -1);
  const currentFile =
    file && fileIndexInGallery === -1
      ? file
      : canNavigate
        ? files[activeIndex]
        : file;

  const fileName = currentFile?.originalName ?? "Archivo";
  const mimeType = currentFile?.mimeType ?? "";
  const mode = useMemo(() => {
    if (isImage(mimeType)) return "image";
    if (isPdf(mimeType)) return "pdf";
    if (isVideo(mimeType)) return "video";
    if (isAudio(mimeType)) return "audio";
    return "generic";
  }, [mimeType]);

  const directUrl = currentFile?.signedUrl ?? currentFile?.url ?? null;
  const [resolvedUrl, setResolvedUrl] = useState(directUrl);
  const [resolving, setResolving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Always-current refs so the non-React wheel listener never sees stale values
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;
  const prevZoomRef = useRef(1);

  const imageContainerRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({
    mode: null,
    startDistance: 0,
    startZoom: 1,
    startPan: { x: 0, y: 0 },
    startPoint: { x: 0, y: 0 },
  });

  useEffect(() => {
    setResolvedUrl(directUrl);
  }, [directUrl]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setDragging(false);
    prevZoomRef.current = 1;
    pointersRef.current.clear();
    gestureRef.current = {
      mode: null,
      startDistance: 0,
      startZoom: 1,
      startPan: { x: 0, y: 0 },
      startPoint: { x: 0, y: 0 },
    };
  }, [currentFile?.id, currentFile?.associationId, currentFile?.fileAssetId, currentFile?.originalName]);

  // Reset pan only when zoom transitions from >1 back to ≤1, not on every render at zoom=1
  useEffect(() => {
    if (zoom <= 1 && prevZoomRef.current > 1) {
      setPan({ x: 0, y: 0 });
    }
    prevZoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    let active = true;
    if (!open || !currentFile) {
      setResolving(false);
      return () => {
        active = false;
      };
    }

    if (directUrl) {
      setResolving(false);
      return () => {
        active = false;
      };
    }

    if (typeof onResolveFile !== "function") {
      setResolving(false);
      return () => {
        active = false;
      };
    }

    async function resolveUrl() {
      try {
        setResolving(true);
        const url = await onResolveFile(currentFile);
        if (!active) return;
        setResolvedUrl(url || null);
      } finally {
        if (active) setResolving(false);
      }
    }

    resolveUrl();
    return () => {
      active = false;
    };
  }, [open, currentFile, directUrl, onResolveFile]);

  const nudgeZoom = useCallback((direction) => {
    setZoom((value) => clampZoom(Number((value + direction * ZOOM_STEP).toFixed(2))));
  }, []);

  // Document-level wheel handler: must be on `document` with passive:false so we can
  // call preventDefault() BEFORE Chromium's compositor acts on the pinch-to-page-zoom.
  // An element-level listener fires too late — the browser has already processed it.
  useEffect(() => {
    if (!open || mode !== "image") return;

    function handleWheel(event) {
      const isPinch = event.ctrlKey || event.metaKey;

      if (isPinch) {
        // Prevent browser page-zoom for every pinch while the image modal is open
        event.preventDefault();

        const el = imageContainerRef.current;
        if (!el) return;

        const factor = Math.pow(0.998, event.deltaY);
        const rect = el.getBoundingClientRect();
        const cx = event.clientX - (rect.left + rect.width / 2);
        const cy = event.clientY - (rect.top + rect.height / 2);

        const prevZoom = zoomRef.current;
        const prevPan = panRef.current;
        const newZoom = clampZoom(Number((prevZoom * factor).toFixed(3)));
        if (newZoom === prevZoom) return;

        const ratio = newZoom / prevZoom;
        setZoom(newZoom);
        setPan({
          x: cx * (1 - ratio) + prevPan.x * ratio,
          y: cy * (1 - ratio) + prevPan.y * ratio,
        });
        return;
      }

      // Non-pinch scroll: only pan if the scroll happened inside the image container
      const el = imageContainerRef.current;
      if (!el || !el.contains(event.target)) return;
      if (zoomRef.current <= 1) return;

      event.preventDefault();
      setPan((prev) => ({
        x: prev.x - event.deltaX,
        y: prev.y - event.deltaY,
      }));
    }

    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => document.removeEventListener("wheel", handleWheel);
  }, [open, mode]); // Re-registers when dialog opens/closes or mode changes

  const fileUrl = resolvedUrl;
  const showGalleryNav = canNavigate && !usingExternalFile;
  const hasPrev = showGalleryNav && activeIndex > 0;
  const hasNext = showGalleryNav && activeIndex < files.length - 1;
  const busy = resolving;

  function handleDownload() {
    if (!fileUrl) return;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  function handlePrev() {
    if (!hasPrev || typeof onActiveIndexChange !== "function") return;
    onActiveIndexChange(activeIndex - 1);
  }

  function handleNext() {
    if (!hasNext || typeof onActiveIndexChange !== "function") return;
    onActiveIndexChange(activeIndex + 1);
  }

  function handlePointerDown(event) {
    if (mode !== "image") return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    // Capture so move/up events keep firing on this element even if fingers leave bounds
    event.currentTarget.setPointerCapture(event.pointerId);

    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      gestureRef.current = {
        ...gestureRef.current,
        mode: "pinch",
        startDistance: getDistance(points[0], points[1]),
        startZoom: zoomRef.current,
      };
      setDragging(false);
      return;
    }

    gestureRef.current = {
      ...gestureRef.current,
      mode: "pan",
      startPan: panRef.current,
      startPoint: { x: event.clientX, y: event.clientY },
    };
    setDragging(true);
  }

  function handlePointerMove(event) {
    if (mode !== "image") return;
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const points = [...pointersRef.current.values()];
    if (points.length >= 2 && gestureRef.current.startDistance > 0) {
      const distance = getDistance(points[0], points[1]);
      const ratio = distance / gestureRef.current.startDistance;
      setZoom(clampZoom(Number((gestureRef.current.startZoom * ratio).toFixed(2))));
      return;
    }

    if (gestureRef.current.mode !== "pan") return;
    // At zoom=1 the image already fills the view — panning makes no visual sense
    if (zoomRef.current <= 1) return;

    const dx = event.clientX - gestureRef.current.startPoint.x;
    const dy = event.clientY - gestureRef.current.startPoint.y;
    setPan({
      x: gestureRef.current.startPan.x + dx,
      y: gestureRef.current.startPan.y + dy,
    });
  }

  function handlePointerEnd(event) {
    if (mode !== "image") return;

    pointersRef.current.delete(event.pointerId);
    setDragging(false);

    const points = [...pointersRef.current.values()];
    if (points.length === 1) {
      const point = points[0];
      gestureRef.current = {
        ...gestureRef.current,
        mode: "pan",
        startPan: panRef.current,
        startPoint: { x: point.x, y: point.y },
      };
      return;
    }

    if (points.length === 0) {
      gestureRef.current = {
        ...gestureRef.current,
        mode: null,
        startDistance: 0,
      };
    }
  }

  function handleImageDoubleClick(event) {
    if (mode !== "image") return;
    event.preventDefault();

    const nextZoom = zoom > 1 ? 1 : 2;
    setZoom(nextZoom);
    if (nextZoom === 1) {
      setPan({ x: 0, y: 0 });
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - (rect.left + rect.width / 2);
    const offsetY = event.clientY - (rect.top + rect.height / 2);
    setPan({ x: -offsetX * 0.6, y: -offsetY * 0.6 });
  }

  const imageTransformStyle = {
    transform: `rotate(${rotation}deg) scale(${zoom})`,
    transformOrigin: "center",
    transition: dragging ? "none" : "transform 120ms ease",
  };

  const panTransformStyle = {
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
    transition: dragging ? "none" : "transform 120ms ease",
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(event) => {
            if (gestureRef.current.mode !== null) event.preventDefault();
          }}
          className={[
            "fixed inset-3 sm:inset-5 z-50 flex flex-col rounded-2xl overflow-hidden",
            "glass-strong shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-200",
          ].join(" ")}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 h-12 shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/60">
            <div className="flex-1 min-w-0">
              <DialogPrimitive.Title className="text-[13px] font-medium text-[hsl(var(--foreground))] truncate">
                {fileName || title}
              </DialogPrimitive.Title>
              {mimeType && (
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]/70 truncate hidden sm:block">
                  {mimeType}
                </p>
              )}
            </div>

            {showGalleryNav && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  aria-label="Archivo anterior"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]/70 min-w-11 text-center tabular-nums">
                  {activeIndex + 1} / {files.length}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!hasNext}
                  aria-label="Archivo siguiente"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-0.5 shrink-0">
              {fileUrl && (
                <button
                  type="button"
                  onClick={() => window.open(fileUrl, "_blank")}
                  aria-label="Abrir en pestana nueva"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
              {fileUrl && (
                <button
                  type="button"
                  onClick={handleDownload}
                  aria-label="Descargar archivo"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="w-px h-3.5 bg-[hsl(var(--border))] mx-1" />
              <DialogPrimitive.Close
                aria-label="Cerrar visor"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[hsl(var(--muted-foreground))]/60" />
              </div>
            )}

            {!busy && !fileUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))]" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]/70">
                  Sin vista previa disponible.
                </p>
              </div>
            )}

            {!busy && fileUrl && mode === "image" && (
              <div
                className={`h-full w-full overflow-hidden flex items-center justify-center touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                ref={imageContainerRef}
                onDoubleClick={handleImageDoubleClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                // onPointerLeave intentionally omitted: setPointerCapture keeps tracking
                // even when fingers move outside element bounds, so leave events are harmless
              >
                <div style={panTransformStyle} className="max-h-full max-w-full flex items-center justify-center">
                  <img
                    key={getFileKey(currentFile)}
                    src={fileUrl}
                    alt={fileName}
                    draggable={false}
                    className="max-h-full max-w-full object-contain rounded-xl will-change-transform pointer-events-none"
                    style={imageTransformStyle}
                  />
                </div>
              </div>
            )}

            {!busy && fileUrl && mode === "pdf" && (
              <iframe title={fileName} src={fileUrl} className="h-full w-full" style={{ touchAction: "pan-y" }} />
            )}

            {!busy && fileUrl && mode === "video" && (
              <div className="h-full w-full flex items-center justify-center bg-black">
                <video
                  key={getFileKey(currentFile)}
                  src={fileUrl}
                  controls
                  controlsList="nodownload"
                  playsInline
                  className="max-h-full max-w-full outline-none"
                />
              </div>
            )}

            {!busy && fileUrl && mode === "audio" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
                <div className="h-20 w-20 rounded-3xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))] flex items-center justify-center">
                  <Music className="h-9 w-9 text-[hsl(var(--muted-foreground))]" />
                </div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate max-w-xs text-center">
                  {fileName}
                </p>
                <audio
                  key={getFileKey(currentFile)}
                  src={fileUrl}
                  controls
                  className="w-full max-w-sm"
                />
              </div>
            )}

            {!busy && fileUrl && mode === "generic" && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="w-full max-w-xs glass rounded-2xl p-6 text-center">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate mb-1">
                    {fileName}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">{mimeType}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]/70 mb-4 leading-relaxed">
                    No hay vista previa disponible para este tipo de archivo.
                  </p>
                  <button
                    type="button"
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

          {/* Image toolbar — only for images */}
          {mode === "image" && !busy && fileUrl && (
            <div className="flex items-center justify-center gap-1.5 px-4 h-12 shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/60">
              <button
                type="button"
                title="Reducir zoom"
                onClick={() => nudgeZoom(-1)}
                disabled={zoom <= MIN_ZOOM}
                className="h-7 w-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Restablecer zoom"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="h-7 min-w-14 px-2 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-md tabular-nums"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                title="Aumentar zoom"
                onClick={() => nudgeZoom(1)}
                disabled={zoom >= MAX_ZOOM}
                className="h-7 w-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
              <button
                type="button"
                title="Rotar izquierda"
                onClick={() => setRotation((value) => value - 90)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Rotar derecha"
                onClick={() => setRotation((value) => value + 90)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Restablecer"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                  setPan({ x: 0, y: 0 });
                }}
                className="h-7 w-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

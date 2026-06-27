import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  Minus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@atlas/ui";
import { getFileKind, getKindLabel, formatBytes } from "../lib/file-kind";
import { FileVisual } from "./FileVisual";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ToolbarBtn({ children, title, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={[
        "h-8 w-8 sm:h-7 sm:w-7 rounded-md flex items-center justify-center transition-all duration-150",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        active
          ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
          : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function AdvancedFileViewer({
  open,
  onOpenChange,
  files,
  activeIndex,
  onIndexChange,
  onResolveSignedUrl,
  zIndex = 50,
}) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [pinching, setPinching] = useState(false);

  const imageContainerRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({
    mode: null,
    startDistance: 0,
    startZoom: 1,
    startPan: { x: 0, y: 0 },
    startPoint: { x: 0, y: 0 },
  });

  const file = files?.[activeIndex] ?? null;
  const kind = useMemo(() => getFileKind(file?.mimeType), [file?.mimeType]);
  const canPrev = activeIndex > 0;
  const canNext = activeIndex >= 0 && activeIndex < files.length - 1;

  useEffect(() => {
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
    setPinching(false);
    pointersRef.current.clear();
    gestureRef.current = {
      mode: null,
      startDistance: 0,
      startZoom: 1,
      startPan: { x: 0, y: 0 },
      startPoint: { x: 0, y: 0 },
    };
  }, [file?.id]);

  useEffect(() => {
    let active = true;
    if (!open || !file?.id) {
      setSignedUrl(null);
      return () => {
        active = false;
      };
    }

    async function loadSignedUrl() {
      try {
        setLoading(true);
        const url = await onResolveSignedUrl(file);
        if (!active) return;
        setSignedUrl(url || null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSignedUrl();
    return () => {
      active = false;
    };
  }, [open, file?.id, onResolveSignedUrl]);

  useEffect(() => {
    if (zoom <= 1) {
      setPan({ x: 0, y: 0 });
    }
  }, [zoom]);

  const nudgeZoom = useCallback((direction) => {
    setZoom((value) =>
      clampZoom(Number((value + direction * ZOOM_STEP).toFixed(2))),
    );
  }, []);

  useEffect(() => {
    const el = imageContainerRef.current;
    if (!el) return;
    function handleImageWheel(event) {
      event.preventDefault();
      event.stopPropagation();
      nudgeZoom(event.deltaY > 0 ? -1 : 1);
    }
    el.addEventListener("wheel", handleImageWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleImageWheel);
  }, [nudgeZoom, signedUrl, loading, kind]);

  useEffect(() => {
    const el = imageContainerRef.current;
    if (!el || kind !== "image") return;
    function preventNativePinch(e) {
      if (e.touches.length > 1) e.preventDefault();
    }
    el.addEventListener("touchstart", preventNativePinch, { passive: false });
    return () => el.removeEventListener("touchstart", preventNativePinch);
  }, [kind, signedUrl, loading]);

  function handlePointerDown(event) {
    if (kind !== "image") return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);

    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      gestureRef.current = {
        ...gestureRef.current,
        mode: "pinch",
        startDistance: getDistance(points[0], points[1]),
        startZoom: zoom,
      };
      setDragging(false);
      setPinching(true);
      return;
    }

    gestureRef.current = {
      ...gestureRef.current,
      mode: "pan",
      startPan: pan,
      startPoint: { x: event.clientX, y: event.clientY },
    };
    setDragging(true);
  }

  function handlePointerMove(event) {
    if (kind !== "image") return;
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointersRef.current.values()];

    if (points.length >= 2 && gestureRef.current.startDistance > 0) {
      const distance = getDistance(points[0], points[1]);
      const ratio = distance / gestureRef.current.startDistance;
      setZoom(
        clampZoom(Number((gestureRef.current.startZoom * ratio).toFixed(2))),
      );
      return;
    }

    if (gestureRef.current.mode !== "pan") return;
    const dx = event.clientX - gestureRef.current.startPoint.x;
    const dy = event.clientY - gestureRef.current.startPoint.y;
    setPan({
      x: gestureRef.current.startPan.x + dx,
      y: gestureRef.current.startPan.y + dy,
    });
  }

  function handlePointerEnd(event) {
    if (kind !== "image") return;

    pointersRef.current.delete(event.pointerId);
    setDragging(false);

    const points = [...pointersRef.current.values()];
    if (points.length === 1) {
      const point = points[0];
      gestureRef.current = {
        ...gestureRef.current,
        mode: "pan",
        startPan: pan,
        startPoint: { x: point.x, y: point.y },
      };
      return;
    }

    if (points.length === 0) {
      setPinching(false);
      gestureRef.current = {
        ...gestureRef.current,
        mode: null,
        startDistance: 0,
      };
    }
  }

  function handleImageDoubleClick(event) {
    if (kind !== "image") return;
    event.preventDefault();
    const isZoomed = zoom > 1;
    const nextZoom = isZoomed ? 1 : 2;

    setZoom(nextZoom);
    if (nextZoom === 1) {
      setPan({ x: 0, y: 0 });
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - (rect.left + rect.width / 2);
    const offsetY = event.clientY - (rect.top + rect.height / 2);
    setPan({
      x: -offsetX * 0.6,
      y: -offsetY * 0.6,
    });
  }

  function resetTransforms() {
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function downloadCurrent() {
    if (!signedUrl || !file) return;
    const anchor = document.createElement("a");
    anchor.href = signedUrl;
    anchor.download = file.originalName ?? file.name ?? "archivo";
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  const gestureActive = dragging || pinching;

  const imageTransformStyle = {
    transform: `rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1}) scale(${zoom})`,
    transformOrigin: "center",
    transition: gestureActive ? "none" : "transform 120ms ease",
  };

  const panTransformStyle = {
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
    transition: gestureActive ? "none" : "transform 120ms ease",
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          style={{ zIndex }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200"
        />

        {/* Viewer panel — fills almost the full viewport */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{ zIndex }}
          onPointerDownOutside={(e) => {
            // Prevent accidental close during pinch/pan gestures
            if (gestureRef.current.mode !== null) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            // Prevent closing when interacting with Radix portals rendered from within
            // this dialog (e.g. DropdownMenu items that render in a separate portal)
            if (e.target?.closest?.("[data-radix-popper-content-wrapper]")) {
              e.preventDefault();
            }
          }}
          className={[
            "fixed inset-safe flex flex-col rounded-2xl overflow-hidden",
            "glass-strong shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-200",
          ].join(" ")}
        >
          {/* ── TOP BAR ─────────────────────────────────── */}
          <div className="flex items-center gap-2 px-3 h-12 shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/60">
            {/* File info */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <FileVisual
                file={file}
                previewUrl={null}
                className="h-6 w-6 shrink-0 rounded opacity-80"
              />
              <div className="flex items-baseline gap-2 min-w-0">
                <DialogPrimitive.Title className="text-[13px] font-medium text-[hsl(var(--foreground))] truncate">
                  {file?.originalName ?? "Vista de archivo"}
                </DialogPrimitive.Title>
                {file?.sizeBytes > 0 && (
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]/70 shrink-0 hidden sm:inline tabular-nums">
                    {formatBytes(file.sizeBytes)}
                  </span>
                )}
              </div>
            </div>

            {/* Center: navigation counter */}
            {(files?.length ?? 0) > 1 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => canPrev && onIndexChange(activeIndex - 1)}
                  disabled={!canPrev}
                  aria-label="Archivo anterior"
                  title="Anterior"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]/70 min-w-11 text-center tabular-nums select-none">
                  {activeIndex + 1} / {files.length}
                </span>
                <button
                  onClick={() => canNext && onIndexChange(activeIndex + 1)}
                  disabled={!canNext}
                  aria-label="Archivo siguiente"
                  title="Siguiente"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Right: actions + close */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => signedUrl && window.open(signedUrl, "_blank")}
                disabled={!signedUrl}
                aria-label="Abrir en pestaña nueva"
                title="Abrir externo"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={downloadCurrent}
                disabled={!signedUrl}
                aria-label="Descargar archivo"
                title="Descargar"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
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

          {/* ── CONTENT AREA ────────────────────────────── */}
          <div className="relative flex-1 min-h-0 overflow-hidden">
            {/* Loading state */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[hsl(var(--muted-foreground))]/50" />
              </div>
            )}

            {/* No URL state */}
            {!loading && !signedUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center border border-[hsl(var(--border))]">
                  <FileVisual
                    file={file}
                    previewUrl={null}
                    className="h-7 w-7 opacity-40"
                  />
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]/70">
                  Sin vista previa disponible.
                </p>
              </div>
            )}

            {/* Image viewer */}
            {!loading && signedUrl && kind === "image" && (
              <div
                className={`h-full w-full overflow-hidden flex items-center justify-center touch-none select-none ${
                  dragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                ref={imageContainerRef}
                onDoubleClick={handleImageDoubleClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
              >
                <div
                  style={panTransformStyle}
                  className="max-h-full max-w-full flex items-center justify-center"
                >
                  <img
                    src={signedUrl}
                    alt={file?.originalName ?? "Archivo"}
                    draggable={false}
                    className="max-h-full max-w-full object-contain will-change-transform pointer-events-none"
                    style={imageTransformStyle}
                  />
                </div>
              </div>
            )}

            {/* PDF viewer */}
            {!loading && signedUrl && kind === "pdf" && (
              <div className="relative h-full w-full group">
                <iframe
                  src={signedUrl}
                  title={file?.originalName ?? "PDF"}
                  className="h-full w-full"
                  style={{ touchAction: "pan-y" }}
                />
                {/* Mobile: always visible. Desktop: revealed on hover */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 pointer-events-none md:pointer-events-auto">
                  <button
                    onClick={() => window.open(signedUrl, "_blank")}
                    className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium glass shadow-lg text-[hsl(var(--foreground))]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir PDF
                  </button>
                </div>
              </div>
            )}

            {/* Video player */}
            {!loading && signedUrl && kind === "video" && (
              <div className="h-full w-full flex items-center justify-center bg-black">
                <video
                  key={signedUrl}
                  src={signedUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-full max-w-full"
                  style={{ outline: "none" }}
                />
              </div>
            )}

            {/* Audio player */}
            {!loading && signedUrl && kind === "audio" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8">
                <div className="h-20 w-20 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center border border-[hsl(var(--border))]">
                  <FileVisual file={file} previewUrl={null} className="h-10 w-10 opacity-60" />
                </div>
                <p className="text-sm font-medium text-center truncate max-w-xs">
                  {file?.originalName ?? file?.name ?? "Audio"}
                </p>
                <audio
                  key={signedUrl}
                  src={signedUrl}
                  controls
                  className="w-full max-w-sm"
                  style={{ outline: "none" }}
                />
              </div>
            )}

            {/* Generic (unsupported) */}
            {!loading && signedUrl && kind !== "image" && kind !== "pdf" && kind !== "video" && kind !== "audio" && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="w-full max-w-xs glass rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <FileVisual
                      file={file}
                      previewUrl={null}
                      className="h-12 w-12 rounded-xl bg-[hsl(var(--muted))] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[hsl(var(--foreground))] truncate">
                        {file?.originalName}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        {getKindLabel(kind)}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]/70">
                        {formatBytes(file?.sizeBytes ?? 0)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]/70 mb-4 leading-relaxed">
                    No hay vista previa disponible para este tipo de archivo.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadCurrent}
                      className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted-foreground))]/20 transition-colors duration-150"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar
                    </button>
                    <button
                      onClick={() => window.open(signedUrl, "_blank")}
                      className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted-foreground))]/20 transition-colors duration-150"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Overlaid navigation arrows (multi-file) */}
            {(files?.length ?? 0) > 1 && !loading && signedUrl && (
              <>
                {canPrev && (
                  <button
                    onClick={() => onIndexChange(activeIndex - 1)}
                    aria-label="Archivo anterior"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl flex items-center justify-center glass text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-all duration-150"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {canNext && (
                  <button
                    onClick={() => onIndexChange(activeIndex + 1)}
                    aria-label="Archivo siguiente"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl flex items-center justify-center glass text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-all duration-150"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── BOTTOM TOOLBAR (images only) ────────────── */}
          {kind === "image" && !loading && signedUrl && (
            <div className="flex items-center justify-center gap-1.5 px-4 h-12 safe-bottom shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/60">
              {/* Zoom group — always visible */}
              <div className="flex items-center rounded-lg bg-[hsl(var(--muted))]/60 p-0.5">
                <ToolbarBtn
                  onClick={() => nudgeZoom(-1)}
                  title="Reducir zoom"
                  disabled={zoom <= MIN_ZOOM}
                >
                  <Minus className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <button
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  title="Restablecer zoom"
                  className="h-7 min-w-13 px-2 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors duration-150 tabular-nums"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <ToolbarBtn
                  onClick={() => nudgeZoom(1)}
                  title="Aumentar zoom"
                  disabled={zoom >= MAX_ZOOM}
                >
                  <Plus className="h-3.5 w-3.5" />
                </ToolbarBtn>
              </div>

              {/* Desktop (≥ sm): full rotate + flip + reset groups */}
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
                <div className="flex items-center rounded-lg bg-[hsl(var(--muted))]/60 p-0.5">
                  <ToolbarBtn
                    onClick={() => setRotation((v) => v - 90)}
                    title="Rotar izquierda"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    onClick={() => setRotation((v) => v + 90)}
                    title="Rotar derecha"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                </div>
                <div className="w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
                <div className="flex items-center rounded-lg bg-[hsl(var(--muted))]/60 p-0.5">
                  <ToolbarBtn
                    onClick={() => setFlipX((v) => !v)}
                    title="Voltear horizontal"
                    active={flipX}
                  >
                    <FlipHorizontal2 className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    onClick={() => setFlipY((v) => !v)}
                    title="Voltear vertical"
                    active={flipY}
                  >
                    <FlipVertical2 className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                </div>
                <div className="w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
                <ToolbarBtn onClick={resetTransforms} title="Restablecer todo">
                  <RefreshCw className="h-3.5 w-3.5" />
                </ToolbarBtn>
              </div>

              {/* Mobile (< sm): collapse rotate/flip/reset into DropdownMenu */}
              <div className="sm:hidden flex items-center">
                <div className="w-px h-4 bg-[hsl(var(--border))] mx-1.5" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      title="Mas opciones"
                      className="h-8 w-8 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all duration-150"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end" style={{ zIndex: zIndex + 10 }}>
                    <DropdownMenuItem onSelect={() => setRotation((v) => v - 90)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rotar izquierda
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setRotation((v) => v + 90)}>
                      <RotateCw className="h-4 w-4 mr-2" />
                      Rotar derecha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setFlipX((v) => !v)}>
                      <FlipHorizontal2 className="h-4 w-4 mr-2" />
                      {flipX ? "Quitar volteo horizontal" : "Voltear horizontal"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setFlipY((v) => !v)}>
                      <FlipVertical2 className="h-4 w-4 mr-2" />
                      {flipY ? "Quitar volteo vertical" : "Voltear vertical"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={resetTransforms}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Restablecer todo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";

// Worker served from public/ — copied there via pnpm postinstall (see package.json)
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function PDFViewer({ url }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setPageNumber(1);
    setNumPages(null);
  }, [url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.floor(entry.contentRect.width) - 32);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* Scrollable PDF page area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex justify-center bg-[hsl(var(--muted))]/20"
      >
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex items-center justify-center min-h-40 w-full">
              <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]/50" />
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center min-h-40 w-full gap-3">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Error al cargar el PDF.
              </p>
              <button
                onClick={() => window.open(url, "_blank")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium glass text-[hsl(var(--foreground))]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir en visor externo
              </button>
            </div>
          }
        >
          {containerWidth && (
            <Page
              pageNumber={pageNumber}
              width={containerWidth}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={null}
              className="my-4 shadow-lg"
            />
          )}
        </Document>
      </div>

      {/* Bottom bar: page navigation + open-in-browser fallback */}
      <div className="flex items-center justify-between px-4 h-12 safe-bottom shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/60">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            aria-label="Pagina anterior"
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[11px] text-[hsl(var(--muted-foreground))]/70 min-w-14 text-center tabular-nums select-none">
            {pageNumber} / {numPages ?? "—"}
          </span>
          <button
            onClick={() => setPageNumber((p) => Math.min(numPages ?? p, p + 1))}
            disabled={!numPages || pageNumber >= numPages}
            aria-label="Pagina siguiente"
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => window.open(url, "_blank")}
          className="flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium glass text-[hsl(var(--foreground))]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir en visor
        </button>
      </div>
    </div>
  );
}

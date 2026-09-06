// apps/desktop/src/modules/atlas.pfm/components/ReceiptDetailDialog.jsx
// Single "click the ticket" destination regardless of status: shows the photo
// side by side with whatever the IA has (or hasn't) figured out yet — a
// processing spinner, the full error with a copy button, or the parsed data.
import { useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ImageViewer,
} from "@atlas/ui";
import { Copy, Loader2, ReceiptText, RotateCcw, TriangleAlert, ZoomIn } from "lucide-react";
import { useReceiptImageUrl } from "../hooks/use-pfm-queries";
import { ReceiptParsedInfo } from "./ReceiptParsedInfo";

// The vision service's error messages are "<prose>: <json body>" — split the
// two so the JSON can be pretty-printed instead of shown as one long run-on.
function splitErrorDetail(message) {
  const text = String(message ?? "");
  const match = text.match(/^(.*?)(\{[\s\S]*\})\s*$/);
  if (!match) return { prefix: text, json: null };
  try {
    return { prefix: match[1].trim(), json: JSON.stringify(JSON.parse(match[2]), null, 2) };
  } catch {
    return { prefix: text, json: null };
  }
}

export function ReceiptDetailDialog({ open, onOpenChange, receipt, onReview, onRetry }) {
  const { data: imageUrl } = useReceiptImageUrl(receipt?.fileId);
  const [zoomOpen, setZoomOpen] = useState(false);

  // Don't early-return null when `receipt` clears — the parent nulls it out
  // in the same render that flips `open` to false, and bailing out here would
  // unmount the Dialog before Radix gets to play its close animation.
  const { status, parsed, errorReason, attempts } = receipt ?? {};
  const { prefix, json } = status === "FAILED" ? splitErrorDetail(errorReason) : {};

  function copyError() {
    navigator.clipboard
      .writeText(errorReason || "")
      .then(() => toast.success("Error copiado"))
      .catch(() => toast.error("No se pudo copiar el error."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="2xl"
        className="md:max-w-5xl"
        style={{ borderColor: "transparent" }}
      >
        <DialogHeader>
          <DialogTitle>Detalle del ticket</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            {imageUrl ? (
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="group relative block w-full"
              >
                <img
                  src={imageUrl}
                  alt="Ticket"
                  className="max-h-112 w-full rounded-xl bg-[hsl(var(--muted))] object-contain"
                />
                <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="h-4 w-4" />
                </span>
              </button>
            ) : (
              <div className="flex h-112 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
                <ReceiptText className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
              </div>
            )}
            {imageUrl && (
              <ImageViewer
                src={imageUrl}
                alt="Ticket"
                open={zoomOpen}
                onClose={() => setZoomOpen(false)}
              />
            )}
          </div>

          <div className="space-y-3">
            {status === "PROCESSING" && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm font-medium">Analizando ticket con IA...</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Esto puede tardar unos segundos.
                </p>
              </div>
            )}

            {status === "FAILED" && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-4">
                  <TriangleAlert className="mt-0.5 h-6 w-6 shrink-0 text-[hsl(var(--destructive))]" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <p className="font-medium text-[hsl(var(--destructive))]">
                      No se pudo leer el ticket
                    </p>
                    <p className="whitespace-pre-wrap wrap-break-word text-sm text-[hsl(var(--muted-foreground))]">
                      {prefix || "Error desconocido."}
                    </p>
                    {json && (
                      <pre className="max-h-56 overflow-auto rounded-lg bg-[hsl(var(--background))] p-3 text-xs text-[hsl(var(--muted-foreground))]">
                        {json}
                      </pre>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Intentos: {attempts ?? 0}
                  </span>
                  <Button variant="outline" size="sm" onClick={copyError}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar error
                  </Button>
                </div>
              </div>
            )}

            {(status === "PARSED" || status === "CONFIRMED") && (
              <>
                {status === "CONFIRMED" && <Badge variant="success">Registrado</Badge>}
                <ReceiptParsedInfo parsed={parsed} />
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {status === "FAILED" && (
            <Button
              onClick={() => {
                onRetry(receipt.id);
                onOpenChange(false);
              }}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reintentar
            </Button>
          )}
          {status === "PARSED" && (
            <Button
              onClick={() => {
                onReview(receipt);
                onOpenChange(false);
              }}
            >
              Revisar y registrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

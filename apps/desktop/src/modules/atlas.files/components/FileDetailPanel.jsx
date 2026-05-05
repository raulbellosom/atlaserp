import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@atlas/ui";
import { ExternalLink, FileSearch } from "lucide-react";
import { formatBytes, formatDate, getKindLabel, getFileKind } from "../lib/file-kind";
import { resolveFileOrigin } from "../lib/file-origin-resolver";

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[hsl(var(--border))]/60">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="text-sm text-right break-all">{value || "—"}</span>
    </div>
  );
}

export function FileDetailPanel({ open, onOpenChange, file, onGoOrigin }) {
  if (!file) return null;

  const origin = resolveFileOrigin(file);
  const kind = getFileKind(file.mimeType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            Detalle de archivo
          </DialogTitle>
          <DialogDescription>{file.originalName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Row label="ID" value={file.id} />
          <Row label="Nombre" value={file.originalName} />
          <Row label="Tipo" value={`${getKindLabel(kind)} · ${file.mimeType}`} />
          <Row label="Tamano" value={formatBytes(file.sizeBytes)} />
          <Row label="Modulo" value={file.moduleKey} />
          <Row label="Entidad" value={`${file.entityType || "—"} · ${file.entityId || "—"}`} />
          <Row label="Subido" value={formatDate(file.createdAt)} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Estado</span>
            <Badge variant={file.enabled ? "success" : "secondary"}>
              {file.enabled ? "Activo" : "Deshabilitado"}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-1.5">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Origen</p>
          <p className="text-sm font-medium">{origin.label}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {origin.originHint || "Sin informacion adicional"}
          </p>
          {origin.originPath ? (
            <Button size="sm" className="mt-1" onClick={() => onGoOrigin(origin.originPath)}>
              <ExternalLink className="h-3.5 w-3.5" />
              Ir al origen
            </Button>
          ) : (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Origen no navegable.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

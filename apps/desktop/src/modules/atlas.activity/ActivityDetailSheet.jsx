import {
  Badge,
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@atlas/ui";
import { ExternalLink } from "lucide-react";

const SEVERITY_VARIANT = {
  info: "secondary",
  success: "success",
  warning: "warning",
  critical: "destructive",
};

const SEVERITY_LABEL = {
  info: "Info",
  success: "Éxito",
  warning: "Advertencia",
  critical: "Crítico",
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "long",
      timeStyle: "medium",
    });
  } catch {
    return String(value);
  }
}

function getActorName(actor) {
  if (!actor) return "Sistema";
  return (
    actor.displayName ||
    [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim() ||
    "Sistema"
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="text-sm text-foreground break-words">{children}</div>
    </div>
  );
}

export default function ActivityDetailSheet({ activity, onClose, onNavigate }) {
  const open = Boolean(activity);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose?.()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalle del evento</SheetTitle>
          <SheetDescription>
            Información completa registrada en la bitácora.
          </SheetDescription>
        </SheetHeader>

        {activity && (
          <div className="mt-4 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={SEVERITY_VARIANT[activity.severity] ?? "secondary"}
              >
                {SEVERITY_LABEL[activity.severity] ??
                  activity.severity ??
                  "Info"}
              </Badge>
              <Badge variant="outline">{activity.type ?? "—"}</Badge>
              {activity.source && (
                <Badge variant="outline" className="text-muted-foreground">
                  {activity.source}
                </Badge>
              )}
            </div>

            <Field label="Resumen">
              <p className="leading-relaxed">{activity.summary ?? "—"}</p>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Actor">{getActorName(activity.actor)}</Field>
              <Field label="Fecha">{formatDate(activity.createdAt)}</Field>
              <Field label="Tipo de entidad">
                {activity.entityType ?? "—"}
              </Field>
              <Field label="ID de entidad">
                <code className="text-xs">{activity.entityId ?? "—"}</code>
              </Field>
            </div>

            {activity.link && (
              <Field label="Enlace">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate?.(activity.link)}
                >
                  <ExternalLink size={14} />
                  Abrir entidad
                </Button>
              </Field>
            )}

            <Field label="Datos adicionales (payload)">
              {activity.payload ? (
                <pre className="text-xs bg-muted/40 border border-border rounded-lg p-3 overflow-x-auto max-h-72">
                  {JSON.stringify(activity.payload, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No se capturó información adicional para este evento.
                </p>
              )}
            </Field>

            <Field label="ID del evento">
              <code className="text-xs">{activity.id}</code>
            </Field>
          </div>
        )}

        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="outline" size="sm">
              Cerrar
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

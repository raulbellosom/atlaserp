import { useState } from "react";
import {
  X,
  MapPin,
  Video,
  Calendar,
  Clock,
  Users,
  Repeat,
  Edit2,
  Trash2,
  BellRing,
} from "lucide-react";
import { useDeleteEvent } from "../hooks/useCalendarData";
import { toast } from "sonner";
import { MarkdownViewer, ConfirmDialog, Skeleton } from "@atlas/ui";
import {
  formatReminderClock,
  formatReminderLead,
  getPrimaryReminderMinutes,
} from "../lib/reminder-utils";

const STATUS_LABELS = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptado",
  DECLINED: "Rechazado",
};

export default function EventDetailModal({
  event,
  onClose,
  onEdit,
  canEdit,
  canDelete,
}) {
  const deleteEvent = useDeleteEvent();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!event) return null;

  if (event._isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <div
          className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-136 max-w-[calc(100vw-2rem)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1.5 bg-[hsl(var(--muted))]" />
          <div className="flex items-center justify-end px-4 pt-3 pb-1">
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[hsl(var(--muted))]"
              title="Cerrar"
            >
              <X size={15} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          </div>
          <div className="px-5 pb-5 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  const calColor = event.color || event.calendar?.color || "#6B46C1";
  const reminderMinutes = getPrimaryReminderMinutes(event);
  const reminderClock = formatReminderClock(event, reminderMinutes);
  const deleteTitle = event._isRecurrenceInstance
    ? "Eliminar serie"
    : "Eliminar evento";
  const deleteDescription = event._isRecurrenceInstance
    ? "¿Eliminar todos los eventos de esta serie?"
    : "¿Eliminar este evento?";

  async function doDelete() {
    try {
      await deleteEvent.mutateAsync(event._baseEventId ?? event.id);
      toast.success("Evento eliminado");
      setConfirmOpen(false);
      onClose();
    } catch (err) {
      toast.error(err.message || "Error al eliminar el evento");
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <div
          className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-136 max-w-[calc(100vw-2rem)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1.5" style={{ backgroundColor: calColor }} />

          <div className="flex items-center justify-end gap-1 px-4 pt-3 pb-1">
            {canEdit && (
              <button
                onClick={() => onEdit(event)}
                className="p-1.5 rounded hover:bg-[hsl(var(--muted))]"
                title={event._isRecurrenceInstance ? "Editar serie" : "Editar"}
              >
                <Edit2
                  size={15}
                  className="text-[hsl(var(--muted-foreground))]"
                />
              </button>
            )}
            {canDelete && !event.sourceModule && (
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={deleteEvent.isPending}
                className="p-1.5 rounded hover:bg-[hsl(var(--muted))]"
                title={
                  event._isRecurrenceInstance ? "Eliminar serie" : "Eliminar"
                }
              >
                <Trash2
                  size={15}
                  className="text-[hsl(var(--muted-foreground))]"
                />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[hsl(var(--muted))]"
            >
              <X size={15} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          </div>

          <div className="px-5 pb-5 space-y-3">
            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] leading-tight">
              {event.title}
            </h2>

            {event.description && (
              <MarkdownViewer
                value={event.description}
                accentColor={calColor}
              />
            )}

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Clock
                  size={14}
                  className="text-[hsl(var(--muted-foreground))] mt-0.5 shrink-0"
                />
                <div className="text-sm text-[hsl(var(--foreground))]">
                  {event.allDay ? (
                    new Date(event.startAt).toLocaleDateString("es-MX", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  ) : (
                    <>
                      <div>
                        {new Date(event.startAt).toLocaleDateString("es-MX", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">
                        {new Date(event.startAt).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                        {event.endAt &&
                          ` – ${new Date(event.endAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })}`}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {event.location && (
                <div className="flex items-center gap-2.5">
                  <MapPin
                    size={14}
                    className="text-[hsl(var(--muted-foreground))] shrink-0"
                  />
                  <span className="text-sm text-[hsl(var(--foreground))]">
                    {event.location}
                  </span>
                </div>
              )}

              {event.videoUrl && (
                <div className="flex items-center gap-2.5">
                  <Video
                    size={14}
                    className="text-[hsl(var(--muted-foreground))] shrink-0"
                  />
                  <a
                    href={event.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-violet-500 hover:underline truncate"
                  >
                    Unirse a la videollamada
                  </a>
                </div>
              )}

              {event.calendar && (
                <div className="flex items-center gap-2.5">
                  <Calendar
                    size={14}
                    className="text-[hsl(var(--muted-foreground))] shrink-0"
                  />
                  <span className="text-sm text-[hsl(var(--foreground))]">
                    {event.calendar.name}
                  </span>
                </div>
              )}

              {event.recurrenceRule && (
                <div className="flex items-center gap-2.5">
                  <Repeat
                    size={14}
                    className="text-[hsl(var(--muted-foreground))] shrink-0"
                  />
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    {event.recurrenceRule.freq === "DAILY" &&
                      "Se repite diariamente"}
                    {event.recurrenceRule.freq === "WEEKLY" &&
                      "Se repite semanalmente"}
                    {event.recurrenceRule.freq === "MONTHLY" &&
                      "Se repite mensualmente"}
                    {event.recurrenceRule.freq === "YEARLY" &&
                      "Se repite anualmente"}
                    {event.recurrenceRule.interval > 1 &&
                      ` cada ${event.recurrenceRule.interval}`}
                  </span>
                </div>
              )}

              {reminderMinutes !== null && (
                <div className="flex items-center gap-2.5">
                  <BellRing
                    size={14}
                    className="text-[hsl(var(--muted-foreground))] shrink-0"
                  />
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    {formatReminderLead(reminderMinutes)}
                    {reminderClock ? ` (${reminderClock})` : ""}
                  </span>
                </div>
              )}

              {event.attendees?.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <Users
                    size={14}
                    className="text-[hsl(var(--muted-foreground))] mt-0.5 shrink-0"
                  />
                  <div className="space-y-0.5">
                    {event.attendees.map((att) => (
                      <div key={att.id} className="flex items-center gap-2">
                        <span className="text-sm text-[hsl(var(--foreground))]">
                          {att.user?.firstName} {att.user?.lastName}
                        </span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded">
                          {STATUS_LABELS[att.status] ?? att.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={deleteTitle}
        description={deleteDescription}
        confirmLabel="Eliminar"
        loading={deleteEvent.isPending}
        onConfirm={doDelete}
      />
    </>
  );
}

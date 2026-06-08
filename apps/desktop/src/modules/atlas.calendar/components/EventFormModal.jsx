import { useState, useEffect, useRef } from "react";
import { X, Calendar, MapPin, Video, Repeat } from "lucide-react";
import {
  TextField,
  MarkdownField,
  DateTimeField,
  DatePickerField,
  SelectField,
  SwitchField,
} from "@atlas/ui";
import {
  useAddEventReminder,
  useCalendarEvent,
  useCalendars,
  useCreateEvent,
  useDeleteEventReminder,
  useUpdateEvent,
} from "../hooks/useCalendarData";
import { toast } from "sonner";

const FREQ_OPTIONS = [
  { value: "NONE", label: "Sin repeticion" },
  { value: "DAILY", label: "Diario" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "YEARLY", label: "Anual" },
];

const REMINDER_OPTIONS = [
  { value: "NONE", label: "Sin recordatorio" },
  { value: "0", label: "A la hora del evento" },
  { value: "5", label: "5 minutos antes" },
  { value: "10", label: "10 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
];

function toLocalDatetime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function buildDefaultForm(defaultDate, defaultCalendarId, allCalendars) {
  const now = new Date();
  const base = defaultDate || now.toISOString().slice(0, 10);
  const calId =
    defaultCalendarId ||
    allCalendars.find((c) => c.isDefault)?.id ||
    allCalendars[0]?.id ||
    "";
  return {
    title: "",
    description: "",
    calendarId: calId,
    startAt: `${base}T09:00`,
    endAt: `${base}T10:00`,
    allDay: false,
    location: "",
    videoUrl: "",
    reminderMinutes: "10",
    recurrenceFreq: "NONE",
    recurrenceInterval: 1,
  };
}

function buildEditForm(event) {
  const firstReminder = Array.isArray(event?.reminders)
    ? event.reminders[0]
    : null;
  return {
    title: event.title ?? "",
    description: event.description ?? "",
    // prefer direct FK field; fall back to the included relation
    calendarId: event.calendarId ?? event.calendar?.id ?? "",
    startAt: toLocalDatetime(event.startAt),
    endAt: toLocalDatetime(event.endAt),
    allDay: event.allDay ?? false,
    location: event.location ?? "",
    videoUrl: event.videoUrl ?? "",
    reminderMinutes: firstReminder
      ? String(firstReminder.minutesBefore)
      : "NONE",
    recurrenceFreq: event.recurrenceRule?.freq ?? "NONE",
    recurrenceInterval: event.recurrenceRule?.interval ?? 1,
  };
}

export default function EventFormModal({
  event,
  defaultDate,
  defaultCalendarId,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(event?.id);
  const editId = event?._baseEventId ?? event?.id ?? null;
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const addReminder = useAddEventReminder();
  const deleteReminder = useDeleteEventReminder();
  const eventDetailQuery = useCalendarEvent(editId, isEdit);
  const { data: calData } = useCalendars();
  const allCalendars = [...(calData?.owned ?? []), ...(calData?.shared ?? [])];

  // Initialize form: edit mode uses event data; new mode uses defaults.
  // We use a ref to avoid re-initializing on every calData update.
  const initializedRef = useRef(false);
  const [form, setForm] = useState(() =>
    isEdit
      ? buildEditForm(event)
      : buildDefaultForm(defaultDate, defaultCalendarId, allCalendars),
  );

  // For new events: set calendarId once when calData first becomes available
  // (in case calendars were not loaded when the modal opened).
  // Check is inside the functional updater so it always reads current state,
  // not the stale closure value — prevents overwriting the user's selection.
  useEffect(() => {
    if (isEdit || initializedRef.current) return;
    if (!allCalendars.length) return;
    initializedRef.current = true;
    const calId =
      defaultCalendarId ||
      calData?.owned?.find((c) => c.isDefault)?.id ||
      allCalendars[0]?.id ||
      "";
    setForm((f) => (f.calendarId ? f : { ...f, calendarId: calId }));
  }, [calData]);

  // For edit events: repopulate form when the event changes
  useEffect(() => {
    if (!isEdit || !event?.id) return;
    setForm(buildEditForm(event));
  }, [event?.id]);

  useEffect(() => {
    if (!isEdit || !eventDetailQuery.data) return;
    const reminderMinutes =
      Array.isArray(eventDetailQuery.data.reminders) &&
      eventDetailQuery.data.reminders[0]
        ? String(eventDetailQuery.data.reminders[0].minutesBefore)
        : "NONE";
    setForm((prev) =>
      prev.reminderMinutes === reminderMinutes
        ? prev
        : { ...prev, reminderMinutes },
    );
  }, [isEdit, eventDetailQuery.dataUpdatedAt]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const calendarOptions = allCalendars.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("El titulo es requerido");
      return;
    }
    if (!form.calendarId) {
      toast.error("Selecciona un calendario");
      return;
    }
    if (!form.startAt) {
      toast.error("La fecha de inicio es requerida");
      return;
    }

    const recurrenceRule =
      form.recurrenceFreq && form.recurrenceFreq !== "NONE"
        ? {
            freq: form.recurrenceFreq,
            interval: Number(form.recurrenceInterval) || 1,
          }
        : null;

    const toISO = (v) => (v ? new Date(v).toISOString() : null);

    const payload = {
      calendarId: form.calendarId,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      startAt: toISO(form.startAt),
      endAt: form.allDay ? null : toISO(form.endAt),
      allDay: form.allDay,
      location: form.location.trim() || null,
      videoUrl: form.videoUrl.trim() || null,
      recurrenceRule,
    };

    if (!isEdit && form.reminderMinutes && form.reminderMinutes !== "NONE") {
      payload.reminderMinutes = [Number(form.reminderMinutes)];
    }

    try {
      if (isEdit) {
        await updateEvent.mutateAsync({ id: editId, ...payload });

        const existingReminders = Array.isArray(
          eventDetailQuery.data?.reminders,
        )
          ? eventDetailQuery.data.reminders
          : [];
        const nextReminder = form.reminderMinutes;
        if (nextReminder === "NONE") {
          for (const reminder of existingReminders) {
            await deleteReminder.mutateAsync({
              eventId: editId,
              reminderId: reminder.id,
            });
          }
        } else {
          const desiredMinutes = Number(nextReminder);
          const hasSameReminder = existingReminders.some(
            (reminder) => Number(reminder.minutesBefore) === desiredMinutes,
          );
          if (!hasSameReminder) {
            for (const reminder of existingReminders) {
              await deleteReminder.mutateAsync({
                eventId: editId,
                reminderId: reminder.id,
              });
            }
            await addReminder.mutateAsync({
              eventId: editId,
              minutesBefore: desiredMinutes,
            });
          }
        }

        toast.success("Evento actualizado");
      } else {
        await createEvent.mutateAsync(payload);
        toast.success("Evento creado");
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Error al guardar el evento");
    }
  }

  const isPending =
    createEvent.isPending ||
    updateEvent.isPending ||
    addReminder.isPending ||
    deleteReminder.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
            {isEdit ? "Editar evento" : "Nuevo evento"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[hsl(var(--muted))]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[72vh] overflow-y-auto">
          <TextField
            label="Titulo"
            required
            placeholder="Nombre del evento"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            autoFocus
          />

          <SwitchField
            label="Todo el dia"
            description="El evento dura todo el dia sin hora especifica"
            checked={form.allDay}
            onChange={(v) => {
              setForm((f) => {
                const dateOnly =
                  f.startAt?.slice(0, 10) ??
                  new Date().toISOString().slice(0, 10);
                return {
                  ...f,
                  allDay: v,
                  startAt: v ? `${dateOnly}T09:00` : f.startAt,
                  endAt: v
                    ? f.endAt?.slice(0, 10)
                      ? `${f.endAt.slice(0, 10)}T23:59`
                      : null
                    : f.endAt,
                };
              });
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            {form.allDay ? (
              <>
                <DatePickerField
                  label="Inicio"
                  required
                  value={form.startAt?.slice(0, 10) ?? ""}
                  onChange={(val) => set("startAt", val ? `${val}T09:00` : "")}
                />
                <DatePickerField
                  label="Fin"
                  value={form.endAt?.slice(0, 10) ?? ""}
                  onChange={(val) => set("endAt", val ? `${val}T23:59` : "")}
                />
              </>
            ) : (
              <>
                <DateTimeField
                  label="Inicio"
                  required
                  value={form.startAt}
                  onChange={(e) => set("startAt", e.target.value)}
                />
                <DateTimeField
                  label="Fin"
                  value={form.endAt}
                  onChange={(e) => set("endAt", e.target.value)}
                />
              </>
            )}
          </div>

          <SelectField
            label="Calendario"
            required
            icon={Calendar}
            placeholder="Seleccionar calendario..."
            options={calendarOptions}
            value={form.calendarId}
            onValueChange={(v) => set("calendarId", v)}
          />

          <MarkdownField
            label="Descripcion"
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />

          <TextField
            label="Ubicacion"
            icon={MapPin}
            placeholder="Lugar del evento"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />

          <TextField
            label="URL de videollamada"
            icon={Video}
            placeholder="https://meet.google.com/..."
            value={form.videoUrl}
            onChange={(e) => set("videoUrl", e.target.value)}
            type="url"
          />

          <SelectField
            label="Recordatorio"
            icon={Calendar}
            options={REMINDER_OPTIONS}
            value={form.reminderMinutes}
            onValueChange={(v) => set("reminderMinutes", v)}
          />

          <SelectField
            label="Repeticion"
            icon={Repeat}
            options={FREQ_OPTIONS}
            value={form.recurrenceFreq}
            onValueChange={(v) => set("recurrenceFreq", v)}
          />

          {form.recurrenceFreq && form.recurrenceFreq !== "NONE" && (
            <TextField
              label="Intervalo"
              type="number"
              min={1}
              max={99}
              value={String(form.recurrenceInterval)}
              onChange={(e) => set("recurrenceInterval", e.target.value)}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[hsl(var(--border))]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50"
          >
            {isPending
              ? "Guardando..."
              : isEdit
                ? "Actualizar"
                : "Crear evento"}
          </button>
        </div>
      </form>
    </div>
  );
}

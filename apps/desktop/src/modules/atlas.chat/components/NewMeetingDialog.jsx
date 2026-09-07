import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, SelectField, TagsField,
} from "@atlas/ui";
import { Video, Calendar } from "lucide-react";
import { toast } from "sonner";
import EventFormModal from "../../atlas.calendar/components/EventFormModal";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useChatConversations } from "../hooks/useChatConversations";
import { getConversationDisplayName } from "../lib/chatUtils";
import { useCalls } from "../calls/CallsProvider";

function unwrap(r) {
  return r?.data ?? r;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEW_ROOM = "__new__";

// Meet-style: pick "ahora" or "programar".
//  - Ahora   -> opens the call room immediately; the link + email invites live
//              INSIDE the room (CallInvitePanel) while you wait alone.
//  - Programar -> collect emails + open EventFormModal; invites are sent only
//              when the event is saved ("Programar en el calendario").
export function NewMeetingDialog({ open, onOpenChange, defaultConversationId = null }) {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const { data } = useChatConversations();
  const { enabled: callsEnabled, startCall } = useCalls();

  const conversations = useMemo(() => {
    const list = unwrap(data) ?? [];
    return list.filter((c) => c.type === "channel" || c.type === "group");
  }, [data]);

  const [conversationId, setConversationId] = useState(defaultConversationId ?? NEW_ROOM);
  const [mode, setMode] = useState("now"); // "now" | "schedule"
  const [emails, setEmails] = useState([]);
  const [busy, setBusy] = useState(false);
  const [scheduled, setScheduled] = useState(null); // { targetId, link } once ready for EventFormModal
  const submittingRef = useRef(false);
  const createdRoomRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setMode("now"); setEmails([]); setBusy(false); setScheduled(null);
    submittingRef.current = false; createdRoomRef.current = null;
    setConversationId(defaultConversationId ?? NEW_ROOM);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = conversations.find((c) => c.id === conversationId) ?? null;
  const memberIds = (selected?.members ?? []).map((m) => m.userId).filter(Boolean);

  async function resolveTargetId() {
    if (conversationId !== NEW_ROOM) return conversationId;
    if (createdRoomRef.current) return createdRoomRef.current;
    const when = new Date().toLocaleDateString([], { day: "2-digit", month: "short" });
    const room = unwrap(await atlas.chat.createChannel({ title: `Reunión ${when}`, isPublic: false }, token));
    if (!room?.id) throw new Error("No se pudo crear la sala.");
    createdRoomRef.current = room.id;
    return room.id;
  }

  async function startNow() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      const targetId = await resolveTargetId();
      const ok = await startCall({ conversationId: targetId, kind: "VIDEO" });
      if (ok) onOpenChange(false);
      else toast.error("No se pudo iniciar la reunión.");
    } catch (e) {
      toast.error(e?.message || "No se pudo iniciar la reunión.");
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  async function continueToSchedule() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      const targetId = await resolveTargetId();
      const created = unwrap(await atlas.calls.createLink(targetId, token));
      const link = created?.link ?? null;
      if (!link) throw new Error("No se pudo generar el enlace de invitados.");
      setScheduled({ targetId, link });
    } catch (e) {
      toast.error(e?.message || "No se pudo preparar la reunión.");
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  // Invites go out only once the event is actually saved.
  async function sendScheduledInvites(targetId) {
    if (!emails.length) return;
    try {
      const res = unwrap(await atlas.calls.sendInvites(targetId, emails, token));
      const n = (res?.invited?.length ?? 0) + (res?.matchedUsers?.length ?? 0);
      if (n) toast.success(`${n} invitación(es) enviadas.`);
      if (res?.pendingManual?.length) {
        toast.message(
          res?.smtpConfigured === false
            ? "El correo no está configurado — comparte el enlace manualmente."
            : "Algunos correos no se pudieron enviar.",
        );
      }
    } catch (e) {
      toast.error(e?.message || "No se pudieron enviar las invitaciones.");
    }
  }

  if (scheduled) {
    return (
      <EventFormModal
        sourceModule="atlas.chat"
        sourceEntityId={scheduled.targetId}
        initialAttendeeIds={memberIds}
        defaultVideoUrl={scheduled.link.url}
        onClose={() => { setScheduled(null); onOpenChange(false); }}
        onSaved={async () => {
          await sendScheduledInvites(scheduled.targetId);
          toast.success(`Reunión programada. Código de invitados: ${scheduled.link.code}`);
          setScheduled(null);
          onOpenChange(false);
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nueva reunión</DialogTitle></DialogHeader>

        {!callsEnabled ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Las llamadas no están configuradas en esta instancia.
          </p>
        ) : (
          <div className="space-y-4">
            <SelectField
              label="Sala"
              value={conversationId}
              onValueChange={setConversationId}
              options={[
                { value: NEW_ROOM, label: "➕ Nueva sala de reunión" },
                ...conversations.map((c) => ({
                  value: c.id,
                  label: getConversationDisplayName(c, userProfile?.id),
                })),
              ]}
            />

            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "now", label: "Ahora", hint: "Entra ya y espera a los demás", Icon: Video },
                { key: "schedule", label: "Programar", hint: "Elige fecha y hora", Icon: Calendar },
              ].map(({ key, label, hint, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={[
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                    mode === key
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)]"
                      : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)]",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
                    <Icon className="h-4 w-4" /> {label}
                  </span>
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{hint}</span>
                </button>
              ))}
            </div>

            {mode === "schedule" && (
              <TagsField
                label="Invitados externos por correo (opcional)"
                placeholder="ana@empresa.com  (Enter para agregar)"
                value={emails}
                onChange={setEmails}
                type="email"
                inputMode="email"
                normalizeItem={(v) => v.trim().toLowerCase()}
                validateItem={(v) => (EMAIL_RE.test(v) ? null : "Correo no válido")}
              />
            )}

            <div className="flex justify-end pt-1">
              {mode === "now" ? (
                <Button onClick={startNow} disabled={busy}>
                  <Video className="mr-2 h-4 w-4" /> {busy ? "Abriendo..." : "Iniciar reunión"}
                </Button>
              ) : (
                <Button onClick={continueToSchedule} disabled={busy}>
                  <Calendar className="mr-2 h-4 w-4" /> {busy ? "Preparando..." : "Continuar"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

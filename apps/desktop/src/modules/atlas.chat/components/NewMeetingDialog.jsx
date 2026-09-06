import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, SelectField, TextareaField,
} from "@atlas/ui";
import { Video, Calendar, Copy, Check } from "lucide-react";
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

// "Nueva reunión" — pick a channel/group, generate a guest link (+ optional
// email invites), then either start a video call now or schedule a calendar
// event (the guest link is stored on the event as its videoUrl).
export function NewMeetingDialog({ open, onOpenChange, defaultConversationId = null }) {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const { data } = useChatConversations();
  const { enabled: callsEnabled, startCall } = useCalls();

  const conversations = useMemo(() => {
    const list = unwrap(data) ?? [];
    return list.filter((c) => c.type === "channel" || c.type === "group");
  }, [data]);

  const [conversationId, setConversationId] = useState(defaultConversationId ?? "");
  const [mode, setMode] = useState("now"); // "now" | "schedule"
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(null); // { url, code, ... }
  const [showEventForm, setShowEventForm] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("now"); setEmails(""); setLink(null); setShowEventForm(false); setBusy(false);
    setConversationId(
      defaultConversationId
      && conversations.some((c) => c.id === defaultConversationId)
        ? defaultConversationId
        : conversations[0]?.id ?? "",
    );
  }, [open, defaultConversationId, conversations]);

  const selected = conversations.find((c) => c.id === conversationId) ?? null;
  const memberIds = (selected?.members ?? []).map((m) => m.userId).filter(Boolean);

  function copy(value, key) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    });
  }

  async function generate() {
    if (!conversationId) return;
    setBusy(true);
    try {
      const created = unwrap(await atlas.calls.createLink(conversationId, token));
      const newLink = created?.link ?? null;
      if (!newLink) throw new Error("No se pudo generar el enlace.");
      setLink(newLink);

      const list = emails.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
      if (list.length) {
        const res = unwrap(await atlas.calls.sendInvites(conversationId, list, token).catch(() => null));
        const n = (res?.invited?.length ?? 0) + (res?.matchedUsers?.length ?? 0);
        if (n) toast.success(`${n} invitación(es) procesadas.`);
        if (res?.pendingManual?.length) toast.message("Algunas quedaron pendientes — comparte el enlace manualmente.");
      }

      if (mode === "schedule") setShowEventForm(true);
    } catch (e) {
      toast.error(e?.message || "No se pudo crear la reunión.");
    } finally {
      setBusy(false);
    }
  }

  function startNow() {
    startCall({ conversationId, kind: "VIDEO" });
    onOpenChange(false);
  }

  if (showEventForm && link) {
    return (
      <EventFormModal
        sourceModule="atlas.chat"
        sourceEntityId={conversationId}
        initialAttendeeIds={memberIds}
        defaultVideoUrl={link.url}
        onClose={() => { setShowEventForm(false); onOpenChange(false); }}
        onSaved={() => {
          toast.success(`Reunión agendada. Código de invitados: ${link.code}`);
          setShowEventForm(false);
          onOpenChange(false);
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Nueva reunión</DialogTitle></DialogHeader>

        {!callsEnabled ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Las llamadas no están configuradas en esta instancia.
          </p>
        ) : conversations.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Crea un canal o grupo primero para agendar una reunión.
          </p>
        ) : (
          <div className="space-y-4">
            <SelectField
              label="Canal o grupo"
              value={conversationId}
              onValueChange={setConversationId}
              options={conversations.map((c) => ({
                value: c.id,
                label: getConversationDisplayName(c, userProfile?.id),
              }))}
            />

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[hsl(var(--muted-foreground))]">¿Cuándo?</span>
              <div className="flex gap-2">
                {[
                  { key: "now", label: "Empezar ahora", Icon: Video },
                  { key: "schedule", label: "Programar", Icon: Calendar },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setMode(key); setLink(null); }}
                    className={[
                      "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                      mode === key
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--foreground))]"
                        : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <TextareaField
              label="Invitados externos por correo (opcional)"
              placeholder="ana@empresa.com, luis@otra.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={2}
            />

            {link && mode === "now" && (
              <div className="space-y-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
                <div className="flex items-center gap-2">
                  <input readOnly value={link.url} className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs" />
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => copy(link.url, "url")}>
                    {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Código:</span>
                  <code className="font-mono text-sm tracking-widest">{link.code}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(link.code, "code")}>
                    {copied === "code" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {link && mode === "now" ? (
                <Button onClick={startNow}>
                  <Video className="mr-2 h-4 w-4" /> Iniciar videollamada
                </Button>
              ) : (
                <Button onClick={generate} disabled={busy || !conversationId}>
                  {busy ? "Creando..." : mode === "now" ? "Generar enlace" : "Continuar a programar"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { Button } from "@atlas/ui";
import { Send } from "lucide-react";

function timeLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Presentational plain-text room chat. No markdown, no mentions, no HTML.
export function RoomChatView({ messages, onSend, notice, currentName }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  function submit(e) {
    e?.preventDefault?.();
    const t = draft.trim();
    if (!t) return;
    onSend(t);
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[hsl(var(--background))]">
      {notice && (
        <p className="shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
          {notice}
        </p>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m, i) => {
          const mine = m.mine || m.senderName === currentName;
          return (
            <div key={m.id ?? `l${i}`} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {m.senderName}{m.senderKind === "guest" ? " · invitado" : ""} · {timeLabel(m.createdAt)}
              </span>
              <span
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                  mine ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "bg-[hsl(var(--muted))]"
                }`}
              >
                {m.body}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-[hsl(var(--border))] p-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
          rows={1}
          placeholder="Mensaje..."
          className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

function timeLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Presentational plain-text room chat. No markdown, no mentions, no HTML.
// Always rendered inside a dark call surface (member CallRoom + guest
// GuestCallRoom, both bg-slate-950), and guests force a light page theme — so
// this component is deliberately dark-locked instead of using app theme tokens.
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
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
      {notice && (
        <p className="shrink-0 border-b border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-400">
          {notice}
        </p>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m, i) => {
          const mine = m.mine || m.senderName === currentName;
          return (
            <div key={m.id ?? `l${i}`} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <span className="text-[10px] text-slate-400">
                {m.senderName}{m.senderKind === "guest" ? " · invitado" : ""} · {timeLabel(m.createdAt)}
              </span>
              <span
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                  mine ? "bg-violet-600 text-white" : "bg-white/10 text-slate-100"
                }`}
              >
                {m.body}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-white/10 p-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
          rows={1}
          placeholder="Mensaje..."
          className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/30"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
